import type { Component } from 'solid-js';
import { AppProviders } from './providers';
import './index.css';
import { Router, Route } from '@solidjs/router';
import { Login } from './components/Login';
import { Signup } from './components/Signup';

const AppContent: Component = () => {
  return (
    <Router>
      <Route path="/" component={Signup} />
      <Route path="/:app" component={Login} />
      <Route path="/:app/settings" component={() => <div>Settings</div>} />
      <Route path="/:app/keys" component={() => <div>Key Management</div>} /> 
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