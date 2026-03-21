const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const ANSIBLE_DIR = path.resolve(__dirname, '../../../../ansible');
const INVENTORY_FILE = path.join(ANSIBLE_DIR, 'inventory.ini');

function parseInventory(content) {
  const hosts = [];
  const lines = content.split('\n');
  let currentGroup = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const groupMatch = line.match(/^\[([^\]]+)\]$/);
    if (groupMatch) {
      currentGroup = groupMatch[1];
      continue;
    }

    if (currentGroup) {
      const parts = line.split(/\s+/);
      const host = { group: currentGroup, host: parts[0], vars: {} };
      for (let i = 1; i < parts.length; i++) {
        const [k, v] = parts[i].split('=');
        if (k && v !== undefined) host.vars[k] = v;
      }
      hosts.push(host);
    }
  }
  return hosts;
}

function serializeInventory(hosts) {
  const groups = {};
  for (const h of hosts) {
    if (!groups[h.group]) groups[h.group] = [];
    groups[h.group].push(h);
  }

  let out = '';
  for (const [group, ghosts] of Object.entries(groups)) {
    out += `[${group}]\n`;
    for (const h of ghosts) {
      const vars = Object.entries(h.vars || {}).map(([k, v]) => `${k}=${v}`).join(' ');
      out += `${h.host}${vars ? ' ' + vars : ''}\n`;
    }
    out += '\n';
  }
  return out.trimEnd() + '\n';
}

router.get('/', (req, res) => {
  try {
    const content = fs.readFileSync(INVENTORY_FILE, 'utf8');
    const hosts = parseInventory(content);
    res.json({ hosts, raw: content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/', (req, res) => {
  try {
    const { hosts } = req.body;
    const content = serializeInventory(hosts);
    fs.writeFileSync(INVENTORY_FILE, content, 'utf8');
    res.json({ ok: true, content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
