import { useCallback, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { api } from './api/client';
import { useAuth } from './contexts/auth';
import { AppLayout } from './layouts/AppLayout';
import { AccountsPage } from './pages/AccountsPage';
import { AliasesPage } from './pages/AliasesPage';
import { DashboardPage } from './pages/DashboardPage';
import { DkimPage } from './pages/DkimPage';
import { DnsWizardPage } from './pages/DnsWizardPage';
import { DomainsPage } from './pages/DomainsPage';
import { ImapSyncPage } from './pages/ImapSyncPage';
import { LoginPage } from './pages/LoginPage';
import { LogsPage } from './pages/LogsPage';
import { MailProfilePage } from './pages/MailProfilePage';
import { ObservabilityPage } from './pages/ObservabilityPage';
import { SettingsPage } from './pages/SettingsPage';

function getCsrfCookie(name: string): string | undefined {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
}

function Protected() {
  const user = useAuth((s) => s.user);
  return user ? <AppLayout /> : <Navigate to="/login" />;
}

export function App() {
  const user = useAuth((s) => s.user);
  const setAuth = useAuth((s) => s.setAuth);

  const tryRestoreSession = useCallback(() => {
    if (!user) {
      const csrf = getCsrfCookie('dms_csrf');
      if (csrf) {
        api.get('/auth/me').then((r) => setAuth(r.data, csrf)).catch(() => undefined);
      }
    }
  }, [user, setAuth]);

  useEffect(() => {
    tryRestoreSession();
  }, [tryRestoreSession]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Protected />}>
        <Route index element={<DashboardPage />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="domains" element={<DomainsPage />} />
        <Route path="aliases" element={<AliasesPage />} />
        <Route path="dkim" element={<DkimPage />} />
        <Route path="imapsync" element={<ImapSyncPage />} />
        <Route path="dns-wizard" element={<DnsWizardPage />} />
        <Route path="mail-profile" element={<MailProfilePage />} />
        <Route path="observability" element={<ObservabilityPage />} />
        <Route path="logs" element={<LogsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
