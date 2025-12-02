/**
 * NostrPassButton - Production-ready authentication widget
 * Similar to Clerk's user button pattern
 */

export interface NostrPassButtonConfig {
  /** Custom class name for the button container */
  className?: string;
  /** Append button to this element (selector or HTMLElement) */
  appendTo?: HTMLElement | string;
  /** Custom sign-in button text */
  signInText?: string;
  /** Show user's npub in dropdown */
  showNpub?: boolean;
  /** Show "Manage Account" option */
  showManageAccount?: boolean;
  /**
   * Theme for the button and dropdown
   * - 'light': Always light theme (white background, dark text)
   * - 'dark': Always dark theme (dark background, light text)
   * - 'auto': Follow system preference (default)
   */
  theme?: 'light' | 'dark' | 'auto';
  /** Callback when user signs in */
  onSignIn?: (user: UserInfo) => void;
  /** Callback when user signs out */
  onSignOut?: () => void;
  /** Callback on errors */
  onError?: (error: unknown) => void;
}

export interface UserInfo {
  identityIndex: number;
  publicKey: string;
  npub?: string;
  nickname?: string;
  avatar?: string;
  authorized: boolean;
}

export class NostrPassButton {
  private config: NostrPassButtonConfig;
  private container: HTMLDivElement;
  private embassy: any; // NostrPassEmbassy instance
  private currentUser: UserInfo | null = null;
  private theme: 'light' | 'dark' = 'light';
  private isDropdownOpen: boolean = false;
  private outsideClickHandler: ((e: MouseEvent) => void) | null = null;
  private isCheckingAuth: boolean = true; // Track if we're still checking auth status

  constructor(embassy: any, config: NostrPassButtonConfig = {}) {
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

    // Listen for vault data changes to refresh the button
    this.setupEventListeners();

    // Try to restore session on page load
    this.restoreSession().catch(error => {
      console.warn('[NostrPassButton] Failed to restore session on init:', error);
    });
  }

  private setupEventListeners() {
    // Listen for logout events to clear the button
    window.addEventListener('nostrpass:logout', () => {
      console.log('[NostrPassButton] 🚪 Logout event received');
      this.currentUser = null;
      this.clearSession();
      this.render();
    });

    // Listen for vault-data-refresh events to update the button and dropdown
    window.addEventListener('vault-data-refresh', async (event) => {
      console.log('[NostrPassButton] 🔄 Vault data refresh event received:', event);
      if (this.currentUser) {
        console.log('[NostrPassButton] Current user exists, fetching updated identities...');

        // Small delay to ensure vault data has been persisted
        await new Promise(resolve => setTimeout(resolve, 100));

        // Re-fetch the current identity to check authorization status
        try {
          const response = await this.embassy.getAllIdentities();
          console.log('[NostrPassButton] getAllIdentities response:', response);
          const allIdentities = response?.identities || [];
          const activeIdentityIndex = response?.activeIdentityIndex;

          // If no identities returned, user might have logged out - clear session
          if (allIdentities.length === 0) {
            console.log('[NostrPassButton] No identities returned - user logged out');
            this.currentUser = null;
            this.clearSession();
            return;
          }

          console.log('[NostrPassButton] Active identity index from vault:', activeIdentityIndex);
          console.log('[NostrPassButton] Current session identity index:', this.currentUser.identityIndex);

          // Check if the active identity has changed
          if (activeIdentityIndex !== undefined && activeIdentityIndex !== this.currentUser.identityIndex) {
            console.log('[NostrPassButton] 🔄 Active identity changed from', this.currentUser.identityIndex, 'to', activeIdentityIndex);

            // Find the new active identity
            const newActiveIdentity = allIdentities.find((id: any) => id.index === activeIdentityIndex);

            if (newActiveIdentity) {
              console.log('[NostrPassButton] Switching to new active identity:', newActiveIdentity.nickname);

              // Update current user to the new active identity
              this.currentUser = {
                identityIndex: newActiveIdentity.index,
                publicKey: newActiveIdentity.publicKey,
                nickname: newActiveIdentity.nickname,
                authorized: newActiveIdentity.isAuthorized,
                npub: newActiveIdentity.npub
              };

              // Save updated session
              this.saveSession(this.currentUser);

              // Re-render to reflect changes
              console.log('[NostrPassButton] Re-rendering button with new active identity...');
              await this.render();
              console.log('[NostrPassButton] ✅ Button updated to new active identity');
              return;
            }
          }

          // No active identity change - check authorization status of current identity
          const currentIdentity = allIdentities.find((id: any) => id.index === this.currentUser!.identityIndex);

          console.log('[NostrPassButton] Current identity:', currentIdentity);
          console.log('[NostrPassButton] All identities count:', allIdentities.length);

          if (currentIdentity) {
            // Update all identity fields to reflect latest vault data
            const wasAuthorized = this.currentUser.authorized;
            this.currentUser.nickname = currentIdentity.nickname;
            this.currentUser.authorized = currentIdentity.isAuthorized;
            this.currentUser.npub = currentIdentity.npub;

            console.log('[NostrPassButton] Authorization status changed:', {
              before: wasAuthorized,
              after: currentIdentity.isAuthorized
            });

            // Save updated session
            this.saveSession(this.currentUser);

            // Re-render to reflect changes
            console.log('[NostrPassButton] Re-rendering button...');
            await this.render();
            console.log('[NostrPassButton] ✅ Button updated after vault data refresh');
          } else {
            // Identity was disconnected - mark as unauthorized
            console.warn('[NostrPassButton] Current identity not found in authorized list - marking as unauthorized');

            const wasAuthorized = this.currentUser.authorized;
            this.currentUser.authorized = false;

            console.log('[NostrPassButton] Identity disconnected:', {
              before: wasAuthorized,
              after: false
            });

            // Save updated session
            this.saveSession(this.currentUser);

            // Re-render to show unauthorized state
            console.log('[NostrPassButton] Re-rendering button for disconnected state...');
            await this.render();
            console.log('[NostrPassButton] ✅ Button updated - showing unauthorized state');
          }
        } catch (error) {
          console.error('[NostrPassButton] ❌ Failed to refresh identity status:', error);
        }
      } else {
        console.log('[NostrPassButton] No current user - checking if user just logged in...');
        // User might have just logged in - try to restore session
        try {
          const restored = await this.restoreSession();
          if (restored) {
            console.log('[NostrPassButton] ✅ Session restored after login');
          }
        } catch (error) {
          console.error('[NostrPassButton] ❌ Failed to restore session:', error);
        }
      }
    });
  }

  private updateTheme() {
    if (this.config.theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.theme = prefersDark ? 'dark' : 'light';
      
      // Listen for theme changes
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        this.theme = e.matches ? 'dark' : 'light';
        this.container.setAttribute('data-theme', this.theme);
      });
    } else {
      this.theme = this.config.theme || 'light';
    }
    
    this.container.setAttribute('data-theme', this.theme);
  }

  private injectStyles() {
    if (document.getElementById('nostrpass-button-styles')) return;

    const style = document.createElement('style');
    style.id = 'nostrpass-button-styles';
    style.textContent = `
      .nostrpass-button-container {
        position: relative;
        display: inline-block;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      }

      /* Common button base styles */
      .nostrpass-btn-base {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px 6px 6px;
        border: 1.5px solid #e5e7eb;
        border-radius: 24px;
        cursor: pointer;
        transition: all 0.15s ease;
        background: #fff;
        width: 200px;
      }

      .nostrpass-btn-base:hover {
        border-color: #d1d5db;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      }

      [data-theme="dark"] .nostrpass-btn-base {
        background: #1f2937;
        border-color: #374151;
      }

      [data-theme="dark"] .nostrpass-btn-base:hover {
        border-color: #4b5563;
      }

      /* Sign In Button */
      .nostrpass-signin-btn {
        font-size: 14px;
        font-weight: 500;
      }

      .nostrpass-signin-btn:active {
        transform: scale(0.98);
      }

      .nostrpass-signin-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }

      [data-theme="dark"] .nostrpass-signin-btn {
        color: #f9fafb;
      }

      .nostrpass-signin-logo {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        flex-shrink: 0;
        background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
        border: 1px solid #d1d5db;
      }

      [data-theme="dark"] .nostrpass-signin-logo {
        background: linear-gradient(135deg, #374151 0%, #4b5563 100%);
        border-color: #6b7280;
      }

      /* Loading/Skeleton state - just a faint outline */
      .nostrpass-loading-skeleton {
        display: inline-block;
        width: 120px;
        height: 44px;
        border: 1.5px solid #e5e7eb;
        border-radius: 24px;
        background: transparent;
        opacity: 0.3;
      }

      [data-theme="dark"] .nostrpass-loading-skeleton {
        border-color: #374151;
      }

      /* User Avatar Button */
      .nostrpass-user-btn {
        position: relative;
      }

      .nostrpass-user-btn.active {
        border-color: #9ca3af;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
      }

      [data-theme="dark"] .nostrpass-user-btn.active {
        border-color: #6b7280;
      }

      /* Warning state for unauthorized */
      .nostrpass-user-btn-warning {
        border-color: #fbbf24 !important;
        background: #fffbeb !important;
      }

      [data-theme="dark"] .nostrpass-user-btn-warning {
        border-color: #f59e0b !important;
        background: #451a03 !important;
      }

      .nostrpass-user-btn-warning .nostrpass-user-btn-text {
        color: #d97706 !important;
      }

      [data-theme="dark"] .nostrpass-user-btn-warning .nostrpass-user-btn-text {
        color: #fbbf24 !important;
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

      .nostrpass-chevron {
        margin-left: 4px;
        transition: transform 0.2s ease;
      }

      .nostrpass-user-menu {
        position: relative;
        display: inline-block;
      }

      /* Dropdown Menu - Clerk style */
      .nostrpass-dropdown {
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        min-width: 320px;
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05);
        opacity: 0;
        visibility: hidden;
        transform: translateY(-8px);
        transition: all 0.2s ease;
        z-index: 1000;
        overflow: hidden;
      }

      .nostrpass-dropdown.open {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
      }

      [data-theme="dark"] .nostrpass-dropdown {
        background: #1f2937;
        border-color: #374151;
      }

      .nostrpass-dropdown-section {
        padding: 8px;
      }

      .nostrpass-dropdown-section.nostrpass-dropdown-header {
        background: #f9fafb;
        border-bottom: 1px solid #e5e7eb;
      }

      [data-theme="dark"] .nostrpass-dropdown-section.nostrpass-dropdown-header {
        background: #111827;
        border-bottom-color: #374151;
      }

      .nostrpass-dropdown-divider {
        height: 1px;
        background: #e5e7eb;
        margin: 0 8px;
      }

      [data-theme="dark"] .nostrpass-dropdown-divider {
        background: #374151;
      }

      .nostrpass-dropdown-user-info {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px;
        border-radius: 8px;
      }

      .nostrpass-dropdown-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        object-fit: cover;
        flex-shrink: 0;
      }

      .nostrpass-dropdown-initials {
        width: 40px;
        height: 40px;
        background: #000;
        color: #fff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 600;
        text-transform: uppercase;
        flex-shrink: 0;
      }

      [data-theme="dark"] .nostrpass-dropdown-initials {
        background: #fff;
        color: #000;
      }

      .nostrpass-dropdown-user-details {
        flex: 1;
        min-width: 0;
      }

      .nostrpass-dropdown-name {
        font-size: 14px;
        font-weight: 600;
        color: #111827;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      [data-theme="dark"] .nostrpass-dropdown-name {
        color: #f9fafb;
      }

      .nostrpass-dropdown-npub {
        font-size: 12px;
        color: #6b7280;
        font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', monospace;
        margin-top: 2px;
      }

      [data-theme="dark"] .nostrpass-dropdown-npub {
        color: #9ca3af;
      }

      .nostrpass-dropdown-item {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        border: none;
        background: transparent;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        color: #374151;
        text-align: left;
        transition: all 0.15s ease;
      }

      .nostrpass-dropdown-item:hover {
        background: #f3f4f6;
      }

      [data-theme="dark"] .nostrpass-dropdown-item {
        color: #d1d5db;
      }

      [data-theme="dark"] .nostrpass-dropdown-item:hover {
        background: #374151;
      }

      .nostrpass-dropdown-item svg {
        flex-shrink: 0;
        color: #6b7280;
      }

      [data-theme="dark"] .nostrpass-dropdown-item svg {
        color: #9ca3af;
      }

      /* Identity switcher styles */
      .nostrpass-identity-list {
        max-height: calc(3 * 56px); /* 3 items visible */
        overflow-y: auto;
      }

      .nostrpass-identity-search {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        font-size: 13px;
        margin-bottom: 8px;
        outline: none;
        background: #fff;
        color: #111827;
      }

      .nostrpass-identity-search:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
      }

      [data-theme="dark"] .nostrpass-identity-search {
        background: #374151;
        border-color: #4b5563;
        color: #f9fafb;
      }

      [data-theme="dark"] .nostrpass-identity-search:focus {
        border-color: #60a5fa;
      }

      .nostrpass-identity-item {
        cursor: pointer;
      }

      .nostrpass-identity-active {
        opacity: 0.7;
        cursor: default;
      }

      .nostrpass-identity-avatar {
        width: 32px;
        height: 32px;
        font-size: 12px;
        background: #000;
        color: #fff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        flex-shrink: 0;
      }

      [data-theme="dark"] .nostrpass-identity-avatar {
        background: #fff;
        color: #000;
      }

      .nostrpass-identity-info {
        flex: 1;
        min-width: 0;
      }

      .nostrpass-identity-name {
        font-weight: 500;
        font-size: 14px;
        color: #111827;
      }

      [data-theme="dark"] .nostrpass-identity-name {
        color: #f9fafb;
      }

      .nostrpass-identity-npub {
        font-size: 11px;
        color: #6b7280;
        font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', monospace;
        margin-top: 2px;
      }

      [data-theme="dark"] .nostrpass-identity-npub {
        color: #9ca3af;
      }

      .nostrpass-identity-check {
        flex-shrink: 0;
      }

      .nostrpass-identity-badge {
        font-size: 10px;
        color: #f59e0b;
        background: #fef3c7;
        padding: 2px 6px;
        border-radius: 4px;
        white-space: nowrap;
      }

      [data-theme="dark"] .nostrpass-identity-badge {
        color: #fbbf24;
        background: #78350f;
      }

      /* Username in user info */
      .nostrpass-dropdown-username {
        font-size: 13px;
        color: #6b7280;
        margin-top: 2px;
      }

      [data-theme="dark"] .nostrpass-dropdown-username {
        color: #9ca3af;
      }

      /* Footer with logo */
      .nostrpass-dropdown-footer {
        padding: 12px 16px;
        border-top: 1px solid #e5e7eb;
        background: #f9fafb;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }

      [data-theme="dark"] .nostrpass-dropdown-footer {
        background: #111827;
        border-top-color: #374151;
      }

      .nostrpass-footer-text {
        font-size: 12px;
        color: #6b7280;
      }

      [data-theme="dark"] .nostrpass-footer-text {
        color: #9ca3af;
      }

      .nostrpass-footer-logo {
        font-size: 12px;
        font-weight: 600;
        color: #111827;
        text-decoration: none;
        transition: color 0.15s ease;
      }

      [data-theme="dark"] .nostrpass-footer-logo {
        color: #f9fafb;
      }

      .nostrpass-footer-logo:hover {
        color: #6366f1;
      }

      [data-theme="dark"] .nostrpass-footer-logo:hover {
        color: #818cf8;
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

  private async render() {
    if (this.isCheckingAuth) {
      this.renderLoadingButton();
    } else if (this.currentUser) {
      await this.renderUserButton();
    } else {
      this.renderSignInButton();
    }
  }

  private renderLoadingButton() {
    this.container.innerHTML = `
      <div class="nostrpass-loading-skeleton"></div>
    `;
  }

  private renderSignInButton() {
    this.container.innerHTML = `
      <button class="nostrpass-btn-base nostrpass-signin-btn" data-action="signin">
        <div class="nostrpass-signin-logo">🥚</div>
        <span>NostrPass</span>
      </button>
    `;

    const btn = this.container.querySelector('[data-action="signin"]') as HTMLButtonElement;
    btn.addEventListener('click', () => this.handleSignIn());
  }

  private async renderUserButton() {
    const user = this.currentUser!;
    const initials = this.getUserInitials(user);
    const rawDisplayName = user.nickname || `Identity ${user.identityIndex + 1}`;
    // Capitalize first letter
    const displayName = rawDisplayName.charAt(0).toUpperCase() + rawDisplayName.slice(1);

    // Fetch username and all identities
    let username = '';
    let allIdentities: any[] = [];
    try {
      const authStatus = await this.embassy.getAuthStatus();
      username = authStatus?.username || '';
    } catch (error) {
      console.warn('Failed to fetch auth status:', error);
    }

    try {
      const response = await this.embassy.getAllIdentities();
      allIdentities = response?.identities || [];
    } catch (error) {
      console.warn('Failed to fetch all identities:', error);
    }

    // Filter to only show authorized identities for this app
    const authorizedIdentities = allIdentities.filter((id: any) => id.isAuthorized);

    // Check if current user is authorized
    const hasAuthorizedIdentity = user.authorized || authorizedIdentities.length > 0;

    // Build identities list HTML (only show authorized identities)
    let identitiesHTML = '';
    if (authorizedIdentities.length > 1) {
      const showSearch = authorizedIdentities.length > 4;
      identitiesHTML = `
        <div class="nostrpass-dropdown-divider"></div>
        <div class="nostrpass-dropdown-section">
          <div style="padding: 8px 12px; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase;">
            Switch Identity
          </div>
          ${showSearch ? '<input type="text" class="nostrpass-identity-search" placeholder="Search identities..." data-search-identities />' : ''}
          <div class="nostrpass-identity-list" data-identity-container>
            ${authorizedIdentities.map((identity: any) => {
              const isCurrentIdentity = identity.index === user.identityIndex;
              const idInitials = identity.nickname ? this.getInitialsFromName(identity.nickname) : `I${identity.index + 1}`;
              const rawIdName = identity.nickname || `Identity ${identity.index + 1}`;
              const idName = rawIdName.charAt(0).toUpperCase() + rawIdName.slice(1);
              return `
                <button class="nostrpass-dropdown-item nostrpass-identity-item ${isCurrentIdentity ? 'nostrpass-identity-active' : ''}" data-action="switch-identity" data-identity-index="${identity.index}" data-identity-name="${idName.toLowerCase()}" data-identity-npub="${identity.npub || ''}">
                  <div class="nostrpass-identity-avatar">
                    ${idInitials}
                  </div>
                  <div class="nostrpass-identity-info">
                    <div class="nostrpass-identity-name">
                      ${idName}
                    </div>
                    ${identity.npub ? `<div class="nostrpass-identity-npub">${identity.npub.slice(0, 12)}...</div>` : ''}
                  </div>
                  ${isCurrentIdentity ? `<svg class="nostrpass-identity-check" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13.333 4L6 11.333 2.667 8" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>` : ''}
                </button>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    this.container.innerHTML = `
      <div class="nostrpass-user-menu">
        <button class="nostrpass-btn-base nostrpass-user-btn ${!hasAuthorizedIdentity ? 'nostrpass-user-btn-warning' : ''}" data-action="toggle-menu">
          ${user.avatar
            ? `<img src="${user.avatar}" alt="${displayName}" class="nostrpass-user-avatar" />`
            : `<div class="nostrpass-user-initials">${initials}</div>`
          }
          <span class="nostrpass-user-btn-text">${hasAuthorizedIdentity ? displayName : 'Not authorized'}</span>
        </button>
        <div class="nostrpass-dropdown" data-dropdown>
          ${!hasAuthorizedIdentity ? `
          <div class="nostrpass-dropdown-section" style="padding: 16px; background: #fef3c7; border-bottom: 1px solid #fde68a;">
            <div style="display: flex; gap: 12px; align-items: start;">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style="flex-shrink: 0; margin-top: 2px;">
                <path d="M10 6v4m0 4h.01M19 10a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#d97706" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <div>
                <div style="font-weight: 600; color: #92400e; font-size: 13px; margin-bottom: 4px;">No authorized identity</div>
                <div style="color: #78350f; font-size: 12px; line-height: 1.5;">Please choose an identity and approve access to this app from your account settings.</div>
              </div>
            </div>
          </div>
          ` : ''}
          <div class="nostrpass-dropdown-section nostrpass-dropdown-header">
            <div class="nostrpass-dropdown-user-info">
              ${user.avatar
                ? `<img src="${user.avatar}" alt="${displayName}" class="nostrpass-dropdown-avatar" />`
                : `<div class="nostrpass-dropdown-initials">${initials}</div>`
              }
              <div class="nostrpass-dropdown-user-details">
                <div class="nostrpass-dropdown-name">${displayName}</div>
                ${username ? `<div class="nostrpass-dropdown-username">${username}</div>` : user.npub ? `<div class="nostrpass-dropdown-npub">${user.npub.slice(0, 16)}...</div>` : ''}
              </div>
            </div>
          </div>
          ${identitiesHTML}
          <div class="nostrpass-dropdown-divider"></div>
          <div class="nostrpass-dropdown-section">
            <button class="nostrpass-dropdown-item" data-action="manage-account">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 10a2 2 0 100-4 2 2 0 000 4z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M12.933 10.267a1.333 1.333 0 00.267 1.466l.048.049a1.618 1.618 0 11-2.29 2.289l-.048-.048a1.333 1.333 0 00-1.467-.267 1.333 1.333 0 00-.81 1.22v.137a1.619 1.619 0 01-3.237 0v-.073A1.333 1.333 0 004.133 13.6a1.333 1.333 0 00-1.466.267l-.049.048a1.618 1.618 0 11-2.289-2.29l.048-.048a1.333 1.333 0 00.267-1.467 1.333 1.333 0 00-1.22-.81h-.137a1.619 1.619 0 010-3.237h.073A1.333 1.333 0 00.6 4.8a1.333 1.333 0 00-.267-1.466l-.048-.049a1.618 1.618 0 112.29-2.289l.048.048a1.333 1.333 0 001.467.267h.064a1.333 1.333 0 00.81-1.22v-.137a1.619 1.619 0 013.237 0v.073a1.333 1.333 0 00.81 1.22 1.333 1.333 0 001.466-.267l.049-.048a1.618 1.618 0 112.289 2.29l-.048.048a1.333 1.333 0 00-.267 1.467v.064a1.333 1.333 0 001.22.81h.137a1.619 1.619 0 010 3.237h-.073a1.333 1.333 0 00-1.22.81z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span>Manage account</span>
            </button>
            <button class="nostrpass-dropdown-item" data-action="sign-out">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 14H3.333A1.333 1.333 0 012 12.667V3.333A1.333 1.333 0 013.333 2H6M10.667 11.333L14 8m0 0l-3.333-3.333M14 8H6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span>Sign out</span>
            </button>
          </div>
          <div class="nostrpass-dropdown-footer">
            <span class="nostrpass-footer-text">Secured by</span>
            <a href="https://nostrpass.com" target="_blank" class="nostrpass-footer-logo">NostrPass</a>
          </div>
        </div>
      </div>
    `;

    // Attach event listeners
    const userBtn = this.container.querySelector('[data-action="toggle-menu"]') as HTMLButtonElement;
    userBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // If not authorized, open account picker/permission flow instead of dropdown
      if (!hasAuthorizedIdentity) {
        this.handleNotAuthorizedClick();
      } else {
        this.toggleDropdown();
      }
    });

    // Identity search input
    const searchInput = this.container.querySelector('[data-search-identities]') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = (e.target as HTMLInputElement).value.toLowerCase();
        const identityBtns = this.container.querySelectorAll('[data-action="switch-identity"]');
        identityBtns.forEach(btn => {
          const name = (btn as HTMLElement).getAttribute('data-identity-name') || '';
          const npub = (btn as HTMLElement).getAttribute('data-identity-npub') || '';
          const matches = name.includes(query) || npub.toLowerCase().includes(query);
          (btn as HTMLElement).style.display = matches ? '' : 'none';
        });
      });
    }

    // Switch identity buttons
    const switchBtns = this.container.querySelectorAll('[data-action="switch-identity"]');
    switchBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const identityIndex = parseInt((e.currentTarget as HTMLElement).getAttribute('data-identity-index') || '0');
        const isCurrentIdentity = identityIndex === user.identityIndex;
        if (!isCurrentIdentity) {
          this.handleSwitchIdentity(identityIndex);
        }
      });
    });

    const manageBtn = this.container.querySelector('[data-action="manage-account"]') as HTMLButtonElement;
    manageBtn?.addEventListener('click', () => {
      this.closeDropdown();
      this.handleManageAccount();
    });

    const signOutBtn = this.container.querySelector('[data-action="sign-out"]') as HTMLButtonElement;
    signOutBtn?.addEventListener('click', () => {
      this.closeDropdown();
      this.handleSignOut();
    });
  }

  private getInitialsFromName(name: string): string {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`;
    }
    return name.slice(0, 2);
  }

  private async handleSwitchIdentity(identityIndex: number) {
    this.closeDropdown();

    try {
      // Switch identity directly without opening the vault
      const result = await this.embassy.switchIdentity(identityIndex);

      // Update current user if successful
      if (result?.success && result?.identity) {
        this.currentUser = {
          identityIndex: result.identityIndex,
          publicKey: result.identity.publicKey,
          npub: result.identity.npub,
          nickname: result.identity.nickname,
          authorized: result.identity.authorized || false
        };
        this.saveSession(this.currentUser);
        await this.render();
      }
    } catch (error: any) {
      console.error('Failed to switch identity:', error);

      // If identity is not authorized, open the vault to authorize it
      if (error?.message?.includes('not authorized')) {
        try {
          const result = await this.embassy.manageAccount({
            forcePrompt: true,
            buttonElement: this.container.querySelector('[data-action="toggle-menu"]') as HTMLButtonElement
          });

          if (result?.identity) {
            this.currentUser = {
              identityIndex: result.identityIndex,
              publicKey: result.identity.publicKey,
              npub: result.identity.npub,
              nickname: result.identity.nickname,
              authorized: result.identity.authorized || false
            };
            this.saveSession(this.currentUser);
            await this.render();
          }
        } catch (manageError) {
          console.error('Failed to authorize identity:', manageError);
          this.config.onError?.(manageError);
        }
      } else {
        this.config.onError?.(error);
      }
    }
  }

  private getUserInitials(user: UserInfo): string {
    if (user.nickname) {
      const parts = user.nickname.split(' ');
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`;
      }
      return user.nickname.slice(0, 2);
    }
    return `I${user.identityIndex + 1}`;
  }

  private async handleSignIn() {
    const btn = this.container.querySelector('[data-action="signin"]') as HTMLButtonElement;
    if (!btn) return;

    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="nostrpass-loading"></span> <span>Signing in...</span>`;

    try {
      // Open login page in compact mode positioned near the button
      this.embassy.openPage('login', { buttonElement: btn });

      // Wait for authentication
      const result = await this.embassy.manageAccount({
        forcePrompt: true,
        buttonElement: btn
      });

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
    } catch (error) {
      console.error('NostrPass sign in failed:', error);

      // If vault is locked, keep the modal open and wait for unlock
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.toLowerCase().includes('locked') || errorMsg.toLowerCase().includes('unlock')) {
        console.log('[NostrPassButton] Vault locked - waiting for unlock...');

        // Listen for vault unlock and update button
        const unlockListener = async () => {
          console.log('[NostrPassButton] Vault unlocked, checking auth status...');
          try {
            // Just check auth status - don't open modal again
            const authStatus = await this.embassy.getAuthStatus();

            if (authStatus?.isAuthenticated && authStatus?.user) {
              this.currentUser = {
                identityIndex: authStatus.user.identityIndex || 0,
                publicKey: authStatus.user.publicKey || '',
                npub: authStatus.user.npub,
                nickname: authStatus.user.nickname,
                authorized: authStatus.user.authorized || false
              };

              this.saveSession(this.currentUser);
              this.render();
              this.config.onSignIn?.(this.currentUser);
            }

            // Remove listener after success
            window.removeEventListener('nostrpass:unlocked', unlockListener);
          } catch (retryError) {
            console.error('[NostrPassButton] Failed to get auth status after unlock:', retryError);
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

  private async toggleDropdown() {
    // First check if vault needs to be unlocked
    try {
      const authStatus = await this.embassy.getAuthStatus();

      // If vault is locked, show PIN unlock first
      if (authStatus?.isLocked) {
        console.log('[NostrPassButton] Vault locked, showing unlock page...');
        const btn = this.container.querySelector('[data-action="toggle-menu"]') as HTMLButtonElement;

        // Open unlock page in compact mode
        this.embassy.openPage('unlock', { buttonElement: btn });

        // Listen for unlock event
        const unlockListener = () => {
          console.log('[NostrPassButton] Vault unlocked, hiding modal and showing dropdown...');
          window.removeEventListener('nostrpass:unlocked', unlockListener);

          // Hide the vault modal
          this.embassy.hide();

          // Show dropdown after a short delay
          setTimeout(() => {
            this.openDropdown();
          }, 100);
        };

        window.addEventListener('nostrpass:unlocked', unlockListener);
        return;
      }
    } catch (error) {
      console.error('[NostrPassButton] Failed to check vault status:', error);
    }

    // Vault is unlocked, toggle dropdown normally
    const dropdown = this.container.querySelector('[data-dropdown]') as HTMLElement;
    if (!dropdown) return;

    if (this.isDropdownOpen) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }

  private openDropdown() {
    const dropdown = this.container.querySelector('[data-dropdown]') as HTMLElement;
    if (!dropdown) return;

    this.isDropdownOpen = true;
    dropdown.classList.add('open');

    // Add click outside listener
    setTimeout(() => {
      this.outsideClickHandler = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!this.container.contains(target)) {
          this.closeDropdown();
        }
      };
      document.addEventListener('click', this.outsideClickHandler);
    }, 0);
  }

  private closeDropdown() {
    const dropdown = this.container.querySelector('[data-dropdown]') as HTMLElement;
    if (!dropdown) return;

    this.isDropdownOpen = false;
    dropdown.classList.remove('open');
    this.removeOutsideClickListener();
  }

  private removeOutsideClickListener() {
    if (this.outsideClickHandler) {
      document.removeEventListener('click', this.outsideClickHandler);
      this.outsideClickHandler = null;
    }
  }

  private async handleNotAuthorizedClick() {
    try {
      const btn = this.container.querySelector('[data-action="toggle-menu"]') as HTMLButtonElement;

      // Get app info for account picker
      const appOrigin = window.location.origin;
      const appName = document.title;
      const requestId = `account-picker-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      // Set up listeners for account picker response
      const handleSelected = async (e: Event) => {
        const ce = e as CustomEvent;
        if (ce.detail.requestId === requestId) {
          cleanup();
          this.embassy.hide();

          // Refresh button state after selection
          try {
            const response = await this.embassy.getAllIdentities();
            const allIdentities = response?.identities || [];
            const selectedIdentity = allIdentities.find((id: any) => id.index === ce.detail.identityIndex);

            if (selectedIdentity) {
              this.currentUser = {
                identityIndex: selectedIdentity.index,
                publicKey: selectedIdentity.publicKey,
                npub: selectedIdentity.npub,
                nickname: selectedIdentity.nickname,
                authorized: selectedIdentity.isAuthorized || false
              };
              this.saveSession(this.currentUser);
              await this.render();
            }
          } catch (error) {
            console.error('Failed to update button after account selection:', error);
          }
        }
      };

      const handleRejected = (e: Event) => {
        const ce = e as CustomEvent;
        if (ce.detail.requestId === requestId) {
          cleanup();
          this.embassy.hide();
        }
      };

      const cleanup = () => {
        window.removeEventListener('account-picker-selected', handleSelected as EventListener);
        window.removeEventListener('account-picker-rejected', handleRejected as EventListener);
      };

      window.addEventListener('account-picker-selected', handleSelected as EventListener);
      window.addEventListener('account-picker-rejected', handleRejected as EventListener);

      // Check if vault is locked
      const authStatus = await this.embassy.getAuthStatus();

      // Prepare permissions to pass to vault
      const permissions = this.embassy.config.permissions ? JSON.stringify(this.embassy.config.permissions) : undefined;

      if (authStatus?.isLocked) {
        console.log('[NostrPassButton] Vault locked, using smart unlock with account-picker continuation...');

        // Use smart QuickUnlock with continuation to account picker
        const queryParams: Record<string, string> = {
          next: 'account-picker',
          appOrigin,
          appName,
          requestId
        };
        if (permissions) queryParams.permissions = permissions;

        this.embassy.openPage('unlock', {
          size: 'compact',
          buttonElement: btn,
          queryParams
        });
      } else {
        // Vault is unlocked, show account picker directly
        console.log('[NostrPassButton] Vault unlocked, showing account picker...');
        const queryParams: Record<string, string> = {
          appOrigin,
          appName,
          requestId
        };
        if (permissions) queryParams.permissions = permissions;

        this.embassy.openPage('account', {
          // Use default 'tall' size from VAULT_PAGES config
          buttonElement: btn,
          queryParams
        });
      }
    } catch (error) {
      console.error('Failed to authorize identity:', error);
      this.config.onError?.(error);
    }
  }

  private async handleManageAccount() {
    try {
      // Open the vault dashboard - user is already logged in
      this.embassy.openPage('dashboard');
    } catch (error) {
      console.error('Failed to open vault:', error);
      this.config.onError?.(error);
    }
  }

  private async handleSignOut() {
    try {
      // Call embassy logout to clear vault session
      console.log('[NostrPassButton] Calling embassy.logout()');
      await this.embassy.logout();
      console.log('[NostrPassButton] Embassy logout successful');
    } catch (error) {
      console.error('[NostrPassButton] Embassy logout failed:', error);
    }

    // Clear local session
    this.currentUser = null;
    this.clearSession();
    this.render();
    this.config.onSignOut?.();
  }

  private saveSession(user: UserInfo) {
    try {
      localStorage.setItem('nostrpass_session', JSON.stringify(user));
    } catch (e) {
      console.warn('Failed to save NostrPass session:', e);
    }
  }

  public clearSession() {
    try {
      localStorage.removeItem('nostrpass_session');
      this.currentUser = null;
      this.isCheckingAuth = false; // Reset checking auth state
      this.render();
    } catch (e) {
      console.warn('Failed to clear NostrPass session:', e);
    }
  }

  public async restoreSession(): Promise<boolean> {
    console.log('[NostrPassButton] restoreSession called');
    this.isCheckingAuth = true;
    this.render(); // Show loading state

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
          this.isCheckingAuth = false;
          this.saveSession(this.currentUser);
          this.render();
          return true;
        } else {
          // User is not authenticated - clear any stale session
          console.log('[NostrPassButton] Not authenticated - clearing stale session');
          this.isCheckingAuth = false;
          this.clearSession();
          return false;
        }
      } catch (authError) {
        console.log('[NostrPassButton] Could not get auth status:', authError);
        // If we can't get auth status, clear session to be safe
        this.isCheckingAuth = false;
        this.clearSession();
        return false;
      }
    } catch (e) {
      console.warn('[NostrPassButton] Failed to restore NostrPass session:', e);
      this.isCheckingAuth = false;
      this.render();
      return false;
    }
  }

  public getUser(): UserInfo | null {
    return this.currentUser;
  }

  public getElement(): HTMLDivElement {
    return this.container;
  }

  public destroy() {
    this.container.remove();
  }
}

