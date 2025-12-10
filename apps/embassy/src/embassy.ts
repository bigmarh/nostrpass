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
import { NostrPassButton, NostrPassButtonConfig, UserInfo } from './NostrPassButton';
import { createTransport, VaultTransport } from './transports';

interface EmbassyConfig {
  appName?: string;
  appDomain?: string; // Internal use only - always set to window.location.host, cannot be configured by developer
  permissions?: {
    getPublicKey?: 'ALLOW' | 'ASK_EVERYTIME' | 'DENY';
    getRelays?: 'ALLOW' | 'ASK_EVERYTIME' | 'DENY';
    signEvent?: 'ALLOW' | 'ASK_EVERYTIME' | 'DENY';
    nip04?: 'ALLOW' | 'ASK_EVERYTIME' | 'DENY';
    nip44?: 'ALLOW' | 'ASK_EVERYTIME' | 'DENY';
    signData?: 'ALLOW' | 'ASK_EVERYTIME' | 'DENY';
  };
  vaultUrl?: string;
  storageEnvironment?: string; // Storage environment override - where to save login/vault data (e.g., 'demo', 'test', 'staging'). Useful for demos/testing without affecting production data.
  namespace?: string; // Custom namespace for vault data (defaults to 'nostrpass.com')
  trustedOrigins?: string[]; // Custom trusted vault origins
  theme?: 'light' | 'dark' | 'auto';
  debug?: boolean;
  parentPinOverlay?: boolean; // if true, show parent PIN UI (default false)
  useDirectWorker?: boolean; // if true, use direct worker communication via transport layer (opt-in, experimental)
}

interface NostrEvent {
  kind: number;
  content: string;
  tags: string[][];
  created_at?: number;
  pubkey?: string;
  id?: string;
  sig?: string;
}

interface NostrOperationOptions {
  identityIndex?: number;
}

interface AccountManagerOptions {
  forcePrompt?: boolean;
  size?: 'full' | 'compact' | 'minimal' | 'thin';
  buttonElement?: HTMLElement;
}

interface AccountIdentitySummary {
  nickname?: string;
  publicKey: string;
  npub?: string;
  path?: string;
  authorized: boolean;
}

interface AccountManagerResult {
  identityIndex: number;
  identity?: AccountIdentitySummary;
}

interface AccountManagerButtonOptions extends AccountManagerOptions {
  label?: string;
  className?: string;
  appendTo?: HTMLElement | string;
  buttonElement?: HTMLButtonElement;
  disabledText?: string;
  onSelect?: (result: AccountManagerResult) => void;
  onError?: (error: unknown) => void;
}

/**
 * Vault pages with predefined routes and default sizes
 */
type VaultPage =
  | 'login'        // Login/signup flow - full size modal
  | 'unlock'       // Quick unlock (PIN only) - compact dropdown
  | 'dashboard'    // Full vault dashboard - full size modal
  | 'account'      // Account switcher/manager - tall popup
  | 'permission'   // Permission request prompt - tall popup
  ;

interface VaultPageConfig {
  route: string;
  defaultSize: 'full' | 'compact' | 'tall' | 'minimal' | 'thin';
  autoCloseOnSuccess?: boolean; // Auto-hide after successful action
}

const VAULT_PAGES: Record<VaultPage, VaultPageConfig> = {
  login: {
    route: '',  // Root route for login/signup
    defaultSize: 'minimal',  // Centered floating modal (500x600px) for login/signup
  },
  unlock: {
    route: '/unlock-modal',
    defaultSize: 'thin',
    autoCloseOnSuccess: true,
  },
  dashboard: {
    route: '/dashboard',  // Full-featured dashboard with identity, pin, and settings management
    defaultSize: 'full',
  },
  account: {
    route: '/account-picker',  // Dedicated account/identity picker page
    defaultSize: 'tall',  // Taller popup for account selection with permissions
    autoCloseOnSuccess: true,
  },
  permission: {
    route: '/permission-request',  // Permission request prompt page
    defaultSize: 'tall',  // Taller popup for permission details
    autoCloseOnSuccess: true,
  },
};

interface NostrProvider {
  getPublicKey(options?: NostrOperationOptions): Promise<string>;
  signEvent(event: NostrEvent, options?: NostrOperationOptions): Promise<NostrEvent>;
  signData?(message: string, options?: NostrOperationOptions): Promise<string>;
  getRelays?(options?: NostrOperationOptions): Promise<Record<string, { read: boolean; write: boolean }>>;
  nip04?: {
    encrypt(pubkey: string, plaintext: string, options?: NostrOperationOptions): Promise<string>;
    decrypt(pubkey: string, ciphertext: string, options?: NostrOperationOptions): Promise<string>;
  };
  manageAccount?(options?: AccountManagerOptions): Promise<AccountManagerResult>;
  createAccountManagerButton?(options?: AccountManagerButtonOptions): HTMLButtonElement;
  createNostrPassButton?(config?: NostrPassButtonConfig): NostrPassButton;
}

class NostrPassEmbassy {
  private config: EmbassyConfig;
  private iframe: HTMLIFrameElement | null = null;
  private _isReady = false;
  private styleElement: HTMLStyleElement | null = null;
  private backdropEl: HTMLDivElement | null = null;
  private messenger: ParentMessenger | null = null;
  private transport: VaultTransport | null = null;
  private handlers: string[] = [];
  private isPromptOpen = false;
  // Reserved for future cooldown logic; intentionally unused for now
  // private lastUnlockAt = 0;
  private unlockResolvers: Array<() => void> = [];
  private permissionResolvers: Array<() => void> = [];
  private authResolvers: Array<() => void> = [];
  private outsideClickHandler: ((e: MouseEvent) => void) | null = null;
  private sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

