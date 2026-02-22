import { useCallback, useEffect, useState } from 'react';
import { api, csrfHeaders } from '../api/client';
import { useAuth } from '../contexts/auth';
import { useRefreshListener } from '../hooks/useRefreshListener';

const LABELS: Record<string, string> = {
  dms_container_name: 'Mail Server Container Name',
  dms_setup_path: 'DMS Setup Command Path',
  rspamd_container_name: 'Rspamd Container Name',
  redis_container_name: 'Redis Container Name',
  clamav_container_name: 'ClamAV Container Name',
  rspamd_controller_url: 'Rspamd Controller URL',
  rspamd_controller_password: 'Rspamd Controller Password',
  rspamd_web_host: 'Rspamd Web Host',
  mail_log_path: 'Mail Log Path',
  imapsync_log_path: 'IMAP Sync Log Path',
  webui_log_path: 'WebUI Log Path',
  scheduler_timezone: 'Scheduler Timezone',
  cors_origins: 'CORS Origins (comma-separated)',
  admin_email: 'Admin E-Mail',
  cookie_secure: 'Secure Cookie (true/false)',
  access_token_minutes: 'Session Duration (minutes)',
  mailserver_env_path: 'mailserver.env Path',
};

const PASSWORD_FIELDS = new Set(['rspamd_controller_password']);

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

// ── DMS env types ──────────────────────────────────────────────────────────
type DmsEnvField = {
  key: string;
  type: 'bool' | 'text' | 'select';
  default: string;
  group: string;
  label: string;
  options?: string[];
};

