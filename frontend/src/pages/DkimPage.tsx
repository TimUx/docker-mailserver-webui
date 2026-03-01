import { useCallback, useEffect, useState } from 'react';
import { api, csrfHeaders } from '../api/client';
import { useAuth } from '../contexts/auth';
import { useTranslation } from '../i18n';
import { useRefreshListener } from '../hooks/useRefreshListener';

type Domain = { domain: string; description: string; managed: boolean };
type DkimKey = { domain: string; selector: string; dns_record: string; created_at: string | null };

type DkimState = {
  key: DkimKey | null;
  generating: boolean;
  error: string;
  selector: string;
  bits: number;
  expanded: boolean;
};

export function DkimPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [dkimMap, setDkimMap] = useState<Record<string, DkimKey>>({});
  const [states, setStates] = useState<Record<string, DkimState>>({});
  const [loadError, setLoadError] = useState('');
  const csrf = useAuth((s) => s.csrfToken);
  const { t } = useTranslation();

  const defaultState = (key: DkimKey | null): DkimState => ({
    key,
    generating: false,
    error: '',
    selector: 'dkim',
    bits: 2048,
    expanded: false,
  });

  const load = useCallback(() => {
    setLoadError('');
    Promise.all([
      api.get('/dms/domains'),
      api.get('/dkim'),
    ]).then(([domainsRes, dkimRes]) => {
      const domainList: Domain[] = domainsRes.data.domains;
      setDomains(domainList);
      const keys: DkimKey[] = dkimRes.data.keys;
      const map: Record<string, DkimKey> = {};
      for (const k of keys) map[k.domain] = k;
      setDkimMap(map);
      setStates((prev) => {
        const next: Record<string, DkimState> = {};
        for (const d of domainList) {
          next[d.domain] = prev[d.domain] ?? defaultState(map[d.domain] ?? null);
          next[d.domain].key = map[d.domain] ?? null;
        }
        return next;
      });
    }).catch(() => setLoadError(t.dkim.failed_load));
  }, [t]);

  useEffect(() => { load(); }, [load]);
  useRefreshListener(load);

  const setState = (domain: string, patch: Partial<DkimState>) => {
    setStates((prev) => ({ ...prev, [domain]: { ...prev[domain], ...patch } }));
  };

  const generate = async (domain: string) => {
    const s = states[domain];
    if (!s) return;
    setState(domain, { generating: true, error: '' });
    try {
      const res = await api.post('/dkim/generate', {
        domain,
        selector: s.selector || 'dkim',
        bits: s.bits,
      }, { headers: csrfHeaders(csrf) });
      const key: DkimKey = res.data;
      setDkimMap((prev) => ({ ...prev, [domain]: key }));
      setState(domain, { generating: false, key, expanded: true });
    } catch (e: any) {
      setState(domain, {
        generating: false,
        error: e?.response?.data?.detail ?? t.dkim.failed_generate,
      });
    }
  };

  return (
    <div className="panel">
      <h1>{t.dkim.title}</h1>
      <p>{t.dkim.desc}</p>
      {loadError && <p style={{ color: 'var(--color-warn, #f59e0b)' }}>{loadError}</p>}

      {domains.length === 0 && !loadError && (
        <p style={{ opacity: .5 }}>{t.domains.no_domains}</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem', marginTop: '.5rem' }}>
        {domains.map((d) => {
          const s = states[d.domain];
          if (!s) return null;
          const hasKey = !!s.key;
          return (
            <div key={d.domain} className="panel" style={{ padding: '.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, flex: 1, minWidth: 0, wordBreak: 'break-all' }}>{d.domain}</span>
                <span style={{
                  fontSize: '.8rem',
                  padding: '.1rem .5rem',
                  borderRadius: '.3rem',
                  background: hasKey ? 'rgba(34,197,94,.15)' : 'rgba(245,158,11,.15)',
                  color: hasKey ? '#16a34a' : '#b45309',
                  whiteSpace: 'nowrap',
                }}>
                  {hasKey ? t.dkim.configured : t.dkim.not_configured}
                </span>
                <button
                  style={{ flexShrink: 0 }}
                  onClick={() => setState(d.domain, { expanded: !s.expanded })}
                >
                  {hasKey ? t.dkim.regenerate : t.dkim.generate}
                </button>
                {hasKey && (
                  <button
                    style={{ flexShrink: 0 }}
                    onClick={() => setState(d.domain, { expanded: !s.expanded })}
                  >
                    {s.expanded ? '▲' : '▼'}
                  </button>
                )}
              </div>

              {s.expanded && (
                <div style={{ marginTop: '.75rem', borderTop: '1px solid var(--border)', paddingTop: '.75rem' }}>
                  {/* Key generation form */}
                  <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginBottom: '.75rem', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '.2rem' }}>
                      <label style={{ fontSize: '.75rem', opacity: .7 }}>{t.dkim.selector_ph}</label>
                      <input
                        value={s.selector}
                        onChange={(e) => setState(d.domain, { selector: e.target.value })}
                        placeholder={t.dkim.selector_ph}
                        style={{ width: '120px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '.2rem' }}>
                      <label style={{ fontSize: '.75rem', opacity: .7 }}>{t.dkim.bits_label}</label>
                      <select
                        value={s.bits}
                        onChange={(e) => setState(d.domain, { bits: Number(e.target.value) })}
                        style={{ width: '100px' }}
                      >
                        <option value={1024}>1024</option>
                        <option value={2048}>2048</option>
                        <option value={4096}>4096</option>
                      </select>
                    </div>
                    <button
                      onClick={() => generate(d.domain)}
                      disabled={s.generating}
                      style={{ alignSelf: 'flex-end' }}
                    >
                      {s.generating ? t.dkim.generating : (hasKey ? t.dkim.regenerate : t.dkim.generate)}
                    </button>
                  </div>
                  {s.error && <p style={{ color: 'var(--color-warn, #f59e0b)', marginBottom: '.5rem' }}>{s.error}</p>}

                  {/* DNS record display */}
                  {s.key && (
                    <div>
                      <div style={{ fontSize: '.8rem', opacity: .7, marginBottom: '.3rem' }}>
                        {t.dkim.dns_record}
                        {' · '}
                        <code style={{ fontSize: '.8rem' }}>{s.key.selector}._domainkey.{d.domain}</code>
                        {s.key.created_at && (
                          <span style={{ marginLeft: '.5rem', fontSize: '.75rem' }}>
                            ({new Date(s.key.created_at).toLocaleString()})
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '.5rem', alignItems: 'flex-start' }}>
                        <pre style={{
                          flex: 1,
                          background: 'var(--surface-2)',
                          borderRadius: '.3rem',
                          padding: '.5rem .75rem',
                          fontSize: '.8rem',
                          fontFamily: 'monospace',
                          wordBreak: 'break-all',
                          whiteSpace: 'pre-wrap',
                          margin: 0,
                        }}>
                          {s.key.dns_record}
                        </pre>
                        <button
                          style={{ flexShrink: 0 }}
                          onClick={() => navigator.clipboard.writeText(s.key!.dns_record).catch(() => undefined)}
                          title={t.dkim.copy_record}
                        >
                          {t.dkim.copy_record}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
