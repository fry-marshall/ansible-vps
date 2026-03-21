import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';

interface NavItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  styles: [`
    .layout-root {
      display: flex;
      flex-direction: row;
      height: 100vh;
      overflow: hidden;
      background: #0d0f14;
    }
    .sidebar {
      width: 220px;
      min-width: 220px;
      background: #0b0d13;
      border-right: 1px solid #1a1e2a;
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
    }
    .sidebar-logo {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 20px;
      height: 64px;
      border-bottom: 1px solid #1a1e2a;
      flex-shrink: 0;
    }
    .logo-icon {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: rgba(99,102,241,0.15);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .sidebar-nav {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 12px;
      flex: 1;
    }
    .nav-label {
      font-size: 0.65rem;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      padding: 8px 12px 4px;
    }
    .sidebar-footer {
      padding: 16px;
    }
    .sidebar-footer-inner {
      background: #13161e;
      border: 1px solid #1a1e2a;
      border-radius: 8px;
      padding: 12px;
      font-size: 0.72rem;
      color: #475569;
    }
    .main-area {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
      overflow: hidden;
    }
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      height: 64px;
      border-bottom: 1px solid #1a1e2a;
      background: #0d0f14;
      flex-shrink: 0;
    }
    .page-content {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
      background: #0d0f14;
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.15s ease;
      color: #94a3b8;
      text-decoration: none;
      font-size: 0.875rem;
      font-weight: 500;
    }
    .nav-item:hover {
      background: #1a1e2a;
      color: #e2e8f0;
    }
    .nav-item.active {
      background: rgba(99,102,241,0.12);
      color: #818cf8;
    }
    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #22c55e;
      box-shadow: 0 0 6px #22c55e;
    }
  `],
  template: `
    <div class="layout-root">

      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="sidebar-logo">
          <div class="logo-icon">
            <i class="pi pi-server" style="color:#818cf8;font-size:1rem"></i>
          </div>
          <div>
            <div style="font-size:0.85rem;font-weight:700;color:#e2e8f0;line-height:1.2">VPS Control</div>
            <div style="font-size:0.7rem;color:#475569;line-height:1.2">ansible-vps-config</div>
          </div>
        </div>

        <nav class="sidebar-nav">
          <div class="nav-label">Navigation</div>
          @for (item of navItems; track item.route) {
            <a [routerLink]="item.route" routerLinkActive="active" class="nav-item">
              <i [class]="'pi ' + item.icon" style="font-size:1rem;width:18px;text-align:center"></i>
              {{ item.label }}
            </a>
          }
        </nav>

        <div class="sidebar-footer">
          <div class="sidebar-footer-inner">
            <div style="color:#6366f1;font-weight:600;margin-bottom:2px">ansible-vps-gui</div>
            <div>v1.0.0 — Angular 19</div>
          </div>
        </div>
      </aside>

      <!-- Main -->
      <div class="main-area">
        <header class="topbar">
          <div style="font-size:0.95rem;font-weight:600;color:#94a3b8">
            Infrastructure
            <span style="color:#475569;margin:0 6px">/</span>
            <span style="color:#e2e8f0">VPS Sécurisé</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;font-size:0.8rem;color:#475569">
            <div class="status-dot"></div>
            Backend connecté
          </div>
        </header>

        <main class="page-content">
          <router-outlet />
        </main>
      </div>
    </div>
  `
})
export class LayoutComponent {
  navItems: NavItem[] = [
    { label: 'Dashboard',     icon: 'pi-home',        route: '/dashboard' },
    { label: 'Inventaire',    icon: 'pi-sitemap',     route: '/inventory' },
    { label: 'Configuration', icon: 'pi-sliders-h',   route: '/config' },
    { label: 'Déployer',      icon: 'pi-play-circle', route: '/deploy' },
    { label: 'Historique',    icon: 'pi-history',     route: '/logs' },
  ];
}
