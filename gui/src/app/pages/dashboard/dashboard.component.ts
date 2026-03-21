import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TabsModule } from 'primeng/tabs';
import { MessageService } from 'primeng/api';
import { ApiService, Host, SshKey } from '../../services/api.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, TagModule, ToastModule, DialogModule, InputTextModule, TabsModule],
  providers: [MessageService],
  styles: [`
    .empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; height:calc(100vh - 200px); text-align:center; gap:24px; }
    .empty-icon { width:80px; height:80px; border-radius:20px; background:rgba(99,102,241,0.08); border:2px dashed rgba(99,102,241,0.2); display:flex; align-items:center; justify-content:center; }
    .host-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); gap:16px; }
    .host-card { background:#13161e; border:1px solid #2a3145; border-radius:14px; padding:1.5rem; transition:border-color 0.15s; }
    .host-card:hover { border-color:#374151; }
    .host-card-head { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:16px; }
    .host-avatar { width:48px; height:48px; border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .host-meta { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:16px; }
    .meta-item { background:#0d0f14; border-radius:8px; padding:10px 12px; }
    .meta-label { font-size:0.7rem; color:#475569; margin-bottom:3px; text-transform:uppercase; letter-spacing:0.04em; }
    .meta-val { font-size:0.875rem; color:#e2e8f0; font-family:monospace; }
    .progress-steps { display:flex; gap:4px; margin-top:12px; }
    .step { height:3px; border-radius:2px; flex:1; }
    .step.done { background:#6366f1; }
    .step.active { background:rgba(99,102,241,0.4); }
    .step.todo { background:#1a1e2a; }
    .page-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:24px; }
    .card-actions { display:flex; gap:8px; margin-top:16px; flex-wrap:wrap; }

    /* Dialog styles */
    .dlg-section { margin-bottom:24px; }
    .dlg-label { font-size:0.78rem; color:#94a3b8; font-weight:500; margin-bottom:6px; display:block; }
    .dlg-hint { font-size:0.72rem; color:#475569; margin-top:4px; }
    .ssh-cmd-box { background:#0a0c10; border:1px solid #1a1e2a; border-radius:8px; padding:12px 16px; font-family:monospace; font-size:0.9rem; color:#4ade80; display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:8px; }
    .alert { border-radius:10px; padding:12px 16px; margin-top:12px; font-size:0.875rem; }
    .alert-success { background:rgba(34,197,94,0.08); border:1px solid rgba(34,197,94,0.2); color:#4ade80; }
    .alert-error { background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.2); color:#f87171; }
    .key-textarea { width:100%; box-sizing:border-box; background:#0d0f14; border:1px solid #2a3145; border-radius:8px; padding:10px 12px; color:#e2e8f0; font-family:monospace; font-size:0.75rem; resize:vertical; outline:none; }
    .key-textarea:focus { border-color:#6366f1; }
    .field-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .dlg-field { margin-bottom:14px; }
    .dlg-field input { width:100%; box-sizing:border-box; }
  `],
  template: `
    <p-toast />

    <div class="page-header">
      <div>
        <h1 style="font-size:1.5rem;font-weight:700;color:#e2e8f0;margin:0 0 4px">Mes serveurs VPS</h1>
        <p style="color:#64748b;font-size:0.875rem;margin:0">{{ hosts().length }} serveur(s) enregistré(s)</p>
      </div>
      @if (hosts().length > 0) {
        <p-button label="Ajouter un VPS" icon="pi pi-plus" (onClick)="goToSetup()"></p-button>
      }
    </div>

    @if (hosts().length === 0) {
      <div class="empty-state">
        <div class="empty-icon">
          <i class="pi pi-server" style="font-size:2rem;color:#6366f1"></i>
        </div>
        <div>
          <div style="font-size:1.25rem;font-weight:700;color:#e2e8f0;margin-bottom:8px">Aucun serveur configuré</div>
          <div style="font-size:0.9rem;color:#64748b;max-width:400px;line-height:1.6">
            Ajoute ton premier VPS et l'interface te guidera pas à pas — connexion SSH, configuration et déploiement Ansible.
          </div>
        </div>
        <p-button label="Configurer mon premier VPS" icon="pi pi-plus" size="large" (onClick)="goToSetup()"></p-button>
      </div>
    } @else {
      <div class="host-grid">
        @for (host of hosts(); track host.id) {
          <div class="host-card">
            <div class="host-card-head">
              <div style="display:flex;align-items:center;gap:12px">
                <div class="host-avatar" [style.background]="statusBg(host.status)">
                  <i class="pi pi-server" [style.color]="statusColor(host.status)" style="font-size:1.3rem"></i>
                </div>
                <div>
                  <div style="font-size:1rem;font-weight:700;color:#e2e8f0">{{ host.label }}</div>
                  <div style="font-size:0.8rem;color:#64748b;font-family:monospace">{{ host.ip }}</div>
                </div>
              </div>
              <p-tag [value]="statusLabel(host.status)" [severity]="statusSeverity(host.status)" size="small"></p-tag>
            </div>

            <div style="font-size:0.72rem;color:#475569;margin-bottom:6px">Progression du setup</div>
            <div class="progress-steps">
              @for (step of steps; track step.key) {
                <div class="step" [class]="stepClass(host.status, step.key)" [title]="step.label"></div>
              }
            </div>
            <div style="font-size:0.72rem;color:#64748b;margin-top:4px">{{ stepDesc(host.status) }}</div>

            <div class="host-meta">
              <div class="meta-item">
                <div class="meta-label">IP</div>
                <div class="meta-val">{{ host.ip }}</div>
              </div>
              <div class="meta-item">
                <div class="meta-label">Port SSH</div>
                <div class="meta-val">{{ host.sshPort || host.rootPort }}</div>
              </div>
              @if (host.deployUser) {
                <div class="meta-item">
                  <div class="meta-label">Utilisateur</div>
                  <div class="meta-val">{{ host.deployUser }}</div>
                </div>
              }
              @if (host.status === 'configured' && host.lastDeployAt) {
                <div class="meta-item">
                  <div class="meta-label">Dernier déploiement</div>
                  <div class="meta-val" style="font-size:0.75rem">{{ host.lastDeployAt | date:'dd/MM HH:mm' }}</div>
                </div>
              }
            </div>

            <div class="card-actions">
              @if (host.status !== 'configured') {
                <p-button label="Continuer le setup" icon="pi pi-arrow-right" size="small"
                  styleClass="w-full" (onClick)="continueSetup(host)">
                </p-button>
              } @else {
                <p-button label="Redéployer" icon="pi pi-play-circle" size="small" [outlined]="true"
                  (onClick)="continueSetup(host)">
                </p-button>
                <p-button label="Accès SSH" icon="pi pi-key" size="small" severity="secondary"
                  (onClick)="openManage(host)">
                </p-button>
                <p-button icon="pi pi-trash" severity="danger" [outlined]="true" size="small"
                  (onClick)="deleteHost(host)">
                </p-button>
              }
            </div>
          </div>
        }
      </div>
    }

    <!-- ─── Dialog Gérer l'accès SSH ─────────────────────────────────────── -->
    <p-dialog
      [(visible)]="showManageDialog"
      [modal]="true"
      [style]="{ width: '600px' }"
      [header]="manageDialogHeader"
      [draggable]="false"
      [resizable]="false">

      <p-tabs [value]="activeTab">
        <p-tablist>
          <p-tab value="config">
            <i class="pi pi-terminal" style="margin-right:6px"></i> SSH Config
          </p-tab>
          <p-tab value="access">
            <i class="pi pi-plus-circle" style="margin-right:6px"></i> Ajouter un accès
          </p-tab>
        </p-tablist>

        <p-tabpanels>
          <!-- Tab 1 : SSH Config alias -->
          <p-tabpanel value="config">
            <div style="padding:16px 0">
              <p style="font-size:0.85rem;color:#64748b;margin:0 0 20px">
                Génère une entrée dans <code style="color:#818cf8">~/.ssh/config</code> pour te connecter avec <code style="color:#4ade80">ssh {{ sshAlias() }}</code>.
              </p>

              <div class="field-row">
                <div class="dlg-field">
                  <span class="dlg-label">Alias</span>
                  <input pInputText [(ngModel)]="sshForm.alias" placeholder="mon_vps" style="font-family:monospace" />
                  <div class="dlg-hint">Le nom de la commande ssh</div>
                </div>
                <div class="dlg-field">
                  <span class="dlg-label">Utilisateur</span>
                  <input pInputText [(ngModel)]="sshForm.user" placeholder="deploy" />
                </div>
              </div>

              <div class="field-row">
                <div class="dlg-field">
                  <span class="dlg-label">Hostname</span>
                  <input pInputText [(ngModel)]="sshForm.hostname" style="font-family:monospace" />
                </div>
                <div class="dlg-field">
                  <span class="dlg-label">Port</span>
                  <input pInputText [(ngModel)]="sshForm.port" type="number" />
                </div>
              </div>

              <div class="dlg-field">
                <span class="dlg-label">Clé privée</span>
                <input pInputText [(ngModel)]="sshForm.identityFile" style="font-family:monospace;width:100%" />
              </div>

              <!-- Aperçu de la commande -->
              <div class="dlg-label" style="margin-top:8px">Commande résultante</div>
              <div class="ssh-cmd-box">
                <span>ssh {{ sshAlias() }}</span>
                <button style="background:none;border:none;cursor:pointer;color:#475569;padding:0" title="Copier" (click)="copyCmd()">
                  <i class="pi pi-copy"></i>
                </button>
              </div>

              <div style="margin-top:4px;font-size:0.7rem;color:#475569">
                Entrée générée dans ~/.ssh/config :
              </div>
              <pre style="background:#0a0c10;border-radius:8px;padding:12px;font-size:0.72rem;color:#94a3b8;margin:6px 0 0;overflow-x:auto">{{ sshConfigPreview() }}</pre>

              @if (sshConfigMsg()) {
                <div class="alert" [class.alert-success]="!sshConfigError()" [class.alert-error]="sshConfigError()">
                  <i class="pi" [class.pi-check-circle]="!sshConfigError()" [class.pi-times-circle]="sshConfigError()" style="margin-right:8px"></i>
                  {{ sshConfigMsg() }}
                </div>
              }

              <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:20px">
                <p-button label="Appliquer dans ~/.ssh/config" icon="pi pi-save" [loading]="sshConfigLoading()" (onClick)="saveSshConfig()"></p-button>
              </div>
            </div>
          </p-tabpanel>

          <!-- Tab 2 : Ajouter une nouvelle clé -->
          <p-tabpanel value="access">
            <div style="padding:16px 0">
              <p style="font-size:0.85rem;color:#64748b;margin:0 0 20px">
                Ajoute la clé publique d'une autre machine dans <code style="color:#818cf8">~/.ssh/authorized_keys</code> du serveur.
                La connexion se fait via ta clé privée existante.
              </p>

              <div class="dlg-field">
                <span class="dlg-label">Clé publique à ajouter</span>
                <textarea class="key-textarea" [(ngModel)]="newKeyForm.publicKey" rows="4"
                  placeholder="ssh-ed25519 AAAA... utilisateur@machine"></textarea>
                <div class="dlg-hint">Colle la clé publique de la machine qui doit avoir accès (contenu du fichier .pub).</div>
              </div>

              <div style="background:#13161e;border:1px solid #1a1e2a;border-radius:8px;padding:12px;font-size:0.78rem;color:#475569;margin-top:4px">
                <div style="color:#94a3b8;font-weight:600;margin-bottom:6px">Connexion via :</div>
                <div style="font-family:monospace;color:#818cf8">{{ selectedHost()?.deployUser || 'root' }}@{{ selectedHost()?.ip }}:{{ selectedHost()?.sshPort || selectedHost()?.rootPort }}</div>
                <div style="margin-top:4px">Clé privée : <code style="color:#4ade80">{{ selectedHost()?.privateKeyPath || '~/.ssh/id_ed25519' }}</code></div>
              </div>

              @if (addKeyMsg()) {
                <div class="alert" [class.alert-success]="!addKeyError()" [class.alert-error]="addKeyError()">
                  <i class="pi" [class.pi-check-circle]="!addKeyError()" [class.pi-times-circle]="addKeyError()" style="margin-right:8px"></i>
                  {{ addKeyMsg() }}
                </div>
              }

              <div style="display:flex;justify-content:flex-end;margin-top:20px">
                <p-button label="Ajouter la clé sur le serveur" icon="pi pi-upload" [loading]="addKeyLoading()" (onClick)="addKeyToServer()"></p-button>
              </div>
            </div>
          </p-tabpanel>
        </p-tabpanels>
      </p-tabs>

    </p-dialog>
  `
})
export class DashboardComponent implements OnInit {
  hosts = signal<Host[]>([]);
  selectedHost = signal<Host | null>(null);
  showManageDialog = false;
  activeTab = 'config';
  manageDialogHeader = '';

  // SSH Config form
  sshForm = { alias: '', hostname: '', user: '', port: 22, identityFile: '' };
  sshConfigLoading = signal(false);
  sshConfigMsg = signal('');
  sshConfigError = signal(false);

  // Add key form
  newKeyForm = { publicKey: '' };
  addKeyLoading = signal(false);
  addKeyMsg = signal('');
  addKeyError = signal(false);

  steps = [
    { key: 'ssh-ok',           label: 'Connexion SSH' },
    { key: 'password-changed', label: 'Mot de passe changé' },
    { key: 'key-copied',       label: 'Clé SSH copiée' },
    { key: 'configured',       label: 'Ansible déployé' },
  ];

  private statusOrder = ['new', 'ssh-ok', 'password-changed', 'key-copied', 'configured'];

  constructor(private api: ApiService, private router: Router, private msg: MessageService) {}

  ngOnInit() { this.api.getHosts().subscribe({ next: h => this.hosts.set(h) }); }

  goToSetup() { this.router.navigate(['/setup']); }

  continueSetup(host: Host) {
    this.router.navigate(['/setup'], { queryParams: { hostId: host.id } });
  }

  openManage(host: Host) {
    this.selectedHost.set(host);
    this.manageDialogHeader = `Accès SSH — ${host.label}`;
    this.activeTab = 'config';
    this.sshConfigMsg.set('');
    this.addKeyMsg.set('');
    this.newKeyForm.publicKey = '';
    // Pre-fill SSH config form from host data
    this.sshForm = {
      alias: host.label.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      hostname: host.ip,
      user: host.deployUser || 'deploy',
      port: host.sshPort || 1024,
      identityFile: host.privateKeyPath || '~/.ssh/id_ed25519'
    };
    this.showManageDialog = true;
  }

  sshAlias() { return this.sshForm.alias || 'mon_vps'; }

  sshConfigPreview() {
    return [
      `Host ${this.sshAlias()}`,
      `    HostName ${this.sshForm.hostname}`,
      `    User ${this.sshForm.user || 'deploy'}`,
      `    Port ${this.sshForm.port || 22}`,
      `    IdentityFile ${this.sshForm.identityFile || '~/.ssh/id_ed25519'}`,
    ].join('\n');
  }

  copyCmd() {
    navigator.clipboard.writeText(`ssh ${this.sshAlias()}`).then(() => {
      this.msg.add({ severity: 'success', summary: 'Copié', detail: `ssh ${this.sshAlias()}`, life: 2000 });
    });
  }

  saveSshConfig() {
    if (!this.sshForm.alias) return;
    this.sshConfigLoading.set(true);
    this.sshConfigMsg.set('');
    this.api.addSshConfig({
      alias: this.sshForm.alias,
      hostname: this.sshForm.hostname,
      user: this.sshForm.user,
      port: Number(this.sshForm.port),
      identityFile: this.sshForm.identityFile
    }).subscribe({
      next: () => {
        this.sshConfigLoading.set(false);
        this.sshConfigError.set(false);
        this.sshConfigMsg.set(`Entrée "${this.sshForm.alias}" ajoutée dans ~/.ssh/config. Tu peux maintenant faire : ssh ${this.sshAlias()}`);
      },
      error: err => {
        this.sshConfigLoading.set(false);
        this.sshConfigError.set(true);
        this.sshConfigMsg.set(err.error?.error || 'Erreur lors de l\'écriture');
      }
    });
  }

