import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { Tabs, Tab, TabList, TabPanel, TabPanels } from 'primeng/tabs';
import { MessageService } from 'primeng/api';
import { ApiService, VarsConfig, VaultConfig } from '../../services/api.service';

@Component({
  selector: 'app-config',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, InputTextModule, TagModule, ToastModule, Tabs, Tab, TabList, TabPanel, TabPanels],
  providers: [MessageService],
  template: `
    <p-toast />

    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 style="font-size:1.5rem;font-weight:700;color:#e2e8f0;margin:0 0 4px;">Configuration</h1>
        <p style="color:#64748b;font-size:0.875rem;margin:0">Modifier vars.yml et le vault Ansible chiffré</p>
      </div>
    </div>

    <p-tabs value="0">
      <p-tablist>
        <p-tab value="0">vars.yml</p-tab>
        <p-tab value="1">🔐 Vault (chiffré)</p-tab>
      </p-tablist>

      <p-tabpanels>
        <!-- Panel vars.yml -->
        <p-tabpanel value="0">
          @if (vars()) {
            <div class="grid grid-cols-2 gap-6 mt-4">

              <!-- SSH -->
              <div style="background:#13161e;border:1px solid #2a3145;border-radius:12px;padding:1.5rem;">
                <div class="flex items-center gap-2 mb-4">
                  <i class="pi pi-lock" style="color:#818cf8"></i>
                  <h3 class="section-title" style="margin:0">SSH</h3>
                </div>
                <div class="flex flex-col gap-3">
                  <div>
                    <label>Utilisateur de déploiement</label>
                    <input pInputText [(ngModel)]="vars()!.deploy_user" class="w-full mt-1" placeholder="deploy" />
                  </div>
                  <div>
                    <label>Port SSH</label>
                    <input pInputText [(ngModel)]="vars()!.ssh_port" class="w-full mt-1" placeholder="1024" type="number" />
                  </div>
                </div>
              </div>

              <!-- Firewall -->
              <div style="background:#13161e;border:1px solid #2a3145;border-radius:12px;padding:1.5rem;">
                <div class="flex items-center gap-2 mb-4">
                  <i class="pi pi-shield" style="color:#22d3ee"></i>
                  <h3 class="section-title" style="margin:0">Pare-feu UFW</h3>
                </div>
                <label>Ports autorisés</label>
                <div class="flex flex-wrap gap-2 mt-2 mb-3">
                  @for (port of vars()!.allowed_ports || []; track port) {
                    <div style="display:inline-flex;align-items:center;gap:6px;background:#1a1e2a;border:1px solid #2a3145;border-radius:20px;padding:4px 12px;">
                      <span style="font-family:monospace;font-size:0.85rem;color:#e2e8f0">{{ port }}</span>
                      <button (click)="removePort(port)" style="background:none;border:none;color:#64748b;cursor:pointer;padding:0;line-height:1">
                        <i class="pi pi-times" style="font-size:0.7rem"></i>
                      </button>
                    </div>
                  }
                </div>
                <div class="flex gap-2">
                  <input pInputText [(ngModel)]="newPort" placeholder="ex: 8080" class="flex-1" (keydown.enter)="addPort()" />
                  <p-button icon="pi pi-plus" [outlined]="true" (onClick)="addPort()"></p-button>
                </div>
              </div>

              <!-- SMTP -->
              <div style="background:#13161e;border:1px solid #2a3145;border-radius:12px;padding:1.5rem;" class="col-span-2">
                <div class="flex items-center gap-2 mb-4">
                  <i class="pi pi-envelope" style="color:#f59e0b"></i>
                  <h3 class="section-title" style="margin:0">SMTP</h3>
                  <p-tag value="Credentials dans le vault" severity="secondary" size="small"></p-tag>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label>Serveur SMTP</label>
                    <input pInputText [(ngModel)]="vars()!.smtp_host" class="w-full mt-1" placeholder="smtp.gmail.com" />
                  </div>
                  <div>
                    <label>Port SMTP</label>
                    <input pInputText [(ngModel)]="vars()!.smtp_port" class="w-full mt-1" type="number" />
                  </div>
                </div>
                <div class="mt-2" style="font-size:0.78rem;color:#475569">
                  <i class="pi pi-info-circle mr-1"></i>
                  Les credentials SMTP (user/password) sont dans le vault — onglet Vault ci-dessus
                </div>
              </div>

            </div>

            <div class="flex justify-end mt-4">
              <p-button label="Sauvegarder vars.yml" icon="pi pi-save" (onClick)="saveVars()" [loading]="saving()"></p-button>
            </div>
          } @else {
            <div style="text-align:center;padding:3rem;color:#475569">
              <i class="pi pi-spin pi-spinner" style="font-size:2rem;display:block;margin-bottom:1rem"></i>
              Chargement...
            </div>
          }
        </p-tabpanel>

        <!-- Panel Vault -->
        <p-tabpanel value="1">
          <div class="mt-4">
            <div style="background:#13161e;border:1px solid #2a3145;border-radius:12px;padding:1.5rem;margin-bottom:1.5rem;">
              <div class="flex items-center gap-3 mb-4">
                <div style="width:40px;height:40px;background:rgba(245,158,11,0.12);border-radius:10px;display:flex;align-items:center;justify-content:center">
                  <i class="pi pi-key" style="color:#f59e0b;font-size:1.1rem"></i>
                </div>
                <div>
                  <div style="font-weight:600;color:#e2e8f0">Vault Ansible</div>
                  <div style="font-size:0.8rem;color:#64748b">
                    Statut :
                    @if (vaultStatus() === 'encrypted') {
                      <span style="color:#f59e0b">● Chiffré (ansible-vault)</span>
                    } @else if (vaultStatus() === 'not-found') {
                      <span style="color:#ef4444">● Non trouvé — sera créé</span>
                    } @else {
                      <span style="color:#22c55e">● Non chiffré</span>
                    }
                  </div>
                </div>
              </div>

              @if (!vaultUnlocked()) {
                <div class="flex gap-3">
                  <input pInputText type="password" [(ngModel)]="vaultPassword"
                    placeholder="Mot de passe du vault..."
                    class="flex-1" style="font-family:monospace"
                    (keydown.enter)="unlockVault()" />
                  <p-button label="Déchiffrer" icon="pi pi-unlock" (onClick)="unlockVault()" [loading]="unlocking()"></p-button>
                </div>
              } @else {
                <div class="flex items-center gap-2" style="color:#22c55e;font-size:0.875rem">
                  <i class="pi pi-check-circle"></i>
                  Vault déchiffré
                  <p-button label="Verrouiller" icon="pi pi-lock" severity="secondary" [outlined]="true" size="small" class="ml-auto" (onClick)="lockVault()"></p-button>
                </div>
              }
            </div>

            @if (vaultUnlocked() && vault()) {
              <div class="grid grid-cols-2 gap-4">
                <div style="background:#13161e;border:1px solid #2a3145;border-radius:12px;padding:1.5rem;">
                  <h3 style="font-size:0.9rem;font-weight:600;color:#e2e8f0;margin:0 0 1rem">Credentials SMTP</h3>
                  <div class="flex flex-col gap-3">
                    <div>
                      <label>Email SMTP (expéditeur)</label>
                      <input pInputText [(ngModel)]="vault()!.vault_smtp_user" class="w-full mt-1" placeholder="ton@gmail.com" />
                    </div>
                    <div>
                      <label>Mot de passe app Gmail</label>
                      <input pInputText type="password" [(ngModel)]="vault()!.vault_smtp_password" class="w-full mt-1" />
                    </div>
                    <div>
                      <label>Email destinataire alertes</label>
                      <input pInputText [(ngModel)]="vault()!.vault_alert_email" class="w-full mt-1" placeholder="alertes@ton-domaine.com" />
                    </div>
                  </div>
                </div>

                <div style="background:#13161e;border:1px solid #2a3145;border-radius:12px;padding:1.5rem;">
                  <h3 style="font-size:0.9rem;font-weight:600;color:#e2e8f0;margin:0 0 1rem">Clé SSH publique deploy</h3>
                  <label>Clé publique (ssh-ed25519 ...)</label>
                  <textarea [(ngModel)]="vault()!.vault_deploy_user_pubkey"
                    class="w-full mt-1" rows="6"
                    style="font-family:monospace;font-size:0.78rem;background:#0d0f14;border:1px solid #2a3145;border-radius:8px;padding:0.75rem;resize:vertical;color:#e2e8f0;width:100%;"
                    placeholder="ssh-ed25519 AAAA... user@machine"></textarea>
                  <div class="mt-2" style="font-size:0.75rem;color:#475569">
                    <i class="pi pi-info-circle mr-1"></i>
                    Cette clé sera copiée sur le VPS pour l'utilisateur "deploy"
                  </div>
                </div>
              </div>

              <div class="flex justify-end mt-4 gap-3">
                <span style="font-size:0.8rem;color:#475569;align-self:center">Sera re-chiffré avec ansible-vault</span>
                <p-button label="Sauvegarder le vault" icon="pi pi-save" (onClick)="saveVault()" [loading]="savingVault()"></p-button>
              </div>
            }
          </div>
        </p-tabpanel>
      </p-tabpanels>
    </p-tabs>
  `
})
export class ConfigComponent implements OnInit {
  vars = signal<VarsConfig | null>(null);
  vault = signal<VaultConfig | null>(null);
  vaultStatus = signal<'encrypted' | 'plain' | 'not-found'>('not-found');
  vaultUnlocked = signal(false);
  vaultPassword = '';
  newPort = '';
  saving = signal(false);
  savingVault = signal(false);
  unlocking = signal(false);

  constructor(private api: ApiService, private msg: MessageService) {}

  ngOnInit() {
    this.api.getVars().subscribe({ next: ({ data }) => this.vars.set(data) });
    this.api.getVaultStatus().subscribe({ next: s => {
      if (!s.exists) this.vaultStatus.set('not-found');
      else if (s.encrypted) this.vaultStatus.set('encrypted');
      else this.vaultStatus.set('plain');
    }});
  }

  addPort() {
    const p = this.newPort.trim();
    if (!p) return;
    const v = this.vars();
    if (v) {
      if (!v.allowed_ports) v.allowed_ports = [];
      if (!v.allowed_ports.includes(p)) {
        this.vars.set({ ...v, allowed_ports: [...v.allowed_ports, p] });
      }
    }
    this.newPort = '';
  }

  removePort(port: string) {
    const v = this.vars();
    if (v) this.vars.set({ ...v, allowed_ports: v.allowed_ports.filter((p: string) => p !== port) });
  }

  saveVars() {
    const v = this.vars();
    if (!v) return;
    this.saving.set(true);
    this.api.saveVars(v).subscribe({
      next: () => { this.saving.set(false); this.msg.add({ severity: 'success', summary: 'Sauvegardé', detail: 'vars.yml mis à jour' }); },
      error: () => { this.saving.set(false); this.msg.add({ severity: 'error', summary: 'Erreur', detail: 'Sauvegarde échouée' }); }
    });
  }

