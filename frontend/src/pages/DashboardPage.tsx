import { useEffect, useState } from 'react';
import { api } from '../api/client';

const serviceIcons: Record<string, string> = {
  rspamd: '🛡️',
  redis: '⚡',
  clamav: '🦠',
};

export function DashboardPage() {
  const [stats, setStats] = useState<Record<string, any> | null>(null);
  useEffect(() => {
    api.get('/dashboard').then((r) => setStats(r.data)).catch(() => setStats({}));
  }, []);

  const integrations: Record<string, { status: string; message: string }> = stats?.integrations ?? {};

  return (
    <div className="panel">
      <h1>📊 Dashboard</h1>
      <p>System health: <strong>{stats ? String(stats.system_health ?? '-') : '…'}</strong></p>
      <div className="stats-grid">
        <div className="stat-card">🌐 Domains<strong>{stats ? (stats.domains ?? 0) : '…'}</strong></div>
        <div className="stat-card">👥 Accounts<strong>{stats ? (stats.accounts ?? 0) : '…'}</strong></div>
        <div className="stat-card">🔀 Aliases<strong>{stats ? (stats.aliases ?? 0) : '…'}</strong></div>
        <div className="stat-card">📬 Sync Jobs<strong>{stats ? (stats.active_sync_jobs ?? 0) : '…'}</strong></div>
      </div>
      <p>Letzter Sync: <strong>{stats ? String(stats.last_sync_status ?? '-') : '…'}</strong></p>
      <h2>🛡️ Security Stack</h2>
      <div className="stats-grid">
        {Object.entries(integrations).map(([name, value]) => (
          <div key={name} className="stat-card">
            {serviceIcons[name] ?? '🔧'} {name}
            <strong style={{ color: value.status === 'running' ? 'var(--color-ok, #22c55e)' : 'var(--color-warn, #f59e0b)' }}>
              {value.status}
            </strong>
            <small style={{ display: 'block', marginTop: '.2rem', opacity: .8 }}>{value.message}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
