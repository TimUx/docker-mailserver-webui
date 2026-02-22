import { useCallback, useEffect, useState } from 'react';
import { api, csrfHeaders } from '../api/client';
import { useAuth } from '../contexts/auth';
import { useRefreshListener } from '../hooks/useRefreshListener';

type Account = { email: string; quota_used: string | null; quota_limit: string | null; quota_pct: number | null };
type EditMode = 'none' | 'password' | 'note' | 'quota';

export function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
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
  }, []);

  useEffect(() => { load(); }, [load]);
  useRefreshListener(load);

  const create = async () => {
    setError('');
    try {
      await api.post('/dms/accounts', { email, password, quota }, { headers: csrfHeaders(csrf) });
      setEmail('');
      setPassword('');
      setQuota('');
      void load();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to create account');
    }
  };

  const remove = async (addr: string) => {
    if (!confirm(`Delete account ${addr}?`)) return;
    try {
      await api.delete('/dms/accounts', { data: { email: addr }, headers: csrfHeaders(csrf) });
      void load();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to delete account');
    }
  };

  const startEdit = (addr: string, mode: EditMode) => {
    setEditTarget(addr);
    setEditMode(mode);
    setEditValue(mode === 'note' ? (notes[addr] ?? '') : '');
    setError('');
  };

  const cancelEdit = () => { setEditTarget(null); setEditMode('none'); setEditValue(''); };

  const saveEdit = async () => {
    if (!editTarget) return;
    try {
      if (editMode === 'password') {
        await api.put('/dms/accounts/password', { email: editTarget, password: editValue }, { headers: csrfHeaders(csrf) });
      } else if (editMode === 'note') {
        await api.put('/dms/accounts/notes', { email: editTarget, note: editValue }, { headers: csrfHeaders(csrf) });
      } else if (editMode === 'quota') {
        await api.put('/dms/accounts/quota', { email: editTarget, quota: editValue }, { headers: csrfHeaders(csrf) });
      }
      cancelEdit();
      void load();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to save');
    }
  };

  const formatQuota = (acc: Account): string => {
    if (acc.quota_limit === null) return '';
    const limit = acc.quota_limit === '~' ? '∞' : acc.quota_limit;
    return `${acc.quota_used} / ${limit} [${acc.quota_pct}%]`;
  };

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

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={{ textAlign: 'left', padding: '.4rem .5rem' }}>Email</th>
            <th style={{ textAlign: 'left', padding: '.4rem .5rem' }}>Quota (used / limit)</th>
            <th style={{ textAlign: 'left', padding: '.4rem .5rem' }}>Note</th>
            <th style={{ padding: '.4rem .5rem' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => (
            <tr key={a.email} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '.4rem .5rem' }}>{a.email}</td>
              <td style={{ padding: '.4rem .5rem', opacity: .75, fontSize: '.85rem', fontFamily: 'monospace' }}>{formatQuota(a)}</td>
              <td style={{ padding: '.4rem .5rem', opacity: .75, fontSize: '.85rem' }}>{notes[a.email] ?? ''}</td>
              <td style={{ padding: '.4rem .5rem', whiteSpace: 'nowrap' }}>
                <button onClick={() => startEdit(a.email, 'password')} title="Change password">🔑</button>
                <button onClick={() => startEdit(a.email, 'quota')} title="Set quota">📦</button>
                <button onClick={() => startEdit(a.email, 'note')} title="Edit note">📝</button>
                <button onClick={() => remove(a.email)} title="Delete account" style={{ color: '#ef4444' }}>🗑</button>
              </td>
            </tr>
          ))}
          {accounts.length === 0 && (
            <tr><td colSpan={4} style={{ padding: '.75rem .5rem', opacity: .5 }}>No accounts found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
