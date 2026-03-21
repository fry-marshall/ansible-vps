INVENTORY  := inventory.ini
PLAYBOOK   := playbook.yml
VAULT_FILE := group_vars/vps/vault.yml

.PHONY: deploy check ping vault-init vault-edit vault-encrypt ssh-config

deploy:
	ansible-playbook -i $(INVENTORY) $(PLAYBOOK) --ask-vault-pass

check:
	ansible-playbook -i $(INVENTORY) $(PLAYBOOK) --ask-vault-pass --check

ping:
	ansible -i $(INVENTORY) vps -m ping

vault-init:
	@if [ -f $(VAULT_FILE) ]; then echo "$(VAULT_FILE) already exists."; exit 1; fi
	cp group_vars/vps/vault.yml.example $(VAULT_FILE)
	ansible-vault encrypt $(VAULT_FILE)

vault-edit:
	ansible-vault edit $(VAULT_FILE)

vault-encrypt:
	ansible-vault encrypt $(VAULT_FILE)

ssh-config:
	@read -p "Host alias (e.g. myvps): " host; \
	read -p "VPS IP address: " ip; \
	entry="\nHost $$host\n    HostName $$ip\n    User deploy\n    Port 1024\n    IdentityFile ~/.ssh/id_ed25519"; \
	echo "$$entry" >> ~/.ssh/config; \
	echo "SSH config entry added. You can now connect with: ssh $$host"