import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../contexts/auth';
import { useTranslation } from '../i18n';
import { useRefreshListener } from '../hooks/useRefreshListener';

type DnsRecord = {
  type: string;
  name: string;
  value: string;
  ttl: number;
  description: string;
};

type WizardResult = {
  domain: string;
  hostname: string;
  server_ip: string;
  records: DnsRecord[];
};

type Domain = { domain: string; description: string; managed: boolean };

const TYPE_COLORS: Record<string, string> = {
  MX: '#3b82f6',
  A: '#22c55e',
  TXT: '#f59e0b',
  PTR: '#a78bfa',
};

export function DnsWizardPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [domain, setDomain] = useState('');
  const [hostname, setHostname] = useState('');
  const [serverIp, setServerIp] = useState('');
  const [result, setResult] = useState<WizardResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const _csrf = useAuth((s) => s.csrfToken);
  const { t } = useTranslation();

  const loadDomains = useCallback(() => {
    api.get('/dms/domains').then((r) => setDomains(r.data.domains)).catch(() => undefined);
  }, []);

  useEffect(() => { loadDomains(); }, [loadDomains]);
  useRefreshListener(loadDomains);

  const generate = useCallback(async (domainName: string, hostnameOverride?: string, ip?: string) => {
    setError('');
    if (!domainName.trim()) { setError(t.dns_wizard.enter_domain); return; }
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (hostnameOverride) params.hostname = hostnameOverride;
      if (ip) params.server_ip = ip;
      const r = await api.get(`/dns-wizard/${domainName.trim()}`, { params });
      setResult(r.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? t.dns_wizard.failed_generate);
    } finally {
      setLoading(false);
    }
  }, [t]);

  const handleTabClick = (d: string) => {
    setActiveTab(d);
    setDomain(d);
    setHostname('');
    setServerIp('');
    void generate(d);
  };

  const handleGenerate = () => {
    setActiveTab(null);
    void generate(domain, hostname, serverIp);
  };

  const copyAll = () => {
    if (!result) return;
    const text = result.records
      .map((r) => `; ${r.description}\n${r.name}\t${r.ttl}\tIN\t${r.type}\t${r.value}`)
      .join('\n\n');
    navigator.clipboard.writeText(text).catch(() => undefined);
  };

  return (
    <div className="panel">
      <h1>{t.dns_wizard.title}</h1>
      <p>{t.dns_wizard.desc}</p>

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
            title={t.dns_wizard.custom}
          >
            {t.dns_wizard.custom}
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
        <input
          placeholder={t.dns_wizard.ip_ph}
          value={serverIp}
          onChange={(e) => setServerIp(e.target.value)}
          style={{ flex: 1 }}
        />
        <button onClick={handleGenerate} disabled={loading}>
          {loading ? '…' : t.dns_wizard.generate}
        </button>
      </div>
      {error && <p style={{ color: 'var(--color-warn, #f59e0b)' }}>{error}</p>}

      {result && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
            <h2 style={{ margin: 0 }}>{t.dns_wizard.records_for} <code>{result.domain}</code></h2>
            <button onClick={copyAll}>{t.dns_wizard.copy_all}</button>
          </div>
          <p style={{ opacity: .7, fontSize: '.85rem', marginTop: '.25rem' }}>
            {t.dns_wizard.mail_hostname}: <strong>{result.hostname}</strong>
            {result.server_ip && <> · {t.dns_wizard.server_ip}: <strong>{result.server_ip}</strong></>}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem', marginTop: '.75rem' }}>
            {result.records.map((rec, i) => (
              <div key={i} className="panel" style={{ padding: '.75rem', position: 'relative' }}>
                <div style={{ display: 'flex', gap: '.75rem', alignItems: 'flex-start' }}>
                  <span style={{
                    background: TYPE_COLORS[rec.type] ?? '#64748b',
                    color: '#fff',
                    borderRadius: '.3rem',
                    padding: '.15rem .45rem',
                    fontWeight: 700,
                    fontSize: '.8rem',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}>{rec.type}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '.8rem', opacity: .7, marginBottom: '.2rem' }}>{rec.description}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '.85rem', wordBreak: 'break-all' }}>
                      <span style={{ opacity: .6 }}>Name: </span>{rec.name}
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: '.85rem', wordBreak: 'break-all' }}>
                      <span style={{ opacity: .6 }}>Value: </span>{rec.value}
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: '.8rem', opacity: .6 }}>TTL: {rec.ttl}s</div>
                  </div>
                  <button
                    style={{ flexShrink: 0 }}
                    onClick={() => navigator.clipboard.writeText(rec.value).catch(() => undefined)}
                    title="Copy value"
                  >📋</button>
                </div>
              </div>
            ))}
          </div>

          <div className="panel" style={{ marginTop: '1rem', padding: '.75rem', background: 'var(--surface-2)' }}>
            <strong>{t.dns_wizard.setup_checklist}</strong>
            <ol style={{ margin: '.5rem 0 0 1rem', lineHeight: 1.8 }}>
              <li>Add the <strong>A</strong> record so <code>{result.hostname}</code> resolves to your server</li>
              <li>Add the <strong>MX</strong> record to route email to <code>{result.hostname}</code></li>
              <li>Add the <strong>SPF TXT</strong> record to authorise sending</li>
              <li>Generate DKIM keys: use the <strong>DKIM Keys</strong> page or run: <code>docker exec mail-rspamd rspamadm dkim_keygen -d {result.domain} -s dkim -k /var/lib/rspamd/dkim/{result.domain}.dkim.key -b 2048</code></li>
              <li>Copy the <strong>DKIM TXT</strong> record from the DKIM Keys page and add it to DNS</li>
              <li>Add the <strong>DMARC TXT</strong> record (start with <code>p=none</code>, then tighten once verified)</li>
              <li>Set the <strong>PTR</strong> (rDNS) record with your hosting provider</li>
            </ol>
          </div>
        </>
      )}
    </div>
  );
}
