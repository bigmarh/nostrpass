import type { Component } from 'solid-js';
import { AppProviders } from './providers';
import './index.css';
import { Router, Route } from '@solidjs/router';
import { Login, Dashboard, AuthGuard, LoginGuard, PinUnlock } from './components';
import PermissionPromptController from './components/PermissionPromptController';

const AppContent: Component = () => {
  return (
    <Router>
      <Route path="/:app" component={() => <LoginGuard><Login /></LoginGuard>} />
      <Route path="/:app/unlock" component={() => <AuthGuard><PinUnlock /></AuthGuard>} />
      <Route path="/:app/dashboard" component={() => <AuthGuard><Dashboard /></AuthGuard>} />
      <Route path="/:app/keys" component={() => <AuthGuard><div>Key Management</div></AuthGuard>} /> 
    </Router>   
  );
};

const App: Component = () => {
  return (
    <AppProviders>
      <AppContent />
      <PermissionPromptController />
    </AppProviders>
  );
};

export default App;