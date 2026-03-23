import { createContext, useContext, ParentComponent, createSignal, createEffect } from 'solid-js';
import { useAuth } from './AuthProvider';
import { useMessenger } from './MessengerProvider';

interface AppData {
  relays: Record<string, { read: boolean; write: boolean }>;
  contacts: Array<{
    pubkey: string;
    name?: string;
    picture?: string;
  }>;
  settings: {
    theme: 'light' | 'dark' | 'auto';
    autoBackup: boolean;
    defaultRelay: string;
  };
}

interface DataContextType {
  data: () => AppData;
  isLoading: () => boolean;
  updateRelays: (relays: AppData['relays']) => void;
  addContact: (contact: AppData['contacts'][0]) => void;
  removeContact: (pubkey: string) => void;
  updateSettings: (settings: Partial<AppData['settings']>) => void;
  exportData: () => string;
  importData: (jsonData: string) => void;
}

const DataContext = createContext<DataContextType>();

const defaultData: AppData = {
  relays: {
    'wss://relay.damus.io': { read: true, write: true },
    'wss://nos.lol': { read: true, write: false },
  },
  contacts: [],
  settings: {
    theme: 'auto',
    autoBackup: true,
    defaultRelay: 'wss://relay.damus.io'
  }
};

export const DataProvider: ParentComponent = (props) => {
  const [data, setData] = createSignal<AppData>(defaultData);
  const [isLoading, setIsLoading] = createSignal(false);
  const { user, isAuthenticated } = useAuth();
  const messenger = useMessenger();

  // Load user data on authentication
  createEffect(() => {
    if (isAuthenticated()) {
      loadUserData();
    } else {
      setData(defaultData);
    }
  });

  // Set up message handlers for data-related requests
  createEffect(() => {
    if (!messenger.isReady() || !messenger.messenger) return;

    // Handle relay requests
    messenger.messenger.route('GET_RELAYS', {
      handler: () => {
        return {
          relays: data().relays
        };
      }
    });

    // Handle settings requests
    messenger.messenger.route('GET_SETTINGS', {
      handler: () => {
        return {
          settings: data().settings
        };
      }
    });

    // Handle data export requests
    messenger.messenger.route('EXPORT_DATA', {
      handler: () => {
        return {
          data: exportData(),
          timestamp: Date.now()
        };
      }
    });
  });

  const loadUserData = async () => {
    const currentUser = user();
    if (!currentUser) return;

    setIsLoading(true);
    try {
      const userDataKey = `vault-data-${currentUser.publicKey}`;
      const savedData = localStorage.getItem(userDataKey);
      
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        setData({ ...defaultData, ...parsedData });
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveUserData = (newData: AppData) => {
    const currentUser = user();
    if (!currentUser) return;

    const userDataKey = `vault-data-${currentUser.publicKey}`;
    localStorage.setItem(userDataKey, JSON.stringify(newData));
  };

  const updateRelays = (relays: AppData['relays']) => {
    const newData = { ...data(), relays };
    setData(newData);
    saveUserData(newData);
    
    // Notify parent of relay changes
    messenger.send('RELAYS_UPDATED', { relays });
  };

  const addContact = (contact: AppData['contacts'][0]) => {
    const contacts = [...data().contacts];
    const existingIndex = contacts.findIndex(c => c.pubkey === contact.pubkey);
    
    if (existingIndex >= 0) {
      contacts[existingIndex] = contact;
    } else {
      contacts.push(contact);
    }
    
    const newData = { ...data(), contacts };
    setData(newData);
    saveUserData(newData);
  };

  const removeContact = (pubkey: string) => {
    const contacts = data().contacts.filter(c => c.pubkey !== pubkey);
    const newData = { ...data(), contacts };
    setData(newData);
    saveUserData(newData);
  };

  const updateSettings = (settings: Partial<AppData['settings']>) => {
    const newSettings = { ...data().settings, ...settings };
    const newData = { ...data(), settings: newSettings };
    setData(newData);
    saveUserData(newData);
    
    // Notify parent of settings changes
    messenger.send('SETTINGS_UPDATED', { settings: newSettings });
  };

  const exportData = () => {
    return JSON.stringify({
      ...data(),
      exportTimestamp: Date.now(),
      version: '1.0.0'
    }, null, 2);
  };

  const importData = (jsonData: string) => {
    try {
      const parsedData = JSON.parse(jsonData);
      const importedData: AppData = {
        relays: parsedData.relays || defaultData.relays,
        contacts: parsedData.contacts || defaultData.contacts,
        settings: { ...defaultData.settings, ...parsedData.settings }
      };
      
      setData(importedData);
      saveUserData(importedData);
      
      messenger.send('DATA_IMPORTED', { 
        success: true, 
        timestamp: Date.now() 
      });
    } catch (error) {
      console.error('Failed to import data:', error);
      throw new Error('Invalid data format');
    }
  };

  const value: DataContextType = {
    data,
    isLoading,
    updateRelays,
    addContact,
    removeContact,
    updateSettings,
    exportData,
    importData
  };

  return (
    <DataContext.Provider value={value}>
      {props.children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within DataProvider');
  }
  return context;
}; 