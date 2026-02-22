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
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwState, setPwState] = useState<SaveState>('idle');
  const [pwError, setPwError] = useState('');
  const csrf = useAuth((s) => s.csrfToken);

  const load = useCallback(() => {
    api.get('/settings/').then((r) => setSettings(r.data)).catch(() => undefined);
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
                <input
                  id={key}
                  value={settings[key] ?? ''}
                  onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
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

