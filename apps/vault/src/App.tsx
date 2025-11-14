import type { Component } from 'solid-js';
import { AppProviders } from './providers';
import './index.css';
import { Router, Route } from '@solidjs/router';
import { Login, Dashboard, AuthGuard, LoginGuard, PinUnlock, QuickUnlock, UnlockVaultOperation } from './components';
import PermissionPromptController from './components/PermissionPromptController';
import AccountPickerController from './components/AccountPickerController';
import SimpleAuthPromptController from './components/SimpleAuthPromptController';
import { ToastProvider } from './components/Toast';
import { I18nProvider } from './i18n';
import { VaultCoreDemo } from './components/VaultCoreDemo';
import { VaultCoreProvider } from './providers/VaultCoreProvider';

const AppContent: Component = () => {
  return (
    <Router>
      <Route path="/:app" component={() => <LoginGuard><Login /></LoginGuard>} />
      <Route path="/:app/unlock-modal" component={QuickUnlock} />
      <Route path="/:app/unlock" component={() => <AuthGuard><PinUnlock /></AuthGuard>} />
      <Route path="/:app/unlock-quick" component={() => <AuthGuard><UnlockVaultOperation /></AuthGuard>} />
      <Route path="/:app/dashboard" component={() => <AuthGuard><Dashboard /></AuthGuard>} />
      <Route path="/:app/keys" component={() => <AuthGuard><div>Key Management</div></AuthGuard>} />
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
          <PermissionPromptController />
          <AccountPickerController />
          <SimpleAuthPromptController />
        </AppProviders>
      </ToastProvider>
    </I18nProvider>
  );
};

export default App;