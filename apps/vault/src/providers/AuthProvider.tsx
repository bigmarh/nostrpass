import { createContext, useContext, ParentComponent, createSignal, createEffect, onMount } from 'solid-js';
import { sanitizeDomain } from '@nostrpass/nostrHelpers';
import { useMessenger } from './MessengerProvider';
import { useEnvironment } from './EnvironmentProvider';
import type { User, UserProfile, LoginObj, VaultObj } from '@nostrpass/types';
import { createUser, getIdentityKeypair } from '../services/userService';
import { getCryptoWorker, getCryptoWorkerInstance } from '../services/cryptoWorkerSingleton';
import { setupMessageHandlers } from '../messageHandlers';
import type { VaultData } from '@nostrpass/nostrHelpers';

interface AuthContextType {
  user: () => User | null;
  isAuthenticated: () => boolean;
  isLoading: () => boolean;
  hasPinVault: () => boolean;
  isVaultLocked: () => boolean;
  login: (password: string, username: string) => Promise<void>;
  createAccount: (username: string, password: string, pin: string, recovery?: { questions: string[], answers: string[] }) => Promise<{ publicKey: string }>;
  logout: () => Promise<void>;
  updateProfile: (profile: Partial<UserProfile>) => void;
  unlockVault: (pin: string) => Promise<boolean>;
  lockVault: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>();

export const AuthProvider: ParentComponent = (props) => {
  const [user, setUser] = createSignal<User | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);
    const [hasPinVault, setHasPinVault] = createSignal(false);
  const [isVaultLocked, setIsVaultLocked] = createSignal(true);
  const messenger = useMessenger();
  const { getRelays, environmentName } = useEnvironment();
  const cryptoWorker = getCryptoWorker();

  // Update isVaultLocked based on conditions
  createEffect(() => {
    const currentUser = user();
    
    if (!currentUser || !cryptoWorker) {
      setIsVaultLocked(true);
      return;
    }

    // Vault is locked if it has PIN protection and hasn't been unlocked
    // hasPinVault indicates PIN is required but not yet entered
    if (hasPinVault()) {
      setIsVaultLocked(true);
    }
  });

  // Handle session expired notifications from worker
  createEffect(() => {
    try {
      const workerInstance = getCryptoWorkerInstance();
      if (!workerInstance) return;
      
      // Listen for session messages from worker
      const handleWorkerMessage = (event: MessageEvent) => {
        const currentUser = user();
        
        // Handle vault broadcasts (for all tabs)
        if (event.data?.type === 'VAULT_BROADCAST') {
          console.log('📡 Raw broadcast message received:', event.data);
          const { broadcastType, username, timestamp, ...data } = event.data.data;
          console.log(`📡 Vault broadcast received: ${broadcastType} for ${username}`, { timestamp, data });
          
          // Handle different broadcast types
          switch (broadcastType) {
            case 'VAULT_DATA_UPDATED':
              // Refresh vault data in all tabs
              if (currentUser?.profile.username === username) {
                console.log('🔄 Refreshing vault data due to broadcast');
                // Trigger vault data refresh
                const refreshEvent = new CustomEvent('vault-data-refresh', { 
                  detail: { username, timestamp } 
                });
                console.log('📤 Dispatching vault-data-refresh event:', refreshEvent);
                window.dispatchEvent(refreshEvent);
                console.log('✅ Vault-data-refresh event dispatched');
              } else {
                console.log('❌ Username mismatch in AuthProvider:', { 
                  currentUsername: currentUser?.profile.username, 
                  broadcastUsername: username 
                });
              }
              break;
              
            case 'USER_LOGGED_IN':
              // Another tab logged in - refresh session status
              console.log('🔄 User logged in from another tab');
              // Always attempt to restore session locally
              attemptSessionRestore();
              // Notify parent app that user is now authenticated (locked until PIN)
              if (messenger.isReady() && currentUser?.publicKey) {
                messenger.send('AUTH_STATUS', {
                  isAuthenticated: false,
                  publicKey: currentUser.publicKey
                });
              }
              // Refresh session status
              window.dispatchEvent(new CustomEvent('session-refresh', { 
                detail: { username, timestamp } 
              }));
              break;
            case 'SESSION_REFRESH':
              console.log('🔄 Session refresh broadcast received (worker)');
              attemptSessionRestore();
              break;
              
            case 'USER_LOGGED_OUT':
              // Another tab logged out - clear local state
              if (currentUser?.profile.username === username) {
                console.log('🔄 User logged out from another tab');
                // Clear local state
                setUser(null);
                setHasPinVault(false);
                setIsVaultLocked(true);
                localStorage.removeItem('vaultsession');
                localStorage.removeItem('last-username');
                // Notify parent app about auth change
                if (messenger.isReady()) {
                  messenger.send('AUTH_STATUS', {
                    isAuthenticated: false,
                    publicKey: null
                  });
                }
              }
              break;
              
            case 'SESSION_UNLOCKED':
              // Another tab unlocked the vault
              if (currentUser?.profile.username === username) {
                console.log('🔓 Vault unlocked from another tab');
                setIsVaultLocked(false);
                setHasPinVault(false);
              }
              break;
              
            case 'SESSION_LOCKED':
              // Another tab locked the vault
              if (currentUser?.profile.username === username) {
                console.log('🔒 Vault locked from another tab');
                setIsVaultLocked(true);
                setHasPinVault(true);
              }
              break;
          }
          return;
        }
        
        // Handle existing session messages
        if (event.data?.type === 'SESSION_EXPIRED' || event.data?.type === 'SESSION_LOCKED') {
          const { username, reason } = event.data.data;
          
          if (currentUser?.profile.username === username) {
            console.log(`🔒 Vault lock notification received for: ${username}, reason: ${reason || event.data.type}`);
            
            // This should already be locked, but ensure UI is in sync
            setIsVaultLocked(true);
            setHasPinVault(true);
            
            // Clear username
            localStorage.removeItem('last-username');
            
            // Notify parent of auth status change
            if (messenger.isReady()) {
              messenger.send('AUTH_STATUS', {
                isAuthenticated: false,
                publicKey: null,
                reason: reason || 'session_expired'
              });
            }
            
            // Show notification to user (optional)
            console.log('🔒 Vault locked due to:', reason || 'session expiry');
          }
        }
      };
      
      // Add listener to worker
      workerInstance.addEventListener('message', handleWorkerMessage);
      
      // Set up BroadcastChannel listener for cross-tab communication
      let broadcastChannel: BroadcastChannel | null = null;
      if (typeof BroadcastChannel !== 'undefined') {
        broadcastChannel = new BroadcastChannel('nostrpass-vault');
        broadcastChannel.onmessage = (event) => {
          console.log('📡 BroadcastChannel message received:', event.data);
          if (event.data?.type === 'VAULT_BROADCAST') {
            // Handle the same broadcast types as worker messages
            const { broadcastType, username, timestamp, ...data } = event.data.data;
            console.log(`📡 BroadcastChannel vault broadcast: ${broadcastType} for ${username}`, { timestamp, data });
            
            const currentUser = user();
            
            switch (broadcastType) {
              case 'VAULT_DATA_UPDATED':
                if (currentUser?.profile.username === username) {
                  console.log('🔄 Refreshing vault data due to BroadcastChannel');
                  const refreshEvent = new CustomEvent('vault-data-refresh', { 
                    detail: { username, timestamp } 
                  });
                  window.dispatchEvent(refreshEvent);
                }
                break;
                
              case 'SESSION_UNLOCKED':
                if (currentUser?.profile.username === username) {
                  console.log('🔓 Vault unlocked from another tab (BroadcastChannel) – refreshing local session status');
                  // Do NOT flip local UI to unlocked blindly; refresh from worker
                  refreshSessionStatus();
                }
                break;
                
              case 'SESSION_LOCKED':
                if (currentUser?.profile.username === username) {
                  console.log('🔒 Vault locked from another tab (BroadcastChannel)');
                  setIsVaultLocked(true);
                  setHasPinVault(true);
                }
                break;
              case 'USER_LOGGED_OUT':
                if (currentUser?.profile.username === username) {
                  console.log('🔄 User logged out from another tab (BroadcastChannel)');
                  setUser(null);
                  setHasPinVault(false);
                  setIsVaultLocked(true);
                  localStorage.removeItem('vaultsession');
                  localStorage.removeItem('last-username');
                  if (messenger.isReady()) {
                    messenger.send('AUTH_STATUS', {
                      isAuthenticated: false,
                      publicKey: null
                    });
                  }
                }
                break;
              case 'USER_LOGGED_IN':
                console.log('🔄 User logged in from another tab (BroadcastChannel)');
                // Try to restore session on this tab
                attemptSessionRestore();
                if (messenger.isReady() && currentUser?.publicKey) {
                  messenger.send('AUTH_STATUS', {
                    isAuthenticated: false,
                    publicKey: currentUser.publicKey
                  });
                }
                window.dispatchEvent(new CustomEvent('session-refresh', {
                  detail: { username, timestamp }
                }));
                break;
              case 'SESSION_REFRESH':
                console.log('🔄 Session refresh broadcast received (BroadcastChannel)');
                attemptSessionRestore();
                break;
            }
          }
        };
        console.log('✅ BroadcastChannel listener set up');
      }
      
      // Cleanup
      return () => {
        workerInstance.removeEventListener('message', handleWorkerMessage);
        if (broadcastChannel) {
          broadcastChannel.close();
          console.log('🧹 BroadcastChannel listener cleaned up');
        }
      };
    } catch (error) {
      console.error('Failed to set up worker message listener:', error);
    }
  });
  
