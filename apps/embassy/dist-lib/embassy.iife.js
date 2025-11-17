var NostrPassEmbassy=function(k){"use strict";var q=Object.defineProperty;var F=(k,x,I)=>x in k?q(k,x,{enumerable:!0,configurable:!0,writable:!0,value:I}):k[x]=I;var f=(k,x,I)=>F(k,typeof x!="symbol"?x+"":x,I);class x{constructor(t=!1,e=e){this.isParent=t,this.window=e,this.pendingRequests=new Map,this.messageHandlers=new Map,this.allowedOrigins=new Set,this.isInitialized=!1,this.defaultTimeout=3e4,this.window=e,this.setupMessageListener()}init(t=["*"]){t.forEach(e=>this.allowedOrigins.add(e)),this.isInitialized=!0}on(t,e){this.messageHandlers.set(t,e)}off(t){this.messageHandlers.delete(t)}async request(t,e=null,i=this.defaultTimeout){if(!this.isInitialized)throw new Error("SecureMessenger not initialized. Call init() first.");const n=this.generateId(),a={id:n,type:t,data:e,timestamp:Date.now(),origin:this.window.location.origin};return new Promise((r,s)=>{const o=setTimeout(()=>{this.pendingRequests.delete(n),s(new Error(`Request timeout after ${i}ms`))},i);this.pendingRequests.set(n,{resolve:r,reject:s,timeout:o}),this.sendMessage(a)})}send(t,e=null){if(!this.isInitialized)throw new Error("SecureMessenger not initialized. Call init() first.");const i={id:this.generateId(),type:t,data:e,timestamp:Date.now(),origin:this.window.location.origin};this.sendMessage(i)}async sendResponse(t,e,i){const n={id:t.id,type:`${t.type}_RESPONSE`,data:i?{error:i}:e,timestamp:Date.now(),origin:this.window.location.origin};this.sendMessage(n)}sendMessage(t){var i;const e=this.isParent?this.window.frames[0]||((i=this.window.document.querySelector("iframe"))==null?void 0:i.contentWindow):this.window.parent;if(!e)throw new Error("Target window not found");this.allowedOrigins.has("*")?e.postMessage(t,"*"):this.allowedOrigins.forEach(n=>{e.postMessage(t,n)})}setupMessageListener(){this.window.addEventListener("message",async t=>{try{await this.handleMessage(t)}catch(e){console.error("Error handling message:",e)}})}async handleMessage(t){if(!this.isOriginAllowed(t.origin)){console.warn("Message from unauthorized origin:",t.origin);return}const e=t.data;if(!this.isValidMessage(e)){console.warn("Invalid message structure:",e);return}if(e.type.endsWith("_RESPONSE")&&this.pendingRequests.has(e.id)){this.handleResponse(e);return}const i=this.messageHandlers.get(e.type);if(!i){console.warn("No handler for message type:",e.type);return}try{const n=await i(e.data);e.type.endsWith("_RESPONSE")||await this.sendResponse(e,n)}catch(n){if(!e.type.endsWith("_RESPONSE")){const r={error:n instanceof Error?n.message:String(n)};n&&typeof n=="object"&&"code"in n&&n.code&&(r.code=n.code);const s={id:e.id,type:`${e.type}_RESPONSE`,data:r,timestamp:Date.now(),origin:this.window.location.origin};this.sendMessage(s)}}}handleResponse(t){const e=this.pendingRequests.get(t.id);if(e)if(clearTimeout(e.timeout),this.pendingRequests.delete(t.id),t.data&&t.data.error){const i=new Error(t.data.error);t.data.code&&(i.code=t.data.code),e.reject(i)}else e.resolve(t.data)}isValidMessage(t){return t&&typeof t.id=="string"&&typeof t.type=="string"&&typeof t.timestamp=="number"&&typeof t.origin=="string"&&Math.abs(Date.now()-t.timestamp)<3e5}isOriginAllowed(t){return this.isInitialized?this.allowedOrigins.has("*")||this.allowedOrigins.has(t):!1}generateId(){return`msg_${Date.now()}_${Math.random().toString(36).substr(2,9)}`}destroy(){this.pendingRequests.forEach(({timeout:t,reject:e})=>{clearTimeout(t),e(new Error("Messenger destroyed"))}),this.pendingRequests.clear(),this.messageHandlers.clear(),this.allowedOrigins.clear(),this.isInitialized=!1}}class I extends x{constructor(t=window){super(!0,t),this.iframe=null}createIframe(t,e){return this.iframe=document.createElement("iframe"),this.iframe.src=t,this.iframe.style.cssText=`
      width: 100%;
      height: 600px;
      border: none;
      border-radius: 8px;
    `,(e||document.body).appendChild(this.iframe),this.iframe.addEventListener("load",()=>{const n=new URL(t).origin;this.init([n])}),this.iframe}createHiddenIframe(t){return this.iframe=document.createElement("iframe"),this.iframe.src=t,this.iframe.style.cssText=`
      position: fixed;
      top: -1000px;
      left: -1000px;
      width: 1px;
      height: 1px;
      border: none;
      opacity: 0;
      pointer-events: none;
    `,document.body.appendChild(this.iframe),this.iframe.addEventListener("load",()=>{const e=new URL(t).origin;this.init([e])}),this.iframe}destroy(){this.iframe&&this.iframe.parentNode&&(this.iframe.parentNode.removeChild(this.iframe),this.iframe=null),super.destroy()}}const A=function(h){return{HIDE_VAULT:()=>{console.log("🔙 Hide vault signal received from vault iframe");try{return h.hide(),console.log("✅ Vault hidden successfully"),{acknowledged:!0}}catch(t){return console.error("❌ Failed to hide vault:",t),{acknowledged:!1,error:t instanceof Error?t.message:"Unknown error"}}},SHOW_VAULT:(t="vault")=>(console.log("Show vault signal received"),h.show(t),{acknowledged:!0}),VAULT_READY:()=>{console.log("Vault ready signal received"),h._isReady=!0;const t=new CustomEvent("nostr:ready",{detail:{embassy:h}});return window.dispatchEvent(t),{acknowledged:!0}},AUTH_STATUS:t=>(console.log("Auth status signal received",t),{acknowledged:!0}),GET_RELAYS:()=>(console.log("Get relays signal received"),{acknowledged:!0}),GOT_ERROR:()=>(console.log("Error signal received"),{acknowledged:!0}),PROMPT_REQUIRED:async t=>(console.log("Prompt requested by vault:",t),(t==null?void 0:t.promptType)==="PIN_PAD"&&(await h.requestPinUnlock()||console.warn("PIN prompt canceled or failed")),{acknowledged:!0}),"nostrpass:unlocked":t=>{console.log("🔓 Vault unlocked signal received from vault iframe",t),t!=null&&t.forOperation&&(console.log("✅ Unlock was for an operation, notifying waiters"),h.notifyUnlocked()),window.dispatchEvent(new CustomEvent("nostrpass:unlocked",{detail:t}))},"nostrpass:logout":t=>{console.log("🚪 Logout signal received from vault iframe",t),window.dispatchEvent(new CustomEvent("nostrpass:logout",{detail:t})),console.log("🚪 ✅ nostrpass:logout event dispatched to window")},VAULT_DATA_UPDATED:t=>{console.log("📦 [Embassy] Vault data updated signal received from vault iframe",t),console.log("📦 [Embassy] Dispatching vault-data-refresh event to window"),window.dispatchEvent(new CustomEvent("vault-data-refresh",{detail:t})),console.log("📦 [Embassy] ✅ vault-data-refresh event dispatched")}}},N=h=>h.replace(/\./g,"-").replace(/:/g,"-").replace(/_/g,"-");var y=(h=>(h.VAULT_READY="VAULT_READY",h.AUTH_STATUS="AUTH_STATUS",h.SHOW_VAULT="SHOW_VAULT",h.HIDE_VAULT="HIDE_VAULT",h.NAVIGATE="NAVIGATE",h.LOGOUT="LOGOUT",h.CHECK_PERMISSION="CHECK_PERMISSION",h.GET_RELAYS="GET_RELAYS",h.GET_PUBLIC_KEY="GET_PUBLIC_KEY",h.SIGN_EVENT="SIGN_EVENT",h.SIGN_DATA="SIGN_DATA",h.ENCRYPT="ENCRYPT",h.DECRYPT="DECRYPT",h.GOT_ERROR="GOT_ERROR",h.PROMPT_REQUIRED="PROMPT_REQUIRED",h.MANAGE_ACCOUNTS="MANAGE_ACCOUNTS",h.GET_ALL_IDENTITIES="GET_ALL_IDENTITIES",h.SWITCH_IDENTITY="SWITCH_IDENTITY",h))(y||{});class L{constructor(t,e={}){f(this,"config");f(this,"container");f(this,"embassy");f(this,"currentUser",null);f(this,"theme","light");f(this,"isDropdownOpen",!1);f(this,"outsideClickHandler",null);f(this,"isCheckingAuth",!0);if(this.embassy=t,this.config={signInText:"Sign in with NostrPass",showNpub:!0,showManageAccount:!0,theme:"auto",...e},this.container=document.createElement("div"),this.container.className=`nostrpass-button-container ${e.className||""}`,this.updateTheme(),this.injectStyles(),this.render(),e.appendTo){const i=typeof e.appendTo=="string"?document.querySelector(e.appendTo):e.appendTo;i&&i.appendChild(this.container)}this.setupEventListeners()}setupEventListeners(){window.addEventListener("nostrpass:logout",()=>{console.log("[NostrPassButton] 🚪 Logout event received"),this.currentUser=null,this.clearSession(),this.render()}),window.addEventListener("vault-data-refresh",async t=>{if(console.log("[NostrPassButton] 🔄 Vault data refresh event received:",t),this.currentUser){console.log("[NostrPassButton] Current user exists, fetching updated identities..."),await new Promise(e=>setTimeout(e,100));try{const e=await this.embassy.getAllIdentities();console.log("[NostrPassButton] getAllIdentities response:",e);const i=(e==null?void 0:e.identities)||[],n=e==null?void 0:e.activeIdentityIndex;if(i.length===0){console.log("[NostrPassButton] No identities returned - user logged out"),this.currentUser=null,this.clearSession();return}if(console.log("[NostrPassButton] Active identity index from vault:",n),console.log("[NostrPassButton] Current session identity index:",this.currentUser.identityIndex),n!==void 0&&n!==this.currentUser.identityIndex){console.log("[NostrPassButton] 🔄 Active identity changed from",this.currentUser.identityIndex,"to",n);const r=i.find(s=>s.index===n);if(r){console.log("[NostrPassButton] Switching to new active identity:",r.nickname),this.currentUser={identityIndex:r.index,publicKey:r.publicKey,nickname:r.nickname,authorized:r.isAuthorized,npub:r.npub},this.saveSession(this.currentUser),console.log("[NostrPassButton] Re-rendering button with new active identity..."),await this.render(),console.log("[NostrPassButton] ✅ Button updated to new active identity");return}}const a=i.find(r=>r.index===this.currentUser.identityIndex);if(console.log("[NostrPassButton] Current identity:",a),console.log("[NostrPassButton] All identities count:",i.length),a){const r=this.currentUser.authorized;this.currentUser.authorized=a.isAuthorized,console.log("[NostrPassButton] Authorization status changed:",{before:r,after:a.isAuthorized}),this.saveSession(this.currentUser),console.log("[NostrPassButton] Re-rendering button..."),await this.render(),console.log("[NostrPassButton] ✅ Button updated after vault data refresh")}else{console.warn("[NostrPassButton] Current identity not found in authorized list - marking as unauthorized");const r=this.currentUser.authorized;this.currentUser.authorized=!1,console.log("[NostrPassButton] Identity disconnected:",{before:r,after:!1}),this.saveSession(this.currentUser),console.log("[NostrPassButton] Re-rendering button for disconnected state..."),await this.render(),console.log("[NostrPassButton] ✅ Button updated - showing unauthorized state")}}catch(e){console.error("[NostrPassButton] ❌ Failed to refresh identity status:",e)}}else{console.log("[NostrPassButton] No current user - checking if user just logged in...");try{await this.restoreSession()&&console.log("[NostrPassButton] ✅ Session restored after login")}catch(e){console.error("[NostrPassButton] ❌ Failed to restore session:",e)}}})}updateTheme(){if(this.config.theme==="auto"){const t=window.matchMedia("(prefers-color-scheme: dark)").matches;this.theme=t?"dark":"light",window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change",e=>{this.theme=e.matches?"dark":"light",this.container.setAttribute("data-theme",this.theme)})}else this.theme=this.config.theme||"light";this.container.setAttribute("data-theme",this.theme)}injectStyles(){if(document.getElementById("nostrpass-button-styles"))return;const t=document.createElement("style");t.id="nostrpass-button-styles",t.textContent=`
      .nostrpass-button-container {
        position: relative;
        display: inline-block;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      }

      /* Sign In Button - Matches user button style */
      .nostrpass-signin-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px 6px 6px;
        border: 1.5px solid #e5e7eb;
        border-radius: 24px;
        cursor: pointer;
        transition: all 0.15s ease;
        background: #fff;
        font-size: 14px;
        font-weight: 500;
      }

      .nostrpass-signin-btn:hover {
        border-color: #d1d5db;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
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
        background: #1f2937;
        border-color: #374151;
        color: #f9fafb;
      }

      [data-theme="dark"] .nostrpass-signin-btn:hover {
        border-color: #4b5563;
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
    `,document.head.appendChild(t)}async render(){this.isCheckingAuth?this.renderLoadingButton():this.currentUser?await this.renderUserButton():this.renderSignInButton()}renderLoadingButton(){this.container.innerHTML=`
      <div class="nostrpass-loading-skeleton"></div>
    `}renderSignInButton(){this.container.innerHTML=`
      <button class="nostrpass-signin-btn" data-action="signin">
        <div class="nostrpass-signin-logo">🥚</div>
        <span>NostrPass</span>
      </button>
    `,this.container.querySelector('[data-action="signin"]').addEventListener("click",()=>this.handleSignIn())}async renderUserButton(){const t=this.currentUser,e=this.getUserInitials(t),i=t.nickname||`Identity ${t.identityIndex+1}`;let n="",a=[];try{const c=await this.embassy.getAuthStatus();n=(c==null?void 0:c.username)||""}catch(c){console.warn("Failed to fetch auth status:",c)}try{const c=await this.embassy.getAllIdentities();a=(c==null?void 0:c.identities)||[]}catch(c){console.warn("Failed to fetch all identities:",c)}const r=t.authorized||a.some(c=>c.isAuthorized);let s="";a.length>1&&(s=`
        <div class="nostrpass-dropdown-divider"></div>
        <div class="nostrpass-dropdown-section">
          <div style="padding: 8px 12px; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase;">
            Switch Identity
          </div>
          ${a.map(c=>{const g=c.index===t.identityIndex,p=c.nickname?this.getInitialsFromName(c.nickname):`I${c.index+1}`;return`
              <button class="nostrpass-dropdown-item nostrpass-identity-item ${g?"nostrpass-identity-active":""}" data-action="switch-identity" data-identity-index="${c.index}">
                <div class="nostrpass-identity-avatar">
                  ${p}
                </div>
                <div class="nostrpass-identity-info">
                  <div class="nostrpass-identity-name">
                    ${c.nickname||`Identity ${c.index+1}`}
                  </div>
                  ${c.npub?`<div class="nostrpass-identity-npub">${c.npub.slice(0,12)}...</div>`:""}
                </div>
                ${g?'<svg class="nostrpass-identity-check" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13.333 4L6 11.333 2.667 8" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>':""}
                ${!c.isAuthorized&&!g?'<span class="nostrpass-identity-badge">Not authorized</span>':""}
              </button>
            `}).join("")}
        </div>
      `),this.container.innerHTML=`
      <div class="nostrpass-user-menu">
        <button class="nostrpass-user-btn ${r?"":"nostrpass-user-btn-warning"}" data-action="toggle-menu">
          ${t.avatar?`<img src="${t.avatar}" alt="${i}" class="nostrpass-user-avatar" />`:`<div class="nostrpass-user-initials">${e}</div>`}
          <span class="nostrpass-user-btn-text">${r?i:"Not authorized"}</span>
          <svg class="nostrpass-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="nostrpass-dropdown" data-dropdown>
          ${r?"":`
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
          `}
          <div class="nostrpass-dropdown-section nostrpass-dropdown-header">
            <div class="nostrpass-dropdown-user-info">
              ${t.avatar?`<img src="${t.avatar}" alt="${i}" class="nostrpass-dropdown-avatar" />`:`<div class="nostrpass-dropdown-initials">${e}</div>`}
              <div class="nostrpass-dropdown-user-details">
                <div class="nostrpass-dropdown-name">${i}</div>
                ${n?`<div class="nostrpass-dropdown-username">${n}</div>`:t.npub?`<div class="nostrpass-dropdown-npub">${t.npub.slice(0,16)}...</div>`:""}
              </div>
            </div>
          </div>
          ${s}
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
    `,this.container.querySelector('[data-action="toggle-menu"]').addEventListener("click",c=>{c.stopPropagation(),this.toggleDropdown()}),this.container.querySelectorAll('[data-action="switch-identity"]').forEach(c=>{c.addEventListener("click",g=>{const p=parseInt(g.currentTarget.getAttribute("data-identity-index")||"0");p===t.identityIndex||this.handleSwitchIdentity(p)})});const l=this.container.querySelector('[data-action="manage-account"]');l==null||l.addEventListener("click",()=>{this.closeDropdown(),this.handleManageAccount()});const u=this.container.querySelector('[data-action="sign-out"]');u==null||u.addEventListener("click",()=>{this.closeDropdown(),this.handleSignOut()})}getInitialsFromName(t){const e=t.split(" ");return e.length>=2?`${e[0][0]}${e[1][0]}`:t.slice(0,2)}async handleSwitchIdentity(t){var e,i,n,a,r;this.closeDropdown();try{const s=await this.embassy.switchIdentity(t);s!=null&&s.success&&(s!=null&&s.identity)&&(this.currentUser={identityIndex:s.identityIndex,publicKey:s.identity.publicKey,npub:s.identity.npub,nickname:s.identity.nickname,authorized:s.identity.authorized||!1},this.saveSession(this.currentUser),await this.render())}catch(s){if(console.error("Failed to switch identity:",s),(e=s==null?void 0:s.message)!=null&&e.includes("not authorized"))try{const o=await this.embassy.manageAccount({forcePrompt:!0,buttonElement:this.container.querySelector('[data-action="toggle-menu"]')});o!=null&&o.identity&&(this.currentUser={identityIndex:o.identityIndex,publicKey:o.identity.publicKey,npub:o.identity.npub,nickname:o.identity.nickname,authorized:o.identity.authorized||!1},this.saveSession(this.currentUser),await this.render())}catch(o){console.error("Failed to authorize identity:",o),(n=(i=this.config).onError)==null||n.call(i,o)}else(r=(a=this.config).onError)==null||r.call(a,s)}}getUserInitials(t){if(t.nickname){const e=t.nickname.split(" ");return e.length>=2?`${e[0][0]}${e[1][0]}`:t.nickname.slice(0,2)}return`I${t.identityIndex+1}`}async handleSignIn(){var i,n,a,r,s,o,d,l;const t=this.container.querySelector('[data-action="signin"]');if(!t)return;const e=t.innerHTML;t.disabled=!0,t.innerHTML='<span class="nostrpass-loading"></span> <span>Signing in...</span>';try{this.embassy.openPage("login",{buttonElement:t});const u=await this.embassy.manageAccount({forcePrompt:!0,buttonElement:t});this.currentUser={identityIndex:u.identityIndex,publicKey:((i=u.identity)==null?void 0:i.publicKey)||"",npub:(n=u.identity)==null?void 0:n.npub,nickname:(a=u.identity)==null?void 0:a.nickname,authorized:((r=u.identity)==null?void 0:r.authorized)||!1},this.saveSession(this.currentUser),this.render(),(o=(s=this.config).onSignIn)==null||o.call(s,this.currentUser)}catch(u){console.error("NostrPass sign in failed:",u);const c=u instanceof Error?u.message:String(u);if(c.toLowerCase().includes("locked")||c.toLowerCase().includes("unlock")){console.log("[NostrPassButton] Vault locked - waiting for unlock...");const g=async()=>{var p,E;console.log("[NostrPassButton] Vault unlocked, checking auth status...");try{const m=await this.embassy.getAuthStatus();m!=null&&m.isAuthenticated&&(m!=null&&m.user)&&(this.currentUser={identityIndex:m.user.identityIndex||0,publicKey:m.user.publicKey||"",npub:m.user.npub,nickname:m.user.nickname,authorized:m.user.authorized||!1},this.saveSession(this.currentUser),this.render(),(E=(p=this.config).onSignIn)==null||E.call(p,this.currentUser)),window.removeEventListener("nostrpass:unlocked",g)}catch(m){console.error("[NostrPassButton] Failed to get auth status after unlock:",m),t.disabled=!1,t.innerHTML=e}};window.addEventListener("nostrpass:unlocked",g);return}t.disabled=!1,t.innerHTML=e,(l=(d=this.config).onError)==null||l.call(d,u)}}async toggleDropdown(){try{const e=await this.embassy.getAuthStatus();if(e!=null&&e.isLocked){console.log("[NostrPassButton] Vault locked, showing unlock page...");const i=this.container.querySelector('[data-action="toggle-menu"]');this.embassy.openPage("unlock",{buttonElement:i});const n=()=>{console.log("[NostrPassButton] Vault unlocked, hiding modal and showing dropdown..."),window.removeEventListener("nostrpass:unlocked",n),this.embassy.hide(),setTimeout(()=>{this.openDropdown()},100)};window.addEventListener("nostrpass:unlocked",n);return}}catch(e){console.error("[NostrPassButton] Failed to check vault status:",e)}this.container.querySelector("[data-dropdown]")&&(this.isDropdownOpen?this.closeDropdown():this.openDropdown())}openDropdown(){const t=this.container.querySelector("[data-dropdown]");t&&(this.isDropdownOpen=!0,t.classList.add("open"),setTimeout(()=>{this.outsideClickHandler=e=>{const i=e.target;this.container.contains(i)||this.closeDropdown()},document.addEventListener("click",this.outsideClickHandler)},0))}closeDropdown(){const t=this.container.querySelector("[data-dropdown]");t&&(this.isDropdownOpen=!1,t.classList.remove("open"),this.removeOutsideClickListener())}removeOutsideClickListener(){this.outsideClickHandler&&(document.removeEventListener("click",this.outsideClickHandler),this.outsideClickHandler=null)}async handleManageAccount(){var t,e;try{this.embassy.openPage("dashboard")}catch(i){console.error("Failed to open vault:",i),(e=(t=this.config).onError)==null||e.call(t,i)}}async handleSignOut(){var t,e;try{console.log("[NostrPassButton] Calling embassy.logout()"),await this.embassy.logout(),console.log("[NostrPassButton] Embassy logout successful")}catch(i){console.error("[NostrPassButton] Embassy logout failed:",i)}this.currentUser=null,this.clearSession(),this.render(),(e=(t=this.config).onSignOut)==null||e.call(t)}saveSession(t){try{sessionStorage.setItem("nostrpass_session",JSON.stringify(t))}catch(e){console.warn("Failed to save NostrPass session:",e)}}clearSession(){try{sessionStorage.removeItem("nostrpass_session"),this.currentUser=null,this.isCheckingAuth=!1,this.render()}catch(t){console.warn("Failed to clear NostrPass session:",t)}}async restoreSession(){console.log("[NostrPassButton] restoreSession called"),this.isCheckingAuth=!0,this.render();try{console.log("[NostrPassButton] Waiting for vault ready..."),await this.embassy.waitForReady(),console.log("[NostrPassButton] Vault is ready");try{console.log("[NostrPassButton] Checking auth status...");const t=await this.embassy.getAuthStatus();return console.log("[NostrPassButton] Auth status response:",t),t!=null&&t.isAuthenticated&&(t!=null&&t.user)?(console.log("[NostrPassButton] User is authenticated, showing user button"),this.currentUser={identityIndex:t.user.identityIndex||0,publicKey:t.user.publicKey||"",npub:t.user.npub,nickname:t.user.nickname,authorized:t.user.authorized||!1},this.isCheckingAuth=!1,this.saveSession(this.currentUser),this.render(),!0):(console.log("[NostrPassButton] Not authenticated - clearing stale session"),this.isCheckingAuth=!1,this.clearSession(),!1)}catch(t){return console.log("[NostrPassButton] Could not get auth status:",t),this.isCheckingAuth=!1,this.clearSession(),!1}}catch(t){return console.warn("[NostrPassButton] Failed to restore NostrPass session:",t),this.isCheckingAuth=!1,this.render(),!1}}getUser(){return this.currentUser}getElement(){return this.container}destroy(){this.container.remove()}}const M={login:{route:"",defaultSize:"minimal"},unlock:{route:"/unlock-modal",defaultSize:"compact",autoCloseOnSuccess:!0},dashboard:{route:"/dashboard",defaultSize:"full"},account:{route:"/account-switcher",defaultSize:"compact",autoCloseOnSuccess:!0}};class U{constructor(t={}){f(this,"config");f(this,"iframe",null);f(this,"_isReady",!1);f(this,"styleElement",null);f(this,"backdropEl",null);f(this,"messenger",null);f(this,"handlers",[]);f(this,"isPromptOpen",!1);f(this,"unlockResolvers",[]);f(this,"outsideClickHandler",null);let e=t.appDomain||window.location.host;if(e.includes("://"))try{e=new URL(e).host}catch{}e=e.split("/")[0],this.config={appName:t.appName||document.title||"Unknown App",appDomain:e,permissions:t.permissions||["getPublicKey","signEvent"],vaultUrl:t.vaultUrl||"http://localhost:3001",trustedOrigins:t.trustedOrigins,theme:t.theme||"auto",debug:t.debug||!1,parentPinOverlay:t.parentPinOverlay??!1},this.handlers=Object.keys(A(this)),console.log("🚀 NostrPass Embassy initialized",this.config),this.injectStyles(),document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>this.createIframe()):this.createIframe()}sleep(t){return new Promise(e=>setTimeout(e,t))}waitForUnlock(){return new Promise(t=>{this.unlockResolvers.push(t),setTimeout(()=>{const e=this.unlockResolvers.indexOf(t);e>-1&&(this.unlockResolvers.splice(e,1),t())},6e4)})}notifyUnlocked(){for(console.log("🔓 Notifying unlock resolvers:",this.unlockResolvers.length);this.unlockResolvers.length>0;){const t=this.unlockResolvers.shift();t&&t()}}promptPin(){return new Promise(t=>{var R;if(this.isPromptOpen)return t(!1);this.isPromptOpen=!0;const e=b=>b.sort(()=>Math.random()-.5);(R=document.getElementById("np-pin-overlay"))==null||R.remove();const i=document.createElement("div");i.id="np-pin-overlay",Object.assign(i.style,{position:"fixed",inset:"0",background:"rgba(0,0,0,0.5)",zIndex:"2147483647",display:"flex",alignItems:"center",justifyContent:"center"});const n=document.createElement("div");Object.assign(n.style,{padding:"16px",borderRadius:"8px",width:"320px",maxWidth:"90vw",fontFamily:"system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"});const a=document.createElement("h3");a.textContent="Unlock Vault",Object.assign(a.style,{margin:"0 0 8px",fontSize:"16px"});const r=document.createElement("p");r.textContent="Enter your PIN to continue.",Object.assign(r.style,{margin:"0 0 12px",color:"#555",fontSize:"13px"});const s=document.createElement("div");Object.assign(s.style,{display:"flex",justifyContent:"center",gap:"12px",marginBottom:"12px"});const o=b=>{s.innerHTML="";for(let v=0;v<6;v++){const P=document.createElement("div");P.style.width="12px",P.style.height="12px",P.style.borderRadius="9999px",P.style.border="2px solid "+(v<b?"#111":"#d1d5db"),s.appendChild(P)}},d=document.createElement("div");Object.assign(d.style,{display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:"10px",width:"240px",margin:"0 auto"});const l=b=>{const v=document.createElement("button");return v.textContent=b,Object.assign(v.style,{width:"76px",height:"56px",border:"1px solid #d1d5db",borderRadius:"8px",fontWeight:"600",cursor:"pointer"}),v},u=b=>{const v=document.createElement("button");return v.textContent=b,Object.assign(v.style,{height:"44px",border:"1px solid #d1d5db",borderRadius:"8px",background:"#fff",cursor:"pointer"}),v};let c="";const g=e(["1","2","3","4","5","6","7","8","9","0"]),p=()=>{this.isPromptOpen=!1,i.remove()},E=async()=>{try{const b=await this.messenger.request("UNLOCK_WITH_PIN",{pin:c});if(b!=null&&b.success)p(),t(!0);else{for(c="",o(0);d.firstChild;)d.removeChild(d.firstChild);e(g),T()}}catch{c="",o(0)}},m=b=>{c.length>=6||(c+=b,o(c.length),c.length===6&&E())},H=()=>{c&&(c=c.slice(0,-1),o(c.length))},T=()=>{g.forEach(P=>{const z=l(P);z.addEventListener("click",()=>m(P)),d.appendChild(z)});const b=u("← Delete");b.style.gridColumn="span 2",b.addEventListener("click",H),d.appendChild(b);const v=document.createElement("div");d.appendChild(v)},S=document.createElement("div");Object.assign(S.style,{display:"flex",gap:"8px",marginTop:"12px",justifyContent:"flex-end"});const O=u("Cancel");O.addEventListener("click",()=>{p(),t(!1)}),S.appendChild(O),n.appendChild(a),n.appendChild(r),n.appendChild(s),o(0),T(),n.appendChild(d),n.appendChild(S),i.appendChild(n),document.body.appendChild(i)})}requestPinUnlock(){return this.promptPin()}async createIframe(){if(this.iframe){this.config.debug&&console.log("Iframe already exists");return}return new Promise((t,e)=>{this.iframe=document.createElement("iframe"),this.iframe.id="nostrpass-vault-iframe";const i=new URL(this.config.vaultUrl+"/"+N(this.config.appDomain));i.searchParams.set("appName",this.config.appName),i.searchParams.set("appDomain",this.config.appDomain),i.searchParams.set("theme",this.config.theme),this.iframe.src=i.toString(),console.log("[Embassy] Creating iframe with:",{appDomain:this.config.appDomain,sanitized:N(this.config.appDomain),iframeSrc:i.toString()}),this.iframe.setAttribute("sandbox","allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"),this.iframe.setAttribute("allow","publickey-credentials-create; publickey-credentials-get"),this.iframe.setAttribute("aria-hidden","true"),this.iframe.setAttribute("tabindex","-1"),this.iframe.setAttribute("title","NostrPass Vault"),this.iframe.className="nostrpass-iframe nostrpass-iframe-hidden",this.iframe.style.background="transparent",this.iframe.style.backgroundColor="transparent",this.iframe.setAttribute("allowtransparency","true"),this.config.debug&&new URLSearchParams(window.location.search).has("embassy-debug")&&(this.iframe.classList.add("nostrpass-iframe-debug"),this.iframe.classList.remove("nostrpass-iframe-hidden")),this.initializeMessenger(),this.iframe.onload=()=>{this.config.debug&&console.log("Iframe loaded successfully"),setTimeout(()=>{this.config.debug&&console.log("Iframe initialization period complete"),t()},100)},this.iframe.onerror=()=>{console.error("Failed to load NostrPass vault"),e(new Error("Failed to load vault iframe"))},this.backdropEl||(this.backdropEl=document.createElement("div"),this.backdropEl.className="nostrpass-backdrop",this.backdropEl.addEventListener("click",n=>{console.log("🎯 Backdrop clicked"),n.stopPropagation(),this.hide()})),document.body.appendChild(this.backdropEl),document.body.appendChild(this.iframe),this.config.debug&&console.log("Iframe created and added to DOM")})}openPage(t,e){if(!this.iframe){console.warn("Cannot show iframe - not created yet"),this.createIframe().then(()=>this.openPage(t,e));return}const i=M[t],n=(e==null?void 0:e.size)||i.defaultSize,a=e==null?void 0:e.buttonElement,r=N(this.config.appDomain),s=i.route?`/${r}${i.route}`:`/${r}`;if(new URL(this.iframe.src).pathname!==s&&this.messenger&&this.messenger.request(y.NAVIGATE,{path:s}).then(()=>{console.log("🔄 Navigated vault to:",t,"at path",s)}).catch(d=>{console.error("Navigation failed, falling back to iframe reload:",d);const l=new URL(this.config.vaultUrl);l.pathname=s,l.searchParams.set("appName",this.config.appName),l.searchParams.set("appDomain",this.config.appDomain),l.searchParams.set("theme",this.config.theme),this.iframe&&(this.iframe.src=l.toString(),console.log("🔄 Opening vault page (fallback):",t,"at",l.toString()))}),this.iframe.classList.remove("nostrpass-iframe-hidden"),this.iframe.classList.remove("nostrpass-iframe-visible"),this.iframe.classList.remove("nostrpass-iframe-compact"),this.iframe.classList.remove("nostrpass-iframe-minimal"),this.iframe.style.top="",this.iframe.style.left="",this.iframe.style.transform="",n==="minimal")this.iframe.classList.add("nostrpass-iframe-minimal");else if(n==="compact")if(this.iframe.classList.add("nostrpass-iframe-compact"),a){const d=a.getBoundingClientRect(),l=window.innerHeight-d.bottom,u=d.top,c=395,g=395,p=8;let E,m;if(l>=g+p)E=d.bottom+p;else if(u>=g+p)E=d.top-g-p;else{this.iframe.style.top="50%",this.iframe.style.left="50%",this.iframe.style.transform="translate(-50%, -50%)";return}m=d.left,m+c>window.innerWidth-p&&(m=d.right-c),m<p&&(m=p),this.iframe.style.top=`${E}px`,this.iframe.style.left=`${m}px`,this.iframe.style.transform="none"}else this.iframe.style.top="50%",this.iframe.style.left="50%",this.iframe.style.transform="translate(-50%, -50%)";else this.iframe.classList.add("nostrpass-iframe-visible");this.backdropEl&&(this.backdropEl.classList.add("visible"),this.backdropEl.style.background="transparent",this.backdropEl.style.backdropFilter="none"),n==="compact"&&(this.outsideClickHandler&&document.removeEventListener("click",this.outsideClickHandler),setTimeout(()=>{this.outsideClickHandler=d=>{const l=d.target;this.iframe&&!this.iframe.contains(l)&&this.backdropEl&&this.backdropEl===l&&(console.log("🎯 Click outside iframe detected"),this.hide())},document.addEventListener("click",this.outsideClickHandler)},100)),this.iframe.setAttribute("aria-hidden","false"),this.iframe.removeAttribute("tabindex"),document.body.style.overflow="hidden"}show(t="vault",e="full",i){let n;t==="unlock"||t==="unlock-modal"?n="unlock":t==="dashboard"?n="dashboard":n="login",this.openPage(n,{size:e,buttonElement:i})}hide(){if(console.log("🔙 Embassy hide() method called"),!this.iframe){console.warn("Cannot hide iframe - not created yet");return}console.log("🔙 Hiding iframe, current classes:",this.iframe.className),this.iframe.classList.remove("nostrpass-iframe-visible"),this.iframe.classList.remove("nostrpass-iframe-compact"),this.iframe.classList.remove("nostrpass-iframe-minimal"),this.iframe.classList.add("nostrpass-iframe-hidden"),this.backdropEl&&this.backdropEl.classList.remove("visible"),this.outsideClickHandler&&(document.removeEventListener("click",this.outsideClickHandler),this.outsideClickHandler=null),this.iframe.setAttribute("aria-hidden","true"),this.iframe.setAttribute("tabindex","-1"),document.body.style.overflow="",console.log("🔙 Iframe hidden, new classes:",this.iframe.className),this.config.debug&&console.log("Iframe hidden")}injectStyles(){this.styleElement||(this.styleElement=document.createElement("style"),this.styleElement.id="nostrpass-embassy-styles",this.styleElement.textContent=`
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
    `,document.head.appendChild(this.styleElement),this.config.debug&&console.log("Styles injected"))}initializeMessenger(){if(!this.iframe)return;this.messenger=new I(window),this.messenger.sendMessage=e=>{var n;if(!((n=this.iframe)!=null&&n.contentWindow)){console.error("Iframe contentWindow not available");return}const i=new URL(this.iframe.src).origin;this.iframe.contentWindow.postMessage(e,i)};let t;if(this.config.trustedOrigins&&this.config.trustedOrigins.length>0?t=[...this.config.trustedOrigins]:t=["https://nostrpass.com","https://app.nostrpass.com","https://www.nostrpass.com"],this.config.vaultUrl)try{const e=new URL(this.config.vaultUrl).origin;t.includes(e)||t.push(e)}catch(e){console.warn("Failed to parse vaultUrl origin:",e)}(this.iframe.src.includes("localhost")||this.iframe.src.includes("127.0.0.1"))&&(t.includes("http://localhost:3001")||t.push("http://localhost:3001"),t.includes("http://127.0.0.1:3001")||t.push("http://127.0.0.1:3001")),this.messenger.init(t),this.setupMessageHandlers(),this.config.debug&&console.log("Messenger initialized with trusted origins:",t)}setupMessageHandlers(){if(!this.messenger)return;const t=A(this);console.log("Setting up message handlers:",this.handlers),this.handlers.forEach(e=>{console.log("Registering handler for:",e),this.messenger.on(e,t[e])}),this.config.debug&&console.log("Message handlers registered:",this.messenger.messageHandlers)}async getPublicKey(t){var e;(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());try{let i=t==null?void 0:t.identityIndex;if(i==null)try{const r=await this.getAuthStatus();i=((e=r==null?void 0:r.user)==null?void 0:e.identityIndex)??0}catch{i=0}let n=null;try{const r=await this.messenger.request(y.CHECK_PERMISSION,{action:"getPublicKey",identityIndex:i}),s=(r==null?void 0:r.isLocked)===!0,o=(r==null?void 0:r.needsPrompt)===!0;if(s&&this.config.parentPinOverlay){if(!await this.requestPinUnlock())throw new Error("User canceled PIN prompt")}else s&&!this.config.parentPinOverlay?(console.log("⏳ Vault is locked, showing quick unlock..."),n=this.waitForUnlock(),this.openPage("unlock",{size:"compact"})):o&&!this.config.parentPinOverlay&&this.show("vault","full")}catch(r){String((r==null?void 0:r.message)||r).toLowerCase().includes("not authenticated")&&(console.log("⚠️ User not authenticated, showing full vault for login"),this.show("vault","full"))}n&&(console.log("⏳ Waiting for vault unlock..."),await n,console.log("✅ Vault unlocked, continuing operation"));const a=await this.messenger.request(y.GET_PUBLIC_KEY,{appName:this.config.appName,appDomain:this.config.appDomain,identityIndex:i});return this.config.debug&&console.log("Public key received:",a),this.hide(),a.publicKey||a}catch(i){throw console.error("Failed to get public key:",i),i}}async signEvent(t,e){var i;(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());try{let n=e==null?void 0:e.identityIndex;if(n==null)try{const s=await this.getAuthStatus();n=((i=s==null?void 0:s.user)==null?void 0:i.identityIndex)??0}catch{n=0}let a=null;try{const s=await this.messenger.request(y.CHECK_PERMISSION,{action:"signEvent",eventKind:t==null?void 0:t.kind,identityIndex:n}),o=(s==null?void 0:s.isLocked)===!0,d=(s==null?void 0:s.needsPrompt)===!0;if(o&&this.config.parentPinOverlay){if(!await this.requestPinUnlock())throw new Error("User canceled PIN prompt")}else o&&!this.config.parentPinOverlay?(console.log("⏳ Vault is locked, showing quick unlock..."),a=this.waitForUnlock(),this.openPage("unlock",{size:"compact"})):d&&!this.config.parentPinOverlay&&this.show("vault","full")}catch(s){String((s==null?void 0:s.message)||s).toLowerCase().includes("not authenticated")&&(console.log("⚠️ User not authenticated, showing full vault for login"),this.show("vault","full"))}a&&(console.log("⏳ Waiting for vault unlock..."),await a,console.log("✅ Vault unlocked, continuing operation"));const r=async()=>this.messenger.request(y.SIGN_EVENT,{event:t,appName:this.config.appName,appDomain:this.config.appDomain,identityIndex:n});try{const s=await r();return this.config.debug&&console.log("Signed event received:",s),this.hide(),s.signedEvent||s}catch(s){const o=String((s==null?void 0:s.message)||s);if(o.toLowerCase().includes("vault is locked")||o.toLowerCase().includes("rehydrated")){await this.sleep(150);const d=await r();return this.config.debug&&console.log("Signed event received (retry):",d),this.hide(),d.signedEvent||d}throw s}}catch(n){throw console.error("Failed to sign event:",n),n}}async getRelays(){return console.log("TODO: getRelays"),{}}async signData(t,e){var i;(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());try{let n=e==null?void 0:e.identityIndex;if(n==null)try{const s=await this.getAuthStatus();n=((i=s==null?void 0:s.user)==null?void 0:i.identityIndex)??0}catch{n=0}let a=null;try{const s=await this.messenger.request(y.CHECK_PERMISSION,{action:"signData",identityIndex:n}),o=(s==null?void 0:s.isLocked)===!0,d=(s==null?void 0:s.needsPrompt)===!0;if(o&&this.config.parentPinOverlay){if(!await this.requestPinUnlock())throw new Error("User canceled PIN prompt")}else o&&!this.config.parentPinOverlay?(console.log("⏳ Vault is locked, showing quick unlock..."),a=this.waitForUnlock(),this.openPage("unlock",{size:"compact"})):d&&!this.config.parentPinOverlay&&this.show("vault","full")}catch(s){String((s==null?void 0:s.message)||s).toLowerCase().includes("not authenticated")&&(console.log("⚠️ User not authenticated, showing full vault for login"),this.show("vault","full"))}a&&(console.log("⏳ Waiting for vault unlock..."),await a,console.log("✅ Vault unlocked, continuing operation"));const r=async()=>this.messenger.request(y.SIGN_DATA,{data:t,appName:this.config.appName,appDomain:this.config.appDomain,identityIndex:n});try{const s=await r(),o=(s==null?void 0:s.signature)??s;return this.config.debug&&console.log("Signed data received:",o),this.hide(),o}catch(s){const o=String((s==null?void 0:s.message)||s);if(o.toLowerCase().includes("locked")||o.toLowerCase().includes("unlock")||o.toLowerCase().includes("rehydrated")){await this.sleep(150);try{const d=await r();return this.hide(),(d==null?void 0:d.signature)??d}catch(d){if(String((d==null?void 0:d.message)||d).toLowerCase().includes("rehydrated")){await this.sleep(200);const u=await r();return this.hide(),(u==null?void 0:u.signature)??u}throw d}}throw s}}catch(n){throw console.error("Failed to sign data:",n),n}}async encrypt(t,e,i){var n;(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());try{let a=i==null?void 0:i.identityIndex;if(a==null)try{const o=await this.getAuthStatus();a=((n=o==null?void 0:o.user)==null?void 0:n.identityIndex)??0}catch{a=0}let r=null;try{const o=await this.messenger.request(y.CHECK_PERMISSION,{action:"nip04",identityIndex:a}),d=(o==null?void 0:o.isLocked)===!0,l=(o==null?void 0:o.needsPrompt)===!0;if(d&&this.config.parentPinOverlay){if(!await this.requestPinUnlock())throw new Error("User canceled PIN prompt")}else d&&!this.config.parentPinOverlay?(console.log("⏳ Vault is locked, showing quick unlock..."),r=this.waitForUnlock(),this.openPage("unlock",{size:"compact"})):l&&!this.config.parentPinOverlay&&this.show("vault","full")}catch(o){String((o==null?void 0:o.message)||o).toLowerCase().includes("not authenticated")&&(console.log("⚠️ User not authenticated, showing full vault for login"),this.show("vault","full"))}r&&(console.log("⏳ Waiting for vault unlock..."),await r,console.log("✅ Vault unlocked, continuing operation"));const s=async()=>this.messenger.request(y.ENCRYPT,{plaintext:e,recipientPubkey:t,appName:this.config.appName,appDomain:this.config.appDomain,identityIndex:a});try{const o=await s();return this.config.debug&&console.log("Encrypted payload received:",o),this.hide(),o}catch(o){const d=String((o==null?void 0:o.message)||o);if(d.toLowerCase().includes("locked")||d.toLowerCase().includes("unlock")||d.toLowerCase().includes("rehydrated")){await this.sleep(150);try{const l=await s();return this.hide(),l}catch(l){if(String((l==null?void 0:l.message)||l).toLowerCase().includes("rehydrated")){await this.sleep(200);const c=await s();return this.hide(),c}throw l}}throw o}}catch(a){throw console.error("Failed to encrypt:",a),a}}async decrypt(t,e,i){var n;(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());try{let a=i==null?void 0:i.identityIndex;if(a==null)try{const o=await this.getAuthStatus();a=((n=o==null?void 0:o.user)==null?void 0:n.identityIndex)??0}catch{a=0}let r=null;try{const o=await this.messenger.request(y.CHECK_PERMISSION,{action:"nip04",identityIndex:a}),d=(o==null?void 0:o.isLocked)===!0,l=(o==null?void 0:o.needsPrompt)===!0;if(d&&this.config.parentPinOverlay){if(!await this.requestPinUnlock())throw new Error("User canceled PIN prompt")}else d&&!this.config.parentPinOverlay?(console.log("⏳ Vault is locked, showing quick unlock..."),r=this.waitForUnlock(),this.openPage("unlock",{size:"compact"})):l&&!this.config.parentPinOverlay&&this.show("vault","full")}catch(o){String((o==null?void 0:o.message)||o).toLowerCase().includes("not authenticated")&&(console.log("⚠️ User not authenticated, showing full vault for login"),this.show("vault","full"))}r&&(console.log("⏳ Waiting for vault unlock..."),await r,console.log("✅ Vault unlocked, continuing operation"));const s=async()=>this.messenger.request(y.DECRYPT,{ciphertext:e,senderPubkey:t,appName:this.config.appName,appDomain:this.config.appDomain,identityIndex:a});try{const o=await s();return this.config.debug&&console.log("Decrypted payload received:",o),this.hide(),o}catch(o){const d=String((o==null?void 0:o.message)||o);if(d.toLowerCase().includes("locked")||d.toLowerCase().includes("unlock")||d.toLowerCase().includes("rehydrated")){await this.sleep(150);try{const l=await s();return this.hide(),l}catch(l){if(String((l==null?void 0:l.message)||l).toLowerCase().includes("rehydrated")){await this.sleep(200);const c=await s();return this.hide(),c}throw l}}throw o}}catch(a){throw console.error("Failed to decrypt:",a),a}}async getAuthStatus(){(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());try{return await this.messenger.request(y.AUTH_STATUS,{})}catch(t){throw console.error("Failed to get auth status:",t),t}}async getAllIdentities(){(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());try{return await this.messenger.request(y.GET_ALL_IDENTITIES,{})}catch(t){throw console.error("Failed to get all identities:",t),t}}async switchIdentity(t){(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());try{return await this.messenger.request(y.SWITCH_IDENTITY,{identityIndex:t})}catch(e){throw console.error("Failed to switch identity:",e),e}}async logout(){if(!this.iframe||!this.messenger){console.log("[Embassy] No iframe/messenger to logout from");return}try{console.log("[Embassy] Sending LOGOUT message to vault"),await this.messenger.request(y.LOGOUT,{}),console.log("[Embassy] Logout successful")}catch(t){throw console.error("[Embassy] Logout failed:",t),t}}async manageAccount(t={}){(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());const e=t.forcePrompt??!0,i=t.size||"minimal";this.show("vault",i,t.buttonElement);try{const n=await this.messenger.request(y.MANAGE_ACCOUNTS,{appName:this.config.appName,appDomain:this.config.appDomain,forcePrompt:e});return this.hide(),n}catch(n){throw n}}createAccountManagerButton(t={}){const{label:e="Manage NostrPass Account",className:i="nostrpass-account-button",appendTo:n,buttonElement:a,disabledText:r,onSelect:s,onError:o,forcePrompt:d}=t,l=a??document.createElement("button");a?i&&(a.className=i):(l.type="button",l.className=i,l.textContent=e);const u=async c=>{c.preventDefault();const g=l.textContent;try{l.disabled=!0,r&&(l.textContent=r);const p=await this.manageAccount({forcePrompt:d});s==null||s(p)}catch(p){o?o(p):console.error("[NostrPass] Failed to manage account:",p)}finally{l.disabled=!1,r&&g!==void 0&&g!==null&&(l.textContent=g)}};if(l.addEventListener("click",u),n){const c=typeof n=="string"?document.querySelector(n):n;c?l.parentElement||c.appendChild(l):console.warn("[NostrPass] Unable to find target element for account manager button:",n)}return l}createNostrPassButton(t={}){return new L(this,t)}isReady(){return this._isReady}async waitForReady(){if(!this._isReady)return new Promise(t=>{const e=()=>{this._isReady?t():setTimeout(e,100)};e()})}destroy(){this.messenger&&(this.messenger.destroy(),this.messenger=null),this.iframe&&this.iframe.parentNode&&(this.iframe.parentNode.removeChild(this.iframe),this.iframe=null),this.backdropEl&&this.backdropEl.parentNode&&(this.backdropEl.parentNode.removeChild(this.backdropEl),this.backdropEl=null),this.styleElement&&this.styleElement.parentNode&&(this.styleElement.parentNode.removeChild(this.styleElement),this.styleElement=null),this._isReady=!1,this.config.debug&&console.log("Embassy destroyed")}}let w=null;function C(h={}){return w&&w.destroy(),w=new U(h),{getPublicKey:e=>w.getPublicKey(e),signEvent:(e,i)=>w.signEvent(e,i),signData:(e,i)=>w.signData(e,i),getRelays:()=>w.getRelays(),nip04:{encrypt:(e,i,n)=>w.encrypt(e,i,n),decrypt:(e,i,n)=>w.decrypt(e,i,n)},manageAccount:e=>w.manageAccount(e),createAccountManagerButton:e=>w.createAccountManagerButton(e),createNostrPassButton:e=>w.createNostrPassButton(e)}}function B(){console.log("showVault"),w==null||w.show()}function _(){w==null||w.hide()}if(typeof window<"u"){window.initNostrPass=C,window.showVault=B,window.hideVault=_;const h=document.currentScript;if((h==null?void 0:h.getAttribute("data-manual-init"))==="true")console.log("✅ NostrPass Embassy loaded (manual init mode)");else{const e={};h!=null&&h.hasAttribute("data-vault-url")&&(e.vaultUrl=h.getAttribute("data-vault-url")||void 0),h!=null&&h.hasAttribute("data-app-name")&&(e.appName=h.getAttribute("data-app-name")||void 0),h!=null&&h.hasAttribute("data-debug")&&(e.debug=h.getAttribute("data-debug")==="true"),h!=null&&h.hasAttribute("data-theme")&&(e.theme=h.getAttribute("data-theme")||void 0);const i=C(e);window.nostr=i,console.log("✅ NostrPass Embassy auto-initialized with config:",e)}console.log("💡 Use window.initNostrPass(config) to customize")}return k.NostrPassButton=L,k.NostrPassEmbassy=U,k.initNostrPass=C,Object.defineProperty(k,Symbol.toStringTag,{value:"Module"}),k}({}),D;(D=document.currentScript)!=null&&D.hasAttribute("data-auto-init")&&window.initNostrPass();
//# sourceMappingURL=embassy.iife.js.map
