import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { ApiService, Host } from '../../services/api.service';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, InputTextModule, DialogModule, ToastModule, TagModule],
  providers: [MessageService],
  styles: [`
    .card { background:#13161e; border:1px solid #2a3145; border-radius:12px; padding:1.5rem; margin-bottom:16px; }
    .host-head { display:flex; align-items:flex-start; justify-content:space-between; }
    .host-identity { display:flex; align-items:center; gap:12px; }
    .host-icon { width:44px; height:44px; background:rgba(99,102,241,0.12); border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .host-meta-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-top:16px; }
    .meta-box { background:#0d0f14; border-radius:8px; padding:10px 12px; }
    .meta-label { font-size:0.72rem; color:#475569; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px; }
    .meta-val { font-size:0.85rem; color:#e2e8f0; font-family:monospace; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .btn-row { display:flex; gap:8px; }
    .form-row { display:flex; flex-direction:column; gap:4px; margin-bottom:16px; }
    .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .empty { background:#13161e; border:1px dashed #2a3145; border-radius:12px; padding:4rem; text-align:center; }
    .raw-block { background:#13161e; border:1px solid #2a3145; border-radius:12px; padding:1.5rem; margin-top:16px; }
    .page-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:24px; }
  `],
  template: `
    <p-toast />

    <div class="page-header">
      <div>
        <h1 style="font-size:1.5rem;font-weight:700;color:#e2e8f0;margin:0 0 4px">Inventaire</h1>
        <p style="color:#64748b;font-size:0.875rem;margin:0">Gestion des hôtes VPS Ansible</p>
      </div>
      <p-button label="Ajouter un hôte" icon="pi pi-plus" (onClick)="openAddDialog()"></p-button>
    </div>

    @for (host of hosts(); track host.host) {
      <div class="card">
        <div class="host-head">
          <div class="host-identity">
            <div class="host-icon">
              <i class="pi pi-server" style="color:#818cf8;font-size:1.2rem"></i>
            </div>
            <div>
              <div style="font-size:1rem;font-weight:700;color:#e2e8f0;font-family:monospace;margin-bottom:4px">{{ host.host }}</div>
              <p-tag [value]="host.group" severity="info" size="small"></p-tag>
            </div>
          </div>
          <div class="btn-row">
            <p-button icon="pi pi-pencil" [outlined]="true" severity="secondary" size="small" (onClick)="editHost(host)"></p-button>
            <p-button icon="pi pi-trash" [outlined]="true" severity="danger" size="small" (onClick)="deleteHost(host)"></p-button>
          </div>
        </div>

        <div class="host-meta-grid">
          <div class="meta-box">
            <div class="meta-label">Utilisateur</div>
            <div class="meta-val">{{ host.vars['ansible_user'] || '—' }}</div>
          </div>
          <div class="meta-box">
            <div class="meta-label">Port SSH</div>
            <div class="meta-val">{{ host.vars['ansible_port'] || '22' }}</div>
          </div>
          <div class="meta-box" style="grid-column:span 2">
            <div class="meta-label">Clé SSH</div>
            <div class="meta-val">{{ host.vars['ansible_ssh_private_key_file'] || '—' }}</div>
          </div>
        </div>
      </div>
    }

    @if (hosts().length === 0) {
      <div class="empty">
        <i class="pi pi-server" style="font-size:2.5rem;color:#374151;display:block;margin-bottom:12px"></i>
        <div style="color:#64748b">Aucun hôte configuré</div>
      </div>
    }

    <!-- Raw inventory -->
    <div class="raw-block">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <h3 style="font-size:0.9rem;font-weight:600;color:#94a3b8;margin:0">inventory.ini brut</h3>
        <span style="font-size:0.75rem;color:#475569">Lecture seule</span>
      </div>
      <pre style="font-family:monospace;font-size:12px;color:#94a3b8;background:#060810;border-radius:6px;padding:1rem;margin:0;overflow-x:auto;border:1px solid #1a1e2a">{{ rawInventory() }}</pre>
    </div>

    <!-- Dialog -->
    <p-dialog [(visible)]="dialogVisible" [header]="dialogHeader" [modal]="true" [style]="{width:'560px'}">
      <div style="padding:8px 0">
        <div class="form-row">
          <label style="font-size:0.85rem;color:#94a3b8;font-weight:500">Groupe</label>
          <input pInputText [(ngModel)]="form.group" placeholder="vps" style="width:100%" />
        </div>
        <div class="form-row">
          <label style="font-size:0.85rem;color:#94a3b8;font-weight:500">Adresse IP / Hostname</label>
          <input pInputText [(ngModel)]="form.host" placeholder="192.168.1.100" style="width:100%" />
        </div>
        <div class="form-grid">
          <div class="form-row">
            <label style="font-size:0.85rem;color:#94a3b8;font-weight:500">Utilisateur SSH</label>
            <input pInputText [(ngModel)]="form.ansible_user" placeholder="deploy" style="width:100%" />
          </div>
          <div class="form-row">
            <label style="font-size:0.85rem;color:#94a3b8;font-weight:500">Port SSH</label>
            <input pInputText [(ngModel)]="form.ansible_port" placeholder="22" style="width:100%" />
          </div>
        </div>
        <div class="form-row">
          <label style="font-size:0.85rem;color:#94a3b8;font-weight:500">Clé SSH privée</label>
          <input pInputText [(ngModel)]="form.ansible_ssh_private_key_file" placeholder="~/.ssh/id_ed25519" style="width:100%" />
        </div>
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Annuler" severity="secondary" [outlined]="true" (onClick)="dialogVisible=false"></p-button>
        <p-button [label]="editingHost ? 'Sauvegarder' : 'Ajouter'" icon="pi pi-check" (onClick)="saveHost()" />
      </ng-template>
    </p-dialog>
  `
})
export class InventoryComponent implements OnInit {
  hosts = signal<Host[]>([]);
  rawInventory = signal('');
  dialogVisible = false;
  dialogHeader = 'Ajouter un hôte';
  editingHost: Host | null = null;
  form = { group:'vps', host:'', ansible_user:'deploy', ansible_port:'1024', ansible_ssh_private_key_file:'~/.ssh/id_ed25519' };

  constructor(private api: ApiService, private msg: MessageService) {}
  ngOnInit() { this.load(); }

  load() {
    this.api.getInventory().subscribe({
      next: ({ hosts, raw }) => { this.hosts.set(hosts); this.rawInventory.set(raw); },
      error: () => this.msg.add({ severity:'error', summary:'Erreur', detail:"Impossible de charger l'inventaire" })
    });
  }

  openAddDialog() {
    this.editingHost = null;
    this.dialogHeader = 'Ajouter un hôte';
    this.form = { group:'vps', host:'', ansible_user:'deploy', ansible_port:'1024', ansible_ssh_private_key_file:'~/.ssh/id_ed25519' };
    this.dialogVisible = true;
  }

  editHost(host: Host) {
    this.editingHost = host;
    this.dialogHeader = 'Modifier un hôte';
    this.form = {
      group: host.group, host: host.host,
      ansible_user: host.vars['ansible_user'] || 'deploy',
      ansible_port: host.vars['ansible_port'] || '22',
      ansible_ssh_private_key_file: host.vars['ansible_ssh_private_key_file'] || '~/.ssh/id_ed25519'
    };
    this.dialogVisible = true;
  }

  saveHost() {
    const newHost: Host = {
      group: this.form.group, host: this.form.host,
      vars: { ansible_user: this.form.ansible_user, ansible_port: this.form.ansible_port, ansible_ssh_private_key_file: this.form.ansible_ssh_private_key_file }
    };
    let updated = [...this.hosts()];
    if (this.editingHost) {
      const idx = updated.findIndex(h => h.host === this.editingHost!.host);
      if (idx >= 0) updated[idx] = newHost; else updated.push(newHost);
    } else { updated.push(newHost); }
    this.api.saveInventory(updated).subscribe({
      next: () => { this.dialogVisible=false; this.msg.add({ severity:'success', summary:'Sauvegardé', detail:'Inventaire mis à jour' }); this.load(); },
      error: () => this.msg.add({ severity:'error', summary:'Erreur', detail:'Sauvegarde échouée' })
    });
  }

  deleteHost(host: Host) {
    this.api.saveInventory(this.hosts().filter(h => h.host !== host.host)).subscribe({
      next: () => { this.msg.add({ severity:'success', summary:'Supprimé', detail: host.host }); this.load(); }
    });
  }
}