  unlockVault() {
    if (!this.vaultPassword) return;
    this.unlocking.set(true);
    this.api.decryptVault(this.vaultPassword).subscribe({
      next: ({ data }) => {
        this.vault.set(data);
        this.vaultUnlocked.set(true);
        this.unlocking.set(false);
        this.msg.add({ severity: 'success', summary: 'Vault déchiffré', detail: 'Tu peux modifier les secrets' });
      },
      error: () => {
        this.unlocking.set(false);
        this.msg.add({ severity: 'error', summary: 'Mauvais mot de passe', detail: 'Déchiffrement impossible' });
      }
    });
  }

  lockVault() {
    this.vaultUnlocked.set(false);
    this.vault.set(null);
    this.vaultPassword = '';
  }

  saveVault() {
    const v = this.vault();
    if (!v || !this.vaultPassword) return;
    this.savingVault.set(true);
    this.api.saveVault(v, this.vaultPassword).subscribe({
      next: () => {
        this.savingVault.set(false);
        this.vaultStatus.set('encrypted');
        this.msg.add({ severity: 'success', summary: 'Vault sauvegardé', detail: 'Chiffré avec ansible-vault' });
      },
      error: () => {
        this.savingVault.set(false);
        this.msg.add({ severity: 'error', summary: 'Erreur', detail: 'Chiffrement échoué' });
      }
    });
  }
}
