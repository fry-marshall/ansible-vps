import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../services/api.service';
import { DeployService } from '../../services/deploy.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, ButtonModule, TagModule, ToastModule],
  providers: [MessageService],
  styles: [`
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .card { background: #13161e; border: 1px solid #2a3145; border-radius: 12px; padding: 1.25rem 1.5rem; }
    .card:hover { border-color: #374151; }
    .stat-label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
    .stat-value { font-size: 1.75rem; font-weight: 700; color: #e2e8f0; }
    .stat-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .stat-icon-box { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
    .host-card { background: #0d0f14; border: 1px solid #1a1e2a; border-radius: 8px; padding: 1rem; margin-bottom: 12px; }
    .host-meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px; }
    .host-meta-item { padding: 8px; }
    .meta-label { font-size: 0.72rem; color: #475569; margin-bottom: 2px; }
    .meta-val { font-size: 0.85rem; color: #94a3b8; font-family: monospace; }
    .action-item { background: #0d0f14; border: 1px solid #1a1e2a; border-radius: 8px; padding: 1rem; cursor: pointer; transition: border-color 0.15s; margin-bottom: 10px; display: flex; align-items: center; gap: 12px; text-decoration: none; }
    .action-item:hover { border-color: rgba(99,102,241,0.4); }
    .action-icon { width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .feat-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid #1a1e2a; }
    .feat-icon { font-size: 0.9rem; width: 20px; text-align: center; flex-shrink: 0; }
    .info-row { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; }
    .ping-output { font-family: monospace; font-size: 12px; background: #060810; color: #cdd6f4; padding: 12px 16px; border-radius: 8px; overflow-y: auto; max-height: 160px; border: 1px solid #1a1e2a; white-space: pre-wrap; word-break: break-all; margin-top: 16px; }
  `],
  template: `
    <p-toast />

    <div style="margin-bottom:24px">
      <h1 style="font-size:1.5rem;font-weight:700;color:#e2e8f0;margin:0 0 4px">Dashboard</h1>
      <p style="color:#64748b;font-size:0.875rem;margin:0">Vue d'ensemble de ton infrastructure VPS</p>
    </div>

    <!-- Stat cards -->
    <div class="stats-grid">
      @for (card of statCards(); track card.label) {
        <div class="card">
          <div class="stat-head">
            <div class="stat-label">{{ card.label }}</div>
            <div class="stat-icon-box" [style.background]="card.bg">
              <i [class]="'pi ' + card.icon" [style.color]="card.color" style="font-size:1.1rem"></i>
            </div>
          </div>
          <div class="stat-value">{{ card.value }}</div>
        </div>
      }
    </div>

    <!-- 2 colonnes -->
    <div class="two-col" style="margin-bottom:16px">

      <!-- Statut VPS -->
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <h2 style="font-size:1rem;font-weight:600;color:#e2e8f0;margin:0">Statut VPS</h2>
          <p-button label="Ping" icon="pi pi-wifi" size="small" [outlined]="true"
            (onClick)="pingVps()" [loading]="pinging()">
          </p-button>
        </div>
        @for (host of hosts(); track host.ip) {
          <div class="host-card">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
              <div style="display:flex;align-items:center;gap:8px">
                <div [style.background]="hostStatusColor(host.status)"
                     style="width:8px;height:8px;border-radius:50%;"
                     [style.boxShadow]="'0 0 6px ' + hostStatusColor(host.status)">
                </div>
                <span style="font-weight:600;color:#e2e8f0;font-size:0.9rem;font-family:monospace">{{ host.ip }}</span>
              </div>
              <p-tag [value]="host.status" [severity]="hostSeverity(host.status)" size="small"></p-tag>
            </div>
            <div class="host-meta">
              <div class="host-meta-item">
                <div class="meta-label">Groupe</div>
                <div class="meta-val">{{ host.group }}</div>
              </div>
              <div class="host-meta-item">
                <div class="meta-label">Utilisateur</div>
                <div class="meta-val">{{ host.user }}</div>
              </div>
              <div class="host-meta-item">
                <div class="meta-label">Port SSH</div>
                <div class="meta-val">{{ host.port }}</div>
              </div>
            </div>
          </div>
        }
        @if (pingOutput().length > 0) {
          <div class="ping-output">{{ pingOutput().join('') }}</div>
        }
      </div>

      <!-- Actions rapides -->
      <div class="card">
        <h2 style="font-size:1rem;font-weight:600;color:#e2e8f0;margin:0 0 12px">Actions rapides</h2>
        @for (action of quickActions; track action.label) {
          <a class="action-item" [routerLink]="action.route">
            <div class="action-icon" [style.background]="action.bg">
              <i [class]="'pi ' + action.icon" [style.color]="action.color" style="font-size:1.1rem"></i>
            </div>
            <div style="flex:1">
              <div style="font-weight:600;color:#e2e8f0;font-size:0.875rem">{{ action.label }}</div>
              <div style="color:#64748b;font-size:0.78rem">{{ action.desc }}</div>
            </div>
            <i class="pi pi-chevron-right" style="color:#374151;font-size:0.75rem"></i>
          </a>
        }
      </div>

      <!-- Infrastructure -->
      <div class="card">
        <h2 style="font-size:1rem;font-weight:600;color:#e2e8f0;margin:0 0 12px">Sécurité configurée</h2>
        @for (feature of features; track feature.label) {
          <div class="feat-row">
            <i [class]="'pi feat-icon ' + feature.icon" [style.color]="feature.color"></i>
            <div style="flex:1">
              <div style="font-size:0.85rem;color:#e2e8f0;font-weight:500">{{ feature.label }}</div>
              <div style="font-size:0.75rem;color:#64748b">{{ feature.desc }}</div>
            </div>
            <p-tag [value]="feature.status" [severity]="feature.enabled ? 'success' : 'secondary'" size="small"></p-tag>
          </div>
        }
      </div>

      <!-- Projet -->
      <div class="card">
        <h2 style="font-size:1rem;font-weight:600;color:#e2e8f0;margin:0 0 12px">Projet</h2>
        @for (info of projectInfo(); track info.key) {
          <div class="info-row">
            <span style="font-size:0.82rem;color:#64748b">{{ info.key }}</span>
            <span style="font-size:0.82rem;color:#e2e8f0;font-weight:500;font-family:monospace">{{ info.value }}</span>
          </div>
        }
        <div style="margin-top:16px;padding-top:16px;border-top:1px solid #1a1e2a">
          <p-button label="Lancer un déploiement" icon="pi pi-play-circle"
            routerLink="/deploy" styleClass="w-full" size="small">
          </p-button>
        </div>
      </div>

    </div>
  `
})
export class DashboardComponent implements OnInit {
  pinging = signal(false);
  pingOutput = signal<string[]>([]);
  hosts = signal<any[]>([]);

