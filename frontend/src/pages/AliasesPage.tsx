import { useCallback, useEffect, useState } from 'react';
import { api, csrfHeaders } from '../api/client';
import { useAuth } from '../contexts/auth';
import { useRefreshListener } from '../hooks/useRefreshListener';

export function AliasesPage() {
  const [aliases, setAliases] = useState<string[]>([]);
  const [alias, setAlias] = useState('');
  const [destination, setDestination] = useState('');
  const [error, setError] = useState('');
  const csrf = useAuth((s) => s.csrfToken);

  const load = useCallback(() => {
    api.get('/dms/aliases').then((r) => setAliases(r.data.aliases)).catch(() => undefined);
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

  const remove = async (entry: string) => {
    const parts = entry.split(/\s+/).filter(Boolean);
    if (parts.length < 2) {
      setError(`Cannot parse alias entry: "${entry}"`);
      return;
    }
    const aliasAddr = parts[0];
    const destAddr = parts[1];
    if (!confirm(`Delete alias ${aliasAddr} → ${destAddr}?`)) return;
    try {
      await api.delete('/dms/aliases', { data: { alias: aliasAddr, destination: destAddr }, headers: csrfHeaders(csrf) });
      load();
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
            <th style={{ textAlign: 'left', padding: '.4rem .5rem' }}>Alias entry</th>
            <th style={{ padding: '.4rem .5rem' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {aliases.map((a) => (
            <tr key={a} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '.4rem .5rem', fontFamily: 'monospace', fontSize: '.9rem' }}>{a}</td>
              <td style={{ padding: '.4rem .5rem' }}>
                <button onClick={() => remove(a)} title="Delete alias" style={{ color: '#ef4444' }}>🗑</button>
              </td>
            </tr>
          ))}
          {aliases.length === 0 && (
            <tr><td colSpan={2} style={{ padding: '.75rem .5rem', opacity: .5 }}>No aliases found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
