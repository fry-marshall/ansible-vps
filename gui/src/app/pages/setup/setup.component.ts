import { Component, OnInit, OnDestroy, signal, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { SelectButtonModule } from 'primeng/selectbutton';
import { MessageService } from 'primeng/api';
import { io, Socket } from 'socket.io-client';
import { ApiService, Host, SshKey } from '../../services/api.service';

const STATUS_ORDER = ['new', 'ssh-ok', 'password-changed', 'key-copied', 'configured'];

@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, InputTextModule, PasswordModule, ToastModule, TagModule, SelectButtonModule],
  providers: [MessageService],
  styles: [`
    .wizard-wrap { max-width:700px; margin:0 auto; }
    .steps-header { display:flex; align-items:center; margin-bottom:36px; }
    .step-dot-wrap { display:flex; flex-direction:column; align-items:center; gap:6px; }
    .step-dot { width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.8rem; font-weight:700; border:2px solid transparent; transition:all 0.2s; flex-shrink:0; }
    .step-dot.done { background:#6366f1; border-color:#6366f1; color:#fff; }
    .step-dot.active { background:transparent; border-color:#6366f1; color:#6366f1; }
    .step-dot.todo { background:transparent; border-color:#2a3145; color:#475569; }
    .step-label { font-size:0.65rem; color:#475569; white-space:nowrap; text-align:center; }
    .step-label.active { color:#818cf8; }
    .step-connector { flex:1; height:2px; background:#2a3145; margin:0 8px; margin-bottom:22px; transition:background 0.2s; }
    .step-connector.done { background:#6366f1; }
    .card { background:#13161e; border:1px solid #2a3145; border-radius:14px; padding:2rem; }
    .field { margin-bottom:1.25rem; }
    .field label { display:block; font-size:0.8rem; color:#94a3b8; margin-bottom:6px; font-weight:500; }
    .field input, .field textarea { width:100%; box-sizing:border-box; }
    .hint { font-size:0.75rem; color:#475569; margin-top:4px; }
    .alert { border-radius:10px; padding:12px 16px; margin-bottom:16px; font-size:0.875rem; }
    .alert-success { background:rgba(34,197,94,0.08); border:1px solid rgba(34,197,94,0.2); color:#4ade80; }
    .alert-error { background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.2); color:#f87171; }
    .alert-info { background:rgba(99,102,241,0.08); border:1px solid rgba(99,102,241,0.2); color:#818cf8; }
    .key-list { display:flex; flex-direction:column; gap:8px; margin-top:8px; }
    .key-item { background:#0d0f14; border:2px solid #2a3145; border-radius:10px; padding:12px 16px; cursor:pointer; transition:border-color 0.15s; }
    .key-item.selected { border-color:#6366f1; background:rgba(99,102,241,0.06); }
    .key-item:hover { border-color:#374151; }
    .key-name { font-size:0.85rem; font-weight:600; color:#e2e8f0; }
    .key-path { font-size:0.72rem; color:#475569; font-family:monospace; margin-top:2px; }
    .key-content { font-size:0.68rem; color:#64748b; font-family:monospace; margin-top:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .terminal { background:#0a0c10; border:1px solid #1a1e2a; border-radius:10px; padding:16px; font-family:monospace; font-size:0.75rem; line-height:1.6; height:360px; overflow-y:auto; }
    .terminal-line { margin:0; white-space:pre-wrap; word-break:break-all; }
    .terminal-line.stdout { color:#cbd5e1; }
    .terminal-line.stderr { color:#fbbf24; }
    .terminal-line.info { color:#818cf8; }
    .terminal-line.success { color:#4ade80; }
    .terminal-line.error { color:#f87171; }
    .actions { display:flex; justify-content:space-between; align-items:center; margin-top:24px; }
    .actions-right { display:flex; gap:8px; }
    .ssh-output { background:#0a0c10; border-radius:8px; padding:12px; font-family:monospace; font-size:0.75rem; color:#4ade80; margin-top:12px; }
    .section-title { font-size:1.1rem; font-weight:700; color:#e2e8f0; margin:0 0 6px; }
    .section-sub { font-size:0.85rem; color:#64748b; margin:0 0 24px; }
    .row2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
    .key-textarea { width:100%; box-sizing:border-box; background:#0d0f14; border:1px solid #2a3145; border-radius:8px; padding:10px 12px; color:#e2e8f0; font-family:monospace; font-size:0.75rem; resize:vertical; }
    .key-textarea:focus { border-color:#6366f1; outline:none; }
    .mode-btn { background:#0d0f14; border:1px solid #2a3145; border-radius:8px; padding:8px 16px; color:#64748b; font-size:0.82rem; cursor:pointer; transition:all 0.15s; }
    .mode-btn:hover { border-color:#374151; color:#94a3b8; }
    .mode-btn.active { background:rgba(99,102,241,0.1); border-color:#6366f1; color:#818cf8; }
  `],
  template: `
    <p-toast />
    <div class="wizard-wrap">

      <!-- Step header -->
      <div class="steps-header">
        @for (s of wizardSteps; track s.key; let i = $index) {
          <div class="step-dot-wrap">
            <div class="step-dot" [class.done]="currentStep() > i" [class.active]="currentStep() === i" [class.todo]="currentStep() < i">
              @if (currentStep() > i) { <i class="pi pi-check" style="font-size:0.8rem"></i> }
              @else { {{ i + 1 }} }
            </div>
            <div class="step-label" [class.active]="currentStep() === i">{{ s.label }}</div>
          </div>
          @if (i < wizardSteps.length - 1) {
            <div class="step-connector" [class.done]="currentStep() > i"></div>
          }
        }
      </div>

      <!-- STEP 0: Infos serveur -->
      @if (currentStep() === 0) {
        <div class="card">
          <p class="section-title">Infos du serveur</p>
          <p class="section-sub">Renseigne l'adresse IP et le port SSH actuel (root).</p>
          <div class="field">
            <label>Adresse IP *</label>
            <input pInputText [(ngModel)]="f0.ip" placeholder="ex: 51.75.23.110" style="font-family:monospace" />
          </div>
          <div class="field">
            <label>Label (optionnel)</label>
            <input pInputText [(ngModel)]="f0.label" placeholder="ex: VPS OVH prod" />
          </div>
          <div class="field">
            <label>Port SSH root (actuel)</label>
            <input pInputText [(ngModel)]="f0.rootPort" type="number" placeholder="22" style="width:160px" />
            <div class="hint">Le port sur lequel tourne le SSH root — généralement 22 sur un VPS neuf.</div>
          </div>
          <div class="actions">
            <p-button label="Retour au dashboard" [outlined]="true" size="small" (onClick)="backToDash()"></p-button>
            <p-button label="Suivant" icon="pi pi-arrow-right" iconPos="right" [loading]="loading()" (onClick)="step0Next()"></p-button>
          </div>
        </div>
      }

      <!-- STEP 1: Test SSH root -->
      @if (currentStep() === 1) {
        <div class="card">
          <p class="section-title">Connexion SSH</p>
          <p class="section-sub">Vérifie que tu peux te connecter en SSH avec le mot de passe root.</p>

          @if (host(); as h) {
            <div class="alert alert-info" style="margin-bottom:20px">
              <i class="pi pi-server" style="margin-right:8px"></i>
              <strong>{{ h.label }}</strong> — {{ h.ip }}:{{ h.rootPort }}
            </div>
          }

          <div class="field">
            <label>Mot de passe root</label>
            <p-password [(ngModel)]="f1.password" [feedback]="false" [toggleMask]="true" styleClass="w-full" inputStyleClass="w-full"></p-password>
          </div>

          @if (f1.passwordExpired) {
            <div class="alert" style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);color:#fbbf24;margin-bottom:12px">
              <i class="pi pi-exclamation-triangle" style="margin-right:8px"></i>
              <strong>Mot de passe expiré</strong> — Connexion réussie, mais le serveur exige un changement de mot de passe.
              L'étape suivante le gère automatiquement.
            </div>
          }
          @if (f1.output && !f1.passwordExpired) {
            <div class="alert alert-success">
              <i class="pi pi-check-circle" style="margin-right:8px"></i> Connexion réussie
              <div class="ssh-output">{{ f1.output }}</div>
            </div>
          }
          @if (step1Error()) {
            <div class="alert alert-error"><i class="pi pi-times-circle" style="margin-right:8px"></i>{{ step1Error() }}</div>
          }

          <div class="actions">
            <p-button label="Retour" [outlined]="true" size="small" (onClick)="prevStep()"></p-button>
            <div class="actions-right">
              <p-button label="Tester la connexion" icon="pi pi-wifi" [loading]="loading()" (onClick)="step1Test()"></p-button>
              @if (host()?.status !== 'new') {
                <p-button label="Suivant" icon="pi pi-arrow-right" iconPos="right" [outlined]="true" (onClick)="nextStep()"></p-button>
              }
            </div>
          </div>
        </div>
      }

      <!-- STEP 2: Changer le mot de passe root -->
      @if (currentStep() === 2) {
        <div class="card">
          <p class="section-title">Changer le mot de passe root</p>
          <p class="section-sub">Change le mot de passe root par défaut pour sécuriser l'accès.</p>

          <div class="field">
            <label>Mot de passe root actuel</label>
            <p-password [(ngModel)]="f2.currentPassword" [feedback]="false" [toggleMask]="true" styleClass="w-full" inputStyleClass="w-full"></p-password>
          </div>
          <div class="field">
            <label>Nouveau mot de passe</label>
            <p-password [(ngModel)]="f2.newPassword" [toggleMask]="true" styleClass="w-full" inputStyleClass="w-full"></p-password>
          </div>
          <div class="field">
            <label>Confirmer le nouveau mot de passe</label>
            <p-password [(ngModel)]="f2.confirmPassword" [feedback]="false" [toggleMask]="true" styleClass="w-full" inputStyleClass="w-full"></p-password>
          </div>

          @if (step2Error()) {
            <div class="alert alert-error"><i class="pi pi-times-circle" style="margin-right:8px"></i>{{ step2Error() }}</div>
          }
          @if (host()?.status === 'password-changed' || host()?.status === 'key-copied' || host()?.status === 'configured') {
            <div class="alert alert-success"><i class="pi pi-check-circle" style="margin-right:8px"></i>Mot de passe déjà changé lors d'une session précédente.</div>
          }

          <div class="actions">
            <p-button label="Retour" [outlined]="true" size="small" (onClick)="prevStep()"></p-button>
            <div class="actions-right">
              @if (host()?.status === 'password-changed' || host()?.status === 'key-copied' || host()?.status === 'configured') {
                <p-button label="Passer cette étape" [outlined]="true" size="small" (onClick)="nextStep()"></p-button>
              }
              <p-button label="Changer le mot de passe" icon="pi pi-shield" [loading]="loading()" (onClick)="step2Change()"></p-button>
            </div>
          </div>
        </div>
      }

      <!-- STEP 3: Copier la clé SSH -->
      @if (currentStep() === 3) {
        <div class="card">
          <p class="section-title">Copier la clé SSH</p>
          <p class="section-sub">Copie une clé publique SSH sur le serveur pour un accès sans mot de passe.</p>

          <!-- Toggle machine source -->
          <div style="display:flex;gap:8px;margin-bottom:20px">
            <button class="mode-btn" [class.active]="f3.mode === 'local'" (click)="f3.mode = 'local'">
              <i class="pi pi-desktop" style="margin-right:6px"></i> Cette machine
            </button>
            <button class="mode-btn" [class.active]="f3.mode === 'other'" (click)="f3.mode = 'other'">
              <i class="pi pi-plus-circle" style="margin-right:6px"></i> Autre machine
            </button>
          </div>

          @if (f3.mode === 'local') {
            <div class="field">
              <label>Sélectionne une clé publique locale</label>
              @if (sshKeys().length === 0) {
                <div class="alert alert-error"><i class="pi pi-exclamation-triangle" style="margin-right:8px"></i>Aucune clé trouvée dans ~/.ssh/. Génère-en une avec <code>ssh-keygen -t ed25519</code>.</div>
              } @else {
                <div class="key-list">
                  @for (key of sshKeys(); track key.name) {
                    <div class="key-item" [class.selected]="f3.selectedKey?.name === key.name" (click)="f3.selectedKey = key">
                      <div class="key-name"><i class="pi pi-key" style="margin-right:8px;color:#818cf8"></i>{{ key.name }}</div>
                      <div class="key-path">{{ key.path }}</div>
                      <div class="key-content">{{ key.content }}</div>
                    </div>
                  }
                </div>
              }
            </div>
          } @else {
            <div class="field">
              <label>Clé publique à ajouter</label>
              <textarea class="key-textarea" [(ngModel)]="f3.pastedKey" rows="4"
                placeholder="ssh-ed25519 AAAA... utilisateur@autre-machine"></textarea>
              <div class="hint">Colle le contenu du fichier <code>~/.ssh/id_ed25519.pub</code> de l'autre machine.</div>
            </div>
          }

          <div class="field" style="margin-top:16px">
            <label>Mot de passe root (pour la copie)</label>
            <p-password [(ngModel)]="f3.password" [feedback]="false" [toggleMask]="true" styleClass="w-full" inputStyleClass="w-full"></p-password>
            <div class="hint">Utilise le nouveau mot de passe si tu viens de le changer.</div>
          </div>

          @if (step3Error()) {
            <div class="alert alert-error"><i class="pi pi-times-circle" style="margin-right:8px"></i>{{ step3Error() }}</div>
          }
          @if (host()?.status === 'key-copied' || host()?.status === 'configured') {
            <div class="alert alert-success"><i class="pi pi-check-circle" style="margin-right:8px"></i>Clé SSH déjà copiée lors d'une session précédente.</div>
          }

          <div class="actions">
            <p-button label="Retour" [outlined]="true" size="small" (onClick)="prevStep()"></p-button>
            <div class="actions-right">
              @if (host()?.status === 'key-copied' || host()?.status === 'configured') {
                <p-button label="Passer cette étape" [outlined]="true" size="small" (onClick)="nextStep()"></p-button>
              }
              <p-button label="Copier la clé" icon="pi pi-upload" [loading]="loading()"
                [disabled]="f3.mode === 'local' ? !f3.selectedKey : !f3.pastedKey.trim()"
                (onClick)="step3CopyKey()">
              </p-button>
            </div>
          </div>
        </div>
      }

      <!-- STEP 4: Config Ansible -->
      @if (currentStep() === 4) {
        <div class="card">
          <p class="section-title">Configuration Ansible</p>
          <p class="section-sub">Paramètre les options qui seront appliquées par le playbook.</p>

          <div class="row2">
            <div class="field">
              <label>Utilisateur à créer</label>
              <input pInputText [(ngModel)]="f4.deployUser" placeholder="deploy" />
              <div class="hint">L'utilisateur non-root créé par Ansible.</div>
            </div>
            <div class="field">
              <label>Port SSH final</label>
              <input pInputText [(ngModel)]="f4.sshPort" type="number" placeholder="1024" />
              <div class="hint">Port SSH après configuration (défaut : 1024).</div>
            </div>
          </div>

          <div class="field">
            <label>Chemin de la clé privée SSH</label>
            <input pInputText [(ngModel)]="f4.privateKeyPath" placeholder="~/.ssh/id_ed25519" style="font-family:monospace" />
            <div class="hint">Clé utilisée par Ansible pour se connecter au serveur.</div>
          </div>

          <div style="border-top:1px solid #1a1e2a;margin:20px 0;padding-top:20px">
            <p style="font-size:0.85rem;font-weight:600;color:#94a3b8;margin:0 0 12px">Vault Ansible (optionnel)</p>
            <div class="field">
              <label>Mot de passe du vault</label>
              <p-password [(ngModel)]="f4.vaultPassword" [feedback]="false" [toggleMask]="true" styleClass="w-full" inputStyleClass="w-full" placeholder="Laisse vide si pas de vault"></p-password>
              <div class="hint">Requis si ton vault.yml est chiffré.</div>
            </div>
          </div>

          <!-- SSH Config alias -->
          <div style="border-top:1px solid #1a1e2a;margin:20px 0;padding-top:20px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
              <div>
                <p style="font-size:0.85rem;font-weight:600;color:#94a3b8;margin:0 0 2px">
                  <i class="pi pi-terminal" style="margin-right:6px;color:#818cf8"></i>Alias SSH (optionnel)
                </p>
                <p style="font-size:0.72rem;color:#475569;margin:0">Pour te connecter avec <code style="color:#4ade80">ssh {{ f4.sshAlias || 'mon_vps' }}</code> au lieu de l'IP</p>
              </div>
            </div>
            <div class="row2">
              <div class="field">
                <label>Alias</label>
                <input pInputText [(ngModel)]="f4.sshAlias" placeholder="mon_vps" style="font-family:monospace" />
              </div>
              <div class="field" style="display:flex;align-items:flex-end">
                <p-button label="Appliquer dans ~/.ssh/config" icon="pi pi-save" size="small"
                  [outlined]="true" [loading]="sshConfigLoading()" [disabled]="!f4.sshAlias"
                  (onClick)="step4SaveSshConfig()">
                </p-button>
              </div>
            </div>
            @if (sshConfigMsg()) {
              <div class="alert" style="margin-top:0" [class.alert-success]="!sshConfigError()" [class.alert-error]="sshConfigError()">
                <i class="pi" [class.pi-check-circle]="!sshConfigError()" [class.pi-times-circle]="sshConfigError()" style="margin-right:8px"></i>
                {{ sshConfigMsg() }}
              </div>
            }
            @if (f4.sshAlias) {
              <pre style="background:#0a0c10;border-radius:8px;padding:10px 14px;font-size:0.72rem;color:#64748b;margin:8px 0 0;overflow-x:auto">Host {{ f4.sshAlias }}
    HostName {{ host()?.ip }}
    User {{ f4.deployUser || 'deploy' }}
    Port {{ f4.sshPort || 1024 }}
    IdentityFile {{ f4.privateKeyPath || '~/.ssh/id_ed25519' }}</pre>
            }
          </div>

          <div class="actions">
            <p-button label="Retour" [outlined]="true" size="small" (onClick)="prevStep()"></p-button>
            <p-button label="Enregistrer et déployer" icon="pi pi-arrow-right" iconPos="right" [loading]="loading()" (onClick)="step4Save()"></p-button>
          </div>
        </div>
      }

      <!-- STEP 5: Déploiement -->
      @if (currentStep() === 5) {
        <div class="card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <p class="section-title" style="margin:0">Déploiement Ansible</p>
            @if (deployStatus() === 'running') {
              <p-tag value="En cours" severity="warn"></p-tag>
            } @else if (deployStatus() === 'success') {
              <p-tag value="Succès" severity="success"></p-tag>
            } @else if (deployStatus() === 'failed' || deployStatus() === 'error') {
              <p-tag value="Échec" severity="danger"></p-tag>
            }
          </div>
          <p class="section-sub">Ansible configure ton serveur en temps réel.</p>

          <div class="terminal" #terminalEl>
            @for (line of deployLogs(); track $index) {
              <p class="terminal-line" [class]="line.type">{{ line.text }}</p>
            }
            @if (deployStatus() === 'idle') {
              <p class="terminal-line info">Prêt à démarrer le déploiement...</p>
            }
          </div>

          @if (deployStatus() === 'success') {
            <div class="alert alert-success" style="margin-top:16px">
              <i class="pi pi-check-circle" style="margin-right:8px"></i>
              Déploiement réussi ! Ton serveur est maintenant configuré.
            </div>
          }
          @if (deployStatus() === 'failed' || deployStatus() === 'error') {
            <div class="alert alert-error" style="margin-top:16px">
              <i class="pi pi-times-circle" style="margin-right:8px"></i>
              Le déploiement a échoué. Consulte les logs ci-dessus pour diagnostiquer.
            </div>
          }

          <div class="actions">
            <p-button label="Retour" [outlined]="true" size="small" [disabled]="deployStatus() === 'running'" (onClick)="prevStep()"></p-button>
            <div class="actions-right">
              @if (deployStatus() === 'idle' || deployStatus() === 'failed' || deployStatus() === 'error') {
                <p-button label="Lancer le playbook" icon="pi pi-play" (onClick)="step5Deploy()"></p-button>
              }
              @if (deployStatus() === 'running') {
                <p-button label="Annuler" severity="danger" [outlined]="true" (onClick)="step5Cancel()"></p-button>
              }
              @if (deployStatus() === 'success') {
                <p-button label="Tableau de bord" icon="pi pi-home" (onClick)="backToDash()"></p-button>
              }
            </div>
          </div>
        </div>
      }

    </div>
  `
})
export class SetupComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('terminalEl') terminalEl?: ElementRef<HTMLDivElement>;

  currentStep = signal(0);
  loading = signal(false);
  host = signal<Host | null>(null);
  sshKeys = signal<SshKey[]>([]);
  deployLogs = signal<{ type: string; text: string }[]>([]);
  deployStatus = signal<'idle' | 'running' | 'success' | 'failed' | 'error'>('idle');

  step1Error = signal('');
  step2Error = signal('');
  step3Error = signal('');

  f0 = { ip: '', label: '', rootPort: 22 };
  f1 = { password: '', output: '', passwordExpired: false };
  f2 = { currentPassword: '', newPassword: '', confirmPassword: '' };
  f3: { selectedKey: SshKey | null; password: string; mode: 'local' | 'other'; pastedKey: string } = {
    selectedKey: null, password: '', mode: 'local', pastedKey: ''
  };
  f4 = { deployUser: 'deploy', sshPort: 1024, privateKeyPath: '~/.ssh/id_ed25519', vaultPassword: '', sshAlias: '' };

  sshConfigLoading = signal(false);
  sshConfigMsg = signal('');
  sshConfigError = signal(false);

  wizardSteps = [
    { key: 'info',     label: 'Serveur' },
    { key: 'ssh',      label: 'SSH' },
    { key: 'password', label: 'Mot de passe' },
    { key: 'key',      label: 'Clé SSH' },
    { key: 'config',   label: 'Config' },
    { key: 'deploy',   label: 'Déploiement' },
  ];

  private socket: Socket | null = null;
  private jobId = '';
  private shouldScrollTerminal = false;

  constructor(
    private api: ApiService,
    private router: Router,
    private route: ActivatedRoute,
    private msg: MessageService
  ) {}

  ngOnInit() {
    this.api.getSshKeys().subscribe({ next: k => this.sshKeys.set(k) });

    const hostId = this.route.snapshot.queryParamMap.get('hostId');
    if (hostId) {
      this.api.getHosts().subscribe({
        next: hosts => {
          const h = hosts.find(x => x.id === hostId);
          if (h) {
            this.host.set(h);
            this.currentStep.set(this.stepFromStatus(h.status));
            // Pre-fill config from existing host
            if (h.deployUser) this.f4.deployUser = h.deployUser;
            if (h.sshPort) this.f4.sshPort = h.sshPort;
            if (h.privateKeyPath) this.f4.privateKeyPath = h.privateKeyPath;
            if (!this.f4.sshAlias) this.f4.sshAlias = h.label.toLowerCase().replace(/[^a-z0-9]/g, '_');
          }
        }
      });
    }
  }

  ngOnDestroy() {
    this.disconnectSocket();
  }

  ngAfterViewChecked() {
    if (this.shouldScrollTerminal && this.terminalEl) {
      const el = this.terminalEl.nativeElement;
      el.scrollTop = el.scrollHeight;
      this.shouldScrollTerminal = false;
    }
  }

  private stepFromStatus(status: string): number {
    switch (status) {
      case 'new': return 1;
      case 'ssh-ok': return 2;
      case 'password-changed': return 3;
      case 'key-copied': return 4;
      case 'configured': return 5;
      default: return 0;
    }
  }

  prevStep() { this.currentStep.update(s => Math.max(0, s - 1)); }
  nextStep() { this.currentStep.update(s => Math.min(this.wizardSteps.length - 1, s + 1)); }
  backToDash() { this.router.navigate(['/dashboard']); }

  // ─── STEP 0 ─────────────────────────────────────────────────────────────────
  step0Next() {
    if (!this.f0.ip.trim()) {
      this.msg.add({ severity: 'warn', summary: 'IP manquante', detail: 'Renseigne l\'adresse IP du serveur' });
      return;
    }
    this.loading.set(true);
    this.api.addHost({ ip: this.f0.ip.trim(), label: this.f0.label.trim() || this.f0.ip.trim(), rootPort: Number(this.f0.rootPort) || 22 }).subscribe({
      next: h => { this.host.set(h); this.loading.set(false); this.nextStep(); },
      error: err => {
        this.loading.set(false);
        const msg = err.error?.error || 'Erreur lors de l\'ajout';
        this.msg.add({ severity: 'error', summary: 'Erreur', detail: msg });
      }
    });
  }

  // ─── STEP 1 ─────────────────────────────────────────────────────────────────
  step1Test() {
    const h = this.host();
    if (!h || !this.f1.password) {
      this.msg.add({ severity: 'warn', summary: 'Mot de passe manquant', detail: 'Saisis le mot de passe root' });
      return;
    }
    this.step1Error.set('');
    this.loading.set(true);
    this.api.testSsh({ host: h.ip, port: h.rootPort, username: 'root', password: this.f1.password }).subscribe({
      next: res => {
        this.loading.set(false);
        this.f1.output = res.output || 'OK';
        this.f1.passwordExpired = !!res.passwordExpired;
        // Pre-fill the current password in step 2 so the user doesn't have to retype it
        if (!this.f2.currentPassword) this.f2.currentPassword = this.f1.password;
        this.api.updateHost(h.id, { status: 'ssh-ok' }).subscribe({ next: updated => this.host.set(updated) });
        setTimeout(() => this.nextStep(), this.f1.passwordExpired ? 2000 : 1200);
      },
      error: err => {
        this.loading.set(false);
        this.step1Error.set(err.error?.error || 'Connexion impossible');
      }
    });
  }

  // ─── STEP 2 ─────────────────────────────────────────────────────────────────
  step2Change() {
    const h = this.host();
    if (!h) return;
    if (!this.f2.currentPassword || !this.f2.newPassword) {
      this.msg.add({ severity: 'warn', summary: 'Champs manquants', detail: 'Remplis tous les champs' });
      return;
    }
    if (this.f2.newPassword !== this.f2.confirmPassword) {
      this.step2Error.set('Les mots de passe ne correspondent pas.');
      return;
    }
    this.step2Error.set('');
    this.loading.set(true);
    this.api.changePassword({
      host: h.ip, port: h.rootPort, username: 'root',
      currentPassword: this.f2.currentPassword, newPassword: this.f2.newPassword
    }).subscribe({
      next: () => {
        this.loading.set(false);
        this.api.updateHost(h.id, { status: 'password-changed' }).subscribe({ next: updated => this.host.set(updated) });
        this.msg.add({ severity: 'success', summary: 'Mot de passe changé' });
        setTimeout(() => this.nextStep(), 800);
      },
      error: err => {
        this.loading.set(false);
        this.step2Error.set(err.error?.error || 'Changement échoué');
      }
    });
  }

  // ─── STEP 3 ─────────────────────────────────────────────────────────────────
  step3CopyKey() {
    const h = this.host();
    const isLocal = this.f3.mode === 'local';
    const publicKey = isLocal ? this.f3.selectedKey?.content : this.f3.pastedKey.trim();

    if (!h || !publicKey || !this.f3.password) {
      this.msg.add({ severity: 'warn', summary: 'Champs manquants', detail: isLocal ? 'Sélectionne une clé et saisis le mot de passe' : 'Colle une clé publique et saisis le mot de passe' });
      return;
    }
    this.step3Error.set('');
    this.loading.set(true);
    this.api.copyKey({
      host: h.ip, port: h.rootPort, username: 'root',
      password: this.f3.password, publicKey
    }).subscribe({
      next: () => {
        if (isLocal && this.f3.selectedKey) {
          // Verify local key works (we have the private key path)
          const privPath = this.f3.selectedKey.path.replace('.pub', '');
          this.api.verifyKey({ host: h.ip, port: h.rootPort, username: 'root', privateKeyPath: privPath }).subscribe({
            next: res => {
              this.loading.set(false);
              if (res.ok) {
                this.f4.privateKeyPath = privPath;
                this.api.updateHost(h.id, { status: 'key-copied', privateKeyPath: privPath }).subscribe({ next: updated => this.host.set(updated) });
                this.msg.add({ severity: 'success', summary: 'Clé copiée et vérifiée !' });
                setTimeout(() => this.nextStep(), 800);
              } else {
                this.step3Error.set('Clé copiée mais la vérification a échoué.');
              }
            },
            error: () => {
              this.loading.set(false);
              this.step3Error.set('Clé copiée mais impossible de vérifier la connexion par clé.');
            }
          });
        } else {
          // "Autre machine" mode: no local private key to verify, just mark as copied
          this.loading.set(false);
          this.api.updateHost(h.id, { status: 'key-copied' }).subscribe({ next: updated => this.host.set(updated) });
          this.msg.add({ severity: 'success', summary: 'Clé ajoutée !', detail: 'L\'autre machine peut maintenant accéder au serveur.' });
          setTimeout(() => this.nextStep(), 800);
        }
      },
      error: err => {
        this.loading.set(false);
        this.step3Error.set(err.error?.error || 'Copie de la clé échouée');
      }
    });
  }

  // ─── STEP 4 ─────────────────────────────────────────────────────────────────
  step4Save() {
    const h = this.host();
    if (!h) return;
    this.loading.set(true);
    this.api.updateHost(h.id, {
      deployUser: this.f4.deployUser,
      sshPort: Number(this.f4.sshPort),
      privateKeyPath: this.f4.privateKeyPath,
    }).subscribe({
      next: updated => {
        this.host.set(updated);
        this.loading.set(false);
        this.nextStep();
      },
      error: () => { this.loading.set(false); }
    });
  }

  step4SaveSshConfig() {
    const h = this.host();
    if (!h || !this.f4.sshAlias) return;
    this.sshConfigLoading.set(true);
    this.sshConfigMsg.set('');
    this.api.addSshConfig({
      alias: this.f4.sshAlias,
      hostname: h.ip,
      user: this.f4.deployUser || 'deploy',
      port: Number(this.f4.sshPort) || 1024,
      identityFile: this.f4.privateKeyPath || '~/.ssh/id_ed25519'
    }).subscribe({
      next: () => {
        this.sshConfigLoading.set(false);
        this.sshConfigError.set(false);
        this.sshConfigMsg.set(`✓ Entrée ajoutée — tu peux maintenant faire : ssh ${this.f4.sshAlias}`);
      },
      error: err => {
        this.sshConfigLoading.set(false);
        this.sshConfigError.set(true);
        this.sshConfigMsg.set(err.error?.error || 'Erreur lors de l\'écriture');
      }
    });
  }

  // ─── STEP 5 ─────────────────────────────────────────────────────────────────
  step5Deploy() {
    const h = this.host();
    if (!h) return;

    this.deployLogs.set([]);
    this.deployStatus.set('running');
    this.jobId = `job-${Date.now()}`;

    this.connectSocket();

    this.addLog('info', `▶ Démarrage du déploiement pour ${h.label} (${h.ip})`);
    this.addLog('info', `  Job ID : ${this.jobId}`);
    this.addLog('info', '─'.repeat(60));

    this.socket!.emit('deploy:run', {
      jobId: this.jobId,
      vaultPassword: this.f4.vaultPassword || null,
      checkMode: false
    });
  }

  step5Cancel() {
    if (this.socket && this.jobId) {
      this.socket.emit('deploy:cancel', { jobId: this.jobId });
    }
  }

  private connectSocket() {
    this.disconnectSocket();
    this.socket = io('http://localhost:3001');

    this.socket.on('job:output', ({ type, text }: { jobId: string; type: string; text: string }) => {
      const lines = text.split('\n');
      lines.forEach(l => { if (l) this.addLog(type === 'stderr' ? 'stderr' : 'stdout', l); });
    });

    this.socket.on('job:done', ({ exitCode, status }: { jobId: string; exitCode: number; status: string }) => {
      if (status === 'success') {
        this.deployStatus.set('success');
        this.addLog('success', '─'.repeat(60));
        this.addLog('success', '✅ Déploiement terminé avec succès !');
        const h = this.host();
        if (h) {
          this.api.updateHost(h.id, { status: 'configured', lastDeployAt: new Date().toISOString() })
            .subscribe({ next: updated => this.host.set(updated) });
        }
      } else {
        this.deployStatus.set('failed');
        this.addLog('error', '─'.repeat(60));
        this.addLog('error', `❌ Déploiement échoué (code ${exitCode})`);
      }
      this.disconnectSocket();
    });

    this.socket.on('job:error', ({ error }: { jobId: string; error: string }) => {
      this.deployStatus.set('error');
      this.addLog('error', `❌ Erreur : ${error}`);
      this.disconnectSocket();
    });

    this.socket.on('job:cancelled', () => {
      this.deployStatus.set('failed');
      this.addLog('error', '⚠️ Déploiement annulé');
      this.disconnectSocket();
    });
  }

  private disconnectSocket() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private addLog(type: string, text: string) {
    this.deployLogs.update(logs => [...logs, { type, text }]);
    this.shouldScrollTerminal = true;
  }
}
