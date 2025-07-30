/**
 * NostrPass Embassy - Minimal Implementation
 * 
 * Core SDK for third-party Nostr app integration
 * Build this file incrementally, one function at a time
 */

import { ParentMessenger } from '@nostrpass/messenger';
import { embassyMessageHandlers } from './embassyMessageHandlers';
import { sanitizeDomain } from '@nostrpass/nostrHelpers';

interface EmbassyConfig {
  appName?: string;
  appDomain?: string;
  permissions?: string[];
  vaultUrl?: string;
  theme?: 'light' | 'dark' | 'auto';
  debug?: boolean;
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

interface NostrProvider {
  getPublicKey(): Promise<string>;
  signEvent(event: NostrEvent): Promise<NostrEvent>;
  getRelays?(): Promise<Record<string, { read: boolean; write: boolean }>>;
  nip04?: {
    encrypt(pubkey: string, plaintext: string): Promise<string>;
    decrypt(pubkey: string, ciphertext: string): Promise<string>;
  };
}

class NostrPassEmbassy {
  private config: EmbassyConfig;
  private iframe: HTMLIFrameElement | null = null;
  private _isReady = false;
  private styleElement: HTMLStyleElement | null = null;
  private messenger: ParentMessenger | null = null;
  private handlers: string[] = [];

