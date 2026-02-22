import { useState } from 'react';
import { api } from '../api/client';

type ClientInfo = {
  name: string;
  protocol?: string;
  incoming?: string;
  outgoing?: string;
  note?: string;
  autoconfig_url?: string;
  mobileconfig_url?: string;
  instructions?: string;
};

type ProfileResult = {
  domain: string;
  hostname: string;
  imap: { host: string; port: number; security: string; username: string };
  pop3: { host: string; port: number; security: string; username: string };
  smtp: { host: string; port: number; security: string; username: string };
  clients: Record<string, ClientInfo>;
};

const CLIENT_ICONS: Record<string, string> = {
  thunderbird: '🦅',
  outlook: '📧',
  android: '🤖',
  ios: '🍎',
};

export function MailProfilePage() {
  const [domain, setDomain] = useState('');
  const [hostname, setHostname] = useState('');
  const [result, setResult] = useState<ProfileResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    setError('');
    if (!domain.trim()) { setError('Please enter a domain name'); return; }
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (hostname) params.hostname = hostname;
      const r = await api.get(`/mail-profile/${domain.trim()}`, { params });
      setResult(r.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to generate profile');
    } finally {
      setLoading(false);
    }
  };

  const serverRow = (label: string, data: { host: string; port: number; security: string; username: string }) => (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td style={{ padding: '.4rem .5rem', opacity: .7, whiteSpace: 'nowrap' }}>{label}</td>
      <td style={{ padding: '.4rem .5rem', fontFamily: 'monospace', fontSize: '.85rem' }}>
        {data.host}:{data.port} · {data.security}
      </td>
      <td style={{ padding: '.4rem .5rem', fontSize: '.8rem', opacity: .8 }}>{data.username}</td>
    </tr>
  );

  return (
    <div className="panel">
      <h1>📱 Mail Profiles</h1>
      <p>Generate email client configuration profiles and settings for your mail domain.</p>

      <div className="row" style={{ marginBottom: '.5rem', gap: '.5rem' }}>
        <input
          placeholder="Domain (e.g. example.com)"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          style={{ flex: 2 }}
        />
        <input
          placeholder="Mail hostname (default: mail.<domain>)"
          value={hostname}
          onChange={(e) => setHostname(e.target.value)}
          style={{ flex: 2 }}
        />
        <button onClick={generate} disabled={loading}>
          {loading ? '…' : '⚡ Generate'}
        </button>
      </div>
      {error && <p style={{ color: 'var(--color-warn, #f59e0b)' }}>{error}</p>}

      {result && (
        <>
          <h2 style={{ marginTop: '1rem' }}>Server Settings for <code>{result.domain}</code></h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.25rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '.4rem .5rem' }}>Protocol</th>
                <th style={{ textAlign: 'left', padding: '.4rem .5rem' }}>Server &amp; Port</th>
                <th style={{ textAlign: 'left', padding: '.4rem .5rem' }}>Username</th>
              </tr>
            </thead>
            <tbody>
              {serverRow('IMAP (receive)', result.imap)}
              {serverRow('POP3 (receive)', result.pop3)}
              {serverRow('SMTP (send)', result.smtp)}
            </tbody>
          </table>

          <h2>Client Profiles</h2>
          <div className="stats-grid" style={{ marginTop: '.5rem' }}>
            {Object.entries(result.clients).map(([key, client]) => (
              <div key={key} className="stat-card" style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '1.3rem', marginBottom: '.3rem' }}>
                  {CLIENT_ICONS[key] ?? '📬'} {client.name}
                </div>
                {client.protocol && (
                  <div style={{ fontSize: '.8rem', opacity: .7, marginBottom: '.25rem' }}>Protocol: {client.protocol}</div>
                )}
                {client.incoming && (
                  <div style={{ fontSize: '.8rem', marginBottom: '.15rem' }}>
                    <span style={{ opacity: .6 }}>Incoming: </span>{client.incoming}
                  </div>
                )}
                {client.outgoing && (
                  <div style={{ fontSize: '.8rem', marginBottom: '.15rem' }}>
                    <span style={{ opacity: .6 }}>Outgoing: </span>{client.outgoing}
                  </div>
                )}
                {client.note && (
                  <div style={{ fontSize: '.8rem', opacity: .65, marginTop: '.25rem' }}>{client.note}</div>
                )}
                {client.instructions && (
                  <div style={{ fontSize: '.8rem', opacity: .75, marginTop: '.25rem' }}>{client.instructions}</div>
                )}
                <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginTop: '.5rem' }}>
                  {client.autoconfig_url && (
                    <a
                      href={`/api/mail-profile/${result.domain}/autoconfig.xml`}
                      target="_blank"
                      rel="noreferrer"
                      className="button-link"
                    >
                      ⬇ Autoconfig XML
                    </a>
                  )}
                  {client.mobileconfig_url && (
                    <a
                      href={`/api/mail-profile/${result.domain}/ios.mobileconfig`}
                      target="_blank"
                      rel="noreferrer"
                      className="button-link"
                    >
                      ⬇ .mobileconfig
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
