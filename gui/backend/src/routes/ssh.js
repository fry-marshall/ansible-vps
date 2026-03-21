const express = require('express');
const router = express.Router();
const { Client } = require('ssh2');
const fs = require('fs');
const os = require('os');
const path = require('path');

function sshConnect(config) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => resolve(conn));
    conn.on('error', reject);
    // tryKeyboard: true allows handling keyboard-interactive auth (e.g. expired password prompts)
    conn.connect({ ...config, readyTimeout: 15000, tryKeyboard: true });
  });
}

function sshExec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let stdout = '', stderr = '';
      stream.on('data', d => stdout += d.toString());
      stream.stderr.on('data', d => stderr += d.toString());
      stream.on('close', (code) => resolve({ code, stdout, stderr }));
    });
  });
}

// Shell-based password change: handles the PAM forced-password-change flow via a PTY shell.
// Works whether the password is expired (server shows prompts immediately) or not (runs chpasswd).
function sshShellChangePassword(conn, username, currentPassword, newPassword) {
  return new Promise((resolve, reject) => {
    conn.shell({ term: 'vt100', cols: 220 }, (err, stream) => {
      if (err) return reject(err);

      let output = '';
      let stage = 'init';
      let settled = false;

      const settle = (ok, msg) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        stream.end();
        ok ? resolve({ ok: true, output }) : reject(new Error(msg));
      };

      const timer = setTimeout(() => settle(false, 'Timeout: pas de réponse du serveur'), 25000);

      const write = (text) => setTimeout(() => { if (!settled) stream.write(text + '\n'); }, 150);

      stream.on('data', (data) => {
        const text = data.toString();
        output += text;

        // Expired password: server forces change immediately
        if (/Current password:|current\) UNIX password:/i.test(text) && stage === 'init') {
          stage = 'current'; write(currentPassword); return;
        }
        if (/New password:|Enter new UNIX password:/i.test(text) && stage === 'current') {
          stage = 'new'; write(newPassword); return;
        }
        if (/Retype new password:|Retype new UNIX password:/i.test(text) && stage === 'new') {
          stage = 'confirm'; write(newPassword); return;
        }

        // Normal shell prompt (password not expired) — use chpasswd
        if (/[#$]\s*$/.test(text.trim()) && stage === 'init') {
          stage = 'chpasswd';
          const safeNew = newPassword.replace(/'/g, "'\\''");
          write(`echo '${username}:${safeNew}' | chpasswd && echo '__PWD_OK__'`);
          return;
        }

        if (text.includes('__PWD_OK__')) { settle(true, 'ok'); return; }

        // Success after interactive change
        if (/password updated successfully|passwd: password updated/i.test(text)) { settle(true, 'ok'); return; }
        if (stage === 'confirm' && /[#$]\s*$/.test(text.trim())) { settle(true, 'ok'); return; }

        // Failure: server rejected the password and loops back to "New password:"
        if ((stage === 'confirm' || stage === 'new') &&
            /The password has not been changed|BAD PASSWORD|too short|too simple|dictionary|must differ|same as/i.test(text)) {
          const reason = text.trim().split(/\r?\n/).filter(l => l.trim() && !/^$/.test(l)).pop() || 'Mot de passe rejeté';
          settle(false, reason);
          return;
        }
        if (/passwd: Authentication token manipulation error/i.test(text)) {
          settle(false, 'Erreur PAM — mot de passe rejeté par la politique du serveur');
        }
      });

      stream.on('close', () => {
        if (!settled) settle(output.includes('updated') || output.includes('__PWD_OK__'), 'Connexion fermée');
      });
      stream.on('error', (e) => settle(false, e.message));
    });
  });
}

function isPasswordExpired(stderr) {
  return /password has expired|Password change required/i.test(stderr);
}

// Liste les clés publiques SSH disponibles sur la machine
router.get('/keys', (req, res) => {
  const sshDir = path.join(os.homedir(), '.ssh');
  try {
    const files = fs.readdirSync(sshDir);
    const pubKeys = files
      .filter(f => f.endsWith('.pub'))
      .map(f => {
        const fullPath = path.join(sshDir, f);
        const content = fs.readFileSync(fullPath, 'utf8').trim();
        return { name: f, path: fullPath, content };
      });
    res.json(pubKeys);
  } catch {
    res.json([]);
  }
});

// Test de connexion SSH (root + password)
router.post('/test', async (req, res) => {
  const { host, port = 22, username = 'root', password } = req.body;
  if (!host || !password) return res.status(400).json({ error: 'host et password requis' });

  try {
    const conn = await sshConnect({ host, port: Number(port), username, password });
    // No PTY: if password is expired PAM writes the warning to stderr and exits with code 1.
    // We detect that and still return ok=true with passwordExpired flag.
    const result = await sshExec(conn, 'uname -a && hostname');
    conn.end();

    if (isPasswordExpired(result.stderr)) {
      return res.json({ ok: true, output: result.stderr.trim(), passwordExpired: true });
    }
    if (result.code !== 0) {
      return res.status(400).json({ ok: false, error: result.stderr || result.stdout || 'Commande échouée' });
    }

    res.json({ ok: true, output: result.stdout.trim() });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Changement du mot de passe root
router.post('/change-password', async (req, res) => {
  const { host, port = 22, username = 'root', currentPassword, newPassword } = req.body;
  if (!host || !currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Paramètres manquants' });
  }

  try {
    const conn = await sshConnect({ host, port: Number(port), username, password: currentPassword });
    // Use shell + PTY: handles both expired (forced interactive) and normal (chpasswd) cases.
    await sshShellChangePassword(conn, username, currentPassword, newPassword);
    conn.end();
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Copie de la clé SSH publique → authorized_keys
router.post('/copy-key', async (req, res) => {
  const { host, port = 22, username = 'root', password, publicKey } = req.body;
  if (!host || !password || !publicKey) {
    return res.status(400).json({ error: 'Paramètres manquants' });
  }

  try {
    const conn = await sshConnect({ host, port: Number(port), username, password });

    // Créer ~/.ssh + authorized_keys si nécessaire, ajouter la clé si pas déjà présente
    const safeKey = publicKey.trim().replace(/'/g, "'\\''");
    const cmd = [
      'mkdir -p ~/.ssh',
      'chmod 700 ~/.ssh',
      `grep -qF '${safeKey}' ~/.ssh/authorized_keys 2>/dev/null || echo '${safeKey}' >> ~/.ssh/authorized_keys`,
      'chmod 600 ~/.ssh/authorized_keys'
    ].join(' && ');

    const result = await sshExec(conn, cmd);
    conn.end();

    if (result.code !== 0) {
      return res.status(400).json({ ok: false, error: result.stderr || result.stdout || 'Copie échouée' });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Vérification que la clé SSH fonctionne (connexion sans mot de passe)
router.post('/verify-key', async (req, res) => {
  const { host, port = 22, username = 'root', privateKeyPath } = req.body;
  if (!host || !privateKeyPath) return res.status(400).json({ error: 'Paramètres manquants' });

  try {
    const privateKey = fs.readFileSync(privateKeyPath.replace('~', os.homedir()));
    const conn = await sshConnect({ host, port: Number(port), username, privateKey });
    const result = await sshExec(conn, 'echo ok');
    conn.end();
    res.json({ ok: result.stdout.trim() === 'ok' });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// ─── SSH CONFIG (~/.ssh/config) ──────────────────────────────────────────────

function getSshConfigPath() {
  return path.join(os.homedir(), '.ssh', 'config');
}

function removeHostEntry(content, alias) {
  const lines = content.split('\n');
  const result = [];
  let skip = false;
  for (const line of lines) {
    const isHostLine = /^Host\s/i.test(line);
    if (isHostLine && line.trim().toLowerCase() === `host ${alias.toLowerCase()}`) {
      skip = true;
      continue;
    }
    if (skip && isHostLine) skip = false;
    if (!skip) result.push(line);
  }
  return result.join('\n');
}

// GET ~/.ssh/config
router.get('/ssh-config', (req, res) => {
  const configPath = getSshConfigPath();
  try {
    const content = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '';
    res.json({ content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST add/update an SSH config alias entry
router.post('/ssh-config', (req, res) => {
  const { alias, hostname, user, port, identityFile } = req.body;
  if (!alias || !hostname) return res.status(400).json({ error: 'alias et hostname requis' });

  const configPath = getSshConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  let content = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '';

  content = removeHostEntry(content, alias);

  const entry = [
    `Host ${alias}`,
    `    HostName ${hostname}`,
    `    User ${user || 'root'}`,
    `    Port ${port || 22}`,
    `    IdentityFile ${identityFile || '~/.ssh/id_ed25519'}`,
    ''
  ].join('\n');

  content = content.trimEnd() + '\n\n' + entry;
  fs.writeFileSync(configPath, content, { mode: 0o600 });
  res.json({ ok: true });
});

// DELETE an SSH config alias
router.delete('/ssh-config/:alias', (req, res) => {
  const configPath = getSshConfigPath();
  if (!fs.existsSync(configPath)) return res.json({ ok: true });
  let content = fs.readFileSync(configPath, 'utf8');
  content = removeHostEntry(content, req.params.alias);
  fs.writeFileSync(configPath, content, { mode: 0o600 });
  res.json({ ok: true });
});

// ─── ADD KEY TO CONFIGURED VPS ───────────────────────────────────────────────

// POST add a new public key to a configured VPS (connects via existing private key)
router.post('/add-authorized-key', async (req, res) => {
  const { host, port = 22, username, privateKeyPath, newPublicKey } = req.body;
  if (!host || !privateKeyPath || !newPublicKey) {
    return res.status(400).json({ error: 'Paramètres manquants' });
  }

  try {
    const privateKey = fs.readFileSync(privateKeyPath.replace('~', os.homedir()));
    const conn = await sshConnect({ host, port: Number(port), username: username || 'root', privateKey });

    const safeKey = newPublicKey.trim().replace(/'/g, "'\\''");
    const cmd = [
      'mkdir -p ~/.ssh',
      'chmod 700 ~/.ssh',
      `grep -qF '${safeKey}' ~/.ssh/authorized_keys 2>/dev/null || echo '${safeKey}' >> ~/.ssh/authorized_keys`,
      'chmod 600 ~/.ssh/authorized_keys'
    ].join(' && ');

    const result = await sshExec(conn, cmd);
    conn.end();

    if (result.code !== 0) {
      return res.status(400).json({ ok: false, error: result.stderr });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

module.exports = router;
