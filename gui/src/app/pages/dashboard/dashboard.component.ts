import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ApiService, Host } from '../../services/api.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, ButtonModule, TagModule, ToastModule],
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
    .card-actions { display:flex; gap:8px; }
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

            <!-- Progress steps -->
            <div style="font-size:0.72rem;color:#475569;margin-bottom:6px">Progression du setup</div>
            <div class="progress-steps">
              @for (step of steps; track step.key) {
                <div class="step" [class]="stepClass(host.status, step.key)" [title]="step.label"></div>
              }
            </div>
            <div style="font-size:0.72rem;color:#64748b;margin-top:4px">{{ stepDesc(host.status) }}</div>

            <div class="host-meta">
              <div class="meta-item">
                <div class="meta-label">Port initial</div>
                <div class="meta-val">{{ host.rootPort }}</div>
              </div>
              <div class="meta-item">
                <div class="meta-label">Port SSH final</div>
                <div class="meta-val">{{ host.sshPort || '—' }}</div>
              </div>
            </div>

            <div class="card-actions" style="margin-top:16px">
              @if (host.status !== 'configured') {
                <p-button label="Continuer le setup" icon="pi pi-arrow-right" size="small"
                  styleClass="w-full" (onClick)="continueSetup(host)">
                </p-button>
              } @else {
                <p-button label="Redéployer" icon="pi pi-play-circle" size="small" [outlined]="true"
                  (onClick)="continueSetup(host)">
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
  `
})
export class DashboardComponent implements OnInit {
  hosts = signal<Host[]>([]);

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
      'configured': 'Fully configured',
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
