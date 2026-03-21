const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { execSync } = require('child_process');

const ANSIBLE_DIR = path.resolve(__dirname, '../../../../ansible');
const VARS_FILE = path.join(ANSIBLE_DIR, 'group_vars/vps/vars.yml');
const VAULT_FILE = path.join(ANSIBLE_DIR, 'group_vars/vps/vault.yml');
const VAULT_EXAMPLE = path.join(ANSIBLE_DIR, 'group_vars/vps/vault.yml.example');

// GET vars.yml
router.get('/vars', (req, res) => {
  try {
    const content = fs.readFileSync(VARS_FILE, 'utf8');
    const data = yaml.load(content);
    res.json({ data, raw: content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT vars.yml
router.put('/vars', (req, res) => {
  try {
    const { data } = req.body;
    const content = yaml.dump(data, { lineWidth: -1 });
    fs.writeFileSync(VARS_FILE, content, 'utf8');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET vault status
router.get('/vault/status', (req, res) => {
  const exists = fs.existsSync(VAULT_FILE);
  if (!exists) {
    res.json({ exists: false, encrypted: false });
    return;
  }
  const content = fs.readFileSync(VAULT_FILE, 'utf8');
  const encrypted = content.startsWith('$ANSIBLE_VAULT');
  res.json({ exists, encrypted });
});

// GET vault decrypted (needs password)
router.post('/vault/decrypt', (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });
  if (!fs.existsSync(VAULT_FILE)) return res.status(404).json({ error: 'Vault file not found' });

  try {
    const passFile = `/tmp/vp-${Date.now()}`;
    fs.writeFileSync(passFile, password, { mode: 0o600 });
    const decrypted = execSync(`ansible-vault decrypt --vault-password-file ${passFile} --output - ${VAULT_FILE}`, {
      cwd: ANSIBLE_DIR
    }).toString();
    fs.unlinkSync(passFile);
    const data = yaml.load(decrypted);
    res.json({ data });
  } catch (err) {
    res.status(401).json({ error: 'Wrong password or decryption failed' });
  }
});

// POST vault save (encrypt)
router.post('/vault/save', (req, res) => {
  const { data, password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });

  try {
    const passFile = `/tmp/vp-${Date.now()}`;
    const plainFile = `/tmp/vault-plain-${Date.now()}.yml`;
    fs.writeFileSync(passFile, password, { mode: 0o600 });
    fs.writeFileSync(plainFile, yaml.dump(data, { lineWidth: -1 }), { mode: 0o600 });

    execSync(`ansible-vault encrypt --vault-password-file ${passFile} --output ${VAULT_FILE} ${plainFile}`, {
      cwd: ANSIBLE_DIR
    });

    fs.unlinkSync(passFile);
    fs.unlinkSync(plainFile);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET vault example
router.get('/vault/example', (req, res) => {
  try {
    const content = fs.readFileSync(VAULT_EXAMPLE, 'utf8');
    const data = yaml.load(content);
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
