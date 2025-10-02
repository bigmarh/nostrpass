/* @refresh reload */
import { render } from 'solid-js/web';
import App from './App';
import './index.css';

// Ensure backgrounds follow Tailwind dark/light classes (no forced transparency)

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?',
  );
}

// No manual background overrides — CSS controls backgrounds now

render(() => <App />, root!);