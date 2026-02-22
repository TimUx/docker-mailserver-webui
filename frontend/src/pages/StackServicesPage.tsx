import { useEffect, useState } from 'react';
import { api, csrfHeaders } from '../api/client';
import { useAuth } from '../contexts/auth';

type ServiceStatus = Record<
  string,
  { status: string; message: string; container: string; dashboard_url?: string }
>;

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

export function StackServicesPage() {
  const [services, setServices] = useState<ServiceStatus>({});
  const csrf = useAuth((s) => s.csrfToken);

  const load = () =>
    api
      .get('/integrations/status')
      .then((r) => setServices(r.data))
      .catch(() => undefined);

  useEffect(() => {
    void load();
  }, []);

  const restart = async (name: string) => {
    await api.post(`/integrations/${name}/restart`, {}, { headers: csrfHeaders(csrf) });
    load();
  };

  return (
    <div className="panel">
      <h1>🛡️ Security Stack</h1>
      <p>Container status, metrics and administration for your extended mail security stack.</p>
      <div className="stats-grid">
        {Object.entries(services).map(([name, value]) => (
          <div key={name} className="stat-card" style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '1.4rem', marginBottom: '.4rem' }}>
              {serviceIcons[name] ?? '🔧'} {serviceLabels[name] ?? name}
            </div>
            <div style={{ marginBottom: '.25rem' }}>
              Status:{' '}
              <strong
                style={{
                  color:
                    value.status === 'running'
                      ? 'var(--color-ok, #22c55e)'
                      : 'var(--color-warn, #f59e0b)',
                }}
              >
                {value.status}
              </strong>
            </div>
            <small style={{ display: 'block', opacity: 0.8, marginBottom: '.5rem' }}>
              {value.message}
            </small>
            <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginTop: '.5rem' }}>
              <button onClick={() => restart(name)}>↺ Restart</button>
              {value.dashboard_url && (
                <a
                  href={value.dashboard_url}
                  target="_blank"
                  rel="noreferrer"
                  className="button-link"
                >
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
