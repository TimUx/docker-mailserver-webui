import { useCallback, useEffect, useState } from 'react';
import { api, csrfHeaders } from '../api/client';
import { useAuth } from '../contexts/auth';
import { useRefreshListener } from '../hooks/useRefreshListener';

type AliasEntry = { alias: string; destination: string; domain: string; raw: string };

function parseAlias(raw: string): AliasEntry {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  const alias = parts[0] ?? '';
  const destination = parts[1] ?? '';
  const domain = alias.includes('@') ? alias.split('@')[1] : '';
  return { alias, destination, domain, raw };
}

export function AliasesPage() {
  const [aliases, setAliases] = useState<AliasEntry[]>([]);
  const [alias, setAlias] = useState('');
  const [destination, setDestination] = useState('');
  const [error, setError] = useState('');
  const csrf = useAuth((s) => s.csrfToken);

  const load = useCallback(() => {
    api.get('/dms/aliases').then((r) => setAliases((r.data.aliases as string[]).map(parseAlias))).catch(() => undefined);
  }, []);

  useEffect(() => { load(); }, [load]);
  useRefreshListener(load);

  const create = async () => {
    setError('');
    try {
      await api.post('/dms/aliases', { alias, destination }, { headers: csrfHeaders(csrf) });
      setAlias('');
      setDestination('');
      void load();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to create alias');
    }
  };

  const remove = async (entry: AliasEntry) => {
    if (!entry.alias || !entry.destination) {
      setError(`Cannot parse alias entry: "${entry.raw}"`);
      return;
    }
    if (!confirm(`Delete alias ${entry.alias} → ${entry.destination}?`)) return;
    try {
      await api.delete('/dms/aliases', { data: { alias: entry.alias, destination: entry.destination }, headers: csrfHeaders(csrf) });
      void load();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to delete alias');
    }
  };

  return (
    <div className="panel">
      <h1>🔀 Aliases</h1>
      <div className="row" style={{ marginBottom: '.5rem' }}>
        <input placeholder="alias (from)" value={alias} onChange={(e) => setAlias(e.target.value)} style={{ flex: 1 }} />
        <input placeholder="destination (to)" value={destination} onChange={(e) => setDestination(e.target.value)} style={{ flex: 1 }} />
        <button onClick={create}>➕ Add</button>
      </div>
      {error && <p style={{ color: 'var(--color-warn, #f59e0b)' }}>{error}</p>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={{ textAlign: 'left', padding: '.4rem .5rem' }}>Alias</th>
            <th style={{ textAlign: 'left', padding: '.4rem .5rem' }}>Destination</th>
            <th style={{ textAlign: 'left', padding: '.4rem .5rem' }}>Domain</th>
            <th style={{ textAlign: 'right', padding: '.4rem .5rem' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {aliases.map((a) => (
            <tr key={a.raw} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '.4rem .5rem', fontFamily: 'monospace', fontSize: '.9rem' }}>{a.alias}</td>
              <td style={{ padding: '.4rem .5rem', fontFamily: 'monospace', fontSize: '.9rem' }}>{a.destination}</td>
              <td style={{ padding: '.4rem .5rem', fontSize: '.85rem', opacity: .75 }}>{a.domain}</td>
              <td style={{ padding: '.4rem .5rem', textAlign: 'right' }}>
                <button onClick={() => remove(a)} title="Delete alias" style={{ color: '#ef4444' }}>🗑</button>
              </td>
            </tr>
          ))}
          {aliases.length === 0 && (
            <tr><td colSpan={4} style={{ padding: '.75rem .5rem', opacity: .5 }}>No aliases found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
