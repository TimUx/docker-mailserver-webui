import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { api, csrfHeaders } from '../api/client';
import { useAuth } from '../contexts/auth';
import { useTranslation, type Locale } from '../i18n';

type Theme = 'dark' | 'light';

function getInitialTheme(): Theme {
  const saved = localStorage.getItem('theme');
  return saved === 'light' ? 'light' : 'dark';
}

function toggleTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark';
}

export function AppLayout() {
  const location = useLocation();
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const csrf = useAuth((s) => s.csrfToken);
  const clear = useAuth((s) => s.clear);
  const { t, locale, setLocale } = useTranslation();

  const links = [
    ['/', '📊', t.nav.dashboard],
    ['/accounts', '👤', t.nav.accounts],
    ['/domains', '🌐', t.nav.domains],
    ['/aliases', '🔀', t.nav.aliases],
    ['/dns-wizard', '🧭', t.nav.dns_wizard],
    ['/mail-profile', '📱', t.nav.mail_profiles],
    ['/observability', '📈', t.nav.observability],
    ['/imapsync', '📬', t.nav.imapsync],
    ['/logs', '🧾', t.nav.logs],
    ['/settings', '⚙️', t.nav.settings],
  ];

  useEffect(() => {
    document.body.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleRefresh = () => {
    window.dispatchEvent(new CustomEvent('dms-refresh'));
  };

  const handleLogout = async () => {
    await api.post('/auth/logout', {}, { headers: csrfHeaders(csrf) }).catch(() => undefined);
    clear();
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <h2>{t.sidebar.title}</h2>
        <button className="theme-toggle" onClick={() => setTheme((previous) => toggleTheme(previous))}>
          {theme === 'dark' ? t.sidebar.dark : t.sidebar.light}
        </button>
        <select
          className="lang-select"
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
          aria-label={t.sidebar.language}
        >
          <option value="en">🌐 EN</option>
          <option value="de">🌐 DE</option>
        </select>
        {links.map(([to, icon, label]) => (
          <Link key={to} to={to} className={location.pathname === to ? 'active' : ''}>
            <span>{icon}</span> {label}
          </Link>
        ))}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
          <button onClick={handleRefresh} title={t.sidebar.refresh}>{t.sidebar.refresh}</button>
          <button onClick={handleLogout}>{t.sidebar.logout}</button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}

