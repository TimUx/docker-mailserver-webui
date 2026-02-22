import { useEffect, useState } from 'react';
import { api, csrfHeaders } from '../api/client';
import { useAuth } from '../contexts/auth';

export function AliasesPage() {
  const [aliases, setAliases] = useState<string[]>([]);
  const [alias, setAlias] = useState('');
  const [destination, setDestination] = useState('');
  const csrf = useAuth((s) => s.csrfToken);
  const load = () => api.get('/dms/aliases').then((r) => setAliases(r.data.aliases)).catch(() => undefined);
  useEffect(() => { void load(); }, []);
  const create = async () => { await api.post('/dms/aliases', { alias, destination }, { headers: csrfHeaders(csrf) }); setAlias(''); setDestination(''); load(); };
  return <div className='panel'><h1>🔀 Aliases</h1><div className='row'><input value={alias} onChange={(e)=>setAlias(e.target.value)} /><input value={destination} onChange={(e)=>setDestination(e.target.value)} /><button onClick={create}>Add</button></div><ul>{aliases.map((a) => <li key={a}>{a}</li>)}</ul></div>;
}
