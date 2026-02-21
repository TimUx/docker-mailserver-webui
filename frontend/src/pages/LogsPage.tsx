import { useEffect, useState } from 'react';
import { api } from '../api/client';

export function LogsPage() {
  const [type, setType] = useState('mailserver');
  const [logs, setLogs] = useState<string[]>(['[info] mail queue started', '[warn] login rate-limit active']);
  useEffect(() => { api.get(`/logs/${type}`).then((r) => setLogs(r.data.lines)).catch(() => undefined); }, [type]);
  return <div className='panel'><h1>🧾 Logs</h1><select value={type} onChange={(e)=>setType(e.target.value)}><option>mailserver</option><option>imapsync</option><option>webui</option></select><pre>{logs.join('\n')}</pre></div>;
}
