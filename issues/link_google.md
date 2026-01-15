Here is the COnsole log for the vault and embassy:  

GoogleAuthProvider.tsx:119 [GoogleAuth] Signed in successfully: lamar@wilsondom.com
Login.tsx:126 [Login] Google sign-in environment check: {userConfigured: true, globalNamespace: 'nostrpass.com', globalEnv: 'demo', urlEnv: null, providerEnv: 'demo', …}
vaultHelpers.ts:524 🔍 [getAllGoogleLoginObjs] Querying for all Google LoginObjs: {googleUid: '0Ymnmq7I...', environment: 'demo', namespace: 'nostrpass.com', dTagPrefix: 'nostrpass.com_login_fd4aa28f3151e2c684306f8f303280d7538ca8a93c72f3579299e47e7adb618f_google_', hashedGoogleUid: 'fd4aa28f3151e2c684306f8f303280d7538ca8a93c72f3579299e47e7adb618f', …}
vaultHelpers.ts:536 🔍 [getAllGoogleLoginObjs] Querying by #t tag: gvault_fd4aa28f3151e2c684306f8f303280d7538ca8a93c72f3579299e47e7adb618f
vaultHelpers.ts:546 WebSocket connection to 'ws://localhost:8080/' failed: 
(anonymous) @ nostr-tools.js?v=260afb0c:717
connect @ nostr-tools.js?v=260afb0c:708
ensureRelay @ nostr-tools.js?v=260afb0c:1092
(anonymous) @ nostr-tools.js?v=260afb0c:1186
subscribeMap @ nostr-tools.js?v=260afb0c:1183
subscribe @ nostr-tools.js?v=260afb0c:1111
subscribeEose @ nostr-tools.js?v=260afb0c:1232
(anonymous) @ nostr-tools.js?v=260afb0c:1253
querySync @ nostr-tools.js?v=260afb0c:1251
getAllGoogleLoginObjs @ vaultHelpers.ts:546
handleGoogleSignIn @ Login.tsx:136
vaultHelpers.ts:547 🔍 [getAllGoogleLoginObjs] Query returned 4 event(s)
vaultHelpers.ts:554 🔍 [getAllGoogleLoginObjs] D-tags found: (4) ['nostrpass.com_login_fd4aa28f3151e2c684306f8f303280…3cd82d4c06392680053db52d08ea77df1b029569499b_demo', 'nostrpass.com_login_fd4aa28f3151e2c684306f8f303280…abc6b87cf2118ee6321d330020d512b2d3dfbcaa7_staging', 'nostrpass.com_login_fd4aa28f3151e2c684306f8f303280…a9a9daff235764119e4d4f1def382c75777e6_development', 'nostrpass.com_login_fd4aa28f3151e2c684306f8f303280…5bcf1dfbd928b630e3bb64619ae3ed17485bff9c0fc1_demo']
vaultHelpers.ts:562 🔍 [getAllGoogleLoginObjs] D-tag nostrpass.com_login_fd4aa28f3151e2c684306f8f303280d7538ca8a93c72f3579299e47e7adb618f_google_c725aa07f8f7f3003610c7dabc6b87cf2118ee6321d330020d512b2d3dfbcaa7_staging does not match prefix nostrpass.com_login_fd4aa28f3151e2c684306f8f303280d7538ca8a93c72f3579299e47e7adb618f_google_ or suffix _demo
vaultHelpers.ts:562 🔍 [getAllGoogleLoginObjs] D-tag nostrpass.com_login_fd4aa28f3151e2c684306f8f303280d7538ca8a93c72f3579299e47e7adb618f_google_a76d3b1ecacbaef20ed9c04a3f2a9a9daff235764119e4d4f1def382c75777e6_development does not match prefix nostrpass.com_login_fd4aa28f3151e2c684306f8f303280d7538ca8a93c72f3579299e47e7adb618f_google_ or suffix _demo
vaultHelpers.ts:567 🔍 [getAllGoogleLoginObjs] Found 2 LoginObj events for this Google UID after filtering
vaultHelpers.ts:582 🔍 [getAllGoogleLoginObjs] Skipping tombstoned entry
vaultHelpers.ts:623 🔍 [getAllGoogleLoginObjs] Returning 1 vault(s)
Login.tsx:138 [Login] Google vaults found: {uid: '0Ymnmq7I...', environment: 'demo', namespace: 'nostrpass.com', vaultCount: 1}
Login.tsx:151 [Login] Single vault found, proceeding to password prompt
Login.tsx:155 Blocked autofocusing on a <input> element in a cross-origin subframe.
cleanChildren @ chunk-LCAEHM2X.js?v=260afb0c:654
insertExpression @ chunk-LCAEHM2X.js?v=260afb0c:608
(anonymous) @ chunk-LCAEHM2X.js?v=260afb0c:574
runComputation @ chunk-KHM4YBAW.js?v=260afb0c:733
updateComputation @ chunk-KHM4YBAW.js?v=260afb0c:716
createRenderEffect @ chunk-KHM4YBAW.js?v=260afb0c:235
insertExpression @ chunk-LCAEHM2X.js?v=260afb0c:571
(anonymous) @ chunk-LCAEHM2X.js?v=260afb0c:332
runComputation @ chunk-KHM4YBAW.js?v=260afb0c:733
updateComputation @ chunk-KHM4YBAW.js?v=260afb0c:716
runTop @ chunk-KHM4YBAW.js?v=260afb0c:826
runUserEffects @ chunk-KHM4YBAW.js?v=260afb0c:923
(anonymous) @ chunk-KHM4YBAW.js?v=260afb0c:895
runUpdates @ chunk-KHM4YBAW.js?v=260afb0c:843
completeUpdates @ chunk-KHM4YBAW.js?v=260afb0c:895
runUpdates @ chunk-KHM4YBAW.js?v=260afb0c:844
writeSignal @ chunk-KHM4YBAW.js?v=260afb0c:689
setter @ chunk-KHM4YBAW.js?v=260afb0c:223
handleGoogleSignIn @ Login.tsx:155
await in handleGoogleSignIn
_el$0.$$click @ Login.tsx:705
handleNode @ chunk-LCAEHM2X.js?v=260afb0c:500
eventHandler @ chunk-LCAEHM2X.js?v=260afb0c:521
AuthProvider.tsx:329 [AuthProvider] ========================================
AuthProvider.tsx:330 [AuthProvider] STARTING LOGIN
AuthProvider.tsx:331 [AuthProvider] Identifier: 0Ymnmq7I1oVeeze4tyvKmHi3LN42
AuthProvider.tsx:332 [AuthProvider] Identifier Type: google
AuthProvider.tsx:333 [AuthProvider] Display Name: Marh WIlson
AuthProvider.tsx:334 [AuthProvider] Global Config - Namespace: nostrpass.com
AuthProvider.tsx:335 [AuthProvider] Global Config - Environment: demo
AuthProvider.tsx:336 [AuthProvider] Provider Environment: demo
AuthProvider.tsx:337 [AuthProvider] User Configured: true
AuthProvider.tsx:338 [AuthProvider] Explicit Environment Param: demo
AuthProvider.tsx:339 [AuthProvider] EFFECTIVE Environment: demo
AuthProvider.tsx:340 [AuthProvider] ========================================
AuthProvider.tsx:156 [AuthProvider] Auth state changed from worker: {isAuthenticated: true, isLocked: true, user: {…}, sessionId: 'session_1768435937566_ymmog82lfti', vaultVersion: 0, …}
MessengerProvider.tsx:366 [MessengerProvider] send called: {type: 'VAULT_DATA_UPDATED', data: {…}, messengerReady: true}
index.ts:107 [SecureMessenger] sendMessage called: {type: 'VAULT_DATA_UPDATED', targetOrigin: undefined, verifiedOrigin: 'https://localhost:4000', allowedOrigins: Array(3), isParent: false}
index.ts:141 [SecureMessenger] postMessage: {type: 'VAULT_DATA_UPDATED', origin: 'https://localhost:4000', isParent: false, hasTargetWindow: true}
MessengerProvider.tsx:369 [MessengerProvider] Message sent successfully: VAULT_DATA_UPDATED
Toast.tsx:312 [Toast Success] Logged in successfully: undefined
index.ts:101 🔵 Handler called for route: AUTH_STATUS
handler @ index.ts:101
(anonymous) @ index.ts:374
next @ index.ts:399
(anonymous) @ index.ts:93
next @ index.ts:403
(anonymous) @ index.ts:65
next @ index.ts:403
(anonymous) @ index.ts:49
next @ index.ts:403
(anonymous) @ index.ts:29
next @ index.ts:403
executeMiddlewareChain @ index.ts:406
handleMessage @ index.ts:371
handleMessage @ index.ts:519
(anonymous) @ index.ts:152
postMessage
messenger.sendMessage @ embassy.ts:1102
(anonymous) @ index.ts:70
request @ index.ts:55
getAuthStatus @ embassy.ts:2452
restoreSession @ NostrPassButton.ts:1838
await in restoreSession
(anonymous) @ NostrPassButton.ts:266
VAULT_DATA_UPDATED @ embassyMessageHandlers.ts:123
handleMessage @ index.ts:200
(anonymous) @ index.ts:152
postMessage
sendMessage @ index.ts:142
send @ index.ts:88
send @ MessengerProvider.tsx:368
handleWorkerMessage @ AuthProvider.tsx:181
channel.onmessage @ AuthProvider.tsx:210
authHandlers.ts:696 [AUTH_STATUS] Query from: https://localhost:4000
authHandlers.ts:697 [AUTH_STATUS] Current user: 0Ymnmq7I1oVeeze4tyvKmHi3LN42
authHandlers.ts:698 [AUTH_STATUS] isLocked: true
vaultStore.ts:41 🏪 [VaultStore] getActiveIdentityIndex: {appOrigin: 'localhost-4000', appKey: 'localhost-4000', index: 0, allActiveKeys: Array(0), storageKey: 'undefined...'}
authHandlers.ts:735 [AUTH_STATUS] VaultStore not initialized, reading from localStorage directly
authHandlers.ts:741 [AUTH_STATUS] Active identity lookup: {appKey: 'localhost-4000', activeIdentityIndex: 0, storeInitialized: false, identityExists: false, identityArchived: undefined, …}
index.ts:107 [SecureMessenger] sendMessage called: {type: 'AUTH_STATUS_RESPONSE', targetOrigin: 'https://localhost:4000', verifiedOrigin: 'https://localhost:4000', allowedOrigins: Array(3), isParent: false}
index.ts:141 [SecureMessenger] postMessage: {type: 'AUTH_STATUS_RESPONSE', origin: 'https://localhost:4000', isParent: false, hasTargetWindow: true}
AuthProvider.tsx:378 [AuthProvider] Starting atomic unlock for user: 0Ymnmq7I1oVeeze4tyvKmHi3LN42
AuthProvider.tsx:390 [AuthProvider] Unlock failed: Error: VaultObj not found on Nostr
    at WorkerMessenger.handleResponse (worker-messenger.ts:218:22)
    at MessagePort.handleMessage (worker-messenger.ts:164:12)
