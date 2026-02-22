import { useEffect, useState } from 'react';
import { api } from '../api/client';

export function DomainsPage() {
  const [domains, setDomains] = useState<string[]>([]);
  useEffect(() => { api.get('/dms/domains').then((r) => setDomains(r.data.domains)).catch(() => undefined); }, []);
  return <div className="panel"><h1>🌐 Domains</h1><ul>{domains.map((d) => <li key={d}>{d}</li>)}</ul></div>;
}
