/**
 * NostrPassButton - Production-ready authentication widget
 * Similar to Clerk's user button pattern
 */
export class NostrPassButton {
    constructor(embassy, config = {}) {
        this.currentUser = null;
        this.dropdownVisible = false;
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
        // Close dropdown on outside click
        document.addEventListener('click', (e) => {
            if (this.dropdownVisible && !this.container.contains(e.target)) {
                this.closeDropdown();
            }
        });
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

      /* Sign In Button */
      .nostrpass-signin-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 16px;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%);
        color: white;
        box-shadow: 0 2px 8px rgba(139, 92, 246, 0.3);
      }

      .nostrpass-signin-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
      }

      .nostrpass-signin-btn:active {
        transform: translateY(0);
      }

      .nostrpass-signin-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
      }

      /* User Avatar Button */
      .nostrpass-user-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border: 2px solid transparent;
        border-radius: 50%;
        cursor: pointer;
        transition: all 0.2s ease;
        background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%);
        position: relative;
        overflow: hidden;
      }

      .nostrpass-user-btn:hover {
        transform: scale(1.05);
        box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
      }

      .nostrpass-user-btn.active {
        border-color: #8B5CF6;
        box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.2);
      }

      .nostrpass-user-avatar {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 50%;
      }

      .nostrpass-user-initials {
        color: white;
        font-size: 16px;
        font-weight: 600;
        text-transform: uppercase;
      }

      /* Dropdown Menu */
      .nostrpass-dropdown {
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        min-width: 280px;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
        opacity: 0;
        transform: translateY(-10px);
        pointer-events: none;
        transition: all 0.2s ease;
        z-index: 10000;
        overflow: hidden;
      }

      .nostrpass-dropdown.visible {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
      }

      [data-theme="light"] .nostrpass-dropdown {
        background: white;
        border: 1px solid #e5e7eb;
      }

      [data-theme="dark"] .nostrpass-dropdown {
        background: #1f2937;
        border: 1px solid #374151;
      }

      /* Dropdown Header */
      .nostrpass-dropdown-header {
        padding: 16px;
        border-bottom: 1px solid;
      }

      [data-theme="light"] .nostrpass-dropdown-header {
        border-color: #e5e7eb;
        background: #f9fafb;
      }

      [data-theme="dark"] .nostrpass-dropdown-header {
        border-color: #374151;
        background: #111827;
      }

      .nostrpass-user-info {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .nostrpass-user-avatar-large {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }

      .nostrpass-user-avatar-large img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .nostrpass-user-avatar-large .nostrpass-user-initials {
        font-size: 18px;
      }

      .nostrpass-user-details {
        flex: 1;
        min-width: 0;
      }

      .nostrpass-user-name {
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 2px;
      }

      [data-theme="light"] .nostrpass-user-name {
        color: #111827;
      }

      [data-theme="dark"] .nostrpass-user-name {
        color: #f9fafb;
      }

      .nostrpass-user-npub {
        font-size: 12px;
        font-family: monospace;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      [data-theme="light"] .nostrpass-user-npub {
        color: #6b7280;
      }

      [data-theme="dark"] .nostrpass-user-npub {
        color: #9ca3af;
      }

      /* Dropdown Menu Items */
      .nostrpass-dropdown-menu {
        padding: 8px;
      }

      .nostrpass-menu-item {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        padding: 10px 12px;
        border: none;
        background: none;
        border-radius: 6px;
        font-size: 14px;
        cursor: pointer;
        transition: background-color 0.15s ease;
        text-align: left;
      }

      [data-theme="light"] .nostrpass-menu-item {
        color: #374151;
      }

      [data-theme="dark"] .nostrpass-menu-item {
        color: #d1d5db;
      }

      [data-theme="light"] .nostrpass-menu-item:hover {
        background: #f3f4f6;
      }

      [data-theme="dark"] .nostrpass-menu-item:hover {
        background: #374151;
      }

      .nostrpass-menu-item-icon {
        font-size: 18px;
        width: 20px;
        text-align: center;
      }

      .nostrpass-menu-item-danger {
        color: #ef4444;
      }

      [data-theme="dark"] .nostrpass-menu-item-danger {
        color: #f87171;
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
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
          <polyline points="10 17 15 12 10 7"></polyline>
          <line x1="15" y1="12" x2="3" y2="12"></line>
        </svg>
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
        const shortNpub = user.npub ? `${user.npub.slice(0, 12)}...${user.npub.slice(-6)}` : '';
        this.container.innerHTML = `
      <button class="nostrpass-user-btn ${this.dropdownVisible ? 'active' : ''}" data-action="toggle-dropdown">
        ${user.avatar
            ? `<img src="${user.avatar}" alt="${displayName}" class="nostrpass-user-avatar" />`
            : `<span class="nostrpass-user-initials">${initials}</span>`}
      </button>
      <div class="nostrpass-dropdown ${this.dropdownVisible ? 'visible' : ''}">
        <div class="nostrpass-dropdown-header">
          <div class="nostrpass-user-info">
            <div class="nostrpass-user-avatar-large">
              ${user.avatar
            ? `<img src="${user.avatar}" alt="${displayName}" />`
            : `<span class="nostrpass-user-initials">${initials}</span>`}
            </div>
            <div class="nostrpass-user-details">
              <div class="nostrpass-user-name">${displayName}</div>
              ${this.config.showNpub && user.npub
            ? `<div class="nostrpass-user-npub">${shortNpub}</div>`
            : ''}
            </div>
          </div>
        </div>
        <div class="nostrpass-dropdown-menu">
          ${this.config.showManageAccount
            ? `<button class="nostrpass-menu-item" data-action="manage">
                <span class="nostrpass-menu-item-icon">⚙️</span>
                <span>Manage Account</span>
              </button>`
            : ''}
          <button class="nostrpass-menu-item nostrpass-menu-item-danger" data-action="signout">
            <span class="nostrpass-menu-item-icon">🚪</span>
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    `;
        // Attach event listeners
        const toggleBtn = this.container.querySelector('[data-action="toggle-dropdown"]');
        toggleBtn.addEventListener('click', () => this.toggleDropdown());
        const manageBtn = this.container.querySelector('[data-action="manage"]');
        if (manageBtn) {
            manageBtn.addEventListener('click', () => this.handleManageAccount());
        }
        const signoutBtn = this.container.querySelector('[data-action="signout"]');
        signoutBtn.addEventListener('click', () => this.handleSignOut());
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
            btn.disabled = false;
            btn.innerHTML = originalText;
            this.config.onError?.(error);
        }
    }
    async handleManageAccount() {
        this.closeDropdown();
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
    handleSignOut() {
        this.closeDropdown();
        this.currentUser = null;
        this.clearSession();
        this.render();
        this.config.onSignOut?.();
    }
    toggleDropdown() {
        this.dropdownVisible = !this.dropdownVisible;
        this.render();
    }
    closeDropdown() {
        if (this.dropdownVisible) {
            this.dropdownVisible = false;
            this.render();
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
        }
        catch (e) {
            console.warn('Failed to clear NostrPass session:', e);
        }
    }
    async restoreSession() {
        try {
            const sessionData = sessionStorage.getItem('nostrpass_session');
            if (!sessionData)
                return false;
            const user = JSON.parse(sessionData);
            // Verify session is still valid by checking with embassy
            try {
                await this.embassy.getPublicKey({ identityIndex: user.identityIndex });
                this.currentUser = user;
                this.render();
                return true;
            }
            catch {
                // Session invalid, clear it
                this.clearSession();
                return false;
            }
        }
        catch (e) {
            console.warn('Failed to restore NostrPass session:', e);
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