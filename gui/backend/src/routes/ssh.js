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
    conn.connect({ ...config, readyTimeout: 10000 });
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
    const result = await sshExec(conn, 'uname -a && hostname');
    conn.end();
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
    const result = await sshExec(conn, `echo '${username}:${newPassword.replace(/'/g, "'\\''")}' | chpasswd`);
    conn.end();
    if (result.code !== 0) {
      return res.status(400).json({ ok: false, error: result.stderr || 'Changement échoué' });
    }
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
      return res.status(400).json({ ok: false, error: result.stderr });
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
