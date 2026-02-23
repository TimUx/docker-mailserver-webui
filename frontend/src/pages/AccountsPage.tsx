import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, csrfHeaders } from '../api/client';
import { useAuth } from '../contexts/auth';
import { useRefreshListener } from '../hooks/useRefreshListener';

type Account = { email: string; quota_used: string | null; quota_limit: string | null; quota_pct: number | null };
type EditMode = 'none' | 'password' | 'note' | 'quota';
type SortDir = 'asc' | 'desc';
type SortKey = 'email' | 'domain' | 'quota' | 'aliases' | 'note';

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

export function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [aliasCounts, setAliasCounts] = useState<Record<string, number>>({});
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('email');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const csrf = useAuth((s) => s.csrfToken);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [quota, setQuota] = useState('');
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<EditMode>('none');
  const [editValue, setEditValue] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get('/dms/accounts')
      .then((r) => { setAccounts(r.data.accounts); setNotes(r.data.notes ?? {}); })
      .catch(() => undefined);
    api.get('/dms/aliases').then((r) => {
      const counts: Record<string, number> = {};
      for (const entry of (r.data.aliases ?? [])) {
        const parts = (entry as string).trim().split(/\s+/).filter(Boolean);
        const offset = parts[0] === '*' ? 1 : 0;
        const nextIdx = parts[offset + 1] === '->' ? offset + 2 : offset + 1;
        const dest = parts[nextIdx] ?? '';
        if (dest) counts[dest] = (counts[dest] ?? 0) + 1;
      }
      setAliasCounts(counts);
    }).catch(() => undefined);
  }, []);

  useEffect(() => { load(); }, [load]);
  useRefreshListener(load);

  const domains = useMemo(
    () => [...new Set(accounts.map((a) => a.email.split('@')[1] ?? '').filter(Boolean))].sort(),
    [accounts],
  );

  const domainCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const a of accounts) { const d = a.email.split('@')[1] ?? ''; if (d) c[d] = (c[d] ?? 0) + 1; }
    return c;
  }, [accounts]);

  const selectDomain = (d: string | null) => { setSelectedDomain(d); setFilter(''); };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const create = async () => {
    setError('');
    try {
      await api.post('/dms/accounts', { email, password, quota }, { headers: csrfHeaders(csrf) });
      setEmail(''); setPassword(''); setQuota('');
      void load();
    } catch (e: any) { setError(e?.response?.data?.detail ?? 'Failed to create account'); }
  };

  const remove = async (addr: string) => {
    if (!confirm(`Delete account ${addr}?`)) return;
    try {
      await api.delete('/dms/accounts', { data: { email: addr }, headers: csrfHeaders(csrf) });
      void load();
    } catch (e: any) { setError(e?.response?.data?.detail ?? 'Failed to delete account'); }
  };

  const startEdit = (addr: string, mode: EditMode) => {
    setEditTarget(addr); setEditMode(mode);
    setEditValue(mode === 'note' ? (notes[addr] ?? '') : '');
    setError('');
  };

  const cancelEdit = () => { setEditTarget(null); setEditMode('none'); setEditValue(''); };

  const saveEdit = async () => {
    if (!editTarget) return;
    try {
      if (editMode === 'password')
        await api.put('/dms/accounts/password', { email: editTarget, password: editValue }, { headers: csrfHeaders(csrf) });
      else if (editMode === 'note')
        await api.put('/dms/accounts/notes', { email: editTarget, note: editValue }, { headers: csrfHeaders(csrf) });
      else if (editMode === 'quota')
        await api.put('/dms/accounts/quota', { email: editTarget, quota: editValue }, { headers: csrfHeaders(csrf) });
      cancelEdit(); void load();
    } catch (e: any) { setError(e?.response?.data?.detail ?? 'Failed to save'); }
  };

  const formatQuota = (acc: Account): string => {
    if (acc.quota_limit === null) return '';
    const limit = acc.quota_limit === '~' ? '∞' : acc.quota_limit;
    return `${acc.quota_used} / ${limit} [${acc.quota_pct}%]`;
  };

  const visible = useMemo(() => {
    const domainFiltered = selectedDomain
      ? accounts.filter((a) => a.email.split('@')[1] === selectedDomain)
      : accounts;
    const q = filter.toLowerCase();
    const filtered = q
      ? domainFiltered.filter((a) =>
          a.email.toLowerCase().includes(q) ||
          (a.email.split('@')[1] ?? '').toLowerCase().includes(q) ||
          (notes[a.email] ?? '').toLowerCase().includes(q))
      : domainFiltered;
    const effectiveSortKey: SortKey = sortKey === 'domain' && selectedDomain ? 'email' : sortKey;
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (effectiveSortKey === 'email') cmp = a.email.localeCompare(b.email);
      else if (effectiveSortKey === 'domain') cmp = (a.email.split('@')[1] ?? '').localeCompare(b.email.split('@')[1] ?? '');
      else if (effectiveSortKey === 'quota') cmp = (a.quota_pct ?? -1) - (b.quota_pct ?? -1);
      else if (effectiveSortKey === 'aliases') cmp = (aliasCounts[a.email] ?? 0) - (aliasCounts[b.email] ?? 0);
      else if (effectiveSortKey === 'note') cmp = (notes[a.email] ?? '').localeCompare(notes[b.email] ?? '');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [accounts, notes, aliasCounts, selectedDomain, filter, sortKey, sortDir]);

  const thStyle = (key: SortKey, align: 'left' | 'right' = 'left'): React.CSSProperties => ({
    textAlign: align, padding: '.4rem .5rem', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
  });

  const showDomainCol = selectedDomain === null;

  return (
    <div className="panel">
      <h1>👤 Accounts</h1>

      <div className="row" style={{ marginBottom: '.5rem' }}>
        <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ flex: 2 }} />
        <input placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ flex: 2 }} />
        <input placeholder="quota (e.g. 1G, 500M, 0=unlimited)" value={quota} onChange={(e) => setQuota(e.target.value)} style={{ flex: 2 }} />
        <button onClick={create}>➕ Add</button>
      </div>
      {error && <p style={{ color: 'var(--color-warn, #f59e0b)' }}>{error}</p>}

      {editTarget && (
        <div className="panel" style={{ marginBottom: '1rem' }}>
          <strong>
            {editMode === 'password' ? '🔑 Change Password' : editMode === 'quota' ? '📦 Set Quota' : '📝 Edit Note'} for {editTarget}
          </strong>
          <div className="row" style={{ marginTop: '.5rem' }}>
            {editMode === 'password' ? (
              <input type="password" placeholder="New password" value={editValue} onChange={(e) => setEditValue(e.target.value)} style={{ flex: 1 }} />
            ) : editMode === 'quota' ? (
              <input placeholder="Quota (e.g. 1G, 500M, 0=unlimited)" value={editValue} onChange={(e) => setEditValue(e.target.value)} style={{ flex: 1 }} />
            ) : (
              <input placeholder="Note / comment" value={editValue} onChange={(e) => setEditValue(e.target.value)} style={{ flex: 1 }} />
            )}
            <button onClick={saveEdit}>💾 Save</button>
            <button onClick={cancelEdit}>✖ Cancel</button>
          </div>
        </div>
      )}

      {/* Domain tabs */}
      <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap', marginBottom: '.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '.5rem' }}>
        <button style={tabStyle(selectedDomain === null)} onClick={() => selectDomain(null)}>
          🌐 All <span style={{ opacity: .65, fontSize: '.8rem' }}>({accounts.length})</span>
        </button>
        {domains.map((d) => (
          <button key={d} style={tabStyle(selectedDomain === d)} onClick={() => selectDomain(d)}>
            {d} <span style={{ opacity: .65, fontSize: '.8rem' }}>({domainCounts[d] ?? 0})</span>
          </button>
        ))}
      </div>

      <div className="row" style={{ marginBottom: '.5rem' }}>
        <input
          placeholder="🔍 Filter accounts…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ flex: 1 }}
        />
        {filter && <button onClick={() => setFilter('')}>✖ Clear</button>}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={thStyle('email')} onClick={() => toggleSort('email')}>Email{sortIcon('email', sortKey, sortDir)}</th>
            {showDomainCol && <th style={thStyle('domain')} onClick={() => toggleSort('domain')}>Domain{sortIcon('domain', sortKey, sortDir)}</th>}
            <th style={thStyle('quota')} onClick={() => toggleSort('quota')}>Quota (used / limit){sortIcon('quota', sortKey, sortDir)}</th>
            <th style={thStyle('aliases', 'right')} onClick={() => toggleSort('aliases')}>Aliases{sortIcon('aliases', sortKey, sortDir)}</th>
            <th style={thStyle('note')} onClick={() => toggleSort('note')}>Note{sortIcon('note', sortKey, sortDir)}</th>
            <th style={{ textAlign: 'right', padding: '.4rem .5rem' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((a) => (
            <tr key={a.email} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '.4rem .5rem' }}>{a.email}</td>
              {showDomainCol && <td style={{ padding: '.4rem .5rem', opacity: .75, fontSize: '.85rem' }}>{a.email.split('@')[1] ?? ''}</td>}
              <td style={{ padding: '.4rem .5rem', opacity: .75, fontSize: '.85rem', fontFamily: 'monospace' }}>{formatQuota(a)}</td>
              <td style={{ padding: '.4rem .5rem', textAlign: 'right', fontSize: '.85rem', opacity: .75 }}>{aliasCounts[a.email] ?? 0}</td>
              <td style={{ padding: '.4rem .5rem', opacity: .75, fontSize: '.85rem' }}>{notes[a.email] ?? ''}</td>
              <td style={{ padding: '.4rem .5rem', whiteSpace: 'nowrap', textAlign: 'right' }}>
                <button onClick={() => startEdit(a.email, 'password')} title="Change password">🔑</button>
                <button onClick={() => startEdit(a.email, 'quota')} title="Set quota">📦</button>
                <button onClick={() => startEdit(a.email, 'note')} title="Edit note">📝</button>
                <button onClick={() => remove(a.email)} title="Delete account" style={{ color: '#ef4444' }}>🗑</button>
              </td>
            </tr>
          ))}
          {visible.length === 0 && (
            <tr><td colSpan={showDomainCol ? 6 : 5} style={{ padding: '.75rem .5rem', opacity: .5 }}>
              {accounts.length === 0 ? 'No accounts found' : 'No accounts match the filter'}
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

