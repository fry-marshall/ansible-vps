import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export const API_URL = 'http://localhost:3001/api';

export interface Host {
  group: string;
  host: string;
  vars: Record<string, string>;
}

export interface VarsConfig {
  deploy_user: string;
  ssh_port: number;
  allowed_ports: string[];
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  alert_email: string;
  deploy_user_pubkey: string;
  [key: string]: any;
}

export interface VaultConfig {
  vault_smtp_user: string;
  vault_smtp_password: string;
  vault_alert_email: string;
  vault_deploy_user_pubkey: string;
  [key: string]: any;
}

export interface LogEntry {
  jobId: string;
  command: string;
  status: 'running' | 'success' | 'failed' | 'error';
  startedAt: string;
  finishedAt?: string;
  exitCode?: number;
  output?: { type: string; text: string; ts: number }[];
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  // Status
  getAnsibleStatus(): Observable<{ ok: boolean; version: string }> {
    return this.http.get<any>(`${API_URL}/status/ansible`);
  }
  getProjectStatus(): Observable<any> {
    return this.http.get<any>(`${API_URL}/status/project`);
  }

  // Inventory
  getInventory(): Observable<{ hosts: Host[]; raw: string }> {
    return this.http.get<any>(`${API_URL}/inventory`);
  }
  saveInventory(hosts: Host[]): Observable<any> {
    return this.http.put(`${API_URL}/inventory`, { hosts });
  }

  // Vars
  getVars(): Observable<{ data: VarsConfig; raw: string }> {
    return this.http.get<any>(`${API_URL}/config/vars`);
  }
  saveVars(data: Partial<VarsConfig>): Observable<any> {
    return this.http.put(`${API_URL}/config/vars`, { data });
  }

  // Vault
  getVaultStatus(): Observable<{ exists: boolean; encrypted: boolean }> {
    return this.http.get<any>(`${API_URL}/config/vault/status`);
  }
  decryptVault(password: string): Observable<{ data: VaultConfig }> {
    return this.http.post<any>(`${API_URL}/config/vault/decrypt`, { password });
  }
  saveVault(data: Partial<VaultConfig>, password: string): Observable<any> {
    return this.http.post(`${API_URL}/config/vault/save`, { data, password });
  }
  getVaultExample(): Observable<{ data: VaultConfig }> {
    return this.http.get<any>(`${API_URL}/config/vault/example`);
  }

  // Logs
  getLogs(): Observable<LogEntry[]> {
    return this.http.get<LogEntry[]>(`${API_URL}/deploy/logs`);
  }
  getLog(jobId: string): Observable<LogEntry> {
    return this.http.get<LogEntry>(`${API_URL}/deploy/logs/${jobId}`);
  }
  deleteLog(jobId: string): Observable<any> {
    return this.http.delete(`${API_URL}/deploy/logs/${jobId}`);
  }
}
