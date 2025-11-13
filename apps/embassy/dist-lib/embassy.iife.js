var NostrPassEmbassy=function(y){"use strict";var q=Object.defineProperty;var z=(y,k,P)=>k in y?q(y,k,{enumerable:!0,configurable:!0,writable:!0,value:P}):y[k]=P;var m=(y,k,P)=>z(y,typeof k!="symbol"?k+"":k,P);class k{constructor(t=!1,e=e){this.isParent=t,this.window=e,this.pendingRequests=new Map,this.messageHandlers=new Map,this.allowedOrigins=new Set,this.isInitialized=!1,this.defaultTimeout=3e4,this.window=e,this.setupMessageListener()}init(t=["*"]){t.forEach(e=>this.allowedOrigins.add(e)),this.isInitialized=!0}on(t,e){this.messageHandlers.set(t,e)}off(t){this.messageHandlers.delete(t)}async request(t,e=null,s=this.defaultTimeout){if(!this.isInitialized)throw new Error("SecureMessenger not initialized. Call init() first.");const i=this.generateId(),l={id:i,type:t,data:e,timestamp:Date.now(),origin:this.window.location.origin};return new Promise((o,n)=>{const r=setTimeout(()=>{this.pendingRequests.delete(i),n(new Error(`Request timeout after ${s}ms`))},s);this.pendingRequests.set(i,{resolve:o,reject:n,timeout:r}),this.sendMessage(l)})}send(t,e=null){if(!this.isInitialized)throw new Error("SecureMessenger not initialized. Call init() first.");const s={id:this.generateId(),type:t,data:e,timestamp:Date.now(),origin:this.window.location.origin};this.sendMessage(s)}async sendResponse(t,e,s){const i={id:t.id,type:`${t.type}_RESPONSE`,data:s?{error:s}:e,timestamp:Date.now(),origin:this.window.location.origin};this.sendMessage(i)}sendMessage(t){var s;const e=this.isParent?this.window.frames[0]||((s=this.window.document.querySelector("iframe"))==null?void 0:s.contentWindow):this.window.parent;if(!e)throw new Error("Target window not found");this.allowedOrigins.has("*")?e.postMessage(t,"*"):this.allowedOrigins.forEach(i=>{e.postMessage(t,i)})}setupMessageListener(){this.window.addEventListener("message",async t=>{try{await this.handleMessage(t)}catch(e){console.error("Error handling message:",e)}})}async handleMessage(t){if(!this.isOriginAllowed(t.origin)){console.warn("Message from unauthorized origin:",t.origin);return}const e=t.data;if(!this.isValidMessage(e)){console.warn("Invalid message structure:",e);return}if(e.type.endsWith("_RESPONSE")&&this.pendingRequests.has(e.id)){this.handleResponse(e);return}const s=this.messageHandlers.get(e.type);if(!s){console.warn("No handler for message type:",e.type);return}try{const i=await s(e.data);e.type.endsWith("_RESPONSE")||await this.sendResponse(e,i)}catch(i){if(!e.type.endsWith("_RESPONSE")){const o={error:i instanceof Error?i.message:String(i)};i&&typeof i=="object"&&"code"in i&&i.code&&(o.code=i.code);const n={id:e.id,type:`${e.type}_RESPONSE`,data:o,timestamp:Date.now(),origin:this.window.location.origin};this.sendMessage(n)}}}handleResponse(t){const e=this.pendingRequests.get(t.id);if(e)if(clearTimeout(e.timeout),this.pendingRequests.delete(t.id),t.data&&t.data.error){const s=new Error(t.data.error);t.data.code&&(s.code=t.data.code),e.reject(s)}else e.resolve(t.data)}isValidMessage(t){return t&&typeof t.id=="string"&&typeof t.type=="string"&&typeof t.timestamp=="number"&&typeof t.origin=="string"&&Math.abs(Date.now()-t.timestamp)<3e5}isOriginAllowed(t){return this.isInitialized?this.allowedOrigins.has("*")||this.allowedOrigins.has(t):!1}generateId(){return`msg_${Date.now()}_${Math.random().toString(36).substr(2,9)}`}destroy(){this.pendingRequests.forEach(({timeout:t,reject:e})=>{clearTimeout(t),e(new Error("Messenger destroyed"))}),this.pendingRequests.clear(),this.messageHandlers.clear(),this.allowedOrigins.clear(),this.isInitialized=!1}}class P extends k{constructor(t=window){super(!0,t),this.iframe=null}createIframe(t,e){return this.iframe=document.createElement("iframe"),this.iframe.src=t,this.iframe.style.cssText=`
      width: 100%;
      height: 600px;
      border: none;
      border-radius: 8px;
    `,(e||document.body).appendChild(this.iframe),this.iframe.addEventListener("load",()=>{const i=new URL(t).origin;this.init([i])}),this.iframe}createHiddenIframe(t){return this.iframe=document.createElement("iframe"),this.iframe.src=t,this.iframe.style.cssText=`
      position: fixed;
      top: -1000px;
      left: -1000px;
      width: 1px;
      height: 1px;
      border: none;
      opacity: 0;
      pointer-events: none;
    `,document.body.appendChild(this.iframe),this.iframe.addEventListener("load",()=>{const e=new URL(t).origin;this.init([e])}),this.iframe}destroy(){this.iframe&&this.iframe.parentNode&&(this.iframe.parentNode.removeChild(this.iframe),this.iframe=null),super.destroy()}}const L=function(a){return{HIDE_VAULT:()=>{console.log("🔙 Hide vault signal received from vault iframe");try{return a.hide(),console.log("✅ Vault hidden successfully"),{acknowledged:!0}}catch(t){return console.error("❌ Failed to hide vault:",t),{acknowledged:!1,error:t instanceof Error?t.message:"Unknown error"}}},SHOW_VAULT:(t="vault")=>(console.log("Show vault signal received"),a.show(t),{acknowledged:!0}),VAULT_READY:()=>{console.log("Vault ready signal received"),a._isReady=!0;const t=new CustomEvent("nostr:ready",{detail:{embassy:a}});return window.dispatchEvent(t),{acknowledged:!0}},AUTH_STATUS:t=>(console.log("Auth status signal received",t),{acknowledged:!0}),GET_RELAYS:()=>(console.log("Get relays signal received"),{acknowledged:!0}),GOT_ERROR:()=>(console.log("Error signal received"),{acknowledged:!0}),PROMPT_REQUIRED:async t=>(console.log("Prompt requested by vault:",t),(t==null?void 0:t.promptType)==="PIN_PAD"&&(await a.requestPinUnlock()||console.warn("PIN prompt canceled or failed")),{acknowledged:!0}),"nostrpass:unlocked":t=>{console.log("🔓 Vault unlocked signal received from vault iframe",t),t!=null&&t.forOperation&&(console.log("✅ Unlock was for an operation, notifying waiters"),a.notifyUnlocked()),window.dispatchEvent(new CustomEvent("nostrpass:unlocked",{detail:t}))}}},D=a=>a.replace(/\./g,"-").replace(/:/g,"-").replace(/_/g,"-");var w=(a=>(a.VAULT_READY="VAULT_READY",a.AUTH_STATUS="AUTH_STATUS",a.SHOW_VAULT="SHOW_VAULT",a.HIDE_VAULT="HIDE_VAULT",a.CHECK_PERMISSION="CHECK_PERMISSION",a.GET_RELAYS="GET_RELAYS",a.GET_PUBLIC_KEY="GET_PUBLIC_KEY",a.SIGN_EVENT="SIGN_EVENT",a.SIGN_DATA="SIGN_DATA",a.ENCRYPT="ENCRYPT",a.DECRYPT="DECRYPT",a.GOT_ERROR="GOT_ERROR",a.PROMPT_REQUIRED="PROMPT_REQUIRED",a.MANAGE_ACCOUNTS="MANAGE_ACCOUNTS",a))(w||{});class I{constructor(t,e={}){m(this,"config");m(this,"container");m(this,"embassy");m(this,"currentUser",null);m(this,"theme","light");m(this,"isDropdownOpen",!1);m(this,"outsideClickHandler",null);if(this.embassy=t,this.config={signInText:"Sign in with NostrPass",showNpub:!0,showManageAccount:!0,theme:"auto",...e},this.container=document.createElement("div"),this.container.className=`nostrpass-button-container ${e.className||""}`,this.updateTheme(),this.injectStyles(),this.render(),e.appendTo){const s=typeof e.appendTo=="string"?document.querySelector(e.appendTo):e.appendTo;s&&s.appendChild(this.container)}}updateTheme(){if(this.config.theme==="auto"){const t=window.matchMedia("(prefers-color-scheme: dark)").matches;this.theme=t?"dark":"light",window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change",e=>{this.theme=e.matches?"dark":"light",this.container.setAttribute("data-theme",this.theme)})}else this.theme=this.config.theme||"light";this.container.setAttribute("data-theme",this.theme)}injectStyles(){if(document.getElementById("nostrpass-button-styles"))return;const t=document.createElement("style");t.id="nostrpass-button-styles",t.textContent=`
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
    `,this.container.querySelector('[data-action="toggle-menu"]').addEventListener("click",n=>{n.stopPropagation(),this.toggleDropdown()});const l=this.container.querySelector('[data-action="manage-account"]');l==null||l.addEventListener("click",()=>{this.closeDropdown(),this.handleManageAccount()});const o=this.container.querySelector('[data-action="sign-out"]');o==null||o.addEventListener("click",()=>{this.closeDropdown(),this.handleSignOut()})}getUserInitials(t){if(t.nickname){const e=t.nickname.split(" ");return e.length>=2?`${e[0][0]}${e[1][0]}`:t.nickname.slice(0,2)}return`I${t.identityIndex+1}`}async handleSignIn(){var s,i,l,o,n,r,d,c;const t=this.container.querySelector('[data-action="signin"]');if(!t)return;const e=t.innerHTML;t.disabled=!0,t.innerHTML='<span class="nostrpass-loading"></span> <span>Signing in...</span>';try{const p=await this.embassy.manageAccount({forcePrompt:!0,buttonElement:t});this.currentUser={identityIndex:p.identityIndex,publicKey:((s=p.identity)==null?void 0:s.publicKey)||"",npub:(i=p.identity)==null?void 0:i.npub,nickname:(l=p.identity)==null?void 0:l.nickname,authorized:((o=p.identity)==null?void 0:o.authorized)||!1},this.saveSession(this.currentUser),this.render(),(r=(n=this.config).onSignIn)==null||r.call(n,this.currentUser)}catch(p){console.error("NostrPass sign in failed:",p);const h=p instanceof Error?p.message:String(p);if(h.toLowerCase().includes("locked")||h.toLowerCase().includes("unlock")){console.log("[NostrPassButton] Vault locked - waiting for unlock...");const x=async()=>{var v,C;console.log("[NostrPassButton] Vault unlocked, checking auth status...");try{const f=await this.embassy.getAuthStatus();f!=null&&f.isAuthenticated&&(f!=null&&f.user)&&(this.currentUser={identityIndex:f.user.identityIndex||0,publicKey:f.user.publicKey||"",npub:f.user.npub,nickname:f.user.nickname,authorized:f.user.authorized||!1},this.saveSession(this.currentUser),this.render(),(C=(v=this.config).onSignIn)==null||C.call(v,this.currentUser)),window.removeEventListener("nostrpass:unlocked",x)}catch(f){console.error("[NostrPassButton] Failed to get auth status after unlock:",f),t.disabled=!1,t.innerHTML=e}};window.addEventListener("nostrpass:unlocked",x);return}t.disabled=!1,t.innerHTML=e,(c=(d=this.config).onError)==null||c.call(d,p)}}async toggleDropdown(){try{const e=await this.embassy.getAuthStatus();if(e!=null&&e.isLocked){console.log("[NostrPassButton] Vault locked, showing unlock modal...");const s=this.container.querySelector('[data-action="toggle-menu"]');this.embassy.show("vault","compact",s);const i=()=>{console.log("[NostrPassButton] Vault unlocked, showing dropdown..."),window.removeEventListener("nostrpass:unlocked",i),this.openDropdown()};window.addEventListener("nostrpass:unlocked",i);return}}catch(e){console.error("[NostrPassButton] Failed to check vault status:",e)}this.container.querySelector("[data-dropdown]")&&(this.isDropdownOpen?this.closeDropdown():this.openDropdown())}openDropdown(){const t=this.container.querySelector("[data-dropdown]");t&&(this.isDropdownOpen=!0,t.classList.add("open"),setTimeout(()=>{this.outsideClickHandler=e=>{const s=e.target;this.container.contains(s)||this.closeDropdown()},document.addEventListener("click",this.outsideClickHandler)},0))}closeDropdown(){const t=this.container.querySelector("[data-dropdown]");t&&(this.isDropdownOpen=!1,t.classList.remove("open"),this.removeOutsideClickListener())}removeOutsideClickListener(){this.outsideClickHandler&&(document.removeEventListener("click",this.outsideClickHandler),this.outsideClickHandler=null)}async handleManageAccount(){var e,s;const t=this.container.querySelector('[data-action="toggle-menu"]');try{this.embassy.show("vault","full",t)}catch(i){console.error("Failed to open vault:",i),(s=(e=this.config).onError)==null||s.call(e,i)}}handleSignOut(){var t,e;this.currentUser=null,this.clearSession(),this.render(),(e=(t=this.config).onSignOut)==null||e.call(t)}saveSession(t){try{sessionStorage.setItem("nostrpass_session",JSON.stringify(t))}catch(e){console.warn("Failed to save NostrPass session:",e)}}clearSession(){try{sessionStorage.removeItem("nostrpass_session"),this.currentUser=null,this.render()}catch(t){console.warn("Failed to clear NostrPass session:",t)}}async restoreSession(){console.log("[NostrPassButton] restoreSession called");try{console.log("[NostrPassButton] Waiting for vault ready..."),await this.embassy.waitForReady(),console.log("[NostrPassButton] Vault is ready");try{console.log("[NostrPassButton] Checking auth status...");const s=await this.embassy.getAuthStatus();if(console.log("[NostrPassButton] Auth status response:",s),s!=null&&s.isAuthenticated&&(s!=null&&s.user))return console.log("[NostrPassButton] User is authenticated, showing user button"),this.currentUser={identityIndex:s.user.identityIndex||0,publicKey:s.user.publicKey||"",npub:s.user.npub,nickname:s.user.nickname,authorized:s.user.authorized||!1},this.saveSession(this.currentUser),this.render(),!0;console.log("[NostrPassButton] Not authenticated or no user")}catch(s){console.log("[NostrPassButton] Could not get auth status:",s)}console.log("[NostrPassButton] Checking session storage...");const t=sessionStorage.getItem("nostrpass_session");if(!t)return console.log("[NostrPassButton] No session data found"),!1;console.log("[NostrPassButton] Found session data, parsing...");const e=JSON.parse(t);console.log("[NostrPassButton] Session user:",e);try{return await this.embassy.getPublicKey({identityIndex:e.identityIndex}),console.log("[NostrPassButton] Session valid, showing user button"),this.currentUser=e,this.render(),!0}catch{return console.log("[NostrPassButton] Vault locked or session invalid, but showing user button anyway"),this.currentUser=e,this.render(),!0}}catch(t){return console.warn("[NostrPassButton] Failed to restore NostrPass session:",t),!1}}getUser(){return this.currentUser}getElement(){return this.container}destroy(){this.container.remove()}}class O{constructor(t={}){m(this,"config");m(this,"iframe",null);m(this,"_isReady",!1);m(this,"styleElement",null);m(this,"backdropEl",null);m(this,"messenger",null);m(this,"handlers",[]);m(this,"isPromptOpen",!1);m(this,"unlockResolvers",[]);m(this,"outsideClickHandler",null);this.config={appName:t.appName||document.title||"Unknown App",appDomain:t.appDomain||window.location.host,permissions:t.permissions||["getPublicKey","signEvent"],vaultUrl:t.vaultUrl||"http://localhost:3001",trustedOrigins:t.trustedOrigins,theme:t.theme||"auto",debug:t.debug||!1,parentPinOverlay:t.parentPinOverlay??!1},this.handlers=Object.keys(L(this)),console.log("🚀 NostrPass Embassy initialized",this.config),this.injectStyles(),document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>this.createIframe()):this.createIframe()}sleep(t){return new Promise(e=>setTimeout(e,t))}waitForUnlock(){return new Promise(t=>{this.unlockResolvers.push(t),setTimeout(()=>{const e=this.unlockResolvers.indexOf(t);e>-1&&(this.unlockResolvers.splice(e,1),t())},6e4)})}notifyUnlocked(){for(console.log("🔓 Notifying unlock resolvers:",this.unlockResolvers.length);this.unlockResolvers.length>0;){const t=this.unlockResolvers.shift();t&&t()}}promptPin(){return new Promise(t=>{var A;if(this.isPromptOpen)return t(!1);this.isPromptOpen=!0;const e=g=>g.sort(()=>Math.random()-.5);(A=document.getElementById("np-pin-overlay"))==null||A.remove();const s=document.createElement("div");s.id="np-pin-overlay",Object.assign(s.style,{position:"fixed",inset:"0",background:"rgba(0,0,0,0.5)",zIndex:"2147483647",display:"flex",alignItems:"center",justifyContent:"center"});const i=document.createElement("div");Object.assign(i.style,{padding:"16px",borderRadius:"8px",width:"320px",maxWidth:"90vw",fontFamily:"system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"});const l=document.createElement("h3");l.textContent="Unlock Vault",Object.assign(l.style,{margin:"0 0 8px",fontSize:"16px"});const o=document.createElement("p");o.textContent="Enter your PIN to continue.",Object.assign(o.style,{margin:"0 0 12px",color:"#555",fontSize:"13px"});const n=document.createElement("div");Object.assign(n.style,{display:"flex",justifyContent:"center",gap:"12px",marginBottom:"12px"});const r=g=>{n.innerHTML="";for(let b=0;b<6;b++){const E=document.createElement("div");E.style.width="12px",E.style.height="12px",E.style.borderRadius="9999px",E.style.border="2px solid "+(b<g?"#111":"#d1d5db"),n.appendChild(E)}},d=document.createElement("div");Object.assign(d.style,{display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:"10px",width:"240px",margin:"0 auto"});const c=g=>{const b=document.createElement("button");return b.textContent=g,Object.assign(b.style,{width:"76px",height:"56px",border:"1px solid #d1d5db",borderRadius:"8px",fontWeight:"600",cursor:"pointer"}),b},p=g=>{const b=document.createElement("button");return b.textContent=g,Object.assign(b.style,{height:"44px",border:"1px solid #d1d5db",borderRadius:"8px",background:"#fff",cursor:"pointer"}),b};let h="";const x=e(["1","2","3","4","5","6","7","8","9","0"]),v=()=>{this.isPromptOpen=!1,s.remove()},C=async()=>{try{const g=await this.messenger.request("UNLOCK_WITH_PIN",{pin:h});if(g!=null&&g.success)v(),t(!0);else{for(h="",r(0);d.firstChild;)d.removeChild(d.firstChild);e(x),U()}}catch{h="",r(0)}},f=g=>{h.length>=6||(h+=g,r(h.length),h.length===6&&C())},B=()=>{h&&(h=h.slice(0,-1),r(h.length))},U=()=>{x.forEach(E=>{const T=c(E);T.addEventListener("click",()=>f(E)),d.appendChild(T)});const g=p("← Delete");g.style.gridColumn="span 2",g.addEventListener("click",B),d.appendChild(g);const b=document.createElement("div");d.appendChild(b)},S=document.createElement("div");Object.assign(S.style,{display:"flex",gap:"8px",marginTop:"12px",justifyContent:"flex-end"});const R=p("Cancel");R.addEventListener("click",()=>{v(),t(!1)}),S.appendChild(R),i.appendChild(l),i.appendChild(o),i.appendChild(n),r(0),U(),i.appendChild(d),i.appendChild(S),s.appendChild(i),document.body.appendChild(s)})}requestPinUnlock(){return this.promptPin()}async createIframe(){if(this.iframe){this.config.debug&&console.log("Iframe already exists");return}return new Promise((t,e)=>{this.iframe=document.createElement("iframe"),this.iframe.id="nostrpass-vault-iframe";const s=new URL(this.config.vaultUrl+"/"+D(this.config.appDomain));s.searchParams.set("appName",this.config.appName),s.searchParams.set("appDomain",this.config.appDomain),s.searchParams.set("theme",this.config.theme),this.iframe.src=s.toString(),console.log("iframe.src",s.toString()),this.iframe.setAttribute("sandbox","allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"),this.iframe.setAttribute("allow","publickey-credentials-create; publickey-credentials-get"),this.iframe.setAttribute("aria-hidden","true"),this.iframe.setAttribute("tabindex","-1"),this.iframe.setAttribute("title","NostrPass Vault"),this.iframe.className="nostrpass-iframe nostrpass-iframe-hidden",this.iframe.style.background="transparent",this.iframe.style.backgroundColor="transparent",this.iframe.setAttribute("allowtransparency","true"),this.config.debug&&new URLSearchParams(window.location.search).has("embassy-debug")&&(this.iframe.classList.add("nostrpass-iframe-debug"),this.iframe.classList.remove("nostrpass-iframe-hidden")),this.initializeMessenger(),this.iframe.onload=()=>{this.config.debug&&console.log("Iframe loaded successfully"),setTimeout(()=>{this.config.debug&&console.log("Iframe initialization period complete"),t()},100)},this.iframe.onerror=()=>{console.error("Failed to load NostrPass vault"),e(new Error("Failed to load vault iframe"))},this.backdropEl||(this.backdropEl=document.createElement("div"),this.backdropEl.className="nostrpass-backdrop",this.backdropEl.addEventListener("click",i=>{console.log("🎯 Backdrop clicked"),i.stopPropagation(),this.hide()})),document.body.appendChild(this.backdropEl),document.body.appendChild(this.iframe),this.config.debug&&console.log("Iframe created and added to DOM")})}show(t="vault",e="full",s){if(!this.iframe){console.warn("Cannot show iframe - not created yet"),this.createIframe().then(()=>this.show(t,e,s));return}if(this.iframe.classList.remove("nostrpass-iframe-hidden"),this.iframe.classList.remove("nostrpass-iframe-visible"),this.iframe.classList.remove("nostrpass-iframe-compact"),this.iframe.classList.remove("nostrpass-iframe-minimal"),e==="minimal")this.iframe.classList.add("nostrpass-iframe-minimal");else if(e==="compact"){if(this.iframe.classList.add("nostrpass-iframe-compact"),s){const i=s.getBoundingClientRect(),l=window.innerHeight-i.bottom,o=i.top,n=395,r=395,d=8;let c,p;if(l>=r+d)c=i.bottom+d;else if(o>=r+d)c=i.top-r-d;else{this.iframe.style.top="50%",this.iframe.style.left="50%",this.iframe.style.transform="translate(-50%, -50%)";return}p=i.left,p+n>window.innerWidth-d&&(p=i.right-n),p<d&&(p=d),this.iframe.style.top=`${c}px`,this.iframe.style.left=`${p}px`,this.iframe.style.transform="none"}}else this.iframe.classList.add("nostrpass-iframe-visible");if(this.backdropEl&&(this.backdropEl.classList.add("visible"),this.backdropEl.style.background="transparent",this.backdropEl.style.backdropFilter="none"),e==="compact"&&(this.outsideClickHandler&&document.removeEventListener("click",this.outsideClickHandler),setTimeout(()=>{this.outsideClickHandler=i=>{const l=i.target;this.iframe&&!this.iframe.contains(l)&&this.backdropEl&&this.backdropEl===l&&(console.log("🎯 Click outside iframe detected"),this.hide())},document.addEventListener("click",this.outsideClickHandler)},100)),this.iframe.setAttribute("aria-hidden","false"),this.iframe.removeAttribute("tabindex"),document.body.style.overflow="hidden",e==="minimal"&&t==="vault"&&this.messenger)try{this.messenger.send("NAVIGATE_TO_UNLOCK",{})}catch(i){console.warn("Failed to send navigation message:",i)}this.config.debug&&console.log("Iframe shown in",e,"mode")}hide(){if(console.log("🔙 Embassy hide() method called"),!this.iframe){console.warn("Cannot hide iframe - not created yet");return}console.log("🔙 Hiding iframe, current classes:",this.iframe.className),this.iframe.classList.remove("nostrpass-iframe-visible"),this.iframe.classList.remove("nostrpass-iframe-compact"),this.iframe.classList.remove("nostrpass-iframe-minimal"),this.iframe.classList.add("nostrpass-iframe-hidden"),this.backdropEl&&this.backdropEl.classList.remove("visible"),this.outsideClickHandler&&(document.removeEventListener("click",this.outsideClickHandler),this.outsideClickHandler=null),this.iframe.setAttribute("aria-hidden","true"),this.iframe.setAttribute("tabindex","-1"),document.body.style.overflow="",console.log("🔙 Iframe hidden, new classes:",this.iframe.className),this.config.debug&&console.log("Iframe hidden")}injectStyles(){this.styleElement||(this.styleElement=document.createElement("style"),this.styleElement.id="nostrpass-embassy-styles",this.styleElement.textContent=`
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
    `,document.head.appendChild(this.styleElement),this.config.debug&&console.log("Styles injected"))}initializeMessenger(){if(!this.iframe)return;this.messenger=new P(window),this.messenger.sendMessage=e=>{var i;if(!((i=this.iframe)!=null&&i.contentWindow)){console.error("Iframe contentWindow not available");return}const s=new URL(this.iframe.src).origin;this.iframe.contentWindow.postMessage(e,s)};let t;if(this.config.trustedOrigins&&this.config.trustedOrigins.length>0?t=[...this.config.trustedOrigins]:t=["https://nostrpass.com","https://app.nostrpass.com","https://www.nostrpass.com"],this.config.vaultUrl)try{const e=new URL(this.config.vaultUrl).origin;t.includes(e)||t.push(e)}catch(e){console.warn("Failed to parse vaultUrl origin:",e)}(this.iframe.src.includes("localhost")||this.iframe.src.includes("127.0.0.1"))&&(t.includes("http://localhost:3001")||t.push("http://localhost:3001"),t.includes("http://127.0.0.1:3001")||t.push("http://127.0.0.1:3001")),this.messenger.init(t),this.setupMessageHandlers(),this.config.debug&&console.log("Messenger initialized with trusted origins:",t)}setupMessageHandlers(){if(!this.messenger)return;const t=L(this);console.log("Setting up message handlers:",this.handlers),this.handlers.forEach(e=>{console.log("Registering handler for:",e),this.messenger.on(e,t[e])}),this.config.debug&&console.log("Message handlers registered:",this.messenger.messageHandlers)}async getPublicKey(t){(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());try{const e=(t==null?void 0:t.identityIndex)??0;let s=null;try{const l=await this.messenger.request(w.CHECK_PERMISSION,{action:"getPublicKey",identityIndex:e}),o=(l==null?void 0:l.isLocked)===!0,n=(l==null?void 0:l.needsPrompt)===!0;if(o&&this.config.parentPinOverlay){if(!await this.requestPinUnlock())throw new Error("User canceled PIN prompt")}else o&&!this.config.parentPinOverlay?(console.log("⏳ Setting up unlock wait promise..."),s=this.waitForUnlock(),this.show("vault","minimal")):n&&!this.config.parentPinOverlay&&this.show("vault","full")}catch(l){String((l==null?void 0:l.message)||l).toLowerCase().includes("not authenticated")&&(console.log("⚠️ User not authenticated, showing full vault for login"),this.show("vault","full"))}s&&(console.log("⏳ Waiting for vault unlock..."),await s,console.log("✅ Vault unlocked, continuing operation"));const i=await this.messenger.request(w.GET_PUBLIC_KEY,{appName:this.config.appName,appDomain:this.config.appDomain,identityIndex:e});return this.config.debug&&console.log("Public key received:",i),this.hide(),i.publicKey||i}catch(e){throw console.error("Failed to get public key:",e),e}}async signEvent(t,e){(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());try{const s=(e==null?void 0:e.identityIndex)??0;let i=null;try{const o=await this.messenger.request(w.CHECK_PERMISSION,{action:"signEvent",eventKind:t==null?void 0:t.kind,identityIndex:s}),n=(o==null?void 0:o.isLocked)===!0,r=(o==null?void 0:o.needsPrompt)===!0;if(n&&this.config.parentPinOverlay){if(!await this.requestPinUnlock())throw new Error("User canceled PIN prompt")}else n&&!this.config.parentPinOverlay?(console.log("⏳ Setting up unlock wait promise..."),i=this.waitForUnlock(),this.show("vault","minimal")):r&&!this.config.parentPinOverlay&&this.show("vault","full")}catch(o){String((o==null?void 0:o.message)||o).toLowerCase().includes("not authenticated")&&(console.log("⚠️ User not authenticated, showing full vault for login"),this.show("vault","full"))}i&&(console.log("⏳ Waiting for vault unlock..."),await i,console.log("✅ Vault unlocked, continuing operation"));const l=async()=>this.messenger.request(w.SIGN_EVENT,{event:t,appName:this.config.appName,appDomain:this.config.appDomain,identityIndex:s});try{const o=await l();return this.config.debug&&console.log("Signed event received:",o),this.hide(),o.signedEvent||o}catch(o){const n=String((o==null?void 0:o.message)||o);if(n.toLowerCase().includes("vault is locked")||n.toLowerCase().includes("rehydrated")){await this.sleep(150);const r=await l();return this.config.debug&&console.log("Signed event received (retry):",r),this.hide(),r.signedEvent||r}throw o}}catch(s){throw console.error("Failed to sign event:",s),s}}async getRelays(){return console.log("TODO: getRelays"),{}}async signData(t,e){(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());try{const s=(e==null?void 0:e.identityIndex)??0;let i=null;try{const o=await this.messenger.request(w.CHECK_PERMISSION,{action:"signData",identityIndex:s}),n=(o==null?void 0:o.isLocked)===!0,r=(o==null?void 0:o.needsPrompt)===!0;if(n&&this.config.parentPinOverlay){if(!await this.requestPinUnlock())throw new Error("User canceled PIN prompt")}else n&&!this.config.parentPinOverlay?(console.log("⏳ Setting up unlock wait promise..."),i=this.waitForUnlock(),this.show("vault","minimal")):r&&!this.config.parentPinOverlay&&this.show("vault","full")}catch(o){String((o==null?void 0:o.message)||o).toLowerCase().includes("not authenticated")&&(console.log("⚠️ User not authenticated, showing full vault for login"),this.show("vault","full"))}i&&(console.log("⏳ Waiting for vault unlock..."),await i,console.log("✅ Vault unlocked, continuing operation"));const l=async()=>this.messenger.request(w.SIGN_DATA,{data:t,appName:this.config.appName,appDomain:this.config.appDomain,identityIndex:s});try{const o=await l(),n=(o==null?void 0:o.signature)??o;return this.config.debug&&console.log("Signed data received:",n),this.hide(),n}catch(o){const n=String((o==null?void 0:o.message)||o);if(n.toLowerCase().includes("locked")||n.toLowerCase().includes("unlock")||n.toLowerCase().includes("rehydrated")){await this.sleep(150);try{const r=await l();return this.hide(),(r==null?void 0:r.signature)??r}catch(r){if(String((r==null?void 0:r.message)||r).toLowerCase().includes("rehydrated")){await this.sleep(200);const c=await l();return this.hide(),(c==null?void 0:c.signature)??c}throw r}}throw o}}catch(s){throw console.error("Failed to sign data:",s),s}}async encrypt(t,e,s){(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());try{const i=(s==null?void 0:s.identityIndex)??0;let l=null;try{const n=await this.messenger.request(w.CHECK_PERMISSION,{action:"nip04",identityIndex:i}),r=(n==null?void 0:n.isLocked)===!0,d=(n==null?void 0:n.needsPrompt)===!0;if(r&&this.config.parentPinOverlay){if(!await this.requestPinUnlock())throw new Error("User canceled PIN prompt")}else r&&!this.config.parentPinOverlay?(console.log("⏳ Setting up unlock wait promise..."),l=this.waitForUnlock(),this.show("vault","minimal")):d&&!this.config.parentPinOverlay&&this.show("vault","full")}catch(n){String((n==null?void 0:n.message)||n).toLowerCase().includes("not authenticated")&&(console.log("⚠️ User not authenticated, showing full vault for login"),this.show("vault","full"))}l&&(console.log("⏳ Waiting for vault unlock..."),await l,console.log("✅ Vault unlocked, continuing operation"));const o=async()=>this.messenger.request(w.ENCRYPT,{plaintext:e,recipientPubkey:t,appName:this.config.appName,appDomain:this.config.appDomain,identityIndex:i});try{const n=await o();return this.config.debug&&console.log("Encrypted payload received:",n),this.hide(),n}catch(n){const r=String((n==null?void 0:n.message)||n);if(r.toLowerCase().includes("locked")||r.toLowerCase().includes("unlock")||r.toLowerCase().includes("rehydrated")){await this.sleep(150);try{const d=await o();return this.hide(),d}catch(d){if(String((d==null?void 0:d.message)||d).toLowerCase().includes("rehydrated")){await this.sleep(200);const p=await o();return this.hide(),p}throw d}}throw n}}catch(i){throw console.error("Failed to encrypt:",i),i}}async decrypt(t,e,s){(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());try{const i=(s==null?void 0:s.identityIndex)??0;let l=null;try{const n=await this.messenger.request(w.CHECK_PERMISSION,{action:"nip04",identityIndex:i}),r=(n==null?void 0:n.isLocked)===!0,d=(n==null?void 0:n.needsPrompt)===!0;if(r&&this.config.parentPinOverlay){if(!await this.requestPinUnlock())throw new Error("User canceled PIN prompt")}else r&&!this.config.parentPinOverlay?(console.log("⏳ Setting up unlock wait promise..."),l=this.waitForUnlock(),this.show("vault","minimal")):d&&!this.config.parentPinOverlay&&this.show("vault","full")}catch(n){String((n==null?void 0:n.message)||n).toLowerCase().includes("not authenticated")&&(console.log("⚠️ User not authenticated, showing full vault for login"),this.show("vault","full"))}l&&(console.log("⏳ Waiting for vault unlock..."),await l,console.log("✅ Vault unlocked, continuing operation"));const o=async()=>this.messenger.request(w.DECRYPT,{ciphertext:e,senderPubkey:t,appName:this.config.appName,appDomain:this.config.appDomain,identityIndex:i});try{const n=await o();return this.config.debug&&console.log("Decrypted payload received:",n),this.hide(),n}catch(n){const r=String((n==null?void 0:n.message)||n);if(r.toLowerCase().includes("locked")||r.toLowerCase().includes("unlock")||r.toLowerCase().includes("rehydrated")){await this.sleep(150);try{const d=await o();return this.hide(),d}catch(d){if(String((d==null?void 0:d.message)||d).toLowerCase().includes("rehydrated")){await this.sleep(200);const p=await o();return this.hide(),p}throw d}}throw n}}catch(i){throw console.error("Failed to decrypt:",i),i}}async getAuthStatus(){(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());try{return await this.messenger.request(w.AUTH_STATUS,{})}catch(t){throw console.error("Failed to get auth status:",t),t}}async manageAccount(t={}){(!this.iframe||!this.messenger)&&(await this.createIframe(),await this.waitForReady());const e=t.forcePrompt??!0,s=t.size||"compact";this.show("vault",s,t.buttonElement);try{const i=await this.messenger.request(w.MANAGE_ACCOUNTS,{appName:this.config.appName,appDomain:this.config.appDomain,forcePrompt:e});return this.hide(),i}catch(i){throw i}}createAccountManagerButton(t={}){const{label:e="Manage NostrPass Account",className:s="nostrpass-account-button",appendTo:i,buttonElement:l,disabledText:o,onSelect:n,onError:r,forcePrompt:d}=t,c=l??document.createElement("button");l?s&&(l.className=s):(c.type="button",c.className=s,c.textContent=e);const p=async h=>{h.preventDefault();const x=c.textContent;try{c.disabled=!0,o&&(c.textContent=o);const v=await this.manageAccount({forcePrompt:d});n==null||n(v)}catch(v){r?r(v):console.error("[NostrPass] Failed to manage account:",v)}finally{c.disabled=!1,o&&x!==void 0&&x!==null&&(c.textContent=x)}};if(c.addEventListener("click",p),i){const h=typeof i=="string"?document.querySelector(i):i;h?c.parentElement||h.appendChild(c):console.warn("[NostrPass] Unable to find target element for account manager button:",i)}return c}createNostrPassButton(t={}){return new I(this,t)}isReady(){return this._isReady}async waitForReady(){if(!this._isReady)return new Promise(t=>{const e=()=>{this._isReady?t():setTimeout(e,100)};e()})}destroy(){this.messenger&&(this.messenger.destroy(),this.messenger=null),this.iframe&&this.iframe.parentNode&&(this.iframe.parentNode.removeChild(this.iframe),this.iframe=null),this.backdropEl&&this.backdropEl.parentNode&&(this.backdropEl.parentNode.removeChild(this.backdropEl),this.backdropEl=null),this.styleElement&&this.styleElement.parentNode&&(this.styleElement.parentNode.removeChild(this.styleElement),this.styleElement=null),this._isReady=!1,this.config.debug&&console.log("Embassy destroyed")}}let u=null;function N(a={}){return u&&u.destroy(),u=new O(a),{getPublicKey:e=>u.getPublicKey(e),signEvent:(e,s)=>u.signEvent(e,s),signData:(e,s)=>u.signData(e,s),getRelays:()=>u.getRelays(),nip04:{encrypt:(e,s,i)=>u.encrypt(e,s,i),decrypt:(e,s,i)=>u.decrypt(e,s,i)},manageAccount:e=>u.manageAccount(e),createAccountManagerButton:e=>u.createAccountManagerButton(e),createNostrPassButton:e=>u.createNostrPassButton(e)}}function _(){console.log("showVault"),u==null||u.show()}function H(){u==null||u.hide()}if(typeof window<"u"){window.initNostrPass=N,window.showVault=_,window.hideVault=H;const a=document.currentScript;if((a==null?void 0:a.getAttribute("data-manual-init"))==="true")console.log("✅ NostrPass Embassy loaded (manual init mode)");else{const e={};a!=null&&a.hasAttribute("data-vault-url")&&(e.vaultUrl=a.getAttribute("data-vault-url")||void 0),a!=null&&a.hasAttribute("data-app-name")&&(e.appName=a.getAttribute("data-app-name")||void 0),a!=null&&a.hasAttribute("data-debug")&&(e.debug=a.getAttribute("data-debug")==="true"),a!=null&&a.hasAttribute("data-theme")&&(e.theme=a.getAttribute("data-theme")||void 0);const s=N(e);window.nostr=s,console.log("✅ NostrPass Embassy auto-initialized with config:",e)}console.log("💡 Use window.initNostrPass(config) to customize")}return y.NostrPassButton=I,y.NostrPassEmbassy=O,y.initNostrPass=N,Object.defineProperty(y,Symbol.toStringTag,{value:"Module"}),y}({}),M;(M=document.currentScript)!=null&&M.hasAttribute("data-auto-init")&&window.initNostrPass();
//# sourceMappingURL=embassy.iife.js.map
