import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ApiService, LogEntry } from '../../services/api.service';

@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [CommonModule, ButtonModule, TagModule, DialogModule, ToastModule],
  providers: [MessageService],
  styles: [`
    .page-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:24px; }
    .log-card { background:#13161e; border:1px solid #2a3145; border-radius:12px; padding:1.25rem; margin-bottom:12px; cursor:pointer; transition:border-color 0.15s; }
    .log-card:hover { border-color:#374151; }
    .log-head { display:flex; align-items:center; justify-content:space-between; }
    .log-title { display:flex; align-items:center; gap:10px; }
    .log-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
    .log-meta-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-top:12px; }
    .meta-box { background:#0d0f14; border-radius:6px; padding:8px 12px; }
    .meta-label { font-size:0.7rem; color:#475569; margin-bottom:2px; }
    .log-actions { display:flex; align-items:center; gap:8px; }
    .empty { background:#13161e; border:1px dashed #2a3145; border-radius:12px; padding:4rem; text-align:center; }
    .detail-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:16px; }
    .detail-box { background:#0d0f14; border-radius:8px; padding:10px 12px; }
    .terminal-body { font-family:monospace; font-size:12px; background:#060810; color:#cdd6f4; padding:1rem; border-radius:8px; height:400px; overflow-y:auto; white-space:pre-wrap; word-break:break-all; border:1px solid #1a1e2a; }
  `],
  template: `
    <p-toast />

    <div class="page-header">
      <div>
        <h1 style="font-size:1.5rem;font-weight:700;color:#e2e8f0;margin:0 0 4px">Historique</h1>
        <p style="color:#64748b;font-size:0.875rem;margin:0">{{ logs().length }} déploiement(s) enregistré(s)</p>
      </div>
      <p-button label="Rafraîchir" icon="pi pi-refresh" severity="secondary" [outlined]="true" (onClick)="load()"></p-button>
    </div>

    @if (logs().length === 0) {
      <div class="empty">
        <i class="pi pi-history" style="font-size:2.5rem;color:#374151;display:block;margin-bottom:12px"></i>
        <div style="color:#64748b;font-size:0.9rem">Aucun déploiement enregistré</div>
        <div style="color:#475569;font-size:0.8rem;margin-top:4px">Lance ton premier déploiement depuis "Déployer"</div>
      </div>
    }

    @for (log of logs(); track log.jobId) {
      <div class="log-card" (click)="viewLog(log)">
        <div class="log-head">
          <div class="log-title">
            <div class="log-dot" [style.background]="statusColor(log.status)" [style.boxShadow]="'0 0 6px ' + statusColor(log.status)"></div>
            <div>
              <div style="font-size:0.9rem;font-weight:600;color:#e2e8f0;font-family:monospace">{{ log.jobId }}</div>
              <div style="font-size:0.75rem;color:#64748b;margin-top:2px">
                {{ formatDate(log.startedAt) }}
                @if (log.finishedAt) { — {{ duration(log.startedAt, log.finishedAt) }} }
              </div>
            </div>
          </div>
          <div class="log-actions">
            <p-tag [value]="statusLabel(log.status)" [severity]="statusSeverity(log.status)"></p-tag>
            <p-button icon="pi pi-eye" severity="secondary" [outlined]="true" size="small" (click)="viewLog(log);$event.stopPropagation()"></p-button>
            <p-button icon="pi pi-trash" severity="danger" [outlined]="true" size="small" (click)="deleteLog(log);$event.stopPropagation()"></p-button>
          </div>
        </div>
        <div class="log-meta-grid">
          <div class="meta-box">
            <div class="meta-label">Commande</div>
            <div style="font-size:0.8rem;color:#94a3b8;font-family:monospace">{{ log.command }}</div>
          </div>
          <div class="meta-box">
            <div class="meta-label">Exit code</div>
            <div style="font-size:0.9rem;font-family:monospace;font-weight:700" [style.color]="log.exitCode === 0 ? '#22c55e' : '#ef4444'">{{ log.exitCode ?? '—' }}</div>
          </div>
          <div class="meta-box">
            <div class="meta-label">Statut</div>
            <div style="font-size:0.85rem" [style.color]="statusColor(log.status)">{{ statusLabel(log.status) }}</div>
          </div>
        </div>
      </div>
    }

    <!-- Detail dialog -->
    <p-dialog [(visible)]="detailVisible" [header]="selectedLog()?.jobId || ''" [modal]="true" [style]="{width:'80vw',maxWidth:'1000px'}">
      @if (selectedLog()) {
        <div class="detail-grid">
          <div class="detail-box">
            <div style="font-size:0.72rem;color:#475569;margin-bottom:6px">Statut</div>
            <p-tag [value]="statusLabel(selectedLog()!.status)" [severity]="statusSeverity(selectedLog()!.status)"></p-tag>
          </div>
          <div class="detail-box">
            <div style="font-size:0.72rem;color:#475569;margin-bottom:4px">Démarré</div>
            <div style="font-size:0.8rem;color:#e2e8f0">{{ formatDate(selectedLog()!.startedAt) }}</div>
          </div>
          <div class="detail-box">
            <div style="font-size:0.72rem;color:#475569;margin-bottom:4px">Terminé</div>
            <div style="font-size:0.8rem;color:#e2e8f0">{{ selectedLog()!.finishedAt ? formatDate(selectedLog()!.finishedAt!) : '—' }}</div>
          </div>
          <div class="detail-box">
            <div style="font-size:0.72rem;color:#475569;margin-bottom:4px">Exit code</div>
            <div style="font-size:1rem;font-family:monospace;font-weight:700" [style.color]="selectedLog()!.exitCode === 0 ? '#22c55e' : '#ef4444'">{{ selectedLog()!.exitCode ?? '—' }}</div>
          </div>
        </div>
        <div class="terminal-body">
          @for (line of selectedLog()!.output || []; track $index) {
            <span [style.color]="line.type === 'stderr' ? '#ff6b6b' : '#cdd6f4'">{{ line.text }}</span>
          }
        </div>
      }
    </p-dialog>
  `
})
export class LogsComponent implements OnInit {
  logs = signal<LogEntry[]>([]);
  selectedLog = signal<LogEntry | null>(null);
  detailVisible = false;

  constructor(private api: ApiService, private msg: MessageService) {}
  ngOnInit() { this.load(); }
  load() { this.api.getLogs().subscribe({ next: logs => this.logs.set(logs) }); }

  viewLog(log: LogEntry) {
    this.api.getLog(log.jobId).subscribe({ next: full => { this.selectedLog.set(full); this.detailVisible = true; } });
  }
  deleteLog(log: LogEntry) {
    this.api.deleteLog(log.jobId).subscribe({ next: () => { this.msg.add({ severity:'success', summary:'Supprimé', detail:log.jobId }); this.load(); } });
  }

  statusColor(s: string) {
    return s === 'success' ? '#22c55e' : (s === 'failed' || s === 'error') ? '#ef4444' : s === 'running' ? '#818cf8' : '#64748b';
  }
  statusLabel(s: string) {
    return ({ running:'En cours', success:'Succès', failed:'Échec', error:'Erreur', cancelled:'Annulé' } as any)[s] || s;
  }
  statusSeverity(s: string): any {
    if (s === 'success') return 'success';
    if (s === 'failed' || s === 'error') return 'danger';
    if (s === 'running') return 'info';
    return 'secondary';
  }
  formatDate(d: string) {
    return new Date(d).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' });
  }
  duration(start: string, end: string) {
    const s = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000);
    return s < 60 ? `${s}s` : `${Math.floor(s/60)}m ${s%60}s`;
  }
}
