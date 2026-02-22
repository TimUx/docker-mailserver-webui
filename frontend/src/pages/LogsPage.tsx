import { useEffect, useState } from 'react';
import { api } from '../api/client';

export function LogsPage() {
  const [type, setType] = useState('mailserver');
  const [lines, setLines] = useState(200);
  const [search, setSearch] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const load = (logType: string, logLines: number, logSearch: string) => {
    setLoading(true);
    const params: Record<string, string | number> = { lines: logLines };
    if (logSearch) params.search = logSearch;
    api
      .get(`/logs/${logType}`, { params })
      .then((r) => setLogs(r.data.lines ?? []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  };

  // Reload automatically when log type changes; lines/search require explicit Refresh
  // to avoid firing on every keystroke or every dropdown change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(type, lines, search); }, [type]);

  return (
    <div className="panel">
      <h1>🧾 Logs</h1>
      <div className="row" style={{ gap: '.5rem', marginBottom: '.75rem', alignItems: 'center' }}>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="mailserver">Mail Server</option>
          <option value="imapsync">IMAP Sync</option>
          <option value="webui">WebUI</option>
        </select>
        <select value={lines} onChange={(e) => setLines(Number(e.target.value))}>
          {[100, 200, 500, 1000].map((n) => (
            <option key={n} value={n}>{n} lines</option>
          ))}
        </select>
        <input
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1 }}
        />
        <button onClick={() => load(type, lines, search)}>🔄 Refresh</button>
      </div>
      {loading ? (
        <p>Loading…</p>
      ) : logs.length === 0 ? (
        <p style={{ opacity: 0.6 }}>No log entries found.</p>
      ) : (
        <pre style={{ overflowX: 'auto', fontSize: '.8rem', maxHeight: '60vh', overflowY: 'auto' }}>
          {logs.join('\n')}
        </pre>
      )}
    </div>
  );
}