unlockVault @ AuthProvider.tsx:390
await in unlockVault
handlePinUnlockSuccess @ Login.tsx:657
handlePinComplete @ PinVerification.tsx:31
(anonymous) @ PinPad.tsx:41
setTimeout
addDigit @ PinPad.tsx:39
_el$7.$$click @ PinPad.tsx:92
handleNode @ chunk-LCAEHM2X.js?v=260afb0c:500
eventHandler @ chunk-LCAEHM2X.js?v=260afb0c:521
Toast.tsx:295 [Toast Error] Unknown Error: An unexpected error occurred. Please try again.
showErrorToast @ Toast.tsx:295
unlockVault @ AuthProvider.tsx:391
await in unlockVault
handlePinUnlockSuccess @ Login.tsx:657
handlePinComplete @ PinVerification.tsx:31
(anonymous) @ PinPad.tsx:41
setTimeout
addDigit @ PinPad.tsx:39
_el$7.$$click @ PinPad.tsx:92
handleNode @ chunk-LCAEHM2X.js?v=260afb0c:500
eventHandler @ chunk-LCAEHM2X.js?v=260afb0c:521
Login.tsx:499 [Login] ========================================
Login.tsx:500 [Login] ATTEMPTING LOGIN
Login.tsx:501 [Login] Username: asdr
Login.tsx:502 [Login] Namespace (from config): nostrpass.com
Login.tsx:503 [Login] Environment (from config): demo
Login.tsx:504 [Login] Environment (from provider): demo
Login.tsx:505 [Login] Has Custom Settings: false
Login.tsx:506 [Login] ========================================
AuthProvider.tsx:329 [AuthProvider] ========================================
AuthProvider.tsx:330 [AuthProvider] STARTING LOGIN
AuthProvider.tsx:331 [AuthProvider] Identifier: asdr
AuthProvider.tsx:332 [AuthProvider] Identifier Type: username
AuthProvider.tsx:333 [AuthProvider] Display Name: undefined
AuthProvider.tsx:334 [AuthProvider] Global Config - Namespace: nostrpass.com
AuthProvider.tsx:335 [AuthProvider] Global Config - Environment: demo
AuthProvider.tsx:336 [AuthProvider] Provider Environment: demo
AuthProvider.tsx:337 [AuthProvider] User Configured: true
AuthProvider.tsx:338 [AuthProvider] Explicit Environment Param: undefined
AuthProvider.tsx:339 [AuthProvider] EFFECTIVE Environment: demo
AuthProvider.tsx:340 [AuthProvider] ========================================
AuthProvider.tsx:156 [AuthProvider] Auth state changed from worker: {isAuthenticated: true, isLocked: true, user: {…}, sessionId: 'session_1768435976696_snt7a9pn4h', vaultVersion: 0, …}
MessengerProvider.tsx:366 [MessengerProvider] send called: {type: 'VAULT_DATA_UPDATED', data: {…}, messengerReady: true}
index.ts:107 [SecureMessenger] sendMessage called: {type: 'VAULT_DATA_UPDATED', targetOrigin: undefined, verifiedOrigin: 'https://localhost:4000', allowedOrigins: Array(3), isParent: false}
index.ts:141 [SecureMessenger] postMessage: {type: 'VAULT_DATA_UPDATED', origin: 'https://localhost:4000', isParent: false, hasTargetWindow: true}
MessengerProvider.tsx:369 [MessengerProvider] Message sent successfully: VAULT_DATA_UPDATED
Toast.tsx:312 [Toast Success] Logged in successfully: undefined
index.ts:101 🔵 Handler called for route: AUTH_STATUS
handler @ index.ts:101
(anonymous) @ index.ts:374
next @ index.ts:399
(anonymous) @ index.ts:93
next @ index.ts:403
(anonymous) @ index.ts:65
next @ index.ts:403
(anonymous) @ index.ts:49
next @ index.ts:403
(anonymous) @ index.ts:29
next @ index.ts:403
executeMiddlewareChain @ index.ts:406
handleMessage @ index.ts:371
handleMessage @ index.ts:519
(anonymous) @ index.ts:152
postMessage
messenger.sendMessage @ embassy.ts:1102
(anonymous) @ index.ts:70
request @ index.ts:55
getAuthStatus @ embassy.ts:2452
restoreSession @ NostrPassButton.ts:1838
await in restoreSession
(anonymous) @ NostrPassButton.ts:266
VAULT_DATA_UPDATED @ embassyMessageHandlers.ts:123
handleMessage @ index.ts:200
(anonymous) @ index.ts:152
postMessage
sendMessage @ index.ts:142
send @ index.ts:88
send @ MessengerProvider.tsx:368
handleWorkerMessage @ AuthProvider.tsx:181
channel.onmessage @ AuthProvider.tsx:210
authHandlers.ts:696 [AUTH_STATUS] Query from: https://localhost:4000
authHandlers.ts:697 [AUTH_STATUS] Current user: asdr
authHandlers.ts:698 [AUTH_STATUS] isLocked: true
vaultStore.ts:41 🏪 [VaultStore] getActiveIdentityIndex: {appOrigin: 'localhost-4000', appKey: 'localhost-4000', index: 0, allActiveKeys: Array(0), storageKey: 'undefined...'}
authHandlers.ts:735 [AUTH_STATUS] VaultStore not initialized, reading from localStorage directly
authHandlers.ts:21 [AUTH_STATUS] Found active identity in localStorage: {key: 'nostrpass:activeIdentity:cd6c9518950e307de379dc8fe…ede16894bf345f094d17bdff068e69bad2:localhost-4000', index: 1}
authHandlers.ts:741 [AUTH_STATUS] Active identity lookup: {appKey: 'localhost-4000', activeIdentityIndex: 1, storeInitialized: false, identityExists: true, identityArchived: undefined, …}
authHandlers.ts:821 [AUTH_STATUS] Returning success response: {isLocked: true, username: 'asdr', authorized: true}
index.ts:107 [SecureMessenger] sendMessage called: {type: 'AUTH_STATUS_RESPONSE', targetOrigin: 'https://localhost:4000', verifiedOrigin: 'https://localhost:4000', allowedOrigins: Array(3), isParent: false}
index.ts:141 [SecureMessenger] postMessage: {type: 'AUTH_STATUS_RESPONSE', origin: 'https://localhost:4000', isParent: false, hasTargetWindow: true}
index.ts:101 🔵 Handler called for route: AUTH_STATUS
handler @ index.ts:101
(anonymous) @ index.ts:374
next @ index.ts:399
(anonymous) @ index.ts:93
next @ index.ts:403
(anonymous) @ index.ts:65
next @ index.ts:403
(anonymous) @ index.ts:49
next @ index.ts:403
(anonymous) @ index.ts:29
next @ index.ts:403
executeMiddlewareChain @ index.ts:406
handleMessage @ index.ts:371
handleMessage @ index.ts:519
(anonymous) @ index.ts:152
postMessage
messenger.sendMessage @ embassy.ts:1102
(anonymous) @ index.ts:70
request @ index.ts:55
getAuthStatus @ embassy.ts:2452
renderUserButton @ NostrPassButton.ts:1029
render @ NostrPassButton.ts:994
restoreSession @ NostrPassButton.ts:1854
await in restoreSession
(anonymous) @ NostrPassButton.ts:266
VAULT_DATA_UPDATED @ embassyMessageHandlers.ts:123
handleMessage @ index.ts:200
(anonymous) @ index.ts:152
postMessage
sendMessage @ index.ts:142
send @ index.ts:88
send @ MessengerProvider.tsx:368
handleWorkerMessage @ AuthProvider.tsx:181
channel.onmessage @ AuthProvider.tsx:210
authHandlers.ts:696 [AUTH_STATUS] Query from: https://localhost:4000
authHandlers.ts:697 [AUTH_STATUS] Current user: asdr
authHandlers.ts:698 [AUTH_STATUS] isLocked: true
vaultStore.ts:41 🏪 [VaultStore] getActiveIdentityIndex: {appOrigin: 'localhost-4000', appKey: 'localhost-4000', index: 0, allActiveKeys: Array(0), storageKey: 'undefined...'}
authHandlers.ts:735 [AUTH_STATUS] VaultStore not initialized, reading from localStorage directly
authHandlers.ts:21 [AUTH_STATUS] Found active identity in localStorage: {key: 'nostrpass:activeIdentity:cd6c9518950e307de379dc8fe…ede16894bf345f094d17bdff068e69bad2:localhost-4000', index: 1}
authHandlers.ts:741 [AUTH_STATUS] Active identity lookup: {appKey: 'localhost-4000', activeIdentityIndex: 1, storeInitialized: false, identityExists: true, identityArchived: undefined, …}
authHandlers.ts:821 [AUTH_STATUS] Returning success response: {isLocked: true, username: 'asdr', authorized: true}
index.ts:107 [SecureMessenger] sendMessage called: {type: 'AUTH_STATUS_RESPONSE', targetOrigin: 'https://localhost:4000', verifiedOrigin: 'https://localhost:4000', allowedOrigins: Array(3), isParent: false}
index.ts:141 [SecureMessenger] postMessage: {type: 'AUTH_STATUS_RESPONSE', origin: 'https://localhost:4000', isParent: false, hasTargetWindow: true}
index.ts:101 🔵 Handler called for route: GET_ALL_IDENTITIES
handler @ index.ts:101
(anonymous) @ index.ts:374
next @ index.ts:399
(anonymous) @ index.ts:93
next @ index.ts:403
(anonymous) @ index.ts:65
next @ index.ts:403
(anonymous) @ index.ts:49
next @ index.ts:403
(anonymous) @ index.ts:29
next @ index.ts:403
executeMiddlewareChain @ index.ts:406
handleMessage @ index.ts:371
handleMessage @ index.ts:519
(anonymous) @ index.ts:152
postMessage
messenger.sendMessage @ embassy.ts:1102
(anonymous) @ index.ts:70
request @ index.ts:55
getAllIdentities @ embassy.ts:2467
renderUserButton @ NostrPassButton.ts:1036
await in renderUserButton
render @ NostrPassButton.ts:994
restoreSession @ NostrPassButton.ts:1854
await in restoreSession
(anonymous) @ NostrPassButton.ts:266
VAULT_DATA_UPDATED @ embassyMessageHandlers.ts:123
handleMessage @ index.ts:200
(anonymous) @ index.ts:152
postMessage
sendMessage @ index.ts:142
send @ index.ts:88
send @ MessengerProvider.tsx:368
handleWorkerMessage @ AuthProvider.tsx:181
channel.onmessage @ AuthProvider.tsx:210
vaultStore.ts:41 🏪 [VaultStore] getActiveIdentityIndex: {appOrigin: 'localhost-4000', appKey: 'localhost-4000', index: 0, allActiveKeys: Array(0), storageKey: 'undefined...'}
index.ts:107 [SecureMessenger] sendMessage called: {type: 'GET_ALL_IDENTITIES_RESPONSE', targetOrigin: 'https://localhost:4000', verifiedOrigin: 'https://localhost:4000', allowedOrigins: Array(3), isParent: false}
index.ts:141 [SecureMessenger] postMessage: {type: 'GET_ALL_IDENTITIES_RESPONSE', origin: 'https://localhost:4000', isParent: false, hasTargetWindow: true}
AuthProvider.tsx:378 [AuthProvider] Starting atomic unlock for user: asdr
AuthProvider.tsx:156 [AuthProvider] Auth state changed from worker: {isAuthenticated: true, isLocked: false, user: {…}, sessionId: 'session_1768435976696_snt7a9pn4h', vaultVersion: 2, …}
MessengerProvider.tsx:366 [MessengerProvider] send called: {type: 'VAULT_DATA_UPDATED', data: {…}, messengerReady: true}
index.ts:107 [SecureMessenger] sendMessage called: {type: 'VAULT_DATA_UPDATED', targetOrigin: undefined, verifiedOrigin: 'https://localhost:4000', allowedOrigins: Array(3), isParent: false}
index.ts:141 [SecureMessenger] postMessage: {type: 'VAULT_DATA_UPDATED', origin: 'https://localhost:4000', isParent: false, hasTargetWindow: true}
MessengerProvider.tsx:369 [MessengerProvider] Message sent successfully: VAULT_DATA_UPDATED
Toast.tsx:312 [Toast Success] Vault unlocked: undefined
AccountPickerPage.tsx:42 [AccountPickerPage] Component mounted, loading identities...
AccountPickerPage.tsx:43 [AccountPickerPage] Query params: {appOrigin: 'localhost-4000', appName: 'localhost-4000', requestId: undefined}
AccountPickerPage.tsx:51 [AccountPickerPage] Current user: {publicKey: '152bd43a3c531e4ee02b3ad7cc22bac730889043aa270bef69d211a4f9d84c72', privateKey: '', storagePublicKey: 'cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2', username: 'asdr', displayName: 'asdr', …}
AccountPickerPage.tsx:62 [AccountPickerPage] Vault locked? false
AccountPickerPage.tsx:84 [AccountPickerPage] Sanitized appKey: localhost-4000
AccountPickerPage.tsx:90 [AccountPickerPage] Fetching vault data for: cd6c9518950e...
AccountPickerPage.tsx:92 [AccountPickerPage] Vault data received: {username: 'asdr', publicKey: 'cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2', salt: '339dc97e6cc8db3f4d826fa0b26ff123b069a4fc7663e066396c90e3f5284a9a', passwordSalt: '2c3dde55496089d51f8d9318e6c3b873fef803b8f59ad2a63eeeb203e79fe56b', passwordVerifier: undefined, …}
AccountPickerPage.tsx:95 [AccountPickerPage] Found 3 identities
AccountPickerPage.tsx:105 [AccountPickerPage] Processed identities: (3) [{…}, {…}, {…}]
AccountPickerPage.tsx:111 [AccountPickerPage] Identities set successfully, loading set to false in batch
AccountPickerPage.tsx:135 [AccountPickerPage] Loading complete, setting loading to false
AccountPickerPage.tsx:139 [AccountPickerPage] After setTimeout - loading(): false identities().length: 3
index.ts:101 🔵 Handler called for route: GET_ALL_IDENTITIES
handler @ index.ts:101
(anonymous) @ index.ts:374
next @ index.ts:399
(anonymous) @ index.ts:93
next @ index.ts:403
(anonymous) @ index.ts:65
next @ index.ts:403
(anonymous) @ index.ts:49
next @ index.ts:403
(anonymous) @ index.ts:29
next @ index.ts:403
executeMiddlewareChain @ index.ts:406
handleMessage @ index.ts:371
handleMessage @ index.ts:519
(anonymous) @ index.ts:152
postMessage
messenger.sendMessage @ embassy.ts:1102
(anonymous) @ index.ts:70
request @ index.ts:55
getAllIdentities @ embassy.ts:2467
(anonymous) @ NostrPassButton.ts:159
await in (anonymous)
VAULT_DATA_UPDATED @ embassyMessageHandlers.ts:123
handleMessage @ index.ts:200
(anonymous) @ index.ts:152
postMessage
sendMessage @ index.ts:142
send @ index.ts:88
send @ MessengerProvider.tsx:368
handleWorkerMessage @ AuthProvider.tsx:181
channel.onmessage @ AuthProvider.tsx:210
vaultStore.ts:41 🏪 [VaultStore] getActiveIdentityIndex: {appOrigin: 'localhost-4000', appKey: 'localhost-4000', index: 0, allActiveKeys: Array(0), storageKey: 'undefined...'}
index.ts:107 [SecureMessenger] sendMessage called: {type: 'GET_ALL_IDENTITIES_RESPONSE', targetOrigin: 'https://localhost:4000', verifiedOrigin: 'https://localhost:4000', allowedOrigins: Array(3), isParent: false}
index.ts:141 [SecureMessenger] postMessage: {type: 'GET_ALL_IDENTITIES_RESPONSE', origin: 'https://localhost:4000', isParent: false, hasTargetWindow: true}
index.ts:101 🔵 Handler called for route: AUTH_STATUS
handler @ index.ts:101
(anonymous) @ index.ts:374
next @ index.ts:399
(anonymous) @ index.ts:93
next @ index.ts:403
(anonymous) @ index.ts:65
next @ index.ts:403
(anonymous) @ index.ts:49
next @ index.ts:403
(anonymous) @ index.ts:29
next @ index.ts:403
executeMiddlewareChain @ index.ts:406
handleMessage @ index.ts:371
handleMessage @ index.ts:519
(anonymous) @ index.ts:152
postMessage
messenger.sendMessage @ embassy.ts:1102
(anonymous) @ index.ts:70
request @ index.ts:55
getAuthStatus @ embassy.ts:2452
renderUserButton @ NostrPassButton.ts:1029
render @ NostrPassButton.ts:994
(anonymous) @ NostrPassButton.ts:237
await in (anonymous)
VAULT_DATA_UPDATED @ embassyMessageHandlers.ts:123
handleMessage @ index.ts:200
(anonymous) @ index.ts:152
postMessage
sendMessage @ index.ts:142
send @ index.ts:88
send @ MessengerProvider.tsx:368
handleWorkerMessage @ AuthProvider.tsx:181
channel.onmessage @ AuthProvider.tsx:210
authHandlers.ts:696 [AUTH_STATUS] Query from: https://localhost:4000
authHandlers.ts:697 [AUTH_STATUS] Current user: asdr
authHandlers.ts:698 [AUTH_STATUS] isLocked: false
vaultStore.ts:41 🏪 [VaultStore] getActiveIdentityIndex: {appOrigin: 'localhost-4000', appKey: 'localhost-4000', index: 0, allActiveKeys: Array(0), storageKey: 'undefined...'}
authHandlers.ts:735 [AUTH_STATUS] VaultStore not initialized, reading from localStorage directly
authHandlers.ts:21 [AUTH_STATUS] Found active identity in localStorage: {key: 'nostrpass:activeIdentity:cd6c9518950e307de379dc8fe…ede16894bf345f094d17bdff068e69bad2:localhost-4000', index: 1}
authHandlers.ts:741 [AUTH_STATUS] Active identity lookup: {appKey: 'localhost-4000', activeIdentityIndex: 1, storeInitialized: false, identityExists: true, identityArchived: undefined, …}
authHandlers.ts:821 [AUTH_STATUS] Returning success response: {isLocked: false, username: 'asdr', authorized: true}
index.ts:107 [SecureMessenger] sendMessage called: {type: 'AUTH_STATUS_RESPONSE', targetOrigin: 'https://localhost:4000', verifiedOrigin: 'https://localhost:4000', allowedOrigins: Array(3), isParent: false}
index.ts:141 [SecureMessenger] postMessage: {type: 'AUTH_STATUS_RESPONSE', origin: 'https://localhost:4000', isParent: false, hasTargetWindow: true}
index.ts:101 🔵 Handler called for route: GET_ALL_IDENTITIES
handler @ index.ts:101
(anonymous) @ index.ts:374
next @ index.ts:399
(anonymous) @ index.ts:93
next @ index.ts:403
(anonymous) @ index.ts:65
next @ index.ts:403
(anonymous) @ index.ts:49
next @ index.ts:403
(anonymous) @ index.ts:29
next @ index.ts:403
executeMiddlewareChain @ index.ts:406
handleMessage @ index.ts:371
handleMessage @ index.ts:519
(anonymous) @ index.ts:152
postMessage
messenger.sendMessage @ embassy.ts:1102
(anonymous) @ index.ts:70
request @ index.ts:55
getAllIdentities @ embassy.ts:2467
renderUserButton @ NostrPassButton.ts:1036
await in renderUserButton
render @ NostrPassButton.ts:994
(anonymous) @ NostrPassButton.ts:237
await in (anonymous)
VAULT_DATA_UPDATED @ embassyMessageHandlers.ts:123
handleMessage @ index.ts:200
(anonymous) @ index.ts:152
postMessage
sendMessage @ index.ts:142
send @ index.ts:88
send @ MessengerProvider.tsx:368
handleWorkerMessage @ AuthProvider.tsx:181
channel.onmessage @ AuthProvider.tsx:210
vaultStore.ts:41 🏪 [VaultStore] getActiveIdentityIndex: {appOrigin: 'localhost-4000', appKey: 'localhost-4000', index: 0, allActiveKeys: Array(0), storageKey: 'undefined...'}
index.ts:107 [SecureMessenger] sendMessage called: {type: 'GET_ALL_IDENTITIES_RESPONSE', targetOrigin: 'https://localhost:4000', verifiedOrigin: 'https://localhost:4000', allowedOrigins: Array(3), isParent: false}
index.ts:141 [SecureMessenger] postMessage: {type: 'GET_ALL_IDENTITIES_RESPONSE', origin: 'https://localhost:4000', isParent: false, hasTargetWindow: true}
AccountPickerPage.tsx:159 [AccountPickerPage] handleSelect called: {identityIndex: 1, selectedPublicKey: '9e7dd4dc92f1aa61b2b84a8394bbde6e42aefa361eab9d82abb211b499697726', isAuthorized: true, selectedIdentityData: {…}}
vaultStore.ts:71 🏪 [VaultStore] Store not initialized, using fallback storage key
vaultStore.ts:92 🏪 [VaultStore] Setting active identity: {appKey: 'localhost-4000', index: 1, storageKey: 'cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2'}
index.ts:107 [SecureMessenger] sendMessage called: {type: 'IDENTITY_SWITCHED', targetOrigin: undefined, verifiedOrigin: 'https://localhost:4000', allowedOrigins: Array(3), isParent: false}
index.ts:141 [SecureMessenger] postMessage: {type: 'IDENTITY_SWITCHED', origin: 'https://localhost:4000', isParent: false, hasTargetWindow: true}
vaultStore.ts:112 🏪 [VaultStore] Sent IDENTITY_SWITCHED to embassy: {appKey: 'localhost-4000', index: 1}
AccountPickerPage.tsx:174 [AccountPickerPage] Updated active identity via vaultStore: {appKey: 'localhost-4000', identityIndex: 1, lookupKey: 'cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2'}
MessengerProvider.tsx:366 [MessengerProvider] send called: {type: 'VAULT_DATA_UPDATED', data: {…}, messengerReady: true}
index.ts:107 [SecureMessenger] sendMessage called: {type: 'VAULT_DATA_UPDATED', targetOrigin: undefined, verifiedOrigin: 'https://localhost:4000', allowedOrigins: Array(3), isParent: false}
index.ts:141 [SecureMessenger] postMessage: {type: 'VAULT_DATA_UPDATED', origin: 'https://localhost:4000', isParent: false, hasTargetWindow: true}
MessengerProvider.tsx:369 [MessengerProvider] Message sent successfully: VAULT_DATA_UPDATED
AccountPickerPage.tsx:216 [AccountPickerPage] Identity already authorized, sending HIDE_VAULT
MessengerProvider.tsx:366 [MessengerProvider] send called: {type: 'HIDE_VAULT', data: undefined, messengerReady: true}
index.ts:107 [SecureMessenger] sendMessage called: {type: 'HIDE_VAULT', targetOrigin: undefined, verifiedOrigin: 'https://localhost:4000', allowedOrigins: Array(3), isParent: false}
index.ts:141 [SecureMessenger] postMessage: {type: 'HIDE_VAULT', origin: 'https://localhost:4000', isParent: false, hasTargetWindow: true}
MessengerProvider.tsx:369 [MessengerProvider] Message sent successfully: HIDE_VAULT
index.ts:101 🔵 Handler called for route: GET_ALL_IDENTITIES
handler @ index.ts:101
(anonymous) @ index.ts:374
next @ index.ts:399
(anonymous) @ index.ts:93
next @ index.ts:403
(anonymous) @ index.ts:65
next @ index.ts:403
(anonymous) @ index.ts:49
next @ index.ts:403
(anonymous) @ index.ts:29
next @ index.ts:403
executeMiddlewareChain @ index.ts:406
handleMessage @ index.ts:371
handleMessage @ index.ts:519
(anonymous) @ index.ts:152
postMessage
messenger.sendMessage @ embassy.ts:1102
(anonymous) @ index.ts:70
request @ index.ts:55
getAllIdentities @ embassy.ts:2467
(anonymous) @ NostrPassButton.ts:285
IDENTITY_SWITCHED @ embassyMessageHandlers.ts:130
handleMessage @ index.ts:200
(anonymous) @ index.ts:152
postMessage
sendMessage @ index.ts:142
send @ index.ts:88
setActiveIdentityIndex @ vaultStore.ts:106
await in setActiveIdentityIndex
handleSelect @ AccountPickerPage.tsx:173
handleSelect @ AccountPicker.tsx:40
handleNode @ chunk-LCAEHM2X.js?v=260afb0c:500
eventHandler @ chunk-LCAEHM2X.js?v=260afb0c:521
MessengerProvider.tsx:170 Hide vault response handled: {acknowledged: true}
vaultStore.ts:41 🏪 [VaultStore] getActiveIdentityIndex: {appOrigin: 'localhost-4000', appKey: 'localhost-4000', index: 1, allActiveKeys: Array(1), storageKey: 'undefined...'}
index.ts:107 [SecureMessenger] sendMessage called: {type: 'GET_ALL_IDENTITIES_RESPONSE', targetOrigin: 'https://localhost:4000', verifiedOrigin: 'https://localhost:4000', allowedOrigins: Array(3), isParent: false}
index.ts:141 [SecureMessenger] postMessage: {type: 'GET_ALL_IDENTITIES_RESPONSE', origin: 'https://localhost:4000', isParent: false, hasTargetWindow: true}
index.ts:101 🔵 Handler called for route: AUTH_STATUS
handler @ index.ts:101
(anonymous) @ index.ts:374
next @ index.ts:399
(anonymous) @ index.ts:93
next @ index.ts:403
(anonymous) @ index.ts:65
next @ index.ts:403
(anonymous) @ index.ts:49
next @ index.ts:403
(anonymous) @ index.ts:29
next @ index.ts:403
executeMiddlewareChain @ index.ts:406
handleMessage @ index.ts:371
handleMessage @ index.ts:519
(anonymous) @ index.ts:152
postMessage
messenger.sendMessage @ embassy.ts:1102
(anonymous) @ index.ts:70
request @ index.ts:55
getAuthStatus @ embassy.ts:2452
renderUserButton @ NostrPassButton.ts:1029
render @ NostrPassButton.ts:994
(anonymous) @ NostrPassButton.ts:305
await in (anonymous)
IDENTITY_SWITCHED @ embassyMessageHandlers.ts:130
handleMessage @ index.ts:200
(anonymous) @ index.ts:152
postMessage
sendMessage @ index.ts:142
send @ index.ts:88
setActiveIdentityIndex @ vaultStore.ts:106
await in setActiveIdentityIndex
handleSelect @ AccountPickerPage.tsx:173
handleSelect @ AccountPicker.tsx:40
handleNode @ chunk-LCAEHM2X.js?v=260afb0c:500
eventHandler @ chunk-LCAEHM2X.js?v=260afb0c:521
authHandlers.ts:696 [AUTH_STATUS] Query from: https://localhost:4000
authHandlers.ts:697 [AUTH_STATUS] Current user: asdr
authHandlers.ts:698 [AUTH_STATUS] isLocked: false
vaultStore.ts:41 🏪 [VaultStore] getActiveIdentityIndex: {appOrigin: 'localhost-4000', appKey: 'localhost-4000', index: 1, allActiveKeys: Array(1), storageKey: 'undefined...'}
authHandlers.ts:735 [AUTH_STATUS] VaultStore not initialized, reading from localStorage directly
authHandlers.ts:21 [AUTH_STATUS] Found active identity in localStorage: {key: 'nostrpass:activeIdentity:cd6c9518950e307de379dc8fe…ede16894bf345f094d17bdff068e69bad2:localhost-4000', index: 1}
authHandlers.ts:741 [AUTH_STATUS] Active identity lookup: {appKey: 'localhost-4000', activeIdentityIndex: 1, storeInitialized: false, identityExists: true, identityArchived: undefined, …}
authHandlers.ts:821 [AUTH_STATUS] Returning success response: {isLocked: false, username: 'asdr', authorized: true}
index.ts:107 [SecureMessenger] sendMessage called: {type: 'AUTH_STATUS_RESPONSE', targetOrigin: 'https://localhost:4000', verifiedOrigin: 'https://localhost:4000', allowedOrigins: Array(3), isParent: false}
index.ts:141 [SecureMessenger] postMessage: {type: 'AUTH_STATUS_RESPONSE', origin: 'https://localhost:4000', isParent: false, hasTargetWindow: true}
index.ts:101 🔵 Handler called for route: GET_ALL_IDENTITIES
handler @ index.ts:101
(anonymous) @ index.ts:374
next @ index.ts:399
(anonymous) @ index.ts:93
next @ index.ts:403
(anonymous) @ index.ts:65
next @ index.ts:403
(anonymous) @ index.ts:49
next @ index.ts:403
(anonymous) @ index.ts:29
next @ index.ts:403
executeMiddlewareChain @ index.ts:406
handleMessage @ index.ts:371
handleMessage @ index.ts:519
(anonymous) @ index.ts:152
postMessage
messenger.sendMessage @ embassy.ts:1102
(anonymous) @ index.ts:70
request @ index.ts:55
getAllIdentities @ embassy.ts:2467
renderUserButton @ NostrPassButton.ts:1036
await in renderUserButton
render @ NostrPassButton.ts:994
(anonymous) @ NostrPassButton.ts:305
await in (anonymous)
IDENTITY_SWITCHED @ embassyMessageHandlers.ts:130
handleMessage @ index.ts:200
(anonymous) @ index.ts:152
postMessage
sendMessage @ index.ts:142
send @ index.ts:88
setActiveIdentityIndex @ vaultStore.ts:106
await in setActiveIdentityIndex
handleSelect @ AccountPickerPage.tsx:173
handleSelect @ AccountPicker.tsx:40
handleNode @ chunk-LCAEHM2X.js?v=260afb0c:500
eventHandler @ chunk-LCAEHM2X.js?v=260afb0c:521
vaultStore.ts:41 🏪 [VaultStore] getActiveIdentityIndex: {appOrigin: 'localhost-4000', appKey: 'localhost-4000', index: 1, allActiveKeys: Array(1), storageKey: 'undefined...'}
index.ts:107 [SecureMessenger] sendMessage called: {type: 'GET_ALL_IDENTITIES_RESPONSE', targetOrigin: 'https://localhost:4000', verifiedOrigin: 'https://localhost:4000', allowedOrigins: Array(3), isParent: false}
index.ts:141 [SecureMessenger] postMessage: {type: 'GET_ALL_IDENTITIES_RESPONSE', origin: 'https://localhost:4000', isParent: false, hasTargetWindow: true}
index.ts:101 🔵 Handler called for route: GET_ALL_IDENTITIES
handler @ index.ts:101
(anonymous) @ index.ts:374
next @ index.ts:399
(anonymous) @ index.ts:93
next @ index.ts:403
(anonymous) @ index.ts:65
next @ index.ts:403
(anonymous) @ index.ts:49
next @ index.ts:403
(anonymous) @ index.ts:29
next @ index.ts:403
executeMiddlewareChain @ index.ts:406
handleMessage @ index.ts:371
handleMessage @ index.ts:519
(anonymous) @ index.ts:152
postMessage
messenger.sendMessage @ embassy.ts:1102
(anonymous) @ index.ts:70
request @ index.ts:55
getAllIdentities @ embassy.ts:2467
(anonymous) @ NostrPassButton.ts:159
await in (anonymous)
VAULT_DATA_UPDATED @ embassyMessageHandlers.ts:123
handleMessage @ index.ts:200
(anonymous) @ index.ts:152
postMessage
sendMessage @ index.ts:142
send @ index.ts:88
send @ MessengerProvider.tsx:368
handleSelect @ AccountPickerPage.tsx:177
await in handleSelect
handleSelect @ AccountPicker.tsx:40
handleNode @ chunk-LCAEHM2X.js?v=260afb0c:500
eventHandler @ chunk-LCAEHM2X.js?v=260afb0c:521
vaultStore.ts:41 🏪 [VaultStore] getActiveIdentityIndex: {appOrigin: 'localhost-4000', appKey: 'localhost-4000', index: 1, allActiveKeys: Array(1), storageKey: 'undefined...'}
index.ts:107 [SecureMessenger] sendMessage called: {type: 'GET_ALL_IDENTITIES_RESPONSE', targetOrigin: 'https://localhost:4000', verifiedOrigin: 'https://localhost:4000', allowedOrigins: Array(3), isParent: false}
index.ts:141 [SecureMessenger] postMessage: {type: 'GET_ALL_IDENTITIES_RESPONSE', origin: 'https://localhost:4000', isParent: false, hasTargetWindow: true}
index.ts:101 🔵 Handler called for route: AUTH_STATUS
handler @ index.ts:101
(anonymous) @ index.ts:374
next @ index.ts:399
(anonymous) @ index.ts:93
next @ index.ts:403
(anonymous) @ index.ts:65
next @ index.ts:403
(anonymous) @ index.ts:49
next @ index.ts:403
(anonymous) @ index.ts:29
next @ index.ts:403
executeMiddlewareChain @ index.ts:406
handleMessage @ index.ts:371
handleMessage @ index.ts:519
(anonymous) @ index.ts:152
postMessage
messenger.sendMessage @ embassy.ts:1102
(anonymous) @ index.ts:70
request @ index.ts:55
getAuthStatus @ embassy.ts:2452
renderUserButton @ NostrPassButton.ts:1029
render @ NostrPassButton.ts:994
(anonymous) @ NostrPassButton.ts:237
await in (anonymous)
VAULT_DATA_UPDATED @ embassyMessageHandlers.ts:123
handleMessage @ index.ts:200
(anonymous) @ index.ts:152
postMessage
sendMessage @ index.ts:142
send @ index.ts:88
send @ MessengerProvider.tsx:368
handleSelect @ AccountPickerPage.tsx:177
await in handleSelect
handleSelect @ AccountPicker.tsx:40
handleNode @ chunk-LCAEHM2X.js?v=260afb0c:500
eventHandler @ chunk-LCAEHM2X.js?v=260afb0c:521
authHandlers.ts:696 [AUTH_STATUS] Query from: https://localhost:4000
authHandlers.ts:697 [AUTH_STATUS] Current user: asdr
authHandlers.ts:698 [AUTH_STATUS] isLocked: false
vaultStore.ts:41 🏪 [VaultStore] getActiveIdentityIndex: {appOrigin: 'localhost-4000', appKey: 'localhost-4000', index: 1, allActiveKeys: Array(1), storageKey: 'undefined...'}
authHandlers.ts:735 [AUTH_STATUS] VaultStore not initialized, reading from localStorage directly
authHandlers.ts:21 [AUTH_STATUS] Found active identity in localStorage: {key: 'nostrpass:activeIdentity:cd6c9518950e307de379dc8fe…ede16894bf345f094d17bdff068e69bad2:localhost-4000', index: 1}
authHandlers.ts:741 [AUTH_STATUS] Active identity lookup: {appKey: 'localhost-4000', activeIdentityIndex: 1, storeInitialized: false, identityExists: true, identityArchived: undefined, …}
authHandlers.ts:821 [AUTH_STATUS] Returning success response: {isLocked: false, username: 'asdr', authorized: true}
index.ts:107 [SecureMessenger] sendMessage called: {type: 'AUTH_STATUS_RESPONSE', targetOrigin: 'https://localhost:4000', verifiedOrigin: 'https://localhost:4000', allowedOrigins: Array(3), isParent: false}
index.ts:141 [SecureMessenger] postMessage: {type: 'AUTH_STATUS_RESPONSE', origin: 'https://localhost:4000', isParent: false, hasTargetWindow: true}
index.ts:101 🔵 Handler called for route: GET_ALL_IDENTITIES
handler @ index.ts:101
(anonymous) @ index.ts:374
next @ index.ts:399
(anonymous) @ index.ts:93
next @ index.ts:403
(anonymous) @ index.ts:65
next @ index.ts:403
(anonymous) @ index.ts:49
next @ index.ts:403
(anonymous) @ index.ts:29
next @ index.ts:403
executeMiddlewareChain @ index.ts:406
handleMessage @ index.ts:371
handleMessage @ index.ts:519
(anonymous) @ index.ts:152
postMessage
messenger.sendMessage @ embassy.ts:1102
(anonymous) @ index.ts:70
request @ index.ts:55
getAllIdentities @ embassy.ts:2467
renderUserButton @ NostrPassButton.ts:1036
await in renderUserButton
render @ NostrPassButton.ts:994
(anonymous) @ NostrPassButton.ts:237
await in (anonymous)
VAULT_DATA_UPDATED @ embassyMessageHandlers.ts:123
handleMessage @ index.ts:200
(anonymous) @ index.ts:152
postMessage
sendMessage @ index.ts:142
send @ index.ts:88
send @ MessengerProvider.tsx:368
handleSelect @ AccountPickerPage.tsx:177
await in handleSelect
handleSelect @ AccountPicker.tsx:40
handleNode @ chunk-LCAEHM2X.js?v=260afb0c:500
eventHandler @ chunk-LCAEHM2X.js?v=260afb0c:521
vaultStore.ts:41 🏪 [VaultStore] getActiveIdentityIndex: {appOrigin: 'localhost-4000', appKey: 'localhost-4000', index: 1, allActiveKeys: Array(1), storageKey: 'undefined...'}
index.ts:107 [SecureMessenger] sendMessage called: {type: 'GET_ALL_IDENTITIES_RESPONSE', targetOrigin: 'https://localhost:4000', verifiedOrigin: 'https://localhost:4000', allowedOrigins: Array(3), isParent: false}
index.ts:141 [SecureMessenger] postMessage: {type: 'GET_ALL_IDENTITIES_RESPONSE', origin: 'https://localhost:4000', isParent: false, hasTargetWindow: true}
index.ts:101 🔵 Handler called for route: AUTH_STATUS
handler @ index.ts:101
(anonymous) @ index.ts:374
next @ index.ts:399
(anonymous) @ index.ts:93
next @ index.ts:403
(anonymous) @ index.ts:65
next @ index.ts:403
(anonymous) @ index.ts:49
next @ index.ts:403
(anonymous) @ index.ts:29
next @ index.ts:403
executeMiddlewareChain @ index.ts:406
handleMessage @ index.ts:371
handleMessage @ index.ts:519
(anonymous) @ index.ts:152
postMessage
messenger.sendMessage @ embassy.ts:1102
(anonymous) @ index.ts:70
request @ index.ts:55
getAuthStatus @ embassy.ts:2452
toggleDropdown @ NostrPassButton.ts:1479
(anonymous) @ NostrPassButton.ts:1192
authHandlers.ts:696 [AUTH_STATUS] Query from: https://localhost:4000
authHandlers.ts:697 [AUTH_STATUS] Current user: asdr
authHandlers.ts:698 [AUTH_STATUS] isLocked: false
vaultStore.ts:41 🏪 [VaultStore] getActiveIdentityIndex: {appOrigin: 'localhost-4000', appKey: 'localhost-4000', index: 1, allActiveKeys: Array(1), storageKey: 'undefined...'}
authHandlers.ts:735 [AUTH_STATUS] VaultStore not initialized, reading from localStorage directly
authHandlers.ts:21 [AUTH_STATUS] Found active identity in localStorage: {key: 'nostrpass:activeIdentity:cd6c9518950e307de379dc8fe…ede16894bf345f094d17bdff068e69bad2:localhost-4000', index: 1}
authHandlers.ts:741 [AUTH_STATUS] Active identity lookup: {appKey: 'localhost-4000', activeIdentityIndex: 1, storeInitialized: false, identityExists: true, identityArchived: undefined, …}
authHandlers.ts:821 [AUTH_STATUS] Returning success response: {isLocked: false, username: 'asdr', authorized: true}
index.ts:107 [SecureMessenger] sendMessage called: {type: 'AUTH_STATUS_RESPONSE', targetOrigin: 'https://localhost:4000', verifiedOrigin: 'https://localhost:4000', allowedOrigins: Array(3), isParent: false}
index.ts:141 [SecureMessenger] postMessage: {type: 'AUTH_STATUS_RESPONSE', origin: 'https://localhost:4000', isParent: false, hasTargetWindow: true}
vaultHandlers.ts:50 [NAVIGATE] Received navigation request: {path: '/localhost-4000/dashboard'}
vaultHandlers.ts:61 [NAVIGATE] Navigated to: /localhost-4000/dashboard
vaultStore.ts:41 🏪 [VaultStore] getActiveIdentityIndex: {appOrigin: 'localhost-4000', appKey: 'localhost-4000', index: 1, allActiveKeys: Array(1), storageKey: 'undefined...'}
Dashboard.tsx:37 [Dashboard] activeIdentityIndex memo: {appKey: 'localhost-4000', index: 1}
useVaultData.ts:30 🔄 [useVaultData] Initializing vault store for: cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2
vaultStore.ts:247 🏪 [VaultStore] Initializing for storage key: cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2
vaultStore.ts:159 🏪 [VaultStore] Loaded active identities from localStorage: {localhost-4000: 1}
vaultStore.ts:297 🏪 [VaultStore] BroadcastChannel listener set up
useVaultData.ts:36 🔄 [useVaultData] loadVaultData called, delegating to store.reload()
vaultStore.ts:366 🏪 [VaultStore] Force reloading vault data
useVaultData.ts:186 🔧 Setting up vault data refresh listener
useVaultData.ts:204 ✅ Vault data refresh listener set up
useVaultData.ts:256 🔔 [useVaultData] Ready for Nostr subscription setup
useVaultData.ts:30 🔄 [useVaultData] Initializing vault store for: cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2
vaultStore.ts:247 🏪 [VaultStore] Initializing for storage key: cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2
vaultStore.ts:159 🏪 [VaultStore] Loaded active identities from localStorage: {localhost-4000: 1}
useVaultData.ts:36 🔄 [useVaultData] loadVaultData called, delegating to store.reload()
vaultStore.ts:366 🏪 [VaultStore] Force reloading vault data
useVaultData.ts:186 🔧 Setting up vault data refresh listener
useVaultData.ts:204 ✅ Vault data refresh listener set up
useVaultData.ts:256 🔔 [useVaultData] Ready for Nostr subscription setup
vaultStore.ts:41 🏪 [VaultStore] getActiveIdentityIndex: {appOrigin: 'localhost-4000', appKey: 'localhost-4000', index: 1, allActiveKeys: Array(1), storageKey: 'cd6c9518950e...'}
Dashboard.tsx:37 [Dashboard] activeIdentityIndex memo: {appKey: 'localhost-4000', index: 1}
index.ts:107 [SecureMessenger] sendMessage called: {type: 'NAVIGATE_RESPONSE', targetOrigin: 'https://localhost:4000', verifiedOrigin: 'https://localhost:4000', allowedOrigins: Array(3), isParent: false}
index.ts:141 [SecureMessenger] postMessage: {type: 'NAVIGATE_RESPONSE', origin: 'https://localhost:4000', isParent: false, hasTargetWindow: true}
vaultStore.ts:341 🏪 [VaultStore] Loaded vault data: {username: 'cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2', identitiesCount: 3, version: 2, updatedAt: 1768435805872, firstIdentityApps: Array(1), …}
vaultStore.ts:41 🏪 [VaultStore] getActiveIdentityIndex: {appOrigin: 'localhost-4000', appKey: 'localhost-4000', index: 1, allActiveKeys: Array(1), storageKey: 'cd6c9518950e...'}
vaultStore.ts:41 🏪 [VaultStore] getActiveIdentityIndex: {appOrigin: 'localhost-4000', appKey: 'localhost-4000', index: 1, allActiveKeys: Array(1), storageKey: 'cd6c9518950e...'}
Dashboard.tsx:53 [Dashboard] Auto-fetching Nostr profiles for 3 identities
nostrProfileService.ts:49 [NostrProfile] Fetching profile for 152bd43a from relays
nostrProfileService.ts:49 [NostrProfile] Fetching profile for 9e7dd4dc from relays
nostrProfileService.ts:49 [NostrProfile] Fetching profile for 2025cd71 from relays
vaultStore.ts:341 🏪 [VaultStore] Loaded vault data: {username: 'cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2', identitiesCount: 3, version: 2, updatedAt: 1768435805872, firstIdentityApps: Array(1), …}
vaultStore.ts:41 🏪 [VaultStore] getActiveIdentityIndex: {appOrigin: 'localhost-4000', appKey: 'localhost-4000', index: 1, allActiveKeys: Array(1), storageKey: 'cd6c9518950e...'}
vaultStore.ts:41 🏪 [VaultStore] getActiveIdentityIndex: {appOrigin: 'localhost-4000', appKey: 'localhost-4000', index: 1, allActiveKeys: Array(1), storageKey: 'cd6c9518950e...'}
Dashboard.tsx:53 [Dashboard] Auto-fetching Nostr profiles for 3 identities
nostrProfileService.ts:49 [NostrProfile] Fetching profile for 152bd43a from relays
nostrProfileService.ts:49 [NostrProfile] Fetching profile for 9e7dd4dc from relays
nostrProfileService.ts:49 [NostrProfile] Fetching profile for 2025cd71 from relays
vaultStore.ts:341 🏪 [VaultStore] Loaded vault data: {username: 'cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2', identitiesCount: 3, version: 2, updatedAt: 1768435805872, firstIdentityApps: Array(1), …}
vaultStore.ts:41 🏪 [VaultStore] getActiveIdentityIndex: {appOrigin: 'localhost-4000', appKey: 'localhost-4000', index: 1, allActiveKeys: Array(1), storageKey: 'cd6c9518950e...'}
vaultStore.ts:41 🏪 [VaultStore] getActiveIdentityIndex: {appOrigin: 'localhost-4000', appKey: 'localhost-4000', index: 1, allActiveKeys: Array(1), storageKey: 'cd6c9518950e...'}
Dashboard.tsx:53 [Dashboard] Auto-fetching Nostr profiles for 3 identities
nostrProfileService.ts:49 [NostrProfile] Fetching profile for 152bd43a from relays
nostrProfileService.ts:49 [NostrProfile] Fetching profile for 9e7dd4dc from relays
nostrProfileService.ts:49 [NostrProfile] Fetching profile for 2025cd71 from relays
vaultStore.ts:341 🏪 [VaultStore] Loaded vault data: {username: 'cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2', identitiesCount: 3, version: 2, updatedAt: 1768435805872, firstIdentityApps: Array(1), …}
vaultStore.ts:41 🏪 [VaultStore] getActiveIdentityIndex: {appOrigin: 'localhost-4000', appKey: 'localhost-4000', index: 1, allActiveKeys: Array(1), storageKey: 'cd6c9518950e...'}
vaultStore.ts:41 🏪 [VaultStore] getActiveIdentityIndex: {appOrigin: 'localhost-4000', appKey: 'localhost-4000', index: 1, allActiveKeys: Array(1), storageKey: 'cd6c9518950e...'}
Dashboard.tsx:53 [Dashboard] Auto-fetching Nostr profiles for 3 identities
nostrProfileService.ts:49 [NostrProfile] Fetching profile for 152bd43a from relays
nostrProfileService.ts:49 [NostrProfile] Fetching profile for 9e7dd4dc from relays
nostrProfileService.ts:49 [NostrProfile] Fetching profile for 2025cd71 from relays
GlobalSettings.tsx:60 📡 [GlobalSettings] Starting vault version subscription...
GlobalSettings.tsx:48 Failed to fetch vault versions: Error: Storage key not available. Unlock required.
    at WorkerMessenger.handleResponse (worker-messenger.ts:218:22)
    at MessagePort.handleMessage (worker-messenger.ts:164:12)
(anonymous) @ GlobalSettings.tsx:48
await in (anonymous)
(anonymous) @ chunk-KHM4YBAW.js?v=260afb0c:352
untrack @ chunk-KHM4YBAW.js?v=260afb0c:461
load @ chunk-KHM4YBAW.js?v=260afb0c:350
(anonymous) @ chunk-KHM4YBAW.js?v=260afb0c:404
runComputation @ chunk-KHM4YBAW.js?v=260afb0c:733
updateComputation @ chunk-KHM4YBAW.js?v=260afb0c:716
runTop @ chunk-KHM4YBAW.js?v=260afb0c:826
runQueue @ chunk-KHM4YBAW.js?v=260afb0c:900
completeUpdates @ chunk-KHM4YBAW.js?v=260afb0c:855
runUpdates @ chunk-KHM4YBAW.js?v=260afb0c:844
writeSignal @ chunk-KHM4YBAW.js?v=260afb0c:689
setter @ chunk-KHM4YBAW.js?v=260afb0c:223
_el$1.$$click @ Dashboard.tsx:217
handleNode @ chunk-LCAEHM2X.js?v=260afb0c:500
eventHandler @ chunk-LCAEHM2X.js?v=260afb0c:521
GlobalSettings.tsx:69 Failed to start vault version subscription: Error: Storage key not available. Unlock required.
    at WorkerMessenger.handleResponse (worker-messenger.ts:218:22)
    at MessagePort.handleMessage (worker-messenger.ts:164:12)
