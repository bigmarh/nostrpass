import { createSignal, createEffect, onCleanup } from 'solid-js';

// Focus management
export const createFocusTrap = (container: () => HTMLElement | null) => {
  const [isActive, setIsActive] = createSignal(false);
  let firstFocusableElement: HTMLElement | null = null;
  let lastFocusableElement: HTMLElement | null = null;

  const getFocusableElements = (): HTMLElement[] => {
    const containerEl = container();
    if (!containerEl) return [];

    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ].join(', ');

    return Array.from(containerEl.querySelectorAll(focusableSelectors));
  };

  const updateFocusableElements = () => {
    const focusableElements = getFocusableElements();
    firstFocusableElement = focusableElements[0] || null;
    lastFocusableElement = focusableElements[focusableElements.length - 1] || null;
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!isActive()) return;

    if (event.key === 'Tab') {
      updateFocusableElements();

      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstFocusableElement) {
          event.preventDefault();
          lastFocusableElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastFocusableElement) {
          event.preventDefault();
          firstFocusableElement?.focus();
        }
      }
    }

    if (event.key === 'Escape') {
      setIsActive(false);
    }
  };

  createEffect(() => {
    if (isActive()) {
      updateFocusableElements();
      firstFocusableElement?.focus();
      document.addEventListener('keydown', handleKeyDown);
    } else {
      document.removeEventListener('keydown', handleKeyDown);
    }
  });

  onCleanup(() => {
    document.removeEventListener('keydown', handleKeyDown);
  });

  return {
    isActive,
    activate: () => setIsActive(true),
    deactivate: () => setIsActive(false),
    toggle: () => setIsActive(!isActive())
  };
};

// ARIA live region for announcements
export const createLiveRegion = () => {
  const [message, setMessage] = createSignal('');
  const [isVisible, setIsVisible] = createSignal(false);

  const announce = (text: string, priority: 'polite' | 'assertive' = 'polite') => {
    setMessage(text);
    setIsVisible(true);
    
    // Hide after announcement
    setTimeout(() => {
      setIsVisible(false);
    }, 1000);
  };

  return {
    message,
    isVisible,
    announce
  };
};

// Keyboard navigation helpers
export const createKeyboardNavigation = () => {
  const [currentIndex, setCurrentIndex] = createSignal(0);
  const [items, setItems] = createSignal<HTMLElement[]>([]);

  const updateItems = (newItems: HTMLElement[]) => {
    setItems(newItems);
    setCurrentIndex(0);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    const currentItems = items();
    if (currentItems.length === 0) return;

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault();
        setCurrentIndex(prev => (prev + 1) % currentItems.length);
        currentItems[currentIndex()]?.focus();
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault();
        setCurrentIndex(prev => (prev - 1 + currentItems.length) % currentItems.length);
        currentItems[currentIndex()]?.focus();
        break;
      case 'Home':
        event.preventDefault();
        setCurrentIndex(0);
        currentItems[0]?.focus();
        break;
      case 'End':
        event.preventDefault();
        setCurrentIndex(currentItems.length - 1);
        currentItems[currentItems.length - 1]?.focus();
        break;
    }
  };

  return {
    currentIndex,
    items,
    updateItems,
    handleKeyDown
  };
};

// Screen reader utilities
export const announceToScreenReader = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
  const liveRegion = document.getElementById('live-region') || createLiveRegionElement();
  liveRegion.setAttribute('aria-live', priority);
  liveRegion.textContent = message;
  
  // Clear after announcement
  setTimeout(() => {
    liveRegion.textContent = '';
  }, 1000);
};

const createLiveRegionElement = (): HTMLElement => {
  const liveRegion = document.createElement('div');
  liveRegion.id = 'live-region';
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');
  liveRegion.style.position = 'absolute';
  liveRegion.style.left = '-10000px';
  liveRegion.style.width = '1px';
  liveRegion.style.height = '1px';
  liveRegion.style.overflow = 'hidden';
  document.body.appendChild(liveRegion);
  return liveRegion;
};

// High contrast mode detection
export const createHighContrastMode = () => {
  const [isHighContrast, setIsHighContrast] = createSignal(false);

  const checkHighContrast = () => {
    // Check for high contrast mode using various methods
    const mediaQuery = window.matchMedia('(prefers-contrast: high)');
    const isHighContrastMode = mediaQuery.matches;
    
    // Also check for Windows High Contrast Mode
    const isWindowsHighContrast = window.matchMedia('(-ms-high-contrast: active)').matches;
    
    setIsHighContrast(isHighContrastMode || isWindowsHighContrast);
  };

  createEffect(() => {
    checkHighContrast();
    
    const mediaQuery = window.matchMedia('(prefers-contrast: high)');
    const handleChange = () => checkHighContrast();
    
    mediaQuery.addEventListener('change', handleChange);
    
    onCleanup(() => {
      mediaQuery.removeEventListener('change', handleChange);
    });
  });

  return {
    isHighContrast
  };
};

// Reduced motion detection
export const createReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = createSignal(false);

  createEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    
    onCleanup(() => {
      mediaQuery.removeEventListener('change', handleChange);
    });
  });

  return {
    prefersReducedMotion
  };
};

// Color scheme detection
export const createColorScheme = () => {
  const [colorScheme, setColorScheme] = createSignal<'light' | 'dark' | 'auto'>('auto');

  createEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setColorScheme(mediaQuery.matches ? 'dark' : 'light');
    
    const handleChange = () => setColorScheme(mediaQuery.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handleChange);
    
    onCleanup(() => {
      mediaQuery.removeEventListener('change', handleChange);
    });
  });

  return {
    colorScheme
  };
};

// Focus visible detection
export const createFocusVisible = () => {
  const [isFocusVisible, setIsFocusVisible] = createSignal(false);

  const handleFocusIn = (event: FocusEvent) => {
    setIsFocusVisible(true);
  };

  const handleFocusOut = (event: FocusEvent) => {
    setIsFocusVisible(false);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Tab') {
      setIsFocusVisible(true);
    }
  };

  const handleMouseDown = () => {
    setIsFocusVisible(false);
  };

  createEffect(() => {
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);
    
    onCleanup(() => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    });
  });

  return {
    isFocusVisible
  };
};

// Skip links
export const createSkipLinks = () => {
  const skipLinks = [
    { id: 'main-content', label: 'Skip to main content' },
    { id: 'navigation', label: 'Skip to navigation' },
    { id: 'search', label: 'Skip to search' }
  ];

  const handleSkipLinkClick = (event: Event, targetId: string) => {
    event.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.scrollIntoView();
    }
  };

  return {
    skipLinks,
    handleSkipLinkClick
  };
};

// Form validation helpers
export const createFormValidation = () => {
  const [errors, setErrors] = createSignal<Record<string, string>>({});
  const [touched, setTouched] = createSignal<Record<string, boolean>>({});

  const validateField = (name: string, value: any, rules: any) => {
    const fieldErrors: string[] = [];
    
    if (rules.required && (!value || value.toString().trim() === '')) {
      fieldErrors.push('This field is required');
    }
    
    if (rules.minLength && value && value.length < rules.minLength) {
      fieldErrors.push(`Minimum length is ${rules.minLength}`);
    }
    
    if (rules.maxLength && value && value.length > rules.maxLength) {
      fieldErrors.push(`Maximum length is ${rules.maxLength}`);
    }
    
    if (rules.pattern && value && !rules.pattern.test(value)) {
      fieldErrors.push('Invalid format');
    }
    
    if (rules.email && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      fieldErrors.push('Invalid email address');
    }
    
    setErrors(prev => ({
      ...prev,
      [name]: fieldErrors[0] || ''
    }));
    
    return fieldErrors.length === 0;
  };

  const touchField = (name: string) => {
    setTouched(prev => ({
      ...prev,
      [name]: true
    }));
  };

  const clearErrors = () => {
    setErrors({});
    setTouched({});
  };

  return {
    errors,
    touched,
    validateField,
    touchField,
    clearErrors
  };
};
