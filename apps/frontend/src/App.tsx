import './index.css'
import { useState, useEffect, useRef, useCallback } from 'react'
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
  const [showLiteCode, setShowLiteCode] = useState(false)
  const [showLiteDemo, setShowLiteDemo] = useState(false)
  const [pubkey, setPubkey] = useState<string | null>(null)
  const [reactions, setReactions] = useState<Array<{id: string, content: string, pubkey: string, created_at: number}>>([])
  const [nostrPassReady, setNostrPassReady] = useState(false)

  // Lite demo state — iframe RPC bridge
  const LITE_VAULT_URL = 'https://cdn.nostrpass.com/lite-vault/index.html'
  const LITE_VAULT_ORIGIN = 'https://cdn.nostrpass.com'
  const RPC_CHANNEL = 'nostrpass-lite-rpc-v1'

  type LiteAuth = { initialized: boolean; isAuthenticated: boolean; isLocked: boolean; identifier?: string; publicKey?: string }
  const [liteFrameReady, setLiteFrameReady] = useState(false)
  const [liteAuth, setLiteAuth] = useState<LiteAuth | null>(null)
  const [liteShowVault, setLiteShowVault] = useState(false)
  const [liteEvents, setLiteEvents] = useState<Array<{id: string, content: string, pubkey: string, created_at: number}>>([])
  const [liteSignError, setLiteSignError] = useState('')
  const vaultFrameRef = useRef<HTMLIFrameElement>(null)
  const pendingRpcRef = useRef<Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void; timeout: ReturnType<typeof setTimeout> }>>(new Map())
  const rpcCounterRef = useRef(0)

  // Debug: Log pubkey changes
  useEffect(() => {
    console.log('[Demo] Pubkey state changed to:', pubkey)
  }, [pubkey])

  useEffect(() => {
    // Load NostrPass embassy script when demo panel is opened
    if (showDemo && !nostrPassReady) {
      const script = document.createElement('script')
      // Use local embassy in development, CDN in production
      const isDevelopment = window.location.hostname === 'localhost' ||
                            window.location.hostname === '127.0.0.1' ||
                            window.location.hostname === '192.168.1.220'
      script.src = isDevelopment
        ? `https://${window.location.hostname}:3002/embassy.iife.js`  // Local embassy IIFE build (HTTPS)
        : 'https://cdn.nostrpass.com/embassy.js'
      script.async = true
      script.setAttribute('data-manual-init', 'true') // Disable auto-init, we'll manually initialize
      script.onload = () => {
        // Force NostrPass to override any browser extension
        if (window.initNostrPass) {
          window.nostr = window.initNostrPass({
            appName: 'NostrPass Demo',
            storageEnvironment: 'demo',
            theme: 'light',
            // Use local vault in development (with HTTPS)
            vaultUrl: isDevelopment ? `https://${window.location.hostname}:3001` : undefined
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
                    signInText: 'Sign into Demo App',
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

  // Lite vault iframe message bridge
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== LITE_VAULT_ORIGIN) return
      const data = event.data as { channel?: string; type?: string; id?: string; ok?: boolean; result?: unknown; error?: string; event?: string; auth?: LiteAuth }
      if (!data || data.channel !== RPC_CHANNEL) return

      if (data.type === 'response' && data.id) {
        const pending = pendingRpcRef.current.get(data.id)
        if (pending) {
          pendingRpcRef.current.delete(data.id)
          clearTimeout(pending.timeout)
          if (data.ok) pending.resolve(data.result)
          else pending.reject(new Error(data.error ?? 'RPC error'))
        }
      } else if (data.type === 'event') {
        if (data.event === 'READY' || data.event === 'AUTH_STATE') {
          setLiteFrameReady(true)
          if (data.auth) {
            setLiteAuth(data.auth)
            if (data.auth.isAuthenticated && !data.auth.isLocked) {
              setLiteShowVault(false)
            }
          }
        } else if (data.event === 'NEEDS_INTERACTION') {
          if (data.auth) setLiteAuth(data.auth)
          setLiteShowVault(true)
        } else if (data.event === 'CLOSE') {
          setLiteShowVault(false)
        }
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const sendRpc = useCallback((method: string, params?: Record<string, unknown>): Promise<unknown> => {
    const frame = vaultFrameRef.current
    if (!frame?.contentWindow) return Promise.reject(new Error('Vault frame not ready'))
    const id = `rpc-${Date.now()}-${++rpcCounterRef.current}`
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pendingRpcRef.current.delete(id)
        reject(new Error(`RPC timeout: ${method}`))
      }, 15000)
      pendingRpcRef.current.set(id, { resolve, reject, timeout })
      frame.contentWindow!.postMessage({ channel: RPC_CHANNEL, type: 'request', id, method, params }, LITE_VAULT_ORIGIN)
    })
  }, [])

  const handleLiteLogout = useCallback(async () => {
    await sendRpc('LOGOUT')
    setLiteAuth(null)
    setLiteEvents([])
  }, [sendRpc])

  const handleLiteSign = useCallback(async (content: string) => {
    setLiteSignError('')
    try {
      const event = { kind: 1, created_at: Math.floor(Date.now() / 1000), tags: [['t', 'nostrpass-lite-demo']], content }
      const signed = await sendRpc('SIGN_EVENT', { event }) as { id: string; pubkey: string; created_at: number }
      setLiteEvents(prev => [{ id: signed.id, content, pubkey: signed.pubkey, created_at: signed.created_at }, ...prev])
    } catch (err: any) {
      setLiteSignError(err?.message ?? 'Signing failed')
    }
  }, [sendRpc])

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
    <div className="bg-white text-gray-900">
      {/* Hero Section - Not full height */}
      <div className="py-16 md:py-24 px-6">
        <div className="text-center flex md:flex-row flex-col max-w-4xl mx-auto">
          <div className="flex justify-center md:justify-end">
            <img src="/logo.svg" alt="NostrPass" className="w-[180px] md:w-[280px]" />
          </div>
          <div className="flex flex-col justify-center">
            <h2 className="text-gray-800 md:text-5xl font-bold text-3xl mb-2 tracking-tight">NostrPass</h2>
            <h3 className="md:text-lg text-gray-600 mb-4 tracking-tight">
              Built by developers, for developers</h3>
            <h1 className="text-2xl leading-tight md:text-4xl font-bold mb-4 tracking-tight">
              Authentication for the
              <br />modern decentralized web
            </h1>

            <p className="text-center text-sm md:text-lg text-gray-600 leading-relaxed mb-6">
              Drop-in authentication for Decentralized applications.<br/>
              Sign in with Google or create a username — your keys, your identity,
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

      {/* Two Products — Full & Lite */}
      <div className="border-t border-gray-100 bg-white py-10 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-sm text-gray-500 font-medium uppercase tracking-widest mb-8">Choose your integration</p>
          <div className="grid md:grid-cols-2 gap-5">
            {/* NostrPass Full */}
            <div className="rounded-2xl border-2 border-gray-200 p-6 hover:border-black hover:shadow-lg transition-all group flex flex-col">
              <div className="flex items-center gap-3 mb-3">
                <img src="/logo.svg" alt="NostrPass" className="w-8 h-8" />
                <div>
                  <h3 className="font-bold text-lg leading-tight">NostrPass</h3>
                  <span className="text-xs text-gray-500">Full — Cloud-synced vault</span>
                </div>
              </div>
              <p className="text-gray-600 text-sm flex-1 mb-4">
                Managed auth with Google Sign-In, cross-device sync, and a polished embedded vault UI. Best for apps that want a complete auth experience out of the box.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCode(true)}
                  className="flex-1 px-4 py-2 text-sm bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
                >
                  Docs
                </button>
                <button
                  onClick={() => setShowDemo(true)}
                  className="flex-1 px-4 py-2 text-sm border-2 border-gray-200 text-gray-700 rounded-lg hover:border-black transition-colors font-medium"
                >
                  Try Demo
                </button>
              </div>
            </div>

            {/* NostrPass Lite */}
            <div className="rounded-2xl border-2 border-green-200 bg-gradient-to-br from-gray-900 to-gray-800 p-6 hover:border-green-400 hover:shadow-lg transition-all group flex flex-col">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-green-900 border border-green-700 rounded-lg flex items-center justify-center">
                  <span className="text-green-400 text-sm font-bold">L</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg leading-tight text-white">NostrPass Lite</h3>
                    <span className="text-xs bg-green-900 text-green-400 border border-green-700 px-2 py-0.5 rounded-full">New</span>
                  </div>
                  <span className="text-xs text-gray-400">Lightweight — Keys in your browser</span>
                </div>
              </div>
              <p className="text-gray-400 text-sm flex-1 mb-4">
                No cloud. No backend. Keys live in an origin-isolated iframe on <code className="text-green-300 text-xs">cdn.nostrpass.com</code> — inaccessible to your page's JS. Syncs via Nostr relays. One script tag.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLiteCode(true)}
                  className="flex-1 px-4 py-2 text-sm bg-gray-700 text-white border border-gray-600 rounded-lg hover:bg-gray-600 transition-colors font-medium"
                >
                  Docs
                </button>
                <button
                  onClick={() => {
                    document.getElementById('nostrpass-lite')?.scrollIntoView({ behavior: 'smooth' })
                    setTimeout(() => setShowLiteDemo(true), 600)
                  }}
                  className="flex-1 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors font-medium"
                >
                  Try Lite Demo
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Cards Section - Passport Theme */}
      <div className="bg-gray-50 py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 tracking-tight">Your Identity, Everywhere</h2>
          <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            Like a passport for the decentralized web. One identity that works across every app, every device, every corner of the Nostr universe.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card 1 - Google Login */}
            <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden hover:border-gray-400 hover:shadow-lg transition-all group md:col-span-2 lg:col-span-3">
              <div className="h-48 bg-white relative overflow-hidden flex items-center justify-center">
                {/* Clean Google-style background */}
                <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-white"></div>

                {/* Google G Logo Recreation */}
                <div className="relative flex items-center gap-8">
                  <svg viewBox="0 0 48 48" className="w-16 h-16 md:w-20 md:h-20 drop-shadow-lg group-hover:scale-105 transition-transform">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>

                  {/* Arrow pointing to Nostr */}
                  <div className="flex items-center gap-4">
                    <svg className="w-8 h-8 md:w-12 md:h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    <div className="w-16 h-16 md:w-20 md:h-20 group-hover:scale-105 transition-transform">
                      <img src="/logo.svg" alt="NostrPass" className="w-full h-full drop-shadow-lg" />
                    </div>
                  </div>
                </div>

                {/* Stat badge */}
                <div className="absolute top-3 right-3 bg-black text-white text-xs font-bold px-3 py-1.5 rounded-full">
                  2B+ Google users
                </div>
              </div>
              <div className="p-5 bg-gradient-to-r from-blue-50 via-red-50 via-yellow-50 to-green-50">
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <h3 className="font-bold text-xl mb-2">Sign In with Google</h3>
                    <p className="text-gray-700 text-sm leading-relaxed">
                      <span className="font-semibold">2 billion people</span> already have a Google account. Now they're one click away from joining Nostr.
                      Familiar onboarding meets decentralized identity — no seed phrases to memorize, no friction to adoption.
                      Link Google to an existing vault or let new users get started instantly.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2 - Multi-Identity (Tokyo) */}
            <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden hover:border-gray-400 hover:shadow-lg transition-all group">
              <div className="h-40 bg-gradient-to-br from-rose-100 to-orange-50 relative overflow-hidden">
                {/* Tokyo Scene */}
                <svg viewBox="0 0 400 160" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
                  {/* Sky gradient */}
                  <defs>
                    <linearGradient id="tokyoSky" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#fce7f3" />
                      <stop offset="100%" stopColor="#fed7aa" />
                    </linearGradient>
                  </defs>
                  <rect width="400" height="160" fill="url(#tokyoSky)" />

                  {/* Mount Fuji */}
                  <polygon points="320,160 400,160 400,80 360,40 320,80" fill="#6366f1" opacity="0.3" />
                  <polygon points="340,60 360,40 380,60" fill="#fff" opacity="0.8" />

                  {/* Tokyo Tower */}
                  <polygon points="80,160 95,50 110,160" fill="#dc2626" />
                  <rect x="85" y="70" width="20" height="5" fill="#fff" />
                  <rect x="87" y="90" width="16" height="4" fill="#fff" />
                  <rect x="89" y="110" width="12" height="3" fill="#fff" />

                  {/* City buildings */}
                  <rect x="130" y="100" width="30" height="60" fill="#374151" />
                  <rect x="165" y="80" width="25" height="80" fill="#4b5563" />
                  <rect x="195" y="110" width="35" height="50" fill="#374151" />
                  <rect x="235" y="90" width="28" height="70" fill="#4b5563" />
                  <rect x="268" y="105" width="32" height="55" fill="#374151" />

                  {/* Cherry blossoms */}
                  <circle cx="40" cy="120" r="25" fill="#fda4af" opacity="0.8" />
                  <circle cx="55" cy="105" r="20" fill="#fb7185" opacity="0.7" />
                  <circle cx="25" cy="110" r="18" fill="#fda4af" opacity="0.6" />
                  <rect x="38" y="120" width="4" height="40" fill="#78350f" />
                </svg>

                {/* NostrPass Logo Stamp */}
                <div className="absolute bottom-2 right-2 w-14 h-14 group-hover:scale-110 transition-transform drop-shadow-lg">
                  <img src="/logo.svg" alt="NostrPass" className="w-full h-full" />
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-bold text-lg mb-2">Multiple Identities</h3>
                <p className="text-gray-600 text-sm">Create unlimited personas from one seed. Personal, work, anonymous — switch instantly, recover everything with a single phrase.</p>
              </div>
            </div>

            {/* Card 2 - No Servers (Paris) */}
            <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden hover:border-gray-400 hover:shadow-lg transition-all group">
              <div className="h-40 bg-gradient-to-br from-blue-100 to-indigo-50 relative overflow-hidden">
                {/* Paris Scene */}
                <svg viewBox="0 0 400 160" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
                  <defs>
                    <linearGradient id="parisSky" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#dbeafe" />
                      <stop offset="100%" stopColor="#e0e7ff" />
                    </linearGradient>
                  </defs>
                  <rect width="400" height="160" fill="url(#parisSky)" />

                  {/* Eiffel Tower */}
                  <polygon points="200,160 185,160 195,80 200,10 205,80 215,160" fill="#374151" />
                  <polygon points="180,160 175,130 195,100 200,80 205,100 225,130 220,160" fill="#4b5563" />
                  <rect x="190" y="50" width="20" height="8" fill="#374151" />
                  <rect x="185" y="80" width="30" height="6" fill="#374151" />
                  <rect x="175" y="115" width="50" height="8" fill="#374151" />

                  {/* Parisian buildings */}
                  <rect x="30" y="100" width="50" height="60" fill="#e5e7eb" />
                  <rect x="35" y="105" width="10" height="15" fill="#93c5fd" />
                  <rect x="50" y="105" width="10" height="15" fill="#93c5fd" />
                  <rect x="65" y="105" width="10" height="15" fill="#93c5fd" />
                  <polygon points="30,100 55,75 80,100" fill="#374151" />

                  <rect x="300" y="90" width="60" height="70" fill="#e5e7eb" />
                  <rect x="310" y="100" width="12" height="18" fill="#93c5fd" />
                  <rect x="330" y="100" width="12" height="18" fill="#93c5fd" />
                  <polygon points="300,90 330,60 360,90" fill="#374151" />

                  {/* Clouds */}
                  <ellipse cx="100" cy="40" rx="30" ry="15" fill="#fff" opacity="0.8" />
                  <ellipse cx="320" cy="35" rx="25" ry="12" fill="#fff" opacity="0.7" />
                </svg>

                {/* NostrPass Logo Stamp */}
                <div className="absolute bottom-2 right-2 w-14 h-14 group-hover:scale-110 transition-transform drop-shadow-lg">
                  <img src="/logo.svg" alt="NostrPass" className="w-full h-full" />
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-bold text-lg mb-2">No Servers Required</h3>
                <p className="text-gray-600 text-sm">Your encrypted vault syncs through Nostr relays. No company holds your keys. No central point of failure. True decentralization.</p>
              </div>
            </div>

            {/* Card 3 - True Ownership (New York) */}
            <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden hover:border-gray-400 hover:shadow-lg transition-all group">
              <div className="h-40 bg-gradient-to-br from-amber-100 to-yellow-50 relative overflow-hidden">
                {/* New York Scene */}
                <svg viewBox="0 0 400 160" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
                  <defs>
                    <linearGradient id="nySky" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#fef3c7" />
                      <stop offset="100%" stopColor="#fef9c3" />
                    </linearGradient>
                  </defs>
                  <rect width="400" height="160" fill="url(#nySky)" />

                  {/* Statue of Liberty */}
                  <rect x="55" y="90" width="30" height="70" fill="#6b7280" />
                  <ellipse cx="70" cy="90" rx="20" ry="8" fill="#6b7280" />
                  <ellipse cx="70" cy="75" rx="12" ry="20" fill="#10b981" />
                  <circle cx="70" cy="60" r="8" fill="#10b981" />
                  <polygon points="62,52 70,35 78,52" fill="#10b981" />
                  <line x1="85" y1="55" x2="100" y2="40" stroke="#10b981" strokeWidth="4" />
                  <rect x="95" y="30" width="8" height="15" fill="#fbbf24" />

                  {/* NYC Skyline */}
                  <rect x="140" y="70" width="35" height="90" fill="#374151" />
                  <polygon points="140,70 157,40 175,70" fill="#4b5563" />
                  <rect x="180" y="50" width="40" height="110" fill="#4b5563" />
                  <rect x="225" y="80" width="30" height="80" fill="#374151" />
                  <rect x="260" y="60" width="45" height="100" fill="#4b5563" />
                  <rect x="310" y="85" width="35" height="75" fill="#374151" />
                  <rect x="350" y="70" width="50" height="90" fill="#4b5563" />

                  {/* Windows */}
                  <rect x="185" y="60" width="6" height="8" fill="#fbbf24" opacity="0.8" />
                  <rect x="195" y="60" width="6" height="8" fill="#fbbf24" opacity="0.6" />
                  <rect x="265" y="70" width="6" height="8" fill="#fbbf24" opacity="0.7" />
                </svg>

                {/* NostrPass Logo Stamp */}
                <div className="absolute bottom-2 right-2 w-14 h-14 group-hover:scale-110 transition-transform drop-shadow-lg">
                  <img src="/logo.svg" alt="NostrPass" className="w-full h-full" />
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-bold text-lg mb-2">True Key Ownership</h3>
                <p className="text-gray-600 text-sm">Private keys never leave your device. Defense-in-depth security with iframe isolation, web workers, and encrypted storage.</p>
              </div>
            </div>

            {/* Card 4 - Works Everywhere (Sydney) */}
            <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden hover:border-gray-400 hover:shadow-lg transition-all group">
              <div className="h-40 bg-gradient-to-br from-cyan-100 to-teal-50 relative overflow-hidden">
                {/* Sydney Scene */}
                <svg viewBox="0 0 400 160" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
                  <defs>
                    <linearGradient id="sydneySky" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#cffafe" />
                      <stop offset="100%" stopColor="#99f6e4" />
                    </linearGradient>
                  </defs>
                  <rect width="400" height="160" fill="url(#sydneySky)" />

                  {/* Water */}
                  <rect x="0" y="120" width="400" height="40" fill="#0891b2" opacity="0.4" />

                  {/* Sydney Opera House */}
                  <ellipse cx="120" cy="130" rx="80" ry="10" fill="#6b7280" />
                  <path d="M60,130 Q80,60 100,130" fill="#f5f5f5" stroke="#d1d5db" strokeWidth="1" />
                  <path d="M85,130 Q105,50 125,130" fill="#f5f5f5" stroke="#d1d5db" strokeWidth="1" />
                  <path d="M110,130 Q130,55 150,130" fill="#f5f5f5" stroke="#d1d5db" strokeWidth="1" />
                  <path d="M135,130 Q150,70 165,130" fill="#f5f5f5" stroke="#d1d5db" strokeWidth="1" />

                  {/* Harbour Bridge */}
                  <path d="M220,130 Q300,50 380,130" fill="none" stroke="#374151" strokeWidth="8" />
                  <line x1="230" y1="130" x2="250" y2="85" stroke="#374151" strokeWidth="2" />
                  <line x1="260" y1="130" x2="275" y2="65" stroke="#374151" strokeWidth="2" />
                  <line x1="290" y1="130" x2="300" y2="55" stroke="#374151" strokeWidth="2" />
                  <line x1="320" y1="130" x2="320" y2="55" stroke="#374151" strokeWidth="2" />
                  <line x1="350" y1="130" x2="340" y2="65" stroke="#374151" strokeWidth="2" />
                  <line x1="370" y1="130" x2="355" y2="85" stroke="#374151" strokeWidth="2" />

                  {/* Sun */}
                  <circle cx="350" cy="40" r="20" fill="#fbbf24" opacity="0.8" />
                </svg>

                {/* NostrPass Logo Stamp */}
                <div className="absolute bottom-2 right-2 w-14 h-14 group-hover:scale-110 transition-transform drop-shadow-lg">
                  <img src="/logo.svg" alt="NostrPass" className="w-full h-full" />
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-bold text-lg mb-2">Works Everywhere</h3>
                <p className="text-gray-600 text-sm">No browser extension needed. Works in any modern browser through a secure iframe. Access your vault on any device, anywhere.</p>
              </div>
            </div>

            {/* Card 5 - One-Line Integration (Cairo) */}
            <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden hover:border-gray-400 hover:shadow-lg transition-all group">
              <div className="h-40 bg-gradient-to-br from-orange-100 to-amber-50 relative overflow-hidden">
                {/* Cairo/Egypt Scene */}
                <svg viewBox="0 0 400 160" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
                  <defs>
                    <linearGradient id="egyptSky" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#ffedd5" />
                      <stop offset="100%" stopColor="#fef3c7" />
                    </linearGradient>
                  </defs>
                  <rect width="400" height="160" fill="url(#egyptSky)" />

                  {/* Desert sand */}
                  <rect x="0" y="130" width="400" height="30" fill="#d97706" opacity="0.3" />

                  {/* Pyramids */}
                  <polygon points="80,130 150,50 220,130" fill="#d97706" opacity="0.8" />
                  <polygon points="150,50 220,130 150,130" fill="#b45309" opacity="0.6" />

                  <polygon points="180,130 230,70 280,130" fill="#d97706" opacity="0.9" />
                  <polygon points="230,70 280,130 230,130" fill="#b45309" opacity="0.7" />

                  <polygon points="250,130 285,90 320,130" fill="#d97706" opacity="0.7" />

                  {/* Sphinx silhouette */}
                  <ellipse cx="350" cy="125" rx="30" ry="12" fill="#92400e" opacity="0.6" />
                  <rect x="340" y="110" width="15" height="20" fill="#92400e" opacity="0.6" />
                  <circle cx="347" cy="105" r="8" fill="#92400e" opacity="0.6" />

                  {/* Sun */}
                  <circle cx="60" cy="50" r="25" fill="#f59e0b" opacity="0.9" />

                  {/* Palm tree */}
                  <rect x="15" y="100" width="6" height="30" fill="#78350f" />
                  <ellipse cx="18" cy="95" rx="15" ry="8" fill="#16a34a" opacity="0.8" />
                  <ellipse cx="10" cy="100" rx="12" ry="6" fill="#22c55e" opacity="0.7" />
                  <ellipse cx="26" cy="100" rx="12" ry="6" fill="#22c55e" opacity="0.7" />
                </svg>

                {/* NostrPass Logo Stamp */}
                <div className="absolute bottom-2 right-2 w-14 h-14 group-hover:scale-110 transition-transform drop-shadow-lg">
                  <img src="/logo.svg" alt="NostrPass" className="w-full h-full" />
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-bold text-lg mb-2">One-Line Integration</h3>
                <p className="text-gray-600 text-sm">Drop in the Embassy SDK and get a standard window.nostr API. Works with every existing Nostr app. NIP-07 compatible.</p>
              </div>
            </div>

            {/* Card 6 - Open Protocol (Rio) */}
            <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden hover:border-gray-400 hover:shadow-lg transition-all group">
              <div className="h-40 bg-gradient-to-br from-green-100 to-emerald-50 relative overflow-hidden">
                {/* Rio Scene */}
                <svg viewBox="0 0 400 160" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
                  <defs>
                    <linearGradient id="rioSky" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#dcfce7" />
                      <stop offset="100%" stopColor="#d1fae5" />
                    </linearGradient>
                  </defs>
                  <rect width="400" height="160" fill="url(#rioSky)" />

                  {/* Ocean */}
                  <rect x="0" y="130" width="400" height="30" fill="#0ea5e9" opacity="0.4" />

                  {/* Sugarloaf Mountain */}
                  <ellipse cx="320" cy="160" rx="60" ry="80" fill="#16a34a" opacity="0.7" />
                  <ellipse cx="320" cy="140" rx="35" ry="50" fill="#22c55e" opacity="0.8" />

                  {/* Corcovado / Christ the Redeemer */}
                  <ellipse cx="150" cy="160" rx="80" ry="100" fill="#16a34a" opacity="0.6" />
                  <ellipse cx="150" cy="130" rx="50" ry="60" fill="#22c55e" opacity="0.7" />
                  <rect x="145" y="50" width="10" height="35" fill="#e5e7eb" />
                  <line x1="125" y1="60" x2="175" y2="60" stroke="#e5e7eb" strokeWidth="8" />
                  <circle cx="150" cy="45" r="6" fill="#e5e7eb" />

                  {/* Beach curve */}
                  <path d="M0,140 Q100,120 200,140 Q300,160 400,140" fill="#fef3c7" opacity="0.6" />

                  {/* Palm trees */}
                  <rect x="50" y="115" width="4" height="25" fill="#78350f" />
                  <ellipse cx="52" cy="110" rx="12" ry="6" fill="#22c55e" opacity="0.8" />
                  <ellipse cx="45" cy="113" rx="10" ry="5" fill="#16a34a" opacity="0.7" />

                  <rect x="250" y="118" width="4" height="22" fill="#78350f" />
                  <ellipse cx="252" cy="113" rx="11" ry="5" fill="#22c55e" opacity="0.8" />
                </svg>

                {/* NostrPass Logo Stamp */}
                <div className="absolute bottom-2 right-2 w-14 h-14 group-hover:scale-110 transition-transform drop-shadow-lg">
                  <img src="/logo.svg" alt="NostrPass" className="w-full h-full" />
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-bold text-lg mb-2">Open Protocol</h3>
                <p className="text-gray-600 text-sm">Built on NPS-01, an open protocol anyone can implement. No vendor lock-in. Self-host your own vault. Interoperable by design.</p>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Developer Section */}
      <div className="bg-white py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">Built for Developers</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Add authentication to your Nostr app in minutes. No complex setup, no user management, no passwords to store.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* Code Example */}
            <div className="bg-gray-900 rounded-xl p-4 sm:p-6 text-white overflow-hidden relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-gray-400 text-sm ml-2">index.html</span>
                </div>
                <button
                  onClick={() => {
                    const code = `<!-- Flexible configuration -->
<script src="https://cdn.nostrpass.com/embassy.js"></script>

<script>
  // Configure NostrPass for your app
  window.nostr = window.initNostrPass({
    appName: 'My App',
    permissions: {
      getPublicKey: 'ALLOW',
      signEvent: 'ASK_EVERYTIME'
    },
    theme: 'auto'
  });

  // Use the standard Nostr API
  const pubkey = await window.nostr.getPublicKey();
  const signed = await window.nostr.signEvent(event);
  const encrypted = await window.nostr.nip44Encrypt(pk, msg);
</script>`;
                    navigator.clipboard.writeText(code);
                    const btn = document.getElementById('copy-btn');
                    if (btn) {
                      btn.textContent = 'Copied!';
                      setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
                    }
                  }}
                  id="copy-btn"
                  className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1 rounded transition-colors min-h-[32px]"
                >
                  Copy
                </button>
              </div>
              <pre className="text-xs sm:text-sm overflow-x-auto max-w-full">
                <code className="text-green-400">{`<!-- Flexible configuration -->`}</code>
                {'\n'}
                <code className="text-blue-300">{`<script `}</code>
                <code className="text-yellow-300">src</code>
                <code className="text-white">=</code>
                <code className="text-green-300">"https://cdn.nostrpass.com/embassy.js"</code>
                <code className="text-blue-300">{`></script>`}</code>
                {'\n\n'}
                <code className="text-blue-300">{`<script>`}</code>
                {'\n'}
                <code className="text-gray-400">  // Configure NostrPass for your app</code>
                {'\n'}
                <code className="text-yellow-300">  window.nostr </code>
                <code className="text-white">= </code>
                <code className="text-yellow-300">window</code>
                <code className="text-white">.initNostrPass({"{"}</code>
                {'\n'}
                <code className="text-white">    </code>
                <code className="text-cyan-300">appName</code>
                <code className="text-white">: </code>
                <code className="text-green-300">'My App'</code>
                <code className="text-white">,</code>
                {'\n'}
                <code className="text-white">    </code>
                <code className="text-cyan-300">permissions</code>
                <code className="text-white">: {"{"}</code>
                {'\n'}
                <code className="text-white">      </code>
                <code className="text-cyan-300">getPublicKey</code>
                <code className="text-white">: </code>
                <code className="text-green-300">'ALLOW'</code>
                <code className="text-white">,</code>
                {'\n'}
                <code className="text-white">      </code>
                <code className="text-cyan-300">signEvent</code>
                <code className="text-white">: </code>
                <code className="text-green-300">'ASK_EVERYTIME'</code>
                {'\n'}
                <code className="text-white">    {"}"},</code>
                {'\n'}
                <code className="text-white">    </code>
                <code className="text-cyan-300">theme</code>
                <code className="text-white">: </code>
                <code className="text-green-300">'auto'</code>
                {'\n'}
                <code className="text-white">  {"}"});</code>
                {'\n\n'}
                <code className="text-gray-400">  // Use the standard Nostr API</code>
                {'\n'}
                <code className="text-purple-300">  const </code>
                <code className="text-white">pubkey = </code>
                <code className="text-purple-300">await </code>
                <code className="text-yellow-300">window.nostr</code>
                <code className="text-white">.getPublicKey();</code>
                {'\n'}
                <code className="text-purple-300">  const </code>
                <code className="text-white">signed = </code>
                <code className="text-purple-300">await </code>
                <code className="text-yellow-300">window.nostr</code>
                <code className="text-white">.signEvent(event);</code>
                {'\n'}
                <code className="text-purple-300">  const </code>
                <code className="text-white">encrypted = </code>
                <code className="text-purple-300">await </code>
                <code className="text-yellow-300">window.nostr</code>
                <code className="text-white">.nip44Encrypt(pk, msg);</code>
                {'\n'}
                <code className="text-blue-300">{`</script>`}</code>
              </pre>
            </div>

            {/* Developer Benefits List */}
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-black rounded-lg flex items-center justify-center text-white font-bold">1</div>
                <div>
                  <h3 className="font-bold text-lg mb-1">One Script Tag</h3>
                  <p className="text-gray-600 text-sm">Include our SDK and get a standard NIP-07 compatible <code className="bg-gray-100 px-1 rounded">window.nostr</code> API. Works with every existing Nostr library.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-black rounded-lg flex items-center justify-center text-white font-bold">2</div>
                <div>
                  <h3 className="font-bold text-lg mb-1">Zero Backend Required</h3>
                  <p className="text-gray-600 text-sm">No user database. No session management. No password resets. Users sign in with Google or username — you just verify signatures.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-black rounded-lg flex items-center justify-center text-white font-bold">3</div>
                <div>
                  <h3 className="font-bold text-lg mb-1">Framework Agnostic</h3>
                  <p className="text-gray-600 text-sm">React, Vue, Svelte, vanilla JS — we don't care. If it runs in a browser, NostrPass works. TypeScript types included.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-black rounded-lg flex items-center justify-center text-white font-bold">4</div>
                <div>
                  <h3 className="font-bold text-lg mb-1">Self-Host Ready</h3>
                  <p className="text-gray-600 text-sm">Don't want to depend on us? Self-host your own vault. Full documentation and Docker images available. Open protocol, no lock-in.</p>
                </div>
              </div>
            </div>
          </div>

          {/* API Methods Grid */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="border-2 border-gray-200 rounded-lg p-4 hover:border-gray-400 transition-colors">
              <code className="text-sm font-mono text-gray-800">getPublicKey()</code>
              <p className="text-gray-500 text-xs mt-1">Get user's Nostr public key</p>
            </div>
            <div className="border-2 border-gray-200 rounded-lg p-4 hover:border-gray-400 transition-colors">
              <code className="text-sm font-mono text-gray-800">signEvent(event)</code>
              <p className="text-gray-500 text-xs mt-1">Sign any Nostr event (NIP-01)</p>
            </div>
            <div className="border-2 border-gray-200 rounded-lg p-4 hover:border-gray-400 transition-colors">
              <code className="text-sm font-mono text-gray-800">nip04.encrypt()</code>
              <p className="text-gray-500 text-xs mt-1">Encrypt messages (NIP-04)</p>
            </div>
            <div className="border-2 border-gray-200 rounded-lg p-4 hover:border-gray-400 transition-colors">
              <code className="text-sm font-mono text-gray-800">nip04.decrypt()</code>
              <p className="text-gray-500 text-xs mt-1">Decrypt messages (NIP-04)</p>
            </div>
            <div className="border-2 border-gray-200 rounded-lg p-4 hover:border-gray-400 transition-colors">
              <code className="text-sm font-mono text-gray-800">nip44.encrypt()</code>
              <p className="text-gray-500 text-xs mt-1">Encrypt messages (NIP-44)</p>
            </div>
            <div className="border-2 border-gray-200 rounded-lg p-4 hover:border-gray-400 transition-colors">
              <code className="text-sm font-mono text-gray-800">nip44.decrypt()</code>
              <p className="text-gray-500 text-xs mt-1">Decrypt messages (NIP-44)</p>
            </div>
            <div className="border-2 border-gray-200 rounded-lg p-4 hover:border-gray-400 transition-colors">
              <code className="text-sm font-mono text-gray-800">getRelays()</code>
              <p className="text-gray-500 text-xs mt-1">Get user's relay preferences</p>
            </div>
            <div className="border-2 border-gray-200 rounded-lg p-4 hover:border-gray-400 transition-colors">
              <code className="text-sm font-mono text-gray-800">signData(data)</code>
              <p className="text-gray-500 text-xs mt-1">Sign arbitrary data</p>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center mt-12">
            <button
              onClick={() => setShowCode(true)}
              className="px-8 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
            >
              View Full Documentation
            </button>
          </div>
        </div>
      </div>

      {/* NostrPass Lite Section */}
      <div id="nostrpass-lite" className="bg-gray-900 py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-full px-4 py-1.5 mb-6">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              <span className="text-green-400 text-sm font-medium">New</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight text-white">NostrPass Lite</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              No cloud vault. No iframe. Just a lightweight script that stores encrypted keys in the browser
              and syncs via Nostr relays — the self-sovereign option.
            </p>
          </div>

          {/* Comparison */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                  <img src="/logo.svg" alt="NostrPass" className="w-5 h-5" />
                </div>
                <h3 className="text-white font-bold text-lg">NostrPass</h3>
                <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">Full</span>
              </div>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Cloud-synced encrypted vault</li>
                <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Google Sign-In support</li>
                <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Cross-device sync out of the box</li>
                <li className="flex items-center gap-2"><span className="text-green-400">✓</span> iframe-isolated key operations</li>
                <li className="flex items-center gap-2"><span className="text-green-400">✓</span> NIP-07 compatible</li>
              </ul>
              <p className="text-xs text-gray-500 mt-4">Best for apps that want a polished, managed auth experience</p>
            </div>

            <div className="bg-gray-800 border border-green-800 rounded-xl p-6 relative">
              <div className="absolute top-4 right-4 text-xs bg-green-900 text-green-400 border border-green-700 px-2 py-0.5 rounded-full">Lightweight</div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-green-900 border border-green-700 rounded-lg flex items-center justify-center">
                  <span className="text-green-400 text-xs font-bold">L</span>
                </div>
                <h3 className="text-white font-bold text-lg">NostrPass Lite</h3>
              </div>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Keys isolated in <code className="text-green-300 text-xs">cdn.nostrpass.com</code> origin</li>
                <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Syncs via Nostr relays — no server</li>
                <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Single lightweight CDN script</li>
                <li className="flex items-center gap-2"><span className="text-green-400">✓</span> NIP-07 compatible window.nostr</li>
                <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Full TypeScript support</li>
              </ul>
              <p className="text-xs text-gray-500 mt-4">Best for self-sovereign apps that want no third-party dependency</p>
            </div>
          </div>

          {/* Code Example */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden mb-8">
            <div className="flex items-center justify-between px-6 pt-4 pb-2 border-b border-gray-700">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-gray-400 text-sm ml-2">index.html</span>
              </div>
              <button
                onClick={() => {
                  const code = `<script src="https://cdn.nostrpass.com/lite-embassy.js"></script>
<script>
  // Initialize — async, returns the embassy instance
  const embassy = await window.initNostrPassLite({
    appName: 'My App',
    relays: ['wss://relay.damus.io', 'wss://nos.lol'],
  });

  // Enroll a new user (identifier + password + PIN)
  await embassy.enrollWithPassword({
    identifier: 'alice',
    authSecret: 'my-password',
    pin: '123456',
  });

  // Or login an existing user
  await embassy.loginWithPassword({ identifier: 'alice', authSecret: 'my-password' });

  // Now use the standard NIP-07 window.nostr API
  const pubkey = await window.nostr.getPublicKey();
  const signed = await window.nostr.signEvent({ kind: 1, content: 'gm', tags: [], created_at: Date.now() / 1000 | 0 });
</script>`;
                  navigator.clipboard.writeText(code)
                  const btn = document.getElementById('lite-copy-btn')
                  if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy' }, 2000) }
                }}
                id="lite-copy-btn"
                className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1 rounded transition-colors"
              >
                Copy
              </button>
            </div>
            <pre className="text-xs sm:text-sm px-6 py-4 overflow-x-auto">
              <code className="text-blue-300">{`<script `}</code>
              <code className="text-yellow-300">src</code>
              <code className="text-white">=</code>
              <code className="text-green-300">"https://cdn.nostrpass.com/lite-embassy.js"</code>
              <code className="text-blue-300">{`></script>`}</code>
              {'\n'}
              <code className="text-blue-300">{`<script>`}</code>
              {'\n'}
              <code className="text-gray-500">{'  // Initialize — async, returns the embassy instance'}</code>
              {'\n'}
              <code className="text-purple-300">{'  const '}</code>
              <code className="text-white">embassy = </code>
              <code className="text-purple-300">await </code>
              <code className="text-yellow-300">window</code>
              <code className="text-white">.initNostrPassLite({'({'}</code>
              {'\n'}
              <code className="text-cyan-300">{'    appName'}</code>
              <code className="text-white">: </code>
              <code className="text-green-300">'My App'</code>
              <code className="text-white">,</code>
              {'\n'}
              <code className="text-cyan-300">{'    relays'}</code>
              <code className="text-white">{`: ['wss://relay.damus.io', 'wss://nos.lol'],`}</code>
              {'\n'}
              <code className="text-white">{'  });'}</code>
              {'\n\n'}
              <code className="text-gray-500">{'  // Enroll a new user'}</code>
              {'\n'}
              <code className="text-purple-300">{'  await '}</code>
              <code className="text-white">embassy.enrollWithPassword({'({'}</code>
              {'\n'}
              <code className="text-cyan-300">{'    identifier'}</code>
              <code className="text-white">: </code>
              <code className="text-green-300">'alice'</code>
              <code className="text-white">, </code>
              <code className="text-cyan-300">authSecret</code>
              <code className="text-white">: </code>
              <code className="text-green-300">'my-password'</code>
              <code className="text-white">, </code>
              <code className="text-cyan-300">pin</code>
              <code className="text-white">: </code>
              <code className="text-green-300">'123456'</code>
              {'\n'}
              <code className="text-white">{'  });'}</code>
              {'\n\n'}
              <code className="text-gray-500">{'  // Standard NIP-07 window.nostr API'}</code>
              {'\n'}
              <code className="text-purple-300">{'  const '}</code>
              <code className="text-white">pubkey = </code>
              <code className="text-purple-300">await </code>
              <code className="text-yellow-300">window.nostr</code>
              <code className="text-white">.getPublicKey();</code>
              {'\n'}
              <code className="text-blue-300">{`</script>`}</code>
            </pre>
          </div>

          {/* CTA Buttons */}
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => setShowLiteCode(true)}
              className="px-6 py-3 bg-gray-800 text-white border border-gray-600 rounded-lg hover:bg-gray-700 hover:border-gray-400 transition-colors font-medium flex items-center gap-2"
            >
              <span>&lt;&lt;</span>
              <span>Lite Docs</span>
            </button>
            <button
              onClick={() => setShowLiteDemo(true)}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors font-medium flex items-center gap-2"
            >
              <span>Try Lite Demo</span>
              <span>&gt;&gt;</span>
            </button>
          </div>
        </div>
      </div>

      {/* Resources Section */}
      <div className="bg-white py-16 px-6 border-t border-gray-200">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 tracking-tight">Learn More</h2>
          <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            Deep dives into NostrPass architecture, security, and the future of decentralized identity
          </p>

          <div className="grid md:grid-cols-1 gap-6">
            {/* Featured Article */}
            <a
              href="https://primal.net/bigmarh/nostrpass-decentralized-identity"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden hover:border-black hover:shadow-lg transition-all group"
            >
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-gray-900 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-xl mb-2 group-hover:text-black transition-colors">
                      The Identity Problem Nostr Needed to Solve
                    </h3>
                    <p className="text-gray-600 text-sm mb-3">
                      How a privacy-first vault is making self-sovereign identity actually usable on Nostr—without compromising security.
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        15 min read
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        Security, Architecture, Technical
                      </span>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <svg className="w-6 h-6 text-gray-400 group-hover:text-black group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </a>
          </div>
        </div>
      </div>

      {/* Footer - Not fixed when scrolling */}
      <footer className="flex flex-col md:flex-row text-xs py-6 w-full justify-center items-center gap-3 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <p className="text-gray-500">NostrPass</p>
            <p className="text-gray-500">© 2025 NostrPass. All rights reserved.</p>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/bigmarh/nostrpass"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-gray-600 hover:text-black transition-colors group"
              title="View source on GitHub"
            >
              <svg
                className="w-5 h-5 group-hover:scale-110 transition-transform"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="font-medium">Open Source</span>
            </a>
          </div>
      </footer>

      {/* Code Panel - Slides from left */}
      <div
        className={`fixed inset-0 bg-white z-50 transform transition-transform duration-500 ease-in-out ${
          showCode ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full overflow-y-auto">
          <div className="max-w-4xl mx-auto p-8">
            <div className="flex items-center justify-between mb-8">
              <button
                onClick={() => setShowCode(false)}
                className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
              >
                &lt;&lt; Back
              </button>
              <a
                href="https://github.com/bigmarh/nostrpass"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-gray-600 hover:text-black transition-colors group"
                title="View source on GitHub"
              >
                <svg
                  className="w-5 h-5 group-hover:scale-110 transition-transform"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="font-medium hidden sm:inline">View on GitHub</span>
                <span className="font-medium sm:hidden">GitHub</span>
              </a>
            </div>

            <h2 className="text-2xl font-bold mb-8">Quick Start</h2>

            <div className="mb-8">
              <h3 className="text-xl font-semibold mb-4">Option 1: NostrPass Button (Recommended)</h3>
              <p className="text-gray-600 mb-6">
                Drop in a ready-made login button that handles everything for you - login state, UI, and session management.
              </p>
            </div>

            <div className="bg-gray-900 text-white rounded-lg overflow-x-auto">
              <div className="flex items-center justify-between px-6 pt-4 pb-2">
                <span className="text-gray-400 text-xs">HTML</span>
                <button
                  onClick={(e) => {
                    const code = `<!-- Add the script and create a login button -->
<script src="https://cdn.nostrpass.com/embassy.js"></script>
<div id="nostrpass-login"></div>
<script>
  window.nostr.createNostrPassButton({
    onLogin: (user) => console.log('Logged in:', user.publicKey)
  }).mount('#nostrpass-login');
</script>`;
                    navigator.clipboard.writeText(code);
                    const btn = e.target as HTMLButtonElement;
                    const original = btn.textContent;
                    btn.textContent = 'Copied!';
                    setTimeout(() => { btn.textContent = original; }, 2000);
                  }}
                  className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1 rounded transition-colors"
                >
                  Copy
                </button>
              </div>
              <pre className="text-[0.65rem] md:text-[0.77rem] px-6 pb-4">
                <code>{`<!-- Add the script and create a login button -->
<script src="https://cdn.nostrpass.com/embassy.js"></script>
<div id="nostrpass-login"></div>
<script>
  window.nostr.createNostrPassButton({
    onLogin: (user) => console.log('Logged in:', user.publicKey)
  }).mount('#nostrpass-login');
</script>`}</code>
              </pre>
            </div>

            <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-8">
              <p className="text-sm text-green-900">
                <strong>Best UX!</strong> The NostrPass button shows login state, handles session restoration,
                and provides a consistent user experience across all apps.
              </p>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-semibold mb-4">Option 2: Bring Your Own Button</h3>
              <p className="text-gray-600 mb-6">
                Use your own custom button and call the NostrPass API directly.
              </p>
            </div>

            <div className="bg-gray-900 text-white rounded-lg overflow-x-auto">
              <div className="flex items-center justify-between px-6 pt-4 pb-2">
                <span className="text-gray-400 text-xs">HTML</span>
                <button
                  onClick={(e) => {
                    const code = `<!-- Use your own button -->
<script src="https://cdn.nostrpass.com/embassy.js"></script>
<button onclick="window.nostr.getPublicKey().then(pk => console.log('Logged in:', pk))">
  Login with NostrPass
</button>`;
                    navigator.clipboard.writeText(code);
                    const btn = e.target as HTMLButtonElement;
                    const original = btn.textContent;
                    btn.textContent = 'Copied!';
                    setTimeout(() => { btn.textContent = original; }, 2000);
                  }}
                  className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1 rounded transition-colors"
                >
                  Copy
                </button>
              </div>
              <pre className="text-[0.65rem] md:text-[0.77rem] px-6 pb-4">
                <code>{`<!-- Use your own button -->
<script src="https://cdn.nostrpass.com/embassy.js"></script>
<button onclick="window.nostr.getPublicKey().then(pk => console.log('Logged in:', pk))">
  Login with NostrPass
</button>`}</code>
              </pre>
            </div>

            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-8">
              <p className="text-sm text-blue-900">
                <strong>Maximum flexibility.</strong> Use your own UI components and handle authentication
                your way. NostrPass just provides the <code className="bg-blue-100 px-1 rounded">window.nostr</code> API.
              </p>
            </div>

            <div className="mb-8">
              <h3 className="text-2xl font-semibold mb-4">Full Example</h3>
              <p className="text-gray-600 mb-6">
                For more control, use the programmatic API:
              </p>
            </div>

            <div className="bg-gray-900 text-white rounded-lg overflow-x-auto">
              <div className="flex items-center justify-between px-6 pt-4 pb-2">
                <span className="text-gray-400 text-xs">JavaScript</span>
                <button
                  onClick={(e) => {
                    const code = `<!-- Add this script to your HTML -->
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
</script>`;
                    navigator.clipboard.writeText(code);
                    const btn = e.target as HTMLButtonElement;
                    const original = btn.textContent;
                    btn.textContent = 'Copied!';
                    setTimeout(() => { btn.textContent = original; }, 2000);
                  }}
                  className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1 rounded transition-colors"
                >
                  Copy
                </button>
              </div>
              <pre className="text-[0.65rem] md:text-[0.77rem] px-6 pb-4">
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
                  <p className="text-sm text-gray-600 mt-2">Encrypt a direct message (NIP-04, legacy)</p>
                </div>
                <div className="border-l-4 border-gray-300 pl-4">
                  <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">nostr.nip04.decrypt(pubkey, ciphertext)</code>
                  <p className="text-sm text-gray-600 mt-2">Decrypt a direct message (NIP-04, legacy)</p>
                </div>
                <div className="border-l-4 border-blue-500 pl-4">
                  <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">nostr.nip44Encrypt(pubkey, plaintext)</code>
                  <p className="text-sm text-gray-600 mt-2"><strong>Encrypt a direct message (NIP-44, recommended)</strong> - Improved encryption standard with audited cryptography</p>
                </div>
                <div className="border-l-4 border-blue-500 pl-4">
                  <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">nostr.nip44Decrypt(pubkey, ciphertext)</code>
                  <p className="text-sm text-gray-600 mt-2"><strong>Decrypt a direct message (NIP-44, recommended)</strong> - Improved encryption standard with audited cryptography</p>
                </div>
              </div>

              <div className="mt-8 bg-gray-900 text-white p-6 rounded-lg overflow-x-auto">
                <h4 className="text-lg font-semibold mb-4 text-white">Encryption Example (NIP-44)</h4>
                <pre className="text-[0.65rem] md:text-[0.77rem]">
                  <code>{`// Get user's public key
const myPubkey = await nostr.getPublicKey();

// Encrypt a message to another user (NIP-44 recommended)
const recipientPubkey = 'npub1...'; // recipient's public key
const message = 'Hello! This is a private message.';
const encrypted = await nostr.nip44Encrypt(recipientPubkey, message);

// Decrypt a message from another user (NIP-44)
const senderPubkey = 'npub1...'; // sender's public key
const decrypted = await nostr.nip44Decrypt(senderPubkey, encrypted);

console.log('Decrypted message:', decrypted);

// Legacy NIP-04 also supported for backward compatibility
const legacyEncrypted = await nostr.nip04.encrypt(recipientPubkey, message);
const legacyDecrypted = await nostr.nip04.decrypt(senderPubkey, legacyEncrypted);`}</code>
                </pre>
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

      {/* Lite Code Panel - Slides from left */}
      <div
        className={`fixed inset-0 bg-white z-50 transform transition-transform duration-500 ease-in-out ${
          showLiteCode ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full overflow-y-auto">
          <div className="max-w-4xl mx-auto p-8">
            <div className="flex items-center justify-between mb-8">
              <button
                onClick={() => setShowLiteCode(false)}
                className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
              >
                &lt;&lt; Back
              </button>
              <span className="text-xs bg-green-100 text-green-800 border border-green-200 px-3 py-1 rounded-full font-medium">NostrPass Lite Docs</span>
            </div>

            <h2 className="text-2xl font-bold mb-2">NostrPass Lite</h2>
            <p className="text-gray-600 mb-8">A lightweight, no-server Nostr signer — keys secured in an origin-isolated iframe, synced via relays.</p>

            <h3 className="text-xl font-semibold mb-4">Installation</h3>
            <div className="bg-gray-900 text-white rounded-lg px-6 py-4 mb-6 overflow-x-auto">
              <pre className="text-sm"><code>{`<!-- CDN (recommended) -->
<script src="https://cdn.nostrpass.com/lite-embassy.js"></script>

<!-- npm -->
npm install @nostrpass/lite-embassy`}</code></pre>
            </div>

            <h3 className="text-xl font-semibold mb-4">Quick Start</h3>
            <div className="bg-gray-900 text-white rounded-lg px-6 py-4 mb-6 overflow-x-auto">
              <pre className="text-[0.72rem] md:text-sm"><code>{`// 1. Initialize (auto-installs window.nostr)
const embassy = await window.initNostrPassLite({
  appName: 'My App',
  relays: ['wss://relay.damus.io', 'wss://nos.lol'],
});

// 2. Enroll a new user
await embassy.enrollWithPassword({
  identifier: 'alice',
  authSecret: 'strong-password',
  pin: '123456',          // PIN to lock/unlock without re-entering password
});

// 3. Or login an existing user
const auth = await embassy.loginWithPassword({
  identifier: 'alice',
  authSecret: 'strong-password',
});

// If vault is locked (e.g. page refresh), unlock with PIN
if (auth.isLocked) {
  await embassy.unlock({ pin: '123456' });
}

// 4. Use the standard NIP-07 window.nostr API
const pubkey = await window.nostr.getPublicKey();
const event = { kind: 1, content: 'gm', tags: [], created_at: Date.now() / 1000 | 0 };
const signed = await window.nostr.signEvent(event);

// NIP-04 / NIP-44 encryption also available
const encrypted = await window.nostr.nip44.encrypt(recipientPubkey, 'secret message');`}</code></pre>
            </div>

            <h3 className="text-xl font-semibold mb-4">Configuration</h3>
            <div className="space-y-3 mb-8">
              {[
                { name: 'appName', type: 'string', desc: 'Your app name, shown in permission prompts' },
                { name: 'relays', type: 'string[]', desc: 'Nostr relay URLs for key sync. Defaults to damus, nos.lol, nostr.band' },
                { name: 'namespace', type: 'string', desc: 'Storage namespace for key isolation. Default: nostrpass-lite' },
                { name: 'environment', type: 'string', desc: "Environment tag: 'production' | 'development' | 'staging'" },
                { name: 'storagePrefix', type: 'string', desc: 'localStorage key prefix. Default: nostrpass-lite-embassy' },
                { name: 'debug', type: 'boolean', desc: 'Enable verbose console logging. Default: false' },
                { name: 'installProviderOnInit', type: 'boolean', desc: 'Auto-install window.nostr on init. Default: true' },
                { name: 'overrideExistingProvider', type: 'boolean', desc: 'Override existing window.nostr (e.g. browser extension). Default: false' },
                { name: 'rememberByDefault', type: 'boolean', desc: 'Keep session across page loads by default. Default: true' },
                { name: 'onStatusChange', type: 'function', desc: 'Callback fired on auth state changes (auth_required, signed-in, etc.)' },
              ].map(({ name, type, desc }) => (
                <div key={name} className="border-l-4 border-green-500 pl-4 py-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-sm font-mono bg-gray-100 px-2 py-0.5 rounded">{name}</code>
                    <span className="text-xs text-gray-400">{type}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{desc}</p>
                </div>
              ))}
            </div>

            <h3 className="text-xl font-semibold mb-4">API Methods</h3>
            <div className="space-y-3 mb-8">
              {[
                { sig: 'enrollWithPassword({ identifier, authSecret, pin })', desc: 'Create a new identity. Generates a Nostr keypair, encrypts with password, locks with PIN.' },
                { sig: 'loginWithPassword({ identifier, authSecret })', desc: 'Authenticate an existing identity. Returns auth state — may be locked.' },
                { sig: 'unlock({ pin })', desc: 'Unlock a locked session with PIN. Required after page load if vault is locked.' },
                { sig: 'importKey({ format, value, identifier, authSecret, pin })', desc: 'Import an existing nsec or hex private key.' },
                { sig: 'logout()', desc: 'Sign out and clear the active session.' },
                { sig: 'getAuthState()', desc: 'Synchronously returns { isAuthenticated, isLocked, identifier, publicKey }.' },
                { sig: 'installNostrProvider({ overrideExisting })', desc: 'Manually install window.nostr provider.' },
                { sig: 'createNostrPassLiteButton(config)', desc: 'Create a styled login button that reflects auth state.' },
              ].map(({ sig, desc }) => (
                <div key={sig} className="border-l-4 border-gray-300 pl-4">
                  <code className="text-sm font-mono bg-gray-100 px-2 py-0.5 rounded break-all">{sig}</code>
                  <p className="text-sm text-gray-600 mt-1">{desc}</p>
                </div>
              ))}
            </div>

            <h3 className="text-xl font-semibold mb-4">Status Events</h3>
            <p className="text-gray-600 text-sm mb-4">Listen to the <code className="bg-gray-100 px-1 rounded">nostrpass-lite:status</code> window event to react to auth state changes:</p>
            <div className="bg-gray-900 text-white rounded-lg px-6 py-4 mb-8 overflow-x-auto">
              <pre className="text-[0.72rem] md:text-sm"><code>{`window.addEventListener('nostrpass-lite:status', (e) => {
  const { kind, auth } = e.detail;
  // kind: 'ready' | 'auth_required' | 'pin_required' | 'processing' | 'success' | 'error'
  if (kind === 'auth_required') showLoginModal();
  if (kind === 'pin_required') showPinModal();
  if (kind === 'ready' && auth.isAuthenticated) showDashboard(auth.publicKey);
});`}</code></pre>
            </div>

            <h3 className="text-xl font-semibold mb-4">Login Button</h3>
            <div className="bg-gray-900 text-white rounded-lg px-6 py-4 mb-8 overflow-x-auto">
              <pre className="text-[0.72rem] md:text-sm"><code>{`const embassy = await window.initNostrPassLite({ appName: 'My App' });

const btn = embassy.createNostrPassLiteButton({
  appendTo: '#login-container',   // CSS selector or HTMLElement
  labelSignedOut: 'Use NostrPass Lite',
  labelLocked: 'Unlock',
  labelSignedIn: 'Connected',
  onClick: (embassy, auth) => {
    if (!auth.isAuthenticated) showSignupModal();
    else if (auth.isLocked) showPinModal();
    else embassy.logout();
  },
});`}</code></pre>
            </div>

            <div className="text-center mt-8">
              <button
                onClick={() => { setShowLiteCode(false); setShowLiteDemo(true) }}
                className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors font-medium"
              >
                Try Lite Demo →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Lite Demo Panel - Slides from right */}
      <div
        className={`fixed inset-0 bg-white z-50 transform transition-transform duration-500 ease-in-out ${
          showLiteDemo ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Single vault iframe — always mounted while demo is open, shown full-screen when auth is needed */}
        {showLiteDemo && (
          <iframe
            ref={vaultFrameRef}
            src={`${LITE_VAULT_URL}?parentOrigin=${encodeURIComponent(window.location.origin)}`}
            title="NostrPass Lite Vault"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            style={liteShowVault
              ? { position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '425px', height: '100dvh', zIndex: 60, border: 'none' }
              : { position: 'fixed', width: 0, height: 0, border: 'none', visibility: 'hidden' }
            }
          />
        )}

        <div className="h-full overflow-y-auto">
          <div className="max-w-4xl mx-auto p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">NostrPass Lite Demo</h2>
                <p className="text-gray-500 text-sm mt-1">Secured by the lite-vault iframe — keys never touch this page</p>
              </div>
              <button
                onClick={() => setShowLiteDemo(false)}
                className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
              >
                Back &gt;&gt;
              </button>
            </div>

            {/* Loading state */}
            {!liteFrameReady && (
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200 mb-6">
                <div className="w-4 h-4 border-2 border-gray-400 border-t-black rounded-full animate-spin"></div>
                <span className="text-gray-600 text-sm">Connecting to lite-vault...</span>
              </div>
            )}

            {/* How it works banner */}
            {liteFrameReady && (
              <div className="bg-gray-900 text-white rounded-xl p-4 mb-6 flex items-start gap-3">
                <span className="text-green-400 text-lg mt-0.5">🔒</span>
                <div>
                  <p className="text-sm font-semibold text-white mb-0.5">Origin-isolated security</p>
                  <p className="text-xs text-gray-400">Login and key operations happen inside a <code className="text-green-400">cdn.nostrpass.com</code> iframe. This page never sees your password or private key — only signed events come back via <code className="text-green-400">postMessage</code>.</p>
                </div>
              </div>
            )}

            {/* Not authenticated */}
            {liteFrameReady && !liteAuth?.isAuthenticated && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">🗝️</span>
                </div>
                <h3 className="text-xl font-bold mb-2">No identity yet</h3>
                <p className="text-gray-500 text-sm mb-6 max-w-xs mx-auto">Sign in or create an account inside the secure vault. Your credentials never leave the iframe.</p>
                <button
                  onClick={() => setLiteShowVault(true)}
                  className="px-8 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
                >
                  Open Vault to Sign In
                </button>
              </div>
            )}

            {/* Locked */}
            {liteFrameReady && liteAuth?.isAuthenticated && liteAuth.isLocked && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-yellow-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">🔒</span>
                </div>
                <h3 className="text-xl font-bold mb-2">Vault Locked</h3>
                <p className="text-gray-500 text-sm mb-6">Enter your PIN inside the vault to unlock</p>
                <button
                  onClick={() => setLiteShowVault(true)}
                  className="px-8 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
                >
                  Unlock Vault
                </button>
              </div>
            )}

            {/* Signed in */}
            {liteFrameReady && liteAuth?.isAuthenticated && !liteAuth.isLocked && (
              <div>
                <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mb-6 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      <span className="text-sm font-semibold text-green-900">
                        Signed in{liteAuth.identifier ? ` as ${liteAuth.identifier}` : ''}
                      </span>
                    </div>
                    {liteAuth.publicKey && (
                      <p className="text-xs text-green-700 font-mono break-all">{liteAuth.publicKey.slice(0, 32)}...</p>
                    )}
                    <p className="text-xs text-green-600 mt-1">Keys secured in lite-vault iframe · <code>cdn.nostrpass.com</code> origin</p>
                  </div>
                  <button onClick={handleLiteLogout} className="text-xs text-gray-500 hover:text-black border border-gray-300 rounded px-2 py-1 shrink-0">Sign out</button>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Sign a Message</h3>
                    <p className="text-gray-600 text-sm mb-3">Each click sends a <code className="bg-gray-100 px-1 rounded text-xs">SIGN_EVENT</code> RPC to the vault iframe and gets back a signed event</p>
                    <div className="grid grid-cols-2 gap-2">
                      {['🚀 Nostr is the future!', '⚡ NostrPass Lite works!', '🔐 Self-sovereign keys', '✨ No cloud needed', '🌿 Local-first identity', '💜 Built different'].map(msg => (
                        <button
                          key={msg}
                          onClick={() => handleLiteSign(msg)}
                          className="px-3 py-2 text-xs bg-white border-2 border-gray-200 rounded-lg hover:border-black hover:bg-gray-50 transition-colors text-left"
                        >
                          {msg}
                        </button>
                      ))}
                    </div>
                    {liteSignError && <p className="text-red-500 text-sm mt-3">{liteSignError}</p>}
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">Signed Events</h3>
                    <div className="h-64 overflow-y-auto border-2 border-gray-200 rounded-lg p-3 bg-gray-50">
                      {liteEvents.length === 0 ? (
                        <p className="text-gray-400 text-sm text-center mt-8">No events yet — sign one!</p>
                      ) : (
                        <div className="space-y-2">
                          {liteEvents.map(ev => (
                            <div key={ev.id} className="bg-white border border-gray-200 rounded-lg p-3">
                              <p className="text-sm mb-1">{ev.content}</p>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-400">{new Date(ev.created_at * 1000).toLocaleTimeString()}</span>
                                <a
                                  href={`https://njump.me/${ev.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded px-2 py-0.5"
                                >
                                  View
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App