  constructor(config: EmbassyConfig = {}) {
    this.config = {
      appName: config.appName || document.title || 'Unknown App',
      appDomain: config.appDomain || window.location.host,
      permissions: config.permissions || ['getPublicKey', 'signEvent'],
      vaultUrl: config.vaultUrl || 'http://localhost:3001',
      theme: config.theme || 'auto',
      debug: config.debug || false
    };

    this.handlers = Object.keys(embassyMessageHandlers(this));

    console.log('🚀 NostrPass Embassy initialized', this.config);

    // Inject styles on initialization
    this.injectStyles();

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

      // Build URL with config
      const url = new URL(this.config.vaultUrl!+'/'+sanitizeDomain(this.config.appDomain!));
      url.searchParams.set('appName', this.config.appName!);
      url.searchParams.set('appDomain', this.config.appDomain!);
      url.searchParams.set('theme', this.config.theme!);

      this.iframe.src = url.toString();
      console.log('iframe.src', url.toString());

    

      // Security attributes
      this.iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox');
      this.iframe.setAttribute('allow', 'publickey-credentials-create; publickey-credentials-get');

      // Accessibility attributes for hidden state
      this.iframe.setAttribute('aria-hidden', 'true');
      this.iframe.setAttribute('tabindex', '-1');
      this.iframe.setAttribute('title', 'NostrPass Vault');

      // Initially hidden off-screen (not display:none for better performance)
      this.iframe.className = 'nostrpass-iframe nostrpass-iframe-hidden';

      // Apply debug mode if enabled
      if (this.config.debug && new URLSearchParams(window.location.search).has('embassy-debug')) {
        this.iframe.classList.add('nostrpass-iframe-debug');
        this.iframe.classList.remove('nostrpass-iframe-hidden');
      }

      // Handle load events
      this.iframe.onload = () => {
        if (this.config.debug) console.log('Iframe loaded successfully');

        // Initialize messenger after iframe loads
        this.initializeMessenger();

        this._isReady = true;
        resolve();
      };

      this.iframe.onerror = () => {
        console.error('Failed to load NostrPass vault');
        reject(new Error('Failed to load vault iframe'));
      };

      // Add to DOM
      document.body.appendChild(this.iframe);

      if (this.config.debug) console.log('Iframe created and added to DOM');
    });
  }

  public show(page: string = 'vault'): void {
    if (!this.iframe) {
      console.warn('Cannot show iframe - not created yet');
      this.createIframe().then(() => this.show(page));
      return;
    }

    // Remove hidden class to show iframe
    this.iframe.classList.remove('nostrpass-iframe-hidden');
    this.iframe.classList.add('nostrpass-iframe-visible');

    // Accessibility
    this.iframe.setAttribute('aria-hidden', 'false');
    this.iframe.removeAttribute('tabindex');

    document.body.style.overflow = 'hidden'; // Prevent background scrolling

    if (this.config.debug) console.log('Iframe shown');
  }

  public hide(): void {
    if (!this.iframe) {
      console.warn('Cannot hide iframe - not created yet');
      return;
    }

    // Add hidden class to move off-screen
    this.iframe.classList.remove('nostrpass-iframe-visible');
    this.iframe.classList.add('nostrpass-iframe-hidden');

    // Accessibility
    this.iframe.setAttribute('aria-hidden', 'true');
    this.iframe.setAttribute('tabindex', '-1');

    document.body.style.overflow = ''; // Restore scrolling

    if (this.config.debug) console.log('Iframe hidden');
  }

  private injectStyles(): void {
    if (this.styleElement) return;

    this.styleElement = document.createElement('style');
    this.styleElement.id = 'nostrpass-embassy-styles';
    this.styleElement.textContent = `
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
      }
      
      /* Visible state - fullscreen overlay */
      .nostrpass-iframe-visible {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
        border: none !important;
        z-index: 2147483647 !important; /* Maximum z-index */
        background: #3333334d !important;
        color-scheme: light dark; /* Support both themes */
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
        background: white !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
      }
    `;

    document.head.appendChild(this.styleElement);

    if (this.config.debug) console.log('Styles injected');
  }

  // Initialize messenger for secure communication
  private initializeMessenger(): void {
    if (!this.iframe) return;

    // Create messenger instance
    this.messenger = new ParentMessenger(window);

    // Initialize with vault origin
    const vaultOrigin = new URL(this.config.vaultUrl!).origin;
    this.messenger.init([vaultOrigin]);

    // Set up message handlers
    this.setupMessageHandlers();
    if (this.config.debug) console.log('Messenger initialized with origin:', vaultOrigin);
  }

  // Set up handlers for vault messages
  private setupMessageHandlers(): void {
    if (!this.messenger) return;

    // Handle vault ready signal
    const handlers = embassyMessageHandlers(this);
    this.handlers.forEach((handler) => {
      this.messenger!.on(handler, handlers[handler as keyof typeof handlers]!);
    });
  }

  // Core Nostr methods
  async getPublicKey(): Promise<string> {
    // Ensure iframe and messenger exist
    if (!this.iframe || !this.messenger) {
      await this.createIframe();
      await this.waitForReady();
    }

    // Show iframe for user interaction
    this.show();

    try {
      // Send request to vault using messenger
      const response = await this.messenger!.request('GET_PUBLIC_KEY', {
        appName: this.config.appName,
        appDomain: this.config.appDomain
      });

      if (this.config.debug) console.log('Public key received:', response);

      // Hide iframe after successful response
      this.hide();

      return response.publicKey || response;
    } catch (error) {
      // Keep iframe visible on error so user can see what went wrong
      console.error('Failed to get public key:', error);
      throw error;
    }
  }

  async signEvent(event: NostrEvent): Promise<NostrEvent> {
    // Ensure iframe and messenger exist
    if (!this.iframe || !this.messenger) {
      await this.createIframe();
      await this.waitForReady();
    }

    // Show iframe for user interaction
    this.show();

    try {
      // Send request to vault using messenger
      const response = await this.messenger!.request('SIGN_EVENT', {
        event,
        appName: this.config.appName,
        appDomain: this.config.appDomain
      });

      if (this.config.debug) console.log('Signed event received:', response);

      // Hide iframe after successful response
      this.hide();

      return response.signedEvent || response;
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

  async encrypt(pubkey: string, plaintext: string): Promise<string> {
    // TODO: Implement NIP-04 encrypt
    console.log('TODO: encrypt', { pubkey, plaintext });
    throw new Error('Not implemented');
  }

  async decrypt(pubkey: string, ciphertext: string): Promise<string> {
    // TODO: Implement NIP-04 decrypt
    console.log('TODO: decrypt', { pubkey, ciphertext });
    throw new Error('Not implemented');
  }

  // Public utility methods
  public isReady(): boolean {
    return this._isReady;
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
  embassyInstance = new NostrPassEmbassy(config);

  // Create the nostr provider interface
  const nostrProvider: NostrProvider = {
    getPublicKey: () => embassyInstance!.getPublicKey(),
    signEvent: (event: NostrEvent) => embassyInstance!.signEvent(event),
    getRelays: () => embassyInstance!.getRelays(),
    nip04: {
      encrypt: (pubkey: string, plaintext: string) => embassyInstance!.encrypt(pubkey, plaintext),
      decrypt: (pubkey: string, ciphertext: string) => embassyInstance!.decrypt(pubkey, ciphertext)
    }
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
  // Install window.nostr
  const provider = initNostrPass();
  window.nostr = provider;




  console.log('✅ NostrPass Embassy loaded');
  console.log('💡 Use window.initNostrPass(config) to customize');
}

export { initNostrPass, NostrPassEmbassy };
export type { EmbassyConfig, NostrEvent, NostrProvider };