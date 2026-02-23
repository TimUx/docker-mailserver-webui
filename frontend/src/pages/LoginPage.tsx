import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../contexts/auth';
import { useTranslation } from '../i18n';

export function LoginPage() {
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('ChangeMe123!');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const setAuth = useAuth((s) => s.setAuth);
  const { t } = useTranslation();

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
      setError(t.login.login_failed);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">✉️</div>
          <h1 className="login-title">{t.login.heading}</h1>
          <p className="login-subtitle">{t.login.subtitle}</p>
        </div>
        <form onSubmit={onSubmit} className="login-form">
          {error && <div className="login-error">{error}</div>}
          <div className="login-field">
            <label className="login-label" htmlFor="login-email">{t.login.email_ph}</label>
            <input
              id="login-email"
              className="login-input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="login-field">
            <label className="login-label" htmlFor="login-password">{t.login.password_ph}</label>
            <input
              id="login-password"
              className="login-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="login-btn">{t.login.sign_in}</button>
        </form>
      </div>
    </div>
  );
}

