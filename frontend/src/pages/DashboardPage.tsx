import { useEffect, useState } from 'react';
import { api, csrfHeaders } from '../api/client';
import { useAuth } from '../contexts/auth';

type ServiceInfo = { status: string; message: string; container: string; dashboard_url?: string };

const serviceIcons: Record<string, string> = {
  rspamd: '🛡️',
  redis: '⚡',
  clamav: '🦠',
};

const serviceLabels: Record<string, string> = {
  rspamd: 'Rspamd – Spam Filter',
  redis: 'Redis – Cache',
  clamav: 'ClamAV – Virus Scanner',
};

export function DashboardPage() {
  const [stats, setStats] = useState<Record<string, any> | null>(null);
  const csrf = useAuth((s) => s.csrfToken);

  const load = () =>
    api.get('/dashboard').then((r) => setStats(r.data)).catch(() => setStats({}));

  useEffect(() => {
    void load();
  }, []);

  const restart = async (name: string) => {
    await api.post(`/integrations/${name}/restart`, {}, { headers: csrfHeaders(csrf) });
    void load();
  };

  const services: Record<string, ServiceInfo> = stats?.security_services ?? {};
  const mailserver: ServiceInfo | null = stats?.mailserver ?? null;

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
      </div>
      <p>Last sync: <strong>{stats ? String(stats.last_sync_status ?? '-') : '…'}</strong></p>

      <h2 style={{ marginTop: '1.25rem' }}>📮 Mail Server</h2>
      <div className="stats-grid">
        {mailserver ? (
          <div className="stat-card" style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '1.4rem', marginBottom: '.4rem' }}>📮 docker-mailserver</div>
            <div style={{ marginBottom: '.25rem' }}>
              Status:{' '}
              <strong style={{ color: mailserver.status === 'running' ? 'var(--color-ok, #22c55e)' : 'var(--color-warn, #f59e0b)' }}>
                {mailserver.status}
              </strong>
            </div>
            <small style={{ display: 'block', opacity: 0.8 }}>{mailserver.message}</small>
          </div>
        ) : (
          <div className="stat-card">…</div>
        )}
      </div>

      <h2 style={{ marginTop: '1.25rem' }}>🛡️ Security Stack</h2>
      <div className="stats-grid">
        {stats === null ? (
          <div className="stat-card">…</div>
        ) : Object.entries(services).map(([name, value]) => (
          <div key={name} className="stat-card" style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '1.4rem', marginBottom: '.4rem' }}>
              {serviceIcons[name] ?? '🔧'} {serviceLabels[name] ?? name}
            </div>
            <div style={{ marginBottom: '.25rem' }}>
              Status:{' '}
              <strong style={{ color: value.status === 'running' ? 'var(--color-ok, #22c55e)' : 'var(--color-warn, #f59e0b)' }}>
                {value.status}
              </strong>
            </div>
            <small style={{ display: 'block', opacity: 0.8, marginBottom: '.5rem' }}>{value.message}</small>
            <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginTop: '.5rem' }}>
              <button onClick={() => restart(name)}>↺ Restart</button>
              {value.dashboard_url && (
                <a href={value.dashboard_url} target="_blank" rel="noreferrer" className="button-link">
                  📊 Open Dashboard ↗
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
