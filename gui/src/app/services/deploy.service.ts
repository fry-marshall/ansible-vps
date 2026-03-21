import { Injectable, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';

export interface OutputLine {
  type: 'stdout' | 'stderr' | 'system';
  text: string;
  ts: number;
}

export type JobStatus = 'idle' | 'running' | 'success' | 'failed' | 'error' | 'cancelled';

@Injectable({ providedIn: 'root' })
export class DeployService {
  private socket: Socket;

  status = signal<JobStatus>('idle');
  output = signal<OutputLine[]>([]);
  currentJobId = signal<string | null>(null);
  startedAt = signal<string | null>(null);

  constructor() {
    this.socket = io('http://localhost:3001');

    this.socket.on('job:start', ({ jobId, startedAt }) => {
      this.currentJobId.set(jobId);
      this.startedAt.set(startedAt);
      this.status.set('running');
    });

    this.socket.on('job:output', ({ type, text }) => {
      this.output.update(lines => [...lines, { type, text, ts: Date.now() }]);
    });

    this.socket.on('job:done', ({ exitCode, status }) => {
      this.status.set(status === 'success' ? 'success' : 'failed');
      this.addSystem(`\n--- Job finished with exit code ${exitCode} ---`);
    });

    this.socket.on('job:error', ({ error }) => {
      this.status.set('error');
      this.addSystem(`\n--- Job error: ${error} ---`);
    });

    this.socket.on('job:cancelled', () => {
      this.status.set('cancelled');
      this.addSystem('\n--- Job cancelled ---');
    });
  }

  private addSystem(text: string) {
    this.output.update(lines => [...lines, { type: 'system', text, ts: Date.now() }]);
  }

  runDeploy(opts: { tags?: string[]; vaultPassword?: string; checkMode?: boolean }) {
    const jobId = `deploy-${Date.now()}`;
    this.output.set([]);
    this.status.set('idle');
    this.socket.emit('deploy:run', { jobId, ...opts });
  }

  runPing() {
    const jobId = `ping-${Date.now()}`;
    this.output.set([]);
    this.status.set('idle');
    this.socket.emit('deploy:ping', { jobId });
  }

  cancel() {
    const jobId = this.currentJobId();
    if (jobId) this.socket.emit('deploy:cancel', { jobId });
  }

  reset() {
    this.status.set('idle');
    this.output.set([]);
    this.currentJobId.set(null);
    this.startedAt.set(null);
  }
}
