import { createContext, useContext, ParentComponent, createSignal, createEffect, onMount } from 'solid-js';
import { sanitizeDomain } from '@nostrpass/nostrHelpers';
import { useMessenger } from './MessengerProvider';
import { useEnvironment } from './EnvironmentProvider';
import type { User, UserProfile, LoginObj, VaultObj } from '@nostrpass/types';
import { createUser, getIdentityKeypair } from '../services/userService';
import { getCryptoWorker, getCryptoWorkerInstance } from '../services/cryptoWorkerSingleton';
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
    }
  };

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
          throw new Error('No active identity selected for this application');
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
    if (!cryptoWorker) throw new Error('Crypto worker not ready');
    if (!pin || pin.length < 4) throw new Error('PIN must be at least 4 digits');
    
    setIsLoading(true);
    try {
      // Create new user with xpriv and Personal identity
      const userMasterKey = await createUser();
      
      const personalIdentity = userMasterKey.identities[0];
      
      const { getStorageKeypair } = await import('../services/userService');
      const { publicKey: storagePublicKey } = await getStorageKeypair(userMasterKey.xpriv);
      
      const { publicKey: personalPublicKey } = await getIdentityKeypair(userMasterKey.xpriv, personalIdentity);
      
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

      const xprivEncrypted = await cryptoWorker.encryptData({
        data: userMasterKey.xpriv,
        password: pin
      });

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

      let recoveryData = undefined;
      if (recovery && recovery.questions.length > 0 && recovery.answers.length > 0) {
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
      }

      const passwordVerifier = await cryptoWorker.encryptData({
        data: 'NostrPass_Password_Verifier_v1',
        password: passwordKey
      });

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
        salt: passwordSalt,
        version: 1,
        updatedAt: Date.now()
      };

      const loginObj: LoginObj = {
        storagePublicKey,
        username,
        createdAt: Date.now(),
        version: 1
      };

      const vaultData: VaultData = {
        xprivEncrypted,
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
      
      await cryptoWorker.initSession({
        username,
        publicKey: storagePublicKey,
        vaultData
      });
      const createdKeypair = await getIdentityKeypair(userMasterKey.xpriv, userMasterKey.identities[0]);
      await cryptoWorker.unlockSession({
        username,
        privateKey: createdKeypair.privateKey,
        xpriv: userMasterKey.xpriv
      });
      
      localStorage.setItem('last-username', username);

      setUser(newUser);
      setIsVaultLocked(false);
      setHasPinVault(false);
      
      const sessionVerify = await cryptoWorker.getSession({ username });
      console.log('🔍 Post-creation session check:', {
        hasSession: !!sessionVerify,
        sessionUsername: (sessionVerify as any)?.username,
        isUnlocked: (sessionVerify as any)?.isUnlocked
      });
      
      console.log('🌐 Saving LoginObj and VaultObj to Nostr...');
      
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
        
        const { saveLoginObj, saveVaultObj } = await import('@nostrpass/nostrHelpers');
        const relays = getRelays();
        
        await saveLoginObj(username, loginObj, randomPublicKey, randomPrivateKey, relays);
        const { privateKey: storagePrivateKey } = await getStorageKeypair(userMasterKey.xpriv);
        await saveVaultObj(vaultObj, storagePublicKey, storagePrivateKey, relays);
        
      } catch (error) {
        console.error('❌ Failed to save to Nostr:', error);
      }

      messenger.send('AUTH_STATUS', {
        isAuthenticated: true,
        publicKey: personalPublicKey
      });
      
      return { publicKey: storagePublicKey };

    } catch (error) {
      console.error('Account creation failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (_password: string, username: string) => {
    if (!cryptoWorker) throw new Error('Crypto worker not ready');
    
    setIsLoading(true);
    try {
      console.log('🔍 Starting login for username:', username);
      
      // First try to load from local storage
      let vaultData = await cryptoWorker.getVaultData({ username });
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
          const { getLoginObj, getVaultFromNostr } = await import('@nostrpass/nostrHelpers');
          const relays = getRelays();
          
          const env = environmentName ? environmentName() : 'development';
          const loginObj = await getLoginObj(username, env, relays);
          
          if (!loginObj) {
            throw new Error('No vault found for this username');
          }
          
          const nostrVault = await getVaultFromNostr(loginObj.storagePublicKey, relays);
          
          if (nostrVault) {
            vaultData = {
              ...nostrVault
            } as any;
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
      
      await cryptoWorker.initSession({
        username,
        publicKey: (vaultData as any).publicKey,
        vaultData
      });

      // Background freshness check from Nostr
      (async () => {
        try {
          const { getLoginObj, getVaultFromNostr } = await import('@nostrpass/nostrHelpers');
          const relays = getRelays();
          const env = environmentName ? environmentName() : 'development';
          const loginObj = await getLoginObj(username, env, relays);
          if (!loginObj) return;
          const remote = await getVaultFromNostr(loginObj.storagePublicKey, relays);
          if (!remote) return;
          const localUpdatedAt = (vaultData as any)?.updatedAt || 0;
          const remoteUpdatedAt = (remote as any)?.timestamp || Date.now();
          if (remoteUpdatedAt > localUpdatedAt) {
            const merged = { ...vaultData, ...remote, updatedAt: remoteUpdatedAt } as any;
            await cryptoWorker.updateVaultData({ username, vaultData: merged });
          }
        } catch (e) {
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
          }
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

  const logout = async () => {
    const currentUser = user();
    
    setUser(null);
    setHasPinVault(false);
    setIsVaultLocked(true);
    localStorage.removeItem('last-username');
    localStorage.removeItem('vaultsession');
    
    if (currentUser && cryptoWorker) {
      try {
        await cryptoWorker.logoutUser({ username: currentUser.profile.username });
      } catch (error) {
        // ignore
      }
    }

    if (messenger.isReady()) {
      messenger.send('AUTH_STATUS', {
        isAuthenticated: false,
        publicKey: null
      });
    }
    
    if (currentUser && cryptoWorker) {
      cryptoWorker.clearSession({ 
        username: currentUser.profile.username 
      }).catch(() => {});
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
    if (!cryptoWorker) {
      return false;
    }
    
    const currentUser = user();
    if (!currentUser) {
      return false;
    }
    
    try {
      const freshVaultData = await cryptoWorker.getVaultData({ username: currentUser.profile.username });
      if (!freshVaultData) {
        throw new Error('No vault data found');
      }
      
      const xprivEncryptedBlob = (freshVaultData as any).xprivEncrypted;
      if (!xprivEncryptedBlob) {
        throw new Error('Vault data is incomplete');
      }
      
      const looksLikeCipher = /^[A-Za-z0-9+/=]+$/.test(xprivEncryptedBlob);
      let payloadToDecrypt = xprivEncryptedBlob;

      if (!looksLikeCipher) {
        try {
          const { getVaultFromNostr } = await import('@nostrpass/nostrHelpers');
          const relays = getRelays();
          const refreshed = await getVaultFromNostr((freshVaultData as any).publicKey, relays);
          if (refreshed && (refreshed as any).xprivEncrypted) {
            const updatedVault = { ...freshVaultData, xprivEncrypted: (refreshed as any).xprivEncrypted } as any;
            await cryptoWorker.updateVaultData({ username: currentUser.profile.username, vaultData: updatedVault });
            payloadToDecrypt = (refreshed as any).xprivEncrypted;
          }
        } catch {}
      }
       
      let xpriv: string;
      
      try {
        xpriv = await cryptoWorker.decryptData({
          encryptedData: payloadToDecrypt,
          password: pin
        });
      } catch (error) {
        return false;
      }
      
      const currentIdentity = (freshVaultData as any).identities[(freshVaultData as any).currentIdentityIndex || 0];
      const keypair = await getIdentityKeypair(xpriv, currentIdentity);
      
      await cryptoWorker.unlockSession({
        username: currentUser.profile.username,
        privateKey: keypair.privateKey,
        xpriv
      });
      
      const updatedUser = {
        ...currentUser,
        privateKey: '',
        isAuthenticated: true
      };
      
      setUser(updatedUser);
      setHasPinVault(false);
      setIsVaultLocked(false);
      
      const { VaultDataService } = await import('../services/vaultDataService');
      const vaultDataService = VaultDataService.getInstance();
      const sessionStatus = await vaultDataService.getSessionStatus();
      if (sessionStatus.sessionId) {
        localStorage.setItem('vaultsession', sessionStatus.sessionId);
      }
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      try {
        const vaultEvent = await cryptoWorker.saveVaultToNostr({ username: currentUser.profile.username });
        const { publishEvent } = await import('@nostrpass/nostrHelpers');
        const relays = getRelays();
        await publishEvent((vaultEvent as any).event, relays);
      } catch (error) {
        // ignore sync failures
      }
        
      messenger.send('AUTH_STATUS', {
        isAuthenticated: true,
        publicKey: currentUser.publicKey
      });
      
      return true;
    } catch (error) {
      setHasPinVault(true);
      setIsVaultLocked(true);
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