export function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwState, setPwState] = useState<SaveState>('idle');
  const [pwError, setPwError] = useState('');
  const [showPwFields, setShowPwFields] = useState<Record<string, boolean>>({});
  const csrf = useAuth((s) => s.csrfToken);

  // DMS env state
  const [dmsEnvSchema, setDmsEnvSchema] = useState<DmsEnvField[]>([]);
  const [dmsEnvValues, setDmsEnvValues] = useState<Record<string, string>>({});
  const [dmsEnvPath, setDmsEnvPath] = useState('');
  const [dmsEnvSaveState, setDmsEnvSaveState] = useState<SaveState>('idle');
  const [dmsEnvError, setDmsEnvError] = useState('');

  const load = useCallback(() => {
    api.get('/settings/').then((r) => setSettings(r.data)).catch(() => undefined);
    api.get('/settings/dms-env')
      .then((r) => {
        setDmsEnvSchema(r.data.schema ?? []);
        setDmsEnvValues(r.data.values ?? {});
        setDmsEnvPath(r.data.path ?? '');
        setDmsEnvError('');
      })
      .catch(() => setDmsEnvError('Could not read mailserver.env — make sure the path is correct and the file is mounted into the container.'));
  }, []);

  useEffect(() => { load(); }, [load]);
  useRefreshListener(load);

  const save = async () => {
    setSaveState('saving');
    try {
      await api.put('/settings/', { settings }, { headers: csrfHeaders(csrf) });
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 3000);
    } catch {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 4000);
    }
  };

  const saveDmsEnv = async () => {
    setDmsEnvSaveState('saving');
    try {
      await api.put('/settings/dms-env', { settings: dmsEnvValues }, { headers: csrfHeaders(csrf) });
      setDmsEnvSaveState('saved');
      setTimeout(() => setDmsEnvSaveState('idle'), 3000);
    } catch (e: any) {
      setDmsEnvError(e?.response?.data?.detail ?? 'Failed to save');
      setDmsEnvSaveState('error');
      setTimeout(() => setDmsEnvSaveState('idle'), 4000);
    }
  };

  const setDmsEnvField = (key: string, value: string) =>
    setDmsEnvValues((prev) => ({ ...prev, [key]: value }));

  const changePassword = async () => {
    setPwError('');
    setPwState('saving');
    try {
      await api.put('/auth/password', { current_password: currentPw, new_password: newPw }, { headers: csrfHeaders(csrf) });
      setPwState('saved');
      setCurrentPw('');
      setNewPw('');
      setTimeout(() => setPwState('idle'), 3000);
    } catch (e: any) {
      setPwError(e?.response?.data?.detail ?? 'Failed to change password');
      setPwState('error');
      setTimeout(() => setPwState('idle'), 4000);
    }
  };

  // Group DMS env fields by their "group" property
  const dmsGroups = dmsEnvSchema.reduce<Record<string, DmsEnvField[]>>((acc, field) => {
    (acc[field.group] ??= []).push(field);
    return acc;
  }, {});

  return (
    <div className="panel">
      <h1>⚙️ Settings</h1>
      <p>
        On first start the values below are seeded from environment variables.
        Changes made here are persisted in the database and take effect immediately
        (container names and paths apply on next request).
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {Object.entries(LABELS).map(([key, label]) => (
            <tr key={key} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '.5rem .75rem .5rem 0', whiteSpace: 'nowrap', opacity: .75, width: '40%' }}>
                <label htmlFor={key}>{label}</label>
              </td>
              <td style={{ padding: '.5rem 0' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <input
                    id={key}
                    type={PASSWORD_FIELDS.has(key) && !showPwFields[key] ? 'password' : 'text'}
                    value={settings[key] ?? ''}
                    onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                  {PASSWORD_FIELDS.has(key) && (
                    <button
                      type="button"
                      title={showPwFields[key] ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPwFields((prev) => ({ ...prev, [key]: !prev[key] }))}
                      style={{ flexShrink: 0 }}
                    >
                      {showPwFields[key] ? '🙈' : '👁'}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <button onClick={save} disabled={saveState === 'saving'}>
          {saveState === 'saving' ? '…Saving' : '💾 Save Settings'}
        </button>
        {saveState === 'saved' && <span style={{ color: 'var(--color-ok, #22c55e)' }}>✔ Settings saved</span>}
        {saveState === 'error' && <span style={{ color: 'var(--color-warn, #f59e0b)' }}>✘ Save failed</span>}
      </div>

      {/* ── DMS Mail Server Configuration ───────────────────────────────── */}
      <hr style={{ margin: '1.5rem 0', borderColor: 'var(--border)' }} />
      <h2>📧 Mail Server Configuration</h2>
      <p style={{ fontSize: '.9rem', opacity: .8 }}>
        These settings are written to <code>{dmsEnvPath || 'mailserver.env'}</code> on the host.
        A DMS container restart is required for changes to take effect.
        Make sure the file is mounted into this container (see <em>mailserver_env_path</em> above).
      </p>
      {dmsEnvError && (
        <p style={{ color: 'var(--color-warn, #f59e0b)', fontSize: '.9rem' }}>⚠ {dmsEnvError}</p>
      )}

      {Object.entries(dmsGroups).map(([group, fields]) => (
        <div key={group} style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ marginBottom: '.5rem', fontSize: '1rem', opacity: .85 }}>{group}</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {fields.map((field) => {
                const value = dmsEnvValues[field.key] ?? field.default;
                return (
                  <tr key={field.key} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '.4rem .75rem .4rem 0', whiteSpace: 'nowrap', opacity: .75, width: '40%' }}>
                      <label htmlFor={`dmsenv-${field.key}`}>{field.label}</label>
                      <span style={{ marginLeft: '.4rem', fontSize: '.75rem', opacity: .55, fontFamily: 'monospace' }}>
                        {field.key}
                      </span>
                    </td>
                    <td style={{ padding: '.4rem 0' }}>
                      {field.type === 'bool' ? (
                        <input
                          id={`dmsenv-${field.key}`}
                          type="checkbox"
                          checked={value === '1'}
                          onChange={(e) => setDmsEnvField(field.key, e.target.checked ? '1' : '0')}
                        />
                      ) : field.type === 'select' && field.options ? (
                        <select
                          id={`dmsenv-${field.key}`}
                          value={value}
                          onChange={(e) => setDmsEnvField(field.key, e.target.value)}
                          style={{ width: '100%', boxSizing: 'border-box' }}
                        >
                          {field.options.map((opt) => (
                            <option key={opt} value={opt}>{opt || '(not set)'}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          id={`dmsenv-${field.key}`}
                          type="text"
                          value={value}
                          onChange={(e) => setDmsEnvField(field.key, e.target.value)}
                          style={{ width: '100%', boxSizing: 'border-box' }}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      <div style={{ marginTop: '.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <button onClick={saveDmsEnv} disabled={dmsEnvSaveState === 'saving'}>
          {dmsEnvSaveState === 'saving' ? '…Saving' : '💾 Save Mail Server Config'}
        </button>
        {dmsEnvSaveState === 'saved' && <span style={{ color: 'var(--color-ok, #22c55e)' }}>✔ Saved — restart DMS to apply</span>}
        {dmsEnvSaveState === 'error' && <span style={{ color: 'var(--color-warn, #f59e0b)' }}>✘ Save failed</span>}
      </div>

      {/* ── Change Admin Password ────────────────────────────────────────── */}
      <hr style={{ margin: '1.5rem 0', borderColor: 'var(--border)' }} />
      <h2>🔐 Change Admin Password</h2>
      <div className="row" style={{ flexDirection: 'column', gap: '.5rem', maxWidth: '360px' }}>
        <input
          type="password"
          placeholder="Current password"
          value={currentPw}
          onChange={(e) => setCurrentPw(e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box' }}
        />
        <input
          type="password"
          placeholder="New password (min. 8 chars)"
          value={newPw}
          onChange={(e) => setNewPw(e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button onClick={changePassword} disabled={pwState === 'saving' || !currentPw || newPw.length < 8}>
            {pwState === 'saving' ? '…Saving' : '🔑 Change Password'}
          </button>
          {pwState === 'saved' && <span style={{ color: 'var(--color-ok, #22c55e)' }}>✔ Password changed</span>}
          {pwState === 'error' && <span style={{ color: 'var(--color-warn, #f59e0b)' }}>✘ {pwError}</span>}
        </div>
      </div>
    </div>
  );
}

