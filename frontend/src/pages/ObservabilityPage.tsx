import { useCallback, useEffect, useState } from 'react';
import { api, csrfHeaders } from '../api/client';
import { useAuth } from '../contexts/auth';
import { useRefreshListener } from '../hooks/useRefreshListener';

type ServiceInfo = { status: string; message: string; container: string; dashboard_url?: string };

type RspamdStat = {
  scanned?: number;
  spam_count?: number;
  ham_count?: number;
  connections?: number;
  uptime?: number;
  read_only?: boolean;
  version?: string;
  error?: string;
};

type ObservabilityData = {
  services: Record<string, ServiceInfo>;
  rspamd: {
    stat?: RspamdStat;
    actions?: Record<string, number>;
    symbols?: unknown;
    error?: string;
  };
};

function statusColor(status: string): string {
  if (status === 'running') return 'var(--color-ok, #22c55e)';
  if (status === 'unknown') return 'var(--color-muted, #94a3b8)';
  return 'var(--color-warn, #f59e0b)';
}

const SERVICE_ICONS: Record<string, string> = {
  rspamd: '🛡️',
  redis: '⚡',
  clamav: '🦠',
  mailserver: '📮',
};

const SERVICE_LABELS: Record<string, string> = {
  rspamd: 'Rspamd – Spam Filter',
  redis: 'Redis – Cache',
  clamav: 'ClamAV – Virus Scanner',
  mailserver: 'docker-mailserver',
};

export function ObservabilityPage() {
  const [data, setData] = useState<ObservabilityData | null>(null);
  const csrf = useAuth((s) => s.csrfToken);

  const load = useCallback(() => {
    api.get('/observability').then((r) => setData(r.data)).catch(() => undefined);
  }, []);

  useEffect(() => { load(); }, [load]);
  useRefreshListener(load);

  const restart = async (name: string) => {
    await api.post(`/integrations/${name}/restart`, {}, { headers: csrfHeaders(csrf) });
    void load();
  };

  const stat = data?.rspamd?.stat;
  const actions = data?.rspamd?.actions;

  return (
    <div className="panel">
      <h1>📈 Observability</h1>
      <p>Monitoring and statistics for your mail stack services.</p>

      <h2>Service Status</h2>
      <div className="stats-grid">
        {data === null || data === undefined
          ? ['rspamd', 'redis', 'clamav', 'mailserver'].map((k) => (
              <div key={k} className="stat-card">
                {SERVICE_ICONS[k]} {SERVICE_LABELS[k]}<strong>…</strong>
              </div>
            ))
          : Object.entries(data.services ?? {}).map(([name, svc]) => (
              <div key={name} className="stat-card" style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '1.3rem', marginBottom: '.3rem' }}>
                  {SERVICE_ICONS[name] ?? '🔧'} {SERVICE_LABELS[name] ?? name}
                </div>
                <div style={{ marginBottom: '.25rem' }}>
                  Status:{' '}
                  <strong style={{ color: statusColor(svc.status) }}>{svc.status}</strong>
                </div>
                {svc.message && (
                  <small style={{ display: 'block', opacity: .75, marginBottom: '.4rem' }}>
                    {svc.message}
                  </small>
                )}
                <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginTop: '.4rem' }}>
                  {name !== 'mailserver' && (
                    <button onClick={() => restart(name)}>↺ Restart</button>
                  )}
                  {svc.dashboard_url && (
                    <a href={svc.dashboard_url} target="_blank" rel="noreferrer" className="button-link">
                      📊 Dashboard ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
      </div>

      {/* Rspamd Stats */}
      <h2 style={{ marginTop: '1.5rem' }}>🛡️ Rspamd Statistics</h2>
      {data?.rspamd?.stat?.error ? (
        <p style={{ opacity: .7 }}>Rspamd controller unavailable: {data.rspamd.stat.error}</p>
      ) : stat ? (
        <>
          <div className="stats-grid" style={{ marginTop: '.5rem' }}>
            <div className="stat-card">
              📨 Scanned<strong>{stat.scanned ?? '—'}</strong>
            </div>
            <div className="stat-card">
              🚫 Spam<strong>{stat.spam_count ?? '—'}</strong>
            </div>
            <div className="stat-card">
              ✅ Ham<strong>{stat.ham_count ?? '—'}</strong>
            </div>
            <div className="stat-card">
              🔗 Connections<strong>{stat.connections ?? '—'}</strong>
            </div>
            {stat.uptime !== undefined && (
              <div className="stat-card">
                ⏱ Uptime<strong>{Math.round(stat.uptime / 3600)}h</strong>
              </div>
            )}
            {stat.version !== undefined && (
              <div className="stat-card">
                🔖 Version<strong>{stat.version}</strong>
              </div>
            )}
          </div>

          {actions && Object.keys(actions).length > 0 && (
            <>
              <h3 style={{ marginTop: '1rem' }}>Actions breakdown</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '.35rem .5rem' }}>Action</th>
                    <th style={{ textAlign: 'right', padding: '.35rem .5rem' }}>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(actions).map(([action, count]) => (
                    <tr key={action} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '.35rem .5rem', fontFamily: 'monospace', fontSize: '.85rem' }}>{action}</td>
                      <td style={{ padding: '.35rem .5rem', textAlign: 'right' }}>{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      ) : (
        <p style={{ opacity: .6 }}>{data === null || data === undefined ? 'Loading…' : 'No Rspamd statistics available.'}</p>
      )}
    </div>
  );
}
