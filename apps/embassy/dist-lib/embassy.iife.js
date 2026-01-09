var NostrPassEmbassy=function(I){"use strict";var X=Object.defineProperty;var Z=(I,S,T)=>S in I?X(I,S,{enumerable:!0,configurable:!0,writable:!0,value:T}):I[S]=T;var w=(I,S,T)=>Z(I,typeof S!="symbol"?S+"":S,T);class S{constructor(e=!1,t=t){this.isParent=e,this.window=t,this.pendingRequests=new Map,this.messageHandlers=new Map,this.allowedOrigins=new Set,this.isInitialized=!1,this.defaultTimeout=3e4,this.verifiedResponseOrigin=null,this.window=t,this.setupMessageListener()}init(e=[]){e.includes("*")&&console.warn('[SecureMessenger] WARNING: Using wildcard origin "*" is insecure. Messages will only be sent to verified origins.'),e.forEach(t=>this.allowedOrigins.add(t)),this.isInitialized=!0}on(e,t){this.messageHandlers.set(e,t)}off(e){this.messageHandlers.delete(e)}async request(e,t=null,i=this.defaultTimeout){if(!this.isInitialized)throw new Error("SecureMessenger not initialized. Call init() first.");const o=this.generateId(),a={id:o,type:e,data:t,timestamp:Date.now(),origin:this.window.location.origin};return new Promise((r,p)=>{const c=setTimeout(()=>{this.pendingRequests.delete(o),p(new Error(`Request timeout after ${i}ms`))},i);this.pendingRequests.set(o,{resolve:r,reject:p,timeout:c}),this.sendMessage(a)})}send(e,t=null){if(!this.isInitialized)throw new Error("SecureMessenger not initialized. Call init() first.");const i={id:this.generateId(),type:e,data:t,timestamp:Date.now(),origin:this.window.location.origin};this.sendMessage(i)}async sendResponse(e,t,i){const o={id:e.id,type:`${e.type}_RESPONSE`,data:i?{error:i}:t,timestamp:Date.now(),origin:this.window.location.origin};this.sendMessage(o,this.verifiedResponseOrigin||void 0)}sendMessage(e,t){var a;const i=this.isParent?this.window.frames[0]||((a=this.window.document.querySelector("iframe"))==null?void 0:a.contentWindow):this.window.parent;if(!i)throw new Error("Target window not found");let o;if(t)o=t;else if(this.verifiedResponseOrigin)o=this.verifiedResponseOrigin;else if(this.allowedOrigins.size===1&&!this.allowedOrigins.has("*"))o=Array.from(this.allowedOrigins)[0];else throw new Error("No verified origin available for sending message. Ensure handshake completed.");i.postMessage(e,o)}setupMessageListener(){this.window.addEventListener("message",async e=>{try{await this.handleMessage(e)}catch(t){console.error("Error handling message:",t)}})}async handleMessage(e){if(!this.isOriginAllowed(e.origin)){console.warn("Message from unauthorized origin:",e.origin);return}if(!this.verifiedResponseOrigin)this.verifiedResponseOrigin=e.origin,console.log("[SecureMessenger] Locked to origin:",e.origin);else if(this.verifiedResponseOrigin!==e.origin){console.warn("Message from different origin than established:",e.origin);return}const t=e.data;if(!this.isValidMessage(t)){console.warn("Invalid message structure:",t);return}if(t.type.endsWith("_RESPONSE")&&this.pendingRequests.has(t.id)){this.handleResponse(t);return}const i=this.messageHandlers.get(t.type);if(!i){console.warn("No handler for message type:",t.type);return}try{const o=await i(t.data);t.type.endsWith("_RESPONSE")||await this.sendResponse(t,o)}catch(o){if(!t.type.endsWith("_RESPONSE")){const r={error:o instanceof Error?o.message:String(o)};o&&typeof o=="object"&&"code"in o&&o.code&&(r.code=o.code);const p={id:t.id,type:`${t.type}_RESPONSE`,data:r,timestamp:Date.now(),origin:this.window.location.origin};this.sendMessage(p)}}}handleResponse(e){const t=this.pendingRequests.get(e.id);if(t)if(clearTimeout(t.timeout),this.pendingRequests.delete(e.id),e.data&&e.data.error){const i=new Error(e.data.error);e.data.code&&(i.code=e.data.code),t.reject(i)}else t.resolve(e.data)}isValidMessage(e){return e&&typeof e.id=="string"&&typeof e.type=="string"&&typeof e.timestamp=="number"&&typeof e.origin=="string"&&Math.abs(Date.now()-e.timestamp)<3e5}isOriginAllowed(e){return this.isInitialized?this.allowedOrigins.has("*")?!0:this.allowedOrigins.has(e):!1}generateId(){return`msg_${Date.now()}_${Math.random().toString(36).substr(2,9)}`}getVerifiedOrigin(){return this.verifiedResponseOrigin}destroy(){this.pendingRequests.forEach(({timeout:e,reject:t})=>{clearTimeout(e),t(new Error("Messenger destroyed"))}),this.pendingRequests.clear(),this.messageHandlers.clear(),this.allowedOrigins.clear(),this.verifiedResponseOrigin=null,this.isInitialized=!1}}class T extends S{constructor(e=window){super(!0,e),this.iframe=null}createIframe(e,t){return this.iframe=document.createElement("iframe"),this.iframe.src=e,this.iframe.style.cssText=`
      width: 100%;
      height: 600px;
      border: none;
      border-radius: 8px;
    `,(t||document.body).appendChild(this.iframe),this.iframe.addEventListener("load",()=>{const o=new URL(e).origin;this.init([o])}),this.iframe}createHiddenIframe(e){return this.iframe=document.createElement("iframe"),this.iframe.src=e,this.iframe.style.cssText=`
      position: fixed;
      top: -1000px;
      left: -1000px;
      width: 1px;
      height: 1px;
      border: none;
      opacity: 0;
      pointer-events: none;
    `,document.body.appendChild(this.iframe),this.iframe.addEventListener("load",()=>{const t=new URL(e).origin;this.init([t])}),this.iframe}destroy(){this.iframe&&this.iframe.parentNode&&(this.iframe.parentNode.removeChild(this.iframe),this.iframe=null),super.destroy()}}const U=function(h){return{HIDE_VAULT:()=>{console.log("🔙 Hide vault signal received from vault iframe");try{return h.hide(),console.log("✅ Vault hidden successfully"),{acknowledged:!0}}catch(e){return console.error("❌ Failed to hide vault:",e),{acknowledged:!1,error:e instanceof Error?e.message:"Unknown error"}}},OPEN_PERMISSION_PAGE:e=>{console.log("🔐 Open permission page signal received from vault iframe",e);try{const t={};return e.appOrigin&&(t.appOrigin=e.appOrigin),e.appName&&(t.appName=e.appName),e.action&&(t.action=e.action),e.requestId&&(t.requestId=e.requestId),e.eventKind!==void 0&&(t.eventKind=String(e.eventKind)),e.identityIndex!==void 0&&(t.identityIndex=String(e.identityIndex)),e.event&&(t.event=JSON.stringify(e.event)),e.data&&(t.data=e.data),e.pubkey&&(t.pubkey=e.pubkey),e.plaintext&&(t.plaintext=e.plaintext),e.ciphertext&&(t.ciphertext=e.ciphertext),h.openPage("permission",{size:"tall",queryParams:t}),console.log("✅ Permission page opened successfully"),{acknowledged:!0}}catch(t){return console.error("❌ Failed to open permission page:",t),{acknowledged:!1,error:t instanceof Error?t.message:"Unknown error"}}},SHOW_VAULT:(e="vault")=>(console.log("Show vault signal received"),h.show(e),{acknowledged:!0}),VAULT_READY:()=>{console.log("Vault ready signal received"),h._isReady=!0;const e=new CustomEvent("nostr:ready",{detail:{embassy:h}});return window.dispatchEvent(e),{acknowledged:!0}},AUTH_STATUS:e=>(console.log("Auth status signal received",e),{acknowledged:!0}),GET_RELAYS:()=>(console.log("Get relays signal received"),{acknowledged:!0}),GOT_ERROR:()=>(console.log("Error signal received"),{acknowledged:!0}),PROMPT_REQUIRED:async e=>(console.log("Prompt requested by vault:",e),(e==null?void 0:e.promptType)==="PIN_PAD"&&(await h.requestPinUnlock()||console.warn("PIN prompt canceled or failed")),{acknowledged:!0}),"nostrpass:unlocked":e=>{if(console.log("🔓 Vault unlocked signal received from vault iframe",e),e!=null&&e.forOperation&&(console.log("✅ Unlock was for an operation, notifying waiters"),h.notifyUnlocked()),(e==null?void 0:e.nextAction)==="account-picker"){console.log("🔄 Unlock requested account-picker continuation, switching to account-picker page");const t={};e.appOrigin&&(t.appOrigin=e.appOrigin),e.appName&&(t.appName=e.appName),e.requestId&&(t.requestId=e.requestId),e.permissions&&(t.permissions=e.permissions),h.openPage("account",{queryParams:t})}window.dispatchEvent(new CustomEvent("nostrpass:unlocked",{detail:e}))},"nostrpass:logout":e=>{console.log("🚪 Logout signal received from vault iframe",e),window.dispatchEvent(new CustomEvent("nostrpass:logout",{detail:e})),console.log("🚪 ✅ nostrpass:logout event dispatched to window")},VAULT_DATA_UPDATED:e=>{console.log("📦 [Embassy] Vault data updated signal received from vault iframe",e),console.log("📦 [Embassy] Dispatching vault-data-refresh event to window"),window.dispatchEvent(new CustomEvent("vault-data-refresh",{detail:e})),console.log("📦 [Embassy] ✅ vault-data-refresh event dispatched")},ACCOUNT_PICKER_SELECTED:e=>{console.log("✅ [Embassy] Account picker selected signal received from vault iframe",e),window.dispatchEvent(new CustomEvent("account-picker-selected",{detail:e})),console.log("✅ [Embassy] account-picker-selected event dispatched to window")},PERMISSION_GRANTED:e=>{var t;console.log("✅ [Embassy] Permission granted signal received from vault iframe",e),window.dispatchEvent(new CustomEvent("permission-granted",{detail:e})),(t=h==null?void 0:h.notifyPermissionGranted)==null||t.call(h)},PERMISSION_DENIED:e=>{console.log("❌ [Embassy] Permission denied signal received from vault iframe",e),window.dispatchEvent(new CustomEvent("permission-denied",{detail:e}))}}},q=h=>h.replace(/\./g,"-").replace(/:/g,"-").replace(/_/g,"-");var y=(h=>(h.VAULT_READY="VAULT_READY",h.AUTH_STATUS="AUTH_STATUS",h.SHOW_VAULT="SHOW_VAULT",h.HIDE_VAULT="HIDE_VAULT",h.NAVIGATE="NAVIGATE",h.LOGOUT="LOGOUT",h.CHECK_PERMISSION="CHECK_PERMISSION",h.GET_RELAYS="GET_RELAYS",h.GET_PUBLIC_KEY="GET_PUBLIC_KEY",h.SIGN_EVENT="SIGN_EVENT",h.SIGN_DATA="SIGN_DATA",h.ENCRYPT="ENCRYPT",h.DECRYPT="DECRYPT",h.NIP44_ENCRYPT="NIP44_ENCRYPT",h.NIP44_DECRYPT="NIP44_DECRYPT",h.GOT_ERROR="GOT_ERROR",h.PROMPT_REQUIRED="PROMPT_REQUIRED",h.MANAGE_ACCOUNTS="MANAGE_ACCOUNTS",h.GET_ALL_IDENTITIES="GET_ALL_IDENTITIES",h.SWITCH_IDENTITY="SWITCH_IDENTITY",h))(y||{});class M{constructor(e,t={}){w(this,"config");w(this,"container");w(this,"embassy");w(this,"currentUser",null);w(this,"allIdentities",[]);w(this,"theme","light");w(this,"isDropdownOpen",!1);w(this,"outsideClickHandler",null);w(this,"isCheckingAuth",!0);w(this,"authPollingInterval",null);if(this.embassy=e,this.config={signInText:"Sign in with NostrPass",showNpub:!0,showManageAccount:!0,theme:"auto",...t},this.container=document.createElement("div"),this.container.className=`nostrpass-button-container ${t.className||""}`,t.expandOnHover&&this.container.setAttribute("data-expand-on-hover","true"),this.updateTheme(),this.injectStyles(),this.render(),t.appendTo){const i=typeof t.appendTo=="string"?document.querySelector(t.appendTo):t.appendTo;i&&i.appendChild(this.container)}this.setupEventListeners(),this.restoreSession().catch(i=>{console.warn("[NostrPassButton] Failed to restore session on init:",i)}),this.startAuthPolling()}setupEventListeners(){window.addEventListener("nostrpass:logout",()=>{console.log("[NostrPassButton] 🚪 Logout event received from window"),this.handleLogoutEvent()});try{new BroadcastChannel("nostrpass-logout").addEventListener("message",t=>{var i;((i=t.data)==null?void 0:i.type)==="LOGOUT"&&(console.log("[NostrPassButton] 🚪 Logout event received from BroadcastChannel"),this.handleLogoutEvent())})}catch(e){console.warn("[NostrPassButton] BroadcastChannel not supported:",e)}window.addEventListener("storage",e=>{e.key==="nostrpass_session"&&e.newValue===null&&(console.log("[NostrPassButton] 🚪 Session cleared in another tab - logging out"),this.handleLogoutEvent())}),window.addEventListener("account-picker-selected",e=>{const t=e;console.log("[NostrPassButton] 🔄 Account picker selected event received",t.detail),this.handleAccountPickerSelection(t.detail)}),window.addEventListener("vault-data-refresh",async e=>{var t;if(console.log("[NostrPassButton] 🔄 Vault data refresh event received:",e),this.currentUser){console.log("[NostrPassButton] Current user exists, fetching updated identities..."),await new Promise(i=>setTimeout(i,150));try{const i=await this.embassy.getAllIdentities();console.log("[NostrPassButton] getAllIdentities response:",i);const o=(i==null?void 0:i.identities)||[],r=((t=e.detail)==null?void 0:t.activeIdentityIndex)??(i==null?void 0:i.activeIdentityIndex);if(o.length===0){console.log("[NostrPassButton] No identities returned - user logged out"),this.currentUser=null,this.clearSession();return}if(console.log("[NostrPassButton] Active identity index from vault:",r),console.log("[NostrPassButton] Current session identity index:",this.currentUser.identityIndex),r!==void 0&&r!==this.currentUser.identityIndex){console.log("[NostrPassButton] 🔄 Active identity changed from",this.currentUser.identityIndex,"to",r);const c=o.find(n=>n.index===r);if(c){console.log("[NostrPassButton] Switching to new active identity:",c.nickname),this.currentUser={identityIndex:c.index,publicKey:c.publicKey,nickname:c.nickname,authorized:c.isAuthorized,npub:c.npub,avatar:c.avatar},this.saveSession(this.currentUser),this.config.onLogin&&this.config.onLogin(this.currentUser),console.log("[NostrPassButton] Re-rendering button with new active identity..."),await this.render(),console.log("[NostrPassButton] ✅ Button updated to new active identity");return}}const p=o.find(c=>c.index===this.currentUser.identityIndex);if(console.log("[NostrPassButton] Current identity:",p),console.log("[NostrPassButton] All identities count:",o.length),p){const c=this.currentUser.authorized;this.currentUser.nickname=p.nickname,this.currentUser.authorized=p.isAuthorized,this.currentUser.npub=p.npub,console.log("[NostrPassButton] Authorization status changed:",{before:c,after:p.isAuthorized}),this.saveSession(this.currentUser),console.log("[NostrPassButton] Re-rendering button..."),await this.render(),console.log("[NostrPassButton] ✅ Button updated after vault data refresh")}else{console.warn("[NostrPassButton] Current identity not found in authorized list - marking as unauthorized");const c=this.currentUser.authorized;this.currentUser.authorized=!1,console.log("[NostrPassButton] Identity disconnected:",{before:c,after:!1}),this.saveSession(this.currentUser),console.log("[NostrPassButton] Re-rendering button for disconnected state..."),await this.render(),console.log("[NostrPassButton] ✅ Button updated - showing unauthorized state")}}catch(i){console.error("[NostrPassButton] ❌ Failed to refresh identity status:",i)}}else{console.log("[NostrPassButton] No current user - checking if user just logged in...");try{await this.restoreSession()&&console.log("[NostrPassButton] ✅ Session restored after login")}catch(i){console.error("[NostrPassButton] ❌ Failed to restore session:",i)}}})}updateTheme(){if(this.config.theme==="auto"){const e=window.matchMedia("(prefers-color-scheme: dark)").matches;this.theme=e?"dark":"light",window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change",t=>{this.theme=t.matches?"dark":"light",this.container.setAttribute("data-theme",this.theme)})}else this.theme=this.config.theme||"light";this.container.setAttribute("data-theme",this.theme)}injectStyles(){if(document.getElementById("nostrpass-button-styles"))return;const e=document.createElement("style");e.id="nostrpass-button-styles",e.textContent=`
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

      .nostrpass-avatar-wrapper {
        position: relative;
        width: 32px;
        height: 32px;
        flex-shrink: 0;
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

      img.nostrpass-identity-avatar {
        object-fit: cover;
        background: transparent;
      }

      [data-theme="dark"] .nostrpass-identity-avatar {
        background: #fff;
        color: #000;
      }

      [data-theme="dark"] img.nostrpass-identity-avatar {
        background: transparent;
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

      /* Avatar loading spinner overlay */
      .nostrpass-avatar-loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
        pointer-events: none;
      }

      [data-theme="dark"] .nostrpass-avatar-loading-overlay {
        background: rgba(255, 255, 255, 0.5);
      }

      .nostrpass-avatar-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid #fff;
        border-radius: 50%;
        border-top-color: transparent;
        animation: nostrpass-spin 0.6s linear infinite;
      }

      [data-theme="dark"] .nostrpass-avatar-spinner {
        border-color: #000;
        border-top-color: transparent;
      }
    `,document.head.appendChild(e)}async render(){this.isCheckingAuth?this.renderLoadingButton():this.currentUser?await this.renderUserButton():this.renderSignInButton()}renderLoadingButton(){this.container.innerHTML=`
      <div class="nostrpass-loading-skeleton"></div>
    `}renderSignInButton(){this.container.innerHTML=`
      <button class="nostrpass-btn-base nostrpass-signin-btn" data-action="signin">
        <div class="nostrpass-signin-logo">🥚</div>
        <span>${this.config.signInText}</span>
      </button>
    `,this.container.querySelector('[data-action="signin"]').addEventListener("click",()=>this.handleSignIn())}async renderUserButton(){const e=this.currentUser,t=this.getUserInitials(e),i=e.nickname||`Identity ${e.identityIndex+1}`,o=i.charAt(0).toUpperCase()+i.slice(1);let a="",r=[];try{const f=await this.embassy.getAuthStatus();a=(f==null?void 0:f.username)||""}catch(f){console.warn("Failed to fetch auth status:",f)}try{const f=await this.embassy.getAllIdentities();r=(f==null?void 0:f.identities)||[],this.allIdentities=r,console.log("[NostrPassButton] getAllIdentities response:",{response:f,allIdentities:r});const g=r.find(b=>b.index===e.identityIndex);g&&g.avatar!==e.avatar&&(console.log("[NostrPassButton] Updating avatar:",{old:e.avatar,new:g.avatar}),e.avatar=g.avatar,this.currentUser.avatar=g.avatar,this.saveSession(this.currentUser))}catch(f){console.warn("Failed to fetch all identities:",f)}const p=r.filter(f=>f.isAuthorized);console.log("[NostrPassButton] Authorized identities:",{authorizedIdentities:p,total:r.length});const c=e.authorized||p.length>0;let n="";p.length>1&&(n=`
        <div class="nostrpass-dropdown-divider"></div>
        <div class="nostrpass-dropdown-section">
          <div style="padding: 8px 12px; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase;">
            Switch Identity
          </div>
          ${p.length>4?'<input type="text" class="nostrpass-identity-search" placeholder="Search identities..." data-search-identities />':""}
          <div class="nostrpass-identity-list" data-identity-container>
            ${p.map(g=>{const b=g.index===e.identityIndex,x=g.nickname?this.getInitialsFromName(g.nickname):`I${g.index+1}`,P=g.nickname||`Identity ${g.index+1}`,L=P.charAt(0).toUpperCase()+P.slice(1);return`
                <button class="nostrpass-dropdown-item nostrpass-identity-item ${b?"nostrpass-identity-active":""}" data-action="switch-identity" data-identity-index="${g.index}" data-identity-name="${L.toLowerCase()}" data-identity-npub="${g.npub||""}">
                  ${g.avatar?`<img src="${g.avatar}" alt="${L}" class="nostrpass-identity-avatar" style="object-fit: cover;" />`:`<div class="nostrpass-identity-avatar">${x}</div>`}
                  <div class="nostrpass-identity-info">
                    <div class="nostrpass-identity-name">
                      ${L}
                    </div>
                    ${g.npub?`<div class="nostrpass-identity-npub">${g.npub.slice(0,12)}...</div>`:""}
                  </div>
                  ${b?'<svg class="nostrpass-identity-check" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13.333 4L6 11.333 2.667 8" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>':""}
                </button>
              `}).join("")}
          </div>
        </div>
      `),this.container.innerHTML=`
      <div class="nostrpass-user-menu">
        <button class="nostrpass-btn-base nostrpass-user-btn ${c?"":"nostrpass-user-btn-warning"}" data-action="toggle-menu">
          <div class="nostrpass-avatar-wrapper">
            ${e.avatar?`<img src="${e.avatar}" alt="${o}" class="nostrpass-user-avatar" />`:`<div class="nostrpass-user-initials">${t}</div>`}
          </div>
          <span class="nostrpass-user-btn-text">${c?o:"Not authorized"}</span>
        </button>
        <div class="nostrpass-dropdown" data-dropdown>
          ${c?"":`
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
              ${e.avatar?`<img src="${e.avatar}" alt="${o}" class="nostrpass-dropdown-avatar" />`:`<div class="nostrpass-dropdown-initials">${t}</div>`}
              <div class="nostrpass-dropdown-user-details">
                <div class="nostrpass-dropdown-name">${o}</div>
                ${a?`<div class="nostrpass-dropdown-username">${a}</div>`:e.npub?`<div class="nostrpass-dropdown-npub">${e.npub.slice(0,16)}...</div>`:""}
              </div>
              ${c?`
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
    `,this.container.querySelector('[data-action="toggle-menu"]').addEventListener("click",f=>{f.stopPropagation(),c?this.toggleDropdown():this.handleNotAuthorizedClick()});const d=this.container.querySelector("[data-search-identities]");d&&d.addEventListener("input",f=>{const g=f.target.value.toLowerCase();this.container.querySelectorAll('[data-action="switch-identity"]').forEach(x=>{const P=x.getAttribute("data-identity-name")||"",L=x.getAttribute("data-identity-npub")||"",v=P.includes(g)||L.toLowerCase().includes(g);x.style.display=v?"":"none"})}),this.container.querySelectorAll('[data-action="switch-identity"]').forEach(f=>{f.addEventListener("click",g=>{const b=parseInt(g.currentTarget.getAttribute("data-identity-index")||"0");b===e.identityIndex||this.handleSwitchIdentity(b)})});const u=this.container.querySelector('[data-action="toggle-lock"]');u==null||u.addEventListener("click",()=>{this.handleToggleLock()});const m=this.container.querySelector('[data-action="manage-account"]');m==null||m.addEventListener("click",()=>{this.closeDropdown(),this.handleManageAccount()});const E=this.container.querySelector('[data-action="sign-out"]');E==null||E.addEventListener("click",()=>{this.closeDropdown(),this.handleSignOut()})}getInitialsFromName(e){const t=e.split(" ");return t.length>=2?`${t[0][0]}${t[1][0]}`:e.slice(0,2)}async handleSwitchIdentity(e){var o,a,r,p,c;this.showAvatarLoading(),this.closeDropdown();const t=this.allIdentities.find(n=>n.index===e),i=(t==null?void 0:t.isAuthorized)||!1;if(console.log("[NostrPassButton] handleSwitchIdentity:",{identityIndex:e,isAuthorized:i,selectedIdentity:t}),!i){console.log("[NostrPassButton] Identity not authorized, opening account picker for authorization"),this.hideAvatarLoading();try{await this.embassy.manageAccount({forcePrompt:!0,buttonElement:this.container.querySelector('[data-action="toggle-menu"]')})}catch(n){console.error("Failed to open account picker:",n)}return}try{const n=await this.embassy.switchIdentity(e);n!=null&&n.success&&(n!=null&&n.identity)?(this.currentUser={identityIndex:n.identityIndex,publicKey:n.identity.publicKey,npub:n.identity.npub,nickname:n.identity.nickname,authorized:n.identity.authorized||!1,avatar:n.identity.avatar},this.saveSession(this.currentUser),await new Promise(s=>setTimeout(s,150)),await this.render(),this.config.onLogin&&this.config.onLogin(this.currentUser)):this.hideAvatarLoading()}catch(n){if(console.error("Failed to switch identity:",n),(o=n==null?void 0:n.message)!=null&&o.includes("not authorized"))try{const s=await this.embassy.manageAccount({forcePrompt:!0,buttonElement:this.container.querySelector('[data-action="toggle-menu"]')});s!=null&&s.identity?(this.currentUser={identityIndex:s.identityIndex,publicKey:s.identity.publicKey,npub:s.identity.npub,nickname:s.identity.nickname,authorized:s.identity.authorized||!1,avatar:s.identity.avatar},this.saveSession(this.currentUser),await this.render(),this.config.onLogin&&this.config.onLogin(this.currentUser)):this.hideAvatarLoading()}catch(s){console.error("Failed to authorize identity:",s),(r=(a=this.config).onError)==null||r.call(a,s),this.hideAvatarLoading()}else(c=(p=this.config).onError)==null||c.call(p,n),this.hideAvatarLoading()}}showAvatarLoading(){const e=this.container.querySelector(".nostrpass-avatar-wrapper");if(!e){console.warn("[NostrPassButton] showAvatarLoading: avatar wrapper not found");return}if(e.querySelector(".nostrpass-avatar-loading-overlay"))return;const t=document.createElement("div");t.className="nostrpass-avatar-loading-overlay",t.innerHTML='<div class="nostrpass-avatar-spinner"></div>',e.appendChild(t),console.log("[NostrPassButton] Loading spinner added")}hideAvatarLoading(){const e=this.container.querySelector(".nostrpass-user-btn");if(!e)return;const t=e.querySelector(".nostrpass-avatar-loading-overlay");t&&(t.remove(),console.log("[NostrPassButton] Loading spinner removed"))}getUserInitials(e){if(e.nickname){const t=e.nickname.split(" ");return t.length>=2?`${t[0][0]}${t[1][0]}`:e.nickname.slice(0,2)}return`I${e.identityIndex+1}`}async handleSignIn(){var i,o,a,r,p,c,n,s,d;const e=this.container.querySelector('[data-action="signin"]');if(!e)return;const t=e.innerHTML;e.disabled=!0,e.innerHTML='<span class="nostrpass-loading"></span> <span>Signing in...</span>';try{this.embassy.openPage("login",{buttonElement:e});const l=await this.embassy.manageAccount({forcePrompt:!0,buttonElement:e});this.currentUser={identityIndex:l.identityIndex,publicKey:((i=l.identity)==null?void 0:i.publicKey)||"",npub:(o=l.identity)==null?void 0:o.npub,nickname:(a=l.identity)==null?void 0:a.nickname,authorized:((r=l.identity)==null?void 0:r.authorized)||!1,avatar:(p=l.identity)==null?void 0:p.avatar},this.saveSession(this.currentUser),this.render(),(n=(c=this.config).onSignIn)==null||n.call(c,this.currentUser)}catch(l){console.error("NostrPass sign in failed:",l);const u=l instanceof Error?l.message:String(l);if(u.toLowerCase().includes("locked")||u.toLowerCase().includes("unlock")){console.log("[NostrPassButton] Vault locked - waiting for unlock...");const m=async()=>{var E,f;console.log("[NostrPassButton] Vault unlocked, checking auth status...");try{const g=await this.embassy.getAuthStatus();g!=null&&g.isAuthenticated&&(g!=null&&g.user)&&(this.currentUser={identityIndex:g.user.identityIndex||0,publicKey:g.user.publicKey||"",npub:g.user.npub,nickname:g.user.nickname,authorized:g.user.authorized||!1,avatar:g.user.avatar},this.saveSession(this.currentUser),this.render(),(f=(E=this.config).onSignIn)==null||f.call(E,this.currentUser)),window.removeEventListener("nostrpass:unlocked",m)}catch(g){console.error("[NostrPassButton] Failed to get auth status after unlock:",g),e.disabled=!1,e.innerHTML=t}};window.addEventListener("nostrpass:unlocked",m);return}e.disabled=!1,e.innerHTML=t,(d=(s=this.config).onError)==null||d.call(s,l)}}async toggleDropdown(){try{const t=await this.embassy.getAuthStatus();if(t!=null&&t.isLocked){console.log("[NostrPassButton] Vault locked, showing unlock page...");const i=this.container.querySelector('[data-action="toggle-menu"]');this.embassy.openPage("unlock",{buttonElement:i});const o=()=>{console.log("[NostrPassButton] Vault unlocked, hiding modal and showing dropdown..."),window.removeEventListener("nostrpass:unlocked",o),this.embassy.hide();const a=this.container.querySelector('[data-action="toggle-lock"]'),r=a==null?void 0:a.querySelector(".nostrpass-lock-slider");r&&(r.classList.remove("locked"),r.classList.add("unlocked"),a.setAttribute("data-is-locked","false"),a.title="Lock vault"),setTimeout(()=>{this.openDropdown()},100)};window.addEventListener("nostrpass:unlocked",o);return}}catch(t){console.error("[NostrPassButton] Failed to check vault status:",t)}this.container.querySelector("[data-dropdown]")&&(this.isDropdownOpen?this.closeDropdown():this.openDropdown())}openDropdown(){const e=this.container.querySelector("[data-dropdown]"),t=this.container.querySelector(".nostrpass-user-btn");e&&(this.isDropdownOpen=!0,e.classList.add("open"),t&&t.classList.add("active"),setTimeout(()=>{this.outsideClickHandler=i=>{const o=i.target;this.container.contains(o)||this.closeDropdown()},document.addEventListener("click",this.outsideClickHandler)},0))}closeDropdown(){const e=this.container.querySelector("[data-dropdown]"),t=this.container.querySelector(".nostrpass-user-btn");e&&(this.isDropdownOpen=!1,e.classList.remove("open"),t&&t.classList.remove("active"),this.removeOutsideClickListener())}removeOutsideClickListener(){this.outsideClickHandler&&(document.removeEventListener("click",this.outsideClickHandler),this.outsideClickHandler=null)}async handleNotAuthorizedClick(){var e,t;try{const i=this.container.querySelector('[data-action="toggle-menu"]'),o=window.location.origin,a=document.title,r=`account-picker-${Date.now()}-${Math.random().toString(36).slice(2)}`,p=async l=>{const u=l;if(u.detail.requestId===r){n(),this.embassy.hide();try{const m=await this.embassy.getAllIdentities(),f=((m==null?void 0:m.identities)||[]).find(g=>g.index===u.detail.identityIndex);f&&(this.currentUser={identityIndex:f.index,publicKey:f.publicKey,npub:f.npub,nickname:f.nickname,authorized:f.isAuthorized||!1,avatar:f.avatar},this.saveSession(this.currentUser),await this.render())}catch(m){console.error("Failed to update button after account selection:",m)}}},c=l=>{l.detail.requestId===r&&(n(),this.embassy.hide())},n=()=>{window.removeEventListener("account-picker-selected",p),window.removeEventListener("account-picker-rejected",c)};window.addEventListener("account-picker-selected",p),window.addEventListener("account-picker-rejected",c);const s=await this.embassy.getAuthStatus(),d=this.embassy.config.permissions?JSON.stringify(this.embassy.config.permissions):void 0;if(s!=null&&s.isLocked){console.log("[NostrPassButton] Vault locked, using smart unlock with account-picker continuation...");const l={next:"account-picker",appOrigin:o,appName:a,requestId:r};d&&(l.permissions=d),this.embassy.openPage("unlock",{size:"thin",buttonElement:i,queryParams:l})}else{console.log("[NostrPassButton] Vault unlocked, showing account picker...");const l={appOrigin:o,appName:a,requestId:r};d&&(l.permissions=d),this.embassy.openPage("account",{buttonElement:i,queryParams:l})}}catch(i){console.error("Failed to authorize identity:",i),(t=(e=this.config).onError)==null||t.call(e,i)}}async handleManageAccount(){var e,t;try{this.embassy.openPage("dashboard")}catch(i){console.error("Failed to open vault:",i),(t=(e=this.config).onError)==null||t.call(e,i)}}async handleToggleLock(){try{console.log("[NostrPassButton] Locking vault...");const e=this.container.querySelector('[data-action="toggle-lock"]'),t=e==null?void 0:e.querySelector(".nostrpass-lock-slider");t&&(t.classList.remove("unlocked"),t.classList.add("locked"),e.setAttribute("data-is-locked","true"),e.title="Vault locked"),this.closeDropdown();try{await this.embassy.messenger.request("LOCK_VAULT",{}),console.log("[NostrPassButton] Vault locked successfully"),await new Promise(i=>setTimeout(i,100))}catch(i){console.error("[NostrPassButton] Failed to send lock message:",i)}}catch(e){console.error("[NostrPassButton] Failed to lock vault:",e)}}handleLogoutEvent(){var e,t,i,o;console.log("[NostrPassButton] Handling logout event"),this.currentUser=null,this.clearSession(),this.render(),this.embassy.hide(),(t=(e=this.config).onSignOut)==null||t.call(e),(o=(i=this.config).onLogout)==null||o.call(i)}async handleAccountPickerSelection(e){if(console.log("[NostrPassButton] Handling account picker selection:",e),!(e!=null&&e.identity)){console.warn("[NostrPassButton] No identity data in account picker selection");return}this.currentUser={identityIndex:e.identityIndex??0,publicKey:e.identity.publicKey,npub:e.identity.npub,nickname:e.identity.nickname,authorized:e.identity.authorized??!1,avatar:e.identity.avatar},this.saveSession(this.currentUser),await this.render(),this.config.onLogin&&this.config.onLogin(this.currentUser),console.log("[NostrPassButton] Button updated with new identity:",this.currentUser)}async handleSignOut(){if(confirm(`Sign out of NostrPass?

This will log you out across all apps and browser tabs. You'll need to sign in again to use NostrPass.`)){try{console.log("[NostrPassButton] Calling embassy.logout() - full NostrPass logout"),await this.embassy.logout(),console.log("[NostrPassButton] Embassy logout successful");try{const t=new BroadcastChannel("nostrpass-logout");t.postMessage({type:"LOGOUT"}),t.close(),console.log("[NostrPassButton] Logout broadcasted to all tabs")}catch(t){console.warn("[NostrPassButton] Failed to broadcast logout:",t)}}catch(t){console.error("[NostrPassButton] Embassy logout failed:",t)}this.handleLogoutEvent()}}saveSession(e){try{localStorage.setItem("nostrpass_session",JSON.stringify(e))}catch(t){console.warn("Failed to save NostrPass session:",t)}}clearSession(){try{localStorage.removeItem("nostrpass_session"),this.currentUser=null,this.isCheckingAuth=!1,this.render()}catch(e){console.warn("Failed to clear NostrPass session:",e)}}async restoreSession(){console.log("[NostrPassButton] restoreSession called"),this.isCheckingAuth=!0,this.render();try{console.log("[NostrPassButton] Waiting for vault ready..."),await this.embassy.waitForReady(),console.log("[NostrPassButton] Vault is ready");try{console.log("[NostrPassButton] Checking auth status...");const e=await this.embassy.getAuthStatus();if(console.log("[NostrPassButton] Auth status response:",e),e!=null&&e.isAuthenticated){if(e.user)return console.log("[NostrPassButton] User is authenticated with identity info"),this.currentUser={identityIndex:e.user.identityIndex||0,publicKey:e.user.publicKey||"",npub:e.user.npub,nickname:e.user.nickname,authorized:e.user.authorized||!1,avatar:e.user.avatar},this.isCheckingAuth=!1,this.saveSession(this.currentUser),this.render(),this.config.onLogin&&this.config.onLogin(this.currentUser),!0;if(e.isLocked){console.log("[NostrPassButton] Vault is locked, checking for saved session");const t=localStorage.getItem("nostrpass_session");if(t)try{return this.currentUser=JSON.parse(t),this.isCheckingAuth=!1,this.render(),console.log("[NostrPassButton] Restored session from localStorage while vault locked"),!0}catch(i){console.error("[NostrPassButton] Failed to parse saved session:",i)}return console.log("[NostrPassButton] No saved session available"),this.isCheckingAuth=!1,this.clearSession(),!1}}return console.log("[NostrPassButton] Not authenticated - clearing stale session"),this.isCheckingAuth=!1,this.clearSession(),!1}catch(e){return console.log("[NostrPassButton] Could not get auth status:",e),this.isCheckingAuth=!1,this.clearSession(),!1}}catch(e){return console.warn("[NostrPassButton] Failed to restore NostrPass session:",e),this.isCheckingAuth=!1,this.render(),!1}}startAuthPolling(){this.authPollingInterval=window.setInterval(async()=>{if(this.currentUser)try{const e=await this.embassy.getAuthStatus();e!=null&&e.isAuthenticated||(console.log("[NostrPassButton] 🚨 Auth polling detected session lost - logging out"),this.handleLogoutEvent())}catch(e){console.warn("[NostrPassButton] Auth polling failed:",e)}},3e4)}stopAuthPolling(){this.authPollingInterval!==null&&(window.clearInterval(this.authPollingInterval),this.authPollingInterval=null)}getUser(){return this.currentUser}getElement(){return this.container}destroy(){this.stopAuthPolling(),this.container.remove()}}const R=typeof window<"u"&&(window.location.hostname==="localhost"||window.location.hostname==="127.0.0.1")?"http://localhost:3001":"https://vault.nostrpass.com";function $(){if(typeof window>"u")return!1;try{return window.location.origin===R}catch{return!1}}function H(){return typeof window>"u"||typeof navigator>"u"?"iframe-fallback":$()&&typeof SharedWorker<"u"?"shared-worker":/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)&&"serviceWorker"in navigator?"service-worker":"iframe-fallback"}async function W(h){const e=H();switch(console.log(`[Transport] Creating transport with mode: ${e}`),e){case"shared-worker":{const{SharedWorkerTransport:t}=await Promise.resolve().then(()=>Y);return new t}case"service-worker":{const{ServiceWorkerTransport:t}=await Promise.resolve().then(()=>J);return new t}case"iframe-fallback":default:throw new Error("iframe-fallback mode should use existing Embassy implementation")}}class C extends Error{constructor(e,t,i){super(e),this.code=t,this.details=i,this.name="TransportError"}}class _ extends C{constructor(e,t){super(`Request timeout after ${t}ms`,"TIMEOUT",{method:e,timeout:t}),this.name="TransportTimeoutError"}}class D extends C{constructor(){super("Transport is disconnected","DISCONNECTED"),this.name="TransportDisconnectedError"}}const V={login:{route:"",defaultSize:"minimal"},unlock:{route:"/unlock-modal",defaultSize:"thin",autoCloseOnSuccess:!0},dashboard:{route:"/dashboard",defaultSize:"full"},account:{route:"/account-picker",defaultSize:"tall",autoCloseOnSuccess:!0},permission:{route:"/permission-request",defaultSize:"tall",autoCloseOnSuccess:!0}};class z{constructor(e={}){w(this,"config");w(this,"iframe",null);w(this,"_isReady",!1);w(this,"styleElement",null);w(this,"backdropEl",null);w(this,"messenger",null);w(this,"transport",null);w(this,"handlers",[]);w(this,"isPromptOpen",!1);w(this,"unlockResolvers",[]);w(this,"permissionResolvers",[]);w(this,"authResolvers",[]);w(this,"outsideClickHandler",null);const t=window.location.host;this.config={appName:e.appName||document.title||"Unknown App",appDomain:t,permissions:e.permissions,vaultUrl:e.vaultUrl||"https://vault.nostrpass.com",trustedOrigins:e.trustedOrigins,theme:e.theme||"auto",debug:e.debug||!1,parentPinOverlay:e.parentPinOverlay??!1,storageEnvironment:e.storageEnvironment,namespace:e.namespace},console.log("🚀 NostrPass Embassy v1.0.14 | Vault:",this.config.vaultUrl),this.config.debug||typeof localStorage<"u"&&localStorage.getItem("nostrpass:debug")==="true"||(console.log=()=>{},console.info=()=>{}),this.handlers=Object.keys(U(this)),this.config.debug&&console.log("🚀 NostrPass Embassy initialized",this.config),this.injectStyles(),window.addEventListener("permission-granted",()=>{console.log("✅ [Embassy] Permission granted event received, notifying resolvers"),this.notifyPermissionGranted()}),document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>this.createIframe()):this.createIframe()}sleep(e){return new Promise(t=>setTimeout(t,e))}waitForUnlock(){return new Promise(e=>{this.unlockResolvers.push(e),setTimeout(()=>{const t=this.unlockResolvers.indexOf(e);t>-1&&(this.unlockResolvers.splice(t,1),e())},6e4)})}waitForPermission(){return new Promise(e=>{this.permissionResolvers.push(e),setTimeout(()=>{const t=this.permissionResolvers.indexOf(e);t>-1&&(this.permissionResolvers.splice(t,1),e())},6e4)})}waitForAuth(){return new Promise(e=>{this.authResolvers.push(e),setTimeout(()=>{const t=this.authResolvers.indexOf(e);t>-1&&(this.authResolvers.splice(t,1),e())},3e5)})}notifyUnlocked(){for(console.log("🔓 Notifying unlock resolvers:",this.unlockResolvers.length);this.unlockResolvers.length>0;){const e=this.unlockResolvers.shift();e&&e()}}notifyPermissionGranted(){for(console.log("✅ Notifying permission resolvers:",this.permissionResolvers.length);this.permissionResolvers.length>0;){const e=this.permissionResolvers.shift();e&&e()}}notifyAuthenticated(){for(console.log("🔐 Notifying auth resolvers:",this.authResolvers.length);this.authResolvers.length>0;){const e=this.authResolvers.shift();e&&e()}}promptPin(){return new Promise(e=>{var L;if(this.isPromptOpen)return e(!1);this.isPromptOpen=!0;const t=v=>v.sort(()=>Math.random()-.5);(L=document.getElementById("np-pin-overlay"))==null||L.remove();const i=document.createElement("div");i.id="np-pin-overlay",Object.assign(i.style,{position:"fixed",inset:"0",background:"rgba(0,0,0,0.5)",zIndex:"2147483647",display:"flex",alignItems:"center",justifyContent:"center"});const o=document.createElement("div");Object.assign(o.style,{padding:"16px",borderRadius:"8px",width:"320px",maxWidth:"90vw",fontFamily:"system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"});const a=document.createElement("h3");a.textContent="Unlock Vault",Object.assign(a.style,{margin:"0 0 8px",fontSize:"16px"});const r=document.createElement("p");r.textContent="Enter your PIN to continue.",Object.assign(r.style,{margin:"0 0 12px",color:"#555",fontSize:"13px"});const p=document.createElement("div");Object.assign(p.style,{display:"flex",justifyContent:"center",gap:"12px",marginBottom:"12px"});const c=v=>{p.innerHTML="";for(let N=0;N<6;N++){const A=document.createElement("div");A.style.width="12px",A.style.height="12px",A.style.borderRadius="9999px",A.style.border="2px solid "+(N<v?"#111":"#d1d5db"),p.appendChild(A)}},n=document.createElement("div");Object.assign(n.style,{display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:"10px",width:"240px",margin:"0 auto"});const s=v=>{const N=document.createElement("button");return N.textContent=v,Object.assign(N.style,{width:"76px",height:"56px",border:"1px solid #d1d5db",borderRadius:"8px",fontWeight:"600",cursor:"pointer"}),N},d=v=>{const N=document.createElement("button");return N.textContent=v,Object.assign(N.style,{height:"44px",border:"1px solid #d1d5db",borderRadius:"8px",background:"#fff",cursor:"pointer"}),N};let l="";const u=t(["1","2","3","4","5","6","7","8","9","0"]),m=()=>{this.isPromptOpen=!1,i.remove()},E=async()=>{try{const v=await this.messenger.request("UNLOCK_WITH_PIN",{pin:l});if(v!=null&&v.success)m(),e(!0);else{for(l="",c(0);n.firstChild;)n.removeChild(n.firstChild);t(u),b()}}catch{l="",c(0)}},f=v=>{l.length>=6||(l+=v,c(l.length),l.length===6&&E())},g=()=>{l&&(l=l.slice(0,-1),c(l.length))},b=()=>{u.forEach(A=>{const B=s(A);B.addEventListener("click",()=>f(A)),n.appendChild(B)});const v=d("← Delete");v.style.gridColumn="span 2",v.addEventListener("click",g),n.appendChild(v);const N=document.createElement("div");n.appendChild(N)},x=document.createElement("div");Object.assign(x.style,{display:"flex",gap:"8px",marginTop:"12px",justifyContent:"flex-end"});const P=d("Cancel");P.addEventListener("click",()=>{m(),e(!1)}),x.appendChild(P),o.appendChild(a),o.appendChild(r),o.appendChild(p),c(0),b(),o.appendChild(n),o.appendChild(x),i.appendChild(o),document.body.appendChild(i)})}requestPinUnlock(){return this.promptPin()}async createIframe(){if(this.iframe){this.config.debug&&console.log("Iframe already exists");return}return new Promise((e,t)=>{var o,a;this.iframe=document.createElement("iframe"),this.iframe.id="nostrpass-vault-iframe";const i=new URL(this.config.vaultUrl+"/"+q(this.config.appDomain));i.searchParams.set("appName",this.config.appName),i.searchParams.set("appDomain",this.config.appDomain),i.searchParams.set("theme",this.config.theme),this.config.storageEnvironment&&i.searchParams.set("storageEnvironment",this.config.storageEnvironment),this.config.namespace&&i.searchParams.set("namespace",this.config.namespace),((o=this.config.vaultUrl)!=null&&o.includes("localhost")||(a=this.config.vaultUrl)!=null&&a.includes("127.0.0.1"))&&i.searchParams.set("_t",Date.now().toString()),this.iframe.src=i.toString(),console.log("[Embassy] Creating iframe with:",{appDomain:this.config.appDomain,sanitized:q(this.config.appDomain),iframeSrc:i.toString()}),this.iframe.setAttribute("sandbox","allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"),this.iframe.setAttribute("allow","publickey-credentials-create; publickey-credentials-get; clipboard-write"),this.iframe.setAttribute("aria-hidden","true"),this.iframe.setAttribute("tabindex","-1"),this.iframe.setAttribute("title","NostrPass Vault"),this.iframe.className="nostrpass-iframe nostrpass-iframe-hidden",this.iframe.style.background="transparent",this.iframe.style.backgroundColor="transparent",this.iframe.setAttribute("allowtransparency","true"),this.config.debug&&new URLSearchParams(window.location.search).has("embassy-debug")&&(this.iframe.classList.add("nostrpass-iframe-debug"),this.iframe.classList.remove("nostrpass-iframe-hidden")),this.initializeMessenger(),this.iframe.onload=()=>{this.config.debug&&console.log("Iframe loaded successfully"),setTimeout(()=>{this.config.debug&&console.log("Iframe initialization period complete");const r=(p=1)=>{this.messenger&&!this._isReady&&(this.messenger.send("EMBASSY_HANDSHAKE",{origin:window.location.origin,appName:this.config.appName,appDomain:this.config.appDomain,timestamp:Date.now(),attempt:p}),console.log(`[Embassy] Sent handshake to vault (attempt ${p})`),p<5&&setTimeout(()=>{this._isReady||r(p+1)},200*p))};r(),e()},100)},this.iframe.onerror=()=>{console.error("Failed to load NostrPass vault"),t(new Error("Failed to load vault iframe"))},this.backdropEl||(this.backdropEl=document.createElement("div"),this.backdropEl.className="nostrpass-backdrop",this.backdropEl.addEventListener("click",r=>{console.log("🎯 Backdrop clicked"),r.stopPropagation(),this.hide()})),document.body.appendChild(this.backdropEl),document.body.appendChild(this.iframe),this.config.debug&&console.log("Iframe created and added to DOM"),this.initializeTransport()})}async initializeTransport(){var e;if(!this.config.useDirectWorker){this.config.debug&&console.log("🔌 Transport layer disabled (useDirectWorker: false)");return}try{this.config.debug&&console.log("🔌 Initializing transport layer..."),this.transport=await W(),await this.transport.connect(),this.config.debug&&console.log("✅ Transport layer connected:",(e=this.transport)==null?void 0:e.constructor.name)}catch(t){console.error("❌ Failed to initialize transport layer:",t),this.transport=null}}useTransportForRequest(){var e;return!!(this.config.useDirectWorker&&((e=this.transport)!=null&&e.isConnected()))}openPage(e,t){if(!this.iframe){console.warn("Cannot show iframe - not created yet"),this.createIframe().then(()=>this.openPage(e,t));return}const i=V[e],o=(t==null?void 0:t.size)||i.defaultSize,a=t==null?void 0:t.buttonElement,r=(t==null?void 0:t.queryParams)||{},p=q(this.config.appDomain),c=i.route?`/${p}${i.route}`:`/${p}`,n=Object.keys(r).length>0?"?"+new URLSearchParams(r).toString():"",s=c+n,d=new URL(this.iframe.src);if(d.pathname+d.search!==s&&this.messenger&&this.messenger.request(y.NAVIGATE,{path:s}).then(()=>{console.log("🔄 Navigated vault to:",e,"at path",s)}).catch(u=>{console.error("Navigation failed, falling back to iframe reload:",u);const m=new URL(this.config.vaultUrl);m.pathname=c,m.searchParams.set("appName",this.config.appName),m.searchParams.set("appDomain",this.config.appDomain),m.searchParams.set("theme",this.config.theme),this.config.storageEnvironment&&m.searchParams.set("storageEnvironment",this.config.storageEnvironment),this.config.namespace&&m.searchParams.set("namespace",this.config.namespace),Object.keys(r).forEach(E=>{m.searchParams.set(E,r[E])}),this.iframe&&(this.iframe.src=m.toString(),console.log("🔄 Opening vault page (fallback):",e,"at",m.toString()))}),this.iframe.classList.remove("nostrpass-iframe-hidden"),this.iframe.classList.remove("nostrpass-iframe-visible"),this.iframe.classList.remove("nostrpass-iframe-compact"),this.iframe.classList.remove("nostrpass-iframe-tall"),this.iframe.classList.remove("nostrpass-iframe-minimal"),this.iframe.classList.remove("nostrpass-iframe-thin"),this.iframe.style.top="",this.iframe.style.left="",this.iframe.style.transform="",o==="minimal")this.iframe.classList.add("nostrpass-iframe-minimal");else if(o==="compact"||o==="tall"||o==="thin")if(this.iframe.classList.add(o==="tall"?"nostrpass-iframe-tall":o==="thin"?"nostrpass-iframe-thin":"nostrpass-iframe-compact"),a){const u=a.getBoundingClientRect(),m=window.innerHeight-u.bottom,E=u.top,f=o==="thin"?228:395,g=o==="tall"?600:o==="thin"?422:395,b=8;let x,P;if(m>=g+b)x=u.bottom+b;else if(E>=g+b)x=u.top-g-b;else{this.iframe.style.top="50%",this.iframe.style.left="50%",this.iframe.style.transform="translate(-50%, -50%)";return}u.left+u.width/2>window.innerWidth/2?P=u.right-f:P=u.left,P+f>window.innerWidth-b&&(P=window.innerWidth-f-b),P<b&&(P=b),this.iframe.style.top=`${x}px`,this.iframe.style.left=`${P}px`,this.iframe.style.transform="none"}else this.iframe.style.top="50%",this.iframe.style.left="50%",this.iframe.style.transform="translate(-50%, -50%)";else this.iframe.classList.add("nostrpass-iframe-visible");this.backdropEl&&(this.backdropEl.classList.add("visible"),this.backdropEl.style.background="transparent",this.backdropEl.style.backdropFilter="none"),(o==="compact"||o==="tall"||o==="thin")&&(this.outsideClickHandler&&document.removeEventListener("click",this.outsideClickHandler),setTimeout(()=>{this.outsideClickHandler=u=>{const m=u.target;this.iframe&&!this.iframe.contains(m)&&this.backdropEl&&this.backdropEl===m&&(console.log("🎯 Click outside iframe detected"),this.hide())},document.addEventListener("click",this.outsideClickHandler)},100)),this.iframe.setAttribute("aria-hidden","false"),this.iframe.removeAttribute("tabindex"),document.body.style.overflow="hidden"}show(e="vault",t="full",i){let o;e==="unlock"||e==="unlock-modal"?o="unlock":e==="dashboard"?o="dashboard":o="login",this.openPage(o,{size:t,buttonElement:i})}hide(){if(console.log("🔙 Embassy hide() method called"),!this.iframe){console.warn("Cannot hide iframe - not created yet");return}console.log("🔙 Hiding iframe, current classes:",this.iframe.className),this.iframe.classList.remove("nostrpass-iframe-visible"),this.iframe.classList.remove("nostrpass-iframe-compact"),this.iframe.classList.remove("nostrpass-iframe-tall"),this.iframe.classList.remove("nostrpass-iframe-minimal"),this.iframe.classList.remove("nostrpass-iframe-thin"),this.iframe.classList.add("nostrpass-iframe-hidden"),this.backdropEl&&this.backdropEl.classList.remove("visible"),this.outsideClickHandler&&(document.removeEventListener("click",this.outsideClickHandler),this.outsideClickHandler=null),this.iframe.setAttribute("aria-hidden","true"),this.iframe.setAttribute("tabindex","-1"),document.body.style.overflow="",console.log("🔙 Iframe hidden, new classes:",this.iframe.className),this.config.debug&&console.log("Iframe hidden")}injectStyles(){this.styleElement||(this.styleElement=document.createElement("style"),this.styleElement.id="nostrpass-embassy-styles",this.styleElement.textContent=`
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
    `,document.head.appendChild(this.styleElement),this.config.debug&&console.log("Styles injected"))}initializeMessenger(){if(!this.iframe)return;this.messenger=new T(window),this.messenger.sendMessage=t=>{var o;if(!((o=this.iframe)!=null&&o.contentWindow)){console.error("Iframe contentWindow not available");return}const i=new URL(this.iframe.src).origin;this.iframe.contentWindow.postMessage(t,i)};let e;if(this.config.trustedOrigins&&this.config.trustedOrigins.length>0?e=[...this.config.trustedOrigins]:e=["https://nostrpass.com","https://app.nostrpass.com","https://www.nostrpass.com"],this.config.vaultUrl)try{const t=new URL(this.config.vaultUrl).origin;e.includes(t)||e.push(t)}catch(t){console.warn("Failed to parse vaultUrl origin:",t)}(this.iframe.src.includes("localhost")||this.iframe.src.includes("127.0.0.1"))&&(e.includes("http://localhost:3001")||e.push("http://localhost:3001"),e.includes("http://127.0.0.1:3001")||e.push("http://127.0.0.1:3001")),this.messenger.init(e),this.setupMessageHandlers(),this.config.debug&&console.log("Messenger initialized with trusted origins:",e)}setupMessageHandlers(){if(!this.messenger)return;const e=U(this);console.log("Setting up message handlers:",this.handlers),this.handlers.forEach(t=>{console.log("Registering handler for:",t),this.messenger.on(t,e[t])}),this.config.debug&&console.log("Message handlers registered:",this.messenger.messageHandlers)}async getPublicKey(e){var t,i;(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());try{let o=e==null?void 0:e.identityIndex;if(o==null)try{const c=await this.getAuthStatus();o=((t=c==null?void 0:c.user)==null?void 0:t.identityIndex)??0}catch{o=0}let a=null,r=null;try{const c=await this.messenger.request(y.CHECK_PERMISSION,{action:"getPublicKey",identityIndex:o}),n=(c==null?void 0:c.isLocked)===!0,s=(c==null?void 0:c.needsPrompt)===!0;if(n&&this.config.parentPinOverlay){if(!await this.requestPinUnlock())throw new Error("User canceled PIN prompt")}else if(n&&!this.config.parentPinOverlay)console.log("⏳ Vault is locked, showing quick unlock..."),a=this.waitForUnlock(),this.openPage("unlock");else if(s&&!this.config.parentPinOverlay){console.log("⏳ Permission required, showing vault and waiting for approval..."),r=this.waitForPermission();const d=`${this.config.appDomain}-getPublicKey-${Date.now()}`,l=new URLSearchParams({appOrigin:this.config.appDomain||window.location.host,appName:this.config.appName||document.title,action:"getPublicKey",identityIndex:(o!==void 0?o:0).toString(),requestId:d});await this.messenger.send("NAVIGATE",{path:`/${((i=this.config.appDomain)==null?void 0:i.replace(/[:.]/g,"-"))||"vault"}/permission-request?${l.toString()}`}),this.iframe&&(this.iframe.classList.remove("nostrpass-iframe-hidden"),this.iframe.classList.remove("nostrpass-iframe-compact"),this.iframe.classList.remove("nostrpass-iframe-tall"),this.iframe.classList.remove("nostrpass-iframe-minimal"),this.iframe.classList.add("nostrpass-iframe-visible"),this.backdropEl&&(this.backdropEl.classList.add("visible"),this.backdropEl.style.background="transparent",this.backdropEl.style.backdropFilter="none"),this.iframe.setAttribute("aria-hidden","false"),this.iframe.removeAttribute("tabindex"),document.body.style.overflow="hidden")}}catch(c){String((c==null?void 0:c.message)||c).toLowerCase().includes("not authenticated")&&(console.log("⚠️ User not authenticated, showing full vault for login and waiting for auth..."),a=this.waitForAuth(),this.show("vault","full"))}if(a){console.log("⏳ Waiting for vault unlock..."),await a,console.log("✅ Vault unlocked, continuing operation");try{const c=await this.messenger.request(y.CHECK_PERMISSION,{action:"getPublicKey",identityIndex:o});if((c==null?void 0:c.needsPrompt)===!0){console.log("⏳ Permission required after unlock, showing permission prompt..."),r=this.waitForPermission();const n=`${this.config.appDomain}-getPublicKey-${Date.now()}`,s={appOrigin:this.config.appDomain||window.location.host,appName:this.config.appName||document.title,action:"getPublicKey",identityIndex:(o!==void 0?o:0).toString(),requestId:n};this.openPage("permission",{size:"tall",queryParams:s})}}catch(c){console.warn("Failed to recheck permission after unlock:",c)}}r&&(console.log("⏳ Waiting for permission approval..."),await r,console.log("✅ Permission granted, continuing operation"));let p;return this.useTransportForRequest()?(this.config.debug&&console.log("🔌 Using transport layer for getPublicKey"),p=await this.transport.request("GET_PUBLIC_KEY",{appName:this.config.appName,appDomain:this.config.appDomain,identityIndex:o})):p=await this.messenger.request(y.GET_PUBLIC_KEY,{appName:this.config.appName,appDomain:this.config.appDomain,identityIndex:o}),this.config.debug&&console.log("Public key received:",p),this.hide(),p.publicKey||p}catch(o){throw console.error("Failed to get public key:",o),o}}async signEvent(e,t){var i,o;(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());try{let a=t==null?void 0:t.identityIndex;if(a==null)try{const n=await this.getAuthStatus();a=((i=n==null?void 0:n.user)==null?void 0:i.identityIndex)??0}catch{a=0}let r=null,p=null;try{const n=await this.messenger.request(y.CHECK_PERMISSION,{action:"signEvent",eventKind:e==null?void 0:e.kind,identityIndex:a}),s=(n==null?void 0:n.isLocked)===!0,d=(n==null?void 0:n.needsPrompt)===!0;if(s&&this.config.parentPinOverlay){if(!await this.requestPinUnlock())throw new Error("User canceled PIN prompt")}else if(s&&!this.config.parentPinOverlay)console.log("⏳ Vault is locked, showing quick unlock..."),r=this.waitForUnlock(),this.openPage("unlock");else if(d&&!this.config.parentPinOverlay){console.log("⏳ Permission required, showing vault and waiting for approval..."),p=this.waitForPermission();const l=`${this.config.appDomain}-signEvent-${Date.now()}`,u=new URLSearchParams({appOrigin:this.config.appDomain||window.location.host,appName:this.config.appName||document.title,action:"signEvent",identityIndex:(a!==void 0?a:0).toString(),requestId:l,eventKind:((e==null?void 0:e.kind)||0).toString(),event:JSON.stringify(e)});await this.messenger.send("NAVIGATE",{path:`/${((o=this.config.appDomain)==null?void 0:o.replace(/[:.]/g,"-"))||"vault"}/permission-request?${u.toString()}`}),this.iframe&&(this.iframe.classList.remove("nostrpass-iframe-hidden"),this.iframe.classList.remove("nostrpass-iframe-compact"),this.iframe.classList.remove("nostrpass-iframe-tall"),this.iframe.classList.remove("nostrpass-iframe-minimal"),this.iframe.classList.add("nostrpass-iframe-visible"),this.backdropEl&&(this.backdropEl.classList.add("visible"),this.backdropEl.style.background="transparent",this.backdropEl.style.backdropFilter="none"),this.iframe.setAttribute("aria-hidden","false"),this.iframe.removeAttribute("tabindex"),document.body.style.overflow="hidden")}}catch(n){String((n==null?void 0:n.message)||n).toLowerCase().includes("not authenticated")&&(console.log("⚠️ User not authenticated, showing full vault for login"),this.show("vault","full"))}if(r){console.log("⏳ Waiting for vault unlock..."),await r,console.log("✅ Vault unlocked, continuing operation");try{const n=await this.messenger.request(y.CHECK_PERMISSION,{action:"signEvent",eventKind:e==null?void 0:e.kind,identityIndex:a});if((n==null?void 0:n.needsPrompt)===!0){console.log("⏳ Permission required after unlock, showing permission prompt..."),p=this.waitForPermission();const s=`${this.config.appDomain}-signEvent-${Date.now()}`,d={appOrigin:this.config.appDomain||window.location.host,appName:this.config.appName||document.title,action:"signEvent",identityIndex:(a!==void 0?a:0).toString(),requestId:s,eventKind:((e==null?void 0:e.kind)||0).toString(),event:JSON.stringify(e)};this.openPage("permission",{size:"tall",queryParams:d})}}catch(n){console.warn("Failed to recheck permission after unlock:",n)}}p&&(console.log("⏳ Waiting for permission approval..."),await p,console.log("✅ Permission granted, continuing operation"));const c=async()=>this.useTransportForRequest()?(this.config.debug&&console.log("🔌 Using transport layer for signEvent"),this.transport.request("SIGN_EVENT",{event:e,appName:this.config.appName,appDomain:this.config.appDomain,identityIndex:a})):this.messenger.request(y.SIGN_EVENT,{event:e,appName:this.config.appName,appDomain:this.config.appDomain,identityIndex:a});try{const n=await c();return this.config.debug&&console.log("Signed event received:",n),this.hide(),n.signedEvent||n}catch(n){const s=String((n==null?void 0:n.message)||n);if(s.toLowerCase().includes("vault is locked")||s.toLowerCase().includes("rehydrated")){if(console.log("🔒 Vault locked or session needs keys, triggering unlock..."),this.config.parentPinOverlay){if(!await this.requestPinUnlock())throw new Error("User canceled PIN prompt")}else{const l=this.waitForUnlock();this.openPage("unlock"),await l}console.log("🔓 Vault unlocked, retrying operation...");const d=await c();return this.config.debug&&console.log("Signed event received (after unlock):",d),this.hide(),d.signedEvent||d}throw n}}catch(a){throw console.error("Failed to sign event:",a),a}}async getRelays(){return console.log("TODO: getRelays"),{}}async signData(e,t){var i,o;(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());try{let a=t==null?void 0:t.identityIndex;if(a==null)try{const n=await this.getAuthStatus();a=((i=n==null?void 0:n.user)==null?void 0:i.identityIndex)??0}catch{a=0}let r=null,p=null;try{console.log("🔍 [signData] Calling CHECK_PERMISSION preflight...");const n=await this.messenger.request(y.CHECK_PERMISSION,{action:"signData",identityIndex:a});console.log("🔍 [signData] CHECK_PERMISSION result:",n);const s=(n==null?void 0:n.isLocked)===!0,d=(n==null?void 0:n.needsPrompt)===!0;if(console.log("🔍 [signData] needsPin:",s,"needsPrompt:",d),s&&this.config.parentPinOverlay){if(!await this.requestPinUnlock())throw new Error("User canceled PIN prompt")}else if(s&&!this.config.parentPinOverlay)console.log("⏳ Vault is locked, showing quick unlock..."),r=this.waitForUnlock(),this.openPage("unlock");else if(d&&!this.config.parentPinOverlay){console.log("⏳ Permission required, showing vault and waiting for approval..."),p=this.waitForPermission();const l=`${this.config.appDomain}-signData-${Date.now()}`,u=new URLSearchParams({appOrigin:this.config.appDomain||window.location.host,appName:this.config.appName||document.title,action:"signData",identityIndex:(a!==void 0?a:0).toString(),requestId:l,data:e});console.log("📍 Navigating to permission-request page..."),await this.messenger.send("NAVIGATE",{path:`/${((o=this.config.appDomain)==null?void 0:o.replace(/[:.]/g,"-"))||"vault"}/permission-request?${u.toString()}`}),console.log("👁️ Making iframe visible for permission prompt..."),this.iframe?(console.log("👁️ Current iframe classes:",this.iframe.className),this.iframe.classList.remove("nostrpass-iframe-hidden"),this.iframe.classList.remove("nostrpass-iframe-compact"),this.iframe.classList.remove("nostrpass-iframe-tall"),this.iframe.classList.remove("nostrpass-iframe-minimal"),this.iframe.classList.add("nostrpass-iframe-visible"),console.log("👁️ New iframe classes:",this.iframe.className),this.backdropEl&&(this.backdropEl.classList.add("visible"),this.backdropEl.style.background="transparent",this.backdropEl.style.backdropFilter="none",console.log("👁️ Backdrop shown")),this.iframe.setAttribute("aria-hidden","false"),this.iframe.removeAttribute("tabindex"),document.body.style.overflow="hidden",console.log("👁️ Iframe should now be visible!")):console.error("❌ No iframe element found!")}}catch(n){console.error("❌ [signData] CHECK_PERMISSION preflight failed:",n),String((n==null?void 0:n.message)||n).toLowerCase().includes("not authenticated")&&(console.log("⚠️ User not authenticated, showing full vault for login"),this.show("vault","full"))}if(r){console.log("⏳ Waiting for vault unlock..."),await r,console.log("✅ Vault unlocked, continuing operation");try{const n=await this.messenger.request(y.CHECK_PERMISSION,{action:"signData",identityIndex:a});if((n==null?void 0:n.needsPrompt)===!0){console.log("⏳ Permission required after unlock, showing permission prompt..."),p=this.waitForPermission();const s=`${this.config.appDomain}-signData-${Date.now()}`,d={appOrigin:this.config.appDomain||window.location.host,appName:this.config.appName||document.title,action:"signData",identityIndex:(a!==void 0?a:0).toString(),requestId:s,data:e};this.openPage("permission",{size:"tall",queryParams:d})}}catch(n){console.warn("Failed to recheck permission after unlock:",n)}}p&&(console.log("⏳ Waiting for permission approval..."),await p,console.log("✅ Permission granted, continuing operation"));const c=async()=>this.useTransportForRequest()?(this.config.debug&&console.log("🔌 Using transport layer for signData"),this.transport.request("SIGN_DATA",{data:e,appName:this.config.appName,appDomain:this.config.appDomain,identityIndex:a})):this.messenger.request(y.SIGN_DATA,{data:e,appName:this.config.appName,appDomain:this.config.appDomain,identityIndex:a});try{const n=await c(),s=(n==null?void 0:n.signature)??n;return this.config.debug&&console.log("Signed data received:",s),this.hide(),s}catch(n){const s=String((n==null?void 0:n.message)||n);if(s.toLowerCase().includes("locked")||s.toLowerCase().includes("unlock")||s.toLowerCase().includes("rehydrated")){await this.sleep(150);try{const d=await c();return this.hide(),(d==null?void 0:d.signature)??d}catch(d){if(String((d==null?void 0:d.message)||d).toLowerCase().includes("rehydrated")){await this.sleep(200);const u=await c();return this.hide(),(u==null?void 0:u.signature)??u}throw d}}throw n}}catch(a){throw console.error("Failed to sign data:",a),a}}async encrypt(e,t,i){var o,a;(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());try{let r=i==null?void 0:i.identityIndex;if(r==null)try{const s=await this.getAuthStatus();r=((o=s==null?void 0:s.user)==null?void 0:o.identityIndex)??0}catch{r=0}let p=null,c=null;try{const s=await this.messenger.request(y.CHECK_PERMISSION,{action:"nip04",identityIndex:r}),d=(s==null?void 0:s.isLocked)===!0,l=(s==null?void 0:s.needsPrompt)===!0;if(d&&this.config.parentPinOverlay){if(!await this.requestPinUnlock())throw new Error("User canceled PIN prompt")}else if(d&&!this.config.parentPinOverlay)console.log("⏳ Vault is locked, showing quick unlock..."),p=this.waitForUnlock(),this.openPage("unlock");else if(l&&!this.config.parentPinOverlay){console.log("⏳ Permission required, showing vault and waiting for approval..."),c=this.waitForPermission();const u=`${this.config.appDomain}-nip04-encrypt-${Date.now()}`,m=new URLSearchParams({appOrigin:this.config.appDomain||window.location.host,appName:this.config.appName||document.title,action:"nip04",identityIndex:(r!==void 0?r:0).toString(),requestId:u,pubkey:e,plaintext:t});await this.messenger.send("NAVIGATE",{path:`/${((a=this.config.appDomain)==null?void 0:a.replace(/[:.]/g,"-"))||"vault"}/permission-request?${m.toString()}`}),this.iframe&&(this.iframe.classList.remove("nostrpass-iframe-hidden"),this.iframe.classList.remove("nostrpass-iframe-compact"),this.iframe.classList.remove("nostrpass-iframe-tall"),this.iframe.classList.remove("nostrpass-iframe-minimal"),this.iframe.classList.add("nostrpass-iframe-visible"),this.backdropEl&&(this.backdropEl.classList.add("visible"),this.backdropEl.style.background="transparent",this.backdropEl.style.backdropFilter="none"),this.iframe.setAttribute("aria-hidden","false"),this.iframe.removeAttribute("tabindex"),document.body.style.overflow="hidden")}}catch(s){String((s==null?void 0:s.message)||s).toLowerCase().includes("not authenticated")&&(console.log("⚠️ User not authenticated, showing full vault for login"),this.show("vault","full"))}if(p){console.log("⏳ Waiting for vault unlock..."),await p,console.log("✅ Vault unlocked, continuing operation");try{const s=await this.messenger.request(y.CHECK_PERMISSION,{action:"nip04",identityIndex:r});if((s==null?void 0:s.needsPrompt)===!0){console.log("⏳ Permission required after unlock, showing permission prompt..."),c=this.waitForPermission();const d=`${this.config.appDomain}-nip04-encrypt-${Date.now()}`,l={appOrigin:this.config.appDomain||window.location.host,appName:this.config.appName||document.title,action:"nip04",identityIndex:(r!==void 0?r:0).toString(),requestId:d,pubkey:e,plaintext:t};this.openPage("permission",{size:"tall",queryParams:l})}}catch(s){console.warn("Failed to recheck permission after unlock:",s)}}c&&(console.log("⏳ Waiting for permission approval..."),await c,console.log("✅ Permission granted, continuing operation"));const n=async()=>this.useTransportForRequest()?(this.config.debug&&console.log("🔌 Using transport layer for encrypt"),this.transport.request("ENCRYPT",{plaintext:t,recipientPubkey:e,appName:this.config.appName,appDomain:this.config.appDomain,identityIndex:r})):this.messenger.request(y.ENCRYPT,{plaintext:t,recipientPubkey:e,appName:this.config.appName,appDomain:this.config.appDomain,identityIndex:r});try{const s=await n();return this.config.debug&&console.log("Encrypted payload received:",s),this.hide(),s}catch(s){const d=String((s==null?void 0:s.message)||s);if(d.toLowerCase().includes("locked")||d.toLowerCase().includes("unlock")||d.toLowerCase().includes("rehydrated")){await this.sleep(150);try{const l=await n();return this.hide(),l}catch(l){if(String((l==null?void 0:l.message)||l).toLowerCase().includes("rehydrated")){await this.sleep(200);const m=await n();return this.hide(),m}throw l}}throw s}}catch(r){throw console.error("Failed to encrypt:",r),r}}async decrypt(e,t,i){var o,a;(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());try{let r=i==null?void 0:i.identityIndex;if(r==null)try{const s=await this.getAuthStatus();r=((o=s==null?void 0:s.user)==null?void 0:o.identityIndex)??0}catch{r=0}let p=null,c=null;try{const s=await this.messenger.request(y.CHECK_PERMISSION,{action:"nip04",identityIndex:r}),d=(s==null?void 0:s.isLocked)===!0,l=(s==null?void 0:s.needsPrompt)===!0;if(d&&this.config.parentPinOverlay){if(!await this.requestPinUnlock())throw new Error("User canceled PIN prompt")}else if(d&&!this.config.parentPinOverlay)console.log("⏳ Vault is locked, showing quick unlock..."),p=this.waitForUnlock(),this.openPage("unlock");else if(l&&!this.config.parentPinOverlay){console.log("⏳ Permission required, showing vault and waiting for approval..."),c=this.waitForPermission();const u=`${this.config.appDomain}-nip04-decrypt-${Date.now()}`,m=new URLSearchParams({appOrigin:this.config.appDomain||window.location.host,appName:this.config.appName||document.title,action:"nip04",identityIndex:(r!==void 0?r:0).toString(),requestId:u,pubkey:e,ciphertext:t});await this.messenger.send("NAVIGATE",{path:`/${((a=this.config.appDomain)==null?void 0:a.replace(/[:.]/g,"-"))||"vault"}/permission-request?${m.toString()}`}),this.iframe&&(this.iframe.classList.remove("nostrpass-iframe-hidden"),this.iframe.classList.remove("nostrpass-iframe-compact"),this.iframe.classList.remove("nostrpass-iframe-tall"),this.iframe.classList.remove("nostrpass-iframe-minimal"),this.iframe.classList.add("nostrpass-iframe-visible"),this.backdropEl&&(this.backdropEl.classList.add("visible"),this.backdropEl.style.background="transparent",this.backdropEl.style.backdropFilter="none"),this.iframe.setAttribute("aria-hidden","false"),this.iframe.removeAttribute("tabindex"),document.body.style.overflow="hidden")}}catch(s){String((s==null?void 0:s.message)||s).toLowerCase().includes("not authenticated")&&(console.log("⚠️ User not authenticated, showing full vault for login"),this.show("vault","full"))}if(p){console.log("⏳ Waiting for vault unlock..."),await p,console.log("✅ Vault unlocked, continuing operation");try{const s=await this.messenger.request(y.CHECK_PERMISSION,{action:"nip04",identityIndex:r});if((s==null?void 0:s.needsPrompt)===!0){console.log("⏳ Permission required after unlock, showing permission prompt..."),c=this.waitForPermission();const d=`${this.config.appDomain}-nip04-decrypt-${Date.now()}`,l={appOrigin:this.config.appDomain||window.location.host,appName:this.config.appName||document.title,action:"nip04",identityIndex:(r!==void 0?r:0).toString(),requestId:d,pubkey:e,ciphertext:t};this.openPage("permission",{size:"tall",queryParams:l})}}catch(s){console.warn("Failed to recheck permission after unlock:",s)}}c&&(console.log("⏳ Waiting for permission approval..."),await c,console.log("✅ Permission granted, continuing operation"));const n=async()=>this.useTransportForRequest()?(this.config.debug&&console.log("🔌 Using transport layer for decrypt"),this.transport.request("DECRYPT",{ciphertext:t,senderPubkey:e,appName:this.config.appName,appDomain:this.config.appDomain,identityIndex:r})):this.messenger.request(y.DECRYPT,{ciphertext:t,senderPubkey:e,appName:this.config.appName,appDomain:this.config.appDomain,identityIndex:r});try{const s=await n();return this.config.debug&&console.log("Decrypted payload received:",s),this.hide(),s}catch(s){const d=String((s==null?void 0:s.message)||s);if(d.toLowerCase().includes("locked")||d.toLowerCase().includes("unlock")||d.toLowerCase().includes("rehydrated")){await this.sleep(150);try{const l=await n();return this.hide(),l}catch(l){if(String((l==null?void 0:l.message)||l).toLowerCase().includes("rehydrated")){await this.sleep(200);const m=await n();return this.hide(),m}throw l}}throw s}}catch(r){throw console.error("Failed to decrypt:",r),r}}async nip44Encrypt(e,t,i){var o,a;(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());try{let r=i==null?void 0:i.identityIndex;if(r==null)try{const s=await this.getAuthStatus();r=((o=s==null?void 0:s.user)==null?void 0:o.identityIndex)??0}catch{r=0}let p=null,c=null;try{const s=await this.messenger.request(y.CHECK_PERMISSION,{action:"nip44",identityIndex:r}),d=(s==null?void 0:s.isLocked)===!0,l=(s==null?void 0:s.needsPrompt)===!0;if(d&&this.config.parentPinOverlay){if(!await this.requestPinUnlock())throw new Error("User canceled PIN prompt")}else if(d&&!this.config.parentPinOverlay)console.log("⏳ Vault is locked, showing quick unlock..."),p=this.waitForUnlock(),this.openPage("unlock");else if(l&&!this.config.parentPinOverlay){console.log("⏳ Permission required, showing vault and waiting for approval..."),c=this.waitForPermission();const u=`${this.config.appDomain}-nip44-encrypt-${Date.now()}`,m=new URLSearchParams({appOrigin:this.config.appDomain||window.location.host,appName:this.config.appName||document.title,action:"nip44",identityIndex:(r!==void 0?r:0).toString(),requestId:u,pubkey:e,plaintext:t});await this.messenger.send("NAVIGATE",{path:`/${((a=this.config.appDomain)==null?void 0:a.replace(/[:.]/g,"-"))||"vault"}/permission-request?${m.toString()}`}),this.iframe&&(this.iframe.classList.remove("nostrpass-iframe-hidden"),this.iframe.classList.remove("nostrpass-iframe-compact"),this.iframe.classList.remove("nostrpass-iframe-tall"),this.iframe.classList.remove("nostrpass-iframe-minimal"),this.iframe.classList.add("nostrpass-iframe-visible"),this.backdropEl&&(this.backdropEl.classList.add("visible"),this.backdropEl.style.background="transparent",this.backdropEl.style.backdropFilter="none"),this.iframe.setAttribute("aria-hidden","false"),this.iframe.removeAttribute("tabindex"),document.body.style.overflow="hidden")}}catch(s){String((s==null?void 0:s.message)||s).toLowerCase().includes("not authenticated")&&(console.log("⚠️ User not authenticated, showing full vault for login"),this.show("vault","full"))}if(p){console.log("⏳ Waiting for vault unlock..."),await p,console.log("✅ Vault unlocked, continuing operation");try{const s=await this.messenger.request(y.CHECK_PERMISSION,{action:"nip44",identityIndex:r});if((s==null?void 0:s.needsPrompt)===!0){console.log("⏳ Permission required after unlock, showing permission prompt..."),c=this.waitForPermission();const d=`${this.config.appDomain}-nip44-encrypt-${Date.now()}`,l={appOrigin:this.config.appDomain||window.location.host,appName:this.config.appName||document.title,action:"nip44",identityIndex:(r!==void 0?r:0).toString(),requestId:d,pubkey:e,plaintext:t};this.openPage("permission",{size:"tall",queryParams:l})}}catch(s){console.warn("Failed to recheck permission after unlock:",s)}}c&&(console.log("⏳ Waiting for permission approval..."),await c,console.log("✅ Permission granted, continuing operation"));const n=async()=>this.useTransportForRequest()?(this.config.debug&&console.log("🔌 Using transport layer for nip44 encrypt"),this.transport.request("NIP44_ENCRYPT",{plaintext:t,recipientPubkey:e,appName:this.config.appName,appDomain:this.config.appDomain,identityIndex:r})):this.messenger.request(y.NIP44_ENCRYPT,{plaintext:t,recipientPubkey:e,appName:this.config.appName,appDomain:this.config.appDomain,identityIndex:r});try{const s=await n();return this.config.debug&&console.log("NIP-44 encrypted payload received:",s),this.hide(),s}catch(s){const d=String((s==null?void 0:s.message)||s);if(d.toLowerCase().includes("locked")||d.toLowerCase().includes("unlock")||d.toLowerCase().includes("rehydrated")){await this.sleep(150);try{const l=await n();return this.hide(),l}catch(l){if(String((l==null?void 0:l.message)||l).toLowerCase().includes("rehydrated")){await this.sleep(200);const m=await n();return this.hide(),m}throw l}}throw s}}catch(r){throw console.error("Failed to nip44 encrypt:",r),r}}async nip44Decrypt(e,t,i){var o,a;(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());try{let r=i==null?void 0:i.identityIndex;if(r==null)try{const s=await this.getAuthStatus();r=((o=s==null?void 0:s.user)==null?void 0:o.identityIndex)??0}catch{r=0}let p=null,c=null;try{const s=await this.messenger.request(y.CHECK_PERMISSION,{action:"nip44",identityIndex:r}),d=(s==null?void 0:s.isLocked)===!0,l=(s==null?void 0:s.needsPrompt)===!0;if(d&&this.config.parentPinOverlay){if(!await this.requestPinUnlock())throw new Error("User canceled PIN prompt")}else if(d&&!this.config.parentPinOverlay)console.log("⏳ Vault is locked, showing quick unlock..."),p=this.waitForUnlock(),this.openPage("unlock");else if(l&&!this.config.parentPinOverlay){console.log("⏳ Permission required, showing vault and waiting for approval..."),c=this.waitForPermission();const u=`${this.config.appDomain}-nip44-decrypt-${Date.now()}`,m=new URLSearchParams({appOrigin:this.config.appDomain||window.location.host,appName:this.config.appName||document.title,action:"nip44",identityIndex:(r!==void 0?r:0).toString(),requestId:u,pubkey:e,ciphertext:t});await this.messenger.send("NAVIGATE",{path:`/${((a=this.config.appDomain)==null?void 0:a.replace(/[:.]/g,"-"))||"vault"}/permission-request?${m.toString()}`}),this.iframe&&(this.iframe.classList.remove("nostrpass-iframe-hidden"),this.iframe.classList.remove("nostrpass-iframe-compact"),this.iframe.classList.remove("nostrpass-iframe-tall"),this.iframe.classList.remove("nostrpass-iframe-minimal"),this.iframe.classList.add("nostrpass-iframe-visible"),this.backdropEl&&(this.backdropEl.classList.add("visible"),this.backdropEl.style.background="transparent",this.backdropEl.style.backdropFilter="none"),this.iframe.setAttribute("aria-hidden","false"),this.iframe.removeAttribute("tabindex"),document.body.style.overflow="hidden")}}catch(s){String((s==null?void 0:s.message)||s).toLowerCase().includes("not authenticated")&&(console.log("⚠️ User not authenticated, showing full vault for login"),this.show("vault","full"))}if(p){console.log("⏳ Waiting for vault unlock..."),await p,console.log("✅ Vault unlocked, continuing operation");try{const s=await this.messenger.request(y.CHECK_PERMISSION,{action:"nip44",identityIndex:r});if((s==null?void 0:s.needsPrompt)===!0){console.log("⏳ Permission required after unlock, showing permission prompt..."),c=this.waitForPermission();const d=`${this.config.appDomain}-nip44-decrypt-${Date.now()}`,l={appOrigin:this.config.appDomain||window.location.host,appName:this.config.appName||document.title,action:"nip44",identityIndex:(r!==void 0?r:0).toString(),requestId:d,pubkey:e,ciphertext:t};this.openPage("permission",{size:"tall",queryParams:l})}}catch(s){console.warn("Failed to recheck permission after unlock:",s)}}c&&(console.log("⏳ Waiting for permission approval..."),await c,console.log("✅ Permission granted, continuing operation"));const n=async()=>this.useTransportForRequest()?(this.config.debug&&console.log("🔌 Using transport layer for nip44 decrypt"),this.transport.request("NIP44_DECRYPT",{ciphertext:t,senderPubkey:e,appName:this.config.appName,appDomain:this.config.appDomain,identityIndex:r})):this.messenger.request(y.NIP44_DECRYPT,{ciphertext:t,senderPubkey:e,appName:this.config.appName,appDomain:this.config.appDomain,identityIndex:r});try{const s=await n();return this.config.debug&&console.log("NIP-44 decrypted payload received:",s),this.hide(),s}catch(s){const d=String((s==null?void 0:s.message)||s);if(d.toLowerCase().includes("locked")||d.toLowerCase().includes("unlock")||d.toLowerCase().includes("rehydrated")){await this.sleep(150);try{const l=await n();return this.hide(),l}catch(l){if(String((l==null?void 0:l.message)||l).toLowerCase().includes("rehydrated")){await this.sleep(200);const m=await n();return this.hide(),m}throw l}}throw s}}catch(r){throw console.error("Failed to nip44 decrypt:",r),r}}async getAuthStatus(){(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());try{return await this.messenger.request(y.AUTH_STATUS,{})}catch(e){throw console.error("Failed to get auth status:",e),e}}async getAllIdentities(){(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());try{return await this.messenger.request(y.GET_ALL_IDENTITIES,{})}catch(e){throw console.error("Failed to get all identities:",e),e}}async switchIdentity(e){(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());try{return await this.messenger.request(y.SWITCH_IDENTITY,{identityIndex:e})}catch(t){throw console.error("Failed to switch identity:",t),t}}async logout(){if(!this.iframe||!this.messenger){console.log("[Embassy] No iframe/messenger to logout from");return}try{console.log("[Embassy] Sending LOGOUT message to vault"),await this.messenger.request(y.LOGOUT,{}),console.log("[Embassy] Logout successful")}catch(e){throw console.error("[Embassy] Logout failed:",e),e}}async manageAccount(e={}){(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());const t=e.forcePrompt??!0,i=e.size||"minimal";this.show("vault",i,e.buttonElement);try{const o=await this.messenger.request(y.MANAGE_ACCOUNTS,{appName:this.config.appName,appDomain:this.config.appDomain,forcePrompt:t});return this.hide(),o}catch(o){throw o}}createAccountManagerButton(e={}){const{label:t="Manage NostrPass Account",className:i="nostrpass-account-button",appendTo:o,buttonElement:a,disabledText:r,onSelect:p,onError:c,forcePrompt:n}=e,s=a??document.createElement("button");a?i&&(a.className=i):(s.type="button",s.className=i,s.textContent=t);const d=async l=>{l.preventDefault();const u=s.textContent;try{s.disabled=!0,r&&(s.textContent=r);const m=await this.manageAccount({forcePrompt:n});p==null||p(m)}catch(m){c?c(m):console.error("[NostrPass] Failed to manage account:",m)}finally{s.disabled=!1,r&&u!==void 0&&u!==null&&(s.textContent=u)}};if(s.addEventListener("click",d),o){const l=typeof o=="string"?document.querySelector(o):o;l?s.parentElement||l.appendChild(s):console.warn("[NostrPass] Unable to find target element for account manager button:",o)}return s}createNostrPassButton(e={}){return new M(this,e)}isReady(){return this._isReady}getVaultOrigin(){return new URL(this.config.vaultUrl).origin}async waitForReady(){if(!this._isReady)return new Promise(e=>{const t=()=>{this._isReady?e():setTimeout(t,100)};t()})}destroy(){this.messenger&&(this.messenger.destroy(),this.messenger=null),this.iframe&&this.iframe.parentNode&&(this.iframe.parentNode.removeChild(this.iframe),this.iframe=null),this.backdropEl&&this.backdropEl.parentNode&&(this.backdropEl.parentNode.removeChild(this.backdropEl),this.backdropEl=null),this.styleElement&&this.styleElement.parentNode&&(this.styleElement.parentNode.removeChild(this.styleElement),this.styleElement=null),this._isReady=!1,this.config.debug&&console.log("Embassy destroyed")}}let k=null;function O(h={}){return k&&k.destroy(),k=new z(h),{getPublicKey:t=>k.getPublicKey(t),signEvent:(t,i)=>k.signEvent(t,i),signData:(t,i)=>k.signData(t,i),getRelays:()=>k.getRelays(),nip04:{encrypt:(t,i,o)=>k.encrypt(t,i,o),decrypt:(t,i,o)=>k.decrypt(t,i,o)},manageAccount:t=>k.manageAccount(t),createAccountManagerButton:t=>k.createAccountManagerButton(t),createNostrPassButton:t=>k.createNostrPassButton(t)}}function K(){console.log("showVault"),k==null||k.show()}function j(){k==null||k.hide()}if(typeof window<"u"){window.initNostrPass=O,window.showVault=K,window.hideVault=j;const h=document.currentScript;if((h==null?void 0:h.getAttribute("data-manual-init"))==="true")console.log("✅ NostrPass Embassy loaded (manual init mode)");else{const t={};h!=null&&h.hasAttribute("data-vault-url")&&(t.vaultUrl=h.getAttribute("data-vault-url")||void 0),h!=null&&h.hasAttribute("data-app-name")&&(t.appName=h.getAttribute("data-app-name")||void 0),h!=null&&h.hasAttribute("data-debug")&&(t.debug=h.getAttribute("data-debug")==="true"),h!=null&&h.hasAttribute("data-theme")&&(t.theme=h.getAttribute("data-theme")||void 0);const i=O(t);window.nostr=i,console.log("✅ NostrPass Embassy auto-initialized with config:",t)}console.log("💡 Use window.initNostrPass(config) to customize")}class G{constructor(){w(this,"worker",null);w(this,"port",null);w(this,"connected",!1);w(this,"pendingRequests",new Map);w(this,"requestTimeout",3e4)}async connect(){if(this.connected){console.log("[SharedWorkerTransport] Already connected");return}console.log("[SharedWorkerTransport] Connecting to vault SharedWorker...");try{const e=`${R}/crypto.worker.js`;this.worker=new SharedWorker(e,{name:"nostrpass-vault-worker"}),this.port=this.worker.port,this.port.onmessage=this.handleMessage.bind(this),this.port.onmessageerror=this.handleMessageError.bind(this),this.port.start(),this.connected=!0,console.log("[SharedWorkerTransport] Connected to vault SharedWorker")}catch(e){throw console.error("[SharedWorkerTransport] Failed to connect:",e),new C("Failed to connect to vault SharedWorker","CONNECTION_FAILED",e)}}async request(e,t){if(!this.connected||!this.port)throw new D;const i=this.generateRequestId();return console.log(`[SharedWorkerTransport] Sending request ${i}:`,e,t),new Promise((o,a)=>{const r=setTimeout(()=>{this.pendingRequests.delete(i),a(new _(e,this.requestTimeout))},this.requestTimeout);this.pendingRequests.set(i,{resolve:o,reject:a,timeout:r});try{this.port.postMessage({id:i,method:e,params:t,timestamp:Date.now()})}catch(p){clearTimeout(r),this.pendingRequests.delete(i),a(new C("Failed to send request","SEND_FAILED",p))}})}disconnect(){console.log("[SharedWorkerTransport] Disconnecting...");for(const[,e]of this.pendingRequests.entries())clearTimeout(e.timeout),e.reject(new D);this.pendingRequests.clear(),this.port&&(this.port.close(),this.port=null),this.worker=null,this.connected=!1,console.log("[SharedWorkerTransport] Disconnected")}isConnected(){return this.connected}handleMessage(e){const{id:t,result:i,error:o}=e.data;if(console.log("[SharedWorkerTransport] Received message:",e.data),t&&("result"in e.data||"error"in e.data)){const a=this.pendingRequests.get(t);a&&(clearTimeout(a.timeout),this.pendingRequests.delete(t),o?a.reject(new C(o.message||"Request failed",o.code||"REQUEST_FAILED",o)):a.resolve(i))}}handleMessageError(e){console.error("[SharedWorkerTransport] Message error:",e)}generateRequestId(){return`req_${Date.now()}_${Math.random().toString(36).slice(2,11)}`}}const Y=Object.freeze(Object.defineProperty({__proto__:null,SharedWorkerTransport:G},Symbol.toStringTag,{value:"Module"}));class Q{constructor(){w(this,"worker",null);w(this,"connected",!1);w(this,"pendingRequests",new Map);w(this,"requestTimeout",3e4)}async connect(){if(this.connected){console.log("[DedicatedWorkerTransport] Already connected");return}console.log("[DedicatedWorkerTransport] Connecting to vault Dedicated Worker...");try{const e=`${R}/crypto.worker.js`;this.worker=new Worker(e,{name:"nostrpass-vault-worker-mobile"}),this.worker.onmessage=this.handleMessage.bind(this),this.worker.onmessageerror=this.handleMessageError.bind(this),this.connected=!0,console.log("[DedicatedWorkerTransport] Connected to vault Dedicated Worker")}catch(e){throw console.error("[DedicatedWorkerTransport] Failed to connect:",e),new C("Failed to connect to vault Dedicated Worker","CONNECTION_FAILED",e)}}async request(e,t){if(!this.connected||!this.worker)throw new D;const i=this.generateRequestId();return console.log(`[DedicatedWorkerTransport] Sending request ${i}:`,e,t),new Promise((o,a)=>{const r=setTimeout(()=>{this.pendingRequests.delete(i),a(new _(e,this.requestTimeout))},this.requestTimeout);this.pendingRequests.set(i,{resolve:o,reject:a,timeout:r});try{this.worker.postMessage({id:i,method:e,params:t,timestamp:Date.now()})}catch(p){clearTimeout(r),this.pendingRequests.delete(i),a(new C("Failed to send request","SEND_FAILED",p))}})}disconnect(){console.log("[DedicatedWorkerTransport] Disconnecting...");for(const[,e]of this.pendingRequests.entries())clearTimeout(e.timeout),e.reject(new D);this.pendingRequests.clear(),this.worker&&(this.worker.terminate(),this.worker=null),this.connected=!1,console.log("[DedicatedWorkerTransport] Disconnected")}isConnected(){return this.connected}handleMessage(e){const{id:t,result:i,error:o}=e.data;if(console.log("[DedicatedWorkerTransport] Received message:",e.data),t&&("result"in e.data||"error"in e.data)){const a=this.pendingRequests.get(t);a&&(clearTimeout(a.timeout),this.pendingRequests.delete(t),o?a.reject(new C(o.message||"Request failed",o.code||"REQUEST_FAILED",o)):a.resolve(i))}}handleMessageError(e){console.error("[DedicatedWorkerTransport] Message error:",e)}generateRequestId(){return`req_${Date.now()}_${Math.random().toString(36).slice(2,11)}`}}const J=Object.freeze(Object.defineProperty({__proto__:null,ServiceWorkerTransport:Q},Symbol.toStringTag,{value:"Module"}));return I.NostrPassButton=M,I.NostrPassEmbassy=z,I.initNostrPass=O,Object.defineProperty(I,Symbol.toStringTag,{value:"Module"}),I}({}),F;(F=document.currentScript)!=null&&F.hasAttribute("data-auto-init")&&window.initNostrPass();
//# sourceMappingURL=embassy.iife.js.map
