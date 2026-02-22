import { useEffect, useState } from 'react';
import { api } from '../api/client';

export function ImapSyncPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const load = () => api.get('/imapsync').then((r) => setJobs(r.data)).catch(() => undefined);
  useEffect(() => { void load(); }, []);

  return (
    <div className='panel'>
      <h1>📬 IMAPSync</h1>
      <p>Diese WebUI verwaltet nur Job-Definitionen. Ausführung erfolgt in deinem separaten IMAPSync-Container.</p>
      <ul>
        {jobs.map((j) => (
          <li key={j.id}>{j.name} - {j.last_status ?? 'managed'}</li>
        ))}
      </ul>
    </div>
  );
}
