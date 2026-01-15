# NostrPass: The Identity Problem Nostr Needed to Solve

**How a privacy-first vault is making self-sovereign identity actually usable**

If you've spent any time in the Nostr ecosystem, you've probably experienced the friction: copying and pasting your private key between apps, wondering if you just exposed it to a malicious extension, or worse—losing access to your identity because you forgot where you stored your nsec. For all of Nostr's promise of decentralization and censorship resistance, the user experience around identity has been, frankly, a mess.

NostrPass emerged from a simple observation: if we want Nostr to go mainstream, we need to make key management invisible to users while keeping it completely secure. It's a password manager for your Nostr identities—but unlike traditional password managers, it's built from the ground up for decentralization, with your keys never leaving your device and zero knowledge on the server side.

After months of development and several architectural pivots, NostrPass now offers something rare in the crypto world: bank-grade security that doesn't require users to be cryptography experts.

## The Core Problem: Keys Are Hard

Let's be honest about the state of Nostr identity management. Most users are doing one of several terrible things:

**The Browser Extension Gamble**: Installing a browser extension and hoping it's not malicious. Every Nostr app can now access your keys through `window.nostr`, which is convenient—until you realize you've given every webpage full access to sign anything.

**The Copy-Paste Nightmare**: Manually copying your nsec between apps. This exposes your private key to clipboard managers, screen recording software, and shoulder surfers. It's also incredibly tedious.

**The Single-Identity Trap**: Using the same identity for everything because managing multiple keys is too painful. Want a professional Nostr presence separate from your personal one? Good luck remembering which key is which.

**The Recovery Panic**: Storing your key in a text file, a password manager not designed for crypto, or worse—not storing it at all and hoping you never lose your browser data.

NostrPass solves all of these problems with an architecture that's both more secure and dramatically easier to use.

## How It Actually Works

The magic of NostrPass happens in the space between your browser and Nostr apps, using a technique that's both elegant and battle-tested: iframe isolation with cryptographic operations in a Web Worker.

When you integrate NostrPass into an app, you include a small SDK (about 50KB) that creates a hidden iframe pointing to your vault. This vault runs on a completely different origin—meaning it has its own separate storage, its own separate execution context, and browser-enforced security boundaries.

Here's what happens when an app wants to sign an event:

1. The app calls `window.nostr.signEvent()` as if it were using any NIP-07 extension
2. The NostrPass SDK sends a secure message to the vault iframe
3. The vault checks: Is this app allowed? What permissions does the user have?
4. If needed, the vault UI appears asking for permission or PIN unlock
5. The vault sends the event to a Web Worker where your actual private key lives
6. The Worker signs the event using audited cryptography libraries
7. The signed event travels back through the chain to the app

At no point does the app see your private key. At no point does the main thread see your private key. The Worker holds decrypted keys only in memory for the duration of your session, clearing everything on logout or timeout.

## The Cryptography Stack: Why We Chose Noble

Early versions of NostrPass explored using WebAssembly for cryptographic operations—compiling Rust crypto libraries to WASM for maximum performance and security. But we ran into several problems: large bundle sizes (500KB+), compilation delays on initialization, and debugging challenges when things went wrong.

Instead, we bet on the **Noble cryptography ecosystem**—a collection of audited, production-tested JavaScript libraries that have processed millions of real cryptocurrency transactions. This turned out to be the right call.

Noble gives us:

- **Schnorr signatures** via `@noble/curves/secp256k1`—the same curve Bitcoin uses
- **Hierarchical deterministic keys** via `@scure/bip32`—generate unlimited identities from one seed
- **Mnemonic recovery phrases** via `@scure/bip39`—industry-standard 12 or 24-word backups
- **Secure hashing and key derivation** via `@noble/hashes`—SHA-256, PBKDF2 with 100,000 iterations
- **AES-256-GCM encryption** that uses the browser's native Web Crypto API when available, with a pure JavaScript fallback for mobile HTTP contexts

