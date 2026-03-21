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

module.exports = router;
