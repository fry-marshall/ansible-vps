const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.resolve(__dirname, '../../data/hosts.json');
const ANSIBLE_DIR = path.resolve(__dirname, '../../../../ansible');
const INVENTORY_FILE = path.join(ANSIBLE_DIR, 'inventory.ini');

// S'assurer que le dossier data existe
fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });

function loadHosts() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return []; }
}

function saveHosts(hosts) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(hosts, null, 2));
  writeInventory(hosts);
}

function writeInventory(hosts) {
  const configured = hosts.filter(h => h.status === 'configured');
  if (configured.length === 0) {
    fs.writeFileSync(INVENTORY_FILE, '# Aucun hôte configuré\n');
    return;
  }
  const lines = ['[vps]'];
  for (const h of configured) {
    lines.push(`${h.ip} ansible_user=${h.deployUser || 'deploy'} ansible_port=${h.sshPort || 1024} ansible_ssh_private_key_file=${h.privateKeyPath || '~/.ssh/id_ed25519'}`);
  }
  fs.writeFileSync(INVENTORY_FILE, lines.join('\n') + '\n');
}

// GET tous les hôtes
router.get('/', (req, res) => res.json(loadHosts()));

// POST ajouter un hôte (en cours de setup)
router.post('/', (req, res) => {
  const { ip, label, rootPort = 22 } = req.body;
  if (!ip) return res.status(400).json({ error: 'IP requise' });

  const hosts = loadHosts();
  if (hosts.find(h => h.ip === ip)) {
    return res.status(409).json({ error: 'Hôte déjà existant' });
  }

  const host = {
    id: `host-${Date.now()}`,
    ip,
    label: label || ip,
    rootPort: Number(rootPort),
    status: 'new',       // new | ssh-ok | password-changed | key-copied | configured
    createdAt: new Date().toISOString()
  };
  hosts.push(host);
  saveHosts(hosts);
  res.json(host);
});

// PATCH mettre à jour le statut / les infos d'un hôte
router.patch('/:id', (req, res) => {
  const hosts = loadHosts();
  const idx = hosts.findIndex(h => h.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Hôte non trouvé' });

  hosts[idx] = { ...hosts[idx], ...req.body, id: hosts[idx].id };
  saveHosts(hosts);
  res.json(hosts[idx]);
});

// DELETE supprimer un hôte
router.delete('/:id', (req, res) => {
  let hosts = loadHosts();
  hosts = hosts.filter(h => h.id !== req.params.id);
  saveHosts(hosts);
  res.json({ ok: true });
});

module.exports = router;
