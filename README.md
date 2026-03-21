# ansible-vps

Configuration et déploiement sécurisé d'un VPS Ubuntu via Ansible, avec interface graphique intégrée.

## Structure

```
ansible-vps/
├── ansible/          # Playbooks et rôles Ansible
│   ├── inventory.ini
│   ├── playbook.yml
│   ├── group_vars/vps/
│   │   ├── vars.yml        # Variables (non sensibles)
│   │   └── vault.yml       # Secrets chiffrés (ansible-vault)
│   ├── roles/secure-server/
│   └── Makefile
├── gui/              # Interface graphique (Angular 19 + Node.js)
│   ├── src/          # Frontend Angular
│   ├── backend/      # API Express + Socket.io
│   └── package.json
├── start.sh          # Lance les deux serveurs
└── README.md
```

## Interface graphique

```bash
./start.sh
# Ouvre http://localhost:4200
```

L'interface permet de :
- Gérer l'inventaire des hôtes VPS
- Modifier `vars.yml` et le vault chiffré
- Lancer le playbook avec logs en temps réel
- Consulter l'historique des déploiements

## CLI (sans GUI)

```bash
cd ansible/

# Tester la connectivité
make ping

# Déploiement complet
make deploy

# Dry-run
make check

# Initialiser le vault
make vault-init
```

## Ce que le playbook configure

| Composant | Description |
|-----------|-------------|
| SSH | Port 1024, auth par clé uniquement, no-root |
| UFW | Deny all + ports 1024/80/443 |
| Fail2ban | Anti-brute-force + alertes email |
| Unattended-upgrades | Patches sécurité automatiques |
| Docker CE | Docker + docker-compose |
| User deploy | Sudo sans mot de passe + clé SSH |

## Prérequis

- Ansible (`brew install ansible`)
- Node.js 20+
- Un VPS Ubuntu 22.04 accessible en SSH
