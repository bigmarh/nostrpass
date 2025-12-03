import { createSignal, onMount, createEffect } from 'solid-js';

export function useDarkMode() {
  // Check URL params (from embassy config), localStorage, and system preference
  const getInitialMode = () => {
    // First check URL params - developer's explicit theme config takes priority
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const themeParam = urlParams.get('theme');

      if (themeParam === 'dark') {
        return true;
      } else if (themeParam === 'light') {
        return false;
      }
      // If 'auto' or not set, continue to other checks
    }

    // Second check localStorage (user's manual preference)
    const stored = localStorage.getItem('darkMode');
    if (stored !== null) {
      return stored === 'true';
    }

    // Fall back to system preference
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    return false; // Default to light mode
  };

  const [isDarkMode, setIsDarkMode] = createSignal(getInitialMode());

  // Apply dark mode class to document
  const applyDarkMode = (dark: boolean) => {
    if (typeof document !== 'undefined') {
      if (dark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  };

  // Initialize on mount
  onMount(() => {
    applyDarkMode(isDarkMode());
    
    // Listen for system preference changes
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        // Only auto-update if user hasn't set a preference
        if (localStorage.getItem('darkMode') === null) {
          setIsDarkMode(e.matches);
        }
      };
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  });

  // Save to localStorage and apply when changed
  createEffect(() => {
    const dark = isDarkMode();
    localStorage.setItem('darkMode', String(dark));
    applyDarkMode(dark);
  });

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode());
  };

  return {
    isDarkMode,
    toggleDarkMode,
    setDarkMode: setIsDarkMode
  };
}