The result? A ~100KB crypto bundle that initializes instantly, debugs easily, and runs on every platform from desktop browsers to mobile WebViews.

## Multiple Identities: The Killer Feature

One of NostrPass's most powerful features is effortless multi-identity management. Under the hood, it uses BIP32 key derivation—the same technology Bitcoin wallets use to generate unlimited addresses from a single seed.

Your master seed generates a tree of identities:

```
Master Seed
├── Identity 0: Personal (your main social presence)
├── Identity 1: Professional (work-related content)
├── Identity 2: Anonymous (privacy-sensitive discussions)
├── Identity 3: Bot account (automated posting)
└── ... unlimited more
```

Each identity is a completely separate Nostr keypair with its own:

- Public/private key
- Permission settings per app
- Usage history
- Customizable nickname

But you only need to remember one password (and optionally a PIN for quick access). Everything else derives deterministically from your master seed.

Want to post professional technical content without linking it to your personal identity? Switch identities in two clicks. Need a burner identity for a controversial discussion? Generate a new one instantly. The friction of managing multiple Nostr identities drops to zero.

## Permissions: Granular Control Without the Hassle

Most Nostr signing solutions are all-or-nothing: either an app can sign anything, or it can't sign at all. NostrPass gives you surgical precision.

Permissions are set per-identity, per-app, per-operation type, and even per-event-kind. Here's what that looks like in practice:

**Social Media Client:**
- Text notes (kind 1): ALLOW (auto-approve, no prompt)
- DMs (kind 4): ASK_EVERYTIME (always prompt)
- Get public key: ALLOW
- NIP-04 encryption: ASK_PER_SESSION (ask once per session)

**Professional Publishing Platform:**
- Long-form articles (kind 30023): ALLOW
- Comments (kind 1): ALLOW
- Arbitrary data signing: DENY
- Get public key: ALLOW

**Unknown New App:**
- Everything: ASK_EVERYTIME (maximum security until you trust it)

The permission system learns from your habits. If you always approve something, you can set it to ALLOW and stop seeing prompts. If you're trying a new app, leave everything on ASK_EVERYTIME until you trust it.

## The Security Model: Defense in Depth

NostrPass doesn't rely on a single security mechanism—it uses layered defenses that would all need to fail simultaneously for an attack to succeed.

**Layer 1: Origin Validation**
Every message between the app and vault is checked against a whitelist of allowed origins. A malicious website can't just start sending messages to your vault.

**Layer 2: Iframe Sandbox**
The vault runs in a sandboxed iframe with restricted permissions. It can't access the parent page's DOM, cookies, or localStorage. Even if the parent app is compromised, it can't read your vault data.

**Layer 3: Web Worker Isolation**
All cryptographic operations happen in a separate thread. Private keys are never deserialized on the main thread—ever. Memory inspection of the main thread reveals nothing.

**Layer 4: Process Isolation**
The vault runs on a different domain than the app. Browser same-origin policy provides hardware-enforced isolation—the operating system won't let the processes share memory.

**Layer 5: Encryption at Rest**
Your vault data is encrypted with AES-256-GCM before storage. The encryption key is derived from your password using PBKDF2 with 100,000 iterations. Even if someone gets your IndexedDB data, it's useless without your password.

**Layer 6: No Plaintext Storage**
Private keys are never stored unencrypted. When you unlock your vault, keys are decrypted in the Worker's memory and cleared after one hour or on logout.

This isn't security theater—it's the same multi-layer approach banks and cryptocurrency wallets use to protect billions of dollars.

## Decentralized Sync: Your Vault, Everywhere

Most password managers store your encrypted vault on their servers. NostrPass does something more aligned with Nostr's philosophy: it publishes your encrypted vault as a Nostr event (kind 30078).

When you sign up or make changes to your vault, NostrPass:

