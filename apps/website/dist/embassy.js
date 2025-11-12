var A = Object.defineProperty;
var U = (a, e, t) => e in a ? A(a, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : a[e] = t;
var f = (a, e, t) => U(a, typeof e != "symbol" ? e + "" : e, t);
class L {
  // 30 seconds
  constructor(e = !1, t = t) {
    this.isParent = e, this.window = t, this.pendingRequests = /* @__PURE__ */ new Map(), this.messageHandlers = /* @__PURE__ */ new Map(), this.allowedOrigins = /* @__PURE__ */ new Set(), this.isInitialized = !1, this.defaultTimeout = 3e4, this.window = t, this.setupMessageListener();
  }
  // Initialize with allowed origins
  init(e = ["*"]) {
    e.forEach((t) => this.allowedOrigins.add(t)), this.isInitialized = !0;
  }
  // Add a message handler (simple mode)
  on(e, t) {
    this.messageHandlers.set(e, t);
  }
  // Remove a message handler
  off(e) {
    this.messageHandlers.delete(e);
  }
  // Send a request and wait for response
  async request(e, t = null, s = this.defaultTimeout) {
    if (!this.isInitialized)
      throw new Error("SecureMessenger not initialized. Call init() first.");
    const o = this.generateId(), l = {
      id: o,
      type: e,
      data: t,
      timestamp: Date.now(),
      origin: this.window.location.origin
    };
    return new Promise((n, i) => {
      const r = setTimeout(() => {
        this.pendingRequests.delete(o), i(new Error(`Request timeout after ${s}ms`));
      }, s);
      this.pendingRequests.set(o, {
        resolve: n,
        reject: i,
        timeout: r
      }), this.sendMessage(l);
    });
  }
  // Send a one-way message (no response expected)
  send(e, t = null) {
    if (!this.isInitialized)
      throw new Error("SecureMessenger not initialized. Call init() first.");
    const s = {
      id: this.generateId(),
      type: e,
      data: t,
      timestamp: Date.now(),
      origin: this.window.location.origin
    };
    this.sendMessage(s);
  }
  // Send a response to a request
  async sendResponse(e, t, s) {
    const o = {
      id: e.id,
      type: `${e.type}_RESPONSE`,
      data: s ? { error: s } : t,
      timestamp: Date.now(),
      origin: this.window.location.origin
    };
    this.sendMessage(o);
  }
  // Internal message sending
  sendMessage(e) {
    var s;
    const t = this.isParent ? this.window.frames[0] || ((s = this.window.document.querySelector("iframe")) == null ? void 0 : s.contentWindow) : this.window.parent;
    if (!t)
      throw new Error("Target window not found");
    this.allowedOrigins.has("*") ? t.postMessage(e, "*") : this.allowedOrigins.forEach((o) => {
      t.postMessage(e, o);
    });
  }
  // Set up message listener
  setupMessageListener() {
    this.window.addEventListener("message", async (e) => {
      try {
        await this.handleMessage(e);
      } catch (t) {
        console.error("Error handling message:", t);
      }
    });
  }
  // Handle incoming messages (can be overridden by subclasses)
  async handleMessage(e) {
    if (!this.isOriginAllowed(e.origin)) {
      console.warn("Message from unauthorized origin:", e.origin);
      return;
    }
    const t = e.data;
    if (!this.isValidMessage(t)) {
      console.warn("Invalid message structure:", t);
      return;
    }
    if (t.type.endsWith("_RESPONSE") && this.pendingRequests.has(t.id)) {
      this.handleResponse(t);
      return;
    }
    const s = this.messageHandlers.get(t.type);
    if (!s) {
      console.warn("No handler for message type:", t.type);
      return;
    }
    try {
      const o = await s(t.data);
      t.type.endsWith("_RESPONSE") || await this.sendResponse(t, o);
    } catch (o) {
      if (!t.type.endsWith("_RESPONSE")) {
        const n = { error: o instanceof Error ? o.message : String(o) };
        o && typeof o == "object" && "code" in o && o.code && (n.code = o.code);
        const i = {
          id: t.id,
          type: `${t.type}_RESPONSE`,
          data: n,
          timestamp: Date.now(),
          origin: this.window.location.origin
        };
        this.sendMessage(i);
      }
    }
  }
  // Handle response messages
  handleResponse(e) {
    const t = this.pendingRequests.get(e.id);
    if (t)
      if (clearTimeout(t.timeout), this.pendingRequests.delete(e.id), e.data && e.data.error) {
        const s = new Error(e.data.error);
        e.data.code && (s.code = e.data.code), t.reject(s);
      } else
        t.resolve(e.data);
  }
  // Validate message structure
  isValidMessage(e) {
    return e && typeof e.id == "string" && typeof e.type == "string" && typeof e.timestamp == "number" && typeof e.origin == "string" && // Validate timestamp is recent (within 5 minutes)
    Math.abs(Date.now() - e.timestamp) < 5 * 60 * 1e3;
  }
  // Check if origin is allowed
  isOriginAllowed(e) {
    return this.isInitialized ? this.allowedOrigins.has("*") || this.allowedOrigins.has(e) : !1;
  }
  // Generate unique message ID
  generateId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  // Cleanup
  destroy() {
    this.pendingRequests.forEach(({ timeout: e, reject: t }) => {
      clearTimeout(e), t(new Error("Messenger destroyed"));
    }), this.pendingRequests.clear(), this.messageHandlers.clear(), this.allowedOrigins.clear(), this.isInitialized = !1;
  }
}
class T extends L {
  constructor(e = window) {
    super(!0, e), this.iframe = null;
  }
  // Create and setup iframe
  createIframe(e, t) {
    return this.iframe = document.createElement("iframe"), this.iframe.src = e, this.iframe.style.cssText = `
      width: 100%;
      height: 600px;
      border: none;
      border-radius: 8px;
    `, (t || document.body).appendChild(this.iframe), this.iframe.addEventListener("load", () => {
      const o = new URL(e).origin;
      this.init([o]);
    }), this.iframe;
  }
  // Create hidden iframe (for Embassy use case)
  createHiddenIframe(e) {
    return this.iframe = document.createElement("iframe"), this.iframe.src = e, this.iframe.style.cssText = `
      position: fixed;
      top: -1000px;
      left: -1000px;
      width: 1px;
      height: 1px;
      border: none;
      opacity: 0;
      pointer-events: none;
    `, document.body.appendChild(this.iframe), this.iframe.addEventListener("load", () => {
      const t = new URL(e).origin;
      this.init([t]);
    }), this.iframe;
  }
  destroy() {
    this.iframe && this.iframe.parentNode && (this.iframe.parentNode.removeChild(this.iframe), this.iframe = null), super.destroy();
  }
}
const R = function(a) {
  return {
    HIDE_VAULT: () => {
      console.log("🔙 Hide vault signal received from vault iframe");
      try {
        return a.hide(), console.log("✅ Vault hidden successfully"), { acknowledged: !0 };
      } catch (e) {
        return console.error("❌ Failed to hide vault:", e), { acknowledged: !1, error: e instanceof Error ? e.message : "Unknown error" };
      }
    },
    SHOW_VAULT: (e = "vault") => (console.log("Show vault signal received"), a.show(e), { acknowledged: !0 }),
    VAULT_READY: () => {
      console.log("Vault ready signal received"), a._isReady = !0;
      const e = new CustomEvent("nostr:ready", {
        detail: { embassy: a }
      });
      return window.dispatchEvent(e), { acknowledged: !0 };
    },
    AUTH_STATUS: (e) => (console.log("Auth status signal received", e), { acknowledged: !0 }),
    GET_RELAYS: () => (console.log("Get relays signal received"), { acknowledged: !0 }),
    GOT_ERROR: () => (console.log("Error signal received"), { acknowledged: !0 }),
    PROMPT_REQUIRED: async (e) => (console.log("Prompt requested by vault:", e), (e == null ? void 0 : e.promptType) === "PIN_PAD" && (await a.requestPinUnlock() || console.warn("PIN prompt canceled or failed")), { acknowledged: !0 }),
    "nostrpass:unlocked": (e) => {
      console.log("🔓 Vault unlocked signal received from vault iframe", e), e != null && e.forOperation && (console.log("✅ Unlock was for an operation, notifying waiters"), a.notifyUnlocked());
    }
  };
}, _ = (a) => a.replace(/\./g, "-").replace(/:/g, "-").replace(/_/g, "-");
var g = /* @__PURE__ */ ((a) => (a.VAULT_READY = "VAULT_READY", a.AUTH_STATUS = "AUTH_STATUS", a.SHOW_VAULT = "SHOW_VAULT", a.HIDE_VAULT = "HIDE_VAULT", a.CHECK_PERMISSION = "CHECK_PERMISSION", a.GET_RELAYS = "GET_RELAYS", a.GET_PUBLIC_KEY = "GET_PUBLIC_KEY", a.SIGN_EVENT = "SIGN_EVENT", a.SIGN_DATA = "SIGN_DATA", a.ENCRYPT = "ENCRYPT", a.DECRYPT = "DECRYPT", a.GOT_ERROR = "GOT_ERROR", a.PROMPT_REQUIRED = "PROMPT_REQUIRED", a.MANAGE_ACCOUNTS = "MANAGE_ACCOUNTS", a))(g || {});
class D {
  constructor(e = {}) {
    f(this, "config");
    f(this, "iframe", null);
    f(this, "_isReady", !1);
    f(this, "styleElement", null);
    f(this, "backdropEl", null);
    f(this, "messenger", null);
    f(this, "handlers", []);
    f(this, "isPromptOpen", !1);
    // Reserved for future cooldown logic; intentionally unused for now
    // private lastUnlockAt = 0;
    f(this, "unlockResolvers", []);
    this.config = {
      appName: e.appName || document.title || "Unknown App",
      appDomain: e.appDomain || window.location.host,
      permissions: e.permissions || ["getPublicKey", "signEvent"],
      vaultUrl: e.vaultUrl || "http://localhost:3001",
      trustedOrigins: e.trustedOrigins,
      // Keep as-is, will handle defaults in initializeMessenger
      theme: e.theme || "auto",
      debug: e.debug || !1,
      parentPinOverlay: e.parentPinOverlay ?? !1
    }, this.handlers = Object.keys(R(this)), console.log("🚀 NostrPass Embassy initialized", this.config), this.injectStyles(), document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", () => this.createIframe()) : this.createIframe();
  }
  sleep(e) {
    return new Promise((t) => setTimeout(t, e));
  }
  waitForUnlock() {
    return new Promise((e) => {
      this.unlockResolvers.push(e), setTimeout(() => {
        const t = this.unlockResolvers.indexOf(e);
        t > -1 && (this.unlockResolvers.splice(t, 1), e());
      }, 6e4);
    });
  }
  notifyUnlocked() {
    for (console.log("🔓 Notifying unlock resolvers:", this.unlockResolvers.length); this.unlockResolvers.length > 0; ) {
      const e = this.unlockResolvers.shift();
      e && e();
    }
  }
  promptPin() {
    return new Promise((e) => {
      var P;
      if (this.isPromptOpen) return e(!1);
      this.isPromptOpen = !0;
      const t = (h) => h.sort(() => Math.random() - 0.5);
      (P = document.getElementById("np-pin-overlay")) == null || P.remove();
      const s = document.createElement("div");
      s.id = "np-pin-overlay", Object.assign(s.style, {
        position: "fixed",
        inset: "0",
        background: "rgba(0,0,0,0.5)",
        zIndex: "2147483647",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      });
      const o = document.createElement("div");
      Object.assign(o.style, {
        padding: "16px",
        borderRadius: "8px",
        width: "320px",
        maxWidth: "90vw",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
      });
      const l = document.createElement("h3");
      l.textContent = "Unlock Vault", Object.assign(l.style, { margin: "0 0 8px", fontSize: "16px" });
      const n = document.createElement("p");
      n.textContent = "Enter your PIN to continue.", Object.assign(n.style, { margin: "0 0 12px", color: "#555", fontSize: "13px" });
      const i = document.createElement("div");
      Object.assign(i.style, { display: "flex", justifyContent: "center", gap: "12px", marginBottom: "12px" });
      const r = (h) => {
        i.innerHTML = "";
        for (let p = 0; p < 6; p++) {
          const y = document.createElement("div");
          y.style.width = "12px", y.style.height = "12px", y.style.borderRadius = "9999px", y.style.border = "2px solid " + (p < h ? "#111" : "#d1d5db"), i.appendChild(y);
        }
      }, c = document.createElement("div");
      Object.assign(c.style, {
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "10px",
        width: "240px",
        margin: "0 auto"
      });
      const d = (h) => {
        const p = document.createElement("button");
        return p.textContent = h, Object.assign(p.style, {
          width: "76px",
          height: "56px",
          border: "1px solid #d1d5db",
          borderRadius: "8px",
          fontWeight: "600",
          cursor: "pointer"
        }), p;
      }, w = (h) => {
        const p = document.createElement("button");
        return p.textContent = h, Object.assign(p.style, {
          height: "44px",
          border: "1px solid #d1d5db",
          borderRadius: "8px",
          background: "#fff",
          cursor: "pointer"
        }), p;
      };
      let m = "";
      const v = t(["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"]), b = () => {
        this.isPromptOpen = !1, s.remove();
      }, O = async () => {
        try {
          const h = await this.messenger.request("UNLOCK_WITH_PIN", { pin: m });
          if (h != null && h.success)
            b(), e(!0);
          else {
            for (m = "", r(0); c.firstChild; ) c.removeChild(c.firstChild);
            t(v), k();
          }
        } catch {
          m = "", r(0);
        }
      }, S = (h) => {
        m.length >= 6 || (m += h, r(m.length), m.length === 6 && O());
      }, I = () => {
        m && (m = m.slice(0, -1), r(m.length));
      }, k = () => {
        v.forEach((y) => {
          const C = d(y);
          C.addEventListener("click", () => S(y)), c.appendChild(C);
        });
        const h = w("← Delete");
        h.style.gridColumn = "span 2", h.addEventListener("click", I), c.appendChild(h);
        const p = document.createElement("div");
        c.appendChild(p);
      }, E = document.createElement("div");
      Object.assign(E.style, { display: "flex", gap: "8px", marginTop: "12px", justifyContent: "flex-end" });
      const x = w("Cancel");
      x.addEventListener("click", () => {
        b(), e(!1);
      }), E.appendChild(x), o.appendChild(l), o.appendChild(n), o.appendChild(i), r(0), k(), o.appendChild(c), o.appendChild(E), s.appendChild(o), document.body.appendChild(s);
    });
  }
  requestPinUnlock() {
    return this.promptPin();
  }
  // Core iframe management
  async createIframe() {
    if (this.iframe) {
      this.config.debug && console.log("Iframe already exists");
      return;
    }
    return new Promise((e, t) => {
      this.iframe = document.createElement("iframe"), this.iframe.id = "nostrpass-vault-iframe";
      const s = new URL(this.config.vaultUrl + "/" + _(this.config.appDomain));
      s.searchParams.set("appName", this.config.appName), s.searchParams.set("appDomain", this.config.appDomain), s.searchParams.set("theme", this.config.theme), this.iframe.src = s.toString(), console.log("iframe.src", s.toString()), this.iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"), this.iframe.setAttribute("allow", "publickey-credentials-create; publickey-credentials-get"), this.iframe.setAttribute("aria-hidden", "true"), this.iframe.setAttribute("tabindex", "-1"), this.iframe.setAttribute("title", "NostrPass Vault"), this.iframe.className = "nostrpass-iframe nostrpass-iframe-hidden", this.iframe.style.background = "transparent", this.iframe.style.backgroundColor = "transparent", this.iframe.setAttribute("allowtransparency", "true"), this.config.debug && new URLSearchParams(window.location.search).has("embassy-debug") && (this.iframe.classList.add("nostrpass-iframe-debug"), this.iframe.classList.remove("nostrpass-iframe-hidden")), this.initializeMessenger(), this.iframe.onload = () => {
        this.config.debug && console.log("Iframe loaded successfully"), setTimeout(() => {
          this.config.debug && console.log("Iframe initialization period complete"), e();
        }, 100);
      }, this.iframe.onerror = () => {
        console.error("Failed to load NostrPass vault"), t(new Error("Failed to load vault iframe"));
      }, this.backdropEl || (this.backdropEl = document.createElement("div"), this.backdropEl.className = "nostrpass-backdrop", this.backdropEl.addEventListener("click", () => this.hide())), document.body.appendChild(this.backdropEl), document.body.appendChild(this.iframe), this.config.debug && console.log("Iframe created and added to DOM");
    });
  }
  show(e = "vault", t = "full") {
    if (!this.iframe) {
      console.warn("Cannot show iframe - not created yet"), this.createIframe().then(() => this.show(e, t));
      return;
    }
    if (this.iframe.classList.remove("nostrpass-iframe-hidden"), t === "minimal" ? (this.iframe.classList.remove("nostrpass-iframe-visible"), this.iframe.classList.add("nostrpass-iframe-minimal")) : (this.iframe.classList.remove("nostrpass-iframe-minimal"), this.iframe.classList.add("nostrpass-iframe-visible")), this.backdropEl && (this.backdropEl.style.display = "block"), this.iframe.setAttribute("aria-hidden", "false"), this.iframe.removeAttribute("tabindex"), document.body.style.overflow = "hidden", t === "minimal" && e === "vault" && this.messenger)
      try {
        this.messenger.send("NAVIGATE_TO_UNLOCK", {});
      } catch (s) {
        console.warn("Failed to send navigation message:", s);
      }
    this.config.debug && console.log("Iframe shown in", t, "mode");
  }
  hide() {
    if (console.log("🔙 Embassy hide() method called"), !this.iframe) {
      console.warn("Cannot hide iframe - not created yet");
      return;
    }
    console.log("🔙 Hiding iframe, current classes:", this.iframe.className), this.iframe.classList.remove("nostrpass-iframe-visible"), this.iframe.classList.remove("nostrpass-iframe-minimal"), this.iframe.classList.add("nostrpass-iframe-hidden"), this.backdropEl && (this.backdropEl.style.display = "none"), this.iframe.setAttribute("aria-hidden", "true"), this.iframe.setAttribute("tabindex", "-1"), document.body.style.overflow = "", console.log("🔙 Iframe hidden, new classes:", this.iframe.className), this.config.debug && console.log("Iframe hidden");
  }
  injectStyles() {
    this.styleElement || (this.styleElement = document.createElement("style"), this.styleElement.id = "nostrpass-embassy-styles", this.styleElement.textContent = `
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
    `, document.head.appendChild(this.styleElement), this.config.debug && console.log("Styles injected"));
  }
  // Initialize messenger for secure communication
  initializeMessenger() {
    if (!this.iframe) return;
    this.messenger = new T(window), this.messenger.sendMessage = (t) => {
      var o;
      if (!((o = this.iframe) != null && o.contentWindow)) {
        console.error("Iframe contentWindow not available");
        return;
      }
      const s = new URL(this.iframe.src).origin;
      this.iframe.contentWindow.postMessage(t, s);
    };
    let e;
    if (this.config.trustedOrigins && this.config.trustedOrigins.length > 0 ? e = [...this.config.trustedOrigins] : e = [
      "https://nostrpass.com",
      "https://app.nostrpass.com",
      "https://www.nostrpass.com"
    ], this.config.vaultUrl)
      try {
        const t = new URL(this.config.vaultUrl).origin;
        e.includes(t) || e.push(t);
      } catch (t) {
        console.warn("Failed to parse vaultUrl origin:", t);
      }
    (this.iframe.src.includes("localhost") || this.iframe.src.includes("127.0.0.1")) && (e.includes("http://localhost:3001") || e.push("http://localhost:3001"), e.includes("http://127.0.0.1:3001") || e.push("http://127.0.0.1:3001")), this.messenger.init(e), this.setupMessageHandlers(), this.config.debug && console.log("Messenger initialized with trusted origins:", e);
  }
  // Set up handlers for vault messages
  setupMessageHandlers() {
    if (!this.messenger) return;
    const e = R(this);
    console.log("Setting up message handlers:", this.handlers), this.handlers.forEach((t) => {
      console.log("Registering handler for:", t), this.messenger.on(t, e[t]);
    }), this.config.debug && console.log("Message handlers registered:", this.messenger.messageHandlers);
  }
  // Core Nostr methods
  async getPublicKey(e) {
    (!this.iframe || !this.messenger) && (await this.createIframe(), await this.waitForReady());
    try {
      const t = (e == null ? void 0 : e.identityIndex) ?? 0;
      let s = null;
      try {
        const l = await this.messenger.request(g.CHECK_PERMISSION, {
          action: "getPublicKey",
          identityIndex: t
        }), n = (l == null ? void 0 : l.isLocked) === !0, i = (l == null ? void 0 : l.needsPrompt) === !0;
        if (n && this.config.parentPinOverlay) {
          if (!await this.requestPinUnlock()) throw new Error("User canceled PIN prompt");
        } else n && !this.config.parentPinOverlay ? (console.log("⏳ Setting up unlock wait promise..."), s = this.waitForUnlock(), this.show("vault", "minimal")) : i && !this.config.parentPinOverlay && this.show("vault", "full");
      } catch (l) {
        String((l == null ? void 0 : l.message) || l).toLowerCase().includes("not authenticated") && (console.log("⚠️ User not authenticated, showing full vault for login"), this.show("vault", "full"));
      }
      s && (console.log("⏳ Waiting for vault unlock..."), await s, console.log("✅ Vault unlocked, continuing operation"));
      const o = await this.messenger.request(g.GET_PUBLIC_KEY, {
        appName: this.config.appName,
        appDomain: this.config.appDomain,
        identityIndex: t
      });
      return this.config.debug && console.log("Public key received:", o), this.hide(), o.publicKey || o;
    } catch (t) {
      throw console.error("Failed to get public key:", t), t;
    }
  }
  async signEvent(e, t) {
    (!this.iframe || !this.messenger) && (await this.createIframe(), await this.waitForReady());
    try {
      const s = (t == null ? void 0 : t.identityIndex) ?? 0;
      let o = null;
      try {
        const n = await this.messenger.request(g.CHECK_PERMISSION, {
          action: "signEvent",
          eventKind: e == null ? void 0 : e.kind,
          identityIndex: s
        }), i = (n == null ? void 0 : n.isLocked) === !0, r = (n == null ? void 0 : n.needsPrompt) === !0;
        if (i && this.config.parentPinOverlay) {
          if (!await this.requestPinUnlock()) throw new Error("User canceled PIN prompt");
        } else i && !this.config.parentPinOverlay ? (console.log("⏳ Setting up unlock wait promise..."), o = this.waitForUnlock(), this.show("vault", "minimal")) : r && !this.config.parentPinOverlay && this.show("vault", "full");
      } catch (n) {
        String((n == null ? void 0 : n.message) || n).toLowerCase().includes("not authenticated") && (console.log("⚠️ User not authenticated, showing full vault for login"), this.show("vault", "full"));
      }
      o && (console.log("⏳ Waiting for vault unlock..."), await o, console.log("✅ Vault unlocked, continuing operation"));
      const l = async () => this.messenger.request(g.SIGN_EVENT, {
        event: e,
        appName: this.config.appName,
        appDomain: this.config.appDomain,
        identityIndex: s
      });
      try {
        const n = await l();
        return this.config.debug && console.log("Signed event received:", n), this.hide(), n.signedEvent || n;
      } catch (n) {
        const i = String((n == null ? void 0 : n.message) || n);
        if (i.toLowerCase().includes("vault is locked") || i.toLowerCase().includes("rehydrated")) {
          await this.sleep(150);
          const r = await l();
          return this.config.debug && console.log("Signed event received (retry):", r), this.hide(), r.signedEvent || r;
        }
        throw n;
      }
    } catch (s) {
      throw console.error("Failed to sign event:", s), s;
    }
  }
  async getRelays() {
    return console.log("TODO: getRelays"), {};
  }
  async signData(e, t) {
    (!this.iframe || !this.messenger) && (await this.createIframe(), await this.waitForReady());
    try {
      const s = (t == null ? void 0 : t.identityIndex) ?? 0;
      let o = null;
      try {
        const n = await this.messenger.request(g.CHECK_PERMISSION, {
          action: "signData",
          identityIndex: s
        }), i = (n == null ? void 0 : n.isLocked) === !0, r = (n == null ? void 0 : n.needsPrompt) === !0;
        if (i && this.config.parentPinOverlay) {
          if (!await this.requestPinUnlock()) throw new Error("User canceled PIN prompt");
        } else i && !this.config.parentPinOverlay ? (console.log("⏳ Setting up unlock wait promise..."), o = this.waitForUnlock(), this.show("vault", "minimal")) : r && !this.config.parentPinOverlay && this.show("vault", "full");
      } catch (n) {
        String((n == null ? void 0 : n.message) || n).toLowerCase().includes("not authenticated") && (console.log("⚠️ User not authenticated, showing full vault for login"), this.show("vault", "full"));
      }
      o && (console.log("⏳ Waiting for vault unlock..."), await o, console.log("✅ Vault unlocked, continuing operation"));
      const l = async () => this.messenger.request(g.SIGN_DATA, {
        data: e,
        appName: this.config.appName,
        appDomain: this.config.appDomain,
        identityIndex: s
      });
      try {
        const n = await l(), i = (n == null ? void 0 : n.signature) ?? n;
        return this.config.debug && console.log("Signed data received:", i), this.hide(), i;
      } catch (n) {
        const i = String((n == null ? void 0 : n.message) || n);
        if (i.toLowerCase().includes("locked") || i.toLowerCase().includes("unlock") || i.toLowerCase().includes("rehydrated")) {
          await this.sleep(150);
          try {
            const r = await l();
            return this.hide(), (r == null ? void 0 : r.signature) ?? r;
          } catch (r) {
            if (String((r == null ? void 0 : r.message) || r).toLowerCase().includes("rehydrated")) {
              await this.sleep(200);
              const d = await l();
              return this.hide(), (d == null ? void 0 : d.signature) ?? d;
            }
            throw r;
          }
        }
        throw n;
      }
    } catch (s) {
      throw console.error("Failed to sign data:", s), s;
    }
  }
  async encrypt(e, t, s) {
    (!this.iframe || !this.messenger) && (await this.createIframe(), await this.waitForReady());
    try {
      const o = (s == null ? void 0 : s.identityIndex) ?? 0;
      let l = null;
      try {
        const i = await this.messenger.request(g.CHECK_PERMISSION, {
          action: "nip04",
          identityIndex: o
        }), r = (i == null ? void 0 : i.isLocked) === !0, c = (i == null ? void 0 : i.needsPrompt) === !0;
        if (r && this.config.parentPinOverlay) {
          if (!await this.requestPinUnlock()) throw new Error("User canceled PIN prompt");
        } else r && !this.config.parentPinOverlay ? (console.log("⏳ Setting up unlock wait promise..."), l = this.waitForUnlock(), this.show("vault", "minimal")) : c && !this.config.parentPinOverlay && this.show("vault", "full");
      } catch (i) {
        String((i == null ? void 0 : i.message) || i).toLowerCase().includes("not authenticated") && (console.log("⚠️ User not authenticated, showing full vault for login"), this.show("vault", "full"));
      }
      l && (console.log("⏳ Waiting for vault unlock..."), await l, console.log("✅ Vault unlocked, continuing operation"));
      const n = async () => this.messenger.request(g.ENCRYPT, {
        plaintext: t,
        recipientPubkey: e,
        appName: this.config.appName,
        appDomain: this.config.appDomain,
        identityIndex: o
      });
      try {
        const i = await n();
        return this.config.debug && console.log("Encrypted payload received:", i), this.hide(), i;
      } catch (i) {
        const r = String((i == null ? void 0 : i.message) || i);
        if (r.toLowerCase().includes("locked") || r.toLowerCase().includes("unlock") || r.toLowerCase().includes("rehydrated")) {
          await this.sleep(150);
          try {
            const c = await n();
            return this.hide(), c;
          } catch (c) {
            if (String((c == null ? void 0 : c.message) || c).toLowerCase().includes("rehydrated")) {
              await this.sleep(200);
              const w = await n();
              return this.hide(), w;
            }
            throw c;
          }
        }
        throw i;
      }
    } catch (o) {
      throw console.error("Failed to encrypt:", o), o;
    }
  }
  async decrypt(e, t, s) {
    (!this.iframe || !this.messenger) && (await this.createIframe(), await this.waitForReady());
    try {
      const o = (s == null ? void 0 : s.identityIndex) ?? 0;
      let l = null;
      try {
        const i = await this.messenger.request(g.CHECK_PERMISSION, {
          action: "nip04",
          identityIndex: o
        }), r = (i == null ? void 0 : i.isLocked) === !0, c = (i == null ? void 0 : i.needsPrompt) === !0;
        if (r && this.config.parentPinOverlay) {
          if (!await this.requestPinUnlock()) throw new Error("User canceled PIN prompt");
        } else r && !this.config.parentPinOverlay ? (console.log("⏳ Setting up unlock wait promise..."), l = this.waitForUnlock(), this.show("vault", "minimal")) : c && !this.config.parentPinOverlay && this.show("vault", "full");
      } catch (i) {
        String((i == null ? void 0 : i.message) || i).toLowerCase().includes("not authenticated") && (console.log("⚠️ User not authenticated, showing full vault for login"), this.show("vault", "full"));
      }
      l && (console.log("⏳ Waiting for vault unlock..."), await l, console.log("✅ Vault unlocked, continuing operation"));
      const n = async () => this.messenger.request(g.DECRYPT, {
        ciphertext: t,
        senderPubkey: e,
        appName: this.config.appName,
        appDomain: this.config.appDomain,
        identityIndex: o
      });
      try {
        const i = await n();
        return this.config.debug && console.log("Decrypted payload received:", i), this.hide(), i;
      } catch (i) {
        const r = String((i == null ? void 0 : i.message) || i);
        if (r.toLowerCase().includes("locked") || r.toLowerCase().includes("unlock") || r.toLowerCase().includes("rehydrated")) {
          await this.sleep(150);
          try {
            const c = await n();
            return this.hide(), c;
          } catch (c) {
            if (String((c == null ? void 0 : c.message) || c).toLowerCase().includes("rehydrated")) {
              await this.sleep(200);
              const w = await n();
              return this.hide(), w;
            }
            throw c;
          }
        }
        throw i;
      }
    } catch (o) {
      throw console.error("Failed to decrypt:", o), o;
    }
  }
  async manageAccount(e = {}) {
    (!this.iframe || !this.messenger) && (await this.createIframe(), await this.waitForReady());
    const t = e.forcePrompt ?? !0;
    this.show("vault", "full");
    try {
      return await this.messenger.request(g.MANAGE_ACCOUNTS, {
        appName: this.config.appName,
        appDomain: this.config.appDomain,
        forcePrompt: t
      });
    } finally {
      try {
        this.hide();
      } catch (s) {
        console.warn("Failed to hide vault after manageAccount:", s);
      }
    }
  }
  createAccountManagerButton(e = {}) {
    const {
      label: t = "Manage NostrPass Account",
      className: s = "nostrpass-account-button",
      appendTo: o,
      buttonElement: l,
      disabledText: n,
      onSelect: i,
      onError: r,
      forcePrompt: c
    } = e, d = l ?? document.createElement("button");
    l ? s && (l.className = s) : (d.type = "button", d.className = s, d.textContent = t);
    const w = async (m) => {
      m.preventDefault();
      const v = d.textContent;
      try {
        d.disabled = !0, n && (d.textContent = n);
        const b = await this.manageAccount({ forcePrompt: c });
        i == null || i(b);
      } catch (b) {
        r ? r(b) : console.error("[NostrPass] Failed to manage account:", b);
      } finally {
        d.disabled = !1, n && v !== void 0 && v !== null && (d.textContent = v);
      }
    };
    if (d.addEventListener("click", w), o) {
      const m = typeof o == "string" ? document.querySelector(o) : o;
      m ? d.parentElement || m.appendChild(d) : console.warn("[NostrPass] Unable to find target element for account manager button:", o);
    }
    return d;
  }
  // Public utility methods
  isReady() {
    return this._isReady;
  }
  async waitForReady() {
    if (!this._isReady)
      return new Promise((e) => {
        const t = () => {
          this._isReady ? e() : setTimeout(t, 100);
        };
        t();
      });
  }
  // Cleanup
  destroy() {
    this.messenger && (this.messenger.destroy(), this.messenger = null), this.iframe && this.iframe.parentNode && (this.iframe.parentNode.removeChild(this.iframe), this.iframe = null), this.backdropEl && this.backdropEl.parentNode && (this.backdropEl.parentNode.removeChild(this.backdropEl), this.backdropEl = null), this.styleElement && this.styleElement.parentNode && (this.styleElement.parentNode.removeChild(this.styleElement), this.styleElement = null), this._isReady = !1, this.config.debug && console.log("Embassy destroyed");
  }
}
let u = null;
function N(a = {}) {
  return u && u.destroy(), u = new D(a), {
    getPublicKey: (t) => u.getPublicKey(t),
    signEvent: (t, s) => u.signEvent(t, s),
    signData: (t, s) => u.signData(t, s),
    getRelays: () => u.getRelays(),
    nip04: {
      encrypt: (t, s, o) => u.encrypt(t, s, o),
      decrypt: (t, s, o) => u.decrypt(t, s, o)
    },
    manageAccount: (t) => u.manageAccount(t),
    createAccountManagerButton: (t) => u.createAccountManagerButton(t)
  };
}
function M() {
  console.log("showVault"), u == null || u.show();
}
function q() {
  u == null || u.hide();
}
if (typeof window < "u") {
  window.initNostrPass = N, window.showVault = M, window.hideVault = q;
  const a = document.currentScript;
  if ((a == null ? void 0 : a.getAttribute("data-manual-init")) === "true")
    console.log("✅ NostrPass Embassy loaded (manual init mode)");
  else {
    const t = {};
    a != null && a.hasAttribute("data-vault-url") && (t.vaultUrl = a.getAttribute("data-vault-url") || void 0), a != null && a.hasAttribute("data-app-name") && (t.appName = a.getAttribute("data-app-name") || void 0), a != null && a.hasAttribute("data-debug") && (t.debug = a.getAttribute("data-debug") === "true"), a != null && a.hasAttribute("data-theme") && (t.theme = a.getAttribute("data-theme") || void 0);
    const s = N(t);
    window.nostr = s, console.log("✅ NostrPass Embassy auto-initialized with config:", t);
  }
  console.log("💡 Use window.initNostrPass(config) to customize");
}
export {
  D as NostrPassEmbassy,
  N as initNostrPass
};
//# sourceMappingURL=embassy.js.map
