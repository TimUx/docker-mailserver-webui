import { useCallback, useEffect, useState } from 'react';
import { api, csrfHeaders } from '../api/client';
import { useAuth } from '../contexts/auth';
import { useTranslation } from '../i18n';
import { useRefreshListener } from '../hooks/useRefreshListener';

type ServiceInfo = { status: string; message: string; container: string; dashboard_url?: string; version?: string };

type RspamdStat = {
  scanned?: number;
  spam_count?: number;
  ham_count?: number;
  connections?: number;
  uptime?: number;
  read_only?: boolean;
  version?: string;
  error?: string;
};

type ObservabilityData = {
  services: Record<string, ServiceInfo>;
  rspamd: {
    stat?: RspamdStat;
    actions?: Record<string, number>;
    symbols?: unknown;
    error?: string;
  };
};

type SupervisordProcess = { name: string; status: string; pid: number | null; uptime: string | null };
type SupervisordData = { ok: boolean; processes: SupervisordProcess[]; raw?: string };

type MailQueueEntry = { queue_id: string; size: number; date: string; sender: string };
type MailQueueData = { ok: boolean; count: number; entries: MailQueueEntry[]; raw?: string };

type DoveadmConn = { username: string; service: string; pid: string; ip: string; secured: boolean };
type DoveadmData = { ok: boolean; connections: DoveadmConn[]; count: number; raw?: string };

function statusColor(status: string): string {
  if (status === 'running') return 'var(--color-ok, #22c55e)';
  if (status === 'unknown') return 'var(--color-muted, #94a3b8)';
  return 'var(--color-warn, #f59e0b)';
}

function supervisorColor(status: string): string {
  if (status === 'RUNNING') return 'var(--color-ok, #22c55e)';
  if (status === 'STOPPED' || status === 'EXITED') return 'var(--color-warn, #f59e0b)';
  return 'var(--color-muted, #94a3b8)';
}

const SERVICE_ICONS: Record<string, string> = {
  rspamd: '🛡️',
  redis: '⚡',
  clamav: '🦠',
  mailserver: '📮',
};

const SERVICE_LABELS: Record<string, string> = {
  rspamd: 'Rspamd – Spam Filter',
  redis: 'Redis – Cache',
  clamav: 'ClamAV – Virus Scanner',
  mailserver: 'docker-mailserver',
};

