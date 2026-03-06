import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, csrfHeaders } from '../api/client';
import { useAuth } from '../contexts/auth';
import { useTranslation } from '../i18n';
import { useRefreshListener } from '../hooks/useRefreshListener';

type AliasEntry = { alias: string; destination: string; domain: string; raw: string };
type AliasGroup = { alias: string; destinations: string[]; domain: string };
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

function groupAliases(entries: AliasEntry[]): AliasGroup[] {
  const map = new Map<string, AliasGroup & { destSet: Set<string> }>();
  for (const entry of entries) {
    if (!map.has(entry.alias)) {
      map.set(entry.alias, { alias: entry.alias, destinations: [], domain: entry.domain, destSet: new Set() });
    }
    const group = map.get(entry.alias)!;
    if (entry.destination && !group.destSet.has(entry.destination)) {
      group.destSet.add(entry.destination);
      group.destinations.push(entry.destination);
    }
  }
  return [...map.values()].map(({ destSet: _destSet, ...g }) => g);
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
  const [aliasEntries, setAliasEntries] = useState<AliasEntry[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('alias');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [alias, setAlias] = useState('');
  const [destination, setDestination] = useState('');
  const [error, setError] = useState('');
  // Note editing
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [editNote, setEditNote] = useState('');
  // Destination editing
  const [editAliasTarget, setEditAliasTarget] = useState<string | null>(null);
  const [newDest, setNewDest] = useState('');
  const csrf = useAuth((s) => s.csrfToken);
  const { t } = useTranslation();

  const load = useCallback(() => {
    api.get('/dms/aliases').then((r) => {
      setAliasEntries((r.data.aliases as string[]).map(parseAlias));
      setNotes(r.data.notes ?? {});
    }).catch(() => undefined);
  }, []);

  useEffect(() => { load(); }, [load]);
  useRefreshListener(load);

  const groups = useMemo(() => groupAliases(aliasEntries), [aliasEntries]);

  const domains = useMemo(
    () => [...new Set(groups.map((g) => g.domain).filter(Boolean))].sort(),
    [groups],
  );

  const domainCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const g of groups) { if (g.domain) c[g.domain] = (c[g.domain] ?? 0) + 1; }
    return c;
  }, [groups]);

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

  const removeAlias = async (group: AliasGroup) => {
    if (!confirm(t.aliases.delete_alias_confirm(group.alias))) return;
    try {
      for (const dest of group.destinations) {
        await api.delete('/dms/aliases', { data: { alias: group.alias, destination: dest }, headers: csrfHeaders(csrf) });
      }
      if (editAliasTarget === group.alias) setEditAliasTarget(null);
      void load();
    } catch (e: any) { setError(e?.response?.data?.detail ?? t.aliases.failed_delete); }
  };

  const removeDestination = async (aliasAddr: string, dest: string) => {
    setError('');
    try {
      await api.delete('/dms/aliases', { data: { alias: aliasAddr, destination: dest }, headers: csrfHeaders(csrf) });
      void load();
    } catch (e: any) { setError(e?.response?.data?.detail ?? t.aliases.failed_delete); }
  };

  const addDestination = async () => {
    if (!editAliasTarget || !newDest) return;
    setError('');
    try {
      await api.post('/dms/aliases', { alias: editAliasTarget, destination: newDest }, { headers: csrfHeaders(csrf) });
      setNewDest('');
      void load();
    } catch (e: any) { setError(e?.response?.data?.detail ?? t.aliases.failed_add_destination); }
  };

  const startEditDestinations = (aliasAddr: string) => {
    setEditAliasTarget(aliasAddr);
    setNewDest('');
    setEditTarget(null);
    setEditNote('');
    setError('');
  };

  const cancelEditDestinations = () => { setEditAliasTarget(null); setNewDest(''); };

  const startEditNote = (aliasAddr: string) => {
    setEditTarget(aliasAddr);
    setEditNote(notes[aliasAddr] ?? '');
    setEditAliasTarget(null);
    setNewDest('');
    setError('');
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
      ? groups.filter((g) => g.domain === selectedDomain)
      : groups;
    const q = filter.toLowerCase();
    const filtered = q
      ? domainFiltered.filter((g) =>
          g.alias.toLowerCase().includes(q) ||
          g.destinations.some((d) => d.toLowerCase().includes(q)) ||
          g.domain.toLowerCase().includes(q) ||
          (notes[g.alias] ?? '').toLowerCase().includes(q))
      : domainFiltered;
    const effectiveSortKey: SortKey = sortKey === 'domain' && selectedDomain ? 'alias' : sortKey;
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (effectiveSortKey === 'alias') cmp = a.alias.localeCompare(b.alias);
      else if (effectiveSortKey === 'destination') cmp = a.destinations.join('\n').localeCompare(b.destinations.join('\n'));
      else if (effectiveSortKey === 'domain') cmp = a.domain.localeCompare(b.domain);
      else if (effectiveSortKey === 'note') cmp = (notes[a.alias] ?? '').localeCompare(notes[b.alias] ?? '');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [groups, notes, selectedDomain, filter, sortKey, sortDir]);

  // Find the current group being edited for destinations
  const editingGroup = useMemo(
    () => editAliasTarget ? groups.find((g) => g.alias === editAliasTarget) : undefined,
    [editAliasTarget, groups],
  );

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

      {/* Note edit panel */}
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

      {/* Destinations edit panel */}
      {editingGroup && (
        <div className="panel" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>{t.aliases.edit_destinations_for(editingGroup.alias)}</strong>
            <button onClick={cancelEditDestinations}>{t.common.cancel}</button>
          </div>
          <div style={{ marginTop: '.5rem' }}>
            {editingGroup.destinations.length === 0 && (
              <p style={{ opacity: .5, fontSize: '.85rem', margin: '.25rem 0' }}>{t.aliases.no_destinations}</p>
            )}
            {editingGroup.destinations.map((dest) => (
              <div key={dest} className="row" style={{ marginBottom: '.25rem' }}>
                <span style={{ flex: 1, fontFamily: 'monospace', fontSize: '.9rem', padding: '.3rem .5rem' }}>{dest}</span>
                <button
                  onClick={() => removeDestination(editingGroup.alias, dest)}
                  title={t.common.delete}
                  style={{ color: '#ef4444' }}
                >🗑</button>
              </div>
            ))}
          </div>
          <div className="row" style={{ marginTop: '.75rem' }}>
            <input
              placeholder={t.aliases.add_dest_ph}
              value={newDest}
              onChange={(e) => setNewDest(e.target.value)}
              style={{ flex: 1 }}
              onKeyDown={(e) => { if (e.key === 'Enter') void addDestination(); }}
            />
            <button onClick={() => void addDestination()} disabled={!newDest}>{t.common.add}</button>
          </div>
        </div>
      )}

      {/* Domain tabs */}
      <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap', marginBottom: '.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '.5rem' }}>
        <button style={tabStyle(selectedDomain === null)} onClick={() => selectDomain(null)}>
          {t.common.all} <span style={{ opacity: .65, fontSize: '.8rem' }}>({groups.length})</span>
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
          {visible.map((g) => (
            <tr
              key={g.alias}
              style={{
                borderBottom: '1px solid var(--border)',
                background: editAliasTarget === g.alias ? 'var(--row-highlight, rgba(99,102,241,.08))' : undefined,
              }}
            >
              <td style={{ padding: '.4rem .5rem', fontFamily: 'monospace', fontSize: '.9rem' }}>{g.alias}</td>
              <td style={{ padding: '.4rem .5rem' }}>
                {g.destinations.map((dest) => (
                  <span key={dest} style={{ fontFamily: 'monospace', fontSize: '.9rem', display: 'block', lineHeight: '1.5' }}>{dest}</span>
                ))}
              </td>
              {showDomainCol && <td style={{ padding: '.4rem .5rem', fontSize: '.85rem', opacity: .75 }}>{g.domain}</td>}
              <td style={{ padding: '.4rem .5rem', fontSize: '.85rem', opacity: .75 }}>{notes[g.alias] ?? ''}</td>
              <td style={{ padding: '.4rem .5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                <button onClick={() => startEditDestinations(g.alias)} title={t.aliases.edit_destinations}>✏️</button>
                <button onClick={() => startEditNote(g.alias)} title={t.accounts.edit_note}>📝</button>
                <button onClick={() => void removeAlias(g)} title={t.common.delete} style={{ color: '#ef4444' }}>🗑</button>
              </td>
            </tr>
          ))}
          {visible.length === 0 && (
            <tr><td colSpan={showDomainCol ? 5 : 4} style={{ padding: '.75rem .5rem', opacity: .5 }}>
              {groups.length === 0 ? t.aliases.no_aliases : t.aliases.no_match}
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
