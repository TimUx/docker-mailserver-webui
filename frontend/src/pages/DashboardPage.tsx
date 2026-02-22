import { useCallback, useEffect, useState } from 'react';
import { api, csrfHeaders } from '../api/client';
import { useAuth } from '../contexts/auth';
import { useRefreshListener } from '../hooks/useRefreshListener';

type ServiceInfo = { status: string; message: string; container: string; dashboard_url?: string };

const KNOWN_SERVICES: { key: string; icon: string; label: string }[] = [
  { key: 'rspamd', icon: '🛡️', label: 'Rspamd – Spam Filter' },
  { key: 'redis',  icon: '⚡',  label: 'Redis – Cache' },
  { key: 'clamav', icon: '🦠', label: 'ClamAV – Virus Scanner' },
];

const FALLBACK_SERVICE: ServiceInfo = { status: 'unknown', message: 'No data available', container: '' };

function statusColor(status: string): string {
  if (status === 'running') return 'var(--color-ok, #22c55e)';
  if (status === 'unknown') return 'var(--color-muted, #94a3b8)';
  return 'var(--color-warn, #f59e0b)';
}

export function DashboardPage() {
  const [stats, setStats] = useState<Record<string, any> | null>(null);
  const csrf = useAuth((s) => s.csrfToken);

  const load = useCallback(() => {
    api.get('/dashboard').then((r) => setStats(r.data)).catch(() => setStats({}));
  }, []);

  useEffect(() => { load(); }, [load]);
  useRefreshListener(load);

  const restart = async (name: string) => {
    await api.post(`/integrations/${name}/restart`, {}, { headers: csrfHeaders(csrf) });
    void load();
  };

  const services: Record<string, ServiceInfo> = stats?.security_services ?? {};
  const mailserver: ServiceInfo = stats?.mailserver ?? FALLBACK_SERVICE;

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

        {/* Mail-server card – always visible */}
        <div className="stat-card" style={{ textAlign: 'left' }}>
          <div style={{ fontSize: '1.4rem', marginBottom: '.4rem' }}>📮 docker-mailserver</div>
          <div style={{ marginBottom: '.25rem' }}>
            Status:{' '}
            <strong style={{ color: statusColor(stats === null ? 'unknown' : mailserver.status) }}>
              {stats === null ? '…' : mailserver.status}
            </strong>
          </div>
          {stats !== null && mailserver.message && (
            <small style={{ display: 'block', opacity: 0.8 }}>{mailserver.message}</small>
          )}
        </div>

        {/* Security service cards – always visible */}
        {KNOWN_SERVICES.map(({ key, icon, label }) => {
          const value: ServiceInfo = services[key] ?? FALLBACK_SERVICE;
          return (
            <div key={key} className="stat-card" style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '1.4rem', marginBottom: '.4rem' }}>{icon} {label}</div>
              <div style={{ marginBottom: '.25rem' }}>
                Status:{' '}
                <strong style={{ color: statusColor(stats === null ? 'unknown' : value.status) }}>
                  {stats === null ? '…' : value.status}
                </strong>
              </div>
              {stats !== null && value.message && (
                <small style={{ display: 'block', opacity: 0.8, marginBottom: '.5rem' }}>{value.message}</small>
              )}
              {stats !== null && (
                <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginTop: '.5rem' }}>
                  <button onClick={() => restart(key)}>↺ Restart</button>
                  {value.dashboard_url && (
                    <a href={value.dashboard_url} target="_blank" rel="noreferrer" className="button-link">
                      📊 Open Dashboard ↗
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p>Last sync: <strong>{stats ? String(stats.last_sync_status ?? '-') : '…'}</strong></p>
    </div>
  );
}