export function ObservabilityPage() {
  const [data, setData] = useState<ObservabilityData | null>(null);
  const [supervisord, setSupervisord] = useState<SupervisordData | null>(null);
  const [mailq, setMailq] = useState<MailQueueData | null>(null);
  const [doveadm, setDoveadm] = useState<DoveadmData | null>(null);
  const csrf = useAuth((s) => s.csrfToken);
  const { t } = useTranslation();

  const load = useCallback(() => {
    api.get('/observability').then((r) => setData(r.data)).catch(() => undefined);
    api.get('/supervisorctl').then((r) => setSupervisord(r.data)).catch(() => undefined);
    api.get('/mailq').then((r) => setMailq(r.data)).catch(() => undefined);
    api.get('/doveadm/who').then((r) => setDoveadm(r.data)).catch(() => undefined);
  }, []);

  useEffect(() => { load(); }, [load]);
  useRefreshListener(load);

  const restart = async (name: string) => {
    await api.post(`/integrations/${name}/restart`, {}, { headers: csrfHeaders(csrf) });
    void load();
  };

  const stat = data?.rspamd?.stat;
  const actions = data?.rspamd?.actions;

  return (
    <div className="panel">
      <h1>{t.observability.title}</h1>
      <p>{t.observability.desc}</p>

      <h2>{t.observability.service_status}</h2>
      <div className="stats-grid">
        {data === null || data === undefined
          ? ['rspamd', 'redis', 'clamav', 'mailserver'].map((k) => (
              <div key={k} className="stat-card">
                {SERVICE_ICONS[k]} {SERVICE_LABELS[k]}<strong>…</strong>
              </div>
            ))
          : Object.entries(data.services ?? {}).map(([name, svc]) => (
              <div key={name} className="stat-card" style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '1.3rem', marginBottom: '.3rem' }}>
                  {SERVICE_ICONS[name] ?? '🔧'} {SERVICE_LABELS[name] ?? name}
                </div>
                <div style={{ marginBottom: '.25rem' }}>
                  {t.common.status}:{' '}
                  <strong style={{ color: statusColor(svc.status) }}>{svc.status}</strong>
                </div>
                {svc.message && (
                  <small style={{ display: 'block', opacity: .75, marginBottom: '.4rem' }}>
                    {svc.message}
                  </small>
                )}
                {svc.version && (
                  <small style={{ display: 'block', opacity: .75, marginBottom: '.4rem' }}>
                    🔖 {svc.version}
                  </small>
                )}
                <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginTop: '.4rem' }}>
                  <button onClick={() => restart(name)}>{t.observability.restart}</button>
                  {svc.dashboard_url && (
                    <a href={svc.dashboard_url} target="_blank" rel="noreferrer" className="button-link">
                      {t.observability.open_dashboard}
                    </a>
                  )}
                </div>
              </div>
            ))}
      </div>

      {/* Mail Queue */}
      <h2 style={{ marginTop: '1.5rem' }}>{t.observability.mail_queue}</h2>
      {mailq === null ? (
        <p style={{ opacity: .6 }}>{t.common.loading}</p>
      ) : !mailq.ok ? (
        <p style={{ opacity: .6 }}>{t.observability.mail_queue_unavailable(mailq.raw)}</p>
      ) : mailq.count === 0 ? (
        <p style={{ opacity: .75 }}>{t.observability.mail_queue_empty}</p>
      ) : (
        <>
          <p style={{ opacity: .75, marginBottom: '.5rem' }}>
            <strong>{mailq.count}</strong> {t.observability.mail_queue_messages(mailq.count).replace(String(mailq.count), '').trim()}
          </p>
          {mailq.entries.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '.35rem .5rem' }}>{t.observability.queue_id_col}</th>
                  <th style={{ textAlign: 'left', padding: '.35rem .5rem' }}>{t.observability.size_col}</th>
                  <th style={{ textAlign: 'left', padding: '.35rem .5rem' }}>{t.observability.date_col}</th>
                  <th style={{ textAlign: 'left', padding: '.35rem .5rem' }}>{t.observability.sender_col}</th>
                </tr>
              </thead>
              <tbody>
                {mailq.entries.map((entry) => (
                  <tr key={entry.queue_id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '.35rem .5rem', fontFamily: 'monospace', fontSize: '.85rem' }}>{entry.queue_id}</td>
                    <td style={{ padding: '.35rem .5rem', fontFamily: 'monospace', fontSize: '.85rem' }}>{entry.size}</td>
                    <td style={{ padding: '.35rem .5rem', fontSize: '.85rem', opacity: .75 }}>{entry.date}</td>
                    <td style={{ padding: '.35rem .5rem', fontFamily: 'monospace', fontSize: '.85rem' }}>{entry.sender}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <pre style={{ fontFamily: 'monospace', fontSize: '.8rem', opacity: .8, overflowX: 'auto', background: 'var(--surface-2)', padding: '.5rem', borderRadius: '.35rem' }}>
              {mailq.raw}
            </pre>
          )}
        </>
      )}

      {/* Active IMAP/POP3 Connections */}
      <h2 style={{ marginTop: '1.5rem' }}>{t.observability.active_connections}</h2>
      {doveadm === null ? (
        <p style={{ opacity: .6 }}>{t.common.loading}</p>
      ) : !doveadm.ok ? (
        <p style={{ opacity: .6 }}>{t.observability.doveadm_unavailable(doveadm.raw)}</p>
      ) : doveadm.count === 0 ? (
        <p style={{ opacity: .75 }}>{t.observability.no_connections}</p>
      ) : (
        <>
          <p style={{ opacity: .75, marginBottom: '.5rem' }}>
            <strong>{doveadm.count}</strong> {t.observability.active_connections_count(doveadm.count).replace(String(doveadm.count), '').trim()}
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '.35rem .5rem' }}>{t.observability.username_col}</th>
                <th style={{ textAlign: 'left', padding: '.35rem .5rem' }}>{t.observability.service_col}</th>
                <th style={{ textAlign: 'left', padding: '.35rem .5rem' }}>{t.observability.pid_col}</th>
                <th style={{ textAlign: 'left', padding: '.35rem .5rem' }}>{t.observability.ip_col}</th>
                <th style={{ textAlign: 'left', padding: '.35rem .5rem' }}>{t.observability.secured_col}</th>
              </tr>
            </thead>
            <tbody>
              {doveadm.connections.map((conn, i) => (
                <tr key={`${conn.username}-${conn.service}-${conn.pid}-${i}`} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '.35rem .5rem', fontFamily: 'monospace', fontSize: '.85rem' }}>{conn.username}</td>
                  <td style={{ padding: '.35rem .5rem', fontSize: '.85rem' }}>{conn.service}</td>
                  <td style={{ padding: '.35rem .5rem', fontFamily: 'monospace', fontSize: '.85rem', opacity: .75 }}>{conn.pid}</td>
                  <td style={{ padding: '.35rem .5rem', fontFamily: 'monospace', fontSize: '.85rem', opacity: .75 }}>{conn.ip}</td>
                  <td style={{ padding: '.35rem .5rem', fontSize: '.85rem' }}>{conn.secured ? '🔒' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Rspamd Stats */}
      <h2 style={{ marginTop: '1.5rem' }}>{t.observability.rspamd_stats}</h2>
      {data?.rspamd?.stat?.error ? (
        <p style={{ opacity: .7 }}>{t.observability.rspamd_unavailable(data.rspamd.stat.error)}</p>
      ) : stat ? (
        <>
          <div className="stats-grid" style={{ marginTop: '.5rem' }}>
            <div className="stat-card">
              {t.observability.scanned}<strong>{stat.scanned ?? '—'}</strong>
            </div>
            <div className="stat-card">
              {t.observability.spam}<strong>{stat.spam_count ?? '—'}</strong>
            </div>
            <div className="stat-card">
              {t.observability.ham}<strong>{stat.ham_count ?? '—'}</strong>
            </div>
            <div className="stat-card">
              {t.observability.connections}<strong>{stat.connections ?? '—'}</strong>
            </div>
            {stat.uptime !== undefined && (
              <div className="stat-card">
                {t.observability.uptime}<strong>{Math.round(stat.uptime / 3600)}h</strong>
              </div>
            )}
            {stat.version !== undefined && (
              <div className="stat-card">
                {t.observability.version}<strong>{stat.version}</strong>
              </div>
            )}
          </div>

          {actions && Object.keys(actions).length > 0 && (
            <>
              <h3 style={{ marginTop: '1rem' }}>{t.observability.actions_breakdown}</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '.35rem .5rem' }}>{t.observability.action_col}</th>
                    <th style={{ textAlign: 'right', padding: '.35rem .5rem' }}>{t.observability.count_col}</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(actions).map(([action, count]) => (
                    <tr key={action} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '.35rem .5rem', fontFamily: 'monospace', fontSize: '.85rem' }}>{action}</td>
                      <td style={{ padding: '.35rem .5rem', textAlign: 'right' }}>{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      ) : (
        <p style={{ opacity: .6 }}>{data === null || data === undefined ? t.common.loading : t.observability.no_rspamd}</p>
      )}

      {/* Supervisor process status */}
      <h2 style={{ marginTop: '1.5rem' }}>{t.observability.supervisor_status}</h2>
      {supervisord === null ? (
        <p style={{ opacity: .6 }}>{t.common.loading}</p>
      ) : supervisord.processes.length === 0 ? (
        supervisord.raw ? (
          <pre style={{ fontFamily: 'monospace', fontSize: '.82rem', opacity: .8, overflowX: 'auto', background: 'var(--surface-2)', padding: '.75rem', borderRadius: '.35rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {supervisord.raw}
          </pre>
        ) : (
          <p style={{ opacity: .6 }}>{t.observability.no_processes}</p>
        )
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '.5rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '.35rem .5rem' }}>{t.observability.process_col}</th>
              <th style={{ textAlign: 'left', padding: '.35rem .5rem' }}>{t.common.status}</th>
              <th style={{ textAlign: 'left', padding: '.35rem .5rem' }}>{t.observability.pid_col}</th>
              <th style={{ textAlign: 'left', padding: '.35rem .5rem' }}>{t.observability.uptime_col}</th>
            </tr>
          </thead>
          <tbody>
            {supervisord.processes.map((proc) => (
              <tr key={proc.name} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '.35rem .5rem', fontFamily: 'monospace', fontSize: '.85rem', fontWeight: 600 }}>{proc.name}</td>
                <td style={{ padding: '.35rem .5rem' }}>
                  <strong style={{ color: supervisorColor(proc.status), fontSize: '.85rem' }}>{proc.status}</strong>
                </td>
                <td style={{ padding: '.35rem .5rem', fontFamily: 'monospace', fontSize: '.85rem', opacity: .75 }}>{proc.pid ?? '—'}</td>
                <td style={{ padding: '.35rem .5rem', fontFamily: 'monospace', fontSize: '.85rem', opacity: .75 }}>{proc.uptime ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
