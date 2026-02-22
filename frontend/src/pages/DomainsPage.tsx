import { useCallback, useEffect, useState } from 'react';
import { api, csrfHeaders } from '../api/client';
import { useAuth } from '../contexts/auth';
import { useRefreshListener } from '../hooks/useRefreshListener';

type Domain = { domain: string; description: string; managed: boolean };

export function DomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [accountCounts, setAccountCounts] = useState<Record<string, number>>({});
  const [aliasCounts, setAliasCounts] = useState<Record<string, number>>({});
  const [domain, setDomain] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const csrf = useAuth((s) => s.csrfToken);

  const load = useCallback(() => {
    api.get('/dms/domains').then((r) => setDomains(r.data.domains)).catch(() => undefined);
    api.get('/dms/accounts').then((r) => {
      const counts: Record<string, number> = {};
      for (const acc of (r.data.accounts ?? [])) {
        const d = acc.email?.split('@')[1];
        if (d) counts[d] = (counts[d] ?? 0) + 1;
      }
      setAccountCounts(counts);
    }).catch(() => undefined);
    api.get('/dms/aliases').then((r) => {
      const counts: Record<string, number> = {};
      for (const entry of (r.data.aliases ?? [])) {
        const parts = (entry as string).trim().split(/\s+/).filter(Boolean);
        const offset = parts[0] === '*' ? 1 : 0;
        const aliasAddr = parts[offset] ?? '';
        const d = aliasAddr.split('@')[1];
        if (d) counts[d] = (counts[d] ?? 0) + 1;
      }
      setAliasCounts(counts);
    }).catch(() => undefined);
  }, []);

  useEffect(() => { load(); }, [load]);
  useRefreshListener(load);

  const create = async () => {
    setError('');
    if (!domain.trim()) { setError('Domain name is required'); return; }
    try {
      await api.post('/dms/domains', { domain: domain.trim(), description }, { headers: csrfHeaders(csrf) });
      setDomain('');
      setDescription('');
      void load();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to add domain');
    }
  };

  const remove = async (d: string) => {
    if (!confirm(`Remove managed domain "${d}"?`)) return;
    try {
      await api.delete('/dms/domains', { data: { domain: d }, headers: csrfHeaders(csrf) });
      void load();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to remove domain');
    }
  };

  return (
    <div className="panel">
      <h1>🌐 Domains</h1>

      <div className="row" style={{ marginBottom: '.5rem' }}>
        <input
          placeholder="domain (e.g. example.com)"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          style={{ flex: 1 }}
        />
        <input
          placeholder="description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ flex: 1 }}
        />
        <button onClick={create}>➕ Add</button>
      </div>
      {error && <p style={{ color: 'var(--color-warn, #f59e0b)' }}>{error}</p>}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={{ textAlign: 'left', padding: '.4rem .5rem' }}>Domain</th>
            <th style={{ textAlign: 'left', padding: '.4rem .5rem' }}>Description</th>
            <th style={{ textAlign: 'left', padding: '.4rem .5rem' }}>Source</th>
            <th style={{ textAlign: 'right', padding: '.4rem .5rem' }}>Accounts</th>
            <th style={{ textAlign: 'right', padding: '.4rem .5rem' }}>Aliases</th>
            <th style={{ textAlign: 'right', padding: '.4rem .5rem' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {domains.map((d) => (
            <tr key={d.domain} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '.4rem .5rem', fontWeight: 500 }}>{d.domain}</td>
              <td style={{ padding: '.4rem .5rem', opacity: .75, fontSize: '.85rem' }}>{d.description}</td>
              <td style={{ padding: '.4rem .5rem', fontSize: '.8rem', opacity: .7 }}>
                {d.managed ? '🗃 managed' : '📬 auto-detected'}
              </td>
              <td style={{ padding: '.4rem .5rem', textAlign: 'right', fontSize: '.85rem' }}>
                {accountCounts[d.domain] ?? 0}
              </td>
              <td style={{ padding: '.4rem .5rem', textAlign: 'right', fontSize: '.85rem' }}>
                {aliasCounts[d.domain] ?? 0}
              </td>
              <td style={{ padding: '.4rem .5rem', whiteSpace: 'nowrap', textAlign: 'right' }}>
                {d.managed && (
                  <button
                    onClick={() => remove(d.domain)}
                    title="Remove domain"
                    style={{ color: '#ef4444' }}
                  >🗑</button>
                )}
              </td>
            </tr>
          ))}
          {domains.length === 0 && (
            <tr><td colSpan={6} style={{ padding: '.75rem .5rem', opacity: .5 }}>No domains found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

