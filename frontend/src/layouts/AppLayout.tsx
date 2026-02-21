import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';

const links = [
  ['/', '📊', 'Dashboard'],
  ['/accounts', '👤', 'Accounts'],
  ['/domains', '🌐', 'Domains'],
  ['/aliases', '🔀', 'Aliases'],
  ['/imapsync', '📬', 'IMAPSync'],
  ['/stack-services', '🛡️', 'Security Stack'],
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

  useEffect(() => {
    document.body.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  const currentTitle = links.find(([to]) => to === location.pathname)?.[2] ?? 'Dashboard';

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
      </aside>
      <main className="content">
        <header className="content-header">{currentTitle}</header>
        <Outlet />
      </main>
    </div>
  );
}
