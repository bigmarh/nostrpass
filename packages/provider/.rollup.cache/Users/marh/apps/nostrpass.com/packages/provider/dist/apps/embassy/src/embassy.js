/**
 * NostrPass Embassy - Minimal Implementation
 *
 * Core SDK for third-party Nostr app integration
 * Build this file incrementally, one function at a time
 */
import { ParentMessenger } from '@nostrpass/messenger';
import { embassyMessageHandlers } from './embassyMessageHandlers';
import { sanitizeDomain } from '@nostrpass/nostrHelpers';
import { Msg } from '../../../packages/types/src/messages';
import { NostrPassButton } from './NostrPassButton';
const VAULT_PAGES = {
    login: {
        route: '', // Root route for login/signup
        defaultSize: 'minimal', // Centered floating modal (500x600px) for login/signup
    },
    unlock: {
        route: '/unlock-modal',
        defaultSize: 'compact',
        autoCloseOnSuccess: true,
    },
    dashboard: {
        route: '/dashboard', // Full-featured dashboard with identity, pin, and settings management
        defaultSize: 'full',
    },
    account: {
        route: '/account-picker', // Dedicated account/identity picker page
        defaultSize: 'tall', // Taller popup for account selection with permissions
        autoCloseOnSuccess: true,
    },
    permission: {
        route: '/permission-request', // Permission request prompt page
        defaultSize: 'tall', // Taller popup for permission details
        autoCloseOnSuccess: true,
    },
};
class NostrPassEmbassy {
    sleep(ms) { return new Promise(res => setTimeout(res, ms)); }
    waitForUnlock() {
        return new Promise((resolve) => {
            this.unlockResolvers.push(resolve);
            // Timeout after 60 seconds
            setTimeout(() => {
                const index = this.unlockResolvers.indexOf(resolve);
                if (index > -1) {
                    this.unlockResolvers.splice(index, 1);
                    resolve();
                }
            }, 60000);
        });
    }
    waitForPermission() {
        return new Promise((resolve) => {
            this.permissionResolvers.push(resolve);
            // Timeout after 60 seconds
            setTimeout(() => {
                const index = this.permissionResolvers.indexOf(resolve);
                if (index > -1) {
                    this.permissionResolvers.splice(index, 1);
                    resolve();
                }
            }, 60000);
        });
    }
    notifyUnlocked() {
        console.log('🔓 Notifying unlock resolvers:', this.unlockResolvers.length);
        while (this.unlockResolvers.length > 0) {
            const resolve = this.unlockResolvers.shift();
            if (resolve)
                resolve();
        }
    }
    notifyPermissionGranted() {
        console.log('✅ Notifying permission resolvers:', this.permissionResolvers.length);
        while (this.permissionResolvers.length > 0) {
            const resolve = this.permissionResolvers.shift();
            if (resolve)
                resolve();
        }
    }
    promptPin() {
        return new Promise((resolve) => {
            if (this.isPromptOpen)
                return resolve(false);
            this.isPromptOpen = true;
            // Utility: scramble number buttons each time
            const scramble = (arr) => arr.sort(() => Math.random() - 0.5);
            // Remove any existing overlay
            document.getElementById('np-pin-overlay')?.remove();
            // Build overlay container
            const overlay = document.createElement('div');
            overlay.id = 'np-pin-overlay';
            Object.assign(overlay.style, {
                position: 'fixed',
                inset: '0',
                background: 'rgba(0,0,0,0.5)',
                zIndex: '2147483647',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            });
            // Card container
            const card = document.createElement('div');
            Object.assign(card.style, {
                padding: '16px',
                borderRadius: '8px',
                width: '320px',
                maxWidth: '90vw',
                fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif'
            });
            const title = document.createElement('h3');
            title.textContent = 'Unlock Vault';
            Object.assign(title.style, { margin: '0 0 8px', fontSize: '16px' });
            const subtitle = document.createElement('p');
            subtitle.textContent = 'Enter your PIN to continue.';
            Object.assign(subtitle.style, { margin: '0 0 12px', color: '#555', fontSize: '13px' });
            // Dots display
            const dots = document.createElement('div');
            Object.assign(dots.style, { display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '12px' });
            const makeDots = (len) => {
                dots.innerHTML = '';
                for (let i = 0; i < 6; i++) {
                    const d = document.createElement('div');
                    d.style.width = '12px';
                    d.style.height = '12px';
                    d.style.borderRadius = '9999px';
                    d.style.border = '2px solid ' + (i < len ? '#111' : '#d1d5db');
                    dots.appendChild(d);
                }
            };
            // Keypad grid
            const grid = document.createElement('div');
            Object.assign(grid.style, {
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '10px',
                width: '240px',
                margin: '0 auto'
            });
            const numButton = (label) => {
                const btn = document.createElement('button');
                btn.textContent = label;
                Object.assign(btn.style, {
                    width: '76px',
                    height: '56px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer'
                });
                return btn;
            };
            const actionButton = (label) => {
                const btn = document.createElement('button');
                btn.textContent = label;
                Object.assign(btn.style, {
                    height: '44px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    background: '#fff',
                    cursor: 'pointer'
                });
                return btn;
            };
            // State
            let pin = '';
            const numbers = scramble(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']);
            const cleanup = () => { this.isPromptOpen = false; overlay.remove(); };
            const tryUnlock = async () => {
                try {
                    const result = await this.messenger.request('UNLOCK_WITH_PIN', { pin });
                    if (result?.success) {
                        cleanup();
                        resolve(true);
                    }
                    else {
                        // Reset and reshuffle on failure
                        pin = '';
                        makeDots(0);
                        while (grid.firstChild)
                            grid.removeChild(grid.firstChild);
                        scramble(numbers);
                        renderKeys();
                    }
                }
                catch {
                    pin = '';
                    makeDots(0);
                }
            };
            const onDigit = (d) => {
                if (pin.length >= 6)
                    return;
                pin += d;
                makeDots(pin.length);
                if (pin.length === 6) {
                    void tryUnlock();
                }
            };
            const onBackspace = () => {
                if (!pin)
                    return;
                pin = pin.slice(0, -1);
                makeDots(pin.length);
            };
            const renderKeys = () => {
                numbers.forEach((n) => {
                    const b = numButton(n);
                    b.addEventListener('click', () => onDigit(n));
                    grid.appendChild(b);
                });
                const del = actionButton('← Delete');
                del.style.gridColumn = 'span 2';
                del.addEventListener('click', onBackspace);
                grid.appendChild(del);
                const empty = document.createElement('div');
                grid.appendChild(empty);
            };
            // Footer actions
            const footer = document.createElement('div');
            Object.assign(footer.style, { display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' });
            const cancelBtn = actionButton('Cancel');
            cancelBtn.addEventListener('click', () => { cleanup(); resolve(false); });
            footer.appendChild(cancelBtn);
            // Assemble
            card.appendChild(title);
            card.appendChild(subtitle);
            card.appendChild(dots);
            makeDots(0);
            renderKeys();
            card.appendChild(grid);
            card.appendChild(footer);
            overlay.appendChild(card);
            document.body.appendChild(overlay);
        });
    }
    requestPinUnlock() {
        return this.promptPin();
    }
    constructor(config = {}) {
        this.iframe = null;
        this._isReady = false;
        this.styleElement = null;
        this.backdropEl = null;
        this.messenger = null;
        this.handlers = [];
        this.isPromptOpen = false;
        // Reserved for future cooldown logic; intentionally unused for now
        // private lastUnlockAt = 0;
        this.unlockResolvers = [];
        this.permissionResolvers = [];
        this.outsideClickHandler = null;
        // Normalize appDomain to just origin (host:port), strip any paths
        let appDomain = config.appDomain || window.location.host;
        if (appDomain.includes('://')) {
            try {
                appDomain = new URL(appDomain).host;
            }
            catch {
                // If URL parsing fails, use as-is
            }
        }
        // Remove any trailing slashes or paths
        appDomain = appDomain.split('/')[0];
        this.config = {
            appName: config.appName || document.title || 'Unknown App',
            appDomain,
            permissions: config.permissions,
            vaultUrl: config.vaultUrl || 'http://localhost:3001',
            trustedOrigins: config.trustedOrigins, // Keep as-is, will handle defaults in initializeMessenger
            theme: config.theme || 'auto',
            debug: config.debug || false,
            parentPinOverlay: config.parentPinOverlay ?? false
        };
        this.handlers = Object.keys(embassyMessageHandlers(this));
        console.log('🚀 NostrPass Embassy initialized', this.config);
        // Inject styles on initialization
        this.injectStyles();
        // Listen for permission-granted events from the vault
        window.addEventListener('permission-granted', () => {
            console.log('✅ [Embassy] Permission granted event received, notifying resolvers');
            this.notifyPermissionGranted();
        });
        // Create iframe immediately (hidden) when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.createIframe());
        }
        else {
            // DOM already loaded, create immediately
            this.createIframe();
        }
    }
    // Core iframe management
    async createIframe() {
        if (this.iframe) {
            if (this.config.debug)
                console.log('Iframe already exists');
            return;
        }
        return new Promise((resolve, reject) => {
            this.iframe = document.createElement('iframe');
            this.iframe.id = 'nostrpass-vault-iframe';
            // Build URL with config (appDomain is already normalized in constructor)
            const url = new URL(this.config.vaultUrl + '/' + sanitizeDomain(this.config.appDomain));
            url.searchParams.set('appName', this.config.appName);
            url.searchParams.set('appDomain', this.config.appDomain);
            url.searchParams.set('theme', this.config.theme);
            this.iframe.src = url.toString();
            console.log('[Embassy] Creating iframe with:', {
                appDomain: this.config.appDomain,
                sanitized: sanitizeDomain(this.config.appDomain),
                iframeSrc: url.toString()
            });
            // Security attributes
            this.iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox');
            this.iframe.setAttribute('allow', 'publickey-credentials-create; publickey-credentials-get');
            // Accessibility attributes for hidden state
            this.iframe.setAttribute('aria-hidden', 'true');
            this.iframe.setAttribute('tabindex', '-1');
            this.iframe.setAttribute('title', 'NostrPass Vault');
            // Initially hidden off-screen (not display:none for better performance)
            this.iframe.className = 'nostrpass-iframe nostrpass-iframe-hidden';
            // Set transparent background inline to override browser defaults
            this.iframe.style.background = 'transparent';
            this.iframe.style.backgroundColor = 'transparent';
            // Legacy attribute for older browsers
            this.iframe.setAttribute('allowtransparency', 'true');
            // Apply debug mode if enabled
            if (this.config.debug && new URLSearchParams(window.location.search).has('embassy-debug')) {
                this.iframe.classList.add('nostrpass-iframe-debug');
                this.iframe.classList.remove('nostrpass-iframe-hidden');
            }
            // Handle load events
            // Initialize messenger BEFORE iframe loads to catch early messages
            this.initializeMessenger();
            this.iframe.onload = () => {
                if (this.config.debug)
                    console.log('Iframe loaded successfully');
                // Give the vault a moment to initialize its handlers
                setTimeout(() => {
                    if (this.config.debug)
                        console.log('Iframe initialization period complete');
                    resolve();
                }, 100);
            };
            this.iframe.onerror = () => {
                console.error('Failed to load NostrPass vault');
                reject(new Error('Failed to load vault iframe'));
            };
            // Create and insert backdrop before iframe for proper stacking
            if (!this.backdropEl) {
                this.backdropEl = document.createElement('div');
                this.backdropEl.className = 'nostrpass-backdrop';
                this.backdropEl.addEventListener('click', (e) => {
                    console.log('🎯 Backdrop clicked');
                    e.stopPropagation();
                    this.hide();
                });
            }
            // Add to DOM: backdrop first, then iframe on top
            document.body.appendChild(this.backdropEl);
            document.body.appendChild(this.iframe);
            if (this.config.debug)
                console.log('Iframe created and added to DOM');
        });
    }
    /**
     * Open a specific vault page
     * @param page - The vault page to open
     * @param options - Optional size override, button element, and query params
     */
    openPage(page, options) {
        if (!this.iframe) {
            console.warn('Cannot show iframe - not created yet');
            this.createIframe().then(() => this.openPage(page, options));
            return;
        }
        const pageConfig = VAULT_PAGES[page];
        const size = options?.size || pageConfig.defaultSize;
        const buttonElement = options?.buttonElement;
        const queryParams = options?.queryParams || {};
        // Navigate to the requested page using message-based routing (avoids iframe reload)
        const appDomain = sanitizeDomain(this.config.appDomain);
        const targetPath = pageConfig.route ? `/${appDomain}${pageConfig.route}` : `/${appDomain}`;
        // Build query string from params
        const queryString = Object.keys(queryParams).length > 0
            ? '?' + new URLSearchParams(queryParams).toString()
            : '';
        const targetPathWithQuery = targetPath + queryString;
        const currentUrl = new URL(this.iframe.src);
        const currentPathWithQuery = currentUrl.pathname + currentUrl.search;
        if (currentPathWithQuery !== targetPathWithQuery) {
            // Use message-based navigation to avoid iframe reload and preserve Shared Worker session
            if (this.messenger) {
                this.messenger.request(Msg.NAVIGATE, { path: targetPathWithQuery })
                    .then(() => {
                    console.log('🔄 Navigated vault to:', page, 'at path', targetPathWithQuery);
                })
                    .catch((error) => {
                    console.error('Navigation failed, falling back to iframe reload:', error);
                    // Fallback to iframe reload if message-based navigation fails
                    const newUrl = new URL(this.config.vaultUrl);
                    newUrl.pathname = targetPath;
                    newUrl.searchParams.set('appName', this.config.appName);
                    newUrl.searchParams.set('appDomain', this.config.appDomain);
                    newUrl.searchParams.set('theme', this.config.theme);
                    // Add custom query params
                    Object.keys(queryParams).forEach(key => {
                        newUrl.searchParams.set(key, queryParams[key]);
                    });
                    if (this.iframe) {
                        this.iframe.src = newUrl.toString();
                        console.log('🔄 Opening vault page (fallback):', page, 'at', newUrl.toString());
                    }
                });
            }
        }
        // Apply size styling and positioning
        this.iframe.classList.remove('nostrpass-iframe-hidden');
        this.iframe.classList.remove('nostrpass-iframe-visible');
        this.iframe.classList.remove('nostrpass-iframe-compact');
        this.iframe.classList.remove('nostrpass-iframe-tall');
        this.iframe.classList.remove('nostrpass-iframe-minimal');
        // Clear any inline styles that might have been set for compact mode
        this.iframe.style.top = '';
        this.iframe.style.left = '';
        this.iframe.style.transform = '';
        if (size === 'minimal') {
            this.iframe.classList.add('nostrpass-iframe-minimal');
        }
        else if (size === 'compact' || size === 'tall') {
            this.iframe.classList.add(size === 'tall' ? 'nostrpass-iframe-tall' : 'nostrpass-iframe-compact');
            // Position compact/tall mode relative to button if provided, otherwise center
            if (buttonElement) {
                const rect = buttonElement.getBoundingClientRect();
                const spaceBelow = window.innerHeight - rect.bottom;
                const spaceAbove = rect.top;
                const iframeWidth = 395;
                const iframeHeight = size === 'tall' ? 600 : 395; // Taller for account picker
                const gap = 8;
                let top;
                let left;
                // Determine vertical position (above or below button)
                if (spaceBelow >= iframeHeight + gap) {
                    top = rect.bottom + gap;
                }
                else if (spaceAbove >= iframeHeight + gap) {
                    top = rect.top - iframeHeight - gap;
                }
                else {
                    // Centered fallback
                    this.iframe.style.top = '50%';
                    this.iframe.style.left = '50%';
                    this.iframe.style.transform = 'translate(-50%, -50%)';
                    return;
                }
                // Determine horizontal position (keep within viewport)
                left = rect.left;
                if (left + iframeWidth > window.innerWidth - gap) {
                    left = rect.right - iframeWidth;
                }
                if (left < gap) {
                    left = gap;
                }
                this.iframe.style.top = `${top}px`;
                this.iframe.style.left = `${left}px`;
                this.iframe.style.transform = 'none';
            }
            else {
                // No button provided, center the compact modal
                this.iframe.style.top = '50%';
                this.iframe.style.left = '50%';
                this.iframe.style.transform = 'translate(-50%, -50%)';
            }
        }
        else {
            this.iframe.classList.add('nostrpass-iframe-visible');
        }
        // Show backdrop with appropriate styling
        if (this.backdropEl) {
            this.backdropEl.classList.add('visible');
            // Always use transparent backdrop
            this.backdropEl.style.background = 'transparent';
            this.backdropEl.style.backdropFilter = 'none';
        }
        // Add click-outside handler for compact and tall modes
        if (size === 'compact' || size === 'tall') {
            if (this.outsideClickHandler) {
                document.removeEventListener('click', this.outsideClickHandler);
            }
            setTimeout(() => {
                this.outsideClickHandler = (e) => {
                    const target = e.target;
                    if (this.iframe && !this.iframe.contains(target) &&
                        this.backdropEl && this.backdropEl === target) {
                        console.log('🎯 Click outside iframe detected');
                        this.hide();
                    }
                };
                document.addEventListener('click', this.outsideClickHandler);
            }, 100);
        }
        // Accessibility
        this.iframe.setAttribute('aria-hidden', 'false');
        this.iframe.removeAttribute('tabindex');
        document.body.style.overflow = 'hidden';
    }
    /**
     * Legacy method for backward compatibility
     * @deprecated Use openPage() instead
     */
    show(page = 'vault', mode = 'full', buttonElement) {
        // Map old page names to new VaultPage type
        let vaultPage;
        if (page === 'unlock' || page === 'unlock-modal') {
            vaultPage = 'unlock';
        }
        else if (page === 'dashboard') {
            vaultPage = 'dashboard';
        }
        else {
            vaultPage = 'login'; // default to login page
        }
        this.openPage(vaultPage, { size: mode, buttonElement });
    }
    hide() {
        console.log('🔙 Embassy hide() method called');
        if (!this.iframe) {
            console.warn('Cannot hide iframe - not created yet');
            return;
        }
        console.log('🔙 Hiding iframe, current classes:', this.iframe.className);
        // Add hidden class to move off-screen
        this.iframe.classList.remove('nostrpass-iframe-visible');
        this.iframe.classList.remove('nostrpass-iframe-compact');
        this.iframe.classList.remove('nostrpass-iframe-tall');
        this.iframe.classList.remove('nostrpass-iframe-minimal');
        this.iframe.classList.add('nostrpass-iframe-hidden');
        // Hide backdrop
        if (this.backdropEl) {
            this.backdropEl.classList.remove('visible');
        }
        // Remove click-outside handler
        if (this.outsideClickHandler) {
            document.removeEventListener('click', this.outsideClickHandler);
            this.outsideClickHandler = null;
        }
        // Accessibility
        this.iframe.setAttribute('aria-hidden', 'true');
        this.iframe.setAttribute('tabindex', '-1');
        document.body.style.overflow = ''; // Restore scrolling
        console.log('🔙 Iframe hidden, new classes:', this.iframe.className);
        if (this.config.debug)
            console.log('Iframe hidden');
    }
    injectStyles() {
        if (this.styleElement)
            return;
        this.styleElement = document.createElement('style');
        this.styleElement.id = 'nostrpass-embassy-styles';
        this.styleElement.textContent = `
      /* Base iframe styles - transparent background */
      .nostrpass-iframe {
        background: transparent !important;
        background-color: transparent !important;
      }
      
      /* Hidden state - off-screen positioning for better performance */
      .nostrpass-iframe-hidden {
        position: fixed !important;
        top: -2000px !important;
        left: -2000px !important;
        width: 1px !important;
        height: 1px !important;
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
        user-select: none !important;
        border: none !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
        z-index: -9999 !important;
        background: transparent !important;
        background-color: transparent !important;
      }
      
      /* Visible state - Large modal for full dashboard */
      .nostrpass-iframe-visible {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        transform: none !important;
        width: 100vw !important;
        height: 100vh !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
        border: none !important;
        border-radius: 0 !important;
        background: transparent !important;
        z-index: 2147483647 !important;
        overflow: visible !important;
      }

      /* Compact state - Smaller modal for PIN unlock, account picker */
      .nostrpass-iframe-compact {
        position: fixed !important;
        width: 395px !important;
        height: 395px !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
        border: none !important;
        border-radius: 16px !important;
        background: transparent !important;
        z-index: 2147483647 !important;
        overflow: hidden !important;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04) !important;
      }

      @media (max-width: 500px) {
        .nostrpass-iframe-compact {
          width: 90vw !important;
          height: 90vw !important;
          max-width: 395px !important;
          max-height: 395px !important;
        }
      }

      /* Tall state - Taller modal for account picker with more content */
      .nostrpass-iframe-tall {
        position: fixed !important;
        width: 395px !important;
        height: 600px !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
        border: none !important;
        background: transparent !important;
        border-radius: 12px !important;
        transition: opacity 0.2s ease, visibility 0.2s ease !important;
        z-index: 2147483646 !important;
        overflow: hidden !important;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04) !important;
      }

      @media (max-width: 500px) {
        .nostrpass-iframe-tall {
          width: 90vw !important;
          height: min(600px, 80vh) !important;
          max-width: 395px !important;
        }
      }

      /* Minimal state - centered modal for quick unlock */
      .nostrpass-iframe-minimal {
        position: fixed !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        width: min(500px, 90vw) !important;
        height: min(600px, 90vh) !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
        border: none !important;
        border-radius: 12px !important;
        background: transparent !important;
        background-color: transparent !important;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04) !important;
        z-index: 2147483647 !important; /* Maximum z-index */
        color-scheme: light dark; /* Support both themes */
      }

      /* Dimmed backdrop behind iframe - Clerk-style subtle overlay */
      .nostrpass-backdrop {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        background: rgba(0, 0, 0, 0.4) !important;
        backdrop-filter: blur(4px) !important;
        z-index: 2147483646 !important;
        pointer-events: auto !important;
        display: none;
        animation: nostrpass-fade-in 0.2s ease !important;
      }

      .nostrpass-backdrop.visible {
        display: block !important;
      }

      @keyframes nostrpass-fade-in {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      @keyframes nostrpass-modal-in {
        from {
          opacity: 0;
          transform: translate(-50%, -48%);
        }
        to {
          opacity: 1;
          transform: translate(-50%, -50%);
        }
      }

      .nostrpass-iframe-visible {
        animation: nostrpass-modal-in 0.2s ease !important;
      }
      
      /* Debug mode - visible but smaller */
      .nostrpass-iframe-debug {
        position: fixed !important;
        top: 10px !important;
        right: 10px !important;
        width: 400px !important;
        height: 300px !important;
        opacity: 0.9 !important;
        visibility: visible !important;
        pointer-events: auto !important;
        border: 2px solid red !important;
        z-index: 999999 !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
      }

      .nostrpass-account-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 0.6rem 1rem;
        border: none;
        border-radius: 9999px;
        font-weight: 600;
        font-size: 0.95rem;
        font-family: inherit;
        cursor: pointer;
        background: linear-gradient(135deg, #2563eb, #6366f1);
        color: #ffffff;
        box-shadow: 0 10px 20px -12px rgba(37, 99, 235, 0.75);
        transition: transform 0.15s ease, box-shadow 0.2s ease, filter 0.2s ease;
      }

      .nostrpass-account-button:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 14px 24px -12px rgba(79, 70, 229, 0.55);
        filter: brightness(1.02);
      }

      .nostrpass-account-button:active:not(:disabled) {
        transform: translateY(0);
        box-shadow: 0 6px 12px -6px rgba(79, 70, 229, 0.45);
        filter: brightness(0.96);
      }

      .nostrpass-account-button:disabled {
        opacity: 0.65;
        cursor: not-allowed;
        box-shadow: none;
      }
    `;
        document.head.appendChild(this.styleElement);
        if (this.config.debug)
            console.log('Styles injected');
    }
    // Initialize messenger for secure communication
    initializeMessenger() {
        if (!this.iframe)
            return;
        // Create messenger instance with custom send function that targets our specific iframe
        this.messenger = new ParentMessenger(window);
        // Override the sendMessage method to use our specific iframe
        this.messenger.sendMessage = (message) => {
            if (!this.iframe?.contentWindow) {
                console.error('Iframe contentWindow not available');
                return;
            }
            // Use the actual iframe origin instead of config vaultUrl
            const iframeOrigin = new URL(this.iframe.src).origin;
            this.iframe.contentWindow.postMessage(message, iframeOrigin);
        };
        // Initialize with trusted vault origins
        // The Embassy (parent) should only accept messages from trusted vault domains
        let trustedOrigins;
        if (this.config.trustedOrigins && this.config.trustedOrigins.length > 0) {
            // Use custom trusted origins if provided
            trustedOrigins = [...this.config.trustedOrigins];
        }
        else {
            // Use default trusted origins for nostrpass.com
            trustedOrigins = [
                'https://nostrpass.com',
                'https://app.nostrpass.com',
                'https://www.nostrpass.com'
            ];
        }
        // Auto-detect and add the vaultUrl origin to trusted origins
        if (this.config.vaultUrl) {
            try {
                const vaultOrigin = new URL(this.config.vaultUrl).origin;
                if (!trustedOrigins.includes(vaultOrigin)) {
                    trustedOrigins.push(vaultOrigin);
                }
            }
            catch (err) {
                console.warn('Failed to parse vaultUrl origin:', err);
            }
        }
        // In development, also allow localhost for testing
        if (this.iframe.src.includes('localhost') || this.iframe.src.includes('127.0.0.1')) {
            if (!trustedOrigins.includes('http://localhost:3001')) {
                trustedOrigins.push('http://localhost:3001');
            }
            if (!trustedOrigins.includes('http://127.0.0.1:3001')) {
                trustedOrigins.push('http://127.0.0.1:3001');
            }
        }
        this.messenger.init(trustedOrigins);
        // Set up message handlers
        this.setupMessageHandlers();
        if (this.config.debug)
            console.log('Messenger initialized with trusted origins:', trustedOrigins);
    }
    // Set up handlers for vault messages
    setupMessageHandlers() {
        if (!this.messenger)
            return;
        // Handle vault ready signal
        const handlers = embassyMessageHandlers(this);
        console.log('Setting up message handlers:', this.handlers);
        this.handlers.forEach((handler) => {
            console.log('Registering handler for:', handler);
            this.messenger.on(handler, handlers[handler]);
        });
        // Debug: log all registered handlers
        if (this.config.debug) {
            console.log('Message handlers registered:', this.messenger.messageHandlers);
        }
    }
    // Core Nostr methods
    async getPublicKey(options) {
        // Ensure iframe and messenger exist
        if (!this.iframe || !this.messenger) {
            await this.createIframe();
            await this.waitForReady();
        }
        try {
            // Get the active identity index for this app if not explicitly provided
            let identityIndex = options?.identityIndex;
            if (identityIndex === undefined || identityIndex === null) {
                try {
                    const authStatus = await this.getAuthStatus();
                    identityIndex = authStatus?.user?.identityIndex ?? 0;
                }
                catch {
                    identityIndex = 0;
                }
            }
            // Preflight: check if a prompt is needed
            let unlockPromise = null;
            let permissionPromise = null;
            try {
                const preflight = await this.messenger.request(Msg.CHECK_PERMISSION, {
                    action: 'getPublicKey',
                    identityIndex
                });
                const needsPin = preflight?.isLocked === true;
                const needsPrompt = preflight?.needsPrompt === true;
                if (needsPin && this.config.parentPinOverlay) {
                    const ok = await this.requestPinUnlock();
                    if (!ok)
                        throw new Error('User canceled PIN prompt');
                }
                else if (needsPin && !this.config.parentPinOverlay) {
                    // Create the wait promise BEFORE showing the UI
                    console.log('⏳ Vault is locked, showing quick unlock...');
                    unlockPromise = this.waitForUnlock();
                    this.openPage('unlock', { size: 'compact' });
                }
                else if (needsPrompt && !this.config.parentPinOverlay) {
                    // Create permission wait promise BEFORE showing the vault
                    console.log('⏳ Permission required, showing vault and waiting for approval...');
                    permissionPromise = this.waitForPermission();
                    // Navigate to permission-request page with the operation details
                    const requestId = `${this.config.appDomain}-getPublicKey-${Date.now()}`;
                    const queryParams = new URLSearchParams({
                        appOrigin: this.config.appDomain || window.location.host,
                        appName: this.config.appName || document.title,
                        action: 'getPublicKey',
                        identityIndex: (identityIndex !== undefined ? identityIndex : 0).toString(),
                        requestId
                    });
                    await this.messenger.send('NAVIGATE', {
                        path: `/${this.config.appDomain?.replace(/[:.]/g, '-') || 'vault'}/permission-request?${queryParams.toString()}`
                    });
                    // Show the vault (iframe is already navigated to permission page, just make it visible)
                    // Apply full-screen display styling
                    if (this.iframe) {
                        this.iframe.classList.remove('nostrpass-iframe-hidden');
                        this.iframe.classList.remove('nostrpass-iframe-compact');
                        this.iframe.classList.remove('nostrpass-iframe-tall');
                        this.iframe.classList.remove('nostrpass-iframe-minimal');
                        this.iframe.classList.add('nostrpass-iframe-visible');
                        // Show backdrop
                        if (this.backdropEl) {
                            this.backdropEl.classList.add('visible');
                            this.backdropEl.style.background = 'transparent';
                            this.backdropEl.style.backdropFilter = 'none';
                        }
                        // Accessibility
                        this.iframe.setAttribute('aria-hidden', 'false');
                        this.iframe.removeAttribute('tabindex');
                        document.body.style.overflow = 'hidden';
                    }
                }
            }
            catch (error) {
                // If user is not authenticated at all, show full vault for login
                const errorMsg = String(error?.message || error);
                if (errorMsg.toLowerCase().includes('not authenticated')) {
                    console.log('⚠️ User not authenticated, showing full vault for login');
                    this.show('vault', 'full');
                }
            }
            // If we set up an unlock wait, now wait for it
            if (unlockPromise) {
                console.log('⏳ Waiting for vault unlock...');
                await unlockPromise;
                console.log('✅ Vault unlocked, continuing operation');
            }
            // If we set up a permission wait, now wait for it
            if (permissionPromise) {
                console.log('⏳ Waiting for permission approval...');
                await permissionPromise;
                console.log('✅ Permission granted, continuing operation');
            }
            // Send request to vault using messenger
            const response = await this.messenger.request(Msg.GET_PUBLIC_KEY, {
                appName: this.config.appName,
                appDomain: this.config.appDomain,
                identityIndex
            });
            if (this.config.debug)
                console.log('Public key received:', response);
            // Hide iframe on success
            this.hide();
            return response.publicKey || response;
        }
        catch (error) {
            // Keep iframe visible on error so user can see what went wrong
            console.error('Failed to get public key:', error);
            throw error;
        }
    }
    async signEvent(event, options) {
        // Ensure iframe and messenger exist
        if (!this.iframe || !this.messenger) {
            await this.createIframe();
            await this.waitForReady();
        }
        try {
            // Get the active identity index for this app if not explicitly provided
            let identityIndex = options?.identityIndex;
            if (identityIndex === undefined || identityIndex === null) {
                try {
                    const authStatus = await this.getAuthStatus();
                    identityIndex = authStatus?.user?.identityIndex ?? 0;
                }
                catch {
                    identityIndex = 0;
                }
            }
            // Preflight: prompt for PIN first if needed, so the op can proceed without error
            let unlockPromise = null;
            let permissionPromise = null;
            try {
                const pre = await this.messenger.request(Msg.CHECK_PERMISSION, {
                    action: 'signEvent',
                    eventKind: event?.kind,
                    identityIndex
                });
                const needsPin = pre?.isLocked === true;
                const needsPrompt = pre?.needsPrompt === true;
                if (needsPin && this.config.parentPinOverlay) {
                    const ok = await this.requestPinUnlock();
                    if (!ok)
                        throw new Error('User canceled PIN prompt');
                }
                else if (needsPin && !this.config.parentPinOverlay) {
                    // Create the wait promise BEFORE showing the UI
                    console.log('⏳ Vault is locked, showing quick unlock...');
                    unlockPromise = this.waitForUnlock();
                    this.openPage('unlock', { size: 'compact' });
                }
                else if (needsPrompt && !this.config.parentPinOverlay) {
                    // Create permission wait promise BEFORE showing the vault
                    console.log('⏳ Permission required, showing vault and waiting for approval...');
                    permissionPromise = this.waitForPermission();
                    // Navigate to permission-request page with the operation details
                    const requestId = `${this.config.appDomain}-signEvent-${Date.now()}`;
                    const queryParams = new URLSearchParams({
                        appOrigin: this.config.appDomain || window.location.host,
                        appName: this.config.appName || document.title,
                        action: 'signEvent',
                        identityIndex: (identityIndex !== undefined ? identityIndex : 0).toString(),
                        requestId,
                        eventKind: (event?.kind || 0).toString(),
                        event: JSON.stringify(event)
                    });
                    await this.messenger.send('NAVIGATE', {
                        path: `/${this.config.appDomain?.replace(/[:.]/g, '-') || 'vault'}/permission-request?${queryParams.toString()}`
                    });
                    // Show the vault (iframe is already navigated to permission page, just make it visible)
                    // Apply full-screen display styling
                    if (this.iframe) {
                        this.iframe.classList.remove('nostrpass-iframe-hidden');
                        this.iframe.classList.remove('nostrpass-iframe-compact');
                        this.iframe.classList.remove('nostrpass-iframe-tall');
                        this.iframe.classList.remove('nostrpass-iframe-minimal');
                        this.iframe.classList.add('nostrpass-iframe-visible');
                        // Show backdrop
                        if (this.backdropEl) {
                            this.backdropEl.classList.add('visible');
                            this.backdropEl.style.background = 'transparent';
                            this.backdropEl.style.backdropFilter = 'none';
                        }
                        // Accessibility
                        this.iframe.setAttribute('aria-hidden', 'false');
                        this.iframe.removeAttribute('tabindex');
                        document.body.style.overflow = 'hidden';
                    }
                }
            }
            catch (error) {
                // If user is not authenticated at all, show full vault for login
                const errorMsg = String(error?.message || error);
                if (errorMsg.toLowerCase().includes('not authenticated')) {
                    console.log('⚠️ User not authenticated, showing full vault for login');
                    this.show('vault', 'full');
                }
            }
            // If we set up an unlock wait, now wait for it
            if (unlockPromise) {
                console.log('⏳ Waiting for vault unlock...');
                await unlockPromise;
                console.log('✅ Vault unlocked, continuing operation');
            }
            // If we set up a permission wait, now wait for it
            if (permissionPromise) {
                console.log('⏳ Waiting for permission approval...');
                await permissionPromise;
                console.log('✅ Permission granted, continuing operation');
            }
            // Send request to vault using messenger
            const send = async () => this.messenger.request(Msg.SIGN_EVENT, {
                event,
                appName: this.config.appName,
                appDomain: this.config.appDomain,
                identityIndex
            });
            try {
                const response = await send();
                if (this.config.debug)
                    console.log('Signed event received:', response);
                // Hide iframe on success
                this.hide();
                return response.signedEvent || response;
            }
            catch (e) {
                // If we JUST unlocked, there might be a tiny race. Retry once.
                const msg = String(e?.message || e);
                if (msg.toLowerCase().includes('vault is locked') || msg.toLowerCase().includes('rehydrated')) {
                    await this.sleep(150);
                    const response = await send();
                    if (this.config.debug)
                        console.log('Signed event received (retry):', response);
                    this.hide();
                    return response.signedEvent || response;
                }
                throw e;
            }
        }
        catch (error) {
            // Keep iframe visible on error
            console.error('Failed to sign event:', error);
            throw error;
        }
    }
    async getRelays() {
        // TODO: Implement getRelays
        console.log('TODO: getRelays');
        return {};
    }
    async signData(message, options) {
        // Ensure iframe and messenger exist
        if (!this.iframe || !this.messenger) {
            await this.createIframe();
            await this.waitForReady();
        }
        try {
            // Get the active identity index for this app if not explicitly provided
            let identityIndex = options?.identityIndex;
            if (identityIndex === undefined || identityIndex === null) {
                try {
                    const authStatus = await this.getAuthStatus();
                    identityIndex = authStatus?.user?.identityIndex ?? 0;
                }
                catch {
                    identityIndex = 0;
                }
            }
            // Preflight: prompt for PIN first if needed so the op can proceed
            let unlockPromise = null;
            let permissionPromise = null;
            try {
                const pre = await this.messenger.request(Msg.CHECK_PERMISSION, {
                    action: 'signData',
                    identityIndex
                });
                const needsPin = pre?.isLocked === true;
                const needsPrompt = pre?.needsPrompt === true;
                if (needsPin && this.config.parentPinOverlay) {
                    const ok = await this.requestPinUnlock();
                    if (!ok)
                        throw new Error('User canceled PIN prompt');
                }
                else if (needsPin && !this.config.parentPinOverlay) {
                    // Create the wait promise BEFORE showing the UI
                    console.log('⏳ Vault is locked, showing quick unlock...');
                    unlockPromise = this.waitForUnlock();
                    this.openPage('unlock', { size: 'compact' });
                }
                else if (needsPrompt && !this.config.parentPinOverlay) {
                    // Create permission wait promise BEFORE showing the vault
                    console.log('⏳ Permission required, showing vault and waiting for approval...');
                    permissionPromise = this.waitForPermission();
                    // Navigate to permission-request page with the operation details
                    const requestId = `${this.config.appDomain}-signData-${Date.now()}`;
                    const queryParams = new URLSearchParams({
                        appOrigin: this.config.appDomain || window.location.host,
                        appName: this.config.appName || document.title,
                        action: 'signData',
                        identityIndex: (identityIndex !== undefined ? identityIndex : 0).toString(),
                        requestId,
                        data: message
                    });
                    await this.messenger.send('NAVIGATE', {
                        path: `/${this.config.appDomain?.replace(/[:.]/g, '-') || 'vault'}/permission-request?${queryParams.toString()}`
                    });
                    // Show the vault (iframe is already navigated to permission page, just make it visible)
                    // Apply full-screen display styling
                    if (this.iframe) {
                        this.iframe.classList.remove('nostrpass-iframe-hidden');
                        this.iframe.classList.remove('nostrpass-iframe-compact');
                        this.iframe.classList.remove('nostrpass-iframe-tall');
                        this.iframe.classList.remove('nostrpass-iframe-minimal');
                        this.iframe.classList.add('nostrpass-iframe-visible');
                        // Show backdrop
                        if (this.backdropEl) {
                            this.backdropEl.classList.add('visible');
                            this.backdropEl.style.background = 'transparent';
                            this.backdropEl.style.backdropFilter = 'none';
                        }
                        // Accessibility
                        this.iframe.setAttribute('aria-hidden', 'false');
                        this.iframe.removeAttribute('tabindex');
                        document.body.style.overflow = 'hidden';
                    }
                }
            }
            catch (error) {
                // If user is not authenticated at all, show full vault for login
                const errorMsg = String(error?.message || error);
                if (errorMsg.toLowerCase().includes('not authenticated')) {
                    console.log('⚠️ User not authenticated, showing full vault for login');
                    this.show('vault', 'full');
                }
            }
            // If we set up an unlock wait, now wait for it
            if (unlockPromise) {
                console.log('⏳ Waiting for vault unlock...');
                await unlockPromise;
                console.log('✅ Vault unlocked, continuing operation');
            }
            // If we set up a permission wait, now wait for it
            if (permissionPromise) {
                console.log('⏳ Waiting for permission approval...');
                await permissionPromise;
                console.log('✅ Permission granted, continuing operation');
            }
            const doSign = async () => this.messenger.request(Msg.SIGN_DATA, {
                data: message,
                appName: this.config.appName,
                appDomain: this.config.appDomain,
                identityIndex
            });
            try {
                const resp = await doSign();
                const signature = resp?.signature ?? resp;
                if (this.config.debug)
                    console.log('Signed data received:', signature);
                this.hide();
                return signature;
            }
            catch (e) {
                const msg = String(e?.message || e);
                if (msg.toLowerCase().includes('locked') || msg.toLowerCase().includes('unlock') || msg.toLowerCase().includes('rehydrated')) {
                    await this.sleep(150);
                    try {
                        const resp = await doSign();
                        this.hide();
                        return resp?.signature ?? resp;
                    }
                    catch (e2) {
                        const msg2 = String(e2?.message || e2);
                        if (msg2.toLowerCase().includes('rehydrated')) {
                            await this.sleep(200);
                            const resp2 = await doSign();
                            this.hide();
                            return resp2?.signature ?? resp2;
                        }
                        throw e2;
                    }
                }
                throw e;
            }
        }
        catch (error) {
            console.error('Failed to sign data:', error);
            throw error;
        }
    }
    async encrypt(pubkey, plaintext, options) {
        // Ensure iframe and messenger exist
        if (!this.iframe || !this.messenger) {
            await this.createIframe();
            await this.waitForReady();
        }
        try {
            // Get the active identity index for this app if not explicitly provided
            let identityIndex = options?.identityIndex;
            if (identityIndex === undefined || identityIndex === null) {
                try {
                    const authStatus = await this.getAuthStatus();
                    identityIndex = authStatus?.user?.identityIndex ?? 0;
                }
                catch {
                    identityIndex = 0;
                }
            }
            // Preflight: prompt for PIN first if needed
            let unlockPromise = null;
            let permissionPromise = null;
            try {
                const pre = await this.messenger.request(Msg.CHECK_PERMISSION, {
                    action: 'nip04',
                    identityIndex
                });
                const needsPin = pre?.isLocked === true;
                const needsPrompt = pre?.needsPrompt === true;
                if (needsPin && this.config.parentPinOverlay) {
                    const ok = await this.requestPinUnlock();
                    if (!ok)
                        throw new Error('User canceled PIN prompt');
                }
                else if (needsPin && !this.config.parentPinOverlay) {
                    // Create the wait promise BEFORE showing the UI
                    console.log('⏳ Vault is locked, showing quick unlock...');
                    unlockPromise = this.waitForUnlock();
                    this.openPage('unlock', { size: 'compact' });
                }
                else if (needsPrompt && !this.config.parentPinOverlay) {
                    // Create permission wait promise BEFORE showing the vault
                    console.log('⏳ Permission required, showing vault and waiting for approval...');
                    permissionPromise = this.waitForPermission();
                    // Navigate to permission-request page with the operation details
                    const requestId = `${this.config.appDomain}-nip04-encrypt-${Date.now()}`;
                    const queryParams = new URLSearchParams({
                        appOrigin: this.config.appDomain || window.location.host,
                        appName: this.config.appName || document.title,
                        action: 'nip04',
                        identityIndex: (identityIndex !== undefined ? identityIndex : 0).toString(),
                        requestId,
                        pubkey,
                        plaintext
                    });
                    await this.messenger.send('NAVIGATE', {
                        path: `/${this.config.appDomain?.replace(/[:.]/g, '-') || 'vault'}/permission-request?${queryParams.toString()}`
                    });
                    // Show the vault (iframe is already navigated to permission page, just make it visible)
                    // Apply full-screen display styling
                    if (this.iframe) {
                        this.iframe.classList.remove('nostrpass-iframe-hidden');
                        this.iframe.classList.remove('nostrpass-iframe-compact');
                        this.iframe.classList.remove('nostrpass-iframe-tall');
                        this.iframe.classList.remove('nostrpass-iframe-minimal');
                        this.iframe.classList.add('nostrpass-iframe-visible');
                        // Show backdrop
                        if (this.backdropEl) {
                            this.backdropEl.classList.add('visible');
                            this.backdropEl.style.background = 'transparent';
                            this.backdropEl.style.backdropFilter = 'none';
                        }
                        // Accessibility
                        this.iframe.setAttribute('aria-hidden', 'false');
                        this.iframe.removeAttribute('tabindex');
                        document.body.style.overflow = 'hidden';
                    }
                }
            }
            catch (error) {
                // If user is not authenticated at all, show full vault for login
                const errorMsg = String(error?.message || error);
                if (errorMsg.toLowerCase().includes('not authenticated')) {
                    console.log('⚠️ User not authenticated, showing full vault for login');
                    this.show('vault', 'full');
                }
            }
            // If we set up an unlock wait, now wait for it
            if (unlockPromise) {
                console.log('⏳ Waiting for vault unlock...');
                await unlockPromise;
                console.log('✅ Vault unlocked, continuing operation');
            }
            // If we set up a permission wait, now wait for it
            if (permissionPromise) {
                console.log('⏳ Waiting for permission approval...');
                await permissionPromise;
                console.log('✅ Permission granted, continuing operation');
            }
            // Send request to vault using messenger
            const doEncrypt = async () => this.messenger.request(Msg.ENCRYPT, {
                plaintext,
                recipientPubkey: pubkey,
                appName: this.config.appName,
                appDomain: this.config.appDomain,
                identityIndex
            });
            try {
                const ciphertext = await doEncrypt();
                if (this.config.debug)
                    console.log('Encrypted payload received:', ciphertext);
                this.hide();
                return ciphertext;
            }
            catch (e) {
                const msg = String(e?.message || e);
                if (msg.toLowerCase().includes('locked') || msg.toLowerCase().includes('unlock') || msg.toLowerCase().includes('rehydrated')) {
                    await this.sleep(150);
                    try {
                        const result = await doEncrypt();
                        this.hide();
                        return result;
                    }
                    catch (e2) {
                        const msg2 = String(e2?.message || e2);
                        if (msg2.toLowerCase().includes('rehydrated')) {
                            await this.sleep(200);
                            const result = await doEncrypt();
                            this.hide();
                            return result;
                        }
                        throw e2;
                    }
                }
                throw e;
            }
        }
        catch (error) {
            console.error('Failed to encrypt:', error);
            throw error;
        }
    }
    async decrypt(pubkey, ciphertext, options) {
        // Ensure iframe and messenger exist
        if (!this.iframe || !this.messenger) {
            await this.createIframe();
            await this.waitForReady();
        }
        try {
            // Get the active identity index for this app if not explicitly provided
            let identityIndex = options?.identityIndex;
            if (identityIndex === undefined || identityIndex === null) {
                try {
                    const authStatus = await this.getAuthStatus();
                    identityIndex = authStatus?.user?.identityIndex ?? 0;
                }
                catch {
                    identityIndex = 0;
                }
            }
            // Preflight: prompt for PIN first if needed
            let unlockPromise = null;
            let permissionPromise = null;
            try {
                const pre = await this.messenger.request(Msg.CHECK_PERMISSION, {
                    action: 'nip04',
                    identityIndex
                });
                const needsPin = pre?.isLocked === true;
                const needsPrompt = pre?.needsPrompt === true;
                if (needsPin && this.config.parentPinOverlay) {
                    const ok = await this.requestPinUnlock();
                    if (!ok)
                        throw new Error('User canceled PIN prompt');
                }
                else if (needsPin && !this.config.parentPinOverlay) {
                    // Create the wait promise BEFORE showing the UI
                    console.log('⏳ Vault is locked, showing quick unlock...');
                    unlockPromise = this.waitForUnlock();
                    this.openPage('unlock', { size: 'compact' });
                }
                else if (needsPrompt && !this.config.parentPinOverlay) {
                    // Create permission wait promise BEFORE showing the vault
                    console.log('⏳ Permission required, showing vault and waiting for approval...');
                    permissionPromise = this.waitForPermission();
                    // Navigate to permission-request page with the operation details
                    const requestId = `${this.config.appDomain}-nip04-decrypt-${Date.now()}`;
                    const queryParams = new URLSearchParams({
                        appOrigin: this.config.appDomain || window.location.host,
                        appName: this.config.appName || document.title,
                        action: 'nip04',
                        identityIndex: (identityIndex !== undefined ? identityIndex : 0).toString(),
                        requestId,
                        pubkey,
                        ciphertext
                    });
                    await this.messenger.send('NAVIGATE', {
                        path: `/${this.config.appDomain?.replace(/[:.]/g, '-') || 'vault'}/permission-request?${queryParams.toString()}`
                    });
                    // Show the vault (iframe is already navigated to permission page, just make it visible)
                    // Apply full-screen display styling
                    if (this.iframe) {
                        this.iframe.classList.remove('nostrpass-iframe-hidden');
                        this.iframe.classList.remove('nostrpass-iframe-compact');
                        this.iframe.classList.remove('nostrpass-iframe-tall');
                        this.iframe.classList.remove('nostrpass-iframe-minimal');
                        this.iframe.classList.add('nostrpass-iframe-visible');
                        // Show backdrop
                        if (this.backdropEl) {
                            this.backdropEl.classList.add('visible');
                            this.backdropEl.style.background = 'transparent';
                            this.backdropEl.style.backdropFilter = 'none';
                        }
                        // Accessibility
                        this.iframe.setAttribute('aria-hidden', 'false');
                        this.iframe.removeAttribute('tabindex');
                        document.body.style.overflow = 'hidden';
                    }
                }
            }
            catch (error) {
                // If user is not authenticated at all, show full vault for login
                const errorMsg = String(error?.message || error);
                if (errorMsg.toLowerCase().includes('not authenticated')) {
                    console.log('⚠️ User not authenticated, showing full vault for login');
                    this.show('vault', 'full');
                }
            }
            // If we set up an unlock wait, now wait for it
            if (unlockPromise) {
                console.log('⏳ Waiting for vault unlock...');
                await unlockPromise;
                console.log('✅ Vault unlocked, continuing operation');
            }
            // If we set up a permission wait, now wait for it
            if (permissionPromise) {
                console.log('⏳ Waiting for permission approval...');
                await permissionPromise;
                console.log('✅ Permission granted, continuing operation');
            }
            // Send request to vault using messenger
            const doDecrypt = async () => this.messenger.request(Msg.DECRYPT, {
                ciphertext,
                senderPubkey: pubkey,
                appName: this.config.appName,
                appDomain: this.config.appDomain,
                identityIndex
            });
            try {
                const plaintext = await doDecrypt();
                if (this.config.debug)
                    console.log('Decrypted payload received:', plaintext);
                this.hide();
                return plaintext;
            }
            catch (e) {
                const msg = String(e?.message || e);
                if (msg.toLowerCase().includes('locked') || msg.toLowerCase().includes('unlock') || msg.toLowerCase().includes('rehydrated')) {
                    await this.sleep(150);
                    try {
                        const result = await doDecrypt();
                        this.hide();
                        return result;
                    }
                    catch (e2) {
                        const msg2 = String(e2?.message || e2);
                        if (msg2.toLowerCase().includes('rehydrated')) {
                            await this.sleep(200);
                            const result = await doDecrypt();
                            this.hide();
                            return result;
                        }
                        throw e2;
                    }
                }
                throw e;
            }
        }
        catch (error) {
            console.error('Failed to decrypt:', error);
            throw error;
        }
    }
    async getAuthStatus() {
        if (!this.iframe || !this.messenger) {
            await this.createIframe();
            await this.waitForReady();
        }
        try {
            const response = await this.messenger.request(Msg.AUTH_STATUS, {});
            return response;
        }
        catch (error) {
            console.error('Failed to get auth status:', error);
            throw error;
        }
    }
    async getAllIdentities() {
        if (!this.iframe || !this.messenger) {
            await this.createIframe();
            await this.waitForReady();
        }
        try {
            const response = await this.messenger.request(Msg.GET_ALL_IDENTITIES, {});
            return response;
        }
        catch (error) {
            console.error('Failed to get all identities:', error);
            throw error;
        }
    }
    async switchIdentity(identityIndex) {
        if (!this.iframe || !this.messenger) {
            await this.createIframe();
            await this.waitForReady();
        }
        try {
            const response = await this.messenger.request(Msg.SWITCH_IDENTITY, { identityIndex });
            return response;
        }
        catch (error) {
            console.error('Failed to switch identity:', error);
            throw error;
        }
    }
    async logout() {
        if (!this.iframe || !this.messenger) {
            console.log('[Embassy] No iframe/messenger to logout from');
            return;
        }
        try {
            console.log('[Embassy] Sending LOGOUT message to vault');
            await this.messenger.request(Msg.LOGOUT, {});
            console.log('[Embassy] Logout successful');
        }
        catch (error) {
            console.error('[Embassy] Logout failed:', error);
            throw error;
        }
    }
    async manageAccount(options = {}) {
        if (!this.iframe || !this.messenger) {
            await this.createIframe();
            await this.waitForReady();
        }
        const forcePrompt = options.forcePrompt ?? true;
        // Use minimal mode for initial auth (login/signup), compact for quick operations
        const mode = options.size || 'minimal';
        this.show('vault', mode, options.buttonElement);
        try {
            const response = await this.messenger.request(Msg.MANAGE_ACCOUNTS, {
                appName: this.config.appName,
                appDomain: this.config.appDomain,
                forcePrompt
            });
            // Only hide on success
            this.hide();
            return response;
        }
        catch (error) {
            // Don't hide on error - user needs to see the vault to unlock/login
            throw error;
        }
    }
    createAccountManagerButton(options = {}) {
        const { label = 'Manage NostrPass Account', className = 'nostrpass-account-button', appendTo, buttonElement, disabledText, onSelect, onError, forcePrompt } = options;
        const button = buttonElement ?? document.createElement('button');
        if (!buttonElement) {
            button.type = 'button';
            button.className = className;
            button.textContent = label;
        }
        else if (className) {
            buttonElement.className = className;
        }
        const handleClick = async (event) => {
            event.preventDefault();
            const previousLabel = button.textContent;
            try {
                button.disabled = true;
                if (disabledText) {
                    button.textContent = disabledText;
                }
                const result = await this.manageAccount({ forcePrompt });
                onSelect?.(result);
            }
            catch (error) {
                if (onError) {
                    onError(error);
                }
                else {
                    console.error('[NostrPass] Failed to manage account:', error);
                }
            }
            finally {
                button.disabled = false;
                if (disabledText && previousLabel !== undefined && previousLabel !== null) {
                    button.textContent = previousLabel;
                }
            }
        };
        button.addEventListener('click', handleClick);
        if (appendTo) {
            const target = typeof appendTo === 'string' ? document.querySelector(appendTo) : appendTo;
            if (!target) {
                console.warn('[NostrPass] Unable to find target element for account manager button:', appendTo);
            }
            else if (!button.parentElement) {
                target.appendChild(button);
            }
        }
        return button;
    }
    /**
     * Create a production-ready NostrPass authentication button
     * Similar to Clerk's user button pattern
     */
    createNostrPassButton(config = {}) {
        return new NostrPassButton(this, config);
    }
    // Public utility methods
    isReady() {
        return this._isReady;
    }
    async waitForReady() {
        if (this._isReady)
            return;
        // Wait for iframe to be ready
        return new Promise((resolve) => {
            const checkReady = () => {
                if (this._isReady) {
                    resolve();
                }
                else {
                    setTimeout(checkReady, 100);
                }
            };
            checkReady();
        });
    }
    // Cleanup
    destroy() {
        // Clean up messenger
        if (this.messenger) {
            this.messenger.destroy();
            this.messenger = null;
        }
        // Remove iframe
        if (this.iframe && this.iframe.parentNode) {
            this.iframe.parentNode.removeChild(this.iframe);
            this.iframe = null;
        }
        // Remove backdrop
        if (this.backdropEl && this.backdropEl.parentNode) {
            this.backdropEl.parentNode.removeChild(this.backdropEl);
            this.backdropEl = null;
        }
        // Remove styles
        if (this.styleElement && this.styleElement.parentNode) {
            this.styleElement.parentNode.removeChild(this.styleElement);
            this.styleElement = null;
        }
        this._isReady = false;
        if (this.config.debug)
            console.log('Embassy destroyed');
    }
}
// Global instance
let embassyInstance = null;
// Initialize function
function initNostrPass(config = {}) {
    // If there's already an instance, destroy it first
    if (embassyInstance) {
        embassyInstance.destroy();
    }
    embassyInstance = new NostrPassEmbassy(config);
    // Create the nostr provider interface
    const nostrProvider = {
        getPublicKey: (options) => embassyInstance.getPublicKey(options),
        signEvent: (event, options) => embassyInstance.signEvent(event, options),
        signData: (message, options) => embassyInstance.signData(message, options),
        getRelays: () => embassyInstance.getRelays(),
        nip04: {
            encrypt: (pubkey, plaintext, options) => embassyInstance.encrypt(pubkey, plaintext, options),
            decrypt: (pubkey, ciphertext, options) => embassyInstance.decrypt(pubkey, ciphertext, options)
        },
        manageAccount: (options) => embassyInstance.manageAccount(options),
        createAccountManagerButton: (options) => embassyInstance.createAccountManagerButton(options),
        createNostrPassButton: (config) => embassyInstance.createNostrPassButton(config)
    };
    return nostrProvider;
}
function showVault() {
    console.log('showVault');
    embassyInstance?.show();
}
function hideVault() {
    embassyInstance?.hide();
}
// Auto-initialize
if (typeof window !== 'undefined') {
    window.initNostrPass = initNostrPass;
    window.showVault = showVault;
    window.hideVault = hideVault;
    // Don't auto-initialize if the script will be manually initialized
    // Check if there's a script tag with data-manual-init
    const currentScript = document.currentScript;
    const manualInit = currentScript?.getAttribute('data-manual-init') === 'true';
    if (!manualInit) {
        // Get config from data attributes
        const config = {};
        // Read config from data attributes
        if (currentScript?.hasAttribute('data-vault-url')) {
            config.vaultUrl = currentScript.getAttribute('data-vault-url') || undefined;
        }
        if (currentScript?.hasAttribute('data-app-name')) {
            config.appName = currentScript.getAttribute('data-app-name') || undefined;
        }
        if (currentScript?.hasAttribute('data-debug')) {
            config.debug = currentScript.getAttribute('data-debug') === 'true';
        }
        if (currentScript?.hasAttribute('data-theme')) {
            config.theme = currentScript.getAttribute('data-theme') || undefined;
        }
        // Auto-install window.nostr with config from data attributes
        const provider = initNostrPass(config);
        window.nostr = provider;
        console.log('✅ NostrPass Embassy auto-initialized with config:', config);
    }
    else {
        console.log('✅ NostrPass Embassy loaded (manual init mode)');
    }
    console.log('💡 Use window.initNostrPass(config) to customize');
}
export { initNostrPass, NostrPassEmbassy, NostrPassButton };
//# sourceMappingURL=embassy.js.map