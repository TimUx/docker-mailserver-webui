import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { api, csrfHeaders } from '../api/client';
import { useAuth } from '../contexts/auth';

const links = [
  ['/', '📊', 'Dashboard'],
  ['/accounts', '👤', 'Accounts'],
  ['/domains', '🌐', 'Domains'],
  ['/aliases', '🔀', 'Aliases'],
  ['/imapsync', '📬', 'IMAPSync'],
  ['/logs', '🧾', 'Logs'],
  ['/settings', '⚙️', 'Settings']
];

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

  useEffect(() => {
    document.body.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  const currentTitle = links.find(([to]) => to === location.pathname)?.[2] ?? 'Dashboard';

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
        <h2>✉️ DMS WebUI</h2>
        <button className="theme-toggle" onClick={() => setTheme((previous) => toggleTheme(previous))}>
          {theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
        </button>
        {links.map(([to, icon, label]) => (
          <Link key={to} to={to} className={location.pathname === to ? 'active' : ''}>
            <span>{icon}</span> {label}
          </Link>
        ))}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
          <button onClick={handleRefresh} title="Refresh current page data">🔄 Refresh</button>
          <button onClick={handleLogout}>🚪 Logout</button>
        </div>
      </aside>
      <main className="content">
        <header className="content-header">{currentTitle}</header>
        <Outlet />
      </main>
    </div>
  );
}
