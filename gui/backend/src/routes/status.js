const express = require('express');
const router = express.Router();
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ANSIBLE_DIR = path.resolve(__dirname, '../../../../ansible');

router.get('/ansible', (req, res) => {
  try {
    const version = execSync('ansible --version', { env: { ...process.env, PATH: `${process.env.PATH}:/usr/local/bin:/opt/homebrew/bin` } }).toString().split('\n')[0];
    res.json({ ok: true, version });
  } catch {
    res.json({ ok: false, version: null });
  }
});

router.get('/project', (req, res) => {
  const exists = fs.existsSync(ANSIBLE_DIR);
  const hasInventory = fs.existsSync(path.join(ANSIBLE_DIR, 'inventory.ini'));
  const hasPlaybook = fs.existsSync(path.join(ANSIBLE_DIR, 'playbook.yml'));
  const hasVault = fs.existsSync(path.join(ANSIBLE_DIR, 'group_vars/vps/vault.yml'));
  res.json({ exists, hasInventory, hasPlaybook, hasVault, path: ANSIBLE_DIR });
});

module.exports = router;
