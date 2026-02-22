import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, csrfHeaders } from '../api/client';
import { useAuth } from '../contexts/auth';
import { useRefreshListener } from '../hooks/useRefreshListener';

type AliasEntry = { alias: string; destination: string; domain: string; raw: string };
type SortDir = 'asc' | 'desc';
type SortKey = 'alias' | 'destination' | 'domain' | 'note';

function parseAlias(raw: string): AliasEntry {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  // DMS format: "* alias@domain -> destination@domain"
  const offset = parts[0] === '*' ? 1 : 0;
  const alias = parts[offset] ?? '';
  const nextIdx = parts[offset + 1] === '->' ? offset + 2 : offset + 1;
  const destination = parts[nextIdx] ?? '';
  const domain = alias.includes('@') ? alias.split('@')[1] : '';
  return { alias, destination, domain, raw };
}

function sortIcon(key: SortKey, sortKey: SortKey, dir: SortDir) {
  if (key !== sortKey) return <span style={{ opacity: .3, fontSize: '.75rem' }}> ↕</span>;
  return <span style={{ fontSize: '.75rem' }}>{dir === 'asc' ? ' ▲' : ' ▼'}</span>;
}

export function AliasesPage() {
  const [aliases, setAliases] = useState<AliasEntry[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('alias');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [alias, setAlias] = useState('');
  const [destination, setDestination] = useState('');
  const [error, setError] = useState('');
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [editNote, setEditNote] = useState('');
  const csrf = useAuth((s) => s.csrfToken);

  const load = useCallback(() => {
    api.get('/dms/aliases').then((r) => {
      setAliases((r.data.aliases as string[]).map(parseAlias));
      setNotes(r.data.notes ?? {});
    }).catch(() => undefined);
  }, []);

  useEffect(() => { load(); }, [load]);
  useRefreshListener(load);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

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

  const startEditNote = (aliasAddr: string) => {
    setEditTarget(aliasAddr);
    setEditNote(notes[aliasAddr] ?? '');
    setError('');
  };

  const cancelEditNote = () => { setEditTarget(null); setEditNote(''); };

  const saveNote = async () => {
    if (!editTarget) return;
    try {
      await api.put('/dms/aliases/notes', { alias: editTarget, note: editNote }, { headers: csrfHeaders(csrf) });
      cancelEditNote();
      void load();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to save note');
    }
  };

  const visible = useMemo(() => {
    const q = filter.toLowerCase();
    const filtered = q
      ? aliases.filter((a) =>
          a.alias.toLowerCase().includes(q) ||
          a.destination.toLowerCase().includes(q) ||
          a.domain.toLowerCase().includes(q) ||
          (notes[a.alias] ?? '').toLowerCase().includes(q),
        )
      : aliases;
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'alias') cmp = a.alias.localeCompare(b.alias);
      else if (sortKey === 'destination') cmp = a.destination.localeCompare(b.destination);
      else if (sortKey === 'domain') cmp = a.domain.localeCompare(b.domain);
      else if (sortKey === 'note') cmp = (notes[a.alias] ?? '').localeCompare(notes[b.alias] ?? '');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [aliases, notes, filter, sortKey, sortDir]);

  const thStyle = (key: SortKey, align: 'left' | 'right' = 'left'): React.CSSProperties => ({
    textAlign: align, padding: '.4rem .5rem', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
  });

  return (
    <div className="panel">
      <h1>🔀 Aliases</h1>
      <div className="row" style={{ marginBottom: '.5rem' }}>
        <input placeholder="alias (from)" value={alias} onChange={(e) => setAlias(e.target.value)} style={{ flex: 1 }} />
        <input placeholder="destination (to)" value={destination} onChange={(e) => setDestination(e.target.value)} style={{ flex: 1 }} />
        <button onClick={create}>➕ Add</button>
      </div>
      {error && <p style={{ color: 'var(--color-warn, #f59e0b)' }}>{error}</p>}

      {editTarget && (
        <div className="panel" style={{ marginBottom: '1rem' }}>
          <strong>📝 Edit Note for {editTarget}</strong>
          <div className="row" style={{ marginTop: '.5rem' }}>
            <input placeholder="Note / comment" value={editNote} onChange={(e) => setEditNote(e.target.value)} style={{ flex: 1 }} />
            <button onClick={saveNote}>💾 Save</button>
            <button onClick={cancelEditNote}>✖ Cancel</button>
          </div>
        </div>
      )}

      <div className="row" style={{ marginBottom: '.5rem' }}>
        <input
          placeholder="🔍 Filter aliases…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ flex: 1 }}
        />
        {filter && <button onClick={() => setFilter('')}>✖ Clear</button>}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={thStyle('alias')} onClick={() => toggleSort('alias')}>Alias{sortIcon('alias', sortKey, sortDir)}</th>
            <th style={thStyle('destination')} onClick={() => toggleSort('destination')}>Destination{sortIcon('destination', sortKey, sortDir)}</th>
            <th style={thStyle('domain')} onClick={() => toggleSort('domain')}>Domain{sortIcon('domain', sortKey, sortDir)}</th>
            <th style={thStyle('note')} onClick={() => toggleSort('note')}>Note{sortIcon('note', sortKey, sortDir)}</th>
            <th style={{ textAlign: 'right', padding: '.4rem .5rem' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((a) => (
            <tr key={a.raw} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '.4rem .5rem', fontFamily: 'monospace', fontSize: '.9rem' }}>{a.alias}</td>
              <td style={{ padding: '.4rem .5rem', fontFamily: 'monospace', fontSize: '.9rem' }}>{a.destination}</td>
              <td style={{ padding: '.4rem .5rem', fontSize: '.85rem', opacity: .75 }}>{a.domain}</td>
              <td style={{ padding: '.4rem .5rem', fontSize: '.85rem', opacity: .75 }}>{notes[a.alias] ?? ''}</td>
              <td style={{ padding: '.4rem .5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                <button onClick={() => startEditNote(a.alias)} title="Edit note">📝</button>
                <button onClick={() => remove(a)} title="Delete alias" style={{ color: '#ef4444' }}>🗑</button>
              </td>
            </tr>
          ))}
          {visible.length === 0 && (
            <tr><td colSpan={5} style={{ padding: '.75rem .5rem', opacity: .5 }}>
              {aliases.length === 0 ? 'No aliases found' : 'No aliases match the filter'}
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