(anonymous) @ GlobalSettings.tsx:69
Promise.catch
(anonymous) @ GlobalSettings.tsx:68
runComputation @ chunk-KHM4YBAW.js?v=260afb0c:733
updateComputation @ chunk-KHM4YBAW.js?v=260afb0c:716
runTop @ chunk-KHM4YBAW.js?v=260afb0c:826
runUserEffects @ chunk-KHM4YBAW.js?v=260afb0c:939
(anonymous) @ chunk-KHM4YBAW.js?v=260afb0c:895
runUpdates @ chunk-KHM4YBAW.js?v=260afb0c:843
completeUpdates @ chunk-KHM4YBAW.js?v=260afb0c:895
runUpdates @ chunk-KHM4YBAW.js?v=260afb0c:844
writeSignal @ chunk-KHM4YBAW.js?v=260afb0c:689
setter @ chunk-KHM4YBAW.js?v=260afb0c:223
_el$1.$$click @ Dashboard.tsx:217
handleNode @ chunk-LCAEHM2X.js?v=260afb0c:500
eventHandler @ chunk-LCAEHM2X.js?v=260afb0c:521
nostrProfileService.ts:58 [NostrProfile] No profile found for 152bd43a
nostrProfileService.ts:58 [NostrProfile] No profile found for 9e7dd4dc
nostrProfileService.ts:58 [NostrProfile] No profile found for 2025cd71
nostrProfileService.ts:58 [NostrProfile] No profile found for 152bd43a
nostrProfileService.ts:58 [NostrProfile] No profile found for 9e7dd4dc
nostrProfileService.ts:58 [NostrProfile] No profile found for 2025cd71
nostrProfileService.ts:58 [NostrProfile] No profile found for 152bd43a
nostrProfileService.ts:58 [NostrProfile] No profile found for 9e7dd4dc
nostrProfileService.ts:58 [NostrProfile] No profile found for 2025cd71
nostrProfileService.ts:58 [NostrProfile] No profile found for 152bd43a
nostrProfileService.ts:58 [NostrProfile] No profile found for 9e7dd4dc
nostrProfileService.ts:58 [NostrProfile] No profile found for 2025cd71
service-worker.ts:116 [ServiceWorker] Vault service worker loaded
GoogleAuthProvider.tsx:119 [GoogleAuth] Signed in successfully: lamar@wilsondom.com
LinkGoogleAccount.tsx:142 [LinkGoogleAccount] Calling linkGoogleAccount with: {username: 'asdr', displayName: 'asdr', googleDisplayName: 'lamar@wilsondom.com', environment: 'demo'}
index.ts:101 🔵 Handler called for route: AUTH_STATUS
handler @ index.ts:101
(anonymous) @ index.ts:374
next @ index.ts:399
(anonymous) @ index.ts:93
next @ index.ts:403
(anonymous) @ index.ts:65
next @ index.ts:403
(anonymous) @ index.ts:49
next @ index.ts:403
(anonymous) @ index.ts:29
next @ index.ts:403
executeMiddlewareChain @ index.ts:406
handleMessage @ index.ts:371
handleMessage @ index.ts:519
(anonymous) @ index.ts:152
postMessage
messenger.sendMessage @ embassy.ts:1102
(anonymous) @ index.ts:70
request @ index.ts:55
getAuthStatus @ embassy.ts:2452
(anonymous) @ NostrPassButton.ts:1917
setInterval
startAuthPolling @ NostrPassButton.ts:1910
_ @ NostrPassButton.ts:109
createNostrPassButton @ embassy.ts:2597
createNostrPassButton @ embassy.ts:2685
(anonymous) @ App.tsx:61
setTimeout
script.onload @ App.tsx:55
script
(anonymous) @ App.tsx:31
commitHookEffectListMount @ chunk-UYK7FZTZ.js?v=8c1d7b97:16915
commitPassiveMountOnFiber @ chunk-UYK7FZTZ.js?v=8c1d7b97:18156
commitPassiveMountEffects_complete @ chunk-UYK7FZTZ.js?v=8c1d7b97:18129
commitPassiveMountEffects_begin @ chunk-UYK7FZTZ.js?v=8c1d7b97:18119
commitPassiveMountEffects @ chunk-UYK7FZTZ.js?v=8c1d7b97:18109
flushPassiveEffectsImpl @ chunk-UYK7FZTZ.js?v=8c1d7b97:19490
flushPassiveEffects @ chunk-UYK7FZTZ.js?v=8c1d7b97:19447
commitRootImpl @ chunk-UYK7FZTZ.js?v=8c1d7b97:19416
commitRoot @ chunk-UYK7FZTZ.js?v=8c1d7b97:19277
performSyncWorkOnRoot @ chunk-UYK7FZTZ.js?v=8c1d7b97:18895
flushSyncCallbacks @ chunk-UYK7FZTZ.js?v=8c1d7b97:9119
(anonymous) @ chunk-UYK7FZTZ.js?v=8c1d7b97:18627
authHandlers.ts:696 [AUTH_STATUS] Query from: https://localhost:4000
authHandlers.ts:697 [AUTH_STATUS] Current user: asdr
authHandlers.ts:698 [AUTH_STATUS] isLocked: false
vaultStore.ts:41 🏪 [VaultStore] getActiveIdentityIndex: {appOrigin: 'localhost-4000', appKey: 'localhost-4000', index: 1, allActiveKeys: Array(1), storageKey: 'cd6c9518950e...'}
authHandlers.ts:741 [AUTH_STATUS] Active identity lookup: {appKey: 'localhost-4000', activeIdentityIndex: 1, storeInitialized: true, identityExists: true, identityArchived: undefined, …}
authHandlers.ts:821 [AUTH_STATUS] Returning success response: {isLocked: false, username: 'asdr', authorized: true}
index.ts:107 [SecureMessenger] sendMessage called: {type: 'AUTH_STATUS_RESPONSE', targetOrigin: 'https://localhost:4000', verifiedOrigin: 'https://localhost:4000', allowedOrigins: Array(3), isParent: false}
index.ts:141 [SecureMessenger] postMessage: {type: 'AUTH_STATUS_RESPONSE', origin: 'https://localhost:4000', isParent: false, hasTargetWindow: true}
vaultStore.ts:273 🏪 [VaultStore] Received vault broadcast: {broadcastType: 'VAULT_DATA_UPDATED', currentStorageKey: 'cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2', broadcastKey: 'cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2', timestamp: 93221.90000000596}
vaultStore.ts:285 🏪 [VaultStore] Reloading vault data after: VAULT_DATA_UPDATED
vaultStore.ts:341 🏪 [VaultStore] Loaded vault data: {username: 'cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2', identitiesCount: 3, version: 3, updatedAt: 1768436003734, firstIdentityApps: Array(1), …}
vaultStore.ts:41 🏪 [VaultStore] getActiveIdentityIndex: {appOrigin: 'localhost-4000', appKey: 'localhost-4000', index: 1, allActiveKeys: Array(1), storageKey: 'cd6c9518950e...'}
vaultStore.ts:41 🏪 [VaultStore] getActiveIdentityIndex: {appOrigin: 'localhost-4000', appKey: 'localhost-4000', index: 1, allActiveKeys: Array(1), storageKey: 'cd6c9518950e...'}
Dashboard.tsx:53 [Dashboard] Auto-fetching Nostr profiles for 3 identities
nostrProfileService.ts:49 [NostrProfile] Fetching profile for 152bd43a from relays
nostrProfileService.ts:49 [NostrProfile] Fetching profile for 9e7dd4dc from relays
nostrProfileService.ts:49 [NostrProfile] Fetching profile for 2025cd71 from relays
vaultStore.ts:289 ⏱️ [VaultStore] Reload took: 10.20 ms
index.ts:107 [SecureMessenger] sendMessage called: {type: 'VAULT_DATA_UPDATED', targetOrigin: undefined, verifiedOrigin: 'https://localhost:4000', allowedOrigins: Array(3), isParent: false}
index.ts:141 [SecureMessenger] postMessage: {type: 'VAULT_DATA_UPDATED', origin: 'https://localhost:4000', isParent: false, hasTargetWindow: true}
LinkGoogleAccount.tsx:175 [LinkGoogleAccount] Stored storagePublicKey for multi-vault fallback: {googleUid: '0Ymnmq7I1oVeeze4tyvKmHi3LN42', storagePublicKey: 'cd6c9518950e...', totalLinkedVaults: 1, storageKey: 'nostrpass_google_vaults_0Ymnmq7I1oVeeze4tyvKmHi3LN42'}
Toast.tsx:312 [Toast Success] Success: Google account linked successfully
GlobalSettings.tsx:230 [GlobalSettings] Link/unlink completed, refreshing vault data...
vaultStore.ts:366 🏪 [VaultStore] Force reloading vault data
vaultStore.ts:341 🏪 [VaultStore] Loaded vault data: {username: 'cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2', identitiesCount: 3, version: 3, updatedAt: 1768436003734, firstIdentityApps: Array(1), …}
vaultStore.ts:41 🏪 [VaultStore] getActiveIdentityIndex: {appOrigin: 'localhost-4000', appKey: 'localhost-4000', index: 1, allActiveKeys: Array(1), storageKey: 'cd6c9518950e...'}
vaultStore.ts:41 🏪 [VaultStore] getActiveIdentityIndex: {appOrigin: 'localhost-4000', appKey: 'localhost-4000', index: 1, allActiveKeys: Array(1), storageKey: 'cd6c9518950e...'}
Dashboard.tsx:53 [Dashboard] Auto-fetching Nostr profiles for 3 identities
nostrProfileService.ts:49 [NostrProfile] Fetching profile for 152bd43a from relays
nostrProfileService.ts:49 [NostrProfile] Fetching profile for 9e7dd4dc from relays
nostrProfileService.ts:49 [NostrProfile] Fetching profile for 2025cd71 from relays
index.ts:101 🔵 Handler called for route: GET_ALL_IDENTITIES
handler @ index.ts:101
(anonymous) @ index.ts:374
next @ index.ts:399
(anonymous) @ index.ts:93
next @ index.ts:403
(anonymous) @ index.ts:65
next @ index.ts:403
(anonymous) @ index.ts:49
next @ index.ts:403
(anonymous) @ index.ts:29
next @ index.ts:403
executeMiddlewareChain @ index.ts:406
handleMessage @ index.ts:371
handleMessage @ index.ts:519
(anonymous) @ index.ts:152
postMessage
messenger.sendMessage @ embassy.ts:1102
(anonymous) @ index.ts:70
request @ index.ts:55
getAllIdentities @ embassy.ts:2467
(anonymous) @ NostrPassButton.ts:159
await in (anonymous)
VAULT_DATA_UPDATED @ embassyMessageHandlers.ts:123
handleMessage @ index.ts:200
(anonymous) @ index.ts:152
postMessage
sendMessage @ index.ts:142
send @ index.ts:88
notifyEmbassyVaultUpdate @ vaultStore.ts:192
await in notifyEmbassyVaultUpdate
vaultUpdateChannel.onmessage @ vaultStore.ts:291
vaultStore.ts:41 🏪 [VaultStore] getActiveIdentityIndex: {appOrigin: 'localhost-4000', appKey: 'localhost-4000', index: 1, allActiveKeys: Array(1), storageKey: 'cd6c9518950e...'}
index.ts:107 [SecureMessenger] sendMessage called: {type: 'GET_ALL_IDENTITIES_RESPONSE', targetOrigin: 'https://localhost:4000', verifiedOrigin: 'https://localhost:4000', allowedOrigins: Array(3), isParent: false}
index.ts:141 [SecureMessenger] postMessage: {type: 'GET_ALL_IDENTITIES_RESPONSE', origin: 'https://localhost:4000', isParent: false, hasTargetWindow: true}
index.ts:101 🔵 Handler called for route: AUTH_STATUS
handler @ index.ts:101
(anonymous) @ index.ts:374
next @ index.ts:399
(anonymous) @ index.ts:93
next @ index.ts:403
(anonymous) @ index.ts:65
next @ index.ts:403
(anonymous) @ index.ts:49
next @ index.ts:403
(anonymous) @ index.ts:29
next @ index.ts:403
executeMiddlewareChain @ index.ts:406
handleMessage @ index.ts:371
handleMessage @ index.ts:519
(anonymous) @ index.ts:152
postMessage
messenger.sendMessage @ embassy.ts:1102
(anonymous) @ index.ts:70
request @ index.ts:55
getAuthStatus @ embassy.ts:2452
renderUserButton @ NostrPassButton.ts:1029
render @ NostrPassButton.ts:994
(anonymous) @ NostrPassButton.ts:237
await in (anonymous)
VAULT_DATA_UPDATED @ embassyMessageHandlers.ts:123
handleMessage @ index.ts:200
(anonymous) @ index.ts:152
postMessage
sendMessage @ index.ts:142
send @ index.ts:88
notifyEmbassyVaultUpdate @ vaultStore.ts:192
await in notifyEmbassyVaultUpdate
vaultUpdateChannel.onmessage @ vaultStore.ts:291
authHandlers.ts:696 [AUTH_STATUS] Query from: https://localhost:4000
authHandlers.ts:697 [AUTH_STATUS] Current user: asdr
authHandlers.ts:698 [AUTH_STATUS] isLocked: false
vaultStore.ts:41 🏪 [VaultStore] getActiveIdentityIndex: {appOrigin: 'localhost-4000', appKey: 'localhost-4000', index: 1, allActiveKeys: Array(1), storageKey: 'cd6c9518950e...'}
authHandlers.ts:741 [AUTH_STATUS] Active identity lookup: {appKey: 'localhost-4000', activeIdentityIndex: 1, storeInitialized: true, identityExists: true, identityArchived: undefined, …}
authHandlers.ts:821 [AUTH_STATUS] Returning success response: {isLocked: false, username: 'asdr', authorized: true}
index.ts:107 [SecureMessenger] sendMessage called: {type: 'AUTH_STATUS_RESPONSE', targetOrigin: 'https://localhost:4000', verifiedOrigin: 'https://localhost:4000', allowedOrigins: Array(3), isParent: false}
index.ts:141 [SecureMessenger] postMessage: {type: 'AUTH_STATUS_RESPONSE', origin: 'https://localhost:4000', isParent: false, hasTargetWindow: true}
index.ts:101 🔵 Handler called for route: GET_ALL_IDENTITIES
handler @ index.ts:101
(anonymous) @ index.ts:374
next @ index.ts:399
(anonymous) @ index.ts:93
next @ index.ts:403
(anonymous) @ index.ts:65
next @ index.ts:403
(anonymous) @ index.ts:49
next @ index.ts:403
(anonymous) @ index.ts:29
next @ index.ts:403
executeMiddlewareChain @ index.ts:406
handleMessage @ index.ts:371
handleMessage @ index.ts:519
(anonymous) @ index.ts:152
postMessage
messenger.sendMessage @ embassy.ts:1102
(anonymous) @ index.ts:70
request @ index.ts:55
getAllIdentities @ embassy.ts:2467
renderUserButton @ NostrPassButton.ts:1036
await in renderUserButton
render @ NostrPassButton.ts:994
(anonymous) @ NostrPassButton.ts:237
await in (anonymous)
VAULT_DATA_UPDATED @ embassyMessageHandlers.ts:123
handleMessage @ index.ts:200
(anonymous) @ index.ts:152
postMessage
sendMessage @ index.ts:142
send @ index.ts:88
notifyEmbassyVaultUpdate @ vaultStore.ts:192
await in notifyEmbassyVaultUpdate
vaultUpdateChannel.onmessage @ vaultStore.ts:291
vaultStore.ts:41 🏪 [VaultStore] getActiveIdentityIndex: {appOrigin: 'localhost-4000', appKey: 'localhost-4000', index: 1, allActiveKeys: Array(1), storageKey: 'cd6c9518950e...'}
index.ts:107 [SecureMessenger] sendMessage called: {type: 'GET_ALL_IDENTITIES_RESPONSE', targetOrigin: 'https://localhost:4000', verifiedOrigin: 'https://localhost:4000', allowedOrigins: Array(3), isParent: false}
index.ts:141 [SecureMessenger] postMessage: {type: 'GET_ALL_IDENTITIES_RESPONSE', origin: 'https://localhost:4000', isParent: false, hasTargetWindow: true}
nostrProfileService.ts:58 [NostrProfile] No profile found for 152bd43a
nostrProfileService.ts:58 [NostrProfile] No profile found for 9e7dd4dc
nostrProfileService.ts:58 [NostrProfile] No profile found for 2025cd71
nostrProfileService.ts:58 [NostrProfile] No profile found for 152bd43a
nostrProfileService.ts:58 [NostrProfile] No profile found for 9e7dd4dc
nostrProfileService.ts:58 [NostrProfile] No profile found for 2025cd71



Here is the one for the worker:
 [CryptoWorker] Starting initialization...
 [CryptoWorker] Imports loaded successfully
 [CryptoWorker] Worker type detected: SharedWorker
 [SharedWorker] Creating single worker host (handles all ports)
 [SharedWorker] Initializing in SharedWorker mode
 [CryptoWorker] Noble crypto module ready
 [SharedWorker] New connection received (worker host will handle it)
 [SharedWorker] Active connections: 1
 [WorkerMessenger] Received message: {id: '6d64117b-5a5e-4115-98d5-61beb935e22e', method: 'getAuthState', params: {…}, timestamp: 1768435911391}
 [WorkerMessenger] Processing as request
 [WorkerMessenger] Handling request: getAuthState 6d64117b-5a5e-4115-98d5-61beb935e22e
 [WorkerMessenger] Calling handler for method: getAuthState
 [SessionStateManager] No persisted session found
 [WorkerMessenger] Handler completed successfully for method: getAuthState
 [WorkerMessenger] Sending response for request: 6d64117b-5a5e-4115-98d5-61beb935e22e error: false
 [WorkerMessenger] Received message: {id: '98746ef3-1c72-4cef-b9c3-24ab419d7cd4', method: 'atomicLogin', params: {…}, timestamp: 1768435932791}
 [WorkerMessenger] Processing as request
 [WorkerMessenger] Handling request: atomicLogin 98746ef3-1c72-4cef-b9c3-24ab419d7cd4
 [WorkerMessenger] Calling handler for method: atomicLogin
 [SessionStateManager] Starting atomic login for: 0Ymnmq7I1oVeeze4tyvKmHi3LN42 type: google
 [SessionStateManager] Fetching from Nostr to verify password...
 [SessionStateManager] Using identifierType: google environment: demo
 [SessionStateManager] Using getLoginObjByDTag for multi-vault Google auth
 [SessionStateManager] vaultDTag: nostrpass.com_login_fd4aa28f3151e2c684306f8f303280d7538ca8a93c72f3579299e47e7adb618f_google_25524c018f5cad8119d85bcf1dfbd928b630e3bb64619ae3ed17485bff9c0fc1_demo
 📥 [getLoginObjByDTag] Querying for LoginObj by d-tag: nostrpass.com_login_fd4aa28f3151e2c684306f8f303280d7538ca8a93c72f3579299e47e7adb618f_google_25524c018f5cad8119d85bcf1dfbd928b630e3bb64619ae3ed17485bff9c0fc1_demo
 WebSocket connection to 'ws://localhost:8080/' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED
(anonymous) @ nostr-tools.js?v=260afb0c:717
connect @ nostr-tools.js?v=260afb0c:708
ensureRelay @ nostr-tools.js?v=260afb0c:1092
(anonymous) @ nostr-tools.js?v=260afb0c:1186
subscribeMap @ nostr-tools.js?v=260afb0c:1183
subscribe @ nostr-tools.js?v=260afb0c:1111
subscribeEose @ nostr-tools.js?v=260afb0c:1232
(anonymous) @ nostr-tools.js?v=260afb0c:1253
querySync @ nostr-tools.js?v=260afb0c:1251
get @ nostr-tools.js?v=260afb0c:1266
getLoginObjByDTag @ vaultHelpers.ts?t=1768422541175:247
login @ session-state-manage…?t=1768428269414:83
 🔑 [getLoginObjByDTag] Derived password key from password + salt
 ✅ [getLoginObjByDTag] LoginObj decrypted successfully (NIP-44)
 [SessionStateManager] ========== LOGIN OBJ DEBUG ==========
 [SessionStateManager] LoginObj keys: (9) ['storagePublicKey', 'storageKeypairEncrypted', 'username', 'createdAt', 'version', 'passwordSalt', 'pinSalt', 'authProvider', 'googleUid']
 [SessionStateManager] LoginObj.storagePublicKey: bb6ebfad5c74037d1a6b081ac398eb0b942b8fdd5481a53d7bf4590902f4f6b8
 [SessionStateManager] LoginObj.passwordSalt: cfc650f2b570b4fc7fb2fcdd2cdd45902b5f240a513612ab935d1bbe5da76972
 [SessionStateManager] LoginObj.pinSalt exists: true
 [SessionStateManager] LoginObj.storageKeypairEncrypted exists: true
 [SessionStateManager] Result passwordSalt: cfc650f2b570b4fc7fb2fcdd2cdd45902b5f240a513612ab935d1bbe5da76972
 [SessionStateManager] =====================================
 [SessionStateManager] Password verified, LoginObj cached successfully
 [SessionStateManager] LoginObj retrieved, deferring VaultObj fetch to unlock
 [PIN Security] User 0Ymnmq7I1oVeeze4tyvKmHi3LN42 PIN tracking fully reset
 [SessionStateManager] Login successful, session created and persisted: session_1768435937566_ymmog82lfti
 [WorkerMessenger] Handler completed successfully for method: atomicLogin
 [WorkerMessenger] Sending response for request: 98746ef3-1c72-4cef-b9c3-24ab419d7cd4 error: false
 [WorkerMessenger] Received message: {id: '6622be37-58d1-42c8-95a8-695727e9fc1e', method: 'getVaultData', params: {…}, timestamp: 1768435937574}
 [WorkerMessenger] Processing as request
 [WorkerMessenger] Handling request: getVaultData 6622be37-58d1-42c8-95a8-695727e9fc1e
 [WorkerMessenger] Calling handler for method: getVaultData
 📥 [getVaultData] ===== REQUEST START =====
 📥 [getVaultData] Full params object: {"username":"bb6ebfad5c74037d1a6b081ac398eb0b942b8fdd5481a53d7bf4590902f4f6b8"}
 📥 [getVaultData] storagePublicKey: undefined
 📥 [getVaultData] username (legacy): bb6ebfad5c74037d1a6b081ac398eb0b942b8fdd5481a53d7bf4590902f4f6b8
 📥 [getVaultData] includeEncryptedVault value: undefined
 🔄 [getVaultData] Ensuring crypto ready...
 ✅ [getVaultData] Crypto ready
 🗄️ [getVaultData] Querying IndexedDB with key: bb6ebfad5c74...
 🔄 [getVaultData] Trying legacy username lookup...
 ✅ [getVaultData] IndexedDB query complete, found: false
 ❌ [getVaultData] No vault found for key: bb6ebfad5c74...
 [WorkerMessenger] Handler completed successfully for method: getVaultData
 [WorkerMessenger] Sending response for request: 6622be37-58d1-42c8-95a8-695727e9fc1e error: false
 WebSocket connection to 'wss://relay.nostr.band/' failed: Error during WebSocket handshake: Unexpected response code: 502
(anonymous) @ nostr-tools.js?v=260afb0c:717
connect @ nostr-tools.js?v=260afb0c:708
ensureRelay @ nostr-tools.js?v=260afb0c:1092
(anonymous) @ nostr-tools.js?v=260afb0c:1186
subscribeMap @ nostr-tools.js?v=260afb0c:1183
subscribe @ nostr-tools.js?v=260afb0c:1111
subscribeEose @ nostr-tools.js?v=260afb0c:1232
(anonymous) @ nostr-tools.js?v=260afb0c:1253
querySync @ nostr-tools.js?v=260afb0c:1251
get @ nostr-tools.js?v=260afb0c:1266
getLoginObjByDTag @ vaultHelpers.ts?t=1768422541175:247
login @ session-state-manage…?t=1768428269414:83
 [WorkerMessenger] Received message: {id: '807008e8-447b-4b88-8b68-70256694e9fc', method: 'atomicUnlock', params: {…}, timestamp: 1768435944444}
 [WorkerMessenger] Processing as request
 [WorkerMessenger] Handling request: atomicUnlock 807008e8-447b-4b88-8b68-70256694e9fc
 [WorkerMessenger] Calling handler for method: atomicUnlock
 [SessionStateManager] Starting atomic unlock for: 0Ymnmq7I1oVeeze4tyvKmHi3LN42
 [SessionStateManager] Loading VaultObj from IndexedDB cache...
 [SessionStateManager] Vault lookup result: {foundByStoragePublicKey: false, foundByUsername: false, vaultUsername: undefined}
 [SessionStateManager] VaultObj not in cache, need to fetch from Nostr first
 [SessionStateManager] This requires storage keys - deriving from xpriv temporarily...
 [SessionStateManager] Decrypting storage keypair with PIN...
 [SessionStateManager] Fetching VaultObj from Nostr...
 📥 [getVaultFromNostr] Querying relays: (5) ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net', 'wss://relay.nostr.band', 'ws://localhost:8080']
 📥 [getVaultFromNostr] Expected d-tag: nostrpass.com_vault_bb6ebfad5c74037d1a6b081ac398eb0b942b8fdd5481a53d7bf4590902f4f6b8_production
 📥 [getVaultFromNostr] Author pubkey: bb6ebfad5c74037d1a6b081ac398eb0b942b8fdd5481a53d7bf4590902f4f6b8
 WebSocket connection to 'ws://localhost:8080/' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED
(anonymous) @ nostr-tools.js?v=260afb0c:717
connect @ nostr-tools.js?v=260afb0c:708
ensureRelay @ nostr-tools.js?v=260afb0c:1092
(anonymous) @ nostr-tools.js?v=260afb0c:1186
subscribeMap @ nostr-tools.js?v=260afb0c:1183
subscribe @ nostr-tools.js?v=260afb0c:1111
subscribeEose @ nostr-tools.js?v=260afb0c:1232
(anonymous) @ nostr-tools.js?v=260afb0c:1253
querySync @ nostr-tools.js?v=260afb0c:1251
getVaultFromNostr @ vaultHelpers.ts?t=1768422541175:532
unlock @ session-state-manage…t=1768428269414:231
 WebSocket connection to 'wss://relay.nostr.band/' failed: Error during WebSocket handshake: Unexpected response code: 502
(anonymous) @ nostr-tools.js?v=260afb0c:717
connect @ nostr-tools.js?v=260afb0c:708
ensureRelay @ nostr-tools.js?v=260afb0c:1092
(anonymous) @ nostr-tools.js?v=260afb0c:1186
subscribeMap @ nostr-tools.js?v=260afb0c:1183
subscribe @ nostr-tools.js?v=260afb0c:1111
subscribeEose @ nostr-tools.js?v=260afb0c:1232
(anonymous) @ nostr-tools.js?v=260afb0c:1253
querySync @ nostr-tools.js?v=260afb0c:1251
getVaultFromNostr @ vaultHelpers.ts?t=1768422541175:532
unlock @ session-state-manage…t=1768428269414:231
 📥 [getVaultFromNostr] Found 0 events
 [SessionStateManager] Unlock failed: 
unlock @ session-state-manage…t=1768428269414:339
await in unlock
handleAtomicUnlock @ auth-handlers-atomic…t=1768428269414:111
handleRequest @ worker-messenger.ts:136
handleMessage @ worker-messenger.ts:112
boundHandler @ worker-messenger.ts:51
 [WorkerMessenger] Handler error for method: atomicUnlock 
handleRequest @ worker-messenger.ts:140
await in handleRequest
handleMessage @ worker-messenger.ts:112
boundHandler @ worker-messenger.ts:51
 [WorkerMessenger] Sending response for request: 807008e8-447b-4b88-8b68-70256694e9fc error: true
 [WorkerMessenger] Received message: {id: '0f8ea08d-076b-4b8b-b197-65cc8a3b4c6a', method: 'atomicLogin', params: {…}, timestamp: 1768435975723}
 [WorkerMessenger] Processing as request
 [WorkerMessenger] Handling request: atomicLogin 0f8ea08d-076b-4b8b-b197-65cc8a3b4c6a
 [WorkerMessenger] Calling handler for method: atomicLogin
 [SessionStateManager] Starting atomic login for: asdr type: username
 [SessionStateManager] Fetching from Nostr to verify password...
 [SessionStateManager] Using identifierType: username environment: demo
 📥 [getLoginObj] Querying for LoginObj: {identifier: 'asdr', identifierType: 'username', environment: 'demo', dTag: 'nostrpass.com_login_c8f848a5e62ac0eee55776072c5e590955c861909263313dc336a4d901efe3f5_username_demo'}
 WebSocket connection to 'ws://localhost:8080/' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED
(anonymous) @ nostr-tools.js?v=260afb0c:717
connect @ nostr-tools.js?v=260afb0c:708
ensureRelay @ nostr-tools.js?v=260afb0c:1092
(anonymous) @ nostr-tools.js?v=260afb0c:1186
subscribeMap @ nostr-tools.js?v=260afb0c:1183
subscribe @ nostr-tools.js?v=260afb0c:1111
subscribeEose @ nostr-tools.js?v=260afb0c:1232
(anonymous) @ nostr-tools.js?v=260afb0c:1253
querySync @ nostr-tools.js?v=260afb0c:1251
get @ nostr-tools.js?v=260afb0c:1266
getLoginObj @ vaultHelpers.ts?t=1768422541175:166
login @ session-state-manage…?t=1768428269414:85
 WebSocket connection to 'wss://relay.nostr.band/' failed: Error during WebSocket handshake: Unexpected response code: 502
(anonymous) @ nostr-tools.js?v=260afb0c:717
connect @ nostr-tools.js?v=260afb0c:708
ensureRelay @ nostr-tools.js?v=260afb0c:1092
(anonymous) @ nostr-tools.js?v=260afb0c:1186
subscribeMap @ nostr-tools.js?v=260afb0c:1183
subscribe @ nostr-tools.js?v=260afb0c:1111
subscribeEose @ nostr-tools.js?v=260afb0c:1232
(anonymous) @ nostr-tools.js?v=260afb0c:1253
querySync @ nostr-tools.js?v=260afb0c:1251
get @ nostr-tools.js?v=260afb0c:1266
getLoginObj @ vaultHelpers.ts?t=1768422541175:166
login @ session-state-manage…?t=1768428269414:85
 ✅ [getLoginObj] Found passwordSalt in event tags
 🔑 [getLoginObj] Derived password key from password + salt
 ✅ [getLoginObj] LoginObj decrypted successfully (NIP-44)
 [SessionStateManager] ========== LOGIN OBJ DEBUG ==========
 [SessionStateManager] LoginObj keys: (8) ['storagePublicKey', 'storageKeypairEncrypted', 'username', 'createdAt', 'version', 'passwordSalt', 'pinSalt', 'authProvider']
 [SessionStateManager] LoginObj.storagePublicKey: cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2
 [SessionStateManager] LoginObj.passwordSalt: 2c3dde55496089d51f8d9318e6c3b873fef803b8f59ad2a63eeeb203e79fe56b
 [SessionStateManager] LoginObj.pinSalt exists: true
 [SessionStateManager] LoginObj.storageKeypairEncrypted exists: true
 [SessionStateManager] Result passwordSalt: 2c3dde55496089d51f8d9318e6c3b873fef803b8f59ad2a63eeeb203e79fe56b
 [SessionStateManager] =====================================
 [SessionStateManager] Password verified, LoginObj cached successfully
 [SessionStateManager] LoginObj retrieved, deferring VaultObj fetch to unlock
 [PIN Security] User asdr PIN tracking fully reset
 [SessionStateManager] Login successful, session created and persisted: session_1768435976696_snt7a9pn4h
 [WorkerMessenger] Handler completed successfully for method: atomicLogin
 [WorkerMessenger] Sending response for request: 0f8ea08d-076b-4b8b-b197-65cc8a3b4c6a error: false
 [WorkerMessenger] Received message: {id: '2510c330-66ad-4835-b52f-901fdcdec8d6', method: 'getVaultData', params: {…}, timestamp: 1768435976703}
 [WorkerMessenger] Processing as request
 [WorkerMessenger] Handling request: getVaultData 2510c330-66ad-4835-b52f-901fdcdec8d6
 [WorkerMessenger] Calling handler for method: getVaultData
 📥 [getVaultData] ===== REQUEST START =====
 📥 [getVaultData] Full params object: {"username":"cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2"}
 📥 [getVaultData] storagePublicKey: undefined
 📥 [getVaultData] username (legacy): cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2
 📥 [getVaultData] includeEncryptedVault value: undefined
 🔄 [getVaultData] Ensuring crypto ready...
 ✅ [getVaultData] Crypto ready
 🗄️ [getVaultData] Querying IndexedDB with key: cd6c9518950e...
 ✅ [getVaultData] IndexedDB query complete, found: true
 📤 [getVaultData] Retrieved vault data: {username: 'asdr', hasPasswordVerifier: false, hasPasswordSalt: true, hasXprivEncrypted: true, hasRecovery: false, …}
 📤 [getVaultData] Returning result with xprivEncrypted: false
 [WorkerMessenger] Handler completed successfully for method: getVaultData
 [WorkerMessenger] Sending response for request: 2510c330-66ad-4835-b52f-901fdcdec8d6 error: false
 [WorkerMessenger] Received message: {id: '8f19ddf8-0cd2-4bd1-834d-1930a188bf4a', method: 'getVaultData', params: {…}, timestamp: 1768435976712}
 [WorkerMessenger] Processing as request
 [WorkerMessenger] Handling request: getVaultData 8f19ddf8-0cd2-4bd1-834d-1930a188bf4a
 [WorkerMessenger] Calling handler for method: getVaultData
 📥 [getVaultData] ===== REQUEST START =====
 📥 [getVaultData] Full params object: {"username":"cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2"}
 📥 [getVaultData] storagePublicKey: undefined
 📥 [getVaultData] username (legacy): cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2
 📥 [getVaultData] includeEncryptedVault value: undefined
 🔄 [getVaultData] Ensuring crypto ready...
 ✅ [getVaultData] Crypto ready
 🗄️ [getVaultData] Querying IndexedDB with key: cd6c9518950e...
 ✅ [getVaultData] IndexedDB query complete, found: true
 📤 [getVaultData] Retrieved vault data: {username: 'asdr', hasPasswordVerifier: false, hasPasswordSalt: true, hasXprivEncrypted: true, hasRecovery: false, …}
 📤 [getVaultData] Returning result with xprivEncrypted: false
 [WorkerMessenger] Handler completed successfully for method: getVaultData
 [WorkerMessenger] Sending response for request: 8f19ddf8-0cd2-4bd1-834d-1930a188bf4a error: false
 [WorkerMessenger] Received message: {id: 'ef91a796-71c9-4bcd-af8b-62536acc912f', method: 'getVaultData', params: {…}, timestamp: 1768435976730}
 [WorkerMessenger] Processing as request
 [WorkerMessenger] Handling request: getVaultData ef91a796-71c9-4bcd-af8b-62536acc912f
 [WorkerMessenger] Calling handler for method: getVaultData
 📥 [getVaultData] ===== REQUEST START =====
 📥 [getVaultData] Full params object: {"username":"cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2"}
 📥 [getVaultData] storagePublicKey: undefined
 📥 [getVaultData] username (legacy): cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2
 📥 [getVaultData] includeEncryptedVault value: undefined
 🔄 [getVaultData] Ensuring crypto ready...
 ✅ [getVaultData] Crypto ready
 🗄️ [getVaultData] Querying IndexedDB with key: cd6c9518950e...
 ✅ [getVaultData] IndexedDB query complete, found: true
 📤 [getVaultData] Retrieved vault data: {username: 'asdr', hasPasswordVerifier: false, hasPasswordSalt: true, hasXprivEncrypted: true, hasRecovery: false, …}
 📤 [getVaultData] Returning result with xprivEncrypted: false
 [WorkerMessenger] Handler completed successfully for method: getVaultData
 [WorkerMessenger] Sending response for request: ef91a796-71c9-4bcd-af8b-62536acc912f error: false
 [WorkerMessenger] Received message: {id: '03ce48ad-8699-4455-bccd-364f7f0f03d1', method: 'atomicUnlock', params: {…}, timestamp: 1768435979143}
 [WorkerMessenger] Processing as request
 [WorkerMessenger] Handling request: atomicUnlock 03ce48ad-8699-4455-bccd-364f7f0f03d1
 [WorkerMessenger] Calling handler for method: atomicUnlock
 [SessionStateManager] Starting atomic unlock for: asdr
 [SessionStateManager] Loading VaultObj from IndexedDB cache...
 [SessionStateManager] Vault lookup result: {foundByStoragePublicKey: true, foundByUsername: false, vaultUsername: 'asdr'}
 [SessionStateManager] VaultObj loaded from cache
 [SessionStateManager] Decrypting xpriv with PIN...
 [SessionStateManager] xpriv decrypted successfully
 [SessionStateManager] Keypairs derived from xpriv
 [SessionStateManager] Keys stored in SecureKeyStorage
 [SessionStateManager] Unlock successful
 🚀 [Worker.startNostrSubscription] FUNCTION CALLED with params: {username: 'asdr', relays: Array(5)}
 🚀 [Worker.startNostrSubscription] Crypto ready
 🔑 [Worker.startNostrSubscription] Looking up vault by: storagePublicKey
 📡 [Worker] Subscribing to Nostr (author PRE): {username: 'asdr', pubkey: 'cd6c9518950e307d', relaysCount: 5}
 🔍 [Worker] SimplePool API check: {hasSubscribeMany: 'function', hasSub: 'undefined', hasSubscribeManyToOne: 'undefined', poolKeys: Array(8)}
 📡 [Worker] Creating subscription with callback-based API
 📡 [Worker] Relays: (5) ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net', 'wss://relay.nostr.band', 'ws://localhost:8080']
 📡 [Worker] Filter: {kinds: Array(1), authors: Array(1)}
 ✅ [Worker] Subscription object created: {hasClose: 'function', subType: 'object', subConstructor: 'Object'}
 🔄 [Worker] Backup polling configured (60s interval)
 ✅ [Worker] Realtime subscription active
 [handleAtomicUnlock] Nostr subscription restarted after unlock
 [WorkerMessenger] Handler completed successfully for method: atomicUnlock
 [WorkerMessenger] Sending response for request: 03ce48ad-8699-4455-bccd-364f7f0f03d1 error: false
 WebSocket connection to 'ws://localhost:8080/' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED
(anonymous) @ nostr-tools.js?v=260afb0c:717
connect @ nostr-tools.js?v=260afb0c:708
ensureRelay @ nostr-tools.js?v=260afb0c:1092
(anonymous) @ nostr-tools.js?v=260afb0c:1186
subscribeMap @ nostr-tools.js?v=260afb0c:1183
subscribeMany @ nostr-tools.js?v=260afb0c:1124
startNostrSubscription @ nostr-sync.ts?t=1768428269414:241
 [WorkerMessenger] Received message: {id: 'ee595d2e-25e9-4134-8504-051aebc5fda4', method: 'getVaultData', params: {…}, timestamp: 1768435979817}
 [WorkerMessenger] Processing as request
 [WorkerMessenger] Handling request: getVaultData ee595d2e-25e9-4134-8504-051aebc5fda4
 [WorkerMessenger] Calling handler for method: getVaultData
 📥 [getVaultData] ===== REQUEST START =====
 📥 [getVaultData] Full params object: {"username":"cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2"}
 📥 [getVaultData] storagePublicKey: undefined
 📥 [getVaultData] username (legacy): cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2
 📥 [getVaultData] includeEncryptedVault value: undefined
 🔄 [getVaultData] Ensuring crypto ready...
 ✅ [getVaultData] Crypto ready
 🗄️ [getVaultData] Querying IndexedDB with key: cd6c9518950e...
 ✅ [getVaultData] IndexedDB query complete, found: true
 📤 [getVaultData] Retrieved vault data: {username: 'asdr', hasPasswordVerifier: false, hasPasswordSalt: true, hasXprivEncrypted: true, hasRecovery: false, …}
 📤 [getVaultData] Returning result with xprivEncrypted: false
 [WorkerMessenger] Handler completed successfully for method: getVaultData
 [WorkerMessenger] Sending response for request: ee595d2e-25e9-4134-8504-051aebc5fda4 error: false
 [WorkerMessenger] Received message: {id: '45f239f2-be7d-4c1e-a54e-ded8b7ac2fea', method: 'getVaultData', params: {…}, timestamp: 1768435979862}
 [WorkerMessenger] Processing as request
 [WorkerMessenger] Handling request: getVaultData 45f239f2-be7d-4c1e-a54e-ded8b7ac2fea
 [WorkerMessenger] Calling handler for method: getVaultData
 📥 [getVaultData] ===== REQUEST START =====
 📥 [getVaultData] Full params object: {"username":"cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2"}
 📥 [getVaultData] storagePublicKey: undefined
 📥 [getVaultData] username (legacy): cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2
 📥 [getVaultData] includeEncryptedVault value: undefined
 🔄 [getVaultData] Ensuring crypto ready...
 ✅ [getVaultData] Crypto ready
 🗄️ [getVaultData] Querying IndexedDB with key: cd6c9518950e...
 ✅ [getVaultData] IndexedDB query complete, found: true
 📤 [getVaultData] Retrieved vault data: {username: 'asdr', hasPasswordVerifier: false, hasPasswordSalt: true, hasXprivEncrypted: true, hasRecovery: false, …}
 📤 [getVaultData] Returning result with xprivEncrypted: false
 [WorkerMessenger] Handler completed successfully for method: getVaultData
 [WorkerMessenger] Sending response for request: 45f239f2-be7d-4c1e-a54e-ded8b7ac2fea error: false
 [WorkerMessenger] Received message: {id: '0d2cefab-a711-4b6b-92d5-3e65b4fb9fce', method: 'getVaultData', params: {…}, timestamp: 1768435979869}
 [WorkerMessenger] Processing as request
 [WorkerMessenger] Handling request: getVaultData 0d2cefab-a711-4b6b-92d5-3e65b4fb9fce
 [WorkerMessenger] Calling handler for method: getVaultData
 📥 [getVaultData] ===== REQUEST START =====
 📥 [getVaultData] Full params object: {"username":"cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2"}
 📥 [getVaultData] storagePublicKey: undefined
 📥 [getVaultData] username (legacy): cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2
 📥 [getVaultData] includeEncryptedVault value: undefined
 🔄 [getVaultData] Ensuring crypto ready...
 ✅ [getVaultData] Crypto ready
 🗄️ [getVaultData] Querying IndexedDB with key: cd6c9518950e...
 ✅ [getVaultData] IndexedDB query complete, found: true
 📤 [getVaultData] Retrieved vault data: {username: 'asdr', hasPasswordVerifier: false, hasPasswordSalt: true, hasXprivEncrypted: true, hasRecovery: false, …}
 📤 [getVaultData] Returning result with xprivEncrypted: false
 [WorkerMessenger] Handler completed successfully for method: getVaultData
 [WorkerMessenger] Sending response for request: 0d2cefab-a711-4b6b-92d5-3e65b4fb9fce error: false
 [WorkerMessenger] Received message: {id: '4b787b82-7f81-4a7c-bfd7-0c989ec6a1f4', method: 'getVaultData', params: {…}, timestamp: 1768435979875}
 [WorkerMessenger] Processing as request
 [WorkerMessenger] Handling request: getVaultData 4b787b82-7f81-4a7c-bfd7-0c989ec6a1f4
 [WorkerMessenger] Calling handler for method: getVaultData
 📥 [getVaultData] ===== REQUEST START =====
 📥 [getVaultData] Full params object: {"username":"cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2"}
 📥 [getVaultData] storagePublicKey: undefined
 📥 [getVaultData] username (legacy): cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2
 📥 [getVaultData] includeEncryptedVault value: undefined
 🔄 [getVaultData] Ensuring crypto ready...
 ✅ [getVaultData] Crypto ready
 🗄️ [getVaultData] Querying IndexedDB with key: cd6c9518950e...
 ✅ [getVaultData] IndexedDB query complete, found: true
 📤 [getVaultData] Retrieved vault data: {username: 'asdr', hasPasswordVerifier: false, hasPasswordSalt: true, hasXprivEncrypted: true, hasRecovery: false, …}
 📤 [getVaultData] Returning result with xprivEncrypted: false
 [WorkerMessenger] Handler completed successfully for method: getVaultData
 [WorkerMessenger] Sending response for request: 4b787b82-7f81-4a7c-bfd7-0c989ec6a1f4 error: false
 🔔 [Worker] onevent callback FIRED! Real-time event received: {kind: 30078, id: 'c4da073e68f0', created_at: '2026-01-15T00:10:05.000Z', receivedAt: '2026-01-15T00:12:59.968Z', lagMs: 174968}
 📨 [Worker] Received Nostr vault event: {kind: 30078, d: 'nostrpass.com_vault_cd6c9518950e307de379dc8feea0dc', created_at: '2026-01-15T00:10:05.000Z', eventId: 'c4da073e68f0'}
 📥 [Worker] Processing full vault snapshot: {d: 'nostrpass.com_vault_cd6c9518950e307de379', eventId: 'c4da073e68f0'}
 ✅ [Worker] Decrypted vault successfully
 🔑 [Worker Subscription] Looking up local vault by storagePublicKey: cd6c9518950e...
 📊 [Worker] Vault timestamp comparison: {remoteTimestamp: 1768435805, localTimestamp: 1768435805, remoteDate: '2026-01-15T00:10:05.000Z', localDate: '2026-01-15T00:10:05.872Z', remoteIdentities: 3, …}
 ℹ️ [Worker] Local vault is newer or equal, skipping update
 🔔 [Worker] onevent callback FIRED! Real-time event received: {kind: 30078, id: 'a39c293a236f', created_at: '2026-01-15T00:10:05.000Z', receivedAt: '2026-01-15T00:12:59.991Z', lagMs: 174991}
 📨 [Worker] Received Nostr vault event: {kind: 30078, d: 'nostrpass.com_login_fd4aa28f3151e2c684306f8f303280', created_at: '2026-01-15T00:10:05.000Z', eventId: 'a39c293a236f'}
 ℹ️ [Worker] Ignoring non-vault event: nostrpass.com_login_
 🔔 [Worker] onevent callback FIRED! Real-time event received: {kind: 30078, id: '593b1f4e4823', created_at: '2026-01-14T01:05:50.000Z', receivedAt: '2026-01-15T00:12:59.997Z', lagMs: 83229997}
 📨 [Worker] Received Nostr vault event: {kind: 30078, d: 'nostrpass.com_login_b44f8029c3e5b8eb26d5ec5d2859ec', created_at: '2026-01-14T01:05:50.000Z', eventId: '593b1f4e4823'}
 ℹ️ [Worker] Ignoring non-vault event: nostrpass.com_login_
 [WorkerMessenger] Received message: {id: '3b4b1160-04fd-436d-bdb0-97d42d8f0b1d', method: 'getVaultData', params: {…}, timestamp: 1768435981700}
 [WorkerMessenger] Processing as request
 [WorkerMessenger] Handling request: getVaultData 3b4b1160-04fd-436d-bdb0-97d42d8f0b1d
 [WorkerMessenger] Calling handler for method: getVaultData
 📥 [getVaultData] ===== REQUEST START =====
 📥 [getVaultData] Full params object: {"username":"cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2"}
 📥 [getVaultData] storagePublicKey: undefined
 📥 [getVaultData] username (legacy): cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2
 📥 [getVaultData] includeEncryptedVault value: undefined
 🔄 [getVaultData] Ensuring crypto ready...
 ✅ [getVaultData] Crypto ready
 🗄️ [getVaultData] Querying IndexedDB with key: cd6c9518950e...
 ✅ [getVaultData] IndexedDB query complete, found: true
 📤 [getVaultData] Retrieved vault data: {username: 'asdr', hasPasswordVerifier: false, hasPasswordSalt: true, hasXprivEncrypted: true, hasRecovery: false, …}
 📤 [getVaultData] Returning result with xprivEncrypted: false
 [WorkerMessenger] Handler completed successfully for method: getVaultData
 [WorkerMessenger] Sending response for request: 3b4b1160-04fd-436d-bdb0-97d42d8f0b1d error: false
 [WorkerMessenger] Received message: {id: '89a6081e-f291-4830-8092-92839ca499b9', method: 'getVaultData', params: {…}, timestamp: 1768435981747}
 [WorkerMessenger] Processing as request
 [WorkerMessenger] Handling request: getVaultData 89a6081e-f291-4830-8092-92839ca499b9
 [WorkerMessenger] Calling handler for method: getVaultData
 📥 [getVaultData] ===== REQUEST START =====
 📥 [getVaultData] Full params object: {"username":"cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2"}
 📥 [getVaultData] storagePublicKey: undefined
 📥 [getVaultData] username (legacy): cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2
 📥 [getVaultData] includeEncryptedVault value: undefined
 🔄 [getVaultData] Ensuring crypto ready...
 ✅ [getVaultData] Crypto ready
 🗄️ [getVaultData] Querying IndexedDB with key: cd6c9518950e...
 ✅ [getVaultData] IndexedDB query complete, found: true
 📤 [getVaultData] Retrieved vault data: {username: 'asdr', hasPasswordVerifier: false, hasPasswordSalt: true, hasXprivEncrypted: true, hasRecovery: false, …}
 📤 [getVaultData] Returning result with xprivEncrypted: false
 [WorkerMessenger] Handler completed successfully for method: getVaultData
 [WorkerMessenger] Sending response for request: 89a6081e-f291-4830-8092-92839ca499b9 error: false
 [WorkerMessenger] Received message: {id: 'abb08963-4b3a-4899-b5a1-4a19136a7a10', method: 'getVaultData', params: {…}, timestamp: 1768435981769}
 [WorkerMessenger] Processing as request
 [WorkerMessenger] Handling request: getVaultData abb08963-4b3a-4899-b5a1-4a19136a7a10
 [WorkerMessenger] Calling handler for method: getVaultData
 📥 [getVaultData] ===== REQUEST START =====
 📥 [getVaultData] Full params object: {"username":"cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2"}
 📥 [getVaultData] storagePublicKey: undefined
 📥 [getVaultData] username (legacy): cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2
 📥 [getVaultData] includeEncryptedVault value: undefined
 🔄 [getVaultData] Ensuring crypto ready...
 ✅ [getVaultData] Crypto ready
 🗄️ [getVaultData] Querying IndexedDB with key: cd6c9518950e...
 ✅ [getVaultData] IndexedDB query complete, found: true
 📤 [getVaultData] Retrieved vault data: {username: 'asdr', hasPasswordVerifier: false, hasPasswordSalt: true, hasXprivEncrypted: true, hasRecovery: false, …}
 📤 [getVaultData] Returning result with xprivEncrypted: false
 [WorkerMessenger] Handler completed successfully for method: getVaultData
 [WorkerMessenger] Sending response for request: abb08963-4b3a-4899-b5a1-4a19136a7a10 error: false
 [WorkerMessenger] Received message: {id: '793bcad6-ec0d-4d1c-bc71-578df8c3a867', method: 'getVaultData', params: {…}, timestamp: 1768435981850}
 [WorkerMessenger] Processing as request
 [WorkerMessenger] Handling request: getVaultData 793bcad6-ec0d-4d1c-bc71-578df8c3a867
 [WorkerMessenger] Calling handler for method: getVaultData
 📥 [getVaultData] ===== REQUEST START =====
 📥 [getVaultData] Full params object: {"username":"cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2"}
 📥 [getVaultData] storagePublicKey: undefined
 📥 [getVaultData] username (legacy): cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2
 📥 [getVaultData] includeEncryptedVault value: undefined
 🔄 [getVaultData] Ensuring crypto ready...
 ✅ [getVaultData] Crypto ready
 🗄️ [getVaultData] Querying IndexedDB with key: cd6c9518950e...
 ✅ [getVaultData] IndexedDB query complete, found: true
 📤 [getVaultData] Retrieved vault data: {username: 'asdr', hasPasswordVerifier: false, hasPasswordSalt: true, hasXprivEncrypted: true, hasRecovery: false, …}
 📤 [getVaultData] Returning result with xprivEncrypted: false
 [WorkerMessenger] Handler completed successfully for method: getVaultData
 [WorkerMessenger] Sending response for request: 793bcad6-ec0d-4d1c-bc71-578df8c3a867 error: false
 [WorkerMessenger] Received message: {id: 'a7ca005b-1e4f-4337-abcb-da20671d5dae', method: 'getVaultData', params: {…}, timestamp: 1768435981856}
 [WorkerMessenger] Processing as request
 [WorkerMessenger] Handling request: getVaultData a7ca005b-1e4f-4337-abcb-da20671d5dae
 [WorkerMessenger] Calling handler for method: getVaultData
 📥 [getVaultData] ===== REQUEST START =====
 📥 [getVaultData] Full params object: {"username":"cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2"}
 📥 [getVaultData] storagePublicKey: undefined
 📥 [getVaultData] username (legacy): cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2
 📥 [getVaultData] includeEncryptedVault value: undefined
 🔄 [getVaultData] Ensuring crypto ready...
 ✅ [getVaultData] Crypto ready
 🗄️ [getVaultData] Querying IndexedDB with key: cd6c9518950e...
 ✅ [getVaultData] IndexedDB query complete, found: true
 📤 [getVaultData] Retrieved vault data: {username: 'asdr', hasPasswordVerifier: false, hasPasswordSalt: true, hasXprivEncrypted: true, hasRecovery: false, …}
 📤 [getVaultData] Returning result with xprivEncrypted: false
 [WorkerMessenger] Handler completed successfully for method: getVaultData
 [WorkerMessenger] Sending response for request: a7ca005b-1e4f-4337-abcb-da20671d5dae error: false
 [WorkerMessenger] Received message: {id: '17c027d4-e69b-4fbb-8268-1065e3934ed7', method: 'getVaultData', params: {…}, timestamp: 1768435981861}
 [WorkerMessenger] Processing as request
 [WorkerMessenger] Handling request: getVaultData 17c027d4-e69b-4fbb-8268-1065e3934ed7
 [WorkerMessenger] Calling handler for method: getVaultData
 📥 [getVaultData] ===== REQUEST START =====
 📥 [getVaultData] Full params object: {"username":"cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2"}
 📥 [getVaultData] storagePublicKey: undefined
 📥 [getVaultData] username (legacy): cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2
 📥 [getVaultData] includeEncryptedVault value: undefined
 🔄 [getVaultData] Ensuring crypto ready...
 ✅ [getVaultData] Crypto ready
 🗄️ [getVaultData] Querying IndexedDB with key: cd6c9518950e...
 ✅ [getVaultData] IndexedDB query complete, found: true
 📤 [getVaultData] Retrieved vault data: {username: 'asdr', hasPasswordVerifier: false, hasPasswordSalt: true, hasXprivEncrypted: true, hasRecovery: false, …}
 📤 [getVaultData] Returning result with xprivEncrypted: false
 [WorkerMessenger] Handler completed successfully for method: getVaultData
 [WorkerMessenger] Sending response for request: 17c027d4-e69b-4fbb-8268-1065e3934ed7 error: false
 [WorkerMessenger] Received message: {id: '53793782-b2dc-4ba6-a0eb-b4a89558507f', method: 'getVaultData', params: {…}, timestamp: 1768435982814}
 [WorkerMessenger] Processing as request
 [WorkerMessenger] Handling request: getVaultData 53793782-b2dc-4ba6-a0eb-b4a89558507f
 [WorkerMessenger] Calling handler for method: getVaultData
 📥 [getVaultData] ===== REQUEST START =====
 📥 [getVaultData] Full params object: {"username":"cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2"}
 📥 [getVaultData] storagePublicKey: undefined
 📥 [getVaultData] username (legacy): cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2
 📥 [getVaultData] includeEncryptedVault value: undefined
 🔄 [getVaultData] Ensuring crypto ready...
 ✅ [getVaultData] Crypto ready
 🗄️ [getVaultData] Querying IndexedDB with key: cd6c9518950e...
 ✅ [getVaultData] IndexedDB query complete, found: true
 📤 [getVaultData] Retrieved vault data: {username: 'asdr', hasPasswordVerifier: false, hasPasswordSalt: true, hasXprivEncrypted: true, hasRecovery: false, …}
 📤 [getVaultData] Returning result with xprivEncrypted: false
 [WorkerMessenger] Handler completed successfully for method: getVaultData
 [WorkerMessenger] Sending response for request: 53793782-b2dc-4ba6-a0eb-b4a89558507f error: false
 [WorkerMessenger] Received message: {id: 'feed0ff9-56dc-4116-b012-48cf037d49c6', method: 'getVaultData', params: {…}, timestamp: 1768435984057}
 [WorkerMessenger] Processing as request
 [WorkerMessenger] Handling request: getVaultData feed0ff9-56dc-4116-b012-48cf037d49c6
 [WorkerMessenger] Calling handler for method: getVaultData
 📥 [getVaultData] ===== REQUEST START =====
 📥 [getVaultData] Full params object: {"username":"cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2"}
 📥 [getVaultData] storagePublicKey: undefined
 📥 [getVaultData] username (legacy): cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2
 📥 [getVaultData] includeEncryptedVault value: undefined
 🔄 [getVaultData] Ensuring crypto ready...
 ✅ [getVaultData] Crypto ready
 🗄️ [getVaultData] Querying IndexedDB with key: cd6c9518950e...
 [WorkerMessenger] Received message: {id: 'b3bdb5ab-35c5-407e-9729-1e2eb6e4723c', method: 'getVaultData', params: {…}, timestamp: 1768435984058}
 [WorkerMessenger] Processing as request
 [WorkerMessenger] Handling request: getVaultData b3bdb5ab-35c5-407e-9729-1e2eb6e4723c
 [WorkerMessenger] Calling handler for method: getVaultData
 📥 [getVaultData] ===== REQUEST START =====
 📥 [getVaultData] Full params object: {"username":"cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2"}
 📥 [getVaultData] storagePublicKey: undefined
 📥 [getVaultData] username (legacy): cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2
 📥 [getVaultData] includeEncryptedVault value: undefined
 🔄 [getVaultData] Ensuring crypto ready...
 ✅ [getVaultData] Crypto ready
 🗄️ [getVaultData] Querying IndexedDB with key: cd6c9518950e...
 [WorkerMessenger] Received message: {id: 'cac872d9-420d-4fe1-88ac-b02ad515b4db', method: 'getVaultData', params: {…}, timestamp: 1768435984060}
 [WorkerMessenger] Processing as request
 [WorkerMessenger] Handling request: getVaultData cac872d9-420d-4fe1-88ac-b02ad515b4db
 [WorkerMessenger] Calling handler for method: getVaultData
 📥 [getVaultData] ===== REQUEST START =====
 📥 [getVaultData] Full params object: {"username":"cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2"}
 📥 [getVaultData] storagePublicKey: undefined
 📥 [getVaultData] username (legacy): cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2
 📥 [getVaultData] includeEncryptedVault value: undefined
 🔄 [getVaultData] Ensuring crypto ready...
 ✅ [getVaultData] Crypto ready
 🗄️ [getVaultData] Querying IndexedDB with key: cd6c9518950e...
 [WorkerMessenger] Received message: {id: 'ef914543-a5c7-4f28-bac5-b42ab7bd5c96', method: 'getVaultData', params: {…}, timestamp: 1768435984060}
 [WorkerMessenger] Processing as request
 [WorkerMessenger] Handling request: getVaultData ef914543-a5c7-4f28-bac5-b42ab7bd5c96
 [WorkerMessenger] Calling handler for method: getVaultData
 📥 [getVaultData] ===== REQUEST START =====
 📥 [getVaultData] Full params object: {"username":"cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2"}
 📥 [getVaultData] storagePublicKey: undefined
 📥 [getVaultData] username (legacy): cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2
 📥 [getVaultData] includeEncryptedVault value: undefined
 🔄 [getVaultData] Ensuring crypto ready...
 ✅ [getVaultData] Crypto ready
 🗄️ [getVaultData] Querying IndexedDB with key: cd6c9518950e...
 ✅ [getVaultData] IndexedDB query complete, found: true
 📤 [getVaultData] Retrieved vault data: {username: 'asdr', hasPasswordVerifier: false, hasPasswordSalt: true, hasXprivEncrypted: true, hasRecovery: false, …}
 📤 [getVaultData] Returning result with xprivEncrypted: false
 [WorkerMessenger] Handler completed successfully for method: getVaultData
 [WorkerMessenger] Sending response for request: feed0ff9-56dc-4116-b012-48cf037d49c6 error: false
 ✅ [getVaultData] IndexedDB query complete, found: true
 📤 [getVaultData] Retrieved vault data: {username: 'asdr', hasPasswordVerifier: false, hasPasswordSalt: true, hasXprivEncrypted: true, hasRecovery: false, …}
 📤 [getVaultData] Returning result with xprivEncrypted: false
 [WorkerMessenger] Handler completed successfully for method: getVaultData
 [WorkerMessenger] Sending response for request: b3bdb5ab-35c5-407e-9729-1e2eb6e4723c error: false
 ✅ [getVaultData] IndexedDB query complete, found: true
 📤 [getVaultData] Retrieved vault data: {username: 'asdr', hasPasswordVerifier: false, hasPasswordSalt: true, hasXprivEncrypted: true, hasRecovery: false, …}
 📤 [getVaultData] Returning result with xprivEncrypted: false
 [WorkerMessenger] Handler completed successfully for method: getVaultData
 [WorkerMessenger] Sending response for request: cac872d9-420d-4fe1-88ac-b02ad515b4db error: false
 ✅ [getVaultData] IndexedDB query complete, found: true
 📤 [getVaultData] Retrieved vault data: {username: 'asdr', hasPasswordVerifier: false, hasPasswordSalt: true, hasXprivEncrypted: true, hasRecovery: false, …}
 📤 [getVaultData] Returning result with xprivEncrypted: false
 [WorkerMessenger] Handler completed successfully for method: getVaultData
 [WorkerMessenger] Sending response for request: ef914543-a5c7-4f28-bac5-b42ab7bd5c96 error: false
 📡 [Worker] EOSE callback FIRED for asdr
 [WorkerMessenger] Received message: {id: '83fbb80d-69ac-41ae-b2d6-7055071ef25c', method: 'getVaultVersionHistory', params: {…}, timestamp: 1768435987071}
 [WorkerMessenger] Processing as request
 [WorkerMessenger] Handling request: getVaultVersionHistory 83fbb80d-69ac-41ae-b2d6-7055071ef25c
 [WorkerMessenger] Calling handler for method: getVaultVersionHistory
 [WorkerMessenger] Handler error for method: getVaultVersionHistory 
handleRequest @ worker-messenger.ts:140
await in handleRequest
handleMessage @ worker-messenger.ts:112
boundHandler @ worker-messenger.ts:51
 [WorkerMessenger] Sending response for request: 83fbb80d-69ac-41ae-b2d6-7055071ef25c error: true
 [WorkerMessenger] Received message: {id: 'd1244ab2-fd4c-4589-81a3-d2d36e421a44', method: 'startVaultVersionSubscription', params: {…}, timestamp: 1768435987072}
 [WorkerMessenger] Processing as request
 [WorkerMessenger] Handling request: startVaultVersionSubscription d1244ab2-fd4c-4589-81a3-d2d36e421a44
 [WorkerMessenger] Calling handler for method: startVaultVersionSubscription
 [WorkerMessenger] Handler error for method: startVaultVersionSubscription 
handleRequest @ worker-messenger.ts:140
await in handleRequest
handleMessage @ worker-messenger.ts:112
boundHandler @ worker-messenger.ts:51
 [WorkerMessenger] Sending response for request: d1244ab2-fd4c-4589-81a3-d2d36e421a44 error: true
 [WorkerMessenger] Received message: {id: 'c0c73db3-a689-4c08-9375-a92678f46645', method: 'linkGoogleAccount', params: {…}, timestamp: 1768435993917}
 [WorkerMessenger] Processing as request
 [WorkerMessenger] Handling request: linkGoogleAccount c0c73db3-a689-4c08-9375-a92678f46645
 [WorkerMessenger] Calling handler for method: linkGoogleAccount
 [link-google] Starting Google account linking: {username: 'asdr', googleUid: '0Ymnmq7I...', environment: 'demo', sessionEnvironment: 'demo'}
 [link-google] Checking if this vault is already linked to this Google UID...
 📥 [getLoginObj] Querying for LoginObj: {identifier: '0Ymnmq7I1oVeeze4tyvKmHi3LN42', identifierType: 'google', environment: 'demo', dTag: 'nostrpass.com_login_fd4aa28f3151e2c684306f8f303280d7538ca8a93c72f3579299e47e7adb618f_google_demo'}
 WebSocket connection to 'ws://localhost:8080/' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED
(anonymous) @ nostr-tools.js?v=260afb0c:717
connect @ nostr-tools.js?v=260afb0c:708
ensureRelay @ nostr-tools.js?v=260afb0c:1092
(anonymous) @ nostr-tools.js?v=260afb0c:1186
subscribeMap @ nostr-tools.js?v=260afb0c:1183
subscribe @ nostr-tools.js?v=260afb0c:1111
subscribeEose @ nostr-tools.js?v=260afb0c:1232
(anonymous) @ nostr-tools.js?v=260afb0c:1253
querySync @ nostr-tools.js?v=260afb0c:1251
get @ nostr-tools.js?v=260afb0c:1266
getLoginObj @ vaultHelpers.ts?t=1768422541175:166
handleLinkGoogleAccount @ signup-handler-atomi…t=1768428269414:396
 📥 [getLoginObj] Trying development fallback (migration): nostrpass.com_login_fd4aa28f3151e2c684306f8f303280d7538ca8a93c72f3579299e47e7adb618f_google_development
 WebSocket connection to 'ws://localhost:8080/' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED
(anonymous) @ nostr-tools.js?v=260afb0c:717
connect @ nostr-tools.js?v=260afb0c:708
ensureRelay @ nostr-tools.js?v=260afb0c:1092
(anonymous) @ nostr-tools.js?v=260afb0c:1186
subscribeMap @ nostr-tools.js?v=260afb0c:1183
subscribe @ nostr-tools.js?v=260afb0c:1111
subscribeEose @ nostr-tools.js?v=260afb0c:1232
(anonymous) @ nostr-tools.js?v=260afb0c:1253
querySync @ nostr-tools.js?v=260afb0c:1251
get @ nostr-tools.js?v=260afb0c:1266
getLoginObj @ vaultHelpers.ts?t=1768422541175:185
 [WorkerMessenger] Received message: {id: '45ff2367-fda7-4b66-8385-88bc2085820b', method: 'getVaultData', params: {…}, timestamp: 1768436000627}
 [WorkerMessenger] Processing as request
 [WorkerMessenger] Handling request: getVaultData 45ff2367-fda7-4b66-8385-88bc2085820b
 [WorkerMessenger] Calling handler for method: getVaultData
 📥 [getVaultData] ===== REQUEST START =====
 📥 [getVaultData] Full params object: {"username":"cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2"}
 📥 [getVaultData] storagePublicKey: undefined
 📥 [getVaultData] username (legacy): cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2
 📥 [getVaultData] includeEncryptedVault value: undefined
 🔄 [getVaultData] Ensuring crypto ready...
 ✅ [getVaultData] Crypto ready
 🗄️ [getVaultData] Querying IndexedDB with key: cd6c9518950e...
 ✅ [getVaultData] IndexedDB query complete, found: true
 📤 [getVaultData] Retrieved vault data: {username: 'asdr', hasPasswordVerifier: false, hasPasswordSalt: true, hasXprivEncrypted: true, hasRecovery: false, …}
 📤 [getVaultData] Returning result with xprivEncrypted: false
 [WorkerMessenger] Handler completed successfully for method: getVaultData
 [WorkerMessenger] Sending response for request: 45ff2367-fda7-4b66-8385-88bc2085820b error: false
 ❌ [getLoginObj] No LoginObj found
 [link-google] Verifying password...
 [link-google] Creating LoginObj for Google UID...
 [link-google] Creating LoginObj with passwordSalt: 2c3dde554960...
 [link-google] ========================================
 [link-google] Publishing LoginObj to Nostr
 [link-google] Google UID: 0Ymnmq7I1oVe...
 [link-google] Identifier Type: google
 [link-google] Environment: demo
 [link-google] Relays: (5) ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net', 'wss://relay.nostr.band', 'ws://localhost:8080']
 [link-google] displayName (vault username for picker): asdr
 [link-google] googleDisplayName (for settings): lamar@wilsondom.com
 [link-google] ========================================
 [link-google] Current namespace: nostrpass.com
 🔐 [saveLoginObj] LoginObj encrypted with password key (NIP-44)
 📤 [saveLoginObj] Publishing LoginObj: {identifier: '0Ymnmq7I...', identifierType: 'google', environment: 'demo', namespace: 'nostrpass.com', storagePublicKey: 'cd6c9518950e...', …}
 🏷️ [saveLoginObj] Adding display-name tag: {displayName: 'asdr', hasDisplayName: true}
 🏷️ [saveLoginObj] ✅ Added display-name tag: asdr
 📋 [saveLoginObj] FINAL TAGS for Google LoginObj: [
  [
    "d",
    "nostrpass.com_login_fd4aa28f3151e2c684306f8f303280d7538ca8a93c72f3579299e47e7adb618f_google_8adab77fc3c10fa25a8d3cd82d4c06392680053db52d08ea77df1b029569499b_demo"
  ],
  [
    "client",
    "nostrpass.com"
  ],
  [
    "subject",
    "login-lookup"
  ],
  [
    "encryption",
    "password-nip44"
  ],
  [
    "password-salt",
    "2c3dde55496089d51f8d9318e6c3b873fef803b8f59ad2a63eeeb203e79fe56b"
  ],
  [
    "auth-provider",
    "google"
  ],
  [
    "t",
    "gvault_fd4aa28f3151e2c684306f8f303280d7538ca8a93c72f3579299e47e7adb618f"
  ],
  [
    "google-uid-hash",
    "fd4aa28f3151e2c684306f8f303280d7538ca8a93c72f3579299e47e7adb618f"
  ],
  [
    "display-name",
    "asdr"
  ],
  [
    "storage-public-key",
    "cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2"
  ],
  [
    "t",
    "svault_8adab77fc3c10fa25a8d3cd82d4c06392680053db52d08ea77df1b029569499b"
  ],
  [
    "version",
    "2"
  ]
]
 ✅ Published password-encrypted LoginObj (NIP-44) to wss://relay.damus.io [google]
 ✅ Published password-encrypted LoginObj (NIP-44) to wss://nos.lol [google]
 ✅ Published password-encrypted LoginObj (NIP-44) to wss://relay.primal.net [google]
 ✅ Published password-encrypted LoginObj (NIP-44) to wss://relay.nostr.band [google]
 ✅ Published password-encrypted LoginObj (NIP-44) to ws://localhost:8080 [google]
 [link-google] LoginObj published to 5 relays: (5) ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net', 'wss://relay.nostr.band', 'ws://localhost:8080']
 [link-google] Caching LoginObj...
 WebSocket connection to 'ws://localhost:8080/' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED
(anonymous) @ nostr-tools.js?v=260afb0c:717
connect @ nostr-tools.js?v=260afb0c:708
ensureRelay @ nostr-tools.js?v=260afb0c:1092
(anonymous) @ nostr-tools.js?v=260afb0c:1275
publish @ nostr-tools.js?v=260afb0c:1271
saveLoginObj @ vaultHelpers.ts?t=1768422541175:86
 [CryptoWorker] Unhandled rejection: websocket error
(anonymous) @ crypto.worker.ts:8
nostr-tools.js?v=260afb0c:1292 Uncaught (in promise) websocket error
(anonymous) @ nostr-tools.js?v=260afb0c:1292
await in (anonymous)
publish @ nostr-tools.js?v=260afb0c:1271
saveLoginObj @ vaultHelpers.ts?t=1768422541175:86
await in saveLoginObj
handleLinkGoogleAccount @ signup-handler-atomi…t=1768428269414:477
await in handleLinkGoogleAccount
handleRequest @ worker-messenger.ts:136
handleMessage @ worker-messenger.ts:112
boundHandler @ worker-messenger.ts:51
 [link-google] Updating vault linkedAuthProviders...
 [link-google] Looking up vault by storagePublicKey: cd6c9518950e...
 [link-google] Fallback username: asdr
 [link-google] Vault lookup result: {found: true, username: 'asdr', storagePublicKey: 'cd6c9518950e...', existingLinkedAuthProviders: 0}
 [link-google] Calling updateVaultData with syncToNostr: true
 💾 [updateVaultData] Saving vault with: {storagePublicKey: 'cd6c9518950e...', username: 'asdr', version: 3, identitiesCount: 3, hasXprivEncrypted: true, …}
 [Worker] Broadcasting vault update: {type: 'VAULT_DATA_UPDATED', username: 'cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2', data: {…}}
 🔍 [updateVaultData] Checking sync options: {hasOptions: true, syncToNostr: true, willSync: true}
 📡 [updateVaultData] Syncing to Nostr...
 📡 [updateVaultData] Params: {storagePublicKey: 'cd6c9518950e...', username: 'asdr'}
 [WorkerMessenger] Received message: {id: 'f69243f8-d4b1-471e-989f-42095316e371', method: 'getVaultData', params: {…}, timestamp: 1768436003736}
 [WorkerMessenger] Processing as request
 [WorkerMessenger] Handling request: getVaultData f69243f8-d4b1-471e-989f-42095316e371
 [WorkerMessenger] Calling handler for method: getVaultData
 📥 [getVaultData] ===== REQUEST START =====
 📥 [getVaultData] Full params object: {"username":"cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2"}
 📥 [getVaultData] storagePublicKey: undefined
 📥 [getVaultData] username (legacy): cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2
 📥 [getVaultData] includeEncryptedVault value: undefined
 🔄 [getVaultData] Ensuring crypto ready...
 ✅ [getVaultData] Crypto ready
 🗄️ [getVaultData] Querying IndexedDB with key: cd6c9518950e...
 📤 [saveVaultToNostr] Preparing vault for Nostr sync: {storagePublicKey: 'cd6c9518950e...', username: 'asdr', identitiesCount: 3, hasXprivEncrypted: true, hasEncryptedVaultInDB: false, …}
 🔍 [saveVaultToNostr] Session lookup by lookupKey: cd6c9518950e... found: false
 🔍 [saveVaultToNostr] Session not found by storagePublicKey, trying username: asdr
 🔍 [saveVaultToNostr] Session lookup by username: asdr found: true
 🔍 [saveVaultToNostr] Session state: {isUnlocked: true, hasStoragePrivateKey: true, hasXpriv: true, username: 'asdr'}
 ✅ [saveVaultToNostr] Payload created: {identitiesCount: 3, hasXprivEncrypted: true, xprivEncryptedLength: 228, linkedAuthProvidersCount: 1}
 🔐 [WORKER saveVaultToNostr] Starting NIP-04 encryption with STORAGE key...
 🔐 [WORKER saveVaultToNostr] Using storage private key from session
 ✅ [getVaultData] IndexedDB query complete, found: true
 📤 [getVaultData] Retrieved vault data: {username: 'asdr', hasPasswordVerifier: false, hasPasswordSalt: true, hasXprivEncrypted: true, hasRecovery: false, …}
 📤 [getVaultData] Returning result with xprivEncrypted: false
 [WorkerMessenger] Handler completed successfully for method: getVaultData
 [WorkerMessenger] Sending response for request: f69243f8-d4b1-471e-989f-42095316e371 error: false