  addKeyToServer() {
    const h = this.selectedHost();
    if (!h || !this.newKeyForm.publicKey.trim()) {
      this.msg.add({ severity: 'warn', summary: 'Clé manquante', detail: 'Colle une clé publique' });
      return;
    }
    this.addKeyLoading.set(true);
    this.addKeyMsg.set('');
    this.api.addAuthorizedKey({
      host: h.ip,
      port: h.sshPort || h.rootPort,
      username: h.deployUser || 'root',
      privateKeyPath: h.privateKeyPath || '~/.ssh/id_ed25519',
      newPublicKey: this.newKeyForm.publicKey.trim()
    }).subscribe({
      next: () => {
        this.addKeyLoading.set(false);
        this.addKeyError.set(false);
        this.addKeyMsg.set('Clé ajoutée avec succès dans les authorized_keys du serveur.');
        this.newKeyForm.publicKey = '';
      },
      error: err => {
        this.addKeyLoading.set(false);
        this.addKeyError.set(true);
        this.addKeyMsg.set(err.error?.error || 'Connexion impossible au serveur');
      }
    });
  }

  deleteHost(host: Host) {
    this.api.deleteHost(host.id).subscribe({
      next: () => {
        this.msg.add({ severity: 'success', summary: 'Supprimé', detail: host.label });
        this.hosts.update(h => h.filter(x => x.id !== host.id));
      }
    });
  }

