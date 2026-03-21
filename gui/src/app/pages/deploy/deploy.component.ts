import { Component, signal, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ProgressBarModule } from 'primeng/progressbar';
import { MessageService } from 'primeng/api';
import { DeployService } from '../../services/deploy.service';

interface TaskDef { id: string; label: string; desc: string; icon: string; tag: string; }

@Component({
  selector: 'app-deploy',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, InputTextModule, TagModule, ToastModule, ProgressBarModule],
  providers: [MessageService],
  styles: [`
    .deploy-layout { display:grid; grid-template-columns:300px 1fr; gap:16px; height:calc(100vh - 160px); }
    .sidebar-col { display:flex; flex-direction:column; gap:12px; overflow-y:auto; }
    .panel { background:#13161e; border:1px solid #2a3145; border-radius:12px; padding:1.25rem; }
    .panel-title { display:flex; align-items:center; gap:8px; margin-bottom:12px; font-size:0.9rem; font-weight:600; color:#e2e8f0; }
    .terminal-col { display:flex; flex-direction:column; }
    .terminal-wrap { background:#13161e; border:1px solid #2a3145; border-radius:12px; overflow:hidden; display:flex; flex-direction:column; flex:1; }
    .terminal-header { padding:10px 16px; border-bottom:1px solid #1a1e2a; display:flex; align-items:center; justify-content:space-between; flex-shrink:0; }
    .traffic-lights { display:flex; gap:6px; }
    .tl { width:12px; height:12px; border-radius:50%; }
    .terminal-body { font-family:monospace; font-size:12.5px; background:#060810; color:#cdd6f4; padding:1rem 1.25rem; overflow-y:auto; flex:1; line-height:1.65; white-space:pre-wrap; word-break:break-all; }
    .progress-bar-wrap { padding:8px 16px; border-top:1px solid #1a1e2a; flex-shrink:0; }
    .task-item { display:flex; align-items:flex-start; gap:10px; padding:8px; border-radius:6px; cursor:pointer; transition:background 0.1s; }
    .task-item:hover { background:rgba(99,102,241,0.05); }
    .task-item.selected { background:rgba(99,102,241,0.08); }
    .form-field { display:flex; flex-direction:column; gap:4px; }
    .select-all-bar { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
    .tiny-btn { background:none; border:none; cursor:pointer; font-size:0.75rem; padding:2px 6px; border-radius:4px; }
    .radio-row { display:flex; align-items:flex-start; gap:8px; margin-bottom:10px; cursor:pointer; }
  `],
  template: `
    <p-toast />

    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
      <div>
        <h1 style="font-size:1.5rem;font-weight:700;color:#e2e8f0;margin:0 0 4px">Déployer</h1>
        <p style="color:#64748b;font-size:0.875rem;margin:0">Lancer le playbook Ansible avec logs en temps réel</p>
      </div>
      @if (deploy.status() === 'running') {
        <p-button label="Annuler" icon="pi pi-stop-circle" severity="danger" [outlined]="true" (onClick)="cancel()"></p-button>
      }
    </div>

    <div class="deploy-layout">

      <!-- Options sidebar -->
      <div class="sidebar-col">

        <!-- Vault password -->
        <div class="panel">
          <div class="panel-title">
            <i class="pi pi-key" style="color:#f59e0b"></i>
            Mot de passe vault
          </div>
          <div class="form-field">
            <input pInputText type="password" [(ngModel)]="vaultPassword"
              placeholder="Requis si vault chiffré..."
              style="width:100%;font-family:monospace;font-size:0.85rem" />
            <span style="font-size:0.72rem;color:#475569">Laisse vide si pas de vault</span>
          </div>
        </div>

        <!-- Mode -->
        <div class="panel">
          <div class="panel-title">
            <i class="pi pi-cog" style="color:#818cf8"></i>
            Mode
          </div>
          <label class="radio-row">
            <input type="radio" [(ngModel)]="mode" value="deploy" style="accent-color:#6366f1;margin-top:3px" />
            <span>
              <span style="color:#e2e8f0;font-weight:500;font-size:0.875rem;display:block">Déploiement réel</span>
              <span style="color:#64748b;font-size:0.75rem">Applique sur le VPS</span>
            </span>
          </label>
          <label class="radio-row">
            <input type="radio" [(ngModel)]="mode" value="check" style="accent-color:#6366f1;margin-top:3px" />
            <span>
              <span style="color:#e2e8f0;font-weight:500;font-size:0.875rem;display:block">Check (dry-run)</span>
              <span style="color:#64748b;font-size:0.75rem">Simule sans modifier</span>
            </span>
          </label>
        </div>

        <!-- Tasks -->
        <div class="panel">
          <div class="select-all-bar">
            <div class="panel-title" style="margin-bottom:0">
              <i class="pi pi-list-check" style="color:#22d3ee"></i>
              Tâches
            </div>
            <div>
              <button class="tiny-btn" style="color:#6366f1" (click)="selectAll()">Tout</button>
              <button class="tiny-btn" style="color:#64748b" (click)="selectNone()">Aucun</button>
            </div>
          </div>
          @for (task of availableTasks; track task.id) {
            <div class="task-item" [class.selected]="selectedTasks().includes(task.tag)" (click)="toggleTask(task.tag)">
              <input type="checkbox" [checked]="selectedTasks().includes(task.tag)"
                style="accent-color:#6366f1;margin-top:2px;flex-shrink:0" (change)="$event.stopPropagation()" />
              <div>
                <div style="font-size:0.82rem;font-weight:500;color:#e2e8f0;display:flex;align-items:center;gap:6px">
                  <i [class]="'pi ' + task.icon" style="font-size:0.8rem;color:#64748b"></i>
                  {{ task.label }}
                </div>
                <div style="font-size:0.72rem;color:#64748b">{{ task.desc }}</div>
              </div>
            </div>
          }
        </div>

        <!-- Buttons -->
        <p-button
          [label]="mode === 'check' ? 'Lancer dry-run' : 'Déployer maintenant'"
          [icon]="mode === 'check' ? 'pi pi-eye' : 'pi pi-play-circle'"
          styleClass="w-full"
          [disabled]="deploy.status() === 'running'"
          [loading]="deploy.status() === 'running'"
          (onClick)="launch()">
        </p-button>
        <p-button label="Ping VPS" icon="pi pi-wifi" severity="secondary" [outlined]="true" styleClass="w-full"
          [disabled]="deploy.status() === 'running'" (onClick)="ping()">
        </p-button>

      </div>

      <!-- Terminal -->
      <div class="terminal-col">
        <div class="terminal-wrap">
          <div class="terminal-header">
            <div style="display:flex;align-items:center;gap:12px">
              <div class="traffic-lights">
                <div class="tl" style="background:#ef4444"></div>
                <div class="tl" style="background:#eab308"></div>
                <div class="tl" style="background:#22c55e"></div>
              </div>
              <span style="font-size:0.8rem;color:#475569;font-family:monospace">ansible-playbook</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              @if (deploy.status() !== 'idle') {
                <p-tag [value]="statusLabel()" [severity]="statusSeverity()"></p-tag>
              }
              <button (click)="clearOutput()" style="background:none;border:none;color:#475569;cursor:pointer;font-size:0.75rem;display:flex;align-items:center;gap:4px">
                <i class="pi pi-eraser"></i> Effacer
              </button>
            </div>
          </div>

          <div #terminalEl class="terminal-body">
            @if (deploy.output().length === 0) {
              <span style="color:#374151;font-style:italic">En attente d'exécution...</span>
            }
            @for (line of deploy.output(); track $index) {
              <span [style.color]="line.type === 'stderr' ? '#ff6b6b' : '#cdd6f4'" [innerHTML]="ansi(line.text)"></span>
            }
          </div>

          @if (deploy.status() === 'running') {
            <div class="progress-bar-wrap">
              <p-progressBar mode="indeterminate" [style]="{'height':'3px'}"></p-progressBar>
            </div>
          }
        </div>
      </div>

    </div>
  `
})
export class DeployComponent implements AfterViewChecked {
  @ViewChild('terminalEl') terminalEl!: ElementRef;

  vaultPassword = '';
  mode: 'deploy' | 'check' = 'deploy';
  selectedTasks = signal<string[]>([]);
  private shouldScroll = false;

  availableTasks: TaskDef[] = [
    { id:'system',   label:'Mise à jour système',  desc:'apt update + upgrade',              icon:'pi-refresh',    tag:'system' },
    { id:'updates',  label:'Updates automatiques', desc:'unattended-upgrades config',        icon:'pi-clock',      tag:'updates' },
    { id:'user',     label:'Utilisateur deploy',   desc:'Création + sudo + clé SSH',         icon:'pi-user',       tag:'user' },
    { id:'ssh',      label:'Durcissement SSH',      desc:'Port custom, no-root, no-password', icon:'pi-lock',       tag:'ssh' },
    { id:'firewall', label:'Pare-feu UFW',          desc:'Règles entrantes/sortantes',        icon:'pi-shield',     tag:'firewall' },
    { id:'fail2ban', label:'Fail2ban',              desc:'Anti-brute-force + alertes',        icon:'pi-eye',        tag:'fail2ban' },
    { id:'notify',   label:'Notifs SSH login',      desc:'Email à chaque connexion',          icon:'pi-bell',       tag:'notify' },
    { id:'docker',   label:'Docker CE',             desc:'Docker + compose + make',           icon:'pi-box',        tag:'docker' },
  ];

  constructor(public deploy: DeployService) { this.selectAll(); }

  ngAfterViewChecked() {
    if (this.shouldScroll && this.terminalEl) {
      const el = this.terminalEl.nativeElement;
      el.scrollTop = el.scrollHeight;
      this.shouldScroll = false;
    }
    if (this.deploy.status() === 'running') this.shouldScroll = true;
  }

  selectAll() { this.selectedTasks.set(this.availableTasks.map(t => t.tag)); }
  selectNone() { this.selectedTasks.set([]); }
  toggleTask(tag: string) {
    if (this.selectedTasks().includes(tag)) this.selectedTasks.update(t => t.filter(x => x !== tag));
    else this.selectedTasks.update(t => [...t, tag]);
  }

  launch() {
    const tags = this.selectedTasks().length === this.availableTasks.length ? [] : this.selectedTasks();
    this.deploy.runDeploy({ tags, vaultPassword: this.vaultPassword || undefined, checkMode: this.mode === 'check' });
    this.shouldScroll = true;
  }
  ping() { this.deploy.runPing(); this.shouldScroll = true; }
  cancel() { this.deploy.cancel(); }
  clearOutput() { this.deploy.reset(); }

  statusLabel() {
    const map: Record<string,string> = { running:'En cours...', success:'Succès', failed:'Échec', error:'Erreur', cancelled:'Annulé' };
    return map[this.deploy.status()] || this.deploy.status();
  }
  statusSeverity(): any {
    const s = this.deploy.status();
    if (s === 'success') return 'success';
    if (s === 'failed' || s === 'error') return 'danger';
    if (s === 'running') return 'info';
    return 'secondary';
  }

  ansi(text: string): string {
    return text
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\x1b\[0m/g,'</span>')
      .replace(/\x1b\[1;32m/g,'<span style="color:#22c55e;font-weight:bold">')
      .replace(/\x1b\[1;31m/g,'<span style="color:#ef4444;font-weight:bold">')
      .replace(/\x1b\[1;33m/g,'<span style="color:#eab308;font-weight:bold">')
      .replace(/\x1b\[32m/g,'<span style="color:#22c55e">')
      .replace(/\x1b\[31m/g,'<span style="color:#ef4444">')
      .replace(/\x1b\[33m/g,'<span style="color:#eab308">')
      .replace(/\x1b\[36m/g,'<span style="color:#22d3ee">')
      .replace(/\x1b\[35m/g,'<span style="color:#a78bfa">')
      .replace(/\x1b\[[0-9;]*m/g,'');
  }
}
