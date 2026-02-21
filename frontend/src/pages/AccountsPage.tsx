import { useEffect, useState } from 'react';
import { api, csrfHeaders } from '../api/client';
import { useAuth } from '../contexts/auth';

export function AccountsPage() {
  const [accounts, setAccounts] = useState<string[]>(['admin@example.com', 'support@example.com', 'sales@example.com']);
  const csrf = useAuth((s) => s.csrfToken);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const load = () => api.get('/dms/accounts').then((r) => setAccounts(r.data.accounts)).catch(() => undefined);
  useEffect(load, []);
  const create = async () => { await api.post('/dms/accounts', { email, password }, { headers: csrfHeaders(csrf) }); setEmail(''); setPassword(''); load(); };
  return <div className="panel"><h1>👤 Accounts</h1><div className="row"><input placeholder='email' value={email} onChange={(e)=>setEmail(e.target.value)}/><input placeholder='password' value={password} onChange={(e)=>setPassword(e.target.value)}/><button onClick={create}>Add</button></div><ul>{accounts.map((a)=><li key={a}>{a}</li>)}</ul></div>;
}
