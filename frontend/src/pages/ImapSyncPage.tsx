import { useEffect, useState } from 'react';
import { api, csrfHeaders } from '../api/client';
import { useAuth } from '../contexts/auth';

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
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const csrf = useAuth((s) => s.csrfToken);

  const load = () => api.get('/imapsync').then((r) => setJobs(r.data)).catch(() => undefined);
  useEffect(() => { void load(); }, []);

  const openCreate = () => { setForm(emptyForm); setEditId(null); setShowForm(true); };
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
    setEditId(job.id);
    setShowForm(true);
  };

  const save = async () => {
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
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this sync job?')) return;
    await api.delete(`/imapsync/${id}`, { headers: csrfHeaders(csrf) });
    load();
  };

  const field = (key: keyof typeof form, label: string, type = 'text') => (
    <label style={{ display: 'block', marginBottom: '.5rem' }}>
      {label}
      <input
        type={type}
        value={String(form[key])}
        onChange={(e) => setForm((f) => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
        style={{ display: 'block', width: '100%' }}
      />
    </label>
  );

  return (
    <div className="panel">
      <h1>📬 IMAPSync</h1>
      <p>Manage IMAP sync job definitions for your IMAPSync container.</p>
      <button onClick={openCreate}>+ New Job</button>

      {showForm && (
        <div style={{ border: '1px solid var(--border)', borderRadius: '.5rem', padding: '1rem', margin: '1rem 0' }}>
          <h3>{editId !== null ? 'Edit Job' : 'New Job'}</h3>
          {field('name', 'Name')}
          {field('source_host', 'Source Host')}
          {field('source_user', 'Source User')}
          {field('source_password', editId !== null ? 'Source Password (leave blank to keep unchanged)' : 'Source Password', 'password')}
          {field('destination_host', 'Destination Host')}
          {field('destination_user', 'Destination User')}
          {field('destination_password', editId !== null ? 'Destination Password (leave blank to keep unchanged)' : 'Destination Password', 'password')}
          {field('port', 'Port', 'number')}
          {field('interval_minutes', 'Interval (minutes)', 'number')}
          <label style={{ display: 'block', marginBottom: '.5rem' }}>
            <input type="checkbox" checked={form.ssl_enabled} onChange={(e) => setForm((f) => ({ ...f, ssl_enabled: e.target.checked }))} />
            {' '}SSL enabled
          </label>
          <label style={{ display: 'block', marginBottom: '.5rem' }}>
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} />
            {' '}Job enabled
          </label>
          <button onClick={save}>💾 Save</button>
          <button onClick={() => setShowForm(false)} style={{ marginLeft: '.5rem' }}>Cancel</button>
        </div>
      )}

      {jobs.length === 0 ? (
        <p>No sync jobs defined.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '.4rem' }}>Name</th>
              <th style={{ padding: '.4rem' }}>Source</th>
              <th style={{ padding: '.4rem' }}>Destination</th>
              <th style={{ padding: '.4rem' }}>Interval</th>
              <th style={{ padding: '.4rem' }}>Status</th>
              <th style={{ padding: '.4rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '.4rem' }}>{j.name} {j.enabled ? '' : '(disabled)'}</td>
                <td style={{ padding: '.4rem' }}>{j.source_user}@{j.source_host}</td>
                <td style={{ padding: '.4rem' }}>{j.destination_user}@{j.destination_host}</td>
                <td style={{ padding: '.4rem' }}>{j.interval_minutes} min</td>
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
