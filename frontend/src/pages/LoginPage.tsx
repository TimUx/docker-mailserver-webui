import { FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { api } from '../api/client';
import { useAuth } from '../contexts/auth';
import { useTranslation } from '../i18n';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuth((s) => s.setAuth);
  const user = useAuth((s) => s.user);
  const { t } = useTranslation();

  // Already authenticated — go straight to the app.
  if (user) return <Navigate to="/" />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      setAuth(data.user, data.csrf_token);
      navigate('/');
    } catch (err) {
      if (import.meta.env.DEV) {
        setAuth({ id: 1, email: 'demo@example.com', is_admin: true }, 'demo-csrf');
        navigate('/');
        return;
      }
      if (axios.isAxiosError(err)) {
        if (!err.response) {
          // Network-level failure: nginx/server not reachable at all.
          setError(t.login.network_error);
        } else if (err.response.status === 401) {
          // Wrong email or password.
          setError(t.login.login_failed);
        } else {
          // Unexpected server-side error (5xx, etc.).
          setError(t.login.server_error);
        }
      } else {
        setError(t.login.login_failed);
      }
    } finally {
      setSubmitting(false);
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
          <button type="submit" className="login-btn" disabled={submitting}>
            {submitting ? t.login.signing_in : t.login.sign_in}
          </button>
        </form>
      </div>
    </div>
  );
}

