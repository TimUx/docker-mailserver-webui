import { useEffect, useState } from 'react';
import { api, csrfHeaders } from '../api/client';
import { useAuth } from '../contexts/auth';

export function ImapSyncPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const csrf = useAuth((s) => s.csrfToken);
  const load = () => api.get('/imapsync').then((r) => setJobs(r.data));
  useEffect(load, []);
  const run = async (id: number) => { await api.post(`/imapsync/${id}/run`, {}, { headers: csrfHeaders(csrf) }); load(); };
  return <div className='panel'><h1>IMAPSync</h1><ul>{jobs.map((j)=><li key={j.id}>{j.name} - {j.last_status} <button onClick={()=>run(j.id)}>Run</button></li>)}</ul></div>;
}
