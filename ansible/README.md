# Secure VPS Setup with Ansible

Ansible playbook to securely configure a freshly provisioned VPS.

## What this playbook does

| Step | Description |
|------|-------------|
| `system` | Full system package update and upgrade |
| `updates` | Automatic nightly security patches via unattended-upgrades |
| `user` | Create a non-root user (`deploy`) with SSH key authentication |
| `ssh` | SSH hardening: disable root login, password auth, X11 forwarding, custom port |
| `firewall` | UFW configured: deny all incoming, allow SSH/HTTP/HTTPS |
| `fail2ban` | Brute-force protection with email alerts via msmtp |
| `notify` | Email alert on every SSH login (via PAM + msmtp) |
| `docker` | Docker CE + Docker Compose plugin (modern GPG key method) |

## Prerequisites

- Ansible installed locally
- A fresh Ubuntu 22.04 VPS accessible as root via SSH
- An ed25519 SSH key pair
- SMTP credentials (Gmail App Password recommended)

## Setup

### 1. Clone the repo

```bash
git clone <repo> && cd ansible-vps-config
```

### 2. Configure the inventory

Edit `inventory.ini` and replace `YOUR_VPS_IP` with your VPS IP:

```ini
[vps]
1.2.3.4 ansible_user=root ansible_port=22 ansible_ssh_private_key_file=~/.ssh/id_ed25519
```

### 3. Configure secrets with ansible-vault

```bash
make vault-init
```

This copies `group_vars/vps/vault.yml.example` to `group_vars/vps/vault.yml` and encrypts it.
Fill in your SMTP credentials and SSH public key when prompted.

To edit the vault later:

```bash
make vault-edit
```

### 4. Adjust variables (optional)

Edit `group_vars/vps/vars.yml` to change the SSH port, deploy username, or open firewall ports.

### 5. Deploy

```bash
make deploy
```

The vault password will be prompted at runtime.

> **First deploy:** The VPS is freshly provisioned so SSH still runs on port 22 as root. Keep `inventory.ini` as-is for the first run.
>
> **After the deploy:** Root login and password auth are disabled. Update `inventory.ini` to connect as the deploy user on the new port:
> ```ini
> YOUR_VPS_IP ansible_user=deploy ansible_port=1024 ansible_ssh_private_key_file=~/.ssh/id_ed25519
> ```
> Then connect manually with:
> ```bash
> ssh -p 1024 deploy@YOUR_VPS_IP
> ```

## Available commands

```bash
make ping          # Test SSH connectivity to the VPS
make deploy        # Run the full playbook
make check         # Dry-run (no changes applied to the server)
make vault-init    # Create and encrypt the vault file
make vault-edit    # Edit the vault
make vault-encrypt # Re-encrypt the vault after manual edits
```

## Security

- Secrets (SMTP credentials, SSH public key) are stored in `group_vars/vps/vault.yml`, encrypted with ansible-vault
- This file is in `.gitignore` and will never be committed
- Only `group_vars/vps/vault.yml.example` (empty template) is versioned

### What this setup protects against

| Threat | Mitigation |
|--------|------------|
| Bot brute-force on SSH | Non-standard port 1024 + fail2ban |
| Password-based attacks | Password auth fully disabled |
| Direct root access | Root login disabled, non-root `deploy` user only |
| Unnoticed intrusions | Email alert on every SSH login |
| Open ports | UFW: deny all incoming except SSH, HTTP, HTTPS |

### Known trade-offs

- **`NOPASSWD sudo`** — the `deploy` user has full sudo without a password. Convenient for automation, but if the SSH key is compromised, the attacker has root. Protect your private key.
- **Docker group = effective root** — any user in the `docker` group can mount the host filesystem via a container and escalate to root. This is inherent to Docker, not specific to this setup.
- **No automatic reboot** — `unattended-upgrades` is configured but will not auto-reboot after kernel updates. Reboot manually when needed (`sudo reboot`).

## Structure

```
.
├── inventory.ini
├── playbook.yml
├── group_vars/
│   └── vps/
│       ├── vars.yml            # Non-sensitive variables
│       └── vault.yml.example   # Template to copy and encrypt
└── roles/
    └── secure-server/
        ├── defaults/main.yml
        ├── handlers/main.yml
        └── tasks/
            ├── main.yml
            ├── system.yml
            ├── updates.yml
            ├── user.yml
            ├── ssh.yml
            ├── firewall.yml
            ├── fail2ban.yml
            ├── notify.yml
            └── docker.yml
```
