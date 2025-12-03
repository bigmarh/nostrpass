var NostrPassEmbassy=function(I){"use strict";var F=Object.defineProperty;var H=(I,L,C)=>L in I?F(I,L,{enumerable:!0,configurable:!0,writable:!0,value:C}):I[L]=C;var w=(I,L,C)=>H(I,typeof L!="symbol"?L+"":L,C);class L{constructor(t=!1,e=e){this.isParent=t,this.window=e,this.pendingRequests=new Map,this.messageHandlers=new Map,this.allowedOrigins=new Set,this.isInitialized=!1,this.defaultTimeout=3e4,this.detectedParentOrigin=null,this.window=e,this.setupMessageListener()}init(t=["*"]){t.forEach(e=>this.allowedOrigins.add(e)),this.isInitialized=!0}on(t,e){this.messageHandlers.set(t,e)}off(t){this.messageHandlers.delete(t)}async request(t,e=null,i=this.defaultTimeout){if(!this.isInitialized)throw new Error("SecureMessenger not initialized. Call init() first.");const s=this.generateId(),a={id:s,type:t,data:e,timestamp:Date.now(),origin:this.window.location.origin};return new Promise((r,p)=>{const h=setTimeout(()=>{this.pendingRequests.delete(s),p(new Error(`Request timeout after ${i}ms`))},i);this.pendingRequests.set(s,{resolve:r,reject:p,timeout:h}),this.sendMessage(a)})}send(t,e=null){if(!this.isInitialized)throw new Error("SecureMessenger not initialized. Call init() first.");const i={id:this.generateId(),type:t,data:e,timestamp:Date.now(),origin:this.window.location.origin};this.sendMessage(i)}async sendResponse(t,e,i){const s={id:t.id,type:`${t.type}_RESPONSE`,data:i?{error:i}:e,timestamp:Date.now(),origin:this.window.location.origin};this.sendMessage(s)}sendMessage(t){var i;const e=this.isParent?this.window.frames[0]||((i=this.window.document.querySelector("iframe"))==null?void 0:i.contentWindow):this.window.parent;if(!e)throw new Error("Target window not found");this.allowedOrigins.has("*")?e.postMessage(t,"*"):!this.isParent&&this.detectedParentOrigin?e.postMessage(t,this.detectedParentOrigin):this.allowedOrigins.forEach(s=>{try{e.postMessage(t,s)}catch{}})}setupMessageListener(){this.window.addEventListener("message",async t=>{try{await this.handleMessage(t)}catch(e){console.error("Error handling message:",e)}})}async handleMessage(t){if(!this.isOriginAllowed(t.origin)){console.warn("Message from unauthorized origin:",t.origin);return}!this.isParent&&!this.detectedParentOrigin&&(this.detectedParentOrigin=t.origin);const e=t.data;if(!this.isValidMessage(e)){console.warn("Invalid message structure:",e);return}if(e.type.endsWith("_RESPONSE")&&this.pendingRequests.has(e.id)){this.handleResponse(e);return}const i=this.messageHandlers.get(e.type);if(!i){console.warn("No handler for message type:",e.type);return}try{const s=await i(e.data);e.type.endsWith("_RESPONSE")||await this.sendResponse(e,s)}catch(s){if(!e.type.endsWith("_RESPONSE")){const r={error:s instanceof Error?s.message:String(s)};s&&typeof s=="object"&&"code"in s&&s.code&&(r.code=s.code);const p={id:e.id,type:`${e.type}_RESPONSE`,data:r,timestamp:Date.now(),origin:this.window.location.origin};this.sendMessage(p)}}}handleResponse(t){const e=this.pendingRequests.get(t.id);if(e)if(clearTimeout(e.timeout),this.pendingRequests.delete(t.id),t.data&&t.data.error){const i=new Error(t.data.error);t.data.code&&(i.code=t.data.code),e.reject(i)}else e.resolve(t.data)}isValidMessage(t){return t&&typeof t.id=="string"&&typeof t.type=="string"&&typeof t.timestamp=="number"&&typeof t.origin=="string"&&Math.abs(Date.now()-t.timestamp)<3e5}isOriginAllowed(t){return this.isInitialized?this.allowedOrigins.has("*")||this.allowedOrigins.has(t):!1}generateId(){return`msg_${Date.now()}_${Math.random().toString(36).substr(2,9)}`}destroy(){this.pendingRequests.forEach(({timeout:t,reject:e})=>{clearTimeout(t),e(new Error("Messenger destroyed"))}),this.pendingRequests.clear(),this.messageHandlers.clear(),this.allowedOrigins.clear(),this.isInitialized=!1}}class C extends L{constructor(t=window){super(!0,t),this.iframe=null}createIframe(t,e){return this.iframe=document.createElement("iframe"),this.iframe.src=t,this.iframe.style.cssText=`
      width: 100%;
      height: 600px;
      border: none;
      border-radius: 8px;
    `,(e||document.body).appendChild(this.iframe),this.iframe.addEventListener("load",()=>{const s=new URL(t).origin;this.init([s])}),this.iframe}createHiddenIframe(t){return this.iframe=document.createElement("iframe"),this.iframe.src=t,this.iframe.style.cssText=`
      position: fixed;
      top: -1000px;
      left: -1000px;
      width: 1px;
      height: 1px;
      border: none;
      opacity: 0;
      pointer-events: none;
    `,document.body.appendChild(this.iframe),this.iframe.addEventListener("load",()=>{const e=new URL(t).origin;this.init([e])}),this.iframe}destroy(){this.iframe&&this.iframe.parentNode&&(this.iframe.parentNode.removeChild(this.iframe),this.iframe=null),super.destroy()}}const T=function(d){return{HIDE_VAULT:()=>{console.log("🔙 Hide vault signal received from vault iframe");try{return d.hide(),console.log("✅ Vault hidden successfully"),{acknowledged:!0}}catch(t){return console.error("❌ Failed to hide vault:",t),{acknowledged:!1,error:t instanceof Error?t.message:"Unknown error"}}},OPEN_PERMISSION_PAGE:t=>{console.log("🔐 Open permission page signal received from vault iframe",t);try{const e={};return t.appOrigin&&(e.appOrigin=t.appOrigin),t.appName&&(e.appName=t.appName),t.action&&(e.action=t.action),t.requestId&&(e.requestId=t.requestId),t.eventKind!==void 0&&(e.eventKind=String(t.eventKind)),t.identityIndex!==void 0&&(e.identityIndex=String(t.identityIndex)),t.event&&(e.event=JSON.stringify(t.event)),t.data&&(e.data=t.data),t.pubkey&&(e.pubkey=t.pubkey),t.plaintext&&(e.plaintext=t.plaintext),t.ciphertext&&(e.ciphertext=t.ciphertext),d.openPage("permission",{size:"tall",queryParams:e}),console.log("✅ Permission page opened successfully"),{acknowledged:!0}}catch(e){return console.error("❌ Failed to open permission page:",e),{acknowledged:!1,error:e instanceof Error?e.message:"Unknown error"}}},SHOW_VAULT:(t="vault")=>(console.log("Show vault signal received"),d.show(t),{acknowledged:!0}),VAULT_READY:()=>{console.log("Vault ready signal received"),d._isReady=!0;const t=new CustomEvent("nostr:ready",{detail:{embassy:d}});return window.dispatchEvent(t),{acknowledged:!0}},AUTH_STATUS:t=>(console.log("Auth status signal received",t),{acknowledged:!0}),GET_RELAYS:()=>(console.log("Get relays signal received"),{acknowledged:!0}),GOT_ERROR:()=>(console.log("Error signal received"),{acknowledged:!0}),PROMPT_REQUIRED:async t=>(console.log("Prompt requested by vault:",t),(t==null?void 0:t.promptType)==="PIN_PAD"&&(await d.requestPinUnlock()||console.warn("PIN prompt canceled or failed")),{acknowledged:!0}),"nostrpass:unlocked":t=>{if(console.log("🔓 Vault unlocked signal received from vault iframe",t),t!=null&&t.forOperation&&(console.log("✅ Unlock was for an operation, notifying waiters"),d.notifyUnlocked(),d.notifyAuthenticated()),(t==null?void 0:t.nextAction)==="account-picker"){console.log("🔄 Unlock requested account-picker continuation, switching to account-picker page");const e={};t.appOrigin&&(e.appOrigin=t.appOrigin),t.appName&&(e.appName=t.appName),t.requestId&&(e.requestId=t.requestId),t.permissions&&(e.permissions=t.permissions),d.openPage("account",{queryParams:e})}window.dispatchEvent(new CustomEvent("nostrpass:unlocked",{detail:t}))},"nostrpass:logout":t=>{console.log("🚪 Logout signal received from vault iframe",t),window.dispatchEvent(new CustomEvent("nostrpass:logout",{detail:t})),console.log("🚪 ✅ nostrpass:logout event dispatched to window")},VAULT_DATA_UPDATED:t=>{console.log("📦 [Embassy] Vault data updated signal received from vault iframe",t),console.log("📦 [Embassy] Dispatching vault-data-refresh event to window"),window.dispatchEvent(new CustomEvent("vault-data-refresh",{detail:t})),console.log("📦 [Embassy] ✅ vault-data-refresh event dispatched")},ACCOUNT_PICKER_SELECTED:t=>{console.log("✅ [Embassy] Account picker selected signal received from vault iframe",t),window.dispatchEvent(new CustomEvent("account-picker-selected",{detail:t})),console.log("✅ [Embassy] account-picker-selected event dispatched to window")},PERMISSION_GRANTED:t=>{var e;console.log("✅ [Embassy] Permission granted signal received from vault iframe",t),window.dispatchEvent(new CustomEvent("permission-granted",{detail:t})),(e=d==null?void 0:d.notifyPermissionGranted)==null||e.call(d)},PERMISSION_DENIED:t=>{console.log("❌ [Embassy] Permission denied signal received from vault iframe",t),window.dispatchEvent(new CustomEvent("permission-denied",{detail:t}))}}},U=d=>d.replace(/\./g,"-").replace(/:/g,"-").replace(/_/g,"-");var k=(d=>(d.VAULT_READY="VAULT_READY",d.AUTH_STATUS="AUTH_STATUS",d.SHOW_VAULT="SHOW_VAULT",d.HIDE_VAULT="HIDE_VAULT",d.NAVIGATE="NAVIGATE",d.LOGOUT="LOGOUT",d.CHECK_PERMISSION="CHECK_PERMISSION",d.GET_RELAYS="GET_RELAYS",d.GET_PUBLIC_KEY="GET_PUBLIC_KEY",d.SIGN_EVENT="SIGN_EVENT",d.SIGN_DATA="SIGN_DATA",d.ENCRYPT="ENCRYPT",d.DECRYPT="DECRYPT",d.GOT_ERROR="GOT_ERROR",d.PROMPT_REQUIRED="PROMPT_REQUIRED",d.MANAGE_ACCOUNTS="MANAGE_ACCOUNTS",d.GET_ALL_IDENTITIES="GET_ALL_IDENTITIES",d.SWITCH_IDENTITY="SWITCH_IDENTITY",d))(k||{});class R{constructor(t,e={}){w(this,"config");w(this,"container");w(this,"embassy");w(this,"currentUser",null);w(this,"allIdentities",[]);w(this,"theme","light");w(this,"isDropdownOpen",!1);w(this,"outsideClickHandler",null);w(this,"isCheckingAuth",!0);w(this,"authPollingInterval",null);if(this.embassy=t,this.config={signInText:"Sign in with NostrPass",showNpub:!0,showManageAccount:!0,theme:"auto",...e},this.container=document.createElement("div"),this.container.className=`nostrpass-button-container ${e.className||""}`,e.expandOnHover&&this.container.setAttribute("data-expand-on-hover","true"),this.updateTheme(),this.injectStyles(),this.render(),e.appendTo){const i=typeof e.appendTo=="string"?document.querySelector(e.appendTo):e.appendTo;i&&i.appendChild(this.container)}this.setupEventListeners(),this.restoreSession().catch(i=>{console.warn("[NostrPassButton] Failed to restore session on init:",i)}),this.startAuthPolling()}setupEventListeners(){window.addEventListener("nostrpass:logout",()=>{console.log("[NostrPassButton] 🚪 Logout event received from window"),this.handleLogoutEvent()});try{new BroadcastChannel("nostrpass-logout").addEventListener("message",e=>{var i;((i=e.data)==null?void 0:i.type)==="LOGOUT"&&(console.log("[NostrPassButton] 🚪 Logout event received from BroadcastChannel"),this.handleLogoutEvent())})}catch(t){console.warn("[NostrPassButton] BroadcastChannel not supported:",t)}window.addEventListener("storage",t=>{t.key==="nostrpass_session"&&t.newValue===null&&(console.log("[NostrPassButton] 🚪 Session cleared in another tab - logging out"),this.handleLogoutEvent())}),window.addEventListener("account-picker-selected",t=>{const e=t;console.log("[NostrPassButton] 🔄 Account picker selected event received",e.detail),this.handleAccountPickerSelection(e.detail)}),window.addEventListener("vault-data-refresh",async t=>{if(console.log("[NostrPassButton] 🔄 Vault data refresh event received:",t),this.currentUser){console.log("[NostrPassButton] Current user exists, fetching updated identities..."),await new Promise(e=>setTimeout(e,100));try{const e=await this.embassy.getAllIdentities();console.log("[NostrPassButton] getAllIdentities response:",e);const i=(e==null?void 0:e.identities)||[],s=e==null?void 0:e.activeIdentityIndex;if(i.length===0){console.log("[NostrPassButton] No identities returned - user logged out"),this.currentUser=null,this.clearSession();return}if(console.log("[NostrPassButton] Active identity index from vault:",s),console.log("[NostrPassButton] Current session identity index:",this.currentUser.identityIndex),s!==void 0&&s!==this.currentUser.identityIndex){console.log("[NostrPassButton] 🔄 Active identity changed from",this.currentUser.identityIndex,"to",s);const r=i.find(p=>p.index===s);if(r){console.log("[NostrPassButton] Switching to new active identity:",r.nickname),this.currentUser={identityIndex:r.index,publicKey:r.publicKey,nickname:r.nickname,authorized:r.isAuthorized,npub:r.npub},this.saveSession(this.currentUser),this.config.onLogin&&this.config.onLogin(this.currentUser),console.log("[NostrPassButton] Re-rendering button with new active identity..."),await this.render(),console.log("[NostrPassButton] ✅ Button updated to new active identity");return}}const a=i.find(r=>r.index===this.currentUser.identityIndex);if(console.log("[NostrPassButton] Current identity:",a),console.log("[NostrPassButton] All identities count:",i.length),a){const r=this.currentUser.authorized;this.currentUser.nickname=a.nickname,this.currentUser.authorized=a.isAuthorized,this.currentUser.npub=a.npub,console.log("[NostrPassButton] Authorization status changed:",{before:r,after:a.isAuthorized}),this.saveSession(this.currentUser),console.log("[NostrPassButton] Re-rendering button..."),await this.render(),console.log("[NostrPassButton] ✅ Button updated after vault data refresh")}else{console.warn("[NostrPassButton] Current identity not found in authorized list - marking as unauthorized");const r=this.currentUser.authorized;this.currentUser.authorized=!1,console.log("[NostrPassButton] Identity disconnected:",{before:r,after:!1}),this.saveSession(this.currentUser),console.log("[NostrPassButton] Re-rendering button for disconnected state..."),await this.render(),console.log("[NostrPassButton] ✅ Button updated - showing unauthorized state")}}catch(e){console.error("[NostrPassButton] ❌ Failed to refresh identity status:",e)}}else{console.log("[NostrPassButton] No current user - checking if user just logged in...");try{await this.restoreSession()&&console.log("[NostrPassButton] ✅ Session restored after login")}catch(e){console.error("[NostrPassButton] ❌ Failed to restore session:",e)}}})}updateTheme(){if(this.config.theme==="auto"){const t=window.matchMedia("(prefers-color-scheme: dark)").matches;this.theme=t?"dark":"light",window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change",e=>{this.theme=e.matches?"dark":"light",this.container.setAttribute("data-theme",this.theme)})}else this.theme=this.config.theme||"light";this.container.setAttribute("data-theme",this.theme)}injectStyles(){if(document.getElementById("nostrpass-button-styles"))return;const t=document.createElement("style");t.id="nostrpass-button-styles",t.textContent=`
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
        background: linear-gradient(135deg, #424242 0%, #6d6e71 100%);
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

      /* Icon-only mode: perfect circle */
      .nostrpass-button-container[data-expand-on-hover="true"] .nostrpass-user-btn {
        /* width: 48px; */
        /* height: 48px; */
        padding: 3px;
        border-radius: 50%;
      }

      .nostrpass-button-container[data-expand-on-hover="true"] .nostrpass-user-btn-text {
        display: none;
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

      .nostrpass-lock-toggle-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
      }

      .nostrpass-lock-icons {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 44px;
        gap: 8px;
      }

      .nostrpass-lock-icon,
      .nostrpass-unlock-icon {
        color: #6b7280;
        flex-shrink: 0;
      }

      [data-theme="dark"] .nostrpass-lock-icon,
      [data-theme="dark"] .nostrpass-unlock-icon {
        color: #9ca3af;
      }

      .nostrpass-lock-toggle-btn {
        padding: 4px;
        border: none;
        background: transparent;
        cursor: pointer;
        border-radius: 6px;
        transition: all 0.15s ease;
        display: flex;
        align-items: center;
      }

      .nostrpass-lock-slider {
        position: relative;
        display: inline-block;
        width: 36px;
        height: 20px;
        border-radius: 10px;
        transition: all 0.3s ease;
      }

      .nostrpass-lock-slider.unlocked {
        background: #10b981;
      }

      .nostrpass-lock-slider.locked {
        background: #6b7280;
      }

      [data-theme="dark"] .nostrpass-lock-slider.unlocked {
        background: #10b981;
      }

      [data-theme="dark"] .nostrpass-lock-slider.locked {
        background: #9ca3af;
      }

      .nostrpass-lock-slider-thumb {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 16px;
        height: 16px;
        background: white;
        border-radius: 50%;
        transition: transform 0.3s ease;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
      }

      .nostrpass-lock-slider.unlocked .nostrpass-lock-slider-thumb {
        transform: translateX(16px);
      }

      .nostrpass-lock-slider.locked .nostrpass-lock-slider-thumb {
        transform: translateX(0);
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
    `,document.head.appendChild(t)}async render(){this.isCheckingAuth?this.renderLoadingButton():this.currentUser?await this.renderUserButton():this.renderSignInButton()}renderLoadingButton(){this.container.innerHTML=`
      <div class="nostrpass-loading-skeleton"></div>
    `}renderSignInButton(){this.container.innerHTML=`
      <button class="nostrpass-btn-base nostrpass-signin-btn" data-action="signin">
        <div class="nostrpass-signin-logo">🥚</div>
        <span>NostrPass</span>
      </button>
    `,this.container.querySelector('[data-action="signin"]').addEventListener("click",()=>this.handleSignIn())}async renderUserButton(){const t=this.currentUser,e=this.getUserInitials(t),i=t.nickname||`Identity ${t.identityIndex+1}`,s=i.charAt(0).toUpperCase()+i.slice(1);let a="",r=[];try{const u=await this.embassy.getAuthStatus();a=(u==null?void 0:u.username)||""}catch(u){console.warn("Failed to fetch auth status:",u)}try{const u=await this.embassy.getAllIdentities();r=(u==null?void 0:u.identities)||[],this.allIdentities=r,console.log("[NostrPassButton] getAllIdentities response:",{response:u,allIdentities:r})}catch(u){console.warn("Failed to fetch all identities:",u)}const p=r.filter(u=>u.isAuthorized);console.log("[NostrPassButton] Authorized identities:",{authorizedIdentities:p,total:r.length});const h=t.authorized||p.length>0;let n="";p.length>1&&(n=`
        <div class="nostrpass-dropdown-divider"></div>
        <div class="nostrpass-dropdown-section">
          <div style="padding: 8px 12px; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase;">
            Switch Identity
          </div>
          ${p.length>4?'<input type="text" class="nostrpass-identity-search" placeholder="Search identities..." data-search-identities />':""}
          <div class="nostrpass-identity-list" data-identity-container>
            ${p.map(f=>{const v=f.index===t.identityIndex,E=f.nickname?this.getInitialsFromName(f.nickname):`I${f.index+1}`,x=f.nickname||`Identity ${f.index+1}`,S=x.charAt(0).toUpperCase()+x.slice(1);return`
                <button class="nostrpass-dropdown-item nostrpass-identity-item ${v?"nostrpass-identity-active":""}" data-action="switch-identity" data-identity-index="${f.index}" data-identity-name="${S.toLowerCase()}" data-identity-npub="${f.npub||""}">
                  <div class="nostrpass-identity-avatar">
                    ${E}
                  </div>
                  <div class="nostrpass-identity-info">
                    <div class="nostrpass-identity-name">
                      ${S}
                    </div>
                    ${f.npub?`<div class="nostrpass-identity-npub">${f.npub.slice(0,12)}...</div>`:""}
                  </div>
                  ${v?'<svg class="nostrpass-identity-check" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13.333 4L6 11.333 2.667 8" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>':""}
                </button>
              `}).join("")}
          </div>
        </div>
      `),this.container.innerHTML=`
      <div class="nostrpass-user-menu">
        <button class="nostrpass-btn-base nostrpass-user-btn ${h?"":"nostrpass-user-btn-warning"}" data-action="toggle-menu">
          ${t.avatar?`<img src="${t.avatar}" alt="${s}" class="nostrpass-user-avatar" />`:`<div class="nostrpass-user-initials">${e}</div>`}
          <span class="nostrpass-user-btn-text">${h?s:"Not authorized"}</span>
        </button>
        <div class="nostrpass-dropdown" data-dropdown>
          ${h?"":`
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
              ${t.avatar?`<img src="${t.avatar}" alt="${s}" class="nostrpass-dropdown-avatar" />`:`<div class="nostrpass-dropdown-initials">${e}</div>`}
              <div class="nostrpass-dropdown-user-details">
                <div class="nostrpass-dropdown-name">${s}</div>
                ${a?`<div class="nostrpass-dropdown-username">${a}</div>`:t.npub?`<div class="nostrpass-dropdown-npub">${t.npub.slice(0,16)}...</div>`:""}
              </div>
              ${h?`
              <div class="nostrpass-lock-toggle-container">
                <button
                  data-action="toggle-lock"
                  data-is-locked="false"
                  class="nostrpass-lock-toggle-btn"
                  title="Lock vault"
                >
                  <span class="nostrpass-lock-slider unlocked">
                    <span class="nostrpass-lock-slider-thumb"></span>
                  </span>
                </button>
                <div class="nostrpass-lock-icons">
                  <svg class="nostrpass-lock-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                  <svg class="nostrpass-unlock-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
                  </svg>
                </div>
              </div>
              `:""}
            </div>
          </div>
          ${n}
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
              <span>Sign out of NostrPass</span>
            </button>
          </div>
          <div class="nostrpass-dropdown-footer">
            <span class="nostrpass-footer-text">Secured by</span>
            <a href="https://nostrpass.com" target="_blank" class="nostrpass-footer-logo">NostrPass</a>
          </div>
        </div>
      </div>
    `,this.container.querySelector('[data-action="toggle-menu"]').addEventListener("click",u=>{u.stopPropagation(),h?this.toggleDropdown():this.handleNotAuthorizedClick()});const l=this.container.querySelector("[data-search-identities]");l&&l.addEventListener("input",u=>{const f=u.target.value.toLowerCase();this.container.querySelectorAll('[data-action="switch-identity"]').forEach(E=>{const x=E.getAttribute("data-identity-name")||"",S=E.getAttribute("data-identity-npub")||"",b=x.includes(f)||S.toLowerCase().includes(f);E.style.display=b?"":"none"})}),this.container.querySelectorAll('[data-action="switch-identity"]').forEach(u=>{u.addEventListener("click",f=>{const v=parseInt(f.currentTarget.getAttribute("data-identity-index")||"0");v===t.identityIndex||this.handleSwitchIdentity(v)})});const m=this.container.querySelector('[data-action="toggle-lock"]');m==null||m.addEventListener("click",()=>{this.handleToggleLock()});const g=this.container.querySelector('[data-action="manage-account"]');g==null||g.addEventListener("click",()=>{this.closeDropdown(),this.handleManageAccount()});const P=this.container.querySelector('[data-action="sign-out"]');P==null||P.addEventListener("click",()=>{this.closeDropdown(),this.handleSignOut()})}getInitialsFromName(t){const e=t.split(" ");return e.length>=2?`${e[0][0]}${e[1][0]}`:t.slice(0,2)}async handleSwitchIdentity(t){var s,a,r,p,h;this.closeDropdown();const e=this.allIdentities.find(n=>n.index===t),i=(e==null?void 0:e.isAuthorized)||!1;if(console.log("[NostrPassButton] handleSwitchIdentity:",{identityIndex:t,isAuthorized:i,selectedIdentity:e}),!i){console.log("[NostrPassButton] Identity not authorized, opening account picker for authorization");try{await this.embassy.manageAccount({forcePrompt:!0,buttonElement:this.container.querySelector('[data-action="toggle-menu"]')})}catch(n){console.error("Failed to open account picker:",n)}return}try{const n=await this.embassy.switchIdentity(t);n!=null&&n.success&&(n!=null&&n.identity)&&(this.currentUser={identityIndex:n.identityIndex,publicKey:n.identity.publicKey,npub:n.identity.npub,nickname:n.identity.nickname,authorized:n.identity.authorized||!1},this.saveSession(this.currentUser),await this.render(),this.config.onLogin&&this.config.onLogin(this.currentUser))}catch(n){if(console.error("Failed to switch identity:",n),(s=n==null?void 0:n.message)!=null&&s.includes("not authorized"))try{const o=await this.embassy.manageAccount({forcePrompt:!0,buttonElement:this.container.querySelector('[data-action="toggle-menu"]')});o!=null&&o.identity&&(this.currentUser={identityIndex:o.identityIndex,publicKey:o.identity.publicKey,npub:o.identity.npub,nickname:o.identity.nickname,authorized:o.identity.authorized||!1},this.saveSession(this.currentUser),await this.render(),this.config.onLogin&&this.config.onLogin(this.currentUser))}catch(o){console.error("Failed to authorize identity:",o),(r=(a=this.config).onError)==null||r.call(a,o)}else(h=(p=this.config).onError)==null||h.call(p,n)}}getUserInitials(t){if(t.nickname){const e=t.nickname.split(" ");return e.length>=2?`${e[0][0]}${e[1][0]}`:t.nickname.slice(0,2)}return`I${t.identityIndex+1}`}async handleSignIn(){var i,s,a,r,p,h,n,o;const t=this.container.querySelector('[data-action="signin"]');if(!t)return;const e=t.innerHTML;t.disabled=!0,t.innerHTML='<span class="nostrpass-loading"></span> <span>Signing in...</span>';try{this.embassy.openPage("login",{buttonElement:t});const l=await this.embassy.manageAccount({forcePrompt:!0,buttonElement:t});this.currentUser={identityIndex:l.identityIndex,publicKey:((i=l.identity)==null?void 0:i.publicKey)||"",npub:(s=l.identity)==null?void 0:s.npub,nickname:(a=l.identity)==null?void 0:a.nickname,authorized:((r=l.identity)==null?void 0:r.authorized)||!1},this.saveSession(this.currentUser),this.render(),(h=(p=this.config).onSignIn)==null||h.call(p,this.currentUser)}catch(l){console.error("NostrPass sign in failed:",l);const c=l instanceof Error?l.message:String(l);if(c.toLowerCase().includes("locked")||c.toLowerCase().includes("unlock")){console.log("[NostrPassButton] Vault locked - waiting for unlock...");const m=async()=>{var g,P;console.log("[NostrPassButton] Vault unlocked, checking auth status...");try{const u=await this.embassy.getAuthStatus();u!=null&&u.isAuthenticated&&(u!=null&&u.user)&&(this.currentUser={identityIndex:u.user.identityIndex||0,publicKey:u.user.publicKey||"",npub:u.user.npub,nickname:u.user.nickname,authorized:u.user.authorized||!1},this.saveSession(this.currentUser),this.render(),(P=(g=this.config).onSignIn)==null||P.call(g,this.currentUser)),window.removeEventListener("nostrpass:unlocked",m)}catch(u){console.error("[NostrPassButton] Failed to get auth status after unlock:",u),t.disabled=!1,t.innerHTML=e}};window.addEventListener("nostrpass:unlocked",m);return}t.disabled=!1,t.innerHTML=e,(o=(n=this.config).onError)==null||o.call(n,l)}}async toggleDropdown(){try{const e=await this.embassy.getAuthStatus();if(e!=null&&e.isLocked){console.log("[NostrPassButton] Vault locked, showing unlock page...");const i=this.container.querySelector('[data-action="toggle-menu"]');this.embassy.openPage("unlock",{buttonElement:i});const s=()=>{console.log("[NostrPassButton] Vault unlocked, hiding modal and showing dropdown..."),window.removeEventListener("nostrpass:unlocked",s),this.embassy.hide();const a=this.container.querySelector('[data-action="toggle-lock"]'),r=a==null?void 0:a.querySelector(".nostrpass-lock-slider");r&&(r.classList.remove("locked"),r.classList.add("unlocked"),a.setAttribute("data-is-locked","false"),a.title="Lock vault"),setTimeout(()=>{this.openDropdown()},100)};window.addEventListener("nostrpass:unlocked",s);return}}catch(e){console.error("[NostrPassButton] Failed to check vault status:",e)}this.container.querySelector("[data-dropdown]")&&(this.isDropdownOpen?this.closeDropdown():this.openDropdown())}openDropdown(){const t=this.container.querySelector("[data-dropdown]"),e=this.container.querySelector(".nostrpass-user-btn");t&&(this.isDropdownOpen=!0,t.classList.add("open"),e&&e.classList.add("active"),setTimeout(()=>{this.outsideClickHandler=i=>{const s=i.target;this.container.contains(s)||this.closeDropdown()},document.addEventListener("click",this.outsideClickHandler)},0))}closeDropdown(){const t=this.container.querySelector("[data-dropdown]"),e=this.container.querySelector(".nostrpass-user-btn");t&&(this.isDropdownOpen=!1,t.classList.remove("open"),e&&e.classList.remove("active"),this.removeOutsideClickListener())}removeOutsideClickListener(){this.outsideClickHandler&&(document.removeEventListener("click",this.outsideClickHandler),this.outsideClickHandler=null)}async handleNotAuthorizedClick(){var t,e;try{const i=this.container.querySelector('[data-action="toggle-menu"]'),s=window.location.origin,a=document.title,r=`account-picker-${Date.now()}-${Math.random().toString(36).slice(2)}`,p=async c=>{const m=c;if(m.detail.requestId===r){n(),this.embassy.hide();try{const g=await this.embassy.getAllIdentities(),u=((g==null?void 0:g.identities)||[]).find(f=>f.index===m.detail.identityIndex);u&&(this.currentUser={identityIndex:u.index,publicKey:u.publicKey,npub:u.npub,nickname:u.nickname,authorized:u.isAuthorized||!1},this.saveSession(this.currentUser),await this.render())}catch(g){console.error("Failed to update button after account selection:",g)}}},h=c=>{c.detail.requestId===r&&(n(),this.embassy.hide())},n=()=>{window.removeEventListener("account-picker-selected",p),window.removeEventListener("account-picker-rejected",h)};window.addEventListener("account-picker-selected",p),window.addEventListener("account-picker-rejected",h);const o=await this.embassy.getAuthStatus(),l=this.embassy.config.permissions?JSON.stringify(this.embassy.config.permissions):void 0;if(o!=null&&o.isLocked){console.log("[NostrPassButton] Vault locked, using smart unlock with account-picker continuation...");const c={next:"account-picker",appOrigin:s,appName:a,requestId:r};l&&(c.permissions=l),this.embassy.openPage("unlock",{size:"thin",buttonElement:i,queryParams:c})}else{console.log("[NostrPassButton] Vault unlocked, showing account picker...");const c={appOrigin:s,appName:a,requestId:r};l&&(c.permissions=l),this.embassy.openPage("account",{buttonElement:i,queryParams:c})}}catch(i){console.error("Failed to authorize identity:",i),(e=(t=this.config).onError)==null||e.call(t,i)}}async handleManageAccount(){var t,e;try{this.embassy.openPage("dashboard")}catch(i){console.error("Failed to open vault:",i),(e=(t=this.config).onError)==null||e.call(t,i)}}async handleToggleLock(){try{console.log("[NostrPassButton] Locking vault...");const t=this.container.querySelector('[data-action="toggle-lock"]'),e=t==null?void 0:t.querySelector(".nostrpass-lock-slider");e&&(e.classList.remove("unlocked"),e.classList.add("locked"),t.setAttribute("data-is-locked","true"),t.title="Vault locked"),this.closeDropdown();try{await this.embassy.messenger.request("LOCK_VAULT",{}),console.log("[NostrPassButton] Vault locked successfully"),await new Promise(i=>setTimeout(i,100))}catch(i){console.error("[NostrPassButton] Failed to send lock message:",i)}}catch(t){console.error("[NostrPassButton] Failed to lock vault:",t)}}handleLogoutEvent(){var t,e,i,s;console.log("[NostrPassButton] Handling logout event"),this.currentUser=null,this.clearSession(),this.render(),(e=(t=this.config).onSignOut)==null||e.call(t),(s=(i=this.config).onLogout)==null||s.call(i)}async handleAccountPickerSelection(t){if(console.log("[NostrPassButton] Handling account picker selection:",t),!(t!=null&&t.identity)){console.warn("[NostrPassButton] No identity data in account picker selection");return}this.currentUser={identityIndex:t.identityIndex??0,publicKey:t.identity.publicKey,npub:t.identity.npub,nickname:t.identity.nickname,authorized:t.identity.authorized??!1,avatar:t.identity.avatar},this.saveSession(this.currentUser),await this.render(),this.config.onLogin&&this.config.onLogin(this.currentUser),console.log("[NostrPassButton] Button updated with new identity:",this.currentUser)}async handleSignOut(){if(confirm(`Sign out of NostrPass?

This will log you out across all apps and browser tabs. You'll need to sign in again to use NostrPass.`)){try{console.log("[NostrPassButton] Calling embassy.logout() - full NostrPass logout"),await this.embassy.logout(),console.log("[NostrPassButton] Embassy logout successful");try{const e=new BroadcastChannel("nostrpass-logout");e.postMessage({type:"LOGOUT"}),e.close(),console.log("[NostrPassButton] Logout broadcasted to all tabs")}catch(e){console.warn("[NostrPassButton] Failed to broadcast logout:",e)}}catch(e){console.error("[NostrPassButton] Embassy logout failed:",e)}this.handleLogoutEvent()}}saveSession(t){try{localStorage.setItem("nostrpass_session",JSON.stringify(t))}catch(e){console.warn("Failed to save NostrPass session:",e)}}clearSession(){try{localStorage.removeItem("nostrpass_session"),this.currentUser=null,this.isCheckingAuth=!1,this.render()}catch(t){console.warn("Failed to clear NostrPass session:",t)}}async restoreSession(){console.log("[NostrPassButton] restoreSession called"),this.isCheckingAuth=!0,this.render();try{console.log("[NostrPassButton] Waiting for vault ready..."),await this.embassy.waitForReady(),console.log("[NostrPassButton] Vault is ready");try{console.log("[NostrPassButton] Checking auth status...");const t=await this.embassy.getAuthStatus();return console.log("[NostrPassButton] Auth status response:",t),t!=null&&t.isAuthenticated&&(t!=null&&t.user)?(console.log("[NostrPassButton] User is authenticated, showing user button"),this.currentUser={identityIndex:t.user.identityIndex||0,publicKey:t.user.publicKey||"",npub:t.user.npub,nickname:t.user.nickname,authorized:t.user.authorized||!1},this.isCheckingAuth=!1,this.saveSession(this.currentUser),this.render(),this.config.onLogin&&this.config.onLogin(this.currentUser),!0):(console.log("[NostrPassButton] Not authenticated - clearing stale session"),this.isCheckingAuth=!1,this.clearSession(),!1)}catch(t){return console.log("[NostrPassButton] Could not get auth status:",t),this.isCheckingAuth=!1,this.clearSession(),!1}}catch(t){return console.warn("[NostrPassButton] Failed to restore NostrPass session:",t),this.isCheckingAuth=!1,this.render(),!1}}startAuthPolling(){this.authPollingInterval=window.setInterval(async()=>{if(this.currentUser)try{const t=await this.embassy.getAuthStatus();t!=null&&t.isAuthenticated||(console.log("[NostrPassButton] 🚨 Auth polling detected session lost - logging out"),this.handleLogoutEvent())}catch(t){console.warn("[NostrPassButton] Auth polling failed:",t)}},3e4)}stopAuthPolling(){this.authPollingInterval!==null&&(window.clearInterval(this.authPollingInterval),this.authPollingInterval=null)}getUser(){return this.currentUser}getElement(){return this.container}destroy(){this.stopAuthPolling(),this.container.remove()}}const q={login:{route:"",defaultSize:"minimal"},unlock:{route:"/unlock-modal",defaultSize:"thin",autoCloseOnSuccess:!0},dashboard:{route:"/dashboard",defaultSize:"full"},account:{route:"/account-picker",defaultSize:"tall",autoCloseOnSuccess:!0},permission:{route:"/permission-request",defaultSize:"tall",autoCloseOnSuccess:!0}};class D{constructor(t={}){w(this,"config");w(this,"iframe",null);w(this,"_isReady",!1);w(this,"styleElement",null);w(this,"backdropEl",null);w(this,"messenger",null);w(this,"handlers",[]);w(this,"isPromptOpen",!1);w(this,"unlockResolvers",[]);w(this,"permissionResolvers",[]);w(this,"authResolvers",[]);w(this,"outsideClickHandler",null);const e=window.location.host;this.config={appName:t.appName||document.title||"Unknown App",appDomain:e,permissions:t.permissions,vaultUrl:t.vaultUrl||"https://vault.nostrpass.com",trustedOrigins:t.trustedOrigins,theme:t.theme||"auto",debug:t.debug||!1,parentPinOverlay:t.parentPinOverlay??!1},this.config.debug||typeof localStorage<"u"&&localStorage.getItem("nostrpass:debug")==="true"||(console.log=()=>{},console.info=()=>{}),this.handlers=Object.keys(T(this)),this.config.debug&&console.log("🚀 NostrPass Embassy initialized",this.config),this.injectStyles(),window.addEventListener("permission-granted",()=>{console.log("✅ [Embassy] Permission granted event received, notifying resolvers"),this.notifyPermissionGranted()}),document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>this.createIframe()):this.createIframe()}sleep(t){return new Promise(e=>setTimeout(e,t))}waitForUnlock(){return new Promise(t=>{this.unlockResolvers.push(t),setTimeout(()=>{const e=this.unlockResolvers.indexOf(t);e>-1&&(this.unlockResolvers.splice(e,1),t())},6e4)})}waitForPermission(){return new Promise(t=>{this.permissionResolvers.push(t),setTimeout(()=>{const e=this.permissionResolvers.indexOf(t);e>-1&&(this.permissionResolvers.splice(e,1),t())},6e4)})}waitForAuth(){return new Promise(t=>{this.authResolvers.push(t),setTimeout(()=>{const e=this.authResolvers.indexOf(t);e>-1&&(this.authResolvers.splice(e,1),t())},3e5)})}notifyUnlocked(){for(console.log("🔓 Notifying unlock resolvers:",this.unlockResolvers.length);this.unlockResolvers.length>0;){const t=this.unlockResolvers.shift();t&&t()}}notifyPermissionGranted(){for(console.log("✅ Notifying permission resolvers:",this.permissionResolvers.length);this.permissionResolvers.length>0;){const t=this.permissionResolvers.shift();t&&t()}}notifyAuthenticated(){for(console.log("🔐 Notifying auth resolvers:",this.authResolvers.length);this.authResolvers.length>0;){const t=this.authResolvers.shift();t&&t()}}promptPin(){return new Promise(t=>{var S;if(this.isPromptOpen)return t(!1);this.isPromptOpen=!0;const e=b=>b.sort(()=>Math.random()-.5);(S=document.getElementById("np-pin-overlay"))==null||S.remove();const i=document.createElement("div");i.id="np-pin-overlay",Object.assign(i.style,{position:"fixed",inset:"0",background:"rgba(0,0,0,0.5)",zIndex:"2147483647",display:"flex",alignItems:"center",justifyContent:"center"});const s=document.createElement("div");Object.assign(s.style,{padding:"16px",borderRadius:"8px",width:"320px",maxWidth:"90vw",fontFamily:"system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"});const a=document.createElement("h3");a.textContent="Unlock Vault",Object.assign(a.style,{margin:"0 0 8px",fontSize:"16px"});const r=document.createElement("p");r.textContent="Enter your PIN to continue.",Object.assign(r.style,{margin:"0 0 12px",color:"#555",fontSize:"13px"});const p=document.createElement("div");Object.assign(p.style,{display:"flex",justifyContent:"center",gap:"12px",marginBottom:"12px"});const h=b=>{p.innerHTML="";for(let N=0;N<6;N++){const A=document.createElement("div");A.style.width="12px",A.style.height="12px",A.style.borderRadius="9999px",A.style.border="2px solid "+(N<b?"#111":"#d1d5db"),p.appendChild(A)}},n=document.createElement("div");Object.assign(n.style,{display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:"10px",width:"240px",margin:"0 auto"});const o=b=>{const N=document.createElement("button");return N.textContent=b,Object.assign(N.style,{width:"76px",height:"56px",border:"1px solid #d1d5db",borderRadius:"8px",fontWeight:"600",cursor:"pointer"}),N},l=b=>{const N=document.createElement("button");return N.textContent=b,Object.assign(N.style,{height:"44px",border:"1px solid #d1d5db",borderRadius:"8px",background:"#fff",cursor:"pointer"}),N};let c="";const m=e(["1","2","3","4","5","6","7","8","9","0"]),g=()=>{this.isPromptOpen=!1,i.remove()},P=async()=>{try{const b=await this.messenger.request("UNLOCK_WITH_PIN",{pin:c});if(b!=null&&b.success)g(),t(!0);else{for(c="",h(0);n.firstChild;)n.removeChild(n.firstChild);e(m),v()}}catch{c="",h(0)}},u=b=>{c.length>=6||(c+=b,h(c.length),c.length===6&&P())},f=()=>{c&&(c=c.slice(0,-1),h(c.length))},v=()=>{m.forEach(A=>{const z=o(A);z.addEventListener("click",()=>u(A)),n.appendChild(z)});const b=l("← Delete");b.style.gridColumn="span 2",b.addEventListener("click",f),n.appendChild(b);const N=document.createElement("div");n.appendChild(N)},E=document.createElement("div");Object.assign(E.style,{display:"flex",gap:"8px",marginTop:"12px",justifyContent:"flex-end"});const x=l("Cancel");x.addEventListener("click",()=>{g(),t(!1)}),E.appendChild(x),s.appendChild(a),s.appendChild(r),s.appendChild(p),h(0),v(),s.appendChild(n),s.appendChild(E),i.appendChild(s),document.body.appendChild(i)})}requestPinUnlock(){return this.promptPin()}async createIframe(){if(this.iframe){this.config.debug&&console.log("Iframe already exists");return}return new Promise((t,e)=>{this.iframe=document.createElement("iframe"),this.iframe.id="nostrpass-vault-iframe";const i=new URL(this.config.vaultUrl+"/"+U(this.config.appDomain));i.searchParams.set("appName",this.config.appName),i.searchParams.set("appDomain",this.config.appDomain),i.searchParams.set("theme",this.config.theme),this.config.environment&&i.searchParams.set("environment",this.config.environment),this.config.namespace&&i.searchParams.set("namespace",this.config.namespace),this.iframe.src=i.toString(),console.log("[Embassy] Creating iframe with:",{appDomain:this.config.appDomain,sanitized:U(this.config.appDomain),iframeSrc:i.toString()}),this.iframe.setAttribute("sandbox","allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"),this.iframe.setAttribute("allow","publickey-credentials-create; publickey-credentials-get; clipboard-write"),this.iframe.setAttribute("aria-hidden","true"),this.iframe.setAttribute("tabindex","-1"),this.iframe.setAttribute("title","NostrPass Vault"),this.iframe.className="nostrpass-iframe nostrpass-iframe-hidden",this.iframe.style.background="transparent",this.iframe.style.backgroundColor="transparent",this.iframe.setAttribute("allowtransparency","true"),this.config.debug&&new URLSearchParams(window.location.search).has("embassy-debug")&&(this.iframe.classList.add("nostrpass-iframe-debug"),this.iframe.classList.remove("nostrpass-iframe-hidden")),this.initializeMessenger(),this.iframe.onload=()=>{this.config.debug&&console.log("Iframe loaded successfully"),setTimeout(()=>{this.config.debug&&console.log("Iframe initialization period complete"),t()},100)},this.iframe.onerror=()=>{console.error("Failed to load NostrPass vault"),e(new Error("Failed to load vault iframe"))},this.backdropEl||(this.backdropEl=document.createElement("div"),this.backdropEl.className="nostrpass-backdrop",this.backdropEl.addEventListener("click",s=>{console.log("🎯 Backdrop clicked"),s.stopPropagation(),this.hide()})),document.body.appendChild(this.backdropEl),document.body.appendChild(this.iframe),this.config.debug&&console.log("Iframe created and added to DOM")})}openPage(t,e){if(!this.iframe){console.warn("Cannot show iframe - not created yet"),this.createIframe().then(()=>this.openPage(t,e));return}const i=q[t],s=(e==null?void 0:e.size)||i.defaultSize,a=e==null?void 0:e.buttonElement,r=(e==null?void 0:e.queryParams)||{},p=U(this.config.appDomain),h=i.route?`/${p}${i.route}`:`/${p}`,n=Object.keys(r).length>0?"?"+new URLSearchParams(r).toString():"",o=h+n,l=new URL(this.iframe.src);if(l.pathname+l.search!==o&&this.messenger&&this.messenger.request(k.NAVIGATE,{path:o}).then(()=>{console.log("🔄 Navigated vault to:",t,"at path",o)}).catch(m=>{console.error("Navigation failed, falling back to iframe reload:",m);const g=new URL(this.config.vaultUrl);g.pathname=h,g.searchParams.set("appName",this.config.appName),g.searchParams.set("appDomain",this.config.appDomain),g.searchParams.set("theme",this.config.theme),this.config.environment&&g.searchParams.set("environment",this.config.environment),this.config.namespace&&g.searchParams.set("namespace",this.config.namespace),Object.keys(r).forEach(P=>{g.searchParams.set(P,r[P])}),this.iframe&&(this.iframe.src=g.toString(),console.log("🔄 Opening vault page (fallback):",t,"at",g.toString()))}),this.iframe.classList.remove("nostrpass-iframe-hidden"),this.iframe.classList.remove("nostrpass-iframe-visible"),this.iframe.classList.remove("nostrpass-iframe-compact"),this.iframe.classList.remove("nostrpass-iframe-tall"),this.iframe.classList.remove("nostrpass-iframe-minimal"),this.iframe.classList.remove("nostrpass-iframe-thin"),this.iframe.style.top="",this.iframe.style.left="",this.iframe.style.transform="",s==="minimal")this.iframe.classList.add("nostrpass-iframe-minimal");else if(s==="compact"||s==="tall"||s==="thin")if(this.iframe.classList.add(s==="tall"?"nostrpass-iframe-tall":s==="thin"?"nostrpass-iframe-thin":"nostrpass-iframe-compact"),a){const m=a.getBoundingClientRect(),g=window.innerHeight-m.bottom,P=m.top,u=s==="thin"?228:395,f=s==="tall"?600:s==="thin"?422:395,v=8;let E,x;if(g>=f+v)E=m.bottom+v;else if(P>=f+v)E=m.top-f-v;else{this.iframe.style.top="50%",this.iframe.style.left="50%",this.iframe.style.transform="translate(-50%, -50%)";return}m.left+m.width/2>window.innerWidth/2?x=m.right-u:x=m.left,x+u>window.innerWidth-v&&(x=window.innerWidth-u-v),x<v&&(x=v),this.iframe.style.top=`${E}px`,this.iframe.style.left=`${x}px`,this.iframe.style.transform="none"}else this.iframe.style.top="50%",this.iframe.style.left="50%",this.iframe.style.transform="translate(-50%, -50%)";else this.iframe.classList.add("nostrpass-iframe-visible");this.backdropEl&&(this.backdropEl.classList.add("visible"),this.backdropEl.style.background="transparent",this.backdropEl.style.backdropFilter="none"),(s==="compact"||s==="tall"||s==="thin")&&(this.outsideClickHandler&&document.removeEventListener("click",this.outsideClickHandler),setTimeout(()=>{this.outsideClickHandler=m=>{const g=m.target;this.iframe&&!this.iframe.contains(g)&&this.backdropEl&&this.backdropEl===g&&(console.log("🎯 Click outside iframe detected"),this.hide())},document.addEventListener("click",this.outsideClickHandler)},100)),this.iframe.setAttribute("aria-hidden","false"),this.iframe.removeAttribute("tabindex"),document.body.style.overflow="hidden"}show(t="vault",e="full",i){let s;t==="unlock"||t==="unlock-modal"?s="unlock":t==="dashboard"?s="dashboard":s="login",this.openPage(s,{size:e,buttonElement:i})}hide(){if(console.log("🔙 Embassy hide() method called"),!this.iframe){console.warn("Cannot hide iframe - not created yet");return}console.log("🔙 Hiding iframe, current classes:",this.iframe.className),this.iframe.classList.remove("nostrpass-iframe-visible"),this.iframe.classList.remove("nostrpass-iframe-compact"),this.iframe.classList.remove("nostrpass-iframe-tall"),this.iframe.classList.remove("nostrpass-iframe-minimal"),this.iframe.classList.remove("nostrpass-iframe-thin"),this.iframe.classList.add("nostrpass-iframe-hidden"),this.backdropEl&&this.backdropEl.classList.remove("visible"),this.outsideClickHandler&&(document.removeEventListener("click",this.outsideClickHandler),this.outsideClickHandler=null),this.iframe.setAttribute("aria-hidden","true"),this.iframe.setAttribute("tabindex","-1"),document.body.style.overflow="",console.log("🔙 Iframe hidden, new classes:",this.iframe.className),this.config.debug&&console.log("Iframe hidden")}injectStyles(){this.styleElement||(this.styleElement=document.createElement("style"),this.styleElement.id="nostrpass-embassy-styles",this.styleElement.textContent=`
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
    `,document.head.appendChild(this.styleElement),this.config.debug&&console.log("Styles injected"))}initializeMessenger(){if(!this.iframe)return;this.messenger=new C(window),this.messenger.sendMessage=e=>{var s;if(!((s=this.iframe)!=null&&s.contentWindow)){console.error("Iframe contentWindow not available");return}const i=new URL(this.iframe.src).origin;this.iframe.contentWindow.postMessage(e,i)};let t;if(this.config.trustedOrigins&&this.config.trustedOrigins.length>0?t=[...this.config.trustedOrigins]:t=["https://nostrpass.com","https://app.nostrpass.com","https://www.nostrpass.com"],this.config.vaultUrl)try{const e=new URL(this.config.vaultUrl).origin;t.includes(e)||t.push(e)}catch(e){console.warn("Failed to parse vaultUrl origin:",e)}(this.iframe.src.includes("localhost")||this.iframe.src.includes("127.0.0.1"))&&(t.includes("http://localhost:3001")||t.push("http://localhost:3001"),t.includes("http://127.0.0.1:3001")||t.push("http://127.0.0.1:3001")),this.messenger.init(t),this.setupMessageHandlers(),this.config.debug&&console.log("Messenger initialized with trusted origins:",t)}setupMessageHandlers(){if(!this.messenger)return;const t=T(this);console.log("Setting up message handlers:",this.handlers),this.handlers.forEach(e=>{console.log("Registering handler for:",e),this.messenger.on(e,t[e])}),this.config.debug&&console.log("Message handlers registered:",this.messenger.messageHandlers)}async getPublicKey(t){var e,i;(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());try{let s=t==null?void 0:t.identityIndex;if(s==null)try{const h=await this.getAuthStatus();s=((e=h==null?void 0:h.user)==null?void 0:e.identityIndex)??0}catch{s=0}let a=null,r=null;try{const h=await this.messenger.request(k.CHECK_PERMISSION,{action:"getPublicKey",identityIndex:s}),n=(h==null?void 0:h.isLocked)===!0,o=(h==null?void 0:h.needsPrompt)===!0;if(n&&this.config.parentPinOverlay){if(!await this.requestPinUnlock())throw new Error("User canceled PIN prompt")}else if(n&&!this.config.parentPinOverlay)console.log("⏳ Vault is locked, showing quick unlock..."),a=this.waitForUnlock(),this.openPage("unlock");else if(o&&!this.config.parentPinOverlay){console.log("⏳ Permission required, showing vault and waiting for approval..."),r=this.waitForPermission();const l=`${this.config.appDomain}-getPublicKey-${Date.now()}`,c=new URLSearchParams({appOrigin:this.config.appDomain||window.location.host,appName:this.config.appName||document.title,action:"getPublicKey",identityIndex:(s!==void 0?s:0).toString(),requestId:l});await this.messenger.send("NAVIGATE",{path:`/${((i=this.config.appDomain)==null?void 0:i.replace(/[:.]/g,"-"))||"vault"}/permission-request?${c.toString()}`}),this.iframe&&(this.iframe.classList.remove("nostrpass-iframe-hidden"),this.iframe.classList.remove("nostrpass-iframe-compact"),this.iframe.classList.remove("nostrpass-iframe-tall"),this.iframe.classList.remove("nostrpass-iframe-minimal"),this.iframe.classList.add("nostrpass-iframe-visible"),this.backdropEl&&(this.backdropEl.classList.add("visible"),this.backdropEl.style.background="transparent",this.backdropEl.style.backdropFilter="none"),this.iframe.setAttribute("aria-hidden","false"),this.iframe.removeAttribute("tabindex"),document.body.style.overflow="hidden")}}catch(h){String((h==null?void 0:h.message)||h).toLowerCase().includes("not authenticated")&&(console.log("⚠️ User not authenticated, showing full vault for login and waiting for auth..."),a=this.waitForAuth(),this.show("vault","full"))}a&&(console.log("⏳ Waiting for vault unlock..."),await a,console.log("✅ Vault unlocked, continuing operation")),r&&(console.log("⏳ Waiting for permission approval..."),await r,console.log("✅ Permission granted, continuing operation"));const p=await this.messenger.request(k.GET_PUBLIC_KEY,{appName:this.config.appName,appDomain:this.config.appDomain,identityIndex:s});return this.config.debug&&console.log("Public key received:",p),this.hide(),p.publicKey||p}catch(s){throw console.error("Failed to get public key:",s),s}}async signEvent(t,e){var i,s;(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());try{let a=e==null?void 0:e.identityIndex;if(a==null)try{const n=await this.getAuthStatus();a=((i=n==null?void 0:n.user)==null?void 0:i.identityIndex)??0}catch{a=0}let r=null,p=null;try{const n=await this.messenger.request(k.CHECK_PERMISSION,{action:"signEvent",eventKind:t==null?void 0:t.kind,identityIndex:a}),o=(n==null?void 0:n.isLocked)===!0,l=(n==null?void 0:n.needsPrompt)===!0;if(o&&this.config.parentPinOverlay){if(!await this.requestPinUnlock())throw new Error("User canceled PIN prompt")}else if(o&&!this.config.parentPinOverlay)console.log("⏳ Vault is locked, showing quick unlock..."),r=this.waitForUnlock(),this.openPage("unlock");else if(l&&!this.config.parentPinOverlay){console.log("⏳ Permission required, showing vault and waiting for approval..."),p=this.waitForPermission();const c=`${this.config.appDomain}-signEvent-${Date.now()}`,m=new URLSearchParams({appOrigin:this.config.appDomain||window.location.host,appName:this.config.appName||document.title,action:"signEvent",identityIndex:(a!==void 0?a:0).toString(),requestId:c,eventKind:((t==null?void 0:t.kind)||0).toString(),event:JSON.stringify(t)});await this.messenger.send("NAVIGATE",{path:`/${((s=this.config.appDomain)==null?void 0:s.replace(/[:.]/g,"-"))||"vault"}/permission-request?${m.toString()}`}),this.iframe&&(this.iframe.classList.remove("nostrpass-iframe-hidden"),this.iframe.classList.remove("nostrpass-iframe-compact"),this.iframe.classList.remove("nostrpass-iframe-tall"),this.iframe.classList.remove("nostrpass-iframe-minimal"),this.iframe.classList.add("nostrpass-iframe-visible"),this.backdropEl&&(this.backdropEl.classList.add("visible"),this.backdropEl.style.background="transparent",this.backdropEl.style.backdropFilter="none"),this.iframe.setAttribute("aria-hidden","false"),this.iframe.removeAttribute("tabindex"),document.body.style.overflow="hidden")}}catch(n){String((n==null?void 0:n.message)||n).toLowerCase().includes("not authenticated")&&(console.log("⚠️ User not authenticated, showing full vault for login"),this.show("vault","full"))}r&&(console.log("⏳ Waiting for vault unlock..."),await r,console.log("✅ Vault unlocked, continuing operation")),p&&(console.log("⏳ Waiting for permission approval..."),await p,console.log("✅ Permission granted, continuing operation"));const h=async()=>this.messenger.request(k.SIGN_EVENT,{event:t,appName:this.config.appName,appDomain:this.config.appDomain,identityIndex:a});try{const n=await h();return this.config.debug&&console.log("Signed event received:",n),this.hide(),n.signedEvent||n}catch(n){const o=String((n==null?void 0:n.message)||n);if(o.toLowerCase().includes("vault is locked")||o.toLowerCase().includes("rehydrated")){if(console.log("🔒 Vault locked or session needs keys, triggering unlock..."),this.config.parentPinOverlay){if(!await this.requestPinUnlock())throw new Error("User canceled PIN prompt")}else{const c=this.waitForUnlock();this.openPage("unlock"),await c}console.log("🔓 Vault unlocked, retrying operation...");const l=await h();return this.config.debug&&console.log("Signed event received (after unlock):",l),this.hide(),l.signedEvent||l}throw n}}catch(a){throw console.error("Failed to sign event:",a),a}}async getRelays(){return console.log("TODO: getRelays"),{}}async signData(t,e){var i,s;(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());try{let a=e==null?void 0:e.identityIndex;if(a==null)try{const n=await this.getAuthStatus();a=((i=n==null?void 0:n.user)==null?void 0:i.identityIndex)??0}catch{a=0}let r=null,p=null;try{console.log("🔍 [signData] Calling CHECK_PERMISSION preflight...");const n=await this.messenger.request(k.CHECK_PERMISSION,{action:"signData",identityIndex:a});console.log("🔍 [signData] CHECK_PERMISSION result:",n);const o=(n==null?void 0:n.isLocked)===!0,l=(n==null?void 0:n.needsPrompt)===!0;if(console.log("🔍 [signData] needsPin:",o,"needsPrompt:",l),o&&this.config.parentPinOverlay){if(!await this.requestPinUnlock())throw new Error("User canceled PIN prompt")}else if(o&&!this.config.parentPinOverlay)console.log("⏳ Vault is locked, showing quick unlock..."),r=this.waitForUnlock(),this.openPage("unlock");else if(l&&!this.config.parentPinOverlay){console.log("⏳ Permission required, showing vault and waiting for approval..."),p=this.waitForPermission();const c=`${this.config.appDomain}-signData-${Date.now()}`,m=new URLSearchParams({appOrigin:this.config.appDomain||window.location.host,appName:this.config.appName||document.title,action:"signData",identityIndex:(a!==void 0?a:0).toString(),requestId:c,data:t});console.log("📍 Navigating to permission-request page..."),await this.messenger.send("NAVIGATE",{path:`/${((s=this.config.appDomain)==null?void 0:s.replace(/[:.]/g,"-"))||"vault"}/permission-request?${m.toString()}`}),console.log("👁️ Making iframe visible for permission prompt..."),this.iframe?(console.log("👁️ Current iframe classes:",this.iframe.className),this.iframe.classList.remove("nostrpass-iframe-hidden"),this.iframe.classList.remove("nostrpass-iframe-compact"),this.iframe.classList.remove("nostrpass-iframe-tall"),this.iframe.classList.remove("nostrpass-iframe-minimal"),this.iframe.classList.add("nostrpass-iframe-visible"),console.log("👁️ New iframe classes:",this.iframe.className),this.backdropEl&&(this.backdropEl.classList.add("visible"),this.backdropEl.style.background="transparent",this.backdropEl.style.backdropFilter="none",console.log("👁️ Backdrop shown")),this.iframe.setAttribute("aria-hidden","false"),this.iframe.removeAttribute("tabindex"),document.body.style.overflow="hidden",console.log("👁️ Iframe should now be visible!")):console.error("❌ No iframe element found!")}}catch(n){console.error("❌ [signData] CHECK_PERMISSION preflight failed:",n),String((n==null?void 0:n.message)||n).toLowerCase().includes("not authenticated")&&(console.log("⚠️ User not authenticated, showing full vault for login"),this.show("vault","full"))}r&&(console.log("⏳ Waiting for vault unlock..."),await r,console.log("✅ Vault unlocked, continuing operation")),p&&(console.log("⏳ Waiting for permission approval..."),await p,console.log("✅ Permission granted, continuing operation"));const h=async()=>this.messenger.request(k.SIGN_DATA,{data:t,appName:this.config.appName,appDomain:this.config.appDomain,identityIndex:a});try{const n=await h(),o=(n==null?void 0:n.signature)??n;return this.config.debug&&console.log("Signed data received:",o),this.hide(),o}catch(n){const o=String((n==null?void 0:n.message)||n);if(o.toLowerCase().includes("locked")||o.toLowerCase().includes("unlock")||o.toLowerCase().includes("rehydrated")){await this.sleep(150);try{const l=await h();return this.hide(),(l==null?void 0:l.signature)??l}catch(l){if(String((l==null?void 0:l.message)||l).toLowerCase().includes("rehydrated")){await this.sleep(200);const m=await h();return this.hide(),(m==null?void 0:m.signature)??m}throw l}}throw n}}catch(a){throw console.error("Failed to sign data:",a),a}}async encrypt(t,e,i){var s,a;(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());try{let r=i==null?void 0:i.identityIndex;if(r==null)try{const o=await this.getAuthStatus();r=((s=o==null?void 0:o.user)==null?void 0:s.identityIndex)??0}catch{r=0}let p=null,h=null;try{const o=await this.messenger.request(k.CHECK_PERMISSION,{action:"nip04",identityIndex:r}),l=(o==null?void 0:o.isLocked)===!0,c=(o==null?void 0:o.needsPrompt)===!0;if(l&&this.config.parentPinOverlay){if(!await this.requestPinUnlock())throw new Error("User canceled PIN prompt")}else if(l&&!this.config.parentPinOverlay)console.log("⏳ Vault is locked, showing quick unlock..."),p=this.waitForUnlock(),this.openPage("unlock");else if(c&&!this.config.parentPinOverlay){console.log("⏳ Permission required, showing vault and waiting for approval..."),h=this.waitForPermission();const m=`${this.config.appDomain}-nip04-encrypt-${Date.now()}`,g=new URLSearchParams({appOrigin:this.config.appDomain||window.location.host,appName:this.config.appName||document.title,action:"nip04",identityIndex:(r!==void 0?r:0).toString(),requestId:m,pubkey:t,plaintext:e});await this.messenger.send("NAVIGATE",{path:`/${((a=this.config.appDomain)==null?void 0:a.replace(/[:.]/g,"-"))||"vault"}/permission-request?${g.toString()}`}),this.iframe&&(this.iframe.classList.remove("nostrpass-iframe-hidden"),this.iframe.classList.remove("nostrpass-iframe-compact"),this.iframe.classList.remove("nostrpass-iframe-tall"),this.iframe.classList.remove("nostrpass-iframe-minimal"),this.iframe.classList.add("nostrpass-iframe-visible"),this.backdropEl&&(this.backdropEl.classList.add("visible"),this.backdropEl.style.background="transparent",this.backdropEl.style.backdropFilter="none"),this.iframe.setAttribute("aria-hidden","false"),this.iframe.removeAttribute("tabindex"),document.body.style.overflow="hidden")}}catch(o){String((o==null?void 0:o.message)||o).toLowerCase().includes("not authenticated")&&(console.log("⚠️ User not authenticated, showing full vault for login"),this.show("vault","full"))}p&&(console.log("⏳ Waiting for vault unlock..."),await p,console.log("✅ Vault unlocked, continuing operation")),h&&(console.log("⏳ Waiting for permission approval..."),await h,console.log("✅ Permission granted, continuing operation"));const n=async()=>this.messenger.request(k.ENCRYPT,{plaintext:e,recipientPubkey:t,appName:this.config.appName,appDomain:this.config.appDomain,identityIndex:r});try{const o=await n();return this.config.debug&&console.log("Encrypted payload received:",o),this.hide(),o}catch(o){const l=String((o==null?void 0:o.message)||o);if(l.toLowerCase().includes("locked")||l.toLowerCase().includes("unlock")||l.toLowerCase().includes("rehydrated")){await this.sleep(150);try{const c=await n();return this.hide(),c}catch(c){if(String((c==null?void 0:c.message)||c).toLowerCase().includes("rehydrated")){await this.sleep(200);const g=await n();return this.hide(),g}throw c}}throw o}}catch(r){throw console.error("Failed to encrypt:",r),r}}async decrypt(t,e,i){var s,a;(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());try{let r=i==null?void 0:i.identityIndex;if(r==null)try{const o=await this.getAuthStatus();r=((s=o==null?void 0:o.user)==null?void 0:s.identityIndex)??0}catch{r=0}let p=null,h=null;try{const o=await this.messenger.request(k.CHECK_PERMISSION,{action:"nip04",identityIndex:r}),l=(o==null?void 0:o.isLocked)===!0,c=(o==null?void 0:o.needsPrompt)===!0;if(l&&this.config.parentPinOverlay){if(!await this.requestPinUnlock())throw new Error("User canceled PIN prompt")}else if(l&&!this.config.parentPinOverlay)console.log("⏳ Vault is locked, showing quick unlock..."),p=this.waitForUnlock(),this.openPage("unlock");else if(c&&!this.config.parentPinOverlay){console.log("⏳ Permission required, showing vault and waiting for approval..."),h=this.waitForPermission();const m=`${this.config.appDomain}-nip04-decrypt-${Date.now()}`,g=new URLSearchParams({appOrigin:this.config.appDomain||window.location.host,appName:this.config.appName||document.title,action:"nip04",identityIndex:(r!==void 0?r:0).toString(),requestId:m,pubkey:t,ciphertext:e});await this.messenger.send("NAVIGATE",{path:`/${((a=this.config.appDomain)==null?void 0:a.replace(/[:.]/g,"-"))||"vault"}/permission-request?${g.toString()}`}),this.iframe&&(this.iframe.classList.remove("nostrpass-iframe-hidden"),this.iframe.classList.remove("nostrpass-iframe-compact"),this.iframe.classList.remove("nostrpass-iframe-tall"),this.iframe.classList.remove("nostrpass-iframe-minimal"),this.iframe.classList.add("nostrpass-iframe-visible"),this.backdropEl&&(this.backdropEl.classList.add("visible"),this.backdropEl.style.background="transparent",this.backdropEl.style.backdropFilter="none"),this.iframe.setAttribute("aria-hidden","false"),this.iframe.removeAttribute("tabindex"),document.body.style.overflow="hidden")}}catch(o){String((o==null?void 0:o.message)||o).toLowerCase().includes("not authenticated")&&(console.log("⚠️ User not authenticated, showing full vault for login"),this.show("vault","full"))}p&&(console.log("⏳ Waiting for vault unlock..."),await p,console.log("✅ Vault unlocked, continuing operation")),h&&(console.log("⏳ Waiting for permission approval..."),await h,console.log("✅ Permission granted, continuing operation"));const n=async()=>this.messenger.request(k.DECRYPT,{ciphertext:e,senderPubkey:t,appName:this.config.appName,appDomain:this.config.appDomain,identityIndex:r});try{const o=await n();return this.config.debug&&console.log("Decrypted payload received:",o),this.hide(),o}catch(o){const l=String((o==null?void 0:o.message)||o);if(l.toLowerCase().includes("locked")||l.toLowerCase().includes("unlock")||l.toLowerCase().includes("rehydrated")){await this.sleep(150);try{const c=await n();return this.hide(),c}catch(c){if(String((c==null?void 0:c.message)||c).toLowerCase().includes("rehydrated")){await this.sleep(200);const g=await n();return this.hide(),g}throw c}}throw o}}catch(r){throw console.error("Failed to decrypt:",r),r}}async getAuthStatus(){(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());try{return await this.messenger.request(k.AUTH_STATUS,{})}catch(t){throw console.error("Failed to get auth status:",t),t}}async getAllIdentities(){(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());try{return await this.messenger.request(k.GET_ALL_IDENTITIES,{})}catch(t){throw console.error("Failed to get all identities:",t),t}}async switchIdentity(t){(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());try{return await this.messenger.request(k.SWITCH_IDENTITY,{identityIndex:t})}catch(e){throw console.error("Failed to switch identity:",e),e}}async logout(){if(!this.iframe||!this.messenger){console.log("[Embassy] No iframe/messenger to logout from");return}try{console.log("[Embassy] Sending LOGOUT message to vault"),await this.messenger.request(k.LOGOUT,{}),console.log("[Embassy] Logout successful")}catch(t){throw console.error("[Embassy] Logout failed:",t),t}}async manageAccount(t={}){(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());const e=t.forcePrompt??!0,i=t.size||"minimal";this.show("vault",i,t.buttonElement);try{const s=await this.messenger.request(k.MANAGE_ACCOUNTS,{appName:this.config.appName,appDomain:this.config.appDomain,forcePrompt:e});return this.hide(),s}catch(s){throw s}}createAccountManagerButton(t={}){const{label:e="Manage NostrPass Account",className:i="nostrpass-account-button",appendTo:s,buttonElement:a,disabledText:r,onSelect:p,onError:h,forcePrompt:n}=t,o=a??document.createElement("button");a?i&&(a.className=i):(o.type="button",o.className=i,o.textContent=e);const l=async c=>{c.preventDefault();const m=o.textContent;try{o.disabled=!0,r&&(o.textContent=r);const g=await this.manageAccount({forcePrompt:n});p==null||p(g)}catch(g){h?h(g):console.error("[NostrPass] Failed to manage account:",g)}finally{o.disabled=!1,r&&m!==void 0&&m!==null&&(o.textContent=m)}};if(o.addEventListener("click",l),s){const c=typeof s=="string"?document.querySelector(s):s;c?o.parentElement||c.appendChild(o):console.warn("[NostrPass] Unable to find target element for account manager button:",s)}return o}createNostrPassButton(t={}){return new R(this,t)}isReady(){return this._isReady}async waitForReady(){if(!this._isReady)return new Promise(t=>{const e=()=>{this._isReady?t():setTimeout(e,100)};e()})}destroy(){this.messenger&&(this.messenger.destroy(),this.messenger=null),this.iframe&&this.iframe.parentNode&&(this.iframe.parentNode.removeChild(this.iframe),this.iframe=null),this.backdropEl&&this.backdropEl.parentNode&&(this.backdropEl.parentNode.removeChild(this.backdropEl),this.backdropEl=null),this.styleElement&&this.styleElement.parentNode&&(this.styleElement.parentNode.removeChild(this.styleElement),this.styleElement=null),this._isReady=!1,this.config.debug&&console.log("Embassy destroyed")}}let y=null;function O(d={}){try{return y&&y.destroy(),y=new D(d),{getPublicKey:e=>y.getPublicKey(e),signEvent:(e,i)=>y.signEvent(e,i),signData:(e,i)=>y.signData(e,i),getRelays:()=>y.getRelays(),nip04:{encrypt:(e,i,s)=>y.encrypt(e,i,s),decrypt:(e,i,s)=>y.decrypt(e,i,s)},manageAccount:e=>y.manageAccount(e),createAccountManagerButton:e=>y.createAccountManagerButton(e),createNostrPassButton:e=>y.createNostrPassButton(e)}}catch(t){throw console.error("❌ Failed to initialize NostrPass Embassy:",t),t}}function M(){console.log("showVault"),y==null||y.show()}function _(){y==null||y.hide()}if(typeof window<"u"){window.initNostrPass=O,window.showVault=M,window.hideVault=_;const d=document.currentScript;if((d==null?void 0:d.getAttribute("data-manual-init"))==="true")console.log("✅ NostrPass Embassy loaded (manual init mode)");else{const e={};d!=null&&d.hasAttribute("data-vault-url")&&(e.vaultUrl=d.getAttribute("data-vault-url")||void 0),d!=null&&d.hasAttribute("data-app-name")&&(e.appName=d.getAttribute("data-app-name")||void 0),d!=null&&d.hasAttribute("data-debug")&&(e.debug=d.getAttribute("data-debug")==="true"),d!=null&&d.hasAttribute("data-theme")&&(e.theme=d.getAttribute("data-theme")||void 0);const i=O(e);window.nostr=i,console.log("✅ NostrPass Embassy auto-initialized with config:",e)}console.log("💡 Use window.initNostrPass(config) to customize")}return I.NostrPassButton=R,I.NostrPassEmbassy=D,I.initNostrPass=O,Object.defineProperty(I,Symbol.toStringTag,{value:"Module"}),I}({}),B;(B=document.currentScript)!=null&&B.hasAttribute("data-auto-init")&&window.initNostrPass();
//# sourceMappingURL=embassy.iife.js.map