1. Encrypts your entire vault with your password
2. Signs the encrypted blob with a special "storage identity" derived from your master seed
3. Publishes it to Nostr relays as a replaceable event
4. Stores a copy in your browser's IndexedDB for offline access

When you log in from a new device:

1. NostrPass queries Nostr relays for your vault event
2. Downloads the encrypted vault
3. Decrypts it with your password
4. Restores your identities, permissions, and settings

This means:

- ✅ No central server holding your data
- ✅ Cross-device sync through Nostr relays
- ✅ End-to-end encryption—relays only see encrypted blobs
- ✅ Zero knowledge—NostrPass can't decrypt your vault
- ✅ Censorship resistance—published on multiple relays

If NostrPass the service disappeared tomorrow, your vault would still be on Nostr relays, decryptable with your password.

## Real-World Usage: The Experience

Let me walk you through what using NostrPass actually feels like.

**First Time Setup** (2 minutes):

1. Visit vault.nostrpass.com
2. Choose a username and password
3. Optionally set a 4-6 digit PIN for quick unlock
4. Your vault creates your first identity automatically
5. You see a recovery phrase—write it down (seriously, do this)

That's it. No email verification, no KYC, no phone number. Just username + password.

**Using an App** (seconds):

1. Click "Login with NostrPass" on any integrated app
2. The vault appears—either full-screen for first login or as a small popup for quick unlock
3. Enter PIN (or password if session expired)
4. Approve permissions if first time using this app
5. You're in

The next time you use that app, it might not even prompt you—if you've set text notes to ALLOW, it just signs them instantly.

**Switching Identities** (1 click):

Most apps that integrate NostrPass show an account switcher—click your current identity, pick a different one from the dropdown. Done.

**Managing Permissions** (when needed):

Open the vault dashboard to see all apps that have accessed your identities, what permissions they have, and when they last requested something. Revoke access with one click.

## Mobile: It Just Works

Because NostrPass is built on web standards, it works everywhere browsers work—including WebViews in native mobile apps.

React Native developers can embed NostrPass in a WebView:

```javascript
<WebView
  source={{ uri: 'https://your-app.com' }}
  injectedJavaScript={`
    (function() {
      const script = document.createElement('script');
      script.src = 'https://cdn.nostrpass.com/embassy.js';
      document.head.appendChild(script);
    })();
  `}
/>
```

The Noble crypto libraries include automatic fallbacks for environments where the Web Crypto API isn't available (like mobile HTTP contexts), so everything works seamlessly.

We've tested NostrPass in:
- iOS Safari
- Android Chrome
- React Native WebView
- Capacitor/Ionic apps
- Progressive Web Apps

It works everywhere. No native code required.

## For Developers: Integration in 5 Minutes

If you're building a Nostr app, integrating NostrPass is almost trivially easy:

```html
<!-- 1. Include the SDK -->
<script src="https://cdn.nostrpass.com/embassy.js"></script>

<!-- 2. Use it -->
<script>
  // Get the user's public key
  const pubkey = await window.nostr.getPublicKey();

  // Sign an event
  const event = {
    kind: 1,
    content: 'Hello Nostr!',
    tags: [],
    created_at: Math.floor(Date.now() / 1000)
  };
  const signed = await window.nostr.signEvent(event);

  // Publish to relays
  await publishToRelays(signed);
</script>
```

That's literally it. The SDK auto-initializes, creates the vault iframe, and exposes `window.nostr` exactly like NIP-07 extensions do.

If your app already supports browser extensions like nos2x or Alby, it already supports NostrPass with zero code changes.

**Self-Hosting:**

Don't trust the hosted version? Self-hosting takes 5 commands:

```bash
git clone https://github.com/nostrpass/nostrpass.git
cd nostrpass
pnpm install
pnpm build
# Deploy /apps/vault/dist to your server
```

Point the SDK at your vault:

```javascript
window.initNostrPass({
  vaultUrl: 'https://vault.yourcompany.com'
});
```

Now you're using your own vault instance. All the security properties remain—you still can't see users' keys, they're still encrypted end-to-end, sync still works through Nostr relays.

## The Road Ahead

NostrPass is production-ready today, but there's still a roadmap of features we're excited about:

**Near-term:**
- NIP-44 encryption support (newer, better encrypted DMs)
- Hardware wallet integration (sign with Ledger/Trezor)
- Social recovery (M-of-N threshold recovery with trusted contacts)
- Passkey/WebAuthn support (sign in with biometrics)

**Medium-term:**
- Advanced permission rules (time-based, amount limits for zaps)
- Audit logs (complete history of every signature)
- Multi-device approval (require multiple devices to sign sensitive events)
- Developer SDK for React, Vue, Svelte

**Long-term:**
- Professional security audit (we're in talks with several firms)
- Bug bounty program
- Formal verification of critical crypto code
- Browser extension version for even tighter integration

## Why This Matters

Nostr has the potential to fundamentally change how we communicate online—no censorship, no centralized platforms, no algorithmic manipulation. But it can't achieve mainstream adoption if managing keys requires a computer science degree.

NostrPass makes self-sovereign identity accessible. Your grandmother could use it (with a good tutorial). Developers can integrate it in minutes. Power users can self-host it. Privacy advocates can audit it.

Most importantly, it doesn't compromise on security to achieve usability. The cryptography is conservative, audited, and battle-tested. The architecture is defense-in-depth. The code is open source.

If Nostr is going to grow beyond the early adopter crowd, tools like NostrPass are essential—they make the promise of decentralization tangible for people who don't want to think about key management.

## Try It Yourself

The best way to understand NostrPass is to use it:

1. Visit [vault.nostrpass.com](https://vault.nostrpass.com)
2. Create an account (no email required)
3. Try it with any Nostr app that supports NIP-07

Or if you're a developer, integrate it into your app and see how your users respond to a dramatically simpler auth flow.

The code is on [GitHub](https://github.com/nostrpass/nostrpass), fully MIT licensed. We welcome contributions, security reviews, and feedback.

---

**Technical Deep Dive**: For the curious, the full technical specification including cryptographic parameters, API documentation, and architecture diagrams is available in the [NostrPass documentation](https://docs.nostrpass.com).

**Built with**:
- [Noble Cryptography](https://paulmillr.com/noble/) - Audited JavaScript crypto
- [nostr-tools](https://github.com/nbd-wtf/nostr-tools) - Nostr protocol implementation
- [SolidJS](https://www.solidjs.com/) - Reactive UI framework
- [TypeScript](https://www.typescriptlang.org/) - Type-safe development

---

## Publishing to Nostr

When publishing this article to Nostr as a long-form event (kind 30023), use these tags:

```json
{
  "kind": 30023,
  "tags": [
    ["d", "nostrpass-article-2025"],
    ["title", "NostrPass: The Identity Problem Nostr Needed to Solve"],
    ["summary", "How a privacy-first vault is making self-sovereign identity actually usable on Nostr—without compromising security."],
    ["published_at", "1736294400"],
    ["t", "nostr"],
    ["t", "security"],
    ["t", "identity"],
    ["t", "nostrpass"],
    ["t", "nip07"],
    ["t", "privacy"],
    ["t", "cryptography"],
    ["t", "opensource"],
    ["image", "https://nostrpass.com/og-image.png"],
    ["r", "https://nostrpass.com"],
    ["r", "https://github.com/nostrpass/nostrpass"]
  ]
}
```

Publish on clients like:
- [Habla News](https://habla.news) - Long-form Nostr publishing
- [Yakihonne](https://yakihonne.com) - Article platform
- [Highlighter](https://highlighter.com) - Content publishing

The article will appear on any Nostr client that displays kind 30023 events, giving you censorship-resistant publishing with built-in distribution.
