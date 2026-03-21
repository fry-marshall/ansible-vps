import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    path: 'inventory',
    loadComponent: () => import('./pages/inventory/inventory.component').then(m => m.InventoryComponent)
  },
  {
    path: 'config',
    loadComponent: () => import('./pages/config/config.component').then(m => m.ConfigComponent)
  },
  {
    path: 'deploy',
    loadComponent: () => import('./pages/deploy/deploy.component').then(m => m.DeployComponent)
  },
  {
    path: 'logs',
    loadComponent: () => import('./pages/logs/logs.component').then(m => m.LogsComponent)
  },
  { path: '**', redirectTo: 'dashboard' }
];
