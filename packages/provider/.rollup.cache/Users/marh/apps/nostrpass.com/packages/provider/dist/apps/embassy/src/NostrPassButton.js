/**
 * NostrPassButton - Production-ready authentication widget
 * Similar to Clerk's user button pattern
 */
export class NostrPassButton {
    constructor(embassy, config = {}) {
        this.currentUser = null;
        this.theme = 'light';
        this.embassy = embassy;
        this.config = {
            signInText: 'Sign in with NostrPass',
            showNpub: true,
            showManageAccount: true,
            theme: 'auto',
            ...config
        };
        // Create container
        this.container = document.createElement('div');
        this.container.className = `nostrpass-button-container ${config.className || ''}`;
        // Apply theme
        this.updateTheme();
        // Inject styles
        this.injectStyles();
        // Render initial state
        this.render();
        // Append to DOM if specified
        if (config.appendTo) {
            const target = typeof config.appendTo === 'string'
                ? document.querySelector(config.appendTo)
                : config.appendTo;
            if (target) {
                target.appendChild(this.container);
            }
        }
    }
    updateTheme() {
        if (this.config.theme === 'auto') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.theme = prefersDark ? 'dark' : 'light';
            // Listen for theme changes
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                this.theme = e.matches ? 'dark' : 'light';
                this.container.setAttribute('data-theme', this.theme);
            });
        }
        else {
            this.theme = this.config.theme || 'light';
        }
        this.container.setAttribute('data-theme', this.theme);
    }
    injectStyles() {
        if (document.getElementById('nostrpass-button-styles'))
            return;
        const style = document.createElement('style');
        style.id = 'nostrpass-button-styles';
        style.textContent = `
      .nostrpass-button-container {
        position: relative;
        display: inline-block;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      }

      /* Sign In Button - Clean black/white design */
      .nostrpass-signin-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 12px 24px;
        border: 1.5px solid #000;
        border-radius: 6px;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
        background: #000;
        color: #fff;
        box-shadow: none;
      }

      .nostrpass-signin-btn:hover {
        background: #1a1a1a;
        border-color: #1a1a1a;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }

      .nostrpass-signin-btn:active {
        transform: translateY(0);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }

      .nostrpass-signin-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }

      [data-theme="dark"] .nostrpass-signin-btn {
        background: #fff;
        color: #000;
        border-color: #fff;
      }

      [data-theme="dark"] .nostrpass-signin-btn:hover {
        background: #f0f0f0;
        border-color: #f0f0f0;
      }

      /* User Avatar Button - Compact with username */
      .nostrpass-user-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px 6px 6px;
        border: 1.5px solid #e5e7eb;
        border-radius: 24px;
        cursor: pointer;
        transition: all 0.15s ease;
        background: #fff;
        position: relative;
      }

      .nostrpass-user-btn:hover {
        border-color: #d1d5db;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      }

      .nostrpass-user-btn.active {
        border-color: #9ca3af;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
      }

      [data-theme="dark"] .nostrpass-user-btn {
        background: #1f2937;
        border-color: #374151;
      }

      [data-theme="dark"] .nostrpass-user-btn:hover {
        border-color: #4b5563;
      }

      [data-theme="dark"] .nostrpass-user-btn.active {
        border-color: #6b7280;
      }

      .nostrpass-user-avatar {
        width: 32px;
        height: 32px;
        object-fit: cover;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .nostrpass-user-initials {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        background: #000;
        color: #fff;
        font-size: 13px;
        font-weight: 600;
        text-transform: uppercase;
        border-radius: 50%;
        flex-shrink: 0;
      }

      [data-theme="dark"] .nostrpass-user-initials {
        background: #fff;
        color: #000;
      }

      .nostrpass-user-btn-text {
        font-size: 14px;
        font-weight: 500;
        white-space: nowrap;
      }

      [data-theme="light"] .nostrpass-user-btn-text {
        color: #111827;
      }

      [data-theme="dark"] .nostrpass-user-btn-text {
        color: #f9fafb;
      }


      /* Loading state */
      .nostrpass-loading {
        display: inline-block;
        width: 14px;
        height: 14px;
        border: 2px solid currentColor;
        border-radius: 50%;
        border-top-color: transparent;
        animation: nostrpass-spin 0.6s linear infinite;
      }

      @keyframes nostrpass-spin {
        to { transform: rotate(360deg); }
      }
    `;
        document.head.appendChild(style);
    }
    render() {
        if (this.currentUser) {
            this.renderUserButton();
        }
        else {
            this.renderSignInButton();
        }
    }
    renderSignInButton() {
        this.container.innerHTML = `
      <button class="nostrpass-signin-btn" data-action="signin">
        <span>${this.config.signInText}</span>
      </button>
    `;
        const btn = this.container.querySelector('[data-action="signin"]');
        btn.addEventListener('click', () => this.handleSignIn());
    }
    renderUserButton() {
        const user = this.currentUser;
        const initials = this.getUserInitials(user);
        const displayName = user.nickname || `Identity ${user.identityIndex + 1}`;
        this.container.innerHTML = `
      <button class="nostrpass-user-btn" data-action="open-dashboard">
        ${user.avatar
            ? `<img src="${user.avatar}" alt="${displayName}" class="nostrpass-user-avatar" />`
            : `<div class="nostrpass-user-initials">${initials}</div>`}
        <span class="nostrpass-user-btn-text">${displayName}</span>
      </button>
    `;
        // Attach event listener to open vault dashboard
        const userBtn = this.container.querySelector('[data-action="open-dashboard"]');
        userBtn.addEventListener('click', () => this.handleManageAccount());
    }
    getUserInitials(user) {
        if (user.nickname) {
            const parts = user.nickname.split(' ');
            if (parts.length >= 2) {
                return `${parts[0][0]}${parts[1][0]}`;
            }
            return user.nickname.slice(0, 2);
        }
        return `I${user.identityIndex + 1}`;
    }
    async handleSignIn() {
        const btn = this.container.querySelector('[data-action="signin"]');
        if (!btn)
            return;
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<span class="nostrpass-loading"></span> <span>Signing in...</span>`;
        try {
            const result = await this.embassy.manageAccount({ forcePrompt: true });
            this.currentUser = {
                identityIndex: result.identityIndex,
                publicKey: result.identity?.publicKey || '',
                npub: result.identity?.npub,
                nickname: result.identity?.nickname,
                authorized: result.identity?.authorized || false
            };
            // Store session
            this.saveSession(this.currentUser);
            this.render();
            this.config.onSignIn?.(this.currentUser);
        }
        catch (error) {
            console.error('NostrPass sign in failed:', error);
            // If vault is locked, keep the modal open and wait for unlock
            const errorMsg = error instanceof Error ? error.message : String(error);
            if (errorMsg.toLowerCase().includes('locked') || errorMsg.toLowerCase().includes('unlock')) {
                console.log('[NostrPassButton] Vault locked - waiting for unlock...');
                // Listen for vault unlock and retry
                const unlockListener = async () => {
                    console.log('[NostrPassButton] Vault unlocked, retrying manageAccount...');
                    try {
                        const result = await this.embassy.manageAccount({ forcePrompt: true });
                        this.currentUser = {
                            identityIndex: result.identityIndex,
                            publicKey: result.identity?.publicKey || '',
                            npub: result.identity?.npub,
                            nickname: result.identity?.nickname,
                            authorized: result.identity?.authorized || false
                        };
                        this.saveSession(this.currentUser);
                        this.render();
                        this.config.onSignIn?.(this.currentUser);
                        // Remove listener after success
                        window.removeEventListener('nostrpass:unlocked', unlockListener);
                    }
                    catch (retryError) {
                        console.error('[NostrPassButton] Retry after unlock failed:', retryError);
                        btn.disabled = false;
                        btn.innerHTML = originalText;
                    }
                };
                window.addEventListener('nostrpass:unlocked', unlockListener);
                return;
            }
            btn.disabled = false;
            btn.innerHTML = originalText;
            this.config.onError?.(error);
        }
    }
    async handleManageAccount() {
        try {
            const result = await this.embassy.manageAccount({ forcePrompt: true });
            // Update current user if changed
            this.currentUser = {
                identityIndex: result.identityIndex,
                publicKey: result.identity?.publicKey || '',
                npub: result.identity?.npub,
                nickname: result.identity?.nickname,
                authorized: result.identity?.authorized || false
            };
            this.saveSession(this.currentUser);
            this.render();
        }
        catch (error) {
            console.error('Manage account failed:', error);
            this.config.onError?.(error);
        }
    }
    saveSession(user) {
        try {
            sessionStorage.setItem('nostrpass_session', JSON.stringify(user));
        }
        catch (e) {
            console.warn('Failed to save NostrPass session:', e);
        }
    }
    clearSession() {
        try {
            sessionStorage.removeItem('nostrpass_session');
            this.currentUser = null;
            this.render();
        }
        catch (e) {
            console.warn('Failed to clear NostrPass session:', e);
        }
    }
    async restoreSession() {
        console.log('[NostrPassButton] restoreSession called');
        try {
            // Wait for vault to be ready before checking auth
            console.log('[NostrPassButton] Waiting for vault ready...');
            await this.embassy.waitForReady();
            console.log('[NostrPassButton] Vault is ready');
            // First check if there's a logged-in user in the vault (even if locked)
            try {
                console.log('[NostrPassButton] Checking auth status...');
                const authStatus = await this.embassy.getAuthStatus();
                console.log('[NostrPassButton] Auth status response:', authStatus);
                if (authStatus?.isAuthenticated && authStatus?.user) {
                    // User is logged in (possibly locked)
                    console.log('[NostrPassButton] User is authenticated, showing user button');
                    this.currentUser = {
                        identityIndex: authStatus.user.identityIndex || 0,
                        publicKey: authStatus.user.publicKey || '',
                        npub: authStatus.user.npub,
                        nickname: authStatus.user.nickname,
                        authorized: authStatus.user.authorized || false
                    };
                    this.saveSession(this.currentUser);
                    this.render();
                    return true;
                }
                else {
                    console.log('[NostrPassButton] Not authenticated or no user');
                }
            }
            catch (authError) {
                console.log('[NostrPassButton] Could not get auth status:', authError);
            }
            // Fall back to session storage
            console.log('[NostrPassButton] Checking session storage...');
            const sessionData = sessionStorage.getItem('nostrpass_session');
            if (!sessionData) {
                console.log('[NostrPassButton] No session data found');
                return false;
            }
            console.log('[NostrPassButton] Found session data, parsing...');
            const user = JSON.parse(sessionData);
            console.log('[NostrPassButton] Session user:', user);
            // Verify session is still valid by checking with embassy
            try {
                await this.embassy.getPublicKey({ identityIndex: user.identityIndex });
                console.log('[NostrPassButton] Session valid, showing user button');
                this.currentUser = user;
                this.render();
                return true;
            }
            catch {
                // Session invalid (or vault locked), but keep showing user button
                console.log('[NostrPassButton] Vault locked or session invalid, but showing user button anyway');
                this.currentUser = user;
                this.render();
                return true;
            }
        }
        catch (e) {
            console.warn('[NostrPassButton] Failed to restore NostrPass session:', e);
            return false;
        }
    }
    getUser() {
        return this.currentUser;
    }
    getElement() {
        return this.container;
    }
    destroy() {
        this.container.remove();
    }
}
//# sourceMappingURL=NostrPassButton.js.map