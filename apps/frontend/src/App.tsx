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

      {/* Feature Cards Section - Passport Theme */}
      <div className="bg-gray-50 py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 tracking-tight">Your Identity, Everywhere</h2>
          <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            Like a passport for the decentralized web. One identity that works across every app, every device, every corner of the Nostr universe.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card 1 - Multi-Identity (Tokyo) */}
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
                    const code = `<!-- That's it. Seriously. -->
<script src="https://cdn.nostrpass.com/embassy.js"></script>

<script>
  // Get user's public key
  const pubkey = await window.nostr.getPublicKey();

  // Sign events
  const signed = await window.nostr.signEvent(event);
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
                <code className="text-green-400">{`<!-- That's it. Seriously. -->`}</code>
                {'\n'}
                <code className="text-blue-300">{`<script `}</code>
                <code className="text-yellow-300">src</code>
                <code className="text-white">=</code>
                <code className="text-green-300">"https://cdn.nostrpass.com/embassy.js"</code>
                <code className="text-blue-300">{`></script>`}</code>
                {'\n\n'}
                <code className="text-blue-300">{`<script>`}</code>
                {'\n'}
                <code className="text-gray-400">  // Get user's public key</code>
                {'\n'}
                <code className="text-purple-300">  const </code>
                <code className="text-white">pubkey = </code>
                <code className="text-purple-300">await </code>
                <code className="text-yellow-300">window.nostr</code>
                <code className="text-white">.getPublicKey();</code>
                {'\n\n'}
                <code className="text-gray-400">  // Sign events</code>
                {'\n'}
                <code className="text-purple-300">  const </code>
                <code className="text-white">signed = </code>
                <code className="text-purple-300">await </code>
                <code className="text-yellow-300">window.nostr</code>
                <code className="text-white">.signEvent(event);</code>
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
                  <p className="text-gray-600 text-sm">No user database. No session management. No password resets. Users own their identity — you just verify signatures.</p>
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
              <p className="text-gray-500 text-xs mt-1">Encrypt direct messages</p>
            </div>
            <div className="border-2 border-gray-200 rounded-lg p-4 hover:border-gray-400 transition-colors">
              <code className="text-sm font-mono text-gray-800">nip04.decrypt()</code>
              <p className="text-gray-500 text-xs mt-1">Decrypt direct messages</p>
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

      {/* Footer - Not fixed when scrolling */}
      <footer className="flex text-xs py-6 w-full justify-center items-center bg-gray-50 border-t border-gray-200">
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