nostr-sync.ts:799 ✅ [WORKER saveVaultToNostr] Payload encrypted with STORAGE key! {encryptedSize: 2844, identities: 3}
nostr-sync.ts:810 🌍 [WORKER saveVaultToNostr] Using environment: production
nostr-sync.ts:815 🏷️ [WORKER saveVaultToNostr] Event metadata: {dTag: 'nostrpass.com_vault_cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2_production', pubkey: 'cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2', vaultPublicKey: 'cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2', keysMatch: true, env: 'production'}
nostr-sync.ts:823 📤 [saveVaultToNostr] Publishing with d-tag: nostrpass.com_vault_cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2_production
nostr-sync.ts:824 📤 [saveVaultToNostr] Author pubkey: cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2
nostr-sync.ts:825 📤 [saveVaultToNostr] Environment: production
nostr-sync.ts:894 📡 [saveVaultToNostr] Publishing vault event to relays...
nostr-sync.ts:903 WebSocket connection to 'ws://localhost:8080/' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED
(anonymous) @ nostr-tools.js?v=260afb0c:717
connect @ nostr-tools.js?v=260afb0c:708
ensureRelay @ nostr-tools.js?v=260afb0c:1092
(anonymous) @ nostr-tools.js?v=260afb0c:1275
publish @ nostr-tools.js?v=260afb0c:1271
saveVaultToNostr @ nostr-sync.ts:903
vault-operations.ts:386 ❌❌❌ [updateVaultData] FAILED to sync vault to Nostr: websocket error
updateVaultData @ vault-operations.ts:386
await in updateVaultData
handleLinkGoogleAccount @ signup-handler-atomic.ts:777
await in handleLinkGoogleAccount
handleRequest @ worker-messenger.ts:189
handleMessage @ worker-messenger.ts:161
boundHandler @ worker-messenger.ts:87
vault-operations.ts:387 ❌❌❌ [updateVaultData] Data will NOT persist to other devices!
updateVaultData @ vault-operations.ts:387
await in updateVaultData
handleLinkGoogleAccount @ signup-handler-atomic.ts:777
await in handleLinkGoogleAccount
handleRequest @ worker-messenger.ts:189
handleMessage @ worker-messenger.ts:161
boundHandler @ worker-messenger.ts:87
signup-handler-atomic.ts:785 [link-google] ✅ Updated vault with linkedAuthProviders and synced to Nostr: lamar@wilsondom.com
signup-handler-atomic.ts:797 [link-google] Google account linked successfully!
worker-messenger.ts:190 [WorkerMessenger] Handler completed successfully for method: linkGoogleAccount
worker-messenger.ts:233 [WorkerMessenger] Sending response for request: c0c73db3-a689-4c08-9375-a92678f46645 error: false
worker-messenger.ts:152 [WorkerMessenger] Received message: {id: 'dfffec72-9fe4-4498-8bff-fe50c1051a66', method: 'getVaultData', params: {…}, timestamp: 1768436003801}
worker-messenger.ts:156 [WorkerMessenger] Processing as request
worker-messenger.ts:175 [WorkerMessenger] Handling request: getVaultData dfffec72-9fe4-4498-8bff-fe50c1051a66
worker-messenger.ts:188 [WorkerMessenger] Calling handler for method: getVaultData
vault-operations.ts:97 📥 [getVaultData] ===== REQUEST START =====
vault-operations.ts:98 📥 [getVaultData] Full params object: {"username":"cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2"}
vault-operations.ts:99 📥 [getVaultData] storagePublicKey: undefined
vault-operations.ts:100 📥 [getVaultData] username (legacy): cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2
vault-operations.ts:101 📥 [getVaultData] includeEncryptedVault value: undefined
vault-operations.ts:103 🔄 [getVaultData] Ensuring crypto ready...
vault-operations.ts:105 ✅ [getVaultData] Crypto ready
vault-operations.ts:115 🗄️ [getVaultData] Querying IndexedDB with key: cd6c9518950e...
vault-operations.ts:124 ✅ [getVaultData] IndexedDB query complete, found: true
vault-operations.ts:131 📤 [getVaultData] Retrieved vault data: {username: 'asdr', hasPasswordVerifier: false, hasPasswordSalt: true, hasXprivEncrypted: true, hasRecovery: false, …}
vault-operations.ts:183 📤 [getVaultData] Returning result with xprivEncrypted: false
worker-messenger.ts:190 [WorkerMessenger] Handler completed successfully for method: getVaultData
worker-messenger.ts:233 [WorkerMessenger] Sending response for request: dfffec72-9fe4-4498-8bff-fe50c1051a66 error: false
worker-messenger.ts:152 [WorkerMessenger] Received message: {id: '56d1ac77-458a-4db2-a68b-f94d9de0c085', method: 'getVaultData', params: {…}, timestamp: 1768436003904}
worker-messenger.ts:156 [WorkerMessenger] Processing as request
worker-messenger.ts:175 [WorkerMessenger] Handling request: getVaultData 56d1ac77-458a-4db2-a68b-f94d9de0c085
worker-messenger.ts:188 [WorkerMessenger] Calling handler for method: getVaultData
vault-operations.ts:97 📥 [getVaultData] ===== REQUEST START =====
vault-operations.ts:98 📥 [getVaultData] Full params object: {"username":"cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2"}
vault-operations.ts:99 📥 [getVaultData] storagePublicKey: undefined
vault-operations.ts:100 📥 [getVaultData] username (legacy): cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2
vault-operations.ts:101 📥 [getVaultData] includeEncryptedVault value: undefined
vault-operations.ts:103 🔄 [getVaultData] Ensuring crypto ready...
vault-operations.ts:105 ✅ [getVaultData] Crypto ready
vault-operations.ts:115 🗄️ [getVaultData] Querying IndexedDB with key: cd6c9518950e...
vault-operations.ts:124 ✅ [getVaultData] IndexedDB query complete, found: true
vault-operations.ts:131 📤 [getVaultData] Retrieved vault data: {username: 'asdr', hasPasswordVerifier: false, hasPasswordSalt: true, hasXprivEncrypted: true, hasRecovery: false, …}
vault-operations.ts:183 📤 [getVaultData] Returning result with xprivEncrypted: false
worker-messenger.ts:190 [WorkerMessenger] Handler completed successfully for method: getVaultData
worker-messenger.ts:233 [WorkerMessenger] Sending response for request: 56d1ac77-458a-4db2-a68b-f94d9de0c085 error: false
worker-messenger.ts:152 [WorkerMessenger] Received message: {id: '65732712-1d22-4fad-b487-70fefaa12ad2', method: 'getVaultData', params: {…}, timestamp: 1768436003910}
worker-messenger.ts:156 [WorkerMessenger] Processing as request
worker-messenger.ts:175 [WorkerMessenger] Handling request: getVaultData 65732712-1d22-4fad-b487-70fefaa12ad2
worker-messenger.ts:188 [WorkerMessenger] Calling handler for method: getVaultData
vault-operations.ts:97 📥 [getVaultData] ===== REQUEST START =====
vault-operations.ts:98 📥 [getVaultData] Full params object: {"username":"cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2"}
vault-operations.ts:99 📥 [getVaultData] storagePublicKey: undefined
vault-operations.ts:100 📥 [getVaultData] username (legacy): cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2
vault-operations.ts:101 📥 [getVaultData] includeEncryptedVault value: undefined
vault-operations.ts:103 🔄 [getVaultData] Ensuring crypto ready...
vault-operations.ts:105 ✅ [getVaultData] Crypto ready
vault-operations.ts:115 🗄️ [getVaultData] Querying IndexedDB with key: cd6c9518950e...
vault-operations.ts:124 ✅ [getVaultData] IndexedDB query complete, found: true
vault-operations.ts:131 📤 [getVaultData] Retrieved vault data: {username: 'asdr', hasPasswordVerifier: false, hasPasswordSalt: true, hasXprivEncrypted: true, hasRecovery: false, …}
vault-operations.ts:183 📤 [getVaultData] Returning result with xprivEncrypted: false
worker-messenger.ts:190 [WorkerMessenger] Handler completed successfully for method: getVaultData
worker-messenger.ts:233 [WorkerMessenger] Sending response for request: 65732712-1d22-4fad-b487-70fefaa12ad2 error: false
worker-messenger.ts:152 [WorkerMessenger] Received message: {id: '3ca37adf-6a95-4404-8f10-50a759b33ef8', method: 'getVaultData', params: {…}, timestamp: 1768436003916}
worker-messenger.ts:156 [WorkerMessenger] Processing as request
worker-messenger.ts:175 [WorkerMessenger] Handling request: getVaultData 3ca37adf-6a95-4404-8f10-50a759b33ef8
worker-messenger.ts:188 [WorkerMessenger] Calling handler for method: getVaultData
vault-operations.ts:97 📥 [getVaultData] ===== REQUEST START =====
vault-operations.ts:98 📥 [getVaultData] Full params object: {"username":"cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2"}
vault-operations.ts:99 📥 [getVaultData] storagePublicKey: undefined
vault-operations.ts:100 📥 [getVaultData] username (legacy): cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2
vault-operations.ts:101 📥 [getVaultData] includeEncryptedVault value: undefined
vault-operations.ts:103 🔄 [getVaultData] Ensuring crypto ready...
vault-operations.ts:105 ✅ [getVaultData] Crypto ready
vault-operations.ts:115 🗄️ [getVaultData] Querying IndexedDB with key: cd6c9518950e...
vault-operations.ts:124 ✅ [getVaultData] IndexedDB query complete, found: true
vault-operations.ts:131 📤 [getVaultData] Retrieved vault data: {username: 'asdr', hasPasswordVerifier: false, hasPasswordSalt: true, hasXprivEncrypted: true, hasRecovery: false, …}
vault-operations.ts:183 📤 [getVaultData] Returning result with xprivEncrypted: false
worker-messenger.ts:190 [WorkerMessenger] Handler completed successfully for method: getVaultData
worker-messenger.ts:233 [WorkerMessenger] Sending response for request: 3ca37adf-6a95-4404-8f10-50a759b33ef8 error: false
nostr-sync.ts:365 🔔 [Worker] onevent callback FIRED! Real-time event received: {kind: 30078, id: 'bb60db4e19e3', created_at: '2026-01-15T00:13:23.000Z', receivedAt: '2026-01-15T00:13:24.028Z', lagMs: 1028}
nostr-sync.ts:255 📨 [Worker] Received Nostr vault event: {kind: 30078, d: 'nostrpass.com_login_fd4aa28f3151e2c684306f8f303280', created_at: '2026-01-15T00:13:23.000Z', eventId: 'bb60db4e19e3'}
nostr-sync.ts:348 ℹ️ [Worker] Ignoring non-vault event: nostrpass.com_login_
nostr-sync.ts:365 🔔 [Worker] onevent callback FIRED! Real-time event received: {kind: 30078, id: '4a4da03108fd', created_at: '2026-01-15T00:13:23.000Z', receivedAt: '2026-01-15T00:13:24.248Z', lagMs: 1248}
nostr-sync.ts:255 📨 [Worker] Received Nostr vault event: {kind: 30078, d: 'nostrpass.com_vault_cd6c9518950e307de379dc8feea0dc', created_at: '2026-01-15T00:13:23.000Z', eventId: '4a4da03108fd'}
nostr-sync.ts:269 📥 [Worker] Processing full vault snapshot: {d: 'nostrpass.com_vault_cd6c9518950e307de379', eventId: '4a4da03108fd'}
nostr-sync.ts:283 ✅ [Worker] Decrypted vault successfully
nostr-sync.ts:292 🔑 [Worker Subscription] Looking up local vault by storagePublicKey: cd6c9518950e...
nostr-sync.ts:299 📊 [Worker] Vault timestamp comparison: {remoteTimestamp: 1768436003, localTimestamp: 1768436003, remoteDate: '2026-01-15T00:13:23.000Z', localDate: '2026-01-15T00:13:23.734Z', remoteIdentities: 3, …}
nostr-sync.ts:344 ℹ️ [Worker] Local vault is newer or equal, skipping update
crypto.worker.ts:11 [CryptoWorker] Unhandled rejection: Error: publish timed out
    at nostr-tools.js?v=260afb0c:927:21
(anonymous) @ crypto.worker.ts:11
nostr-tools.js?v=260afb0c:927 Uncaught (in promise) Error: publish timed out
    at nostr-tools.js?v=260afb0c:927:21
(anonymous) @ nostr-tools.js?v=260afb0c:927
setTimeout
(anonymous) @ nostr-tools.js?v=260afb0c:924
publish @ nostr-tools.js?v=260afb0c:923
(anonymous) @ nostr-tools.js?v=260afb0c:1276
await in (anonymous)
publish @ nostr-tools.js?v=260afb0c:1271
saveLoginObj @ vaultHelpers.ts:172
await in saveLoginObj
handleLinkGoogleAccount @ signup-handler-atomic.ts:708
await in handleLinkGoogleAccount
handleRequest @ worker-messenger.ts:189
handleMessage @ worker-messenger.ts:161
boundHandler @ worker-messenger.ts:87
worker-messenger.ts:152 [WorkerMessenger] Received message: {id: 'bf22b05a-b021-4dd8-b835-cec36176e300', method: 'getVaultData', params: {…}, timestamp: 1768436031107}
worker-messenger.ts:156 [WorkerMessenger] Processing as request
worker-messenger.ts:175 [WorkerMessenger] Handling request: getVaultData bf22b05a-b021-4dd8-b835-cec36176e300
worker-messenger.ts:188 [WorkerMessenger] Calling handler for method: getVaultData
vault-operations.ts:97 📥 [getVaultData] ===== REQUEST START =====
vault-operations.ts:98 📥 [getVaultData] Full params object: {"username":"cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2"}
vault-operations.ts:99 📥 [getVaultData] storagePublicKey: undefined
vault-operations.ts:100 📥 [getVaultData] username (legacy): cd6c9518950e307de379dc8feea0dcede16894bf345f094d17bdff068e69bad2
vault-operations.ts:101 📥 [getVaultData] includeEncryptedVault value: undefined
vault-operations.ts:103 🔄 [getVaultData] Ensuring crypto ready...
vault-operations.ts:105 ✅ [getVaultData] Crypto ready
vault-operations.ts:115 🗄️ [getVaultData] Querying IndexedDB with key: cd6c9518950e...
vault-operations.ts:124 ✅ [getVaultData] IndexedDB query complete, found: true
vault-operations.ts:131 📤 [getVaultData] Retrieved vault data: {username: 'asdr', hasPasswordVerifier: false, hasPasswordSalt: true, hasXprivEncrypted: true, hasRecovery: false, …}
vault-operations.ts:183 📤 [getVaultData] Returning result with xprivEncrypted: false
worker-messenger.ts:190 [WorkerMessenger] Handler completed successfully for method: getVaultData
worker-messenger.ts:233 [WorkerMessenger] Sending response for request: bf22b05a-b021-4dd8-b835-cec36176e300 error: false
nostr-sync.ts:408 🔄 [Worker] Running periodic vault poll (backup) for asdr
nostr-sync.ts:92 WebSocket connection to 'ws://localhost:8080/' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED
(anonymous) @ nostr-tools.js?v=260afb0c:717
connect @ nostr-tools.js?v=260afb0c:708
ensureRelay @ nostr-tools.js?v=260afb0c:1092
(anonymous) @ nostr-tools.js?v=260afb0c:1186
subscribeMap @ nostr-tools.js?v=260afb0c:1183
subscribe @ nostr-tools.js?v=260afb0c:1111
subscribeEose @ nostr-tools.js?v=260afb0c:1232
(anonymous) @ nostr-tools.js?v=260afb0c:1253
querySync @ nostr-tools.js?v=260afb0c:1251
pollOnceAndApply @ nostr-sync.ts:92
(anonymous) @ nostr-sync.ts:409
nostr-sync.ts:92 WebSocket connection to 'wss://relay.nostr.band/' failed: Error during WebSocket handshake: Unexpected response code: 502
(anonymous) @ nostr-tools.js?v=260afb0c:717
connect @ nostr-tools.js?v=260afb0c:708
ensureRelay @ nostr-tools.js?v=260afb0c:1092
(anonymous) @ nostr-tools.js?v=260afb0c:1186
subscribeMap @ nostr-tools.js?v=260afb0c:1183
subscribe @ nostr-tools.js?v=260afb0c:1111
subscribeEose @ nostr-tools.js?v=260afb0c:1232
(anonymous) @ nostr-tools.js?v=260afb0c:1253
querySync @ nostr-tools.js?v=260afb0c:1251
pollOnceAndApply @ nostr-sync.ts:92
(anonymous) @ nostr-sync.ts:409
nostr-sync.ts:104 📥 [Worker Poll] Decrypted vault event with storage key: {identitiesCount: 3, version: 1}
nostr-sync.ts:119 🔑 [Worker Poll] Looking up vault by storagePublicKey: cd6c9518950e...
nostr-sync.ts:126 ⏱️ [Worker Poll] Comparing timestamps: {remoteTimestamp: 1768436003, localTimestamp: 1768436003, remoteDate: '2026-01-15T00:13:23.000Z', localDate: '2026-01-15T00:13:23.734Z', remoteIdentities: 3, …}
nostr-sync.ts:163 ⏭️ [Worker Poll] Skipping older/same vault (local is newer or equal)
