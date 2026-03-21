import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export const API_URL = 'http://localhost:3001/api';

export type HostStatus = 'new' | 'ssh-ok' | 'password-changed' | 'key-copied' | 'configured';

export interface Host {
  id: string;
  ip: string;
  label: string;
  rootPort: number;
  status: HostStatus;
  deployUser?: string;
  sshPort?: number;
  privateKeyPath?: string;
  lastDeployAt?: string;
  createdAt: string;
}

export interface SshKey {
  name: string;
  path: string;
  content: string;
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

  getHosts(): Observable<Host[]> { return this.http.get<Host[]>(`${API_URL}/hosts`); }
  addHost(data: { ip: string; label?: string; rootPort?: number }): Observable<Host> { return this.http.post<Host>(`${API_URL}/hosts`, data); }
  updateHost(id: string, data: Partial<Host>): Observable<Host> { return this.http.patch<Host>(`${API_URL}/hosts/${id}`, data); }
  deleteHost(id: string): Observable<any> { return this.http.delete(`${API_URL}/hosts/${id}`); }

  getSshKeys(): Observable<SshKey[]> { return this.http.get<SshKey[]>(`${API_URL}/ssh/keys`); }
  testSsh(data: any): Observable<any> { return this.http.post<any>(`${API_URL}/ssh/test`, data); }
  changePassword(data: any): Observable<any> { return this.http.post<any>(`${API_URL}/ssh/change-password`, data); }
  copyKey(data: any): Observable<any> { return this.http.post<any>(`${API_URL}/ssh/copy-key`, data); }
  verifyKey(data: any): Observable<any> { return this.http.post<any>(`${API_URL}/ssh/verify-key`, data); }

  getVars(): Observable<any> { return this.http.get<any>(`${API_URL}/config/vars`); }
  saveVars(data: any): Observable<any> { return this.http.put(`${API_URL}/config/vars`, { data }); }
  getVaultStatus(): Observable<any> { return this.http.get<any>(`${API_URL}/config/vault/status`); }
  decryptVault(password: string): Observable<any> { return this.http.post<any>(`${API_URL}/config/vault/decrypt`, { password }); }
  saveVault(data: any, password: string): Observable<any> { return this.http.post(`${API_URL}/config/vault/save`, { data, password }); }

  getLogs(): Observable<LogEntry[]> { return this.http.get<LogEntry[]>(`${API_URL}/deploy/logs`); }
  getLog(jobId: string): Observable<LogEntry> { return this.http.get<LogEntry>(`${API_URL}/deploy/logs/${jobId}`); }
  deleteLog(jobId: string): Observable<any> { return this.http.delete(`${API_URL}/deploy/logs/${jobId}`); }
}
