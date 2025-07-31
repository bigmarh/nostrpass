import type { Component } from 'solid-js';
import { AppProviders } from './providers';
import './index.css';
import { Router, Route } from '@solidjs/router';
import { Login, Dashboard, AuthGuard, LoginGuard, VaultGuard, PinUnlock } from './components';

const AppContent: Component = () => {
  return (
    <Router>
      <Route path="/:app" component={() => <LoginGuard><Login /></LoginGuard>} />
      <Route path="/:app/unlock" component={() => <AuthGuard><PinUnlock /></AuthGuard>} />
      <Route path="/:app/dashboard" component={() => <VaultGuard><Dashboard /></VaultGuard>} />
      <Route path="/:app/settings" component={() => <VaultGuard><div>Settings</div></VaultGuard>} />
      <Route path="/:app/keys" component={() => <VaultGuard><div>Key Management</div></VaultGuard>} /> 
    </Router>   
  );
};

const App: Component = () => {
  return (
    <AppProviders>
      <AppContent />
    </AppProviders>
  );
};

export default App;