  private waitForUnlock(): Promise<void> {
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

  private waitForPermission(): Promise<void> {
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

  private waitForAuth(): Promise<void> {
    return new Promise((resolve) => {
      this.authResolvers.push(resolve);
      // Timeout after 5 minutes (longer for signup/login)
      setTimeout(() => {
        const index = this.authResolvers.indexOf(resolve);
        if (index > -1) {
          this.authResolvers.splice(index, 1);
          resolve();
        }
      }, 300000);
    });
  }

  public notifyUnlocked(): void {
    console.log('🔓 Notifying unlock resolvers:', this.unlockResolvers.length);
    while (this.unlockResolvers.length > 0) {
      const resolve = this.unlockResolvers.shift();
      if (resolve) resolve();
    }
  }

  public notifyPermissionGranted(): void {
    console.log('✅ Notifying permission resolvers:', this.permissionResolvers.length);
    while (this.permissionResolvers.length > 0) {
      const resolve = this.permissionResolvers.shift();
      if (resolve) resolve();
    }
  }

  public notifyAuthenticated(): void {
    console.log('🔐 Notifying auth resolvers:', this.authResolvers.length);
    while (this.authResolvers.length > 0) {
      const resolve = this.authResolvers.shift();
      if (resolve) resolve();
    }
  }
    private promptPin(): Promise<boolean> {
      return new Promise((resolve) => {
        if (this.isPromptOpen) return resolve(false);
        this.isPromptOpen = true;
        // Utility: scramble number buttons each time
        const scramble = (arr: string[]) => arr.sort(() => Math.random() - 0.5);

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
        } as CSSStyleDeclaration);

        // Card container
        const card = document.createElement('div');
        Object.assign(card.style, {
          padding: '16px',
          borderRadius: '8px',
          width: '320px',
          maxWidth: '90vw',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif'
        } as CSSStyleDeclaration);

        const title = document.createElement('h3');
        title.textContent = 'Unlock Vault';
        Object.assign(title.style, { margin: '0 0 8px', fontSize: '16px' } as CSSStyleDeclaration);

        const subtitle = document.createElement('p');
        subtitle.textContent = 'Enter your PIN to continue.';
        Object.assign(subtitle.style, { margin: '0 0 12px', color: '#555', fontSize: '13px' } as CSSStyleDeclaration);

        // Dots display
        const dots = document.createElement('div');
        Object.assign(dots.style, { display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '12px' } as CSSStyleDeclaration);
        const makeDots = (len: number) => {
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
        } as CSSStyleDeclaration);

        const numButton = (label: string) => {
          const btn = document.createElement('button');
          btn.textContent = label;
          Object.assign(btn.style, {
            width: '76px',
            height: '56px',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            fontWeight: '600',
            cursor: 'pointer'
          } as CSSStyleDeclaration);
          return btn;
        };

        const actionButton = (label: string) => {
          const btn = document.createElement('button');
          btn.textContent = label;
          Object.assign(btn.style, {
            height: '44px',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            background: '#fff',
            cursor: 'pointer'
          } as CSSStyleDeclaration);
          return btn;
        };

        // State
        let pin = '';
        const numbers = scramble(['1','2','3','4','5','6','7','8','9','0']);

        const cleanup = () => { this.isPromptOpen = false; overlay.remove(); };

        const tryUnlock = async () => {
          try {
            const result = await (this.messenger as any).request('UNLOCK_WITH_PIN', { pin });
            if (result?.success) {
              cleanup();
              resolve(true);
            } else {
              // Reset and reshuffle on failure
              pin = '';
              makeDots(0);
              while (grid.firstChild) grid.removeChild(grid.firstChild);
              scramble(numbers);
              renderKeys();
            }
          } catch {
            pin = '';
            makeDots(0);
          }
        };

        const onDigit = (d: string) => {
          if (pin.length >= 6) return;
          pin += d;
          makeDots(pin.length);
          if (pin.length === 6) {
            void tryUnlock();
          }
        };

        const onBackspace = () => {
          if (!pin) return;
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
        Object.assign(footer.style, { display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' } as CSSStyleDeclaration);
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

    public requestPinUnlock(): Promise<boolean> {
      return this.promptPin();
    }

  constructor(config: EmbassyConfig = {}) {
    // Always use window.location.host for security - appDomain cannot be configured
    const appDomain = window.location.host;

    this.config = {
      appName: config.appName || document.title || 'Unknown App',
      appDomain,
      permissions: config.permissions,
      vaultUrl: config.vaultUrl || (import.meta.env.PROD ? 'https://vault.nostrpass.com' : 'http://localhost:3001'),
      trustedOrigins: config.trustedOrigins, // Keep as-is, will handle defaults in initializeMessenger
      theme: config.theme || 'auto',
      debug: config.debug || false,
      parentPinOverlay: config.parentPinOverlay ?? false,
      storageEnvironment: config.storageEnvironment,
      namespace: config.namespace
    };

    // Log version info with vault URL
    console.log('🚀 NostrPass Embassy v1.0.14 | Vault:', this.config.vaultUrl);

    // Disable console.log in production unless debug is enabled
    if (import.meta.env.PROD && !this.config.debug) {
      const isDebugEnabled = typeof localStorage !== 'undefined' &&
        localStorage.getItem('nostrpass:debug') === 'true';
      if (!isDebugEnabled) {
        console.log = () => {};
        console.info = () => {};
      }
    }

    this.handlers = Object.keys(embassyMessageHandlers(this));

    if (this.config.debug || import.meta.env.DEV) {
      console.log('🚀 NostrPass Embassy initialized', this.config);
    }

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
    } else {
      // DOM already loaded, create immediately
      this.createIframe();
    }
  }

  // Core iframe management
  private async createIframe(): Promise<void> {
    if (this.iframe) {
      if (this.config.debug) console.log('Iframe already exists');
      return;
    }

 

    return new Promise((resolve, reject) => {
      this.iframe = document.createElement('iframe');
      this.iframe.id = 'nostrpass-vault-iframe';

      // Build URL with config (appDomain is already normalized in constructor)
      const url = new URL(this.config.vaultUrl!+'/'+sanitizeDomain(this.config.appDomain!));
      url.searchParams.set('appName', this.config.appName!);
      url.searchParams.set('appDomain', this.config.appDomain!);
      url.searchParams.set('theme', this.config.theme!);
      if (this.config.storageEnvironment) {
        url.searchParams.set('storageEnvironment', this.config.storageEnvironment);
      }
      if (this.config.namespace) {
        url.searchParams.set('namespace', this.config.namespace);
      }

      this.iframe.src = url.toString();
      console.log('[Embassy] Creating iframe with:', {
        appDomain: this.config.appDomain,
        sanitized: sanitizeDomain(this.config.appDomain!),
        iframeSrc: url.toString()
      });

    

      // Security attributes
      this.iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox');
      this.iframe.setAttribute('allow', 'publickey-credentials-create; publickey-credentials-get; clipboard-write');

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
        if (this.config.debug) console.log('Iframe loaded successfully');
        // Give the vault a moment to initialize its handlers
        setTimeout(() => {
          if (this.config.debug) console.log('Iframe initialization period complete');
          // Send handshake message to establish connection and verify origin
          // This triggers the vault to lock onto our origin and respond
          if (this.messenger) {
            this.messenger.send('EMBASSY_HANDSHAKE', {
              origin: window.location.origin,
              appName: this.config.appName,
              appDomain: this.config.appDomain,
              timestamp: Date.now()
            });
            console.log('[Embassy] Sent handshake to vault');
          }
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

      if (this.config.debug) console.log('Iframe created and added to DOM');

      // Initialize transport layer if enabled (experimental)
      this.initializeTransport();
    });
  }

  /**
   * Initialize direct worker transport layer (experimental)
   * This allows embassy to communicate directly with the vault worker
   * instead of going through the iframe messenger
   */
  private async initializeTransport(): Promise<void> {
    // Only initialize if useDirectWorker is enabled
    if (!this.config.useDirectWorker) {
      if (this.config.debug) console.log('🔌 Transport layer disabled (useDirectWorker: false)');
      return;
    }

    try {
      if (this.config.debug) console.log('🔌 Initializing transport layer...');
      this.transport = await createTransport();
      await this.transport.connect();
      if (this.config.debug) console.log('✅ Transport layer connected:', this.transport?.constructor.name);
    } catch (error) {
      console.error('❌ Failed to initialize transport layer:', error);
      this.transport = null;
    }
  }

  /**
   * Check if we should use transport layer for this request
   * Returns true if transport is connected and useDirectWorker is enabled
   */
  private useTransportForRequest(): boolean {
    return !!(this.config.useDirectWorker && this.transport?.isConnected());
  }

  /**
   * Open a specific vault page
   * @param page - The vault page to open
   * @param options - Optional size override, button element, and query params
   */
  public openPage(
    page: VaultPage,
    options?: {
      size?: 'full' | 'compact' | 'tall' | 'minimal' | 'thin';
      buttonElement?: HTMLElement;
      queryParams?: Record<string, string>;
    }
  ): void {
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
    const appDomain = sanitizeDomain(this.config.appDomain!);
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
          .catch((error: any) => {
            console.error('Navigation failed, falling back to iframe reload:', error);
            // Fallback to iframe reload if message-based navigation fails
            const newUrl = new URL(this.config.vaultUrl!);
            newUrl.pathname = targetPath;
            newUrl.searchParams.set('appName', this.config.appName!);
            newUrl.searchParams.set('appDomain', this.config.appDomain!);
            newUrl.searchParams.set('theme', this.config.theme!);
            if (this.config.storageEnvironment) {
              newUrl.searchParams.set('storageEnvironment', this.config.storageEnvironment);
            }
            if (this.config.namespace) {
              newUrl.searchParams.set('namespace', this.config.namespace);
            }
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
    this.iframe.classList.remove('nostrpass-iframe-thin');

    // Clear any inline styles that might have been set for compact mode
    this.iframe.style.top = '';
    this.iframe.style.left = '';
    this.iframe.style.transform = '';

    if (size === 'minimal') {
      this.iframe.classList.add('nostrpass-iframe-minimal');
    } else if (size === 'compact' || size === 'tall' || size === 'thin') {
      this.iframe.classList.add(
        size === 'tall' ? 'nostrpass-iframe-tall' :
        size === 'thin' ? 'nostrpass-iframe-thin' :
        'nostrpass-iframe-compact'
      );

      // Position compact/tall/thin mode relative to button if provided, otherwise center
      if (buttonElement) {
        const rect = buttonElement.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const iframeWidth = size === 'thin' ? 228 : 395;
        const iframeHeight = size === 'tall' ? 600 : size === 'thin' ? 422 : 395;
        const gap = 8;

        let top: number;
        let left: number;

        // Determine vertical position (above or below button)
        if (spaceBelow >= iframeHeight + gap) {
          top = rect.bottom + gap;
        } else if (spaceAbove >= iframeHeight + gap) {
          top = rect.top - iframeHeight - gap;
        } else {
          // Centered fallback
          this.iframe.style.top = '50%';
          this.iframe.style.left = '50%';
          this.iframe.style.transform = 'translate(-50%, -50%)';
          return;
        }

        // Determine horizontal position
        // Check if button is closer to right edge (like the dropdown does)
        const buttonCenterX = rect.left + (rect.width / 2);
        const isRightAligned = buttonCenterX > window.innerWidth / 2;

        if (isRightAligned) {
          // Align to the right of the button (like dropdown with right: 0)
          left = rect.right - iframeWidth;
        } else {
          // Align to the left of the button
          left = rect.left;
        }

        // Ensure it stays within viewport bounds
        if (left + iframeWidth > window.innerWidth - gap) {
          left = window.innerWidth - iframeWidth - gap;
        }
        if (left < gap) {
          left = gap;
        }

        this.iframe.style.top = `${top}px`;
        this.iframe.style.left = `${left}px`;
        this.iframe.style.transform = 'none';
      } else {
        // No button provided, center the compact modal
        this.iframe.style.top = '50%';
        this.iframe.style.left = '50%';
        this.iframe.style.transform = 'translate(-50%, -50%)';
      }
    } else {
      this.iframe.classList.add('nostrpass-iframe-visible');
    }

    // Show backdrop with appropriate styling
    if (this.backdropEl) {
      this.backdropEl.classList.add('visible');
      // Always use transparent backdrop
      this.backdropEl.style.background = 'transparent';
      this.backdropEl.style.backdropFilter = 'none';
    }

    // Add click-outside handler for compact, tall, and thin modes
    if (size === 'compact' || size === 'tall' || size === 'thin') {
      if (this.outsideClickHandler) {
        document.removeEventListener('click', this.outsideClickHandler);
      }
      setTimeout(() => {
        this.outsideClickHandler = (e: MouseEvent) => {
          const target = e.target as HTMLElement;
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
  public show(page: string = 'vault', mode: 'full' | 'compact' | 'minimal' | 'thin' = 'full', buttonElement?: HTMLElement): void {
    // Map old page names to new VaultPage type
    let vaultPage: VaultPage;
    if (page === 'unlock' || page === 'unlock-modal') {
      vaultPage = 'unlock';
    } else if (page === 'dashboard') {
      vaultPage = 'dashboard';
    } else {
      vaultPage = 'login'; // default to login page
    }

    this.openPage(vaultPage, { size: mode, buttonElement });
  }

  public hide(): void {
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
    this.iframe.classList.remove('nostrpass-iframe-thin');
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
    if (this.config.debug) console.log('Iframe hidden');
  }

  private injectStyles(): void {
    if (this.styleElement) return;

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
      }

      @media (max-width: 500px) {
        .nostrpass-iframe-compact {
          width: 90vw !important;
          height: 90vw !important;
          max-width: 395px !important;
          max-height: 395px !important;
        }
      }

      /* Thin state - Thinner modal for PIN unlock */
      .nostrpass-iframe-thin {
        position: fixed !important;
        width: 228px !important;
        height: 422px !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
        border: none !important;
        border-radius: 16px !important;
        background: transparent !important;
        z-index: 2147483647 !important;
        overflow: hidden !important;
      }

      @media (max-width: 500px) {
        .nostrpass-iframe-thin {
          width: 228px !important;
          height: 422px !important;
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

    if (this.config.debug) console.log('Styles injected');
  }

  // Initialize messenger for secure communication
  private initializeMessenger(): void {
    if (!this.iframe) return;

    // Create messenger instance with custom send function that targets our specific iframe
    this.messenger = new ParentMessenger(window);
    
    // Override the sendMessage method to use our specific iframe
    (this.messenger as any).sendMessage = (message: any) => {
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
    let trustedOrigins: string[];

    if (this.config.trustedOrigins && this.config.trustedOrigins.length > 0) {
      // Use custom trusted origins if provided
      trustedOrigins = [...this.config.trustedOrigins];
    } else {
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
      } catch (err) {
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
    if (this.config.debug) console.log('Messenger initialized with trusted origins:', trustedOrigins);
  }

  // Set up handlers for vault messages
  private setupMessageHandlers(): void {
    if (!this.messenger) return;

    // Handle vault ready signal
    const handlers = embassyMessageHandlers(this);
    console.log('Setting up message handlers:', this.handlers);
    this.handlers.forEach((handler) => {
      console.log('Registering handler for:', handler);
      this.messenger!.on(handler, handlers[handler as keyof typeof handlers]!);
    });
    
    // Debug: log all registered handlers
    if (this.config.debug) {
      console.log('Message handlers registered:', (this.messenger as any).messageHandlers);
    }
  }

  // Core Nostr methods
  async getPublicKey(options?: NostrOperationOptions): Promise<string> {
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
        } catch {
          identityIndex = 0;
        }
      }

      // Preflight: check if a prompt is needed
      let unlockPromise: Promise<void> | null = null;
      let permissionPromise: Promise<void> | null = null;
      try {
        const preflight = await this.messenger!.request(Msg.CHECK_PERMISSION, {
          action: 'getPublicKey',
          identityIndex
        });
        const needsPin = preflight?.isLocked === true;
        const needsPrompt = preflight?.needsPrompt === true;
        if (needsPin && this.config.parentPinOverlay) {
          const ok = await this.requestPinUnlock();
          if (!ok) throw new Error('User canceled PIN prompt');
        } else if (needsPin && !this.config.parentPinOverlay) {
          // Create the wait promise BEFORE showing the UI
          console.log('⏳ Vault is locked, showing quick unlock...');
          unlockPromise = this.waitForUnlock();
          this.openPage('unlock');
        } else if (needsPrompt && !this.config.parentPinOverlay) {
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

          await this.messenger!.send('NAVIGATE', {
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
      } catch (error: any) {
        // If user is not authenticated at all, show full vault for login
        const errorMsg = String(error?.message || error);
        if (errorMsg.toLowerCase().includes('not authenticated')) {
          console.log('⚠️ User not authenticated, showing full vault for login and waiting for auth...');
          unlockPromise = this.waitForAuth();
          this.show('vault', 'full');
        }
      }

      // If we set up an unlock wait, now wait for it
      if (unlockPromise) {
        console.log('⏳ Waiting for vault unlock...');
        await unlockPromise;
        console.log('✅ Vault unlocked, continuing operation');

        // After unlock, check if we still need permission prompt
        try {
          const recheckPreflight = await this.messenger!.request(Msg.CHECK_PERMISSION, {
            action: 'getPublicKey',
            identityIndex
          });
          if (recheckPreflight?.needsPrompt === true) {
            console.log('⏳ Permission required after unlock, showing permission prompt...');
            permissionPromise = this.waitForPermission();

            // Open permission page with tall size directly
            const requestId = `${this.config.appDomain}-getPublicKey-${Date.now()}`;
            const queryParams = {
              appOrigin: this.config.appDomain || window.location.host,
              appName: this.config.appName || document.title,
              action: 'getPublicKey',
              identityIndex: (identityIndex !== undefined ? identityIndex : 0).toString(),
              requestId
            };

            this.openPage('permission', { size: 'tall', queryParams });
          }
        } catch (error) {
          console.warn('Failed to recheck permission after unlock:', error);
          // Continue anyway, the actual operation will handle permission errors
        }
      }

      // If we set up a permission wait, now wait for it
      if (permissionPromise) {
        console.log('⏳ Waiting for permission approval...');
        await permissionPromise;
        console.log('✅ Permission granted, continuing operation');
      }

      // Send request to vault using transport or messenger
      let response;
      if (this.useTransportForRequest()) {
        if (this.config.debug) console.log('🔌 Using transport layer for getPublicKey');
        response = await this.transport!.request('GET_PUBLIC_KEY', {
          appName: this.config.appName,
          appDomain: this.config.appDomain,
          identityIndex
        });
      } else {
        response = await this.messenger!.request(Msg.GET_PUBLIC_KEY, {
          appName: this.config.appName,
          appDomain: this.config.appDomain,
          identityIndex
        });
      }

      if (this.config.debug) console.log('Public key received:', response);

      // Hide iframe on success
      this.hide();

      return response.publicKey || response;
    } catch (error) {
      // Keep iframe visible on error so user can see what went wrong
      console.error('Failed to get public key:', error);
      throw error;
    }
  }

  async signEvent(event: NostrEvent, options?: NostrOperationOptions): Promise<NostrEvent> {
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
        } catch {
          identityIndex = 0;
        }
      }

      // Preflight: prompt for PIN first if needed, so the op can proceed without error
      let unlockPromise: Promise<void> | null = null;
      let permissionPromise: Promise<void> | null = null;
      try {
        const pre = await this.messenger!.request(Msg.CHECK_PERMISSION, {
          action: 'signEvent',
          eventKind: event?.kind,
          identityIndex
        });
        const needsPin = pre?.isLocked === true;
        const needsPrompt = pre?.needsPrompt === true;
        if (needsPin && this.config.parentPinOverlay) {
          const ok = await this.requestPinUnlock();
          if (!ok) throw new Error('User canceled PIN prompt');
        } else if (needsPin && !this.config.parentPinOverlay) {
          // Create the wait promise BEFORE showing the UI
          console.log('⏳ Vault is locked, showing quick unlock...');
          unlockPromise = this.waitForUnlock();
          this.openPage('unlock');
        } else if (needsPrompt && !this.config.parentPinOverlay) {
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

          await this.messenger!.send('NAVIGATE', {
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
      } catch (error: any) {
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

        // After unlock, check if we still need permission prompt
        try {
          const recheckPreflight = await this.messenger!.request(Msg.CHECK_PERMISSION, {
            action: 'signEvent',
            eventKind: event?.kind,
            identityIndex
          });
          if (recheckPreflight?.needsPrompt === true) {
            console.log('⏳ Permission required after unlock, showing permission prompt...');
            permissionPromise = this.waitForPermission();

            // Open permission page with tall size directly
            const requestId = `${this.config.appDomain}-signEvent-${Date.now()}`;
            const queryParams = {
              appOrigin: this.config.appDomain || window.location.host,
              appName: this.config.appName || document.title,
              action: 'signEvent',
              identityIndex: (identityIndex !== undefined ? identityIndex : 0).toString(),
              requestId,
              eventKind: (event?.kind || 0).toString(),
              event: JSON.stringify(event)
            };

            this.openPage('permission', { size: 'tall', queryParams });
          }
        } catch (error) {
          console.warn('Failed to recheck permission after unlock:', error);
          // Continue anyway, the actual operation will handle permission errors
        }
      }

      // If we set up a permission wait, now wait for it
      if (permissionPromise) {
        console.log('⏳ Waiting for permission approval...');
        await permissionPromise;
        console.log('✅ Permission granted, continuing operation');
      }

      // Send request to vault using transport or messenger
      const send = async () => {
        if (this.useTransportForRequest()) {
          if (this.config.debug) console.log('🔌 Using transport layer for signEvent');
          return this.transport!.request('SIGN_EVENT', {
            event,
            appName: this.config.appName,
            appDomain: this.config.appDomain,
            identityIndex
          });
        } else {
          return this.messenger!.request(Msg.SIGN_EVENT, {
            event,
            appName: this.config.appName,
            appDomain: this.config.appDomain,
            identityIndex
          });
        }
      };

      try {
        const response = await send();
        if (this.config.debug) console.log('Signed event received:', response);
        // Hide iframe on success
        this.hide();
        return response.signedEvent || response;
      } catch (e: any) {
        // If vault is locked or session needs keys, trigger unlock flow
        const msg = String(e?.message || e);
        if (msg.toLowerCase().includes('vault is locked') || msg.toLowerCase().includes('rehydrated')) {
          console.log('🔒 Vault locked or session needs keys, triggering unlock...');

          // Trigger unlock based on configuration
          if (this.config.parentPinOverlay) {
            const ok = await this.requestPinUnlock();
            if (!ok) throw new Error('User canceled PIN prompt');
          } else {
            // Show unlock page and wait for unlock
            const unlockPromise = this.waitForUnlock();
            this.openPage('unlock');
            await unlockPromise;
          }

          // Retry after unlock
          console.log('🔓 Vault unlocked, retrying operation...');
          const response = await send();
          if (this.config.debug) console.log('Signed event received (after unlock):', response);
          this.hide();
          return response.signedEvent || response;
        }
        throw e;
      }
    } catch (error) {
      // Keep iframe visible on error
      console.error('Failed to sign event:', error);
      throw error;
    }
  }

  async getRelays(): Promise<Record<string, { read: boolean; write: boolean }>> {
    // TODO: Implement getRelays
    console.log('TODO: getRelays');
    return {};
  }

  async signData(message: string, options?: NostrOperationOptions): Promise<string> {
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
        } catch {
          identityIndex = 0;
        }
      }

      // Preflight: prompt for PIN first if needed so the op can proceed
      let unlockPromise: Promise<void> | null = null;
      let permissionPromise: Promise<void> | null = null;
      try {
        console.log('🔍 [signData] Calling CHECK_PERMISSION preflight...');
        const pre = await this.messenger!.request(Msg.CHECK_PERMISSION, {
          action: 'signData',
          identityIndex
        });
        console.log('🔍 [signData] CHECK_PERMISSION result:', pre);
        const needsPin = pre?.isLocked === true;
        const needsPrompt = pre?.needsPrompt === true;
        console.log('🔍 [signData] needsPin:', needsPin, 'needsPrompt:', needsPrompt);
        if (needsPin && this.config.parentPinOverlay) {
          const ok = await this.requestPinUnlock();
          if (!ok) throw new Error('User canceled PIN prompt');
        } else if (needsPin && !this.config.parentPinOverlay) {
          // Create the wait promise BEFORE showing the UI
          console.log('⏳ Vault is locked, showing quick unlock...');
          unlockPromise = this.waitForUnlock();
          this.openPage('unlock');
        } else if (needsPrompt && !this.config.parentPinOverlay) {
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

          console.log('📍 Navigating to permission-request page...');
          await this.messenger!.send('NAVIGATE', {
            path: `/${this.config.appDomain?.replace(/[:.]/g, '-') || 'vault'}/permission-request?${queryParams.toString()}`
          });

          // Show the vault (iframe is already navigated to permission page, just make it visible)
          // Apply full-screen display styling
          console.log('👁️ Making iframe visible for permission prompt...');
          if (this.iframe) {
            console.log('👁️ Current iframe classes:', this.iframe.className);
            this.iframe.classList.remove('nostrpass-iframe-hidden');
            this.iframe.classList.remove('nostrpass-iframe-compact');
            this.iframe.classList.remove('nostrpass-iframe-tall');
            this.iframe.classList.remove('nostrpass-iframe-minimal');
            this.iframe.classList.add('nostrpass-iframe-visible');
            console.log('👁️ New iframe classes:', this.iframe.className);

            // Show backdrop
            if (this.backdropEl) {
              this.backdropEl.classList.add('visible');
              this.backdropEl.style.background = 'transparent';
              this.backdropEl.style.backdropFilter = 'none';
              console.log('👁️ Backdrop shown');
            }

            // Accessibility
            this.iframe.setAttribute('aria-hidden', 'false');
            this.iframe.removeAttribute('tabindex');
            document.body.style.overflow = 'hidden';
            console.log('👁️ Iframe should now be visible!');
          } else {
            console.error('❌ No iframe element found!');
          }
        }
      } catch (error: any) {
        // If user is not authenticated at all, show full vault for login
        console.error('❌ [signData] CHECK_PERMISSION preflight failed:', error);
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

        // After unlock, check if we still need permission prompt
        try {
          const recheckPreflight = await this.messenger!.request(Msg.CHECK_PERMISSION, {
            action: 'signData',
            identityIndex
          });
          if (recheckPreflight?.needsPrompt === true) {
            console.log('⏳ Permission required after unlock, showing permission prompt...');
            permissionPromise = this.waitForPermission();

            // Tell vault to open permission page with tall size
            const requestId = `${this.config.appDomain}-signData-${Date.now()}`;
            const queryParams = {
              appOrigin: this.config.appDomain || window.location.host,
              appName: this.config.appName || document.title,
              action: 'signData',
              identityIndex: (identityIndex !== undefined ? identityIndex : 0).toString(),
              requestId,
              data: message
            };

            this.openPage('permission', { size: 'tall', queryParams });
          }
        } catch (error) {
          console.warn('Failed to recheck permission after unlock:', error);
          // Continue anyway, the actual operation will handle permission errors
        }
      }

      // If we set up a permission wait, now wait for it
      if (permissionPromise) {
        console.log('⏳ Waiting for permission approval...');
        await permissionPromise;
        console.log('✅ Permission granted, continuing operation');
      }

      const doSign = async () => {
        if (this.useTransportForRequest()) {
          if (this.config.debug) console.log('🔌 Using transport layer for signData');
          return this.transport!.request('SIGN_DATA', {
            data: message,
            appName: this.config.appName,
            appDomain: this.config.appDomain,
            identityIndex
          });
        } else {
          return this.messenger!.request(Msg.SIGN_DATA, {
            data: message,
            appName: this.config.appName,
            appDomain: this.config.appDomain,
            identityIndex
          });
        }
      };

      try {
        const resp = await doSign();
        const signature = resp?.signature ?? resp;
        if (this.config.debug) console.log('Signed data received:', signature);
        this.hide();
        return signature;
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (msg.toLowerCase().includes('locked') || msg.toLowerCase().includes('unlock') || msg.toLowerCase().includes('rehydrated')) {
          await this.sleep(150);
          try {
            const resp = await doSign();
            this.hide();
            return resp?.signature ?? resp;
          } catch (e2: any) {
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
    } catch (error) {
      console.error('Failed to sign data:', error);
      throw error;
    }
  }

  async encrypt(pubkey: string, plaintext: string, options?: NostrOperationOptions): Promise<string> {
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
        } catch {
          identityIndex = 0;
        }
      }

      // Preflight: prompt for PIN first if needed
      let unlockPromise: Promise<void> | null = null;
      let permissionPromise: Promise<void> | null = null;
      try {
        const pre = await this.messenger!.request(Msg.CHECK_PERMISSION, {
          action: 'nip04',
          identityIndex
        });
        const needsPin = pre?.isLocked === true;
        const needsPrompt = pre?.needsPrompt === true;
        if (needsPin && this.config.parentPinOverlay) {
          const ok = await this.requestPinUnlock();
          if (!ok) throw new Error('User canceled PIN prompt');
        } else if (needsPin && !this.config.parentPinOverlay) {
          // Create the wait promise BEFORE showing the UI
          console.log('⏳ Vault is locked, showing quick unlock...');
          unlockPromise = this.waitForUnlock();
          this.openPage('unlock');
        } else if (needsPrompt && !this.config.parentPinOverlay) {
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

          await this.messenger!.send('NAVIGATE', {
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
      } catch (error: any) {
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

        // After unlock, check if we still need permission prompt
        try {
          const recheckPreflight = await this.messenger!.request(Msg.CHECK_PERMISSION, {
            action: 'nip04',
            identityIndex
          });
          if (recheckPreflight?.needsPrompt === true) {
            console.log('⏳ Permission required after unlock, showing permission prompt...');
            permissionPromise = this.waitForPermission();

            // Tell vault to open permission page with tall size
            const requestId = `${this.config.appDomain}-nip04-encrypt-${Date.now()}`;
            const queryParams = {
              appOrigin: this.config.appDomain || window.location.host,
              appName: this.config.appName || document.title,
              action: 'nip04',
              identityIndex: (identityIndex !== undefined ? identityIndex : 0).toString(),
              requestId,
              pubkey,
              plaintext
            };

            this.openPage('permission', { size: 'tall', queryParams });
          }
        } catch (error) {
          console.warn('Failed to recheck permission after unlock:', error);
          // Continue anyway, the actual operation will handle permission errors
        }
      }

      // If we set up a permission wait, now wait for it
      if (permissionPromise) {
        console.log('⏳ Waiting for permission approval...');
        await permissionPromise;
        console.log('✅ Permission granted, continuing operation');
      }

      // Send request to vault using transport or messenger
      const doEncrypt = async () => {
        if (this.useTransportForRequest()) {
          if (this.config.debug) console.log('🔌 Using transport layer for encrypt');
          return this.transport!.request('ENCRYPT', {
            plaintext,
            recipientPubkey: pubkey,
            appName: this.config.appName,
            appDomain: this.config.appDomain,
            identityIndex
          });
        } else {
          return this.messenger!.request(Msg.ENCRYPT, {
            plaintext,
            recipientPubkey: pubkey,
            appName: this.config.appName,
            appDomain: this.config.appDomain,
            identityIndex
          });
        }
      };

      try {
        const ciphertext = await doEncrypt();
        if (this.config.debug) console.log('Encrypted payload received:', ciphertext);
        this.hide();
        return ciphertext;
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (msg.toLowerCase().includes('locked') || msg.toLowerCase().includes('unlock') || msg.toLowerCase().includes('rehydrated')) {
          await this.sleep(150);
          try { 
            const result = await doEncrypt();
            this.hide();
            return result;
          } catch (e2: any) {
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
    } catch (error) {
      console.error('Failed to encrypt:', error);
      throw error;
    }
  }

  async decrypt(pubkey: string, ciphertext: string, options?: NostrOperationOptions): Promise<string> {
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
        } catch {
          identityIndex = 0;
        }
      }

      // Preflight: prompt for PIN first if needed
      let unlockPromise: Promise<void> | null = null;
      let permissionPromise: Promise<void> | null = null;
      try {
        const pre = await this.messenger!.request(Msg.CHECK_PERMISSION, {
          action: 'nip04',
          identityIndex
        });
        const needsPin = pre?.isLocked === true;
        const needsPrompt = pre?.needsPrompt === true;
        if (needsPin && this.config.parentPinOverlay) {
          const ok = await this.requestPinUnlock();
          if (!ok) throw new Error('User canceled PIN prompt');
        } else if (needsPin && !this.config.parentPinOverlay) {
          // Create the wait promise BEFORE showing the UI
          console.log('⏳ Vault is locked, showing quick unlock...');
          unlockPromise = this.waitForUnlock();
          this.openPage('unlock');
        } else if (needsPrompt && !this.config.parentPinOverlay) {
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

          await this.messenger!.send('NAVIGATE', {
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
      } catch (error: any) {
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

        // After unlock, check if we still need permission prompt
        try {
          const recheckPreflight = await this.messenger!.request(Msg.CHECK_PERMISSION, {
            action: 'nip04',
            identityIndex
          });
          if (recheckPreflight?.needsPrompt === true) {
            console.log('⏳ Permission required after unlock, showing permission prompt...');
            permissionPromise = this.waitForPermission();

            // Tell vault to open permission page with tall size
            const requestId = `${this.config.appDomain}-nip04-decrypt-${Date.now()}`;
            const queryParams = {
              appOrigin: this.config.appDomain || window.location.host,
              appName: this.config.appName || document.title,
              action: 'nip04',
              identityIndex: (identityIndex !== undefined ? identityIndex : 0).toString(),
              requestId,
              pubkey,
              ciphertext
            };

            this.openPage('permission', { size: 'tall', queryParams });
          }
        } catch (error) {
          console.warn('Failed to recheck permission after unlock:', error);
          // Continue anyway, the actual operation will handle permission errors
        }
      }

      // If we set up a permission wait, now wait for it
      if (permissionPromise) {
        console.log('⏳ Waiting for permission approval...');
        await permissionPromise;
        console.log('✅ Permission granted, continuing operation');
      }

      // Send request to vault using transport or messenger
      const doDecrypt = async () => {
        if (this.useTransportForRequest()) {
          if (this.config.debug) console.log('🔌 Using transport layer for decrypt');
          return this.transport!.request('DECRYPT', {
            ciphertext,
            senderPubkey: pubkey,
            appName: this.config.appName,
            appDomain: this.config.appDomain,
            identityIndex
          });
        } else {
          return this.messenger!.request(Msg.DECRYPT, {
            ciphertext,
            senderPubkey: pubkey,
            appName: this.config.appName,
            appDomain: this.config.appDomain,
            identityIndex
          });
        }
      };

      try {
        const plaintext = await doDecrypt();
        if (this.config.debug) console.log('Decrypted payload received:', plaintext);
        this.hide();
        return plaintext;
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (msg.toLowerCase().includes('locked') || msg.toLowerCase().includes('unlock') || msg.toLowerCase().includes('rehydrated')) {
          await this.sleep(150);
          try { 
            const result = await doDecrypt();
            this.hide();
            return result;
          } catch (e2: any) {
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
    } catch (error) {
      console.error('Failed to decrypt:', error);
      throw error;
    }
  }

  /**
   * Encrypt data using NIP-44 (improved encryption standard)
   * NIP-44 is the recommended encryption method, replacing NIP-04
   */
  async nip44Encrypt(pubkey: string, plaintext: string, options?: NostrOperationOptions): Promise<string> {
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
        } catch {
          identityIndex = 0;
        }
      }

      // Preflight: prompt for PIN first if needed
      let unlockPromise: Promise<void> | null = null;
      let permissionPromise: Promise<void> | null = null;
      try {
        const pre = await this.messenger!.request(Msg.CHECK_PERMISSION, {
          action: 'nip44',
          identityIndex
        });
        const needsPin = pre?.isLocked === true;
        const needsPrompt = pre?.needsPrompt === true;
        if (needsPin && this.config.parentPinOverlay) {
          const ok = await this.requestPinUnlock();
          if (!ok) throw new Error('User canceled PIN prompt');
        } else if (needsPin && !this.config.parentPinOverlay) {
          console.log('⏳ Vault is locked, showing quick unlock...');
          unlockPromise = this.waitForUnlock();
          this.openPage('unlock');
        } else if (needsPrompt && !this.config.parentPinOverlay) {
          console.log('⏳ Permission required, showing vault and waiting for approval...');
          permissionPromise = this.waitForPermission();

          const requestId = `${this.config.appDomain}-nip44-encrypt-${Date.now()}`;
          const queryParams = new URLSearchParams({
            appOrigin: this.config.appDomain || window.location.host,
            appName: this.config.appName || document.title,
            action: 'nip44',
            identityIndex: (identityIndex !== undefined ? identityIndex : 0).toString(),
            requestId,
            pubkey,
            plaintext
          });

          await this.messenger!.send('NAVIGATE', {
            path: `/${this.config.appDomain?.replace(/[:.]/g, '-') || 'vault'}/permission-request?${queryParams.toString()}`
          });

          if (this.iframe) {
            this.iframe.classList.remove('nostrpass-iframe-hidden');
            this.iframe.classList.remove('nostrpass-iframe-compact');
            this.iframe.classList.remove('nostrpass-iframe-tall');
            this.iframe.classList.remove('nostrpass-iframe-minimal');
            this.iframe.classList.add('nostrpass-iframe-visible');

            if (this.backdropEl) {
              this.backdropEl.classList.add('visible');
              this.backdropEl.style.background = 'transparent';
              this.backdropEl.style.backdropFilter = 'none';
            }

            this.iframe.setAttribute('aria-hidden', 'false');
            this.iframe.removeAttribute('tabindex');
            document.body.style.overflow = 'hidden';
          }
        }
      } catch (error: any) {
        const errorMsg = String(error?.message || error);
        if (errorMsg.toLowerCase().includes('not authenticated')) {
          console.log('⚠️ User not authenticated, showing full vault for login');
          this.show('vault', 'full');
        }
      }

      if (unlockPromise) {
        console.log('⏳ Waiting for vault unlock...');
        await unlockPromise;
        console.log('✅ Vault unlocked, continuing operation');

        try {
          const recheckPreflight = await this.messenger!.request(Msg.CHECK_PERMISSION, {
            action: 'nip44',
            identityIndex
          });
          if (recheckPreflight?.needsPrompt === true) {
            console.log('⏳ Permission required after unlock, showing permission prompt...');
            permissionPromise = this.waitForPermission();

            const requestId = `${this.config.appDomain}-nip44-encrypt-${Date.now()}`;
            const queryParams = {
              appOrigin: this.config.appDomain || window.location.host,
              appName: this.config.appName || document.title,
              action: 'nip44',
              identityIndex: (identityIndex !== undefined ? identityIndex : 0).toString(),
              requestId,
              pubkey,
              plaintext
            };

            this.openPage('permission', { size: 'tall', queryParams });
          }
        } catch (error) {
          console.warn('Failed to recheck permission after unlock:', error);
        }
      }

      if (permissionPromise) {
        console.log('⏳ Waiting for permission approval...');
        await permissionPromise;
        console.log('✅ Permission granted, continuing operation');
      }

      const doEncrypt = async () => {
        if (this.useTransportForRequest()) {
          if (this.config.debug) console.log('🔌 Using transport layer for nip44 encrypt');
          return this.transport!.request('NIP44_ENCRYPT', {
            plaintext,
            recipientPubkey: pubkey,
            appName: this.config.appName,
            appDomain: this.config.appDomain,
            identityIndex
          });
        } else {
          return this.messenger!.request(Msg.NIP44_ENCRYPT, {
            plaintext,
            recipientPubkey: pubkey,
            appName: this.config.appName,
            appDomain: this.config.appDomain,
            identityIndex
          });
        }
      };

      try {
        const ciphertext = await doEncrypt();
        if (this.config.debug) console.log('NIP-44 encrypted payload received:', ciphertext);
        this.hide();
        return ciphertext;
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (msg.toLowerCase().includes('locked') || msg.toLowerCase().includes('unlock') || msg.toLowerCase().includes('rehydrated')) {
          await this.sleep(150);
          try {
            const result = await doEncrypt();
            this.hide();
            return result;
          } catch (e2: any) {
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
    } catch (error) {
      console.error('Failed to nip44 encrypt:', error);
      throw error;
    }
  }

  /**
   * Decrypt data using NIP-44 (improved encryption standard)
   * NIP-44 is the recommended encryption method, replacing NIP-04
   */
  async nip44Decrypt(pubkey: string, ciphertext: string, options?: NostrOperationOptions): Promise<string> {
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
        } catch {
          identityIndex = 0;
        }
      }

      // Preflight: prompt for PIN first if needed
      let unlockPromise: Promise<void> | null = null;
      let permissionPromise: Promise<void> | null = null;
      try {
        const pre = await this.messenger!.request(Msg.CHECK_PERMISSION, {
          action: 'nip44',
          identityIndex
        });
        const needsPin = pre?.isLocked === true;
        const needsPrompt = pre?.needsPrompt === true;
        if (needsPin && this.config.parentPinOverlay) {
          const ok = await this.requestPinUnlock();
          if (!ok) throw new Error('User canceled PIN prompt');
        } else if (needsPin && !this.config.parentPinOverlay) {
          console.log('⏳ Vault is locked, showing quick unlock...');
          unlockPromise = this.waitForUnlock();
          this.openPage('unlock');
        } else if (needsPrompt && !this.config.parentPinOverlay) {
          console.log('⏳ Permission required, showing vault and waiting for approval...');
          permissionPromise = this.waitForPermission();

          const requestId = `${this.config.appDomain}-nip44-decrypt-${Date.now()}`;
          const queryParams = new URLSearchParams({
            appOrigin: this.config.appDomain || window.location.host,
            appName: this.config.appName || document.title,
            action: 'nip44',
            identityIndex: (identityIndex !== undefined ? identityIndex : 0).toString(),
            requestId,
            pubkey,
            ciphertext
          });

          await this.messenger!.send('NAVIGATE', {
            path: `/${this.config.appDomain?.replace(/[:.]/g, '-') || 'vault'}/permission-request?${queryParams.toString()}`
          });

          if (this.iframe) {
            this.iframe.classList.remove('nostrpass-iframe-hidden');
            this.iframe.classList.remove('nostrpass-iframe-compact');
            this.iframe.classList.remove('nostrpass-iframe-tall');
            this.iframe.classList.remove('nostrpass-iframe-minimal');
            this.iframe.classList.add('nostrpass-iframe-visible');

            if (this.backdropEl) {
              this.backdropEl.classList.add('visible');
              this.backdropEl.style.background = 'transparent';
              this.backdropEl.style.backdropFilter = 'none';
            }

            this.iframe.setAttribute('aria-hidden', 'false');
            this.iframe.removeAttribute('tabindex');
            document.body.style.overflow = 'hidden';
          }
        }
      } catch (error: any) {
        const errorMsg = String(error?.message || error);
        if (errorMsg.toLowerCase().includes('not authenticated')) {
          console.log('⚠️ User not authenticated, showing full vault for login');
          this.show('vault', 'full');
        }
      }

      if (unlockPromise) {
        console.log('⏳ Waiting for vault unlock...');
        await unlockPromise;
        console.log('✅ Vault unlocked, continuing operation');

        try {
          const recheckPreflight = await this.messenger!.request(Msg.CHECK_PERMISSION, {
            action: 'nip44',
            identityIndex
          });
          if (recheckPreflight?.needsPrompt === true) {
            console.log('⏳ Permission required after unlock, showing permission prompt...');
            permissionPromise = this.waitForPermission();

            const requestId = `${this.config.appDomain}-nip44-decrypt-${Date.now()}`;
            const queryParams = {
              appOrigin: this.config.appDomain || window.location.host,
              appName: this.config.appName || document.title,
              action: 'nip44',
              identityIndex: (identityIndex !== undefined ? identityIndex : 0).toString(),
              requestId,
              pubkey,
              ciphertext
            };

            this.openPage('permission', { size: 'tall', queryParams });
          }
        } catch (error) {
          console.warn('Failed to recheck permission after unlock:', error);
        }
      }

      if (permissionPromise) {
        console.log('⏳ Waiting for permission approval...');
        await permissionPromise;
        console.log('✅ Permission granted, continuing operation');
      }

      const doDecrypt = async () => {
        if (this.useTransportForRequest()) {
          if (this.config.debug) console.log('🔌 Using transport layer for nip44 decrypt');
          return this.transport!.request('NIP44_DECRYPT', {
            ciphertext,
            senderPubkey: pubkey,
            appName: this.config.appName,
            appDomain: this.config.appDomain,
            identityIndex
          });
        } else {
          return this.messenger!.request(Msg.NIP44_DECRYPT, {
            ciphertext,
            senderPubkey: pubkey,
            appName: this.config.appName,
            appDomain: this.config.appDomain,
            identityIndex
          });
        }
      };

      try {
        const plaintext = await doDecrypt();
        if (this.config.debug) console.log('NIP-44 decrypted payload received:', plaintext);
        this.hide();
        return plaintext;
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (msg.toLowerCase().includes('locked') || msg.toLowerCase().includes('unlock') || msg.toLowerCase().includes('rehydrated')) {
          await this.sleep(150);
          try {
            const result = await doDecrypt();
            this.hide();
            return result;
          } catch (e2: any) {
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
    } catch (error) {
      console.error('Failed to nip44 decrypt:', error);
      throw error;
    }
  }

  async getAuthStatus(): Promise<any> {
    if (!this.iframe || !this.messenger) {
      await this.createIframe();
      await this.waitForReady();
    }

    try {
      const response = await this.messenger!.request(Msg.AUTH_STATUS, {});
      return response;
    } catch (error) {
      console.error('Failed to get auth status:', error);
      throw error;
    }
  }

  async getAllIdentities(): Promise<any> {
    if (!this.iframe || !this.messenger) {
      await this.createIframe();
      await this.waitForReady();
    }

    try {
      const response = await this.messenger!.request(Msg.GET_ALL_IDENTITIES, {});
      return response;
    } catch (error) {
      console.error('Failed to get all identities:', error);
      throw error;
    }
  }

  async switchIdentity(identityIndex: number): Promise<any> {
    if (!this.iframe || !this.messenger) {
      await this.createIframe();
      await this.waitForReady();
    }

    try {
      const response = await this.messenger!.request(Msg.SWITCH_IDENTITY, { identityIndex });
      return response;
    } catch (error) {
      console.error('Failed to switch identity:', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    if (!this.iframe || !this.messenger) {
      console.log('[Embassy] No iframe/messenger to logout from');
      return;
    }

    try {
      console.log('[Embassy] Sending LOGOUT message to vault');
      await this.messenger!.request(Msg.LOGOUT, {});
      console.log('[Embassy] Logout successful');
    } catch (error) {
      console.error('[Embassy] Logout failed:', error);
      throw error;
    }
  }

  async manageAccount(options: AccountManagerOptions = {}): Promise<AccountManagerResult> {
    if (!this.iframe || !this.messenger) {
      await this.createIframe();
      await this.waitForReady();
    }

    const forcePrompt = options.forcePrompt ?? true;

    // Use minimal mode for initial auth (login/signup), compact for quick operations
    const mode = options.size || 'minimal';
    this.show('vault', mode, options.buttonElement);

    try {
      const response = await this.messenger!.request(Msg.MANAGE_ACCOUNTS, {
        appName: this.config.appName,
        appDomain: this.config.appDomain,
        forcePrompt
      });
      // Only hide on success
      this.hide();
      return response;
    } catch (error) {
      // Don't hide on error - user needs to see the vault to unlock/login
      throw error;
    }
  }

  createAccountManagerButton(options: AccountManagerButtonOptions = {}): HTMLButtonElement {
    const {
      label = 'Manage NostrPass Account',
      className = 'nostrpass-account-button',
      appendTo,
      buttonElement,
      disabledText,
      onSelect,
      onError,
      forcePrompt
    } = options;

    const button = buttonElement ?? document.createElement('button');
    if (!buttonElement) {
      button.type = 'button';
      button.className = className;
      button.textContent = label;
    } else if (className) {
      buttonElement.className = className;
    }

    const handleClick = async (event: Event) => {
      event.preventDefault();
      const previousLabel = button.textContent;
      try {
        button.disabled = true;
        if (disabledText) {
          button.textContent = disabledText;
        }
        const result = await this.manageAccount({ forcePrompt });
        onSelect?.(result);
      } catch (error) {
        if (onError) {
          onError(error);
        } else {
          console.error('[NostrPass] Failed to manage account:', error);
        }
      } finally {
        button.disabled = false;
        if (disabledText && previousLabel !== undefined && previousLabel !== null) {
          button.textContent = previousLabel;
        }
      }
    };

    button.addEventListener('click', handleClick);

    if (appendTo) {
      const target = typeof appendTo === 'string' ? document.querySelector<HTMLElement>(appendTo) : appendTo;
      if (!target) {
        console.warn('[NostrPass] Unable to find target element for account manager button:', appendTo);
      } else if (!button.parentElement) {
        target.appendChild(button);
      }
    }

    return button;
  }

  /**
   * Create a production-ready NostrPass authentication button
   * Similar to Clerk's user button pattern
   */
  createNostrPassButton(config: NostrPassButtonConfig = {}): NostrPassButton {
    return new NostrPassButton(this, config);
  }

  // Public utility methods
  public isReady(): boolean {
    return this._isReady;
  }

  /**
   * Get the vault origin URL
   * @returns The origin of the vault (e.g., 'https://vault.nostrpass.com')
   */
  public getVaultOrigin(): string {
    return new URL(this.config.vaultUrl!).origin;
  }

  public async waitForReady(): Promise<void> {
    if (this._isReady) return;

    // Wait for iframe to be ready
    return new Promise((resolve) => {
      const checkReady = () => {
        if (this._isReady) {
          resolve();
        } else {
          setTimeout(checkReady, 100);
        }
      };
      checkReady();
    });
  }

  // Cleanup
  public destroy(): void {
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

    if (this.config.debug) console.log('Embassy destroyed');
  }
}

// Global instance
let embassyInstance: NostrPassEmbassy | null = null;

// Initialize function
function initNostrPass(config: EmbassyConfig = {}): NostrProvider {
  // If there's already an instance, destroy it first
  if (embassyInstance) {
    embassyInstance.destroy();
  }
  
  embassyInstance = new NostrPassEmbassy(config);

  // Create the nostr provider interface
  const nostrProvider: NostrProvider = {
    getPublicKey: (options?: NostrOperationOptions) => embassyInstance!.getPublicKey(options),
    signEvent: (event: NostrEvent, options?: NostrOperationOptions) => embassyInstance!.signEvent(event, options),
    signData: (message: string, options?: NostrOperationOptions) => embassyInstance!.signData(message, options),
    getRelays: () => embassyInstance!.getRelays(),
    nip04: {
      encrypt: (pubkey: string, plaintext: string, options?: NostrOperationOptions) => embassyInstance!.encrypt(pubkey, plaintext, options),
      decrypt: (pubkey: string, ciphertext: string, options?: NostrOperationOptions) => embassyInstance!.decrypt(pubkey, ciphertext, options)
    },
    manageAccount: (options?: AccountManagerOptions) => embassyInstance!.manageAccount(options),
    createAccountManagerButton: (options?: AccountManagerButtonOptions) => embassyInstance!.createAccountManagerButton(options),
    createNostrPassButton: (config?: NostrPassButtonConfig) => embassyInstance!.createNostrPassButton(config)
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

// Set up global window interface
declare global {
  interface Window {
    nostr?: NostrProvider;
    initNostrPass?: (config?: EmbassyConfig) => NostrProvider;
    showVault?: () => void;
    hideVault?: () => void;
  }
}

// Auto-initialize
if (typeof window !== 'undefined') {
  window.initNostrPass = initNostrPass;
  window.showVault = showVault;
  window.hideVault = hideVault;
  
  // Don't auto-initialize if the script will be manually initialized
  // Check if there's a script tag with data-manual-init
  const currentScript = document.currentScript as HTMLScriptElement;
  const manualInit = currentScript?.getAttribute('data-manual-init') === 'true';
  
  if (!manualInit) {
    // Get config from data attributes
    const config: EmbassyConfig = {};
    
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
      config.theme = currentScript.getAttribute('data-theme') as 'light' | 'dark' | 'auto' || undefined;
    }
    
    // Auto-install window.nostr with config from data attributes
    const provider = initNostrPass(config);
    window.nostr = provider;
    console.log('✅ NostrPass Embassy auto-initialized with config:', config);
  } else {
    console.log('✅ NostrPass Embassy loaded (manual init mode)');
  }
  
  console.log('💡 Use window.initNostrPass(config) to customize');
}

export { initNostrPass, NostrPassEmbassy, NostrPassButton };
export type {
  EmbassyConfig,
  NostrEvent,
  NostrProvider,
  AccountManagerOptions,
  AccountManagerResult,
  AccountManagerButtonOptions,
  AccountIdentitySummary,
  NostrPassButtonConfig,
  UserInfo
};