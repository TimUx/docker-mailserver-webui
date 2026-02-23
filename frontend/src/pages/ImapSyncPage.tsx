import { useCallback, useEffect, useState } from 'react';
import { api, csrfHeaders } from '../api/client';
import { useAuth } from '../contexts/auth';
import { useTranslation } from '../i18n';
import { useRefreshListener } from '../hooks/useRefreshListener';

type Job = {
  id: number;
  name: string;
  source_host: string;
  source_user: string;
  destination_host: string;
  destination_user: string;
  port: number;
  ssl_enabled: boolean;
  verify_cert: boolean;
  interval_minutes: number;
  enabled: boolean;
  last_status: string | null;
  last_message: string | null;
  last_run_at: string | null;
};

type LocalAccount = { email: string };

const CUSTOM = '__custom__';

const emptyForm = {
  name: '',
  source_host: '',
  source_user: '',
  source_password: '',
  destination_host: '',
  destination_user: '',
  destination_password: '',
  port: 993,
  ssl_enabled: true,
  interval_minutes: 60,
  enabled: true,
};

export function ImapSyncPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [localAccounts, setLocalAccounts] = useState<LocalAccount[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [destAccount, setDestAccount] = useState<string>(CUSTOM);
  const [editId, setEditId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const csrf = useAuth((s) => s.csrfToken);
  const { t } = useTranslation();

  const load = useCallback(() => {
    void api.get('/imapsync').then((r) => setJobs(r.data)).catch(() => undefined);
  }, []);

  const loadAccounts = useCallback(() => {
    api.get('/dms/accounts')
      .then((r) => setLocalAccounts((r.data.accounts ?? []) as LocalAccount[]))
      .catch(() => undefined);
  }, []);

  useEffect(() => { load(); loadAccounts(); }, [load, loadAccounts]);
  useRefreshListener(load);

  const isLocalDest = destAccount !== CUSTOM;

  const selectDestAccount = (email: string) => {
    setDestAccount(email);
    if (email === CUSTOM) return;
    // derive the IMAP host: mail.<domain>, fallback to localhost
    const atIdx = email.indexOf('@');
    const domain = atIdx !== -1 ? email.slice(atIdx + 1) : '';
    const host = domain ? `mail.${domain}` : 'localhost';
    setForm((f) => ({
      ...f,
      destination_user: email,
      destination_host: host,
    }));
  };

  const openCreate = () => {
    setForm(emptyForm);
    setDestAccount(CUSTOM);
    setEditId(null);
    setSaveError(null);
    setShowForm(true);
  };

  const openEdit = (job: Job) => {
    setForm({
      name: job.name,
      source_host: job.source_host,
      source_user: job.source_user,
      source_password: '',
      destination_host: job.destination_host,
      destination_user: job.destination_user,
      destination_password: '',
      port: job.port,
      ssl_enabled: job.ssl_enabled,
      interval_minutes: job.interval_minutes,
      enabled: job.enabled,
    });
    // detect if the saved dest_user matches a local account
    const match = localAccounts.find((a) => a.email === job.destination_user);
    setDestAccount(match ? match.email : CUSTOM);
    setEditId(job.id);
    setSaveError(null);
    setShowForm(true);
  };

  const remove = async (id: number) => {
    if (!confirm(t.imapsync.delete_confirm)) return;
    await api.delete(`/imapsync/${id}`, { headers: csrfHeaders(csrf) }).catch(() => undefined);
    load();
  };

  const save = async () => {
    setSaveError(null);
    try {
      if (editId !== null) {
        const payload: Record<string, unknown> = Object.fromEntries(
          Object.entries(form).filter(([k, v]) => {
            if ((k === 'source_password' || k === 'destination_password') && !v) return false;
            return true;
          })
        );
        await api.put(`/imapsync/${editId}`, payload, { headers: csrfHeaders(csrf) });
      } else {
        await api.post('/imapsync', form, { headers: csrfHeaders(csrf) });
      }
      setShowForm(false);
      load();
    } catch (e: any) {
      setSaveError(e?.response?.data?.detail ?? t.common.save_failed);
    }
  };

  const field = (key: keyof typeof form, label: string, type = 'text', readonly = false) => (
    <label style={{ display: 'block', marginBottom: '.5rem' }}>
      {label}
      <input
        type={type}
        value={String(form[key])}
        readOnly={readonly}
        disabled={readonly}
        onChange={(e) => !readonly && setForm((f) => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
        style={{ display: 'block', width: '100%', opacity: readonly ? .6 : 1 }}
      />
    </label>
  );

  return (
    <div className="panel">
      <h1>{t.imapsync.title}</h1>
      <p>{t.imapsync.desc}</p>
      <button onClick={openCreate}>{t.imapsync.new_job}</button>

      {showForm && (
        <div style={{ border: '1px solid var(--border)', borderRadius: '.5rem', padding: '1rem', margin: '1rem 0' }}>
          <h3>{editId !== null ? t.imapsync.edit_job : t.imapsync.new_job}</h3>

          {field('name', t.imapsync.job_name)}

          {/* ── Source ─────────────────────────────────────────────────────── */}
          <fieldset style={{ border: '1px solid var(--border)', borderRadius: '.35rem', padding: '.75rem', marginBottom: '.75rem' }}>
            <legend style={{ padding: '0 .4rem', fontSize: '.85rem', opacity: .75 }}>Source</legend>
            {field('source_host', t.imapsync.source_host)}
            {field('source_user', t.imapsync.source_user)}
            {field('source_password', editId !== null ? t.imapsync.source_password_edit : t.imapsync.source_password, 'password')}
          </fieldset>

          {/* ── Destination ────────────────────────────────────────────────── */}
          <fieldset style={{ border: '1px solid var(--border)', borderRadius: '.35rem', padding: '.75rem', marginBottom: '.75rem' }}>
            <legend style={{ padding: '0 .4rem', fontSize: '.85rem', opacity: .75 }}>Destination</legend>

            {/* Local account selector */}
            <label style={{ display: 'block', marginBottom: '.75rem' }}>
              {t.imapsync.dest_account}
              <select
                value={destAccount}
                onChange={(e) => selectDestAccount(e.target.value)}
                style={{ display: 'block', width: '100%', marginTop: '.2rem' }}
              >
                <option value={CUSTOM}>{t.imapsync.dest_account_custom}</option>
                {localAccounts.map((a) => (
                  <option key={a.email} value={a.email}>{a.email}</option>
                ))}
              </select>
            </label>

            {/* Host: editable even when a local account is selected so user can override */}
            <label style={{ display: 'block', marginBottom: '.5rem' }}>
              {t.imapsync.dest_host}
              {isLocalDest && (
                <span style={{ marginLeft: '.5rem', fontSize: '.75rem', opacity: 0.6 }}>({t.imapsync.dest_account_host_hint})</span>
              )}
              <input
                type="text"
                value={form.destination_host}
                onChange={(e) => setForm((f) => ({ ...f, destination_host: e.target.value }))}
                style={{ display: 'block', width: '100%' }}
              />
            </label>

            {/* User: read-only when a local account is selected */}
            {field('destination_user', t.imapsync.dest_user, 'text', isLocalDest)}

            {/* Password: always editable */}
            {field('destination_password', editId !== null ? t.imapsync.dest_password_edit : t.imapsync.dest_password, 'password')}
          </fieldset>

          {/* ── Connection options ─────────────────────────────────────────── */}
          {field('port', t.imapsync.port, 'number')}
          {field('interval_minutes', t.imapsync.interval, 'number')}
          <label style={{ display: 'block', marginBottom: '.5rem' }}>
            <input type="checkbox" checked={form.ssl_enabled} onChange={(e) => setForm((f) => ({ ...f, ssl_enabled: e.target.checked }))} />
            {' '}{t.imapsync.ssl}
          </label>
          <label style={{ display: 'block', marginBottom: '.5rem' }}>
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} />
            {' '}{t.imapsync.enabled}
          </label>
          <button onClick={save}>{t.common.save}</button>
          <button onClick={() => setShowForm(false)} style={{ marginLeft: '.5rem' }}>{t.common.cancel}</button>
          {saveError && <p style={{ color: 'var(--error, #ef4444)', marginTop: '.5rem' }}>{saveError}</p>}
        </div>
      )}

      {jobs.length === 0 ? (
        <p>{t.imapsync.no_jobs}</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '.4rem' }}>{t.imapsync.name_col}</th>
              <th style={{ padding: '.4rem' }}>{t.imapsync.source_col}</th>
              <th style={{ padding: '.4rem' }}>{t.imapsync.dest_col}</th>
              <th style={{ padding: '.4rem' }}>{t.imapsync.interval_col}</th>
              <th style={{ padding: '.4rem' }}>{t.imapsync.status_col}</th>
              <th style={{ padding: '.4rem' }}>{t.imapsync.actions_col}</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '.4rem' }}>{j.name} {j.enabled ? '' : `(${t.imapsync.disabled})`}</td>
                <td style={{ padding: '.4rem' }}>{j.source_user}@{j.source_host}</td>
                <td style={{ padding: '.4rem' }}>{j.destination_user}@{j.destination_host}</td>
                <td style={{ padding: '.4rem' }}>{j.interval_minutes} {t.imapsync.min}</td>
                <td style={{ padding: '.4rem' }}>{j.last_status ?? '-'}</td>
                <td style={{ padding: '.4rem' }}>
                  <button onClick={() => openEdit(j)}>✏️</button>
                  <button onClick={() => remove(j.id)} style={{ marginLeft: '.25rem' }}>🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
