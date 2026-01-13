import type { Component } from 'solid-js';
import { AppProviders } from './providers';
import './index.css';
import { Router, Route } from '@solidjs/router';
import { Login, Dashboard, AuthGuard, PinUnlock, QuickUnlock, UnlockVaultOperation, ManageDashboard, AccountPickerPage, PermissionRequestPage, SimpleAuthPage } from './components';
import AccountPickerController from './components/AccountPickerController';
import SimpleAuthPromptController from './components/SimpleAuthPromptController';
import RecoveryPhraseRestore from './components/RecoveryPhraseRestore';
import ProfileEdit from './components/ProfileEdit';
import { ToastProvider } from './components/Toast';
import { I18nProvider } from './i18n';
import { VaultCoreDemo } from './components/VaultCoreDemo';
import { VaultCoreProvider } from './providers/VaultCoreProvider';
import { NostrSyncIndicator } from './components/NostrSyncIndicator';

const AppContent: Component = () => {
  return (
    <Router>
      <Route path="/:app" component={Login} />
      <Route path="/:app/unlock-modal" component={QuickUnlock} />
      <Route path="/:app/unlock" component={() => <AuthGuard><PinUnlock /></AuthGuard>} />
      <Route path="/:app/unlock-quick" component={() => <AuthGuard><UnlockVaultOperation /></AuthGuard>} />
      <Route path="/:app/account-picker" component={AccountPickerPage} />
      <Route path="/:app/permission-request" component={PermissionRequestPage} />
      <Route path="/:app/simple-auth" component={() => <AuthGuard><SimpleAuthPage /></AuthGuard>} />
      <Route path="/:app/dashboard" component={() => <AuthGuard><Dashboard /></AuthGuard>} />
      <Route path="/:app/profile/:pubkey/edit" component={() => <AuthGuard><ProfileEdit /></AuthGuard>} />
      <Route path="/:app/manage" component={ManageDashboard} />
      <Route path="/:app/keys" component={() => <AuthGuard><div>Key Management</div></AuthGuard>} />
      <Route path="/:app/restore-from-phrase" component={RecoveryPhraseRestore} />
      <Route path="/:app/vault-core-demo" component={() => (
        <VaultCoreProvider>
          <VaultCoreDemo />
        </VaultCoreProvider>
      )} />
    </Router>
  );
};

const App: Component = () => {
  return (
    <I18nProvider>
      <ToastProvider>
        <AppProviders>
          <AppContent />
          <AccountPickerController />
          <SimpleAuthPromptController />
          <NostrSyncIndicator />
        </AppProviders>
      </ToastProvider>
    </I18nProvider>
  );
};

export default App;