  // Session management on mount
  onMount(async () => {
    if (!cryptoWorker) return;
    
    console.log('Checking session status...');
    
    // Get session status from worker
    const { VaultDataService } = await import('../services/vaultDataService');
    const vaultDataService = VaultDataService.getInstance();
    const sessionStatus = await vaultDataService.getSessionStatus();
    
    console.log('Session status from worker:', sessionStatus);
    
    // Update localStorage based on worker's session status
    if (sessionStatus.sessionId && sessionStatus.username) {
      localStorage.setItem('vaultsession', sessionStatus.sessionId);
      localStorage.setItem('last-username', sessionStatus.username);
      console.log('Session restored from worker:', sessionStatus.username);
      
      // Restore user state from worker session
      try {
        const vaultData = await cryptoWorker.getVaultData({ username: sessionStatus.username });
        if (vaultData) {
          // Check if the session is actually unlocked
          const sessionInfo = await cryptoWorker.getSession({ username: sessionStatus.username });
          // Treat UI as unlocked ONLY if keys are present in worker
          const keyStatus = await cryptoWorker.hasKeysInSession({ username: sessionStatus.username });
          const isUnlocked = !!(keyStatus?.hasPrivateKey || keyStatus?.hasXpriv);
          
          // Create user object from vault data
          const restoredUser: User = {
            publicKey: vaultData.publicKey,
            privateKey: '', // Private key stays in worker
            profile: {
              username: vaultData.username,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              preferences: {},
              security: {
                sessionTimeout: 60
              }
            },
            appPermissions: new Map(),
            isAuthenticated: true, // User is authenticated since session exists
            session: {
              startedAt: Date.now(),
              lastActivityAt: Date.now()
            }
          };
          
          setUser(restoredUser);
          setHasPinVault(true); // PIN is always required after restart
          setIsVaultLocked(!isUnlocked); // If keys missing, show locked
          
          if (isUnlocked) {
            console.log('✅ User session restored successfully (unlocked)');
          } else {
            console.log('✅ User session restored successfully (locked - PIN required)');
          }
        }
      } catch (error) {
        console.error('Failed to restore user session:', error);
        // Clear invalid session
        localStorage.removeItem('vaultsession');
        localStorage.removeItem('last-username');
      }
    } else {
      localStorage.removeItem('vaultsession');
      localStorage.removeItem('last-username');
      console.log('No active session found');
    }

    // Listen for session refresh events from other tabs
    const handleSessionRefresh = (event: CustomEvent) => {
      const { username: eventUsername } = event.detail;
      const currentUser = user();
      
      if (currentUser?.profile.username === eventUsername) {
        console.log('🔄 Refreshing session status due to broadcast from another tab');
        refreshSessionStatus();
      } else if (!currentUser) {
        console.log('🔄 No local user set; attempting session restore');
        attemptSessionRestore();
      }
    };

    window.addEventListener('session-refresh', handleSessionRefresh as EventListener);
    
    return () => {
      window.removeEventListener('session-refresh', handleSessionRefresh as EventListener);
    };
  });

  // Helper function to refresh session status
  const refreshSessionStatus = async () => {
    if (!cryptoWorker) return;
    
    try {
      const currentUser = user();
      if (!currentUser) return;
      
      // Consider UI unlocked only when keys are actually present
      const keyStatus = await cryptoWorker.hasKeysInSession({ username: currentUser.profile.username });
      const isUnlocked = !!(keyStatus?.hasPrivateKey || keyStatus?.hasXpriv);
      
      setIsVaultLocked(!isUnlocked);
      setHasPinVault(!isUnlocked);
      
      console.log('🔄 Session status refreshed:', { isUnlocked });
    } catch (error) {
      console.error('Failed to refresh session status:', error);
    }
  };

  // Attempt to restore a session from the worker/IndexedDB if one exists
  async function attemptSessionRestore() {
    if (!cryptoWorker) return;
    try {
      const { VaultDataService } = await import('../services/vaultDataService');
      const vaultDataService = VaultDataService.getInstance();
      const sessionStatus = await vaultDataService.getSessionStatus();
      if (sessionStatus.sessionId && sessionStatus.username) {
        localStorage.setItem('vaultsession', sessionStatus.sessionId);
        localStorage.setItem('last-username', sessionStatus.username);
        try {
          const vaultData = await cryptoWorker.getVaultData({ username: sessionStatus.username });
          if (vaultData) {
            const keyStatus = await cryptoWorker.hasKeysInSession({ username: sessionStatus.username });
            const isUnlocked = !!(keyStatus?.hasPrivateKey || keyStatus?.hasXpriv);
            const restoredUser: User = {
              publicKey: vaultData.publicKey,
              privateKey: '',
              profile: {
                username: vaultData.username,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                preferences: {},
                security: { sessionTimeout: 60 }
              },
              appPermissions: new Map(),
              isAuthenticated: true,
              session: { startedAt: Date.now(), lastActivityAt: Date.now() }
            };
            setUser(restoredUser);
            setHasPinVault(true);
            setIsVaultLocked(!isUnlocked);
            console.log('✅ Session restored from worker broadcast (unlocked?:', isUnlocked, ')');
          }
        } catch (e) {
          console.error('Failed to restore user after session broadcast:', e);
        }
      }
    } catch (e) {
      console.error('attemptSessionRestore error:', e);
    }
  }

  // Set up message handlers for auth-related requests
  createEffect(() => {
    if (!messenger.isReady() || !messenger.messenger) return;

    // Enforce authorization/active identity mapping for all ops (no bypass)
    const DEV_BYPASS = false;
    const appKeyFromOrigin = (origin: string): string => {
      try {
        const u = new URL(origin);
        return sanitizeDomain(u.host);
      } catch {
        return sanitizeDomain(origin);
      }
    };

    // Resolve the ACTIVE identity index for a given app origin
    const getAppIdentityIndexForOrigin = async (username: string, origin: string): Promise<number> => {
      if (!cryptoWorker) throw new Error('Crypto not ready');
      const vaultData = await cryptoWorker.getVaultData({ username });
      if (!vaultData?.identities || vaultData.identities.length === 0) {
        throw new Error('No identities found');
      }
      if (DEV_BYPASS) {
        // Use first identity when bypassing gates
        return 0;
      } else {
        const appKey = appKeyFromOrigin(origin);
        let activeIndex = vaultData.activeIdentityByApp?.[appKey];
        // Fallback: if active not set yet, infer from authorization
        if (activeIndex === undefined || activeIndex === null) {
          activeIndex = vaultData.identities.findIndex((id: any) => id?.appPermissions && id.appPermissions[appKey]);
        }
        if (activeIndex === -1 || activeIndex === undefined || activeIndex === null) {
          throw new Error('No active identity selected for this application');
        }
        const identity = vaultData.identities[activeIndex];
        if (!identity?.appPermissions || !identity.appPermissions[appKey]) {
          throw new Error('Selected identity is not authorized for this application');
        }
        return activeIndex;
      }
    };

    // Handle public key requests from parent - NIP-07 compliant
    messenger.messenger.route('GET_PUBLIC_KEY', {
      handler: async (_data: any, context: any) => {
        const currentUser = user();
        if (!currentUser) {
          throw new Error('User not authenticated');
        }

        const origin = context?.origin || 'unknown';
        if (!cryptoWorker) throw new Error('Crypto not ready');
        if (!currentUser.profile?.username) throw new Error('No username');

        const vaultData = await cryptoWorker.getVaultData({ username: currentUser.profile.username });

        // Only allow if identity is connected to this app
        const idx = await getAppIdentityIndexForOrigin(currentUser.profile.username, origin);
        const identity = vaultData?.identities?.[idx];
        if (!identity?.publicKey) throw new Error('No connected identity public key');
        return identity.publicKey;
      }
    });

    // Handle sign event requests
    messenger.messenger.route('SIGN_EVENT', {
      handler: async (data: any, context: any) => {
        const currentUser = user();
        if (!currentUser || !cryptoWorker) {
          throw new Error('User not authenticated or crypto not ready');
        }

        // If session rehydrated without keys, ask Embassy to prompt for PIN
        try {
          const ks = await cryptoWorker.hasKeysInSession({ username: currentUser.profile.username });
          if (!ks?.hasPrivateKey && !ks?.hasXpriv) {
            try {
              messenger.send('PROMPT_REQUIRED', {
                promptType: 'PIN_PAD',
                reason: 'SIGN_EVENT_MISSING_KEYS',
                eventKind: data?.event?.kind,
                origin: context?.origin || 'unknown'
              });
            } catch {}
            throw new Error('Session rehydrated without keys; unlock with PIN');
          }
        } catch {}

        // Gate on vault lock state (do NOT rely on privateKey presence in UI thread)
        if (isVaultLocked()) {
          try {
            messenger.send('PROMPT_REQUIRED', {
              promptType: 'PIN_PAD',
              reason: 'SIGN_EVENT',
              eventKind: data?.event?.kind,
              origin: context?.origin || 'unknown'
            });
          } catch {}
          throw new Error('Vault is locked. Please unlock with PIN.');
        }

        const origin = context?.origin || 'unknown';
        const identityIndex = await getAppIdentityIndexForOrigin(currentUser.profile.username, origin);

        // Ensure event has required fields (pubkey, created_at)
        try {
          const vdata = await cryptoWorker.getVaultData({ username: currentUser.profile.username });
          const identity = vdata?.identities?.[identityIndex];
          if (identity?.publicKey) {
            if (!data.event) data.event = {};
            if (!data.event.pubkey) data.event.pubkey = identity.publicKey;
            if (!data.event.created_at) data.event.created_at = Math.floor(Date.now() / 1000);
          }
        } catch {}

        // Use session-based signing in worker
        try {
          const result = await cryptoWorker.signEventWithSession({
            username: currentUser.profile.username,
            event: data.event,
            identityIndex
          });
          // NIP-07: signEvent() returns the signed event object directly
          return result.event;
        } catch (err: any) {
          const msg = err instanceof Error ? err.message : String(err ?? 'SIGN_EVENT failed');
          throw new Error(msg);
        }
      }
    });

    // Handle sign data requests
    messenger.messenger.route('SIGN_DATA', {
      handler: async (data: { data: string }, context: any) => {
        const currentUser = user();
        if (!currentUser || !cryptoWorker) {
          throw new Error('User not authenticated or crypto not ready');
        }

        // Preflight: prompt for PIN if keys missing
        try {
          const ks = await cryptoWorker.hasKeysInSession({ username: currentUser.profile.username });
          if (!ks?.hasPrivateKey && !ks?.hasXpriv) {
            try {
              messenger.send('PROMPT_REQUIRED', {
                promptType: 'PIN_PAD',
                reason: 'SIGN_DATA_MISSING_KEYS',
                origin: context?.origin || 'unknown'
              });
            } catch {}
            throw new Error('Session rehydrated without keys; unlock with PIN');
          }
          // Post-unlock settle: if just unlocked, give worker a brief moment to attach keys
          if (!ks?.hasPrivateKey) {
            for (let i = 0; i < 5; i++) {
              await new Promise(r => setTimeout(r, 120));
              const again = await cryptoWorker.hasKeysInSession({ username: currentUser.profile.username });
              if (again?.hasPrivateKey || again?.hasXpriv) break;
              if (i === 4) {
                throw new Error('Session rehydrated without keys; unlock with PIN');
              }
            }
          }
        } catch {}

        // Gate on vault lock state
        if (isVaultLocked()) {
          try {
            messenger.send('PROMPT_REQUIRED', {
              promptType: 'PIN_PAD',
              reason: 'SIGN_DATA',
              origin: context?.origin || 'unknown'
            });
          } catch {}
          throw new Error('Vault is locked. Please unlock with PIN.');
        }

        const origin = context?.origin || 'unknown';
        const identityIndex = await getAppIdentityIndexForOrigin(currentUser.profile.username, origin);

        // Use session-based signing for arbitrary data
        try {
          const result = await cryptoWorker.signMessageWithSession({
            username: currentUser.profile.username,
            message: data.data,
            identityIndex
          });
          return { signature: result.signature };
        } catch (err: any) {
          // Normalize error for messenger
          const msg = err instanceof Error ? err.message : String(err ?? 'Sign data failed');
          throw new Error(msg);
        }
      }
    });

    // Handle encrypt requests (NIP-04)
    messenger.messenger.route('ENCRYPT', {
      handler: async (data: { plaintext: string; recipientPubkey: string }, context: any) => {
        const currentUser = user();
        if (!currentUser || !cryptoWorker) {
          throw new Error('User not authenticated or crypto not ready');
        }

        // Preflight: prompt for PIN if keys missing
        try {
          const ks = await cryptoWorker.hasKeysInSession({ username: currentUser.profile.username });
          if (!ks?.hasPrivateKey && !ks?.hasXpriv) {
            try {
              messenger.send('PROMPT_REQUIRED', {
                promptType: 'PIN_PAD',
                reason: 'ENCRYPT_MISSING_KEYS',
                origin: context?.origin || 'unknown'
              });
            } catch {}
            throw new Error('Session rehydrated without keys; unlock with PIN');
          }
        } catch {}

        // Gate on vault lock state
        if (isVaultLocked()) {
          try {
            messenger.send('PROMPT_REQUIRED', {
              promptType: 'PIN_PAD',
              reason: 'ENCRYPT',
              origin: context?.origin || 'unknown'
            });
          } catch {}
          throw new Error('Vault is locked. Please unlock with PIN.');
        }

        const origin = context?.origin || 'unknown';
        const identityIndex = await getAppIdentityIndexForOrigin(currentUser.profile.username, origin);

        // Use session-based encryption
        const encrypted = await cryptoWorker.encryptWithSession({
          username: currentUser.profile.username,
          plaintext: data.plaintext,
          recipientPubkey: data.recipientPubkey,
          identityIndex
        });

        // NIP-07: nip04.encrypt() returns just the encrypted string
        return encrypted;
      }
    });

    // Handle decrypt requests (NIP-04)
    messenger.messenger.route('DECRYPT', {
      handler: async (data: { ciphertext: string; senderPubkey: string }, context: any) => {
        const currentUser = user();
        if (!currentUser || !cryptoWorker) {
          throw new Error('User not authenticated or crypto not ready');
        }

        // Preflight: prompt for PIN if keys missing
        try {
          const ks = await cryptoWorker.hasKeysInSession({ username: currentUser.profile.username });
          if (!ks?.hasPrivateKey && !ks?.hasXpriv) {
            try {
              messenger.send('PROMPT_REQUIRED', {
                promptType: 'PIN_PAD',
                reason: 'DECRYPT_MISSING_KEYS',
                origin: context?.origin || 'unknown'
              });
            } catch {}
            throw new Error('Session rehydrated without keys; unlock with PIN');
          }
        } catch {}

        // Gate on vault lock state
        if (isVaultLocked()) {
          try {
            messenger.send('PROMPT_REQUIRED', {
              promptType: 'PIN_PAD',
              reason: 'DECRYPT',
              origin: context?.origin || 'unknown'
            });
          } catch {}
          throw new Error('Vault is locked. Please unlock with PIN.');
        }

        const origin = context?.origin || 'unknown';
        const identityIndex = await getAppIdentityIndexForOrigin(currentUser.profile.username, origin);

        // Use session-based decryption
        const decrypted = await cryptoWorker.decryptWithSession({
          username: currentUser.profile.username,
          ciphertext: data.ciphertext,
          senderPubkey: data.senderPubkey,
          identityIndex
        });

        // NIP-07: nip04.decrypt() returns just the decrypted string
        return decrypted;
      }
    });

    // Unlock with PIN (called by Embassy after PIN prompt)
    messenger.messenger.route('UNLOCK_WITH_PIN', {
      handler: async (data: { pin: string }) => {
        if (!data?.pin) {
          throw new Error('PIN is required');
        }
        const success = await unlockVault(data.pin);
        // Broadcast updated auth status to parent immediately so cross-tab preflight sees unlocked
        try {
          messenger.send('AUTH_STATUS', {
            isAuthenticated: !!user(),
            publicKey: user()?.publicKey || null
          });
        } catch {}
        return { success };
      }
    });

    // Preflight permission check
    messenger.messenger.route('CHECK_PERMISSION', {
      handler: async (data: { action: 'getPublicKey' | 'signEvent' | 'signData' | 'nip04' | 'getRelays'; eventKind?: number }, context: any) => {
        const currentUser = user();
        if (!currentUser || !cryptoWorker) {
          throw new Error('User not authenticated or crypto not ready');
        }

        const rawOrigin = context?.origin || 'unknown';
        const appKey = appKeyFromOrigin(rawOrigin);
        const result = await cryptoWorker.checkPermission({
          username: currentUser.profile.username,
          origin: appKey,
          action: data.action,
          eventKind: data.eventKind
        });
        // If vault is unlocked in UI and worker should also be unlocked, cheerfully clear needsPrompt
        const isLocked = isVaultLocked();
        const normalized = isLocked ? result : { ...result, needsPrompt: false };
        return { ...normalized, isLocked };
      }
    });

    // Handle auth status requests
    messenger.messenger.route('GET_AUTH_STATUS', {
      handler: () => {
        return {
          isAuthenticated: !!user(),
          publicKey: user()?.publicKey || null
        };
      }
    });
    
    // Handle auth status response (acknowledgment from parent)
    messenger.messenger.route('AUTH_STATUS_RESPONSE', {
      handler: (data: any) => {
        // Just acknowledge - parent is confirming receipt of AUTH_STATUS
        console.log('Auth status acknowledged by parent:', data);
      }
    });
  });

  const createAccount = async (
    username: string, 
    password: string, 
    pin: string, // PIN is now mandatory
    recovery?: { questions: string[], answers: string[] }
  ) => {
    if (!cryptoWorker) throw new Error('Crypto worker not ready');
    if (!pin || pin.length < 4) throw new Error('PIN must be at least 4 digits');
    
    setIsLoading(true);
    try {
      // Create new user with xpriv and Personal identity
      const userMasterKey = await createUser();
      console.log('Created user master key:', userMasterKey);
      
      // Get the keypair for the Personal identity (index 0)
      const personalIdentity = userMasterKey.identities[0];
      console.log('Personal identity:', personalIdentity);
      
      // Get storage public key only - this is the user's permanent NostrPass ID
      const { getStorageKeypair } = await import('../services/userService');
      const { publicKey: storagePublicKey } = await getStorageKeypair(userMasterKey.xpriv);
      console.log('Storage public key (NostrPass ID):', storagePublicKey);
      
      // Get personal identity keypair for the user object
      const { publicKey: personalPublicKey } = await getIdentityKeypair(userMasterKey.xpriv, personalIdentity);
      
      // Derive encryption key from password
      const passwordDeriveResult = await cryptoWorker.deriveKey({
        password,
      });
      
      // Handle both Map and object results from WASM
      let passwordKey: string;
      let passwordSalt: string;
      if (passwordDeriveResult instanceof Map) {
        passwordKey = passwordDeriveResult.get('key');
        passwordSalt = passwordDeriveResult.get('salt');
      } else {
        passwordKey = passwordDeriveResult.key;
        passwordSalt = passwordDeriveResult.salt;
      }

      console.log('🔐 New single encryption flow:', {
        step1: 'Encrypting xpriv with PIN only',
        pinLength: pin.length
      });
      
      // Step 1: Encrypt xpriv with PIN only (single encryption)
      const xprivEncrypted = await cryptoWorker.encryptData({
        data: userMasterKey.xpriv,
        password: pin
      });
      
      console.log('✅ Step 1 complete: xpriv encrypted with PIN');

      // Create user object with Personal identity keys for app interactions
      const newUser: User = {
        publicKey: personalPublicKey, // Personal identity for app interactions
        privateKey: '', // Private key stays in worker
        profile: {
          username,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          preferences: {
            theme: 'system'
          },
          security: {
            sessionTimeout: 60 // 60 minutes default
          }
        },
        appPermissions: new Map(),
        isAuthenticated: true,
        session: {
          startedAt: Date.now(),
          lastActivityAt: Date.now()
        }
      };

      // Prepare recovery data if provided
      let recoveryData = undefined;
      if (recovery && recovery.questions.length > 0 && recovery.answers.length > 0) {
        // Concatenate and normalize answers
        console.log('Setting up recovery with answers:', recovery.answers);
        console.log('Raw answer values:', recovery.answers.map((a, i) => `[${i}]: "${a}" (length: ${a.length})`));
        const concatenated = recovery.answers
          .map(a => a.toLowerCase().trim())
          .join('|');
        console.log('Concatenated for storage:', concatenated);
        console.log('Concatenated length:', concatenated.length);
        
        // Derive recovery key
        const recoveryKeyResult = await cryptoWorker.deriveKey({
          password: concatenated,
        });
        console.log('Recovery key result type:', typeof recoveryKeyResult, recoveryKeyResult);
        
        // Extract key and salt (handling Map result from WASM)
        let recoveryKey: string;
        let recoverySalt: string;
        if (recoveryKeyResult instanceof Map) {
          recoveryKey = recoveryKeyResult.get('key');
          recoverySalt = recoveryKeyResult.get('salt');
        } else {
          recoveryKey = recoveryKeyResult.key;
          recoverySalt = recoveryKeyResult.salt;
        }
        console.log('Generated salt:', recoverySalt);
        console.log('Recovery key present:', recoveryKey ? 'Yes' : 'No');
        
        // Encrypt xpriv with recovery key
        const xprivRecovery = await cryptoWorker.encryptData({
          data: userMasterKey.xpriv,
          password: recoveryKey
        });
        
        recoveryData = {
          questions: recovery.questions,
          xprivRecovery,
          salt: recoverySalt,
          version: 1
        };
      }

      // Create a password verifier for later password verification
      const passwordVerifier = await cryptoWorker.encryptData({
        data: 'NostrPass_Password_Verifier_v1',
        password: passwordKey
      });

      // Create VaultObj with single encryption
      const vaultObj: VaultObj = {
        username,
        identities: userMasterKey.identities,
        xprivEncrypted, // PIN-encrypted only
        xprivRecovery: recoveryData?.xprivRecovery || '',
        recovery: recoveryData ? {
          questions: recoveryData.questions,
          salt: recoveryData.salt,
          version: recoveryData.version
        } : undefined,
        salt: passwordSalt,
        version: 1,
        updatedAt: Date.now()
      };

      // Create LoginObj for username lookup
      const loginObj: LoginObj = {
        storagePublicKey,
        username,
        createdAt: Date.now(),
        version: 1
      };

      // Encrypt VaultObj with password
      const encryptedVaultObj = await cryptoWorker.encryptData({
        data: JSON.stringify(vaultObj),
        key: passwordKey
      });

      // Encrypt LoginObj with password
      const encryptedLoginObj = await cryptoWorker.encryptData({
        data: JSON.stringify(loginObj),
        key: passwordKey
      });

      // Create legacy VaultData for backward compatibility during transition
      const vaultData: VaultData = {
        xprivEncrypted, // PIN-encrypted only
        salt: passwordSalt,
        publicKey: storagePublicKey,
        storagePublicKey,
        username,
        identities: userMasterKey.identities,
        updatedAt: Date.now(),
        version: 1,
        recovery: recoveryData,
        passwordVerifier
      };
      
      console.log('📦 Vault data being saved:', {
        ...vaultData,
        xprivEncrypted: '[REDACTED]',
        recovery: recoveryData ? {
          questions: recoveryData.questions,
          xprivRecovery: '[REDACTED]',
          salt: recoveryData.salt,
          version: recoveryData.version
        } : undefined
      });
      
      // Create session in worker with vault data
      // xpriv is all we need - it contains all keys
      console.log('📝 Creating session with:', {
        username,
        publicKey: storagePublicKey,
        hasXpriv: !!userMasterKey.xpriv,
        xprivLength: userMasterKey.xpriv?.length
      });
      
      const sessionInfo = await cryptoWorker.createSession({
        username,
        publicKey: storagePublicKey, // Use storage key for session
        xpriv: userMasterKey.xpriv, // Pass xpriv for full key derivation
        vaultData,
        sessionTimeout: 60 // 60 minutes
      });
      
      console.log('✅ Session created in worker:', sessionInfo);
      
      // Verify session has xpriv by checking it immediately
      const sessionCheck = await cryptoWorker.getSession({ username });
      console.log('🔍 Session verification:', {
        found: !!sessionCheck,
        hasXpriv: sessionCheck ? 'xpriv' in sessionCheck : false
      });

      // Save username for session persistence
      localStorage.setItem('last-username', username);

      setUser(newUser);
      
      // Set vault as unlocked since user just created it
      setIsVaultLocked(false);
      setHasPinVault(false); // No PIN required - vault is fully accessible
      
      // IMPORTANT: The session must have xpriv for saving to Nostr
      // Let's verify it's there
      const sessionVerify = await cryptoWorker.getSession({ username });
      console.log('🔍 Post-creation session check:', {
        hasSession: !!sessionVerify,
        sessionUsername: sessionVerify?.username,
        isUnlocked: sessionVerify?.isUnlocked
      });
      
      // Save LoginObj and VaultObj to Nostr
      console.log('🌐 Saving LoginObj and VaultObj to Nostr...');
      
      try {
        // Generate random key for LoginObj privacy
        const randomKey = await cryptoWorker.generateKeypair();
        let randomPrivateKey: string;
        let randomPublicKey: string;
        if (randomKey instanceof Map) {
          randomPrivateKey = randomKey.get('privateKey');
          randomPublicKey = randomKey.get('publicKey');
        } else {
          randomPrivateKey = (randomKey as any).privateKey;
          randomPublicKey = (randomKey as any).publicKey;
        }
        if (!randomPrivateKey || !randomPublicKey) {
          throw new Error('Failed to generate random keypair for LoginObj');
        }
        
        // Import Nostr helpers
        const { saveLoginObj, saveVaultObj } = await import('@nostrpass/nostrHelpers');
        const relays = getRelays();
        
        // Save LoginObj with random key
        await saveLoginObj(username, loginObj, randomPublicKey, randomPrivateKey, relays);
        console.log('✅ LoginObj saved to Nostr');
        
        // Get storage private key for signing
        const { privateKey: storagePrivateKey } = await getStorageKeypair(userMasterKey.xpriv);
        
        // Save VaultObj with storage key
        await saveVaultObj(vaultObj, storagePublicKey, storagePrivateKey, relays);
        console.log('✅ VaultObj saved to Nostr');
        
      } catch (error) {
        console.error('❌ Failed to save to Nostr:', error);
        // Don't fail signup if Nostr save fails - vault is still created locally
      }

      // Notify parent of auth status change
      messenger.send('AUTH_STATUS', {
        isAuthenticated: true,
        publicKey: personalPublicKey // Send personal identity key for app interactions
      });
      
      // Return storage public key for username registration
      return { publicKey: storagePublicKey };

    } catch (error) {
      console.error('Account creation failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (password: string, username: string) => {
    if (!cryptoWorker) throw new Error('Crypto worker not ready');
    
    setIsLoading(true);
    try {


      console.log('🔍 Starting login for username:', username);
      
      // First try to load from local storage
      console.log('🔍 Checking for local vault data for username:', username);
      let vaultData = await cryptoWorker.getVaultData({ username });
      console.log('📦 Local vault data:', vaultData ? 'Found' : 'Not found');
      
      // If no local vault, try to retrieve from Nostr using new LoginObj approach
      if (!vaultData) {
        console.log('No local vault found, retrieving from Nostr using LoginObj...');
        
        try {
          // Import Nostr helpers
          const { getLoginObj, getVaultFromNostr } = await import('@nostrpass/nostrHelpers');
          const relays = getRelays();
          
          // Get LoginObj by username
          console.log('🔍 Looking up LoginObj for username:', username);
          const env = environmentName ? environmentName() : 'development';
          const loginObj = await getLoginObj(username, env, relays);
          
          if (!loginObj) {
            console.error('No LoginObj found for username:', username);
            throw new Error('No vault found for this username');
          }
          
          console.log('✅ Found LoginObj:', {
            storagePublicKey: loginObj.storagePublicKey,
            username: loginObj.username,
            createdAt: new Date(loginObj.createdAt).toISOString()
          });
          
          // Now get VaultObj using storage public key
          console.log('🔍 Retrieving VaultObj using storage public key:', loginObj.storagePublicKey);
          const nostrVault = await getVaultFromNostr(loginObj.storagePublicKey, relays);
          
          if (nostrVault) {
            console.log('✅ Found VaultObj on Nostr');
            
            // The VaultObj is stored as plain JSON and xprivEncrypted is already PIN-encrypted
            // No password decryption needed here
            vaultData = {
              ...nostrVault,
              xprivEncryptedForPin: nostrVault.xprivEncrypted // Compatibility alias for unlock flow
            };
            
            console.log('✅ VaultObj decrypted and ready for PIN unlock');
            
            // Save to local storage for future use
            await cryptoWorker.createSession({
              username: vaultData.username,
              publicKey: loginObj.storagePublicKey,
              vaultData,
              sessionTimeout: 60
            });
          } else {
            console.error('No VaultObj found for storage public key:', loginObj.storagePublicKey);
            throw new Error('Vault data not found on Nostr');
          }
        } catch (error) {
          console.error('❌ Error retrieving vault from Nostr:', error);
          throw error;
        }
      }
      
      // Check if we have vault data
      if (!vaultData) {
        console.error('No vault data found for user');
        throw new Error('No vault found for this username');
      }

      console.log('Vault data loaded:', {
        hasXprivEncrypted: !!vaultData.xprivEncrypted,
        salt: vaultData.salt ? 'present' : 'missing'
      });
      
      // Check if vault already has PIN-encrypted xpriv
      if ((vaultData as any).xprivEncryptedForPin) {
        console.log('Vault already has PIN-encrypted xpriv, skipping password decryption');
      } else {
        // No outer password layer in the new flow; just alias to the PIN-encrypted blob
        if (!vaultData.xprivEncrypted) {
          console.error('❌ Vault missing xprivEncrypted');
          throw new Error('Vault data is incomplete');
        }
        (vaultData as any).xprivEncryptedForPin = vaultData.xprivEncrypted;
        console.log('✅ Set xprivEncryptedForPin from xprivEncrypted');
      }
      
      // Simple login - store vault data (with PIN-encrypted version if we added it)
      console.log('Logging in user with vault data...');
      console.log('Vault data has xprivEncryptedForPin:', !!(vaultData as any).xprivEncryptedForPin);
      await cryptoWorker.loginUser({
        username,
        vaultData
      });
      
      // Save username for next session check
      localStorage.setItem('last-username', username);
      
      // Get session status and save session ID
      const { VaultDataService } = await import('../services/vaultDataService');
      const vaultDataService = VaultDataService.getInstance();
      const sessionStatus = await vaultDataService.getSessionStatus();
      if (sessionStatus.sessionId) {
        localStorage.setItem('vaultsession', sessionStatus.sessionId);
      }
      
      console.log('User logged in successfully');
      
      console.log('Vault requires PIN unlock (mandatory)');
      setHasPinVault(true);
      setIsVaultLocked(true); // Vault is locked until PIN entered
      
      // Create a partial user object for navigation
      const partialUser: User = {
        publicKey: vaultData.publicKey,
        privateKey: '', // No private key until PIN unlock
        profile: {
          username: vaultData.username,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          preferences: {},
          security: {
            sessionTimeout: 60
          }
        },
        appPermissions: new Map(),
        isAuthenticated: false, // Not fully authenticated until PIN unlock
        session: {
          startedAt: Date.now(),
          lastActivityAt: Date.now()
        }
      };
        
        // No need to store session - vault data is our session
      setUser(partialUser);
      console.log('✅ Login successful - vault locked, awaiting PIN');
      setIsLoading(false); // Important: clear loading state before returning
      
      return; // Exit early - user needs to unlock with PIN

    } catch (error) {
      console.error('Login failed:', error);
      setIsLoading(false); // Clear loading state on error too
      throw error;
    } finally {
      // Don't set loading false here as it might override the earlier calls
    }
  };

  const logout = async () => {
    console.log('Logout called');
    const currentUser = user();
    
    // Clear local state immediately for fast UI response
    setUser(null);
    setHasPinVault(false);
    setIsVaultLocked(true);
    localStorage.removeItem('last-username');
    localStorage.removeItem('vaultsession');
    console.log('User state cleared');
    
    // Clear vault data in worker (this is the real logout)
    if (currentUser && cryptoWorker) {
      try {
        await cryptoWorker.logoutUser({ username: currentUser.profile.username });
        console.log('User logged out - vault data cleared');
      } catch (error) {
        console.error('Failed to logout user:', error);
      }
    }

    // Notify parent of auth status change immediately if messenger is ready
    if (messenger.isReady()) {
      messenger.send('AUTH_STATUS', {
        isAuthenticated: false,
        publicKey: null
      });
      console.log('Auth status sent to parent');
    }
    
    // Clear worker session in background (non-blocking)
    if (currentUser && cryptoWorker) {
      console.log('Clearing session for user:', currentUser.profile.username);
      // Don't await - let it complete in background
      cryptoWorker.clearSession({ 
        username: currentUser.profile.username 
      }).catch((error: unknown) => {
        // Ignore timeout errors during logout - not critical
        if (error instanceof Error && error.message.includes('timeout')) {
          console.log('Worker session cleanup timed out (non-critical)');
        } else {
          console.error('Failed to clear worker session:', error);
        }
      });
    }
  };

  const updateProfile = (profile: Partial<UserProfile>) => {
    const currentUser = user();
    if (currentUser) {
      const updatedUser = {
        ...currentUser,
        profile: { ...currentUser.profile, ...profile }
      };
      setUser(updatedUser);
      
      // No session storage needed - vault data is our session
    }
  };

  const lockVault = async (): Promise<void> => {
    console.log('🔒 lockVault called');
    const currentUser = user();
    if (!currentUser) {
      console.log('❌ No current user');
      return;
    }
    
    // INSTANT UI UPDATE
    setIsVaultLocked(true);
    setHasPinVault(true); // Indicate PIN is needed to unlock
    console.log('🔒 Vault locked instantly');
    
    // Background worker cleanup (non-blocking)
    if (cryptoWorker) {
      cryptoWorker.clearSession({ username: currentUser.profile.username })
        .catch((error: any) => {
          console.warn('⚠️ Worker session clear failed (non-critical):', error);
          // UI already shows locked - this is just cleanup
        });
    }
  };

  const unlockVault = async (pin: string): Promise<boolean> => {
    if (!cryptoWorker) {
      console.error('❌ Crypto worker not ready');
      return false;
    }
    
    // Get the current user to find username
    const currentUser = user();
    if (!currentUser) {
      console.error('❌ No user logged in');
      return false;
    }
    
    console.log('🔐 Starting vault unlock for:', currentUser.profile.username);
    
    try {
      // Get fresh vault data from worker (in case it was just updated by PIN reset)
      console.log('📊 Getting vault data for:', currentUser.profile.username);
      const freshVaultData = await cryptoWorker.getVaultData({ username: currentUser.profile.username });
      if (!freshVaultData) {
        throw new Error('No vault data found');
      }
      
      console.log('🔍 Vault data check:', {
        hasXprivEncrypted: !!freshVaultData.xprivEncrypted,
        xprivEncryptedLength: freshVaultData.xprivEncrypted?.length
      });
      
      // Validate vault data
      if (!freshVaultData.xprivEncrypted) {
        console.error('❌ Vault data missing xprivEncrypted');
        throw new Error('Vault data is incomplete');
      }
      
      // Check if we have the PIN-encrypted version
      const pinEncryptedPayload = (freshVaultData as any).xprivEncryptedForPin || freshVaultData.xprivEncrypted;
      if (!pinEncryptedPayload) {
        console.error('❌ Vault not prepared for PIN unlock - missing xprivEncrypted');
        throw new Error('Vault data is incomplete');
      }

      // Validate payload looks like ciphertext (simple base64-ish check)
      const looksLikeCipher = /^[A-Za-z0-9+/=]+$/.test(pinEncryptedPayload);
      let payloadToDecrypt = pinEncryptedPayload;

      if (!looksLikeCipher) {
        console.warn('⚠️ xprivEncrypted payload does not look like ciphertext. Attempting refresh from Nostr...');
        try {
          const { getVaultFromNostr } = await import('@nostrpass/nostrHelpers');
          const relays = getRelays();
          const refreshed = await getVaultFromNostr(freshVaultData.publicKey, relays);
          if (refreshed && refreshed.xprivEncrypted) {
            // Update worker vault and retry
            const updatedVault = { ...freshVaultData, xprivEncrypted: refreshed.xprivEncrypted } as any;
            updatedVault.xprivEncryptedForPin = refreshed.xprivEncrypted;
            await cryptoWorker.updateVaultData({ username: currentUser.profile.username, vaultData: updatedVault });
            payloadToDecrypt = refreshed.xprivEncrypted;
            console.log('✅ Refreshed xprivEncrypted from Nostr');
          }
        } catch (refreshErr) {
          console.warn('⚠️ Failed to refresh from Nostr:', refreshErr);
        }
      }
       
      console.log('🔐 Decrypting with PIN...');
      
      // Decrypt with PIN to get plain xpriv
      let xpriv: string;
      
      try {
        console.log('🔐 Decrypting with PIN...');
        xpriv = await cryptoWorker.decryptData({
          encryptedData: payloadToDecrypt,
          password: pin
        });
        console.log('✅ Decrypted with PIN - vault unlocked');
      } catch (error) {
        console.log('❌ PIN decryption failed - invalid PIN');
        return false;
      }
      

      
      // Get the current identity (default to Personal at index 0)
      console.log('👤 Getting identity keypair...');
      const currentIdentity = freshVaultData.identities[freshVaultData.currentIdentityIndex || 0];
      const keypair = await getIdentityKeypair(xpriv, currentIdentity);
      console.log('✅ Got keypair:', { hasPrivateKey: !!keypair.privateKey });
      
      // Update the worker session with the xpriv for full key derivation access
      console.log('🔓 Calling cryptoWorker.unlockSession with:', {
        username: currentUser.profile.username,
        hasPrivateKey: !!keypair.privateKey,
        hasXpriv: !!xpriv
      });
      
      await cryptoWorker.unlockSession({
        username: currentUser.profile.username,
        privateKey: keypair.privateKey,
        xpriv // Pass xpriv for storage key access
      });
      
      // Update user (without storing private key in main thread)
      const updatedUser = {
        ...currentUser,
        privateKey: '', // Private key stays in worker
        isAuthenticated: true // Ensure authenticated flag is set
      };
      
      // Update all state atomically
      console.log('🔄 Updating vault state to unlocked...');
      setUser(updatedUser);
      setHasPinVault(false); // Clear PIN flag after successful unlock
      setIsVaultLocked(false); // Vault is now unlocked
      
      // Update session ID after successful unlock
      const { VaultDataService } = await import('../services/vaultDataService');
      const vaultDataService = VaultDataService.getInstance();
      const sessionStatus = await vaultDataService.getSessionStatus();
      if (sessionStatus.sessionId) {
        localStorage.setItem('vaultsession', sessionStatus.sessionId);
      }
      
      // Small delay to ensure state propagates
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // No session storage needed - vault data is our session
      
      // Save updated vault to Nostr (in case PIN was just added or reset)
      try {
        // Use the worker to save vault with storage key
        const vaultEvent = await cryptoWorker.saveVaultToNostr({ username: currentUser.profile.username });
        
        // Publish the signed event to relays
        const { publishEvent } = await import('@nostrpass/nostrHelpers');
        const relays = getRelays();
        await publishEvent(vaultEvent.event, relays);
        console.log('✅ Vault synced to Nostr with storage key');
      } catch (error) {
        // Don't fail the unlock operation if Nostr sync fails
        if (error instanceof Error && error.message.includes('pow:')) {
          console.warn('Nostr relay requires Proof of Work - vault saved locally but not synced');
        } else {
          console.error('Failed to sync vault to Nostr:', error);
        }
        // Continue anyway - local vault is working
      }
        
      // Notify parent of full auth
      messenger.send('AUTH_STATUS', {
        isAuthenticated: true,
        publicKey: currentUser.publicKey
      });
      
      console.log('✅ Vault unlock completed successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to unlock vault:', error);
      
      // Reset state to consistent locked state on error
      setHasPinVault(true);
      setIsVaultLocked(true);
      
      // Log detailed error information
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
      }
      
      return false;
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: () => !!user(),
    isLoading,
    hasPinVault,
    isVaultLocked: () => isVaultLocked(),
    login,
    createAccount,
    logout,
    updateProfile,
    unlockVault,
    lockVault
  }

  return (
    <AuthContext.Provider value={value}>
      {props.children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};