/* @refresh reload */
import { render } from 'solid-js/web';
import App from './App';
import './index.css';

// CRITICAL: Set transparent background IMMEDIATELY before anything else
document.documentElement.style.backgroundColor = 'transparent';
document.body.style.backgroundColor = 'transparent';

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?',
  );
}

// Ensure backgrounds stay transparent
document.documentElement.style.backgroundColor = 'transparent';
document.body.style.backgroundColor = 'transparent';
if (root) {
  root.style.backgroundColor = 'transparent';
}

render(() => <App />, root!);