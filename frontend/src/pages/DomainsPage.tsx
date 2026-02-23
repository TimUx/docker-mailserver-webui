import { useCallback, useEffect, useState } from 'react';
import { api, csrfHeaders } from '../api/client';
import { useAuth } from '../contexts/auth';
import { useTranslation } from '../i18n';
import { useRefreshListener } from '../hooks/useRefreshListener';

type Domain = { domain: string; description: string; managed: boolean };

export function DomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [accountCounts, setAccountCounts] = useState<Record<string, number>>({});
  const [aliasCounts, setAliasCounts] = useState<Record<string, number>>({});
  const [domain, setDomain] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const csrf = useAuth((s) => s.csrfToken);
  const { t } = useTranslation();

  const load = useCallback(() => {
    api.get('/dms/domains').then((r) => setDomains(r.data.domains)).catch(() => undefined);
    api.get('/dms/accounts').then((r) => {
      const counts: Record<string, number> = {};
      for (const acc of (r.data.accounts ?? [])) {
        const d = acc.email?.split('@')[1];
        if (d) counts[d] = (counts[d] ?? 0) + 1;
      }
      setAccountCounts(counts);
    }).catch(() => undefined);
    api.get('/dms/aliases').then((r) => {
      const counts: Record<string, number> = {};
      for (const entry of (r.data.aliases ?? [])) {
        const parts = (entry as string).trim().split(/\s+/).filter(Boolean);
        const offset = parts[0] === '*' ? 1 : 0;
        const aliasAddr = parts[offset] ?? '';
        const d = aliasAddr.split('@')[1];
        if (d) counts[d] = (counts[d] ?? 0) + 1;
      }
      setAliasCounts(counts);
    }).catch(() => undefined);
  }, []);

  useEffect(() => { load(); }, [load]);
  useRefreshListener(load);

  const create = async () => {
    setError('');
    if (!domain.trim()) { setError(t.domains.domain_required); return; }
    try {
      await api.post('/dms/domains', { domain: domain.trim(), description }, { headers: csrfHeaders(csrf) });
      setDomain('');
      setDescription('');
      void load();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? t.domains.failed_add);
    }
  };

  const remove = async (d: string) => {
    if (!confirm(t.domains.delete_confirm(d))) return;
    try {
      await api.delete('/dms/domains', { data: { domain: d }, headers: csrfHeaders(csrf) });
      void load();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? t.domains.failed_remove);
    }
  };

  return (
    <div className="panel">
      <h1>{t.domains.title}</h1>

      <div className="row" style={{ marginBottom: '.5rem' }}>
        <input
          placeholder={t.domains.domain_ph}
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          style={{ flex: 1 }}
        />
        <input
          placeholder={t.domains.desc_ph}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ flex: 1 }}
        />
        <button onClick={create}>{t.common.add}</button>
      </div>
      {error && <p style={{ color: 'var(--color-warn, #f59e0b)' }}>{error}</p>}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={{ textAlign: 'left', padding: '.4rem .5rem' }}>{t.common.domain}</th>
            <th style={{ textAlign: 'left', padding: '.4rem .5rem' }}>{t.domains.description_col}</th>
            <th style={{ textAlign: 'left', padding: '.4rem .5rem' }}>{t.domains.source_col}</th>
            <th style={{ textAlign: 'right', padding: '.4rem .5rem' }}>{t.domains.accounts_col}</th>
            <th style={{ textAlign: 'right', padding: '.4rem .5rem' }}>{t.domains.aliases_col}</th>
            <th style={{ textAlign: 'right', padding: '.4rem .5rem' }}>{t.common.actions}</th>
          </tr>
        </thead>
        <tbody>
          {domains.map((d) => (
            <tr key={d.domain} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '.4rem .5rem', fontWeight: 500 }}>{d.domain}</td>
              <td style={{ padding: '.4rem .5rem', opacity: .75, fontSize: '.85rem' }}>{d.description}</td>
              <td style={{ padding: '.4rem .5rem', fontSize: '.8rem', opacity: .7 }}>
                {d.managed ? t.domains.managed : t.domains.auto_detected}
              </td>
              <td style={{ padding: '.4rem .5rem', textAlign: 'right', fontSize: '.85rem' }}>
                {accountCounts[d.domain] ?? 0}
              </td>
              <td style={{ padding: '.4rem .5rem', textAlign: 'right', fontSize: '.85rem' }}>
                {aliasCounts[d.domain] ?? 0}
              </td>
              <td style={{ padding: '.4rem .5rem', whiteSpace: 'nowrap', textAlign: 'right' }}>
                {d.managed && (
                  <button
                    onClick={() => remove(d.domain)}
                    title={t.common.delete}
                    style={{ color: '#ef4444' }}
                  >🗑</button>
                )}
              </td>
            </tr>
          ))}
          {domains.length === 0 && (
            <tr><td colSpan={6} style={{ padding: '.75rem .5rem', opacity: .5 }}>{t.domains.no_domains}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