  stepClass(hostStatus: string, stepKey: string): string {
    const hostIdx = this.statusOrder.indexOf(hostStatus);
    const stepIdx = this.statusOrder.indexOf(stepKey);
    if (hostIdx >= stepIdx) return 'done';
    if (hostIdx === stepIdx - 1) return 'active';
    return 'todo';
  }

  stepDesc(status: string) {
    const map: Record<string, string> = {
      'new': 'Prêt à démarrer',
      'ssh-ok': 'SSH OK — changer le mot de passe',
      'password-changed': 'Mot de passe changé — copier la clé SSH',
      'key-copied': 'Clé SSH copiée — lancer Ansible',
      'configured': 'Configuré et déployé',
    };
    return map[status] || status;
  }

  statusColor(s: string) {
    if (s === 'configured') return '#22c55e';
    if (s === 'new') return '#64748b';
    return '#f59e0b';
  }
  statusBg(s: string) {
    if (s === 'configured') return 'rgba(34,197,94,0.1)';
    if (s === 'new') return 'rgba(148,163,184,0.08)';
    return 'rgba(245,158,11,0.1)';
  }
  statusLabel(s: string) {
    const map: Record<string, string> = { new:'Nouveau', 'ssh-ok':'SSH OK', 'password-changed':'Mdp changé', 'key-copied':'Clé copiée', configured:'Configuré' };
    return map[s] || s;
  }
  statusSeverity(s: string): any {
    if (s === 'configured') return 'success';
    if (s === 'new') return 'secondary';
    return 'warn';
  }
}
