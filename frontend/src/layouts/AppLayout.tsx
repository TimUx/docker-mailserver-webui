import { Link, Outlet } from 'react-router-dom';

const links = [
  ['/', 'Dashboard'],
  ['/accounts', 'Accounts'],
  ['/domains', 'Domains'],
  ['/aliases', 'Aliases'],
  ['/imapsync', 'IMAPSync'],
  ['/stack-services', 'Security Stack'],
  ['/logs', 'Logs'],
  ['/settings', 'Settings']
];

export function AppLayout() {
  return (
    <div className="app dark">
      <aside className="sidebar">
        <h2>DMS WebUI</h2>
        {links.map(([to, label]) => (
          <Link key={to} to={to}>{label}</Link>
        ))}
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
