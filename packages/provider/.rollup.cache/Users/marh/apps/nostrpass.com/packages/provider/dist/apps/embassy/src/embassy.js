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
    notifyUnlocked() {
        console.log('🔓 Notifying unlock resolvers:', this.unlockResolvers.length);
        while (this.unlockResolvers.length > 0) {
            const resolve = this.unlockResolvers.shift();
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
        this.config = {
            appName: config.appName || document.title || 'Unknown App',
            appDomain: config.appDomain || window.location.host,
            permissions: config.permissions || ['getPublicKey', 'signEvent'],
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
            // Build URL with config
            const url = new URL(this.config.vaultUrl + '/' + sanitizeDomain(this.config.appDomain));
            url.searchParams.set('appName', this.config.appName);
            url.searchParams.set('appDomain', this.config.appDomain);
            url.searchParams.set('theme', this.config.theme);
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
                this.backdropEl.addEventListener('click', () => this.hide());
            }
            // Add to DOM: backdrop first, then iframe on top
            document.body.appendChild(this.backdropEl);
            document.body.appendChild(this.iframe);
            if (this.config.debug)
                console.log('Iframe created and added to DOM');
        });
    }
    show(page = 'vault', mode = 'full') {
        if (!this.iframe) {
            console.warn('Cannot show iframe - not created yet');
            this.createIframe().then(() => this.show(page, mode));
            return;
        }
        // Remove hidden class to show iframe
        this.iframe.classList.remove('nostrpass-iframe-hidden');
        // Apply the appropriate visibility mode
        if (mode === 'minimal') {
            this.iframe.classList.remove('nostrpass-iframe-visible');
            this.iframe.classList.add('nostrpass-iframe-minimal');
        }
        else {
            this.iframe.classList.remove('nostrpass-iframe-minimal');
            this.iframe.classList.add('nostrpass-iframe-visible');
        }
        // Show backdrop
        if (this.backdropEl) {
            this.backdropEl.style.display = 'block';
        }
        // Accessibility
        this.iframe.setAttribute('aria-hidden', 'false');
        this.iframe.removeAttribute('tabindex');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
        // Navigate to appropriate page based on mode using message passing (not iframe reload)
        if (mode === 'minimal' && page === 'vault' && this.messenger) {
            // Tell the vault to navigate to unlock-quick internally
            try {
                this.messenger.send('NAVIGATE_TO_UNLOCK', {});
            }
            catch (err) {
                console.warn('Failed to send navigation message:', err);
            }
        }
        if (this.config.debug)
            console.log('Iframe shown in', mode, 'mode');
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
        this.iframe.classList.remove('nostrpass-iframe-minimal');
        this.iframe.classList.add('nostrpass-iframe-hidden');
        // Hide backdrop
        if (this.backdropEl) {
            this.backdropEl.style.display = 'none';
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
      
      /* Visible state - fullscreen overlay with transparent background */
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
        background: transparent !important;
        background-color: transparent !important;
        z-index: 2147483647 !important; /* Maximum z-index */
        color-scheme: light dark; /* Support both themes */
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

      /* Dimmed backdrop behind iframe - provides the modal overlay effect */
      .nostrpass-backdrop {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        background: rgba(0, 0, 0, 0.5) !important;
        backdrop-filter: blur(2px) !important;
        z-index: 2147483646 !important; /* Just beneath iframe */
        pointer-events: auto !important;
        display: none !important;
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
            const identityIndex = options?.identityIndex ?? 0;
            // Preflight: check if a prompt is needed
            let unlockPromise = null;
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
                    console.log('⏳ Setting up unlock wait promise...');
                    unlockPromise = this.waitForUnlock();
                    this.show('vault', 'minimal');
                }
                else if (needsPrompt && !this.config.parentPinOverlay) {
                    this.show('vault', 'full');
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
            const identityIndex = options?.identityIndex ?? 0;
            // Preflight: prompt for PIN first if needed, so the op can proceed without error
            let unlockPromise = null;
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
                    console.log('⏳ Setting up unlock wait promise...');
                    unlockPromise = this.waitForUnlock();
                    this.show('vault', 'minimal');
                }
                else if (needsPrompt && !this.config.parentPinOverlay) {
                    this.show('vault', 'full');
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
            const identityIndex = options?.identityIndex ?? 0;
            // Preflight: prompt for PIN first if needed so the op can proceed
            let unlockPromise = null;
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
                    console.log('⏳ Setting up unlock wait promise...');
                    unlockPromise = this.waitForUnlock();
                    this.show('vault', 'minimal');
                }
                else if (needsPrompt && !this.config.parentPinOverlay) {
                    this.show('vault', 'full');
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
            const identityIndex = options?.identityIndex ?? 0;
            // Preflight: prompt for PIN first if needed
            let unlockPromise = null;
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
                    console.log('⏳ Setting up unlock wait promise...');
                    unlockPromise = this.waitForUnlock();
                    this.show('vault', 'minimal');
                }
                else if (needsPrompt && !this.config.parentPinOverlay) {
                    this.show('vault', 'full');
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
            const identityIndex = options?.identityIndex ?? 0;
            // Preflight: prompt for PIN first if needed
            let unlockPromise = null;
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
                    console.log('⏳ Setting up unlock wait promise...');
                    unlockPromise = this.waitForUnlock();
                    this.show('vault', 'minimal');
                }
                else if (needsPrompt && !this.config.parentPinOverlay) {
                    this.show('vault', 'full');
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
export { initNostrPass, NostrPassEmbassy };
//# sourceMappingURL=embassy.js.map