import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, csrfHeaders } from '../api/client';
import { useAuth } from '../contexts/auth';
import { useTranslation } from '../i18n';
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

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: '.3rem .8rem', borderRadius: '.35rem', border: '1px solid var(--border)',
    background: active ? 'var(--accent, #6366f1)' : 'transparent',
    color: active ? '#fff' : 'inherit', cursor: 'pointer',
    fontSize: '.85rem', fontWeight: active ? 600 : 400,
  };
}

export function AliasesPage() {
  const [aliases, setAliases] = useState<AliasEntry[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('alias');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [alias, setAlias] = useState('');
  const [destination, setDestination] = useState('');
  const [error, setError] = useState('');
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [editNote, setEditNote] = useState('');
  const csrf = useAuth((s) => s.csrfToken);
  const { t } = useTranslation();

  const load = useCallback(() => {
    api.get('/dms/aliases').then((r) => {
      setAliases((r.data.aliases as string[]).map(parseAlias));
      setNotes(r.data.notes ?? {});
    }).catch(() => undefined);
  }, []);

  useEffect(() => { load(); }, [load]);
  useRefreshListener(load);

  const domains = useMemo(
    () => [...new Set(aliases.map((a) => a.domain).filter(Boolean))].sort(),
    [aliases],
  );

  const domainCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const a of aliases) { if (a.domain) c[a.domain] = (c[a.domain] ?? 0) + 1; }
    return c;
  }, [aliases]);

  const selectDomain = (d: string | null) => { setSelectedDomain(d); setFilter(''); };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const create = async () => {
    setError('');
    try {
      await api.post('/dms/aliases', { alias, destination }, { headers: csrfHeaders(csrf) });
      setAlias(''); setDestination('');
      void load();
    } catch (e: any) { setError(e?.response?.data?.detail ?? t.aliases.failed_create); }
  };

  const remove = async (entry: AliasEntry) => {
    if (!entry.alias || !entry.destination) {
      setError(t.aliases.cannot_parse(entry.raw));
      return;
    }
    if (!confirm(t.aliases.delete_confirm(entry.alias, entry.destination))) return;
    try {
      await api.delete('/dms/aliases', { data: { alias: entry.alias, destination: entry.destination }, headers: csrfHeaders(csrf) });
      void load();
    } catch (e: any) { setError(e?.response?.data?.detail ?? t.aliases.failed_delete); }
  };

  const startEditNote = (aliasAddr: string) => {
    setEditTarget(aliasAddr); setEditNote(notes[aliasAddr] ?? ''); setError('');
  };

  const cancelEditNote = () => { setEditTarget(null); setEditNote(''); };

  const saveNote = async () => {
    if (!editTarget) return;
    try {
      await api.put('/dms/aliases/notes', { alias: editTarget, note: editNote }, { headers: csrfHeaders(csrf) });
      cancelEditNote(); void load();
    } catch (e: any) { setError(e?.response?.data?.detail ?? t.aliases.failed_save); }
  };

  const visible = useMemo(() => {
    const domainFiltered = selectedDomain
      ? aliases.filter((a) => a.domain === selectedDomain)
      : aliases;
    const q = filter.toLowerCase();
    const filtered = q
      ? domainFiltered.filter((a) =>
          a.alias.toLowerCase().includes(q) ||
          a.destination.toLowerCase().includes(q) ||
          a.domain.toLowerCase().includes(q) ||
          (notes[a.alias] ?? '').toLowerCase().includes(q))
      : domainFiltered;
    const effectiveSortKey: SortKey = sortKey === 'domain' && selectedDomain ? 'alias' : sortKey;
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (effectiveSortKey === 'alias') cmp = a.alias.localeCompare(b.alias);
      else if (effectiveSortKey === 'destination') cmp = a.destination.localeCompare(b.destination);
      else if (effectiveSortKey === 'domain') cmp = a.domain.localeCompare(b.domain);
      else if (effectiveSortKey === 'note') cmp = (notes[a.alias] ?? '').localeCompare(notes[b.alias] ?? '');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [aliases, notes, selectedDomain, filter, sortKey, sortDir]);

  const thStyle = (key: SortKey, align: 'left' | 'right' = 'left'): React.CSSProperties => ({
    textAlign: align, padding: '.4rem .5rem', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
  });

  const showDomainCol = selectedDomain === null;

  return (
    <div className="panel">
      <h1>{t.aliases.title}</h1>
      <div className="row" style={{ marginBottom: '.5rem' }}>
        <input placeholder={t.aliases.alias_ph} value={alias} onChange={(e) => setAlias(e.target.value)} style={{ flex: 1 }} />
        <input placeholder={t.aliases.dest_ph} value={destination} onChange={(e) => setDestination(e.target.value)} style={{ flex: 1 }} />
        <button onClick={create}>{t.common.add}</button>
      </div>
      {error && <p style={{ color: 'var(--color-warn, #f59e0b)' }}>{error}</p>}

      {editTarget && (
        <div className="panel" style={{ marginBottom: '1rem' }}>
          <strong>{t.aliases.edit_note_for(editTarget)}</strong>
          <div className="row" style={{ marginTop: '.5rem' }}>
            <input placeholder={t.common.note_ph} value={editNote} onChange={(e) => setEditNote(e.target.value)} style={{ flex: 1 }} />
            <button onClick={saveNote}>{t.common.save}</button>
            <button onClick={cancelEditNote}>{t.common.cancel}</button>
          </div>
        </div>
      )}

      {/* Domain tabs */}
      <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap', marginBottom: '.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '.5rem' }}>
        <button style={tabStyle(selectedDomain === null)} onClick={() => selectDomain(null)}>
          {t.common.all} <span style={{ opacity: .65, fontSize: '.8rem' }}>({aliases.length})</span>
        </button>
        {domains.map((d) => (
          <button key={d} style={tabStyle(selectedDomain === d)} onClick={() => selectDomain(d)}>
            {d} <span style={{ opacity: .65, fontSize: '.8rem' }}>({domainCounts[d] ?? 0})</span>
          </button>
        ))}
      </div>

      <div className="row" style={{ marginBottom: '.5rem' }}>
        <input
          placeholder={t.aliases.filter_ph}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ flex: 1 }}
        />
        {filter && <button onClick={() => setFilter('')}>{t.common.clear}</button>}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={thStyle('alias')} onClick={() => toggleSort('alias')}>{t.aliases.alias_col}{sortIcon('alias', sortKey, sortDir)}</th>
            <th style={thStyle('destination')} onClick={() => toggleSort('destination')}>{t.aliases.destination_col}{sortIcon('destination', sortKey, sortDir)}</th>
            {showDomainCol && <th style={thStyle('domain')} onClick={() => toggleSort('domain')}>{t.aliases.domain_col}{sortIcon('domain', sortKey, sortDir)}</th>}
            <th style={thStyle('note')} onClick={() => toggleSort('note')}>{t.common.note}{sortIcon('note', sortKey, sortDir)}</th>
            <th style={{ textAlign: 'right', padding: '.4rem .5rem' }}>{t.common.actions}</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((a) => (
            <tr key={a.raw} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '.4rem .5rem', fontFamily: 'monospace', fontSize: '.9rem' }}>{a.alias}</td>
              <td style={{ padding: '.4rem .5rem', fontFamily: 'monospace', fontSize: '.9rem' }}>{a.destination}</td>
              {showDomainCol && <td style={{ padding: '.4rem .5rem', fontSize: '.85rem', opacity: .75 }}>{a.domain}</td>}
              <td style={{ padding: '.4rem .5rem', fontSize: '.85rem', opacity: .75 }}>{notes[a.alias] ?? ''}</td>
              <td style={{ padding: '.4rem .5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                <button onClick={() => startEditNote(a.alias)} title={t.accounts.edit_note}>📝</button>
                <button onClick={() => remove(a)} title={t.common.delete} style={{ color: '#ef4444' }}>🗑</button>
              </td>
            </tr>
          ))}
          {visible.length === 0 && (
            <tr><td colSpan={showDomainCol ? 5 : 4} style={{ padding: '.75rem .5rem', opacity: .5 }}>
              {aliases.length === 0 ? t.aliases.no_aliases : t.aliases.no_match}
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
