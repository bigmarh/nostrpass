import type { Component } from 'solid-js';
import { AppProviders } from '../providers';
import '../styles/globals.css';
import { HashRouter, Route } from '@solidjs/router';
import {
  Login,
  Dashboard,
  AuthGuard,
  PinUnlock,
  QuickUnlock,
  UnlockVaultOperation,
  AccountPickerPage,
  PermissionRequestPage,
  SimpleAuthPage,
} from '../components';
import AccountPickerController from '../components/AccountPickerController';
import SimpleAuthPromptController from '../components/SimpleAuthPromptController';
import { ToastProvider } from '../components/Toast';
import { NostrSyncIndicator } from '../components/NostrSyncIndicator';

// Chrome extension uses the same routing structure as vault
// but with 'extension' as the app identifier instead of dynamic domain

const AppContent: Component = () => {
  return (
    <HashRouter>
      {/* Use same route structure as vault with 'extension' as app id */}
      <Route path="/" component={Login} />
      <Route path="/:app" component={Login} />
      <Route path="/:app/unlock-modal" component={QuickUnlock} />
      <Route
        path="/:app/unlock"
        component={() => (
          <AuthGuard>
            <PinUnlock />
          </AuthGuard>
        )}
      />
      <Route
        path="/:app/unlock-quick"
        component={() => (
          <AuthGuard>
            <UnlockVaultOperation />
          </AuthGuard>
        )}
      />
      <Route path="/:app/account-picker" component={AccountPickerPage} />
      <Route path="/:app/permission-request" component={PermissionRequestPage} />
      <Route
        path="/:app/simple-auth"
        component={() => (
          <AuthGuard>
            <SimpleAuthPage />
          </AuthGuard>
        )}
      />
      <Route
        path="/:app/dashboard"
        component={() => (
          <AuthGuard>
            <Dashboard />
          </AuthGuard>
        )}
      />
      {/* Also support routes without :app for extension convenience */}
      <Route path="/unlock-modal" component={QuickUnlock} />
      <Route path="/unlock" component={() => <AuthGuard><PinUnlock /></AuthGuard>} />
      <Route path="/account-picker" component={AccountPickerPage} />
      <Route path="/permission-request" component={PermissionRequestPage} />
      <Route path="/simple-auth" component={() => <AuthGuard><SimpleAuthPage /></AuthGuard>} />
      <Route path="/dashboard" component={() => <AuthGuard><Dashboard /></AuthGuard>} />
    </HashRouter>
  );
};

const App: Component = () => {
  return (
    <ToastProvider>
      <AppProviders>
        <div style="width: 400px; height: 600px;" class="overflow-hidden">
          <AppContent />
          <AccountPickerController />
          <SimpleAuthPromptController />
          <NostrSyncIndicator />
        </div>
      </AppProviders>
    </ToastProvider>
  );
};

export default App;
