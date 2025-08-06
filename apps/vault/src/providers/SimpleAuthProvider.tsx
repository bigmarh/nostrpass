import { createSignal, createContext, useContext, ParentComponent, onMount, createEffect } from 'solid-js';
import { authService } from '../services/authService';
import { sessionService } from '../services/sessionService';
import { permissionService } from '../services/permissionService';
import { useMessenger, useEnvironment } from './CoreProvider';
import type { User, AuthContextType } from '@nostrpass/types';

const AuthContext = createContext<AuthContextType>();

export const SimpleAuthProvider: ParentComponent = (props) => {
  const [user, setUser] = createSignal<User | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [hasPinVault, setHasPinVault] = createSignal(false);
  const [isVaultLocked, setIsVaultLocked] = createSignal(true);
  const [tempVaultData, setTempVaultData] = createSignal<any>(null);
  
  const { getRelays } = useEnvironment();
  const { messenger, isReady } = useMessenger();

  // Setup message handlers
  createEffect(() => {
    if (!isReady() || !messenger) return;

    const currentUser = user();
    if (!currentUser) return;

    // NIP-07 handlers
    messenger.route('GET_PUBLIC_KEY', {
      handler: async () => {
        const u = user();
        return u ? u.publicKey : null;
      }
    });

    messenger.route('SIGN_EVENT', {
      handler: async (data: any) => {
        const u = user();
        if (!u) throw new Error('No user logged in');
        
        const permission = await permissionService.checkPermission(
          u.profile.username,
          data.origin,
          'signEvent',
          data.kinds
        );

        if (permission === 'denied') {
          throw new Error('Permission denied');
        }

        if (permission === 'ask') {
          const granted = await messenger.callPrimary('REQUEST_PERMISSION', {
            origin: data.origin,
            method: 'signEvent',
            kinds: data.kinds
          });
          
          if (!granted) {
            throw new Error('Permission denied by user');
          }
        }

        return sessionService.signEvent(u.profile.username, data.event);
      }
    });

    messenger.route('NIP04_ENCRYPT', {
      handler: async (data: any) => {
        const u = user();
        if (!u) throw new Error('No user logged in');
        
        const permission = await permissionService.checkPermission(
          u.profile.username,
          data.origin,
          'nip04'
        );

        if (permission === 'denied') {
          throw new Error('Permission denied');
        }

        return sessionService.encrypt(u.profile.username, data.plaintext, data.pubkey);
      }
    });

    messenger.route('NIP04_DECRYPT', {
      handler: async (data: any) => {
        const u = user();
        if (!u) throw new Error('No user logged in');
        
        const permission = await permissionService.checkPermission(
          u.profile.username,
          data.origin,
          'nip04'
        );

        if (permission === 'denied') {
          throw new Error('Permission denied');
        }

        return sessionService.decrypt(u.profile.username, data.ciphertext, data.pubkey);
      }
    });

    messenger.route('GET_RELAYS', {
      handler: async () => {
        const relays = getRelays();
        return relays.reduce((acc, relay) => {
          acc[relay] = { read: true, write: true };
          return acc;
        }, {} as Record<string, any>);
      }
    });
  });

  // Auto-restore session on mount
  onMount(async () => {
    try {
      const storedSession = await sessionService.getStoredSession();
      if (storedSession) {
        const restored = await authService.restoreSession(storedSession.sessionId);
        if (restored) {
          setUser(restored.user);
          setIsVaultLocked(false);
          setHasPinVault(restored.vaultData.hasPin);
        }
      }
    } catch (error) {
      console.error('Failed to restore session:', error);
    }
  });

  const createAccount = async (
    username: string,
    password: string,
    pin?: string,
    recoveryQuestions?: Array<{ question: string; answer: string }>
  ) => {
    setIsLoading(true);
    try {
      const result = await authService.createAccount(username, password, pin, recoveryQuestions);
      setUser(result.user);
      setIsVaultLocked(false);
      setHasPinVault(!!pin);
      await sessionService.saveSession(result.sessionInfo.sessionId, username);
      return result.user;
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (password: string, username?: string) => {
    setIsLoading(true);
    try {
      // Get vault data from worker or Nostr
      let vaultData = await sessionService.getVaultData(username!);
      
      if (!vaultData) {
        // Try to get from Nostr
        const { getVaultFromNostr } = await import('@nostrpass/nostrHelpers');
        vaultData = await getVaultFromNostr(username!, getRelays());
        
        if (!vaultData) {
          throw new Error('No vault found');
        }
      }

      // Check if vault has PIN
      if (vaultData.hasPin) {
        setTempVaultData({ vaultData, username });
        setHasPinVault(true);
        setIsVaultLocked(true);
        return null;
      }

      const result = await authService.login(password, username!, vaultData);
      setUser(result.user);
      setIsVaultLocked(false);
      await sessionService.saveSession(result.sessionInfo.sessionId, username!);
      return result.user;
    } finally {
      setIsLoading(false);
    }
  };

  const unlockVault = async (pin: string) => {
    const temp = tempVaultData();
    if (!temp) throw new Error('No vault data to unlock');

    setIsLoading(true);
    try {
      const xpriv = await authService.unlockWithPin(pin, temp.vaultData, temp.encryptionKey);
      
      // Create full session with unlocked data
      const result = await authService.login('', temp.username, {
        ...temp.vaultData,
        xpriv
      });
      
      setUser(result.user);
      setIsVaultLocked(false);
      setTempVaultData(null);
      await sessionService.saveSession(result.sessionInfo.sessionId, temp.username);
      return result.user;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authService.logout();
      setUser(null);
      setIsVaultLocked(true);
      setHasPinVault(false);
      setTempVaultData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = (updates: Partial<User['profile']>) => {
    const currentUser = user();
    if (currentUser) {
      setUser({
        ...currentUser,
        profile: {
          ...currentUser.profile,
          ...updates
        }
      });
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isVaultLocked,
    hasPinVault,
    createAccount,
    login,
    logout,
    unlockVault,
    updateProfile
  };

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