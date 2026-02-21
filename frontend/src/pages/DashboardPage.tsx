import { useEffect, useState } from 'react';
import { api } from '../api/client';

export function DashboardPage() {
  const [stats, setStats] = useState<Record<string, any>>({});
  useEffect(() => {
    api.get('/dashboard').then((r) => setStats(r.data));
  }, []);

  const integrations = stats.integrations ?? {};

  return <div className="panel"><h1>Dashboard</h1><p>System health: <strong>{String(stats.system_health ?? '-')}</strong></p><pre>{JSON.stringify({domains: stats.domains, accounts: stats.accounts, aliases: stats.aliases, active_sync_jobs: stats.active_sync_jobs, last_sync_status: stats.last_sync_status}, null, 2)}</pre><h2>Security Stack</h2><ul>{Object.entries(integrations).map(([name, value]: any) => <li key={name}>{name}: {value.status} - {value.message}</li>)}</ul></div>;
}
