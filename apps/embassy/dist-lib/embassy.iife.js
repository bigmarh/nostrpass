var NostrPassEmbassy=function(k){"use strict";var q=Object.defineProperty;var z=(k,x,P)=>x in k?q(k,x,{enumerable:!0,configurable:!0,writable:!0,value:P}):k[x]=P;var m=(k,x,P)=>z(k,typeof x!="symbol"?x+"":x,P);class x{constructor(t=!1,e=e){this.isParent=t,this.window=e,this.pendingRequests=new Map,this.messageHandlers=new Map,this.allowedOrigins=new Set,this.isInitialized=!1,this.defaultTimeout=3e4,this.window=e,this.setupMessageListener()}init(t=["*"]){t.forEach(e=>this.allowedOrigins.add(e)),this.isInitialized=!0}on(t,e){this.messageHandlers.set(t,e)}off(t){this.messageHandlers.delete(t)}async request(t,e=null,s=this.defaultTimeout){if(!this.isInitialized)throw new Error("SecureMessenger not initialized. Call init() first.");const n=this.generateId(),l={id:n,type:t,data:e,timestamp:Date.now(),origin:this.window.location.origin};return new Promise((o,i)=>{const r=setTimeout(()=>{this.pendingRequests.delete(n),i(new Error(`Request timeout after ${s}ms`))},s);this.pendingRequests.set(n,{resolve:o,reject:i,timeout:r}),this.sendMessage(l)})}send(t,e=null){if(!this.isInitialized)throw new Error("SecureMessenger not initialized. Call init() first.");const s={id:this.generateId(),type:t,data:e,timestamp:Date.now(),origin:this.window.location.origin};this.sendMessage(s)}async sendResponse(t,e,s){const n={id:t.id,type:`${t.type}_RESPONSE`,data:s?{error:s}:e,timestamp:Date.now(),origin:this.window.location.origin};this.sendMessage(n)}sendMessage(t){var s;const e=this.isParent?this.window.frames[0]||((s=this.window.document.querySelector("iframe"))==null?void 0:s.contentWindow):this.window.parent;if(!e)throw new Error("Target window not found");this.allowedOrigins.has("*")?e.postMessage(t,"*"):this.allowedOrigins.forEach(n=>{e.postMessage(t,n)})}setupMessageListener(){this.window.addEventListener("message",async t=>{try{await this.handleMessage(t)}catch(e){console.error("Error handling message:",e)}})}async handleMessage(t){if(!this.isOriginAllowed(t.origin)){console.warn("Message from unauthorized origin:",t.origin);return}const e=t.data;if(!this.isValidMessage(e)){console.warn("Invalid message structure:",e);return}if(e.type.endsWith("_RESPONSE")&&this.pendingRequests.has(e.id)){this.handleResponse(e);return}const s=this.messageHandlers.get(e.type);if(!s){console.warn("No handler for message type:",e.type);return}try{const n=await s(e.data);e.type.endsWith("_RESPONSE")||await this.sendResponse(e,n)}catch(n){if(!e.type.endsWith("_RESPONSE")){const o={error:n instanceof Error?n.message:String(n)};n&&typeof n=="object"&&"code"in n&&n.code&&(o.code=n.code);const i={id:e.id,type:`${e.type}_RESPONSE`,data:o,timestamp:Date.now(),origin:this.window.location.origin};this.sendMessage(i)}}}handleResponse(t){const e=this.pendingRequests.get(t.id);if(e)if(clearTimeout(e.timeout),this.pendingRequests.delete(t.id),t.data&&t.data.error){const s=new Error(t.data.error);t.data.code&&(s.code=t.data.code),e.reject(s)}else e.resolve(t.data)}isValidMessage(t){return t&&typeof t.id=="string"&&typeof t.type=="string"&&typeof t.timestamp=="number"&&typeof t.origin=="string"&&Math.abs(Date.now()-t.timestamp)<3e5}isOriginAllowed(t){return this.isInitialized?this.allowedOrigins.has("*")||this.allowedOrigins.has(t):!1}generateId(){return`msg_${Date.now()}_${Math.random().toString(36).substr(2,9)}`}destroy(){this.pendingRequests.forEach(({timeout:t,reject:e})=>{clearTimeout(t),e(new Error("Messenger destroyed"))}),this.pendingRequests.clear(),this.messageHandlers.clear(),this.allowedOrigins.clear(),this.isInitialized=!1}}class P extends x{constructor(t=window){super(!0,t),this.iframe=null}createIframe(t,e){return this.iframe=document.createElement("iframe"),this.iframe.src=t,this.iframe.style.cssText=`
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
    `,document.body.appendChild(this.iframe),this.iframe.addEventListener("load",()=>{const e=new URL(t).origin;this.init([e])}),this.iframe}destroy(){this.iframe&&this.iframe.parentNode&&(this.iframe.parentNode.removeChild(this.iframe),this.iframe=null),super.destroy()}}const L=function(a){return{HIDE_VAULT:()=>{console.log("🔙 Hide vault signal received from vault iframe");try{return a.hide(),console.log("✅ Vault hidden successfully"),{acknowledged:!0}}catch(t){return console.error("❌ Failed to hide vault:",t),{acknowledged:!1,error:t instanceof Error?t.message:"Unknown error"}}},SHOW_VAULT:(t="vault")=>(console.log("Show vault signal received"),a.show(t),{acknowledged:!0}),VAULT_READY:()=>{console.log("Vault ready signal received"),a._isReady=!0;const t=new CustomEvent("nostr:ready",{detail:{embassy:a}});return window.dispatchEvent(t),{acknowledged:!0}},AUTH_STATUS:t=>(console.log("Auth status signal received",t),{acknowledged:!0}),GET_RELAYS:()=>(console.log("Get relays signal received"),{acknowledged:!0}),GOT_ERROR:()=>(console.log("Error signal received"),{acknowledged:!0}),PROMPT_REQUIRED:async t=>(console.log("Prompt requested by vault:",t),(t==null?void 0:t.promptType)==="PIN_PAD"&&(await a.requestPinUnlock()||console.warn("PIN prompt canceled or failed")),{acknowledged:!0}),"nostrpass:unlocked":t=>{console.log("🔓 Vault unlocked signal received from vault iframe",t),t!=null&&t.forOperation&&(console.log("✅ Unlock was for an operation, notifying waiters"),a.notifyUnlocked()),window.dispatchEvent(new CustomEvent("nostrpass:unlocked",{detail:t}))}}},I=a=>a.replace(/\./g,"-").replace(/:/g,"-").replace(/_/g,"-");var b=(a=>(a.VAULT_READY="VAULT_READY",a.AUTH_STATUS="AUTH_STATUS",a.SHOW_VAULT="SHOW_VAULT",a.HIDE_VAULT="HIDE_VAULT",a.CHECK_PERMISSION="CHECK_PERMISSION",a.GET_RELAYS="GET_RELAYS",a.GET_PUBLIC_KEY="GET_PUBLIC_KEY",a.SIGN_EVENT="SIGN_EVENT",a.SIGN_DATA="SIGN_DATA",a.ENCRYPT="ENCRYPT",a.DECRYPT="DECRYPT",a.GOT_ERROR="GOT_ERROR",a.PROMPT_REQUIRED="PROMPT_REQUIRED",a.MANAGE_ACCOUNTS="MANAGE_ACCOUNTS",a))(b||{});class U{constructor(t,e={}){m(this,"config");m(this,"container");m(this,"embassy");m(this,"currentUser",null);m(this,"theme","light");m(this,"isDropdownOpen",!1);m(this,"outsideClickHandler",null);if(this.embassy=t,this.config={signInText:"Sign in with NostrPass",showNpub:!0,showManageAccount:!0,theme:"auto",...e},this.container=document.createElement("div"),this.container.className=`nostrpass-button-container ${e.className||""}`,this.updateTheme(),this.injectStyles(),this.render(),e.appendTo){const s=typeof e.appendTo=="string"?document.querySelector(e.appendTo):e.appendTo;s&&s.appendChild(this.container)}}updateTheme(){if(this.config.theme==="auto"){const t=window.matchMedia("(prefers-color-scheme: dark)").matches;this.theme=t?"dark":"light",window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change",e=>{this.theme=e.matches?"dark":"light",this.container.setAttribute("data-theme",this.theme)})}else this.theme=this.config.theme||"light";this.container.setAttribute("data-theme",this.theme)}injectStyles(){if(document.getElementById("nostrpass-button-styles"))return;const t=document.createElement("style");t.id="nostrpass-button-styles",t.textContent=`
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
        min-width: 240px;
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
    `,document.head.appendChild(t)}render(){this.currentUser?this.renderUserButton():this.renderSignInButton()}renderSignInButton(){this.container.innerHTML=`
      <button class="nostrpass-signin-btn" data-action="signin">
        <span>${this.config.signInText}</span>
      </button>
    `,this.container.querySelector('[data-action="signin"]').addEventListener("click",()=>this.handleSignIn())}renderUserButton(){const t=this.currentUser,e=this.getUserInitials(t),s=t.nickname||`Identity ${t.identityIndex+1}`;this.container.innerHTML=`
      <div class="nostrpass-user-menu">
        <button class="nostrpass-user-btn" data-action="toggle-menu">
          ${t.avatar?`<img src="${t.avatar}" alt="${s}" class="nostrpass-user-avatar" />`:`<div class="nostrpass-user-initials">${e}</div>`}
          <span class="nostrpass-user-btn-text">${s}</span>
          <svg class="nostrpass-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="nostrpass-dropdown" data-dropdown>
          <div class="nostrpass-dropdown-section">
            <div class="nostrpass-dropdown-user-info">
              ${t.avatar?`<img src="${t.avatar}" alt="${s}" class="nostrpass-dropdown-avatar" />`:`<div class="nostrpass-dropdown-initials">${e}</div>`}
              <div class="nostrpass-dropdown-user-details">
                <div class="nostrpass-dropdown-name">${s}</div>
                ${t.npub?`<div class="nostrpass-dropdown-npub">${t.npub.slice(0,16)}...</div>`:""}
              </div>
            </div>
          </div>
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
        </div>
      </div>
    `,this.container.querySelector('[data-action="toggle-menu"]').addEventListener("click",i=>{i.stopPropagation(),this.toggleDropdown()});const l=this.container.querySelector('[data-action="manage-account"]');l==null||l.addEventListener("click",()=>{this.closeDropdown(),this.handleManageAccount()});const o=this.container.querySelector('[data-action="sign-out"]');o==null||o.addEventListener("click",()=>{this.closeDropdown(),this.handleSignOut()})}getUserInitials(t){if(t.nickname){const e=t.nickname.split(" ");return e.length>=2?`${e[0][0]}${e[1][0]}`:t.nickname.slice(0,2)}return`I${t.identityIndex+1}`}async handleSignIn(){var s,n,l,o,i,r,d,c;const t=this.container.querySelector('[data-action="signin"]');if(!t)return;const e=t.innerHTML;t.disabled=!0,t.innerHTML='<span class="nostrpass-loading"></span> <span>Signing in...</span>';try{const p=await this.embassy.manageAccount({forcePrompt:!0,buttonElement:t});this.currentUser={identityIndex:p.identityIndex,publicKey:((s=p.identity)==null?void 0:s.publicKey)||"",npub:(n=p.identity)==null?void 0:n.npub,nickname:(l=p.identity)==null?void 0:l.nickname,authorized:((o=p.identity)==null?void 0:o.authorized)||!1},this.saveSession(this.currentUser),this.render(),(r=(i=this.config).onSignIn)==null||r.call(i,this.currentUser)}catch(p){console.error("NostrPass sign in failed:",p);const h=p instanceof Error?p.message:String(p);if(h.toLowerCase().includes("locked")||h.toLowerCase().includes("unlock")){console.log("[NostrPassButton] Vault locked - waiting for unlock...");const y=async()=>{var g,N;console.log("[NostrPassButton] Vault unlocked, checking auth status...");try{const w=await this.embassy.getAuthStatus();w!=null&&w.isAuthenticated&&(w!=null&&w.user)&&(this.currentUser={identityIndex:w.user.identityIndex||0,publicKey:w.user.publicKey||"",npub:w.user.npub,nickname:w.user.nickname,authorized:w.user.authorized||!1},this.saveSession(this.currentUser),this.render(),(N=(g=this.config).onSignIn)==null||N.call(g,this.currentUser)),window.removeEventListener("nostrpass:unlocked",y)}catch(w){console.error("[NostrPassButton] Failed to get auth status after unlock:",w),t.disabled=!1,t.innerHTML=e}};window.addEventListener("nostrpass:unlocked",y);return}t.disabled=!1,t.innerHTML=e,(c=(d=this.config).onError)==null||c.call(d,p)}}async toggleDropdown(){try{const e=await this.embassy.getAuthStatus();if(e!=null&&e.isLocked){console.log("[NostrPassButton] Vault locked, showing unlock modal...");const s=this.container.querySelector('[data-action="toggle-menu"]');this.embassy.show("unlock","compact",s);const n=()=>{console.log("[NostrPassButton] Vault unlocked, hiding modal and showing dropdown..."),window.removeEventListener("nostrpass:unlocked",n),this.embassy.hide(),setTimeout(()=>{this.openDropdown()},100)};window.addEventListener("nostrpass:unlocked",n);return}}catch(e){console.error("[NostrPassButton] Failed to check vault status:",e)}this.container.querySelector("[data-dropdown]")&&(this.isDropdownOpen?this.closeDropdown():this.openDropdown())}openDropdown(){const t=this.container.querySelector("[data-dropdown]");t&&(this.isDropdownOpen=!0,t.classList.add("open"),setTimeout(()=>{this.outsideClickHandler=e=>{const s=e.target;this.container.contains(s)||this.closeDropdown()},document.addEventListener("click",this.outsideClickHandler)},0))}closeDropdown(){const t=this.container.querySelector("[data-dropdown]");t&&(this.isDropdownOpen=!1,t.classList.remove("open"),this.removeOutsideClickListener())}removeOutsideClickListener(){this.outsideClickHandler&&(document.removeEventListener("click",this.outsideClickHandler),this.outsideClickHandler=null)}async handleManageAccount(){var e,s;const t=this.container.querySelector('[data-action="toggle-menu"]');try{this.embassy.show("vault","full",t)}catch(n){console.error("Failed to open vault:",n),(s=(e=this.config).onError)==null||s.call(e,n)}}handleSignOut(){var t,e;this.currentUser=null,this.clearSession(),this.render(),(e=(t=this.config).onSignOut)==null||e.call(t)}saveSession(t){try{sessionStorage.setItem("nostrpass_session",JSON.stringify(t))}catch(e){console.warn("Failed to save NostrPass session:",e)}}clearSession(){try{sessionStorage.removeItem("nostrpass_session"),this.currentUser=null,this.render()}catch(t){console.warn("Failed to clear NostrPass session:",t)}}async restoreSession(){console.log("[NostrPassButton] restoreSession called");try{console.log("[NostrPassButton] Waiting for vault ready..."),await this.embassy.waitForReady(),console.log("[NostrPassButton] Vault is ready");try{console.log("[NostrPassButton] Checking auth status...");const s=await this.embassy.getAuthStatus();if(console.log("[NostrPassButton] Auth status response:",s),s!=null&&s.isAuthenticated&&(s!=null&&s.user))return console.log("[NostrPassButton] User is authenticated, showing user button"),this.currentUser={identityIndex:s.user.identityIndex||0,publicKey:s.user.publicKey||"",npub:s.user.npub,nickname:s.user.nickname,authorized:s.user.authorized||!1},this.saveSession(this.currentUser),this.render(),!0;console.log("[NostrPassButton] Not authenticated or no user")}catch(s){console.log("[NostrPassButton] Could not get auth status:",s)}console.log("[NostrPassButton] Checking session storage...");const t=sessionStorage.getItem("nostrpass_session");if(!t)return console.log("[NostrPassButton] No session data found"),!1;console.log("[NostrPassButton] Found session data, parsing...");const e=JSON.parse(t);console.log("[NostrPassButton] Session user:",e);try{return await this.embassy.getPublicKey({identityIndex:e.identityIndex}),console.log("[NostrPassButton] Session valid, showing user button"),this.currentUser=e,this.render(),!0}catch{return console.log("[NostrPassButton] Vault locked or session invalid, but showing user button anyway"),this.currentUser=e,this.render(),!0}}catch(t){return console.warn("[NostrPassButton] Failed to restore NostrPass session:",t),!1}}getUser(){return this.currentUser}getElement(){return this.container}destroy(){this.container.remove()}}class R{constructor(t={}){m(this,"config");m(this,"iframe",null);m(this,"_isReady",!1);m(this,"styleElement",null);m(this,"backdropEl",null);m(this,"messenger",null);m(this,"handlers",[]);m(this,"isPromptOpen",!1);m(this,"unlockResolvers",[]);m(this,"outsideClickHandler",null);this.config={appName:t.appName||document.title||"Unknown App",appDomain:t.appDomain||window.location.host,permissions:t.permissions||["getPublicKey","signEvent"],vaultUrl:t.vaultUrl||"http://localhost:3001",trustedOrigins:t.trustedOrigins,theme:t.theme||"auto",debug:t.debug||!1,parentPinOverlay:t.parentPinOverlay??!1},this.handlers=Object.keys(L(this)),console.log("🚀 NostrPass Embassy initialized",this.config),this.injectStyles(),document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>this.createIframe()):this.createIframe()}sleep(t){return new Promise(e=>setTimeout(e,t))}waitForUnlock(){return new Promise(t=>{this.unlockResolvers.push(t),setTimeout(()=>{const e=this.unlockResolvers.indexOf(t);e>-1&&(this.unlockResolvers.splice(e,1),t())},6e4)})}notifyUnlocked(){for(console.log("🔓 Notifying unlock resolvers:",this.unlockResolvers.length);this.unlockResolvers.length>0;){const t=this.unlockResolvers.shift();t&&t()}}promptPin(){return new Promise(t=>{var T;if(this.isPromptOpen)return t(!1);this.isPromptOpen=!0;const e=f=>f.sort(()=>Math.random()-.5);(T=document.getElementById("np-pin-overlay"))==null||T.remove();const s=document.createElement("div");s.id="np-pin-overlay",Object.assign(s.style,{position:"fixed",inset:"0",background:"rgba(0,0,0,0.5)",zIndex:"2147483647",display:"flex",alignItems:"center",justifyContent:"center"});const n=document.createElement("div");Object.assign(n.style,{padding:"16px",borderRadius:"8px",width:"320px",maxWidth:"90vw",fontFamily:"system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"});const l=document.createElement("h3");l.textContent="Unlock Vault",Object.assign(l.style,{margin:"0 0 8px",fontSize:"16px"});const o=document.createElement("p");o.textContent="Enter your PIN to continue.",Object.assign(o.style,{margin:"0 0 12px",color:"#555",fontSize:"13px"});const i=document.createElement("div");Object.assign(i.style,{display:"flex",justifyContent:"center",gap:"12px",marginBottom:"12px"});const r=f=>{i.innerHTML="";for(let v=0;v<6;v++){const E=document.createElement("div");E.style.width="12px",E.style.height="12px",E.style.borderRadius="9999px",E.style.border="2px solid "+(v<f?"#111":"#d1d5db"),i.appendChild(E)}},d=document.createElement("div");Object.assign(d.style,{display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:"10px",width:"240px",margin:"0 auto"});const c=f=>{const v=document.createElement("button");return v.textContent=f,Object.assign(v.style,{width:"76px",height:"56px",border:"1px solid #d1d5db",borderRadius:"8px",fontWeight:"600",cursor:"pointer"}),v},p=f=>{const v=document.createElement("button");return v.textContent=f,Object.assign(v.style,{height:"44px",border:"1px solid #d1d5db",borderRadius:"8px",background:"#fff",cursor:"pointer"}),v};let h="";const y=e(["1","2","3","4","5","6","7","8","9","0"]),g=()=>{this.isPromptOpen=!1,s.remove()},N=async()=>{try{const f=await this.messenger.request("UNLOCK_WITH_PIN",{pin:h});if(f!=null&&f.success)g(),t(!0);else{for(h="",r(0);d.firstChild;)d.removeChild(d.firstChild);e(y),O()}}catch{h="",r(0)}},w=f=>{h.length>=6||(h+=f,r(h.length),h.length===6&&N())},B=()=>{h&&(h=h.slice(0,-1),r(h.length))},O=()=>{y.forEach(E=>{const M=c(E);M.addEventListener("click",()=>w(E)),d.appendChild(M)});const f=p("← Delete");f.style.gridColumn="span 2",f.addEventListener("click",B),d.appendChild(f);const v=document.createElement("div");d.appendChild(v)},S=document.createElement("div");Object.assign(S.style,{display:"flex",gap:"8px",marginTop:"12px",justifyContent:"flex-end"});const A=p("Cancel");A.addEventListener("click",()=>{g(),t(!1)}),S.appendChild(A),n.appendChild(l),n.appendChild(o),n.appendChild(i),r(0),O(),n.appendChild(d),n.appendChild(S),s.appendChild(n),document.body.appendChild(s)})}requestPinUnlock(){return this.promptPin()}async createIframe(){if(this.iframe){this.config.debug&&console.log("Iframe already exists");return}return new Promise((t,e)=>{this.iframe=document.createElement("iframe"),this.iframe.id="nostrpass-vault-iframe";const s=new URL(this.config.vaultUrl+"/"+I(this.config.appDomain));s.searchParams.set("appName",this.config.appName),s.searchParams.set("appDomain",this.config.appDomain),s.searchParams.set("theme",this.config.theme),this.iframe.src=s.toString(),console.log("iframe.src",s.toString()),this.iframe.setAttribute("sandbox","allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"),this.iframe.setAttribute("allow","publickey-credentials-create; publickey-credentials-get"),this.iframe.setAttribute("aria-hidden","true"),this.iframe.setAttribute("tabindex","-1"),this.iframe.setAttribute("title","NostrPass Vault"),this.iframe.className="nostrpass-iframe nostrpass-iframe-hidden",this.iframe.style.background="transparent",this.iframe.style.backgroundColor="transparent",this.iframe.setAttribute("allowtransparency","true"),this.config.debug&&new URLSearchParams(window.location.search).has("embassy-debug")&&(this.iframe.classList.add("nostrpass-iframe-debug"),this.iframe.classList.remove("nostrpass-iframe-hidden")),this.initializeMessenger(),this.iframe.onload=()=>{this.config.debug&&console.log("Iframe loaded successfully"),setTimeout(()=>{this.config.debug&&console.log("Iframe initialization period complete"),t()},100)},this.iframe.onerror=()=>{console.error("Failed to load NostrPass vault"),e(new Error("Failed to load vault iframe"))},this.backdropEl||(this.backdropEl=document.createElement("div"),this.backdropEl.className="nostrpass-backdrop",this.backdropEl.addEventListener("click",n=>{console.log("🎯 Backdrop clicked"),n.stopPropagation(),this.hide()})),document.body.appendChild(this.backdropEl),document.body.appendChild(this.iframe),this.config.debug&&console.log("Iframe created and added to DOM")})}show(t="vault",e="full",s){if(!this.iframe){console.warn("Cannot show iframe - not created yet"),this.createIframe().then(()=>this.show(t,e,s));return}const n=new URL(this.iframe.src),l=I(this.config.appDomain);let o=`/${l}`;if(t==="unlock"?o=`/${l}/unlock-modal`:t==="dashboard"&&(o=`/${l}/dashboard`),n.pathname!==o){const i=new URL(this.config.vaultUrl);i.pathname=o,i.searchParams.set("appName",this.config.appName),i.searchParams.set("appDomain",this.config.appDomain),i.searchParams.set("theme",this.config.theme),this.iframe.src=i.toString(),console.log("🔄 Navigating iframe to:",i.toString())}if(this.iframe.classList.remove("nostrpass-iframe-hidden"),this.iframe.classList.remove("nostrpass-iframe-visible"),this.iframe.classList.remove("nostrpass-iframe-compact"),this.iframe.classList.remove("nostrpass-iframe-minimal"),e==="minimal")this.iframe.classList.add("nostrpass-iframe-minimal");else if(e==="compact"){if(this.iframe.classList.add("nostrpass-iframe-compact"),s){const i=s.getBoundingClientRect(),r=window.innerHeight-i.bottom,d=i.top,c=395,p=395,h=8;let y,g;if(r>=p+h)y=i.bottom+h;else if(d>=p+h)y=i.top-p-h;else{this.iframe.style.top="50%",this.iframe.style.left="50%",this.iframe.style.transform="translate(-50%, -50%)";return}g=i.left,g+c>window.innerWidth-h&&(g=i.right-c),g<h&&(g=h),this.iframe.style.top=`${y}px`,this.iframe.style.left=`${g}px`,this.iframe.style.transform="none"}}else this.iframe.classList.add("nostrpass-iframe-visible");if(this.backdropEl&&(this.backdropEl.classList.add("visible"),this.backdropEl.style.background="transparent",this.backdropEl.style.backdropFilter="none"),e==="compact"&&(this.outsideClickHandler&&document.removeEventListener("click",this.outsideClickHandler),setTimeout(()=>{this.outsideClickHandler=i=>{const r=i.target;this.iframe&&!this.iframe.contains(r)&&this.backdropEl&&this.backdropEl===r&&(console.log("🎯 Click outside iframe detected"),this.hide())},document.addEventListener("click",this.outsideClickHandler)},100)),this.iframe.setAttribute("aria-hidden","false"),this.iframe.removeAttribute("tabindex"),document.body.style.overflow="hidden",e==="minimal"&&t==="vault"&&this.messenger)try{this.messenger.send("NAVIGATE_TO_UNLOCK",{})}catch(i){console.warn("Failed to send navigation message:",i)}this.config.debug&&console.log("Iframe shown in",e,"mode")}hide(){if(console.log("🔙 Embassy hide() method called"),!this.iframe){console.warn("Cannot hide iframe - not created yet");return}console.log("🔙 Hiding iframe, current classes:",this.iframe.className),this.iframe.classList.remove("nostrpass-iframe-visible"),this.iframe.classList.remove("nostrpass-iframe-compact"),this.iframe.classList.remove("nostrpass-iframe-minimal"),this.iframe.classList.add("nostrpass-iframe-hidden"),this.backdropEl&&this.backdropEl.classList.remove("visible"),this.outsideClickHandler&&(document.removeEventListener("click",this.outsideClickHandler),this.outsideClickHandler=null),this.iframe.setAttribute("aria-hidden","true"),this.iframe.setAttribute("tabindex","-1"),document.body.style.overflow="",console.log("🔙 Iframe hidden, new classes:",this.iframe.className),this.config.debug&&console.log("Iframe hidden")}injectStyles(){this.styleElement||(this.styleElement=document.createElement("style"),this.styleElement.id="nostrpass-embassy-styles",this.styleElement.textContent=`
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
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        width: min(900px, 95vw) !important;
        height: min(700px, 90vh) !important;
        max-height: 800px !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
        border: none !important;
        border-radius: 16px !important;
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
    `,document.head.appendChild(this.styleElement),this.config.debug&&console.log("Styles injected"))}initializeMessenger(){if(!this.iframe)return;this.messenger=new P(window),this.messenger.sendMessage=e=>{var n;if(!((n=this.iframe)!=null&&n.contentWindow)){console.error("Iframe contentWindow not available");return}const s=new URL(this.iframe.src).origin;this.iframe.contentWindow.postMessage(e,s)};let t;if(this.config.trustedOrigins&&this.config.trustedOrigins.length>0?t=[...this.config.trustedOrigins]:t=["https://nostrpass.com","https://app.nostrpass.com","https://www.nostrpass.com"],this.config.vaultUrl)try{const e=new URL(this.config.vaultUrl).origin;t.includes(e)||t.push(e)}catch(e){console.warn("Failed to parse vaultUrl origin:",e)}(this.iframe.src.includes("localhost")||this.iframe.src.includes("127.0.0.1"))&&(t.includes("http://localhost:3001")||t.push("http://localhost:3001"),t.includes("http://127.0.0.1:3001")||t.push("http://127.0.0.1:3001")),this.messenger.init(t),this.setupMessageHandlers(),this.config.debug&&console.log("Messenger initialized with trusted origins:",t)}setupMessageHandlers(){if(!this.messenger)return;const t=L(this);console.log("Setting up message handlers:",this.handlers),this.handlers.forEach(e=>{console.log("Registering handler for:",e),this.messenger.on(e,t[e])}),this.config.debug&&console.log("Message handlers registered:",this.messenger.messageHandlers)}async getPublicKey(t){(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());try{const e=(t==null?void 0:t.identityIndex)??0;let s=null;try{const l=await this.messenger.request(b.CHECK_PERMISSION,{action:"getPublicKey",identityIndex:e}),o=(l==null?void 0:l.isLocked)===!0,i=(l==null?void 0:l.needsPrompt)===!0;if(o&&this.config.parentPinOverlay){if(!await this.requestPinUnlock())throw new Error("User canceled PIN prompt")}else o&&!this.config.parentPinOverlay?(console.log("⏳ Setting up unlock wait promise..."),s=this.waitForUnlock(),this.show("vault","minimal")):i&&!this.config.parentPinOverlay&&this.show("vault","full")}catch(l){String((l==null?void 0:l.message)||l).toLowerCase().includes("not authenticated")&&(console.log("⚠️ User not authenticated, showing full vault for login"),this.show("vault","full"))}s&&(console.log("⏳ Waiting for vault unlock..."),await s,console.log("✅ Vault unlocked, continuing operation"));const n=await this.messenger.request(b.GET_PUBLIC_KEY,{appName:this.config.appName,appDomain:this.config.appDomain,identityIndex:e});return this.config.debug&&console.log("Public key received:",n),this.hide(),n.publicKey||n}catch(e){throw console.error("Failed to get public key:",e),e}}async signEvent(t,e){(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());try{const s=(e==null?void 0:e.identityIndex)??0;let n=null;try{const o=await this.messenger.request(b.CHECK_PERMISSION,{action:"signEvent",eventKind:t==null?void 0:t.kind,identityIndex:s}),i=(o==null?void 0:o.isLocked)===!0,r=(o==null?void 0:o.needsPrompt)===!0;if(i&&this.config.parentPinOverlay){if(!await this.requestPinUnlock())throw new Error("User canceled PIN prompt")}else i&&!this.config.parentPinOverlay?(console.log("⏳ Setting up unlock wait promise..."),n=this.waitForUnlock(),this.show("vault","minimal")):r&&!this.config.parentPinOverlay&&this.show("vault","full")}catch(o){String((o==null?void 0:o.message)||o).toLowerCase().includes("not authenticated")&&(console.log("⚠️ User not authenticated, showing full vault for login"),this.show("vault","full"))}n&&(console.log("⏳ Waiting for vault unlock..."),await n,console.log("✅ Vault unlocked, continuing operation"));const l=async()=>this.messenger.request(b.SIGN_EVENT,{event:t,appName:this.config.appName,appDomain:this.config.appDomain,identityIndex:s});try{const o=await l();return this.config.debug&&console.log("Signed event received:",o),this.hide(),o.signedEvent||o}catch(o){const i=String((o==null?void 0:o.message)||o);if(i.toLowerCase().includes("vault is locked")||i.toLowerCase().includes("rehydrated")){await this.sleep(150);const r=await l();return this.config.debug&&console.log("Signed event received (retry):",r),this.hide(),r.signedEvent||r}throw o}}catch(s){throw console.error("Failed to sign event:",s),s}}async getRelays(){return console.log("TODO: getRelays"),{}}async signData(t,e){(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());try{const s=(e==null?void 0:e.identityIndex)??0;let n=null;try{const o=await this.messenger.request(b.CHECK_PERMISSION,{action:"signData",identityIndex:s}),i=(o==null?void 0:o.isLocked)===!0,r=(o==null?void 0:o.needsPrompt)===!0;if(i&&this.config.parentPinOverlay){if(!await this.requestPinUnlock())throw new Error("User canceled PIN prompt")}else i&&!this.config.parentPinOverlay?(console.log("⏳ Setting up unlock wait promise..."),n=this.waitForUnlock(),this.show("vault","minimal")):r&&!this.config.parentPinOverlay&&this.show("vault","full")}catch(o){String((o==null?void 0:o.message)||o).toLowerCase().includes("not authenticated")&&(console.log("⚠️ User not authenticated, showing full vault for login"),this.show("vault","full"))}n&&(console.log("⏳ Waiting for vault unlock..."),await n,console.log("✅ Vault unlocked, continuing operation"));const l=async()=>this.messenger.request(b.SIGN_DATA,{data:t,appName:this.config.appName,appDomain:this.config.appDomain,identityIndex:s});try{const o=await l(),i=(o==null?void 0:o.signature)??o;return this.config.debug&&console.log("Signed data received:",i),this.hide(),i}catch(o){const i=String((o==null?void 0:o.message)||o);if(i.toLowerCase().includes("locked")||i.toLowerCase().includes("unlock")||i.toLowerCase().includes("rehydrated")){await this.sleep(150);try{const r=await l();return this.hide(),(r==null?void 0:r.signature)??r}catch(r){if(String((r==null?void 0:r.message)||r).toLowerCase().includes("rehydrated")){await this.sleep(200);const c=await l();return this.hide(),(c==null?void 0:c.signature)??c}throw r}}throw o}}catch(s){throw console.error("Failed to sign data:",s),s}}async encrypt(t,e,s){(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());try{const n=(s==null?void 0:s.identityIndex)??0;let l=null;try{const i=await this.messenger.request(b.CHECK_PERMISSION,{action:"nip04",identityIndex:n}),r=(i==null?void 0:i.isLocked)===!0,d=(i==null?void 0:i.needsPrompt)===!0;if(r&&this.config.parentPinOverlay){if(!await this.requestPinUnlock())throw new Error("User canceled PIN prompt")}else r&&!this.config.parentPinOverlay?(console.log("⏳ Setting up unlock wait promise..."),l=this.waitForUnlock(),this.show("vault","minimal")):d&&!this.config.parentPinOverlay&&this.show("vault","full")}catch(i){String((i==null?void 0:i.message)||i).toLowerCase().includes("not authenticated")&&(console.log("⚠️ User not authenticated, showing full vault for login"),this.show("vault","full"))}l&&(console.log("⏳ Waiting for vault unlock..."),await l,console.log("✅ Vault unlocked, continuing operation"));const o=async()=>this.messenger.request(b.ENCRYPT,{plaintext:e,recipientPubkey:t,appName:this.config.appName,appDomain:this.config.appDomain,identityIndex:n});try{const i=await o();return this.config.debug&&console.log("Encrypted payload received:",i),this.hide(),i}catch(i){const r=String((i==null?void 0:i.message)||i);if(r.toLowerCase().includes("locked")||r.toLowerCase().includes("unlock")||r.toLowerCase().includes("rehydrated")){await this.sleep(150);try{const d=await o();return this.hide(),d}catch(d){if(String((d==null?void 0:d.message)||d).toLowerCase().includes("rehydrated")){await this.sleep(200);const p=await o();return this.hide(),p}throw d}}throw i}}catch(n){throw console.error("Failed to encrypt:",n),n}}async decrypt(t,e,s){(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());try{const n=(s==null?void 0:s.identityIndex)??0;let l=null;try{const i=await this.messenger.request(b.CHECK_PERMISSION,{action:"nip04",identityIndex:n}),r=(i==null?void 0:i.isLocked)===!0,d=(i==null?void 0:i.needsPrompt)===!0;if(r&&this.config.parentPinOverlay){if(!await this.requestPinUnlock())throw new Error("User canceled PIN prompt")}else r&&!this.config.parentPinOverlay?(console.log("⏳ Setting up unlock wait promise..."),l=this.waitForUnlock(),this.show("vault","minimal")):d&&!this.config.parentPinOverlay&&this.show("vault","full")}catch(i){String((i==null?void 0:i.message)||i).toLowerCase().includes("not authenticated")&&(console.log("⚠️ User not authenticated, showing full vault for login"),this.show("vault","full"))}l&&(console.log("⏳ Waiting for vault unlock..."),await l,console.log("✅ Vault unlocked, continuing operation"));const o=async()=>this.messenger.request(b.DECRYPT,{ciphertext:e,senderPubkey:t,appName:this.config.appName,appDomain:this.config.appDomain,identityIndex:n});try{const i=await o();return this.config.debug&&console.log("Decrypted payload received:",i),this.hide(),i}catch(i){const r=String((i==null?void 0:i.message)||i);if(r.toLowerCase().includes("locked")||r.toLowerCase().includes("unlock")||r.toLowerCase().includes("rehydrated")){await this.sleep(150);try{const d=await o();return this.hide(),d}catch(d){if(String((d==null?void 0:d.message)||d).toLowerCase().includes("rehydrated")){await this.sleep(200);const p=await o();return this.hide(),p}throw d}}throw i}}catch(n){throw console.error("Failed to decrypt:",n),n}}async getAuthStatus(){(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());try{return await this.messenger.request(b.AUTH_STATUS,{})}catch(t){throw console.error("Failed to get auth status:",t),t}}async manageAccount(t={}){(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());const e=t.forcePrompt??!0,s=t.size||"compact";this.show("vault",s,t.buttonElement);try{const n=await this.messenger.request(b.MANAGE_ACCOUNTS,{appName:this.config.appName,appDomain:this.config.appDomain,forcePrompt:e});return this.hide(),n}catch(n){throw n}}createAccountManagerButton(t={}){const{label:e="Manage NostrPass Account",className:s="nostrpass-account-button",appendTo:n,buttonElement:l,disabledText:o,onSelect:i,onError:r,forcePrompt:d}=t,c=l??document.createElement("button");l?s&&(l.className=s):(c.type="button",c.className=s,c.textContent=e);const p=async h=>{h.preventDefault();const y=c.textContent;try{c.disabled=!0,o&&(c.textContent=o);const g=await this.manageAccount({forcePrompt:d});i==null||i(g)}catch(g){r?r(g):console.error("[NostrPass] Failed to manage account:",g)}finally{c.disabled=!1,o&&y!==void 0&&y!==null&&(c.textContent=y)}};if(c.addEventListener("click",p),n){const h=typeof n=="string"?document.querySelector(n):n;h?c.parentElement||h.appendChild(c):console.warn("[NostrPass] Unable to find target element for account manager button:",n)}return c}createNostrPassButton(t={}){return new U(this,t)}isReady(){return this._isReady}async waitForReady(){if(!this._isReady)return new Promise(t=>{const e=()=>{this._isReady?t():setTimeout(e,100)};e()})}destroy(){this.messenger&&(this.messenger.destroy(),this.messenger=null),this.iframe&&this.iframe.parentNode&&(this.iframe.parentNode.removeChild(this.iframe),this.iframe=null),this.backdropEl&&this.backdropEl.parentNode&&(this.backdropEl.parentNode.removeChild(this.backdropEl),this.backdropEl=null),this.styleElement&&this.styleElement.parentNode&&(this.styleElement.parentNode.removeChild(this.styleElement),this.styleElement=null),this._isReady=!1,this.config.debug&&console.log("Embassy destroyed")}}let u=null;function C(a={}){return u&&u.destroy(),u=new R(a),{getPublicKey:e=>u.getPublicKey(e),signEvent:(e,s)=>u.signEvent(e,s),signData:(e,s)=>u.signData(e,s),getRelays:()=>u.getRelays(),nip04:{encrypt:(e,s,n)=>u.encrypt(e,s,n),decrypt:(e,s,n)=>u.decrypt(e,s,n)},manageAccount:e=>u.manageAccount(e),createAccountManagerButton:e=>u.createAccountManagerButton(e),createNostrPassButton:e=>u.createNostrPassButton(e)}}function _(){console.log("showVault"),u==null||u.show()}function H(){u==null||u.hide()}if(typeof window<"u"){window.initNostrPass=C,window.showVault=_,window.hideVault=H;const a=document.currentScript;if((a==null?void 0:a.getAttribute("data-manual-init"))==="true")console.log("✅ NostrPass Embassy loaded (manual init mode)");else{const e={};a!=null&&a.hasAttribute("data-vault-url")&&(e.vaultUrl=a.getAttribute("data-vault-url")||void 0),a!=null&&a.hasAttribute("data-app-name")&&(e.appName=a.getAttribute("data-app-name")||void 0),a!=null&&a.hasAttribute("data-debug")&&(e.debug=a.getAttribute("data-debug")==="true"),a!=null&&a.hasAttribute("data-theme")&&(e.theme=a.getAttribute("data-theme")||void 0);const s=C(e);window.nostr=s,console.log("✅ NostrPass Embassy auto-initialized with config:",e)}console.log("💡 Use window.initNostrPass(config) to customize")}return k.NostrPassButton=U,k.NostrPassEmbassy=R,k.initNostrPass=C,Object.defineProperty(k,Symbol.toStringTag,{value:"Module"}),k}({}),D;(D=document.currentScript)!=null&&D.hasAttribute("data-auto-init")&&window.initNostrPass();
//# sourceMappingURL=embassy.iife.js.map
