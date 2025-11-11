import { createContext, useContext, ParentComponent, createSignal, createEffect, onMount } from 'solid-js';
import { sanitizeDomain } from '@nostrpass/nostrHelpers';
import { useMessenger } from './MessengerProvider';
import { useEnvironment } from './EnvironmentProvider';
import type { User, UserProfile, LoginObj, VaultObj, ErrorCode } from '@nostrpass/types';
import { createUser, getIdentityKeypair } from '../services/userService';
import { getCryptoWorker, getCryptoWorkerInstance } from '../services/cryptoWorkerSingleton';
import type { VaultData } from '@nostrpass/nostrHelpers';
import { showErrorToast, showSuccessToast } from '../components/Toast';

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
        if ((event as any).data?.type === 'VAULT_BROADCAST') {
          const { broadcastType, username, timestamp } = (event as any).data.data;
          
          switch (broadcastType) {
            case 'VAULT_DATA_UPDATED':
              if (currentUser?.profile.username === username) {
                const refreshEvent = new CustomEvent('vault-data-refresh', { 
                  detail: { username, timestamp } 
                });
                window.dispatchEvent(refreshEvent);
              }
              break;
              
            case 'USER_LOGGED_IN':
              // Another tab logged in - refresh session status
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
              attemptSessionRestore();
              break;
              
            case 'USER_LOGGED_OUT':
              if (currentUser?.profile.username === username) {
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
              
            case 'SESSION_UNLOCKED':
              if (currentUser?.profile.username === username) {
                setIsVaultLocked(false);
                setHasPinVault(false);
              }
              break;
              
            case 'SESSION_LOCKED':
              if (currentUser?.profile.username === username) {
                setIsVaultLocked(true);
                setHasPinVault(true);
              }
              break;
          }
          return;
        }
        
        // Handle existing session messages
        if ((event as any).data?.type === 'SESSION_EXPIRED' || (event as any).data?.type === 'SESSION_LOCKED') {
          const { username, reason } = (event as any).data.data;
          
          if (currentUser?.profile.username === username) {
            setIsVaultLocked(true);
            setHasPinVault(true);
            localStorage.removeItem('last-username');
            if (messenger.isReady()) {
              messenger.send('AUTH_STATUS', {
                isAuthenticated: false,
                publicKey: null,
                reason: reason || (event as any).data.type
              });
            }
          }
        }
      };
      
      // Add listener to worker
      workerInstance.addEventListener('message', handleWorkerMessage as unknown as EventListener);
      
      // Set up BroadcastChannel listener for cross-tab communication
      let broadcastChannel: BroadcastChannel | null = null;
      if (typeof BroadcastChannel !== 'undefined') {
        broadcastChannel = new BroadcastChannel('nostrpass-vault');
        broadcastChannel.onmessage = (event) => {
          if ((event as any).data?.type === 'VAULT_BROADCAST') {
            const { broadcastType, username, timestamp } = (event as any).data.data;
            
            const currentUser = user();
            
            switch (broadcastType) {
              case 'VAULT_DATA_UPDATED':
                if (currentUser?.profile.username === username) {
                  const refreshEvent = new CustomEvent('vault-data-refresh', { 
                    detail: { username, timestamp } 
                  });
                  window.dispatchEvent(refreshEvent);
                }
                break;
              
              case 'SESSION_UNLOCKED':
                if (currentUser?.profile.username === username) {
                  refreshSessionStatus();
                }
                break;
              
              case 'SESSION_LOCKED':
                if (currentUser?.profile.username === username) {
                  setIsVaultLocked(true);
                  setHasPinVault(true);
                }
                break;
              case 'USER_LOGGED_OUT':
                if (currentUser?.profile.username === username) {
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
                attemptSessionRestore();
                break;
            }
          }
        };
      }
      
      // Cleanup
      return () => {
        workerInstance.removeEventListener('message', handleWorkerMessage as unknown as EventListener);
        if (broadcastChannel) {
          broadcastChannel.close();
        }
      };
    } catch (error) {
      console.error('Failed to set up worker message listener:', error);
      showErrorToast('NETWORK_ERROR' as ErrorCode);
    }
  });

  // Session management on mount
  onMount(async () => {
    if (!cryptoWorker) return;
    
    // Get session status from worker
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
              security: {
                sessionTimeout: 60
              }
            },
            appPermissions: new Map(),
            isAuthenticated: true,
            session: {
              startedAt: Date.now(),
              lastActivityAt: Date.now()
            }
          };
          
          setUser(restoredUser);
          setHasPinVault(true);
          setIsVaultLocked(!isUnlocked);
        }
      } catch (error) {
        localStorage.removeItem('vaultsession');
        localStorage.removeItem('last-username');
      }
    } else {
      localStorage.removeItem('vaultsession');
      localStorage.removeItem('last-username');
    }

    const handleSessionRefresh = (event: CustomEvent) => {
      const { username: eventUsername } = event.detail as any;
      const currentUser = user();
      
      if (currentUser?.profile.username === eventUsername) {
        refreshSessionStatus();
      } else if (!currentUser) {
        attemptSessionRestore();
      }
    };

    window.addEventListener('session-refresh', handleSessionRefresh as unknown as EventListener);
    
    return () => {
      window.removeEventListener('session-refresh', handleSessionRefresh as unknown as EventListener);
    };
  });

  // Helper function to refresh session status
  const refreshSessionStatus = async () => {
    if (!cryptoWorker) return;
    
    try {
      const currentUser = user();
      if (!currentUser) return;
      
      const keyStatus = await cryptoWorker.hasKeysInSession({ username: currentUser.profile.username });
      const isUnlocked = !!(keyStatus?.hasPrivateKey || keyStatus?.hasXpriv);
      
      setIsVaultLocked(!isUnlocked);
      setHasPinVault(!isUnlocked);
    } catch (error) {
      console.error('Failed to refresh session status:', error);
      showErrorToast('SESSION_EXPIRED' as ErrorCode);
    }
  };

  async function attemptSessionRestore() {
    if (!cryptoWorker) return;
    try {
      const { VaultDataService } = await import('../services/vaultDataService');
      const sessionStatus = await VaultDataService.getInstance().getSessionStatus();
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
          }
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      // ignore
    }
  }

  // Set up message handlers for auth-related requests
  createEffect(() => {
    if (!messenger.isReady() || !messenger.messenger) return;

    const DEV_BYPASS = false;
    const appKeyFromOrigin = (origin: string): string => {
      try {
        const u = new URL(origin);
        return sanitizeDomain(u.host);
      } catch {
        return sanitizeDomain(origin);
      }
    };

    const getAppIdentityIndexForOrigin = async (username: string, origin: string): Promise<number> => {
      if (!cryptoWorker) throw new Error('Crypto not ready');
      const vaultData = await cryptoWorker.getVaultData({ username });
      if (!vaultData?.identities || vaultData.identities.length === 0) {
        throw new Error('No identities found');
      }
      if (DEV_BYPASS) {
        return 0;
      } else {
        const appKey = appKeyFromOrigin(origin);
        let activeIndex = (vaultData as any).activeIdentityByApp?.[appKey];
        if (activeIndex === undefined || activeIndex === null) {
          activeIndex = (vaultData as any).identities.findIndex((id: any) => id?.appPermissions && id.appPermissions[appKey]);
        }
        if (activeIndex === -1 || activeIndex === undefined || activeIndex === null) {
          // Instead of throwing, trigger account picker
          const requestId = `account-picker-${Date.now()}-${Math.random().toString(36).slice(2)}`;

          return new Promise((resolve, reject) => {
            const handleSelected = (e: Event) => {
              const ce = e as CustomEvent;
              if (ce.detail.requestId === requestId) {
                cleanup();
                resolve(ce.detail.identityIndex);
              }
            };

            const handleRejected = (e: Event) => {
              const ce = e as CustomEvent;
              if (ce.detail.requestId === requestId) {
                cleanup();
                reject(new Error(ce.detail.error || 'Account selection cancelled'));
              }
            };

            const cleanup = () => {
              window.removeEventListener('account-picker-selected', handleSelected as EventListener);
              window.removeEventListener('account-picker-rejected', handleRejected as EventListener);
            };

            window.addEventListener('account-picker-selected', handleSelected as EventListener);
            window.addEventListener('account-picker-rejected', handleRejected as EventListener);

            // Trigger account picker
            window.dispatchEvent(new CustomEvent('vault-account-picker', {
              detail: { appOrigin: origin, requestId }
            }));
          });
        }
        const identity = (vaultData as any).identities[activeIndex];
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
        const identity = (vaultData as any)?.identities?.[idx];
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
          const identity = (vdata as any)?.identities?.[identityIndex];
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
    console.log('🎬 [CREATE ACCOUNT] Starting account creation...');
    console.log('👤 [CREATE ACCOUNT] Username:', username);
    console.log('🔐 [CREATE ACCOUNT] Password length:', password.length);
    console.log('🔐 [CREATE ACCOUNT] PIN length:', pin.length, 'PIN preview:', pin.substring(0, 2) + '***');
    console.log('🔐 [CREATE ACCOUNT] Has recovery?', !!recovery);
    
    if (!cryptoWorker) {
      console.error('❌ [CREATE ACCOUNT] Crypto worker not ready');
      throw new Error('Crypto worker not ready');
    }
    if (!pin || pin.length < 4) {
      console.error('❌ [CREATE ACCOUNT] PIN too short');
      throw new Error('PIN must be at least 4 digits');
    }
    
    setIsLoading(true);
    try {
      // Step 1: Create new user with xpriv and Personal identity
      console.log('🔑 [CREATE ACCOUNT] Step 1: Generating master key (xpriv)...');
      const userMasterKey = await createUser();
      
      console.log('✅ [CREATE ACCOUNT] Master key generated:', {
        xprivLength: userMasterKey.xpriv?.length,
        xprivPrefix: userMasterKey.xpriv?.substring(0, 10),
        identitiesCount: userMasterKey.identities?.length
      });
      
      const personalIdentity = userMasterKey.identities[0];
      console.log('👤 [CREATE ACCOUNT] Personal identity:', personalIdentity);
      
      // Step 2: Derive keypairs
      console.log('🔑 [CREATE ACCOUNT] Step 2: Deriving storage and personal keypairs...');
      const { getStorageKeypair } = await import('../services/userService');
      const { publicKey: storagePublicKey } = await getStorageKeypair(userMasterKey.xpriv);
      console.log('✅ [CREATE ACCOUNT] Storage public key:', storagePublicKey);
      
      const { publicKey: personalPublicKey } = await getIdentityKeypair(userMasterKey.xpriv, personalIdentity);
      console.log('✅ [CREATE ACCOUNT] Personal public key:', personalPublicKey);
      
      // Step 3: Derive key from PASSWORD for account verification
      console.log('🔑 [CREATE ACCOUNT] Step 3: Deriving password key...');
      const passwordDeriveResult = await cryptoWorker.deriveKey({
        password,
      });
      
      let passwordKey: string;
      let passwordSalt: string;
      if (passwordDeriveResult instanceof Map) {
        passwordKey = passwordDeriveResult.get('key');
        passwordSalt = passwordDeriveResult.get('salt');
      } else {
        passwordKey = (passwordDeriveResult as any).key;
        passwordSalt = (passwordDeriveResult as any).salt;
      }
      console.log('✅ [CREATE ACCOUNT] Password key derived. Salt:', passwordSalt.substring(0, 20) + '...');
      
      // 2. Encrypt xpriv with PIN (encryptData will derive key and embed salt)
      console.log('🔐 [CREATE] Encrypting xpriv with PIN...');
      console.log('🔐 [CREATE] PIN details:', { length: pin.length, preview: pin.substring(0, 2) + '***' });
      console.log('🔐 [CREATE] xpriv to encrypt:', { length: userMasterKey.xpriv.length, preview: userMasterKey.xpriv.substring(0, 10) + '...' });
      
      const xprivEncrypted = await cryptoWorker.encryptData({
        data: userMasterKey.xpriv,
        password: pin  // Use PIN directly, encryptData will derive key and embed salt
      });
      
      console.log('✅ [CREATE ACCOUNT] Encryption successful!');
      console.log('✅ [CREATE ACCOUNT] Encrypted xpriv length:', xprivEncrypted.length);
      console.log('✅ [CREATE ACCOUNT] Encrypted xpriv preview:', xprivEncrypted.substring(0, 50) + '...');

      // Step 4: Create user object
      console.log('👤 [CREATE ACCOUNT] Step 4: Creating user object...');
      const newUser: User = {
        publicKey: personalPublicKey,
        privateKey: '',
        profile: {
          username,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          preferences: {
            theme: 'system'
          },
          security: {
            sessionTimeout: 60
          }
        },
        appPermissions: new Map(),
        isAuthenticated: true,
        session: {
          startedAt: Date.now(),
          lastActivityAt: Date.now()
        }
      };

      // Step 5: Create recovery encryption (if security questions provided)
      console.log('🔐 [CREATE ACCOUNT] Step 5: Processing recovery data...');
      let recoveryData = undefined;
      if (recovery && recovery.questions.length > 0 && recovery.answers.length > 0) {
        console.log('🔐 [CREATE ACCOUNT] Creating recovery encryption with', recovery.questions.length, 'questions');
        const concatenated = recovery.answers
          .map(a => a.toLowerCase().trim())
          .join('|');
        
        const recoveryKeyResult = await cryptoWorker.deriveKey({
          password: concatenated,
        });
        
        let recoveryKey: string;
        let recoverySalt: string;
        if (recoveryKeyResult instanceof Map) {
          recoveryKey = recoveryKeyResult.get('key');
          recoverySalt = recoveryKeyResult.get('salt');
        } else {
          recoveryKey = (recoveryKeyResult as any).key;
          recoverySalt = (recoveryKeyResult as any).salt;
        }
        
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
        console.log('✅ [CREATE ACCOUNT] Recovery data created');
      } else {
        console.log('ℹ️ [CREATE ACCOUNT] No recovery data provided');
      }

      // Step 6: Create password verifier for login authentication
      console.log('🔐 [CREATE ACCOUNT] Step 6: Creating password verifier...');
      const passwordVerifier = await cryptoWorker.encryptData({
        data: 'NostrPass_Password_Verifier_v1',
        password: passwordKey
      });
      console.log('✅ [CREATE ACCOUNT] Password verifier created');

      // Step 7: Assemble vault objects
      console.log('📦 [CREATE ACCOUNT] Step 7: Assembling vault objects...');
      const vaultObj: VaultObj = {
        username,
        identities: userMasterKey.identities,
        xprivEncrypted,
        xprivRecovery: recoveryData?.xprivRecovery || '',
        recovery: recoveryData ? {
          questions: recoveryData.questions,
          salt: recoveryData.salt,
          version: recoveryData.version
        } : undefined,
        salt: '', // Salt is now embedded in xprivEncrypted, not stored separately
        version: 1,
        updatedAt: Date.now()
      };

      const loginObj: LoginObj = {
        storagePublicKey,
        username,
        createdAt: Date.now(),
        version: 1,
        passwordSalt  // Store password salt in LoginObj for decryption
      };

      const vaultData: VaultData = {
        xprivEncrypted,
        salt: '', // Salt is now embedded in xprivEncrypted, not stored separately
        passwordSalt, // Salt for password verification
        publicKey: storagePublicKey,
        storagePublicKey,
        username,
        identities: userMasterKey.identities,
        updatedAt: Date.now(),
        version: 1,
        recovery: recoveryData,
        passwordVerifier
      };
      
      console.log('✅ [CREATE ACCOUNT] VaultObj created:', {
        username: vaultObj.username,
        hasXprivEncrypted: !!vaultObj.xprivEncrypted,
        xprivEncryptedLength: vaultObj.xprivEncrypted.length,
        salt: vaultObj.salt,
        hasRecovery: !!vaultObj.recovery
      });
      
      console.log('✅ [CREATE ACCOUNT] VaultData created:', {
        username: vaultData.username,
        hasXprivEncrypted: !!vaultData.xprivEncrypted,
        xprivEncryptedLength: vaultData.xprivEncrypted.length,
        salt: vaultData.salt,
        passwordSalt: vaultData.passwordSalt,
        hasPasswordVerifier: !!vaultData.passwordVerifier,
        passwordVerifierLength: vaultData.passwordVerifier?.length
      });
      
      // Step 8: Initialize session in worker
      console.log('🔓 [CREATE ACCOUNT] Step 8: Initializing session in worker...');
      await cryptoWorker.initSession({
        username,
        publicKey: storagePublicKey,
        vaultData,
        passwordKey  // Cache password key for vault operations
      });
      console.log('✅ [CREATE ACCOUNT] Session initialized');
      
      // Step 9: Unlock session with keys
      console.log('🔓 [CREATE ACCOUNT] Step 9: Unlocking session...');
      const createdKeypair = await getIdentityKeypair(userMasterKey.xpriv, userMasterKey.identities[0]);
      await cryptoWorker.unlockSession({
        username,
        privateKey: createdKeypair.privateKey,
        xpriv: userMasterKey.xpriv
      });
      console.log('✅ [CREATE ACCOUNT] Session unlocked');
      
      localStorage.setItem('last-username', username);

      setUser(newUser);
      setIsVaultLocked(false);
      setHasPinVault(false);
      
      // Step 10: Verify session
      console.log('🔍 [CREATE ACCOUNT] Step 10: Verifying session...');
      const sessionVerify = await cryptoWorker.getSession({ username });
      console.log('✅ [CREATE ACCOUNT] Post-creation session check:', {
        hasSession: !!sessionVerify,
        sessionUsername: (sessionVerify as any)?.username,
        isUnlocked: (sessionVerify as any)?.isUnlocked
      });
      
      // Step 11: Save to Nostr
      console.log('🌐 [CREATE ACCOUNT] Step 11: Saving LoginObj and VaultObj to Nostr...');
      
      try {
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
        
        const { saveLoginObj } = await import('@nostrpass/nostrHelpers');
        const relays = getRelays();
        const env = environmentName ? environmentName() : 'development';

        await saveLoginObj(username, loginObj, randomPublicKey, randomPrivateKey, relays, env);
        console.log(`✅ [CREATE ACCOUNT] LoginObj saved to Nostr with environment: ${env}`);
        
        // Create initial vault event using password encryption
        const vaultEvent = await cryptoWorker.createInitialVaultForNostr({ username, passwordKey });
        console.log('✅ [CREATE ACCOUNT] Initial vault event created');
        
        // Publish the vault event to relays
        const { publishEvent } = await import('@nostrpass/nostrHelpers');
        const publishedRelays = await publishEvent(vaultEvent.event, relays);
        console.log('✅ [CREATE ACCOUNT] VaultObj saved to Nostr (password-encrypted):', publishedRelays);
        
      } catch (error) {
        console.error('❌ [CREATE ACCOUNT] Failed to save to Nostr:', error);
      }

      // Step 12: Realtime will start after unlock via worker
      console.log('🔔 [CREATE ACCOUNT] Step 12: Realtime will start after unlock');

      // Step 13: Send auth status
      console.log('📡 [CREATE ACCOUNT] Step 13: Sending auth status to parent...');
      messenger.send('AUTH_STATUS', {
        isAuthenticated: true,
        publicKey: personalPublicKey
      });
      
      console.log('🎉 [CREATE ACCOUNT] Account creation complete!');
      console.log('🎉 [CREATE ACCOUNT] Storage public key:', storagePublicKey);
      return { publicKey: storagePublicKey };

    } catch (error) {
      console.error('❌ [CREATE ACCOUNT] Account creation failed:', error);
      console.error('❌ [CREATE ACCOUNT] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      showErrorToast('STORAGE_ERROR' as ErrorCode);
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
      console.log('🔧 Crypto worker status:', cryptoWorker ? 'ready' : 'not ready');
      
      // First try to load from local storage
      console.log('📦 Calling getVaultData from worker...');
      let vaultData = await Promise.race([
        cryptoWorker.getVaultData({ username }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('getVaultData timeout after 10s')), 10000))
      ]) as any;
      console.log('📦 getVaultData returned:', vaultData ? 'found' : 'not found');
      if (vaultData) {
        try {
          const sanitized = {
            source: 'local',
            username: (vaultData as any)?.username,
            publicKey: (vaultData as any)?.publicKey,
            identitiesCount: (vaultData as any)?.identities?.length || 0,
            hasXprivEncrypted: !!(vaultData as any)?.xprivEncrypted,
            hasRecoveryObj: !!(vaultData as any)?.recovery,
            recoveryQuestionsCount: (vaultData as any)?.recovery?.questions?.length || 0,
            recoveryAnswersCount: (vaultData as any)?.recovery?.answers?.length || 0,
          };
          console.log('🧾 Vault snapshot:', sanitized);
        } catch {}
      }
      
      if (!vaultData) {
        try {
          console.log('📡 Fetching account from Nostr relays...');
          const { getLoginObj, getVaultFromNostr } = await import('@nostrpass/nostrHelpers');
          const relays = getRelays();
          
          const env = environmentName ? environmentName() : 'development';
          const loginObj = await getLoginObj(username, env, relays);
          
          if (!loginObj) {
            throw new Error('No vault found for this username');
          }
          
          console.log('✅ Found LoginObj on Nostr');
          
          // Derive password key using salt from LoginObj (no circular dependency!)
          console.log('🔑 Deriving password key for VaultObj decryption...');
          const passwordDeriveResult = await cryptoWorker.deriveKey({ 
            password,
            salt: loginObj.passwordSalt  // Use salt from LoginObj
          });
          let passwordKey: string;
          if (passwordDeriveResult instanceof Map) {
            passwordKey = passwordDeriveResult.get('key');
          } else {
            passwordKey = (passwordDeriveResult as any).key;
          }
          
          // Decrypt VaultObj with password key
          const nostrVault = await getVaultFromNostr(loginObj.storagePublicKey, relays, passwordKey);
          
          if (nostrVault) {
            console.log('✅ Found VaultObj on Nostr (password-decrypted)');
            vaultData = {
              ...nostrVault,
              publicKey: loginObj.storagePublicKey // Ensure publicKey is set
            } as any;
            
            // Save to local IndexedDB for future use
            console.log('💾 Saving vault to local IndexedDB...');
            await cryptoWorker.saveVault({
              username,
              publicKey: loginObj.storagePublicKey,
              xprivEncrypted: (nostrVault as any).encryptedVault || (nostrVault as any).xprivEncrypted,
              salt: (nostrVault as any).salt,
              identities: (nostrVault as any).identities || [],
              activeIdentityByApp: (nostrVault as any).activeIdentityByApp || {},
              passwordVerifier: (nostrVault as any).passwordVerifier,
              passwordSalt: (nostrVault as any).passwordSalt,
              recovery: (nostrVault as any).recovery,
              lastSyncedAt: Date.now(),
              updatedAt: (nostrVault as any).updatedAt || Date.now(),
              createdAt: (nostrVault as any).createdAt || Date.now()
            });
            console.log('✅ Vault saved to local IndexedDB');
          } else {
            throw new Error('Vault data not found on Nostr');
          }
        } catch (error) {
          console.error('❌ Error retrieving vault from Nostr:', error);
          throw error;
        }
      }
      
      if (!vaultData) {
        throw new Error('No vault found for this username');
      }

      console.log('Vault data loaded:', {
        hasXprivEncrypted: !!(vaultData as any).xprivEncrypted,
        salt: (vaultData as any).salt ? 'present' : 'missing'
      });
      if (!(vaultData as any).xprivEncrypted) {
        throw new Error('Vault is missing PIN-encrypted master key');
      }
      
      // Verify password - REQUIRED for all accounts
      console.log('🔐 Password verification check:', {
        hasPassword: !!password,
        hasPasswordVerifier: !!(vaultData as any).passwordVerifier,
        hasPasswordSalt: !!(vaultData as any).passwordSalt
      });
      
      if (!password) {
        throw new Error('Password is required');
      }
      
      // MIGRATION PATH: Add security fields if missing (for old accounts)
      if (!(vaultData as any).passwordVerifier || !(vaultData as any).passwordSalt) {
        console.warn('⚠️ Account is missing security fields - attempting migration...');
        
        try {
          // Generate new password salt
          const newPasswordSalt = await cryptoWorker.generateSalt();
          let passwordSalt: string;
          if (newPasswordSalt instanceof Map) {
            passwordSalt = newPasswordSalt.get('salt');
          } else {
            passwordSalt = (newPasswordSalt as any).salt || newPasswordSalt;
          }
          
          // Derive key from password
          const passwordDeriveResult = await cryptoWorker.deriveKey({
            password,
            salt: passwordSalt
          });
          
          let passwordKey: string;
          if (passwordDeriveResult instanceof Map) {
            passwordKey = passwordDeriveResult.get('key');
          } else {
            passwordKey = (passwordDeriveResult as any).key;
          }
          
          // Create and encrypt verifier
          const passwordVerifier = await cryptoWorker.encryptData({
            data: 'NostrPass_Password_Verifier_v1',
            password: passwordKey
          });
          
          // Update vault data with new security fields
          (vaultData as any).passwordVerifier = passwordVerifier;
          (vaultData as any).passwordSalt = passwordSalt;
          (vaultData as any).updatedAt = Date.now();
          
          // Save to local IndexedDB
          await cryptoWorker.updateVaultData({ username, vaultData });
          
          console.log('✅ Account migrated with security fields');
          console.log('ℹ️ Vault will sync to Nostr after PIN unlock');
          
        } catch (migrationError) {
          console.error('❌ Account migration failed:', migrationError);
          throw new Error('Failed to upgrade account security. Please try again or create a new account.');
        }
      }
      
      try {
        console.log('🔐 Deriving key from password...');
        // Derive key from provided password using stored salt
        const passwordDeriveResult = await cryptoWorker.deriveKey({
          password,
          salt: (vaultData as any).passwordSalt
        });
        
        let passwordKey: string;
        if (passwordDeriveResult instanceof Map) {
          passwordKey = passwordDeriveResult.get('key');
        } else {
          passwordKey = (passwordDeriveResult as any).key;
        }
        
        console.log('🔐 Decrypting password verifier...');
        // Try to decrypt the verifier with the derived key
        const decrypted = await cryptoWorker.decryptData({
          encryptedData: (vaultData as any).passwordVerifier,
          password: passwordKey
        });
        
        console.log('🔐 Verifier decrypted, checking value...');
        if (decrypted !== 'NostrPass_Password_Verifier_v1') {
          console.error('❌ Password verification failed - incorrect password');
          showErrorToast('INVALID_PASSWORD' as ErrorCode);
          throw new Error('Invalid password');
        }
        
        console.log('✅ Password verified successfully');
      } catch (error) {
        console.error('❌ Password verification error:', error);
        showErrorToast('INVALID_PASSWORD' as ErrorCode);
        throw new Error('Invalid password');
      }
      
      // Derive password key for session caching using stored salt
      const passwordDeriveResultForSession = await cryptoWorker.deriveKey({ 
        password,
        salt: (vaultData as any).passwordSalt  // Use stored salt
      });
      let passwordKeyForSession: string;
      if (passwordDeriveResultForSession instanceof Map) {
        passwordKeyForSession = passwordDeriveResultForSession.get('key');
      } else {
        passwordKeyForSession = (passwordDeriveResultForSession as any).key;
      }
      
      await cryptoWorker.initSession({
        username,
        publicKey: (vaultData as any).publicKey,
        vaultData,
        passwordKey: passwordKeyForSession  // Cache password key for vault operations
      });

      // Background freshness check from Nostr
      // Note: We skip background sync for now since it requires password key
      // TODO: Implement password key caching for background operations
      (async () => {
        try {
          // Skip background sync - would need password key for decryption
          console.log('⏭️ [LOGIN] Skipping background sync (requires password key for decryption)');
          return;
          
          const { getLoginObj } = await import('@nostrpass/nostrHelpers');
          const relays = getRelays();
          const env = environmentName ? environmentName() : 'development';
          const loginObj = await getLoginObj(username, env, relays);
          if (!loginObj) return;
          // Would need password key here
          const remote = null; // await getVaultFromNostr(loginObj.storagePublicKey, relays, passwordKey);
          if (!remote) return;
          
          const localVersion = (vaultData as any)?.version || 0;
          const remoteVersion = (remote as any)?.version || 0;
          const localIdentities = (vaultData as any)?.identities || [];
          const remoteIdentities = (remote as any)?.identities || [];
          
          console.log('🔄 [LOGIN] Background sync check:', {
            localVersion,
            remoteVersion,
            localIdentitiesCount: localIdentities.length,
            remoteIdentitiesCount: remoteIdentities.length,
            localUpdatedAt: (vaultData as any)?.updatedAt,
            remoteUpdatedAt: (remote as any)?.updatedAt
          });
          
          // Use version-based conflict resolution
          if (remoteVersion > localVersion) {
            console.log('📥 [LOGIN] Remote vault is newer (v' + remoteVersion + ' > v' + localVersion + '), syncing from Nostr...');
            
            // Use remote vault entirely (it's definitively newer)
            // Skip version increment since we're downloading, not creating new changes
            await cryptoWorker.updateVaultData({ username, vaultData: remote, skipVersionIncrement: true });
            console.log('✅ [LOGIN] Vault synced from Nostr');
            
            // Broadcast to other tabs
            try {
              const refreshEvent = new CustomEvent('vault-data-refresh', { 
                detail: { username } 
              });
              window.dispatchEvent(refreshEvent);
            } catch {}
          } else if (remoteVersion < localVersion) {
            console.log('ℹ️ [LOGIN] Local vault is newer (v' + localVersion + ' > v' + remoteVersion + '), keeping local');
          } else {
            console.log('ℹ️ [LOGIN] Vaults are at same version (v' + localVersion + '), keeping local');
          }
        } catch (e) {
          console.error('❌ [LOGIN] Background sync failed:', e);
          // ignore
        }
      })();
      
      localStorage.setItem('last-username', username);
      
      const { VaultDataService } = await import('../services/vaultDataService');
      const vaultDataService = VaultDataService.getInstance();
      const sessionStatus = await vaultDataService.getSessionStatus();
      if (sessionStatus.sessionId) {
        localStorage.setItem('vaultsession', sessionStatus.sessionId);
      }
      
      // Set up Nostr subscription for real-time vault updates
      try {
        const storagePublicKey = (vaultData as any).storagePublicKey || (vaultData as any).publicKey;
        if (storagePublicKey) {
          console.log('🔔 [LOGIN] Setting up Nostr subscription for real-time updates...');
          
          // Get storagePrivateKey from the session (it was derived during unlockVault)
          const session = await cryptoWorker.getSession({ username });
          if (!session?.storagePrivateKey) {
            throw new Error('Storage private key not available in session');
          }
          
          // Worker-based author-only subscription is started after unlock
          console.log('ℹ️ [LOGIN] Realtime subscription will start after unlock');

          // One-time catch-up: fetch latest vault via storage key and update if newer
          try {
            const { getRelays } = await import('../providers/EnvironmentProvider');
            const relays = getRelays();
            const { getVaultFromNostrWithStorageKey } = await import('@nostrpass/nostrHelpers');
            const latest = await getVaultFromNostrWithStorageKey(storagePublicKey, relays, session.storagePrivateKey);
            if (latest) {
              const localUpdatedAt = (vaultData as any)?.updatedAt || 0;
              const remoteUpdatedAt = (latest as any)?.updatedAt || 0;
              if (remoteUpdatedAt > localUpdatedAt) {
                console.log('⬆️ [LOGIN] Applying newer vault from Nostr:', new Date(remoteUpdatedAt).toISOString());
                await cryptoWorker.updateVaultData({ username, vaultData: latest, skipVersionIncrement: true });
                window.dispatchEvent(new CustomEvent('vault-data-refresh', { detail: { username, source: 'nostr-catchup', timestamp: Date.now() } }));
              }
            }
          } catch (e) {
            console.warn('⚠️ [LOGIN] Nostr catch-up failed (non-critical):', e);
          }
        } else {
          console.warn('⚠️ [LOGIN] Cannot set up Nostr subscription - missing storage public key');
        }
      } catch (subscriptionError) {
        console.warn('⚠️ [LOGIN] Failed to set up Nostr subscription (non-critical):', subscriptionError);
      }
      
      setHasPinVault(true);
      setIsVaultLocked(true);
      
      const partialUser: User = {
        publicKey: (vaultData as any).publicKey,
        privateKey: '',
        profile: {
          username: (vaultData as any).username,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          preferences: {},
          security: {
            sessionTimeout: 60
          },
          // Ensure storagePublicKey available for subscriptions
          storagePublicKey: (vaultData as any).storagePublicKey || (vaultData as any).publicKey
        },
        appPermissions: new Map(),
        isAuthenticated: false,
        session: {
          startedAt: Date.now(),
          lastActivityAt: Date.now()
        }
      };
      
      setUser(partialUser);
      setIsLoading(false);
      
      return;

    } catch (error) {
      console.error('Login failed:', error);
      setIsLoading(false);
      throw error;
    } finally {
      // no-op
    }
  };

  const logout = async (deleteVault = false) => {
    const currentUser = user();
    
    // Clear state first
    setUser(null);
    setHasPinVault(false);
    setIsVaultLocked(true);
    localStorage.removeItem('last-username');
    localStorage.removeItem('vaultsession');
    
    if (currentUser && cryptoWorker) {
      // Stop realtime subscription
      try {
        await cryptoWorker.stopNostrSubscription({ username: currentUser.profile.username });
      } catch {}
      
      // Worker-based sub already stopped; nothing else to do
      
      try {
        // Logout from worker (clears in-memory session)
        await cryptoWorker.logoutUser({ username: currentUser.profile.username });
      } catch (error) {
        console.error('Failed to logout user:', error);
      }
      
      try {
        // Clear session data
        await cryptoWorker.clearSession({ username: currentUser.profile.username });
      } catch (error) {
        console.error('Failed to clear session:', error);
      }
      
      // Optionally delete vault data from IndexedDB (for testing/account deletion)
      if (deleteVault) {
        try {
          await cryptoWorker.deleteVault({ username: currentUser.profile.username });
          console.log('🗑️ Vault data deleted from IndexedDB');
          
          // Give IndexedDB a moment to finish the deletion
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error('Failed to delete vault:', error);
        }
      }
    }

    // Send auth status after all cleanup
    if (messenger.isReady()) {
      messenger.send('AUTH_STATUS', {
        isAuthenticated: false,
        publicKey: null
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
    }
  };

  const lockVault = async (): Promise<void> => {
    const currentUser = user();
    if (!currentUser) {
      return;
    }
    
    setIsVaultLocked(true);
    setHasPinVault(true);
    
    if (cryptoWorker) {
      cryptoWorker.clearSession({ username: currentUser.profile.username })
        .catch(() => {});
    }
  };

  const unlockVault = async (pin: string): Promise<boolean> => {
    console.log('🔓 [UNLOCK] Starting unlock vault with PIN...');
    
    if (!cryptoWorker) {
      console.error('❌ [UNLOCK] Crypto worker not available');
      return false;
    }
    
    const currentUser = user();
    if (!currentUser) {
      console.error('❌ [UNLOCK] No current user');
      return false;
    }
    
    console.log('👤 [UNLOCK] User:', currentUser.profile.username);
    
    try {
      // Step 1: Get vault data
      console.log('📦 [UNLOCK] Step 1: Fetching vault data...');
      const freshVaultData = await cryptoWorker.getVaultData({ username: currentUser.profile.username });
      if (!freshVaultData) {
        console.error('❌ [UNLOCK] No vault data found');
        throw new Error('No vault data found');
      }
      console.log('✅ [UNLOCK] Vault data retrieved:', {
        hasXprivEncrypted: !!(freshVaultData as any).xprivEncrypted,
        xprivEncryptedLength: (freshVaultData as any).xprivEncrypted?.length,
        salt: (freshVaultData as any).salt
      });
      
      const xprivEncryptedBlob = (freshVaultData as any).xprivEncrypted;
      if (!xprivEncryptedBlob) {
        console.error('❌ [UNLOCK] Vault data is incomplete - no xprivEncrypted');
        throw new Error('Vault data is incomplete');
      }
      
      console.log('🔍 [UNLOCK] xprivEncrypted blob preview:', xprivEncryptedBlob.substring(0, 50) + '...');
      
      const looksLikeCipher = /^[A-Za-z0-9+/=]+$/.test(xprivEncryptedBlob);
      let payloadToDecrypt = xprivEncryptedBlob;
      console.log('🔍 [UNLOCK] Cipher validation:', { looksLikeCipher });

      if (!looksLikeCipher) {
        console.log('⚠️ [UNLOCK] Encrypted data doesn\'t look like base64');
        console.log('⚠️ [UNLOCK] Cannot refresh from Nostr (would require password key for decryption)');
        // Skip refresh - would need password key for decryption
        // This shouldn't happen with properly formatted vaults
      }
       
      // Step 2: Decrypt xpriv with PIN
      console.log('🔐 [UNLOCK] Step 2: Decrypting xpriv with PIN...');
      console.log('🔐 [UNLOCK] PIN provided:', { length: pin.length, preview: pin.substring(0, 2) + '***' });
      
      let xpriv: string;
      
      try {
        xpriv = await cryptoWorker.decryptData({
          encryptedData: payloadToDecrypt,
          password: pin
        });
        console.log('✅ [UNLOCK] Decryption successful! xpriv length:', xpriv?.length);
        console.log('✅ [UNLOCK] xpriv preview:', xpriv?.substring(0, 10) + '...');
      } catch (error) {
        console.error('❌ [UNLOCK] PIN decryption failed:', error);
        console.error('❌ [UNLOCK] Error details:', {
          message: error instanceof Error ? error.message : String(error),
          type: typeof error,
          error
        });
        showErrorToast('INVALID_PIN' as ErrorCode);
        return false;
      }
      
      // Step 3: Derive keypair
      console.log('🔑 [UNLOCK] Step 3: Deriving keypair from xpriv...');
      const currentIdentity = (freshVaultData as any).identities[(freshVaultData as any).currentIdentityIndex || 0];
      console.log('👤 [UNLOCK] Current identity:', currentIdentity);
      
      const keypair = await getIdentityKeypair(xpriv, currentIdentity);
      console.log('✅ [UNLOCK] Keypair derived:', {
        hasPrivateKey: !!keypair.privateKey,
        publicKey: keypair.publicKey
      });
      
      // Step 4: Unlock session
      console.log('🔓 [UNLOCK] Step 4: Unlocking session in worker...');
      await cryptoWorker.unlockSession({
        username: currentUser.profile.username,
        privateKey: keypair.privateKey,
        xpriv
      });
      console.log('✅ [UNLOCK] Session unlocked in worker');
      
      const updatedUser = {
        ...currentUser,
        privateKey: '',
        isAuthenticated: true
      };
      
      setUser(updatedUser);
      setHasPinVault(false);
      setIsVaultLocked(false);
      
      console.log('✅ [UNLOCK] UI state updated');
      
      showSuccessToast('Vault Unlocked', 'Your vault has been successfully unlocked.');
      
      const { VaultDataService } = await import('../services/vaultDataService');
      const vaultDataService = VaultDataService.getInstance();
      const sessionStatus = await vaultDataService.getSessionStatus();
      if (sessionStatus.sessionId) {
        localStorage.setItem('vaultsession', sessionStatus.sessionId);
      }
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // IMPORTANT: Now that we have the storage key (from xpriv), re-fetch vault from Nostr
      // This allows us to decrypt encrypted vault events that were published earlier
      console.log('🔄 [UNLOCK] Re-fetching vault from Nostr with storage key...');
      try {
        // Derive storage keypair to decrypt Nostr events
        await cryptoWorker.deriveKeypairFromXpriv({ xpriv, index: 8907 }); // STORAGE_INDEX
        
        // PRE model: blob fetch deprecated; state hydration handled below
      } catch (nostrError) {
        console.warn('⚠️ [UNLOCK] Failed to fetch from Nostr (non-critical):', nostrError);
      }
        
      messenger.send('AUTH_STATUS', {
        isAuthenticated: true,
        publicKey: currentUser.publicKey
      });
      
      // Start realtime subscription now that we have storage key in session
      await startRealtime(currentUser.profile.username);

      // Hydrate from PRE streams (author-only) and reconcile
      try {
        const relays = getRelays();
        const assembled = await cryptoWorker.assembleStateFromAuthor({ username: currentUser.profile.username, relays });
        if (assembled && Array.isArray(assembled.identities)) {
          const local = await cryptoWorker.getVaultData({ username: currentUser.profile.username });
          const localCount = local?.identities?.length || 0;
          const remoteCount = assembled.identities.length || 0;
          if (remoteCount > localCount) {
            await cryptoWorker.updateVaultData({
              username: currentUser.profile.username,
              vaultData: { ...(local || {}), identities: assembled.identities },
              skipVersionIncrement: true
            });
            window.dispatchEvent(new CustomEvent('vault-data-refresh', { detail: { username: currentUser.profile.username, source: 'nostr-pre' } }));
          }
        }
      } catch (e) {
        console.warn('⚠️ [UNLOCK] PRE hydrate failed (non-critical):', e);
      }

      console.log('🎉 [UNLOCK] Vault unlock complete!');
      return true;
    } catch (error) {
      console.error('❌ [UNLOCK] Unlock vault failed with unexpected error:', error);
      setHasPinVault(true);
      setIsVaultLocked(true);
      return false;
    }
  };

  // After unlock, start realtime Nostr subscription
  const startRealtime = async (username: string) => {
    try {
      const cryptoWorker = getCryptoWorker();
      const relays = getRelays();
      await cryptoWorker.startNostrSubscription({ username, relays });
      console.log('📡 Realtime Nostr subscription started');
    } catch (e) {
      console.warn('⚠️ Failed to start realtime subscription:', e);
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