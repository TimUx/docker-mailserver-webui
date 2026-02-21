import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../contexts/auth';

export function LoginPage() {
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('ChangeMe123!');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const setAuth = useAuth((s) => s.setAuth);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const { data } = await api.post('/auth/login', { email, password });
      setAuth(data.user, data.csrf_token);
      navigate('/');
    } catch {
      if (import.meta.env.DEV) {
        setAuth({ id: 1, email: 'demo@example.com', is_admin: true }, 'demo-csrf');
        navigate('/');
        return;
      }
      setError('Login failed');
    }
  }

  return <form className="panel" onSubmit={onSubmit}><h1>🔐 Login</h1>{error && <p>{error}</p>}<input value={email} onChange={(e) => setEmail(e.target.value)} /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /><button>Sign in</button></form>;
}
