import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './contexts/auth';
import { AppLayout } from './layouts/AppLayout';
import { AccountsPage } from './pages/AccountsPage';
import { AliasesPage } from './pages/AliasesPage';
import { DashboardPage } from './pages/DashboardPage';
import { DomainsPage } from './pages/DomainsPage';
import { ImapSyncPage } from './pages/ImapSyncPage';
import { LoginPage } from './pages/LoginPage';
import { LogsPage } from './pages/LogsPage';
import { SettingsPage } from './pages/SettingsPage';

function Protected() {
  const user = useAuth((s) => s.user);
  return user ? <AppLayout /> : <Navigate to="/login" />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Protected />}>
        <Route index element={<DashboardPage />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="domains" element={<DomainsPage />} />
        <Route path="aliases" element={<AliasesPage />} />
        <Route path="imapsync" element={<ImapSyncPage />} />
        <Route path="logs" element={<LogsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
