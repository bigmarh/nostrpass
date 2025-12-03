import './index.css'
import { useState, useEffect } from 'react'
import { nip19 } from 'nostr-tools'

declare global {
  interface Window {
    nostr?: {
      getPublicKey(): Promise<string>;
      signEvent(event: any): Promise<any>;
      createNostrPassButton?: (config?: any) => any;
    };
    initNostrPass?: (config?: any) => any;
  }
}

function App() {
  const [showCode, setShowCode] = useState(false)
  const [showDemo, setShowDemo] = useState(false)
  const [pubkey, setPubkey] = useState<string | null>(null)
  const [reactions, setReactions] = useState<Array<{id: string, content: string, pubkey: string, created_at: number}>>([])
  const [nostrPassReady, setNostrPassReady] = useState(false)

  // Debug: Log pubkey changes
  useEffect(() => {
    console.log('[Demo] Pubkey state changed to:', pubkey)
  }, [pubkey])

  useEffect(() => {
    // Load NostrPass embassy script when demo panel is opened
    if (showDemo && !nostrPassReady) {
      const script = document.createElement('script')
      script.src = 'https://cdn.nostrpass.com/embassy.js'
      script.async = true
      script.setAttribute('data-manual-init', 'true') // Disable auto-init, we'll manually initialize
      script.onload = () => {
        // Force NostrPass to override any browser extension
        if (window.initNostrPass) {
          window.nostr = window.initNostrPass({
            appName: 'NostrPass Demo',
            storageEnvironment: 'demo',
            theme: 'light'
          })
          console.log('✅ NostrPass initialized and overriding browser extension')
          setNostrPassReady(true)

          // Add NostrPass button to DOM after a short delay to ensure container exists
          setTimeout(() => {
            if (window.nostr?.createNostrPassButton) {
              const buttonContainer = document.getElementById('nostrpass-button-container')
              console.log('Button container found:', buttonContainer)
              if (buttonContainer) {
                try {
                  const buttonInstance = window.nostr.createNostrPassButton({
                    style: 'icon-only',
                    expandOnHover: true,
                    theme: 'light',
                    onLogin: (user: any) => {
                      console.log('[Demo] User logged in:', user)
                      console.log('[Demo] Setting pubkey to:', user.publicKey)
                      setPubkey(user.publicKey)
                      console.log('[Demo] Pubkey state after set:', user.publicKey)
                    },
                    onLogout: () => {
                      console.log('User logged out')
                      setPubkey(null)
                      setReactions([])
                    }
                  })
                  // NostrPassButton has a getElement() method to get the DOM node
                  const buttonElement = (buttonInstance as any).getElement()
                  buttonContainer.innerHTML = ''
                  buttonContainer.appendChild(buttonElement)
                  console.log('NostrPass button added to DOM')

                  // Check if user is already logged in (session restored)
                  setTimeout(() => {
                    console.log('[Demo] Checking for existing session...')
                    const user = (buttonInstance as any).getUser()
                    console.log('[Demo] getUser returned:', user)
                    if (user?.publicKey) {
                      console.log('[Demo] Session restored, setting pubkey:', user.publicKey)
                      setPubkey(user.publicKey)
                    } else {
                      console.log('[Demo] No user session found')
                    }
                  }, 500)
                } catch (error) {
                  console.error('Failed to create NostrPass button:', error)
                }
              } else {
                console.error('Button container not found')
              }
            } else {
              console.error('createNostrPassButton not available')
            }
          }, 100)
        }
      }
      document.head.appendChild(script)
    }
  }, [showDemo, nostrPassReady])

  const handleReaction = async (content: string) => {
    if (!pubkey) {
      alert('Please login first!')
      return
    }

    try {
      if (!window.nostr) {
        alert('NostrPass is not loaded')
        return
      }

      const event = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['t', 'nostrpass-demo']],
        content: content,
      }

      const signedEvent = await window.nostr.signEvent(event)

      // Add to local reactions immediately (use pubkey from signed event)
      setReactions(prev => [{
        id: signedEvent.id,
        content: content,
        pubkey: signedEvent.pubkey,
        created_at: signedEvent.created_at
      }, ...prev])

      // Publish to relays
      console.log('Signed event:', signedEvent)
      const relays = [
        'wss://relay.damus.io',
        'wss://nos.lol',
        'wss://relay.primal.net',
        'wss://relay.nostr.band'
      ]

      relays.forEach(relayUrl => {
        try {
          const ws = new WebSocket(relayUrl)
          ws.onopen = () => {
            ws.send(JSON.stringify(['EVENT', signedEvent]))
            console.log(`Published to ${relayUrl}`)
            setTimeout(() => ws.close(), 1000)
          }
          ws.onerror = (err) => {
            console.error(`Failed to publish to ${relayUrl}:`, err)
          }
        } catch (err) {
          console.error(`Error connecting to ${relayUrl}:`, err)
        }
      })
    } catch (error) {
      console.error('Failed to sign reaction:', error)
      alert('Failed to sign reaction. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="min-h-screen flex pt-20 md:pt-0 md:items-center justify-center px-6">
        <div className="text-center flex md:flex-row flex-col m-w-4xl mx-auto">
          <div className="flex justify-center md:justify-end">
            <img src="/logo.svg" alt="NostrPass" className="w-[220px] md:w-[320px]" />
          </div>
          <div className="flex flex-col justify-center">
            <h2 className="text-gray-800 md:text-6xl font-bold text-4xl mb-2 tracking-tight">NostrPass</h2>
            <h3 className=" md:text-xl text-gray-600 mb-6 tracking-tight">
              Have App, Will Travel</h3>
            <h1 className=" text-[1.85rem] leading-[1.85rem] md:text-5xl font-bold mb-6 tracking-tight">
              Authentication for the
              <br />modern decentralized web
            </h1>

            <p className="text-center text-sm md:text-xl text-gray-600 leading-relaxed mb-8">
              Drop-in authentication for Nostr apps.<br/>
              Add secure, privacy-first auth to your application
              in minutes, not days.
            </p>

            <div className="flex gap-4 justify-center w-full">
              <button
                onClick={() => setShowCode(true)}
                className="flex-1 px-6 py-3 bg-white text-black border-2 border-black rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                <span>&lt;&lt;</span>
                <span>Code</span>
              </button>
              <button
                onClick={() => setShowDemo(true)}
                className="flex-1 px-6 py-3 bg-white text-black border-2 border-black rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                <span>Demo</span>
                <span>&gt;&gt;</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <footer className="flex text-xs fixed w-full bottom-0 justify-center items-center">
          <p className="text-gray-500 mr-2">NostrPass</p>
          <p className="text-gray-500">© 2025 NostrPass. All rights reserved.</p>
      </footer>

      {/* Code Panel - Slides from left */}
      <div
        className={`fixed inset-0 bg-white z-50 transform transition-transform duration-500 ease-in-out ${
          showCode ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full overflow-y-auto">
          <div className="max-w-4xl mx-auto p-8">
            <button
              onClick={() => setShowCode(false)}
              className="mb-8 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
            >
              &lt;&lt; Back
            </button>

            <h2 className="text-2xl font-bold mb-8">Quick Start</h2>

            <div className="mb-8">
              <h3 className="text-xl font-semibold mb-4">Add NostrPass to your website in 2 lines</h3>
              <p className="text-gray-600 mb-6">
                Drop in a ready-made login button that handles everything for you.
              </p>
            </div>

            <div className="bg-gray-900 text-white p-6 rounded-lg mb-6 overflow-x-auto">
              <pre className="text-[0.65rem] md:text-[0.77rem]">
                <code>{`<!-- Add this script and button to your HTML -->
<script src="https://cdn.nostrpass.com/embassy.js"></script>
<button onclick="window.nostr.getPublicKey().then(pk => console.log('Logged in:', pk))">
  Login with NostrPass
</button>`}</code>
              </pre>
            </div>

            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-8">
              <p className="text-sm text-blue-900">
                <strong>That's it!</strong> NostrPass handles all the complexity of key management,
                encryption, and user authentication. Your users get a secure, privacy-first login
                experience without passwords.
              </p>
            </div>

            <div className="mb-8">
              <h3 className="text-2xl font-semibold mb-4">Full Example</h3>
              <p className="text-gray-600 mb-6">
                For more control, use the programmatic API:
              </p>
            </div>

            <div className="bg-gray-900 text-white p-6 rounded-lg mb-6 overflow-x-auto">
              <pre className="text-[0.65rem] md:text-[0.77rem]">
                <code>{`<!-- Add this script to your HTML -->
<script src="https://cdn.nostrpass.com/embassy.js"></script>

<script>
  // Initialize NostrPass
  const nostr = window.nostr;

  // Request user's public key
  async function login() {
    try {
      const pubkey = await nostr.getPublicKey();
      console.log('User public key:', pubkey);

      // You're authenticated!
      // Now you can sign events, encrypt messages, etc.
    } catch (error) {
      console.error('Authentication failed:', error);
    }
  }

  // Call login when user clicks your login button
  login();
</script>`}</code>
              </pre>
            </div>

            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-8">
              <p className="text-sm text-blue-900">
                <strong>Full control.</strong> The programmatic API gives you complete flexibility to build
                custom authentication flows, handle errors your way, and integrate NostrPass seamlessly into
                your application's user experience.
              </p>
            </div>

            <div className="mb-8">
              <h3 className="text-2xl font-semibold mb-4">Configuration</h3>
              <p className="text-gray-600 mb-6">
                Customize NostrPass behavior by initializing with configuration options:
              </p>

              <div className="mb-6">
                <h4 className="text-lg font-semibold mb-3">Configuration Options</h4>
                <div className="space-y-3">
                  <div className="border-l-4 border-blue-500 pl-4 py-2">
                    <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">appName</code>
                    <span className="text-sm text-gray-500 ml-2">(string, optional)</span>
                    <p className="text-sm text-gray-600 mt-1">Your application name, shown in permission prompts. Defaults to document.title</p>
                  </div>
                  <div className="border-l-4 border-blue-500 pl-4 py-2">
                    <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">appDomain</code>
                    <span className="text-sm text-gray-500 ml-2">(string, optional)</span>
                    <p className="text-sm text-gray-600 mt-1">Your application domain. Defaults to window.location.host</p>
                  </div>
                  <div className="border-l-4 border-blue-500 pl-4 py-2">
                    <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">vaultUrl</code>
                    <span className="text-sm text-gray-500 ml-2">(string, optional)</span>
                    <p className="text-sm text-gray-600 mt-1">Custom vault URL. Defaults to https://vault.nostrpass.com</p>
                  </div>
                  <div className="border-l-4 border-blue-500 pl-4 py-2">
                    <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">environment</code>
                    <span className="text-sm text-gray-500 ml-2">(string, optional)</span>
                    <p className="text-sm text-gray-600 mt-1">Environment namespace for vault data isolation. Common values: 'production', 'development', 'staging', 'test'. Auto-detected based on vaultUrl if not specified.</p>
                  </div>
                  <div className="border-l-4 border-blue-500 pl-4 py-2">
                    <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">namespace</code>
                    <span className="text-sm text-gray-500 ml-2">(string, optional)</span>
                    <p className="text-sm text-gray-600 mt-1">Custom namespace for vault data storage (defaults to 'nostrpass.com'). Use this for self-hosted deployments to isolate your data from the public NostrPass instance.</p>
                  </div>
                  <div className="border-l-4 border-blue-500 pl-4 py-2">
                    <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">permissions</code>
                    <span className="text-sm text-gray-500 ml-2">(object, optional)</span>
                    <p className="text-sm text-gray-600 mt-1">Default permission settings for each operation type. Each permission can be set to:</p>
                    <ul className="text-sm text-gray-600 ml-4 mt-2 list-disc">
                      <li><code className="bg-gray-100 px-1 rounded">ALLOW</code> - Always allow without asking</li>
                      <li><code className="bg-gray-100 px-1 rounded">ASK_EVERYTIME</code> - Prompt user for each request</li>
                      <li><code className="bg-gray-100 px-1 rounded">DENY</code> - Always deny</li>
                    </ul>
                    <div className="mt-3 p-3 bg-gray-50 rounded">
                      <p className="text-sm font-semibold text-gray-700 mb-2">Available permission keys (defaults shown):</p>
                      <div className="text-xs font-mono space-y-1">
                        <div><code className="bg-white px-2 py-1 rounded">getPublicKey: 'ALLOW'</code></div>
                        <div><code className="bg-white px-2 py-1 rounded">getRelays: 'ALLOW'</code></div>
                        <div><code className="bg-white px-2 py-1 rounded">signEvent: 'ASK_EVERYTIME'</code></div>
                        <div><code className="bg-white px-2 py-1 rounded">signData: 'ASK_EVERYTIME'</code></div>
                        <div><code className="bg-white px-2 py-1 rounded">nip04: 'ASK_EVERYTIME'</code></div>
                        <div><code className="bg-white px-2 py-1 rounded">nip44: 'ASK_EVERYTIME'</code></div>
                      </div>
                    </div>
                  </div>
                  <div className="border-l-4 border-blue-500 pl-4 py-2">
                    <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">trustedOrigins</code>
                    <span className="text-sm text-gray-500 ml-2">(string[], optional)</span>
                    <p className="text-sm text-gray-600 mt-1">Additional trusted vault origins for custom deployments</p>
                  </div>
                  <div className="border-l-4 border-blue-500 pl-4 py-2">
                    <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">theme</code>
                    <span className="text-sm text-gray-500 ml-2">("light" | "dark" | "auto", optional)</span>
                    <p className="text-sm text-gray-600 mt-1">UI theme preference. Defaults to "auto"</p>
                  </div>
                  <div className="border-l-4 border-blue-500 pl-4 py-2">
                    <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">debug</code>
                    <span className="text-sm text-gray-500 ml-2">(boolean, optional)</span>
                    <p className="text-sm text-gray-600 mt-1">Enable debug logging. Defaults to false</p>
                  </div>
                  <div className="border-l-4 border-blue-500 pl-4 py-2">
                    <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">parentPinOverlay</code>
                    <span className="text-sm text-gray-500 ml-2">(boolean, optional)</span>
                    <p className="text-sm text-gray-600 mt-1">Show PIN overlay in parent window instead of iframe. Defaults to false</p>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="text-lg font-semibold mb-3">Example Configuration</h4>
                <div className="bg-gray-900 text-white p-6 rounded-lg overflow-x-auto">
                  <pre className="text-[0.65rem] md:text-[0.77rem]">
                    <code>{`<script>
  // Initialize NostrPass with custom configuration
  window.nostr = window.initNostrPass({
    // App identification (shown in permission prompts)
    appName: 'My Awesome App',
    appDomain: 'myapp.com',

    // Vault URL - set based on your environment
    vaultUrl: process.env.NODE_ENV === 'development'
      ? 'http://localhost:3001'              // Local development
      : 'https://vault.nostrpass.com',       // Production

    // Environment namespace for data isolation (optional)
    // Auto-detected from vaultUrl if not specified
    environment: 'production',               // 'production' | 'development' | 'staging' | 'test'

    // Custom namespace for self-hosted deployments (optional)
    // Defaults to 'nostrpass.com' - change this to isolate your vault data
    // namespace: 'mycompany.com',

    // Default permissions for operations
    permissions: {
      getPublicKey: 'ALLOW',        // 'ALLOW' | 'ASK_EVERYTIME' | 'DENY'
      getRelays: 'ALLOW',           // 'ALLOW' | 'ASK_EVERYTIME' | 'DENY'
      signEvent: 'ASK_EVERYTIME',   // 'ALLOW' | 'ASK_EVERYTIME' | 'DENY'
      signData: 'ASK_EVERYTIME',    // 'ALLOW' | 'ASK_EVERYTIME' | 'DENY'
      nip04: 'ASK_EVERYTIME',       // 'ALLOW' | 'ASK_EVERYTIME' | 'DENY'
      nip44: 'ASK_EVERYTIME'        // 'ALLOW' | 'ASK_EVERYTIME' | 'DENY'
    },

    // Trusted vault origins (optional)
    trustedOrigins: ['https://nostrpass.com'],

    // UI theme (optional)
    theme: 'auto',                  // 'light' | 'dark' | 'auto'

    // Debug mode (optional)
    debug: false,

    // Show PIN overlay in parent window instead of iframe (optional)
    parentPinOverlay: false
  });
</script>`}</code>
                  </pre>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-2xl font-semibold mb-4">API Methods</h3>
              <div className="space-y-4">
                <div className="border-l-4 border-gray-300 pl-4">
                  <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">nostr.getPublicKey()</code>
                  <p className="text-sm text-gray-600 mt-2">Get the user's public key (hex format)</p>
                </div>
                <div className="border-l-4 border-gray-300 pl-4">
                  <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">nostr.signEvent(event)</code>
                  <p className="text-sm text-gray-600 mt-2">Sign a Nostr event (NIP-01)</p>
                </div>
                <div className="border-l-4 border-gray-300 pl-4">
                  <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">nostr.signData(data)</code>
                  <p className="text-sm text-gray-600 mt-2">Sign arbitrary data (returns signature)</p>
                </div>
                <div className="border-l-4 border-gray-300 pl-4">
                  <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">nostr.getRelays()</code>
                  <p className="text-sm text-gray-600 mt-2">Get user's relay list</p>
                </div>
                <div className="border-l-4 border-gray-300 pl-4">
                  <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">nostr.nip04.encrypt(pubkey, plaintext)</code>
                  <p className="text-sm text-gray-600 mt-2">Encrypt a direct message</p>
                </div>
                <div className="border-l-4 border-gray-300 pl-4">
                  <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">nostr.nip04.decrypt(pubkey, ciphertext)</code>
                  <p className="text-sm text-gray-600 mt-2">Decrypt a direct message</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Demo Panel - Slides from right */}
      <div
        className={`fixed inset-0 bg-white z-50 transform transition-transform duration-500 ease-in-out ${
          showDemo ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
    
        <div className="h-full overflow-y-auto">
          <div className="max-w-4xl mx-auto p-8">
            <div className="flex justify-end">
          <button
          onClick={() => setShowDemo(false)}
          className="mb-8 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
          >
          Back &gt;&gt;
        </button></div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Try NostrPass</h2>
              <div id="nostrpass-button-container"></div>
            </div>
            <p className="text-gray-600 mb-4">
              Login and share a reaction to see NostrPass in action. Your reaction will be signed with your Nostr identity and published to relays.
            </p>

            {/* Demo Credentials */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-8">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">Try it with test credentials:</h3>
              <div className="text-sm text-blue-800 space-y-1">
                <p><span className="font-medium">Username:</span> qwerty</p>
                <p><span className="font-medium">Password:</span> 12345678</p>
                <p><span className="font-medium">PIN:</span> 111111</p>
              </div>
              <p className="text-xs text-blue-700 mt-2">Click the NostrPass button above to login, then try posting a reaction!</p>
            </div>

            {/* Side by side layout for reactions and actions */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {/* Left column - Quick Actions */}
              <div className="space-y-6">
                {/* Emoji Reactions */}
                <div>
                  <h3 className="text-xl font-semibold mb-3">Quick Reactions</h3>
                  <p className="text-gray-600 mb-4 text-sm">Choose an emoji to share your vibe</p>
                  <div className="grid grid-cols-4 gap-2">
                    {['🚀', '⚡', '🔥', '💜', '👍', '🤙', '✨', '🎉', '💯', '🌟', '❤️', '🙌', '👏', '🫂', '🌈', '☕'].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleReaction(emoji)}
                        disabled={!pubkey}
                        className={`aspect-square text-2xl bg-white border-2 border-gray-300 rounded-lg hover:border-black hover:scale-110 transition-all ${!pubkey ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pre-made Statements */}
                <div>
                  <h3 className="text-xl font-semibold mb-3">Share Your Thoughts</h3>
                  <p className="text-gray-600 mb-4 text-sm">Pick a statement to sign and publish</p>
                  <div className="grid gap-2">
                    {[
                      '🚀 Nostr is the future!',
                      '⚡ Lightning fast authentication',
                      '🔐 Privacy-first is the way',
                      '💜 Love this technology',
                      '✨ This is amazing!',
                      '🎯 Perfect developer experience',
                      '🌟 Built different',
                      '🔥 Absolutely fire'
                    ].map((statement) => (
                      <button
                        key={statement}
                        onClick={() => handleReaction(statement)}
                        disabled={!pubkey}
                        className={`px-4 py-2 text-sm bg-white text-left border-2 border-gray-300 rounded-lg hover:border-black hover:bg-gray-50 transition-colors ${!pubkey ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {statement}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right column - Live Reactions */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Live Reactions</h3>
                <p className="text-gray-600 mb-3 text-sm">See what's being published to Nostr</p>
                <div className="h-[calc(100%-4rem)] overflow-y-auto border-2 border-gray-300 rounded-lg p-3 bg-gray-50">
                  {reactions.length === 0 ? (
                    <p className="text-gray-400 text-center">No reactions yet. Be the first!</p>
                  ) : (
                    <div className="space-y-2">
                      {reactions.map((reaction) => (
                        <div
                          key={reaction.id}
                          className="bg-white border border-gray-200 rounded-lg p-3"
                        >
                          <div className="flex items-start justify-between mb-1">
                            <p className="text-base flex-1">{reaction.content}</p>
                            <div className="flex flex-col items-end gap-1 ml-3">
                              <span className="text-xs text-gray-400 whitespace-nowrap">
                                {new Date(reaction.created_at * 1000).toLocaleTimeString()}
                              </span>
                              <div className="flex gap-1">
                                <a
                                  href={`https://njump.me/${reaction.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2 py-0.5 text-xs bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 transition-colors whitespace-nowrap"
                                >
                                  View Note
                                </a>
                                <a
                                  href={`https://njump.me/${nip19.npubEncode(reaction.pubkey)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2 py-0.5 text-xs bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 transition-colors whitespace-nowrap"
                                >
                                  View Author
                                </a>
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500">
                            by {nip19.npubEncode(reaction.pubkey).substring(0, 12)}...
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App