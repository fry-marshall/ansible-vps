const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const ANSIBLE_DIR = path.resolve(__dirname, '../../../../ansible');
const LOGS_DIR = path.resolve(__dirname, '../../logs');
const DATA_FILE = path.resolve(__dirname, '../../data/hosts.json');
const VAULT_FILE = path.join(ANSIBLE_DIR, 'group_vars/vps/vault.yml');

function ensureVault(socket) {
  if (fs.existsSync(VAULT_FILE)) return;
  // Create minimal vault with placeholder SMTP — pubkey is now in vars.yml
  const vaultContent = [
    'vault_smtp_user: changeme@gmail.com',
    'vault_smtp_password: changeme',
    'vault_alert_email: changeme@gmail.com',
  ].join('\n') + '\n';
  fs.writeFileSync(VAULT_FILE, vaultContent, { mode: 0o600 });
  socket.emit('job:output', { type: 'stdout', text: '[setup] vault.yml créé avec des valeurs SMTP placeholder\n' });
}

if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

const activeJobs = new Map();

function getLogFile(jobId) {
  return path.join(LOGS_DIR, `${jobId}.log`);
}

function saveLog(jobId, meta) {
  const logFile = getLogFile(jobId);
  fs.writeFileSync(logFile, JSON.stringify(meta, null, 2));
}

function listLogs() {
  try {
    return fs.readdirSync(LOGS_DIR)
      .filter(f => f.endsWith('.log'))
      .map(f => {
        try {
          const content = fs.readFileSync(path.join(LOGS_DIR, f), 'utf8');
          return JSON.parse(content);
        } catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  } catch { return []; }
}

function runAnsible(command, args, socket, jobId, vaultPassword = null) {
  const env = {
    ...process.env,
    PATH: `${process.env.PATH}:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin`,
    ANSIBLE_FORCE_COLOR: '1',
    PYTHONUNBUFFERED: '1'
  };

  const actualArgs = [...args];
  let vaultPassFile = null;

  if (vaultPassword) {
    vaultPassFile = `/tmp/vault-pass-${jobId}`;
    fs.writeFileSync(vaultPassFile, vaultPassword, { mode: 0o600 });
    actualArgs.push('--vault-password-file', vaultPassFile);
  }

  const meta = {
    jobId,
    command,
    args: actualArgs,
    startedAt: new Date().toISOString(),
    status: 'running',
    output: []
  };

  saveLog(jobId, meta);
  socket.emit('job:start', { jobId, startedAt: meta.startedAt });

  const proc = spawn(command, actualArgs, { cwd: ANSIBLE_DIR, env });
  activeJobs.set(jobId, proc);

  const appendOutput = (data, type = 'stdout') => {
    const text = data.toString();
    meta.output.push({ type, text, ts: Date.now() });
    socket.emit('job:output', { jobId, type, text });
    saveLog(jobId, meta);
  };

  proc.stdout.on('data', (d) => appendOutput(d, 'stdout'));
  proc.stderr.on('data', (d) => appendOutput(d, 'stderr'));

  proc.on('close', (code) => {
    meta.status = code === 0 ? 'success' : 'failed';
    meta.exitCode = code;
    meta.finishedAt = new Date().toISOString();
    saveLog(jobId, meta);
    socket.emit('job:done', { jobId, exitCode: code, status: meta.status });
    activeJobs.delete(jobId);
    if (vaultPassFile && fs.existsSync(vaultPassFile)) {
      fs.unlinkSync(vaultPassFile);
    }
  });

  proc.on('error', (err) => {
    meta.status = 'error';
    meta.error = err.message;
    meta.finishedAt = new Date().toISOString();
    saveLog(jobId, meta);
    socket.emit('job:error', { jobId, error: err.message });
    activeJobs.delete(jobId);
  });

  return proc;
}

function setupDeploySocket(socket, io) {
  socket.on('deploy:run', ({ jobId, tags, vaultPassword, checkMode }) => {
    ensureVault(socket);
    const args = ['-i', 'inventory.ini', 'playbook.yml'];
    if (tags && tags.length) args.push('--tags', tags.join(','));
    if (checkMode) args.push('--check');
    runAnsible('ansible-playbook', args, socket, jobId, vaultPassword);
  });

  socket.on('deploy:ping', ({ jobId }) => {
    const args = ['-i', 'inventory.ini', 'vps', '-m', 'ping'];
    runAnsible('ansible', args, socket, jobId, null);
  });

  socket.on('deploy:cancel', ({ jobId }) => {
    const proc = activeJobs.get(jobId);
    if (proc) {
      proc.kill('SIGTERM');
      socket.emit('job:cancelled', { jobId });
    }
  });
}

module.exports = { setupDeploySocket, listLogs, getLogFile, ANSIBLE_DIR };
