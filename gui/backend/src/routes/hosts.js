const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const os = require('os');

const DATA_FILE = path.resolve(__dirname, '../../data/hosts.json');
const ANSIBLE_DIR = path.resolve(__dirname, '../../../../ansible');
const INVENTORY_FILE = path.join(ANSIBLE_DIR, 'inventory.ini');
const VARS_FILE = path.join(ANSIBLE_DIR, 'group_vars/vps/vars.yml');

// Write deploy_user_pubkey into vars.yml from the private key path
function writeDeployPubkey(privateKeyPath) {
  try {
    const pubKeyPath = privateKeyPath.replace('~', os.homedir()) + '.pub';
    if (!fs.existsSync(pubKeyPath)) return;
    const pubKey = fs.readFileSync(pubKeyPath, 'utf8').trim();
    let content = fs.readFileSync(VARS_FILE, 'utf8');
    content = content.replace(/^deploy_user_pubkey:.*$/m, `deploy_user_pubkey: "${pubKey}"`);
    fs.writeFileSync(VARS_FILE, content, 'utf8');
    console.log('[hosts] deploy_user_pubkey mis à jour dans vars.yml');
  } catch (e) {
    console.error('[hosts] writeDeployPubkey error:', e.message);
  }
}

// S'assurer que le dossier data existe
fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });

// Synchroniser l'inventory au démarrage (en cas de redémarrage du serveur)
writeInventory(loadHosts());

function loadHosts() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return []; }
}

function saveHosts(hosts) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(hosts, null, 2));
  writeInventory(hosts);
}

function writeInventory(hosts) {
  // Include hosts that are ready for first deploy (key-copied) or already deployed (configured)
  const ready = hosts.filter(h => h.status === 'key-copied' || h.status === 'configured');
  if (ready.length === 0) {
    fs.writeFileSync(INVENTORY_FILE, '# Aucun hôte configuré\n');
    return;
  }
  const lines = ['[vps]'];
  for (const h of ready) {
    // First deploy: SSH is still on root@rootPort (Ansible hasn't run yet — status key-copied)
    // Re-deploy: SSH is on deployUser@sshPort (Ansible already configured it — status configured)
    const isFirstDeploy = h.status !== 'configured';
    const user = isFirstDeploy ? 'root' : (h.deployUser || 'deploy');
    const port = isFirstDeploy ? (h.rootPort || 22) : (h.sshPort || 1024);
    const key  = h.privateKeyPath || '~/.ssh/id_ed25519';
    lines.push(
      `${h.ip} ansible_user=${user} ansible_port=${port}` +
      ` ansible_ssh_private_key_file=${key}` +
      ` ansible_ssh_common_args='-o StrictHostKeyChecking=no'`
    );
  }
  fs.writeFileSync(INVENTORY_FILE, lines.join('\n') + '\n');
  console.log('[inventory] écrit avec', ready.length, 'hôte(s):', ready.map(h => `${h.ip}(${h.status})`).join(', '));
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
  // Auto-write pubkey to vars.yml when key is copied or host is configured
  if ((req.body.status === 'key-copied' || req.body.status === 'configured') && hosts[idx].privateKeyPath) {
    writeDeployPubkey(hosts[idx].privateKeyPath);
  }
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
