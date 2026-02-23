import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { useTranslation } from '../i18n';
import { useRefreshListener } from '../hooks/useRefreshListener';

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

type Domain = { domain: string; description: string; managed: boolean };

const CLIENT_ICONS: Record<string, string> = {
  thunderbird: '🦅',
  outlook: '📧',
  android: '🤖',
  ios: '🍎',
};

export function MailProfilePage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [domain, setDomain] = useState('');
  const [hostname, setHostname] = useState('');
  const [result, setResult] = useState<ProfileResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { t } = useTranslation();

  const loadDomains = useCallback(() => {
    api.get('/dms/domains').then((r) => setDomains(r.data.domains)).catch(() => undefined);
  }, []);

  useEffect(() => { loadDomains(); }, [loadDomains]);
  useRefreshListener(loadDomains);

  const generate = useCallback(async (domainName: string, hostnameOverride?: string) => {
    setError('');
    if (!domainName.trim()) { setError(t.mail_profiles.enter_domain); return; }
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (hostnameOverride) params.hostname = hostnameOverride;
      const r = await api.get(`/mail-profile/${domainName.trim()}`, { params });
      setResult(r.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? t.mail_profiles.failed_generate);
    } finally {
      setLoading(false);
    }
  }, [t]);

  const handleTabClick = (d: string) => {
    setActiveTab(d);
    setDomain(d);
    setHostname('');
    void generate(d);
  };

  const handleGenerate = () => {
    setActiveTab(null);
    void generate(domain, hostname);
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
      <h1>{t.mail_profiles.title}</h1>
      <p>{t.mail_profiles.desc}</p>

      {domains.length > 0 && (
        <div className="domain-tabs">
          {domains.map((d) => (
            <button
              key={d.domain}
              className={`domain-tab${activeTab === d.domain ? ' active' : ''}`}
              onClick={() => handleTabClick(d.domain)}
            >
              {d.domain}
            </button>
          ))}
          <button
            className={`domain-tab${activeTab === null && !domain ? ' active' : ''}`}
            onClick={() => { setActiveTab(null); setDomain(''); setResult(null); }}
            title={t.mail_profiles.custom}
          >
            {t.mail_profiles.custom}
          </button>
        </div>
      )}

      <div className="row" style={{ marginBottom: '.5rem', gap: '.5rem' }}>
        <input
          placeholder={t.dns_wizard.domain_ph}
          value={domain}
          onChange={(e) => { setDomain(e.target.value); setActiveTab(null); }}
          style={{ flex: 2 }}
        />
        <input
          placeholder={t.dns_wizard.hostname_ph}
          value={hostname}
          onChange={(e) => setHostname(e.target.value)}
          style={{ flex: 2 }}
        />
        <button onClick={handleGenerate} disabled={loading}>
          {loading ? '…' : t.dns_wizard.generate}
        </button>
      </div>
      {error && <p style={{ color: 'var(--color-warn, #f59e0b)' }}>{error}</p>}

      {result && (
        <>
          <h2 style={{ marginTop: '1rem' }}>{t.mail_profiles.server_settings_for} <code>{result.domain}</code></h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.25rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '.4rem .5rem' }}>{t.mail_profiles.protocol_col}</th>
                <th style={{ textAlign: 'left', padding: '.4rem .5rem' }}>{t.mail_profiles.server_port_col}</th>
                <th style={{ textAlign: 'left', padding: '.4rem .5rem' }}>{t.mail_profiles.username_col}</th>
              </tr>
            </thead>
            <tbody>
              {serverRow(t.mail_profiles.imap_receive, result.imap)}
              {serverRow(t.mail_profiles.pop3_receive, result.pop3)}
              {serverRow(t.mail_profiles.smtp_send, result.smtp)}
            </tbody>
          </table>

          <h2>{t.mail_profiles.client_profiles}</h2>
          <div className="stats-grid" style={{ marginTop: '.5rem' }}>
            {Object.entries(result.clients).map(([key, client]) => (
              <div key={key} className="stat-card" style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '1.3rem', marginBottom: '.3rem' }}>
                  {CLIENT_ICONS[key] ?? '📬'} {client.name}
                </div>
                {client.protocol && (
                  <div style={{ fontSize: '.8rem', opacity: .7, marginBottom: '.25rem' }}>{t.mail_profiles.protocol}: {client.protocol}</div>
                )}
                {client.incoming && (
                  <div style={{ fontSize: '.8rem', marginBottom: '.15rem' }}>
                    <span style={{ opacity: .6 }}>{t.mail_profiles.incoming}: </span>{client.incoming}
                  </div>
                )}
                {client.outgoing && (
                  <div style={{ fontSize: '.8rem', marginBottom: '.15rem' }}>
                    <span style={{ opacity: .6 }}>{t.mail_profiles.outgoing}: </span>{client.outgoing}
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
