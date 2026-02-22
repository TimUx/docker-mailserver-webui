import { useEffect, useState } from 'react';
import { api } from '../api/client';

export function DashboardPage() {
  const [stats, setStats] = useState<Record<string, any> | null>(null);
  useEffect(() => {
    api.get('/dashboard').then((r) => setStats(r.data)).catch(() => setStats({}));
  }, []);

  const degraded: string[] = stats?.security_services_degraded ?? [];
  const running: number = stats?.security_services_running ?? 0;
  const total: number = stats?.security_services_total ?? 0;

  return (
    <div className="panel">
      <h1>📊 Dashboard</h1>
      <p>
        System health:{' '}
        <strong style={{ color: stats?.system_health === 'ok' ? 'var(--color-ok, #22c55e)' : 'var(--color-warn, #f59e0b)' }}>
          {stats ? String(stats.system_health ?? '-') : '…'}
        </strong>
      </p>
      <div className="stats-grid">
        <div className="stat-card">🌐 Domains<strong>{stats ? (stats.domains ?? 0) : '…'}</strong></div>
        <div className="stat-card">👥 Accounts<strong>{stats ? (stats.accounts ?? 0) : '…'}</strong></div>
        <div className="stat-card">🔀 Aliases<strong>{stats ? (stats.aliases ?? 0) : '…'}</strong></div>
        <div className="stat-card">📬 Sync Jobs<strong>{stats ? (stats.active_sync_jobs ?? 0) : '…'}</strong></div>
        <div className="stat-card">
          🛡️ Security Services
          <strong style={{ color: degraded.length === 0 ? 'var(--color-ok, #22c55e)' : 'var(--color-warn, #f59e0b)' }}>
            {stats ? `${running} / ${total} running` : '…'}
          </strong>
          {degraded.length > 0 && (
            <small style={{ display: 'block', marginTop: '.2rem', opacity: .8 }}>
              Degraded: {degraded.join(', ')}
            </small>
          )}
        </div>
      </div>
      <p>Last sync: <strong>{stats ? String(stats.last_sync_status ?? '-') : '…'}</strong></p>
    </div>
  );
}
