import { useEffect, useState } from 'react';
import { api } from '../api/client';

const demoStats = {
  system_health: 'healthy',
  domains: 4,
  accounts: 12,
  aliases: 9,
  active_sync_jobs: 2,
  last_sync_status: 'ok',
  integrations: {
    rspamd: { status: 'running', message: 'Spam-Filter aktiv' },
    redis: { status: 'running', message: 'Cache verfügbar' },
    clamav: { status: 'running', message: 'Signaturen aktuell' }
  }
};

export function DashboardPage() {
  const [stats, setStats] = useState<Record<string, any>>(demoStats);
  useEffect(() => {
    api.get('/dashboard').then((r) => setStats(r.data)).catch(() => setStats(demoStats));
  }, []);

  const integrations = stats.integrations ?? {};

  return <div className="panel"><h1>📊 Dashboard</h1><p>System health: <strong>{String(stats.system_health ?? '-')}</strong></p><div className='stats-grid'><div className='stat-card'>🌐 Domains<strong>{stats.domains ?? '-'}</strong></div><div className='stat-card'>👥 Accounts<strong>{stats.accounts ?? '-'}</strong></div><div className='stat-card'>🔀 Aliases<strong>{stats.aliases ?? '-'}</strong></div><div className='stat-card'>📬 Sync Jobs<strong>{stats.active_sync_jobs ?? '-'}</strong></div></div><p>Letzter Sync: <strong>{String(stats.last_sync_status ?? '-')}</strong></p><h2>🛡️ Security Stack</h2><ul>{Object.entries(integrations).map(([name, value]: any) => <li key={name}>{name}: {value.status} - {value.message}</li>)}</ul></div>;
}