  statCards = signal([
    { label: 'Hôtes VPS',    value: '1', icon: 'pi-server',     color: '#818cf8', bg: 'rgba(99,102,241,0.12)' },
    { label: 'Rôles actifs', value: '1', icon: 'pi-cog',        color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
    { label: 'Tâches',       value: '8', icon: 'pi-list-check',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    { label: 'Ports ouverts', value: '3', icon: 'pi-shield',    color: '#22d3ee', bg: 'rgba(34,211,238,0.12)' },
  ]);

  projectInfo = signal<{ key: string; value: string }[]>([]);

  quickActions = [
    { label: "Gérer l'inventaire", desc: 'Ajouter ou modifier des hôtes VPS', icon: 'pi-sitemap',     route: '/inventory', color: '#818cf8', bg: 'rgba(99,102,241,0.12)' },
    { label: 'Configurer',          desc: 'Modifier vars.yml et le vault chiffré', icon: 'pi-sliders-h', route: '/config',    color: '#22d3ee', bg: 'rgba(34,211,238,0.12)' },
    { label: 'Déployer',            desc: 'Lancer le playbook avec logs live', icon: 'pi-play-circle',  route: '/deploy',    color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
    { label: 'Historique',          desc: 'Voir les déploiements précédents', icon: 'pi-history',       route: '/logs',      color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  ];

  features = [
    { label: 'Durcissement SSH',  desc: 'Port 1024, auth clé, no-root',       icon: 'pi-lock',    color: '#22c55e', status: 'Actif',     enabled: true },
    { label: 'Pare-feu UFW',      desc: 'Deny all + ports 1024/80/443',        icon: 'pi-shield',  color: '#22c55e', status: 'Actif',     enabled: true },
    { label: 'Fail2ban',          desc: 'Anti-brute-force + alertes email',    icon: 'pi-eye',     color: '#22c55e', status: 'Actif',     enabled: true },
    { label: 'Notifs SSH login',  desc: 'Email à chaque connexion SSH',        icon: 'pi-bell',    color: '#f59e0b', status: 'Désactivé', enabled: false },
    { label: 'Docker CE',         desc: 'Docker + docker-compose installés',   icon: 'pi-box',     color: '#22c55e', status: 'Actif',     enabled: true },
    { label: 'Updates auto',      desc: 'Patches sécurité nocturnes',          icon: 'pi-refresh', color: '#22c55e', status: 'Actif',     enabled: true },
  ];

  constructor(private api: ApiService, private deploy: DeployService) {}

  ngOnInit() {
    this.deploy.reset(); // ne pas auto-lancer le ping
    this.api.getInventory().subscribe({ next: ({ hosts }) => {
      this.hosts.set(hosts.map(h => ({
        ip: h.host, group: h.group,
        user: h.vars['ansible_user'] || 'deploy',
        port: h.vars['ansible_port'] || '22',
        status: 'unknown'
      })));
      this.statCards.update(c => c.map(s =>
        s.label === 'Hôtes VPS' ? { ...s, value: String(hosts.length) } : s
      ));
    }});

    this.api.getProjectStatus().subscribe({ next: s => {
      this.projectInfo.set([
        { key: 'Chemin projet',  value: '~/DEV/ansible-vps-config' },
        { key: 'Inventaire',     value: s.hasInventory ? '✓ inventory.ini' : '✗ manquant' },
        { key: 'Playbook',       value: s.hasPlaybook  ? '✓ playbook.yml'  : '✗ manquant' },
        { key: 'Vault',          value: s.hasVault     ? '✓ chiffré'       : '✗ non configuré' },
      ]);
    }});
  }

  pingVps() {
    this.pinging.set(true);
    this.pingOutput.set([]);
    this.deploy.runPing();
    const interval = setInterval(() => {
      this.pingOutput.set(this.deploy.output().map(l => l.text));
      const s = this.deploy.status();
      if (s === 'success' || s === 'failed' || s === 'error') {
        clearInterval(interval);
        this.pinging.set(false);
        this.hosts.update(hosts => hosts.map(h => ({ ...h, status: s === 'success' ? 'online' : 'offline' })));
      }
    }, 400);
  }

  hostStatusColor(status: string) {
    return status === 'online' ? '#22c55e' : status === 'offline' ? '#ef4444' : '#64748b';
  }
  hostSeverity(status: string): any {
    return status === 'online' ? 'success' : status === 'offline' ? 'danger' : 'secondary';
  }
}
