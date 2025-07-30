import { ParentComponent } from 'solid-js';
import { EnvironmentProvider } from './EnvironmentProvider';
import { MessengerProvider } from './MessengerProvider';
import { CryptoWorkerProvider } from './CryptoWorkerProvider';
import { AuthProvider } from './AuthProvider';
import { DataProvider } from './DataProvider';
import { NostrCommsProvider } from './NostrCommsProvider';

export const AppProviders: ParentComponent = (props) => {
  return (
    <EnvironmentProvider>
      <MessengerProvider>
        <CryptoWorkerProvider>
          <NostrCommsProvider>
            <AuthProvider>
              <DataProvider>
                {props.children}
              </DataProvider>
            </AuthProvider>
          </NostrCommsProvider>
        </CryptoWorkerProvider>
      </MessengerProvider>
    </EnvironmentProvider>
  );
};

// Re-export all providers and hooks
export { EnvironmentProvider, useEnvironment } from './EnvironmentProvider';
export { MessengerProvider, useMessenger } from './MessengerProvider';
export { CryptoWorkerProvider, useCryptoWorker, useCryptoWorkerReady } from './CryptoWorkerProvider';
export { AuthProvider, useAuth } from './AuthProvider';
export { DataProvider, useData } from './DataProvider';
export { NostrCommsProvider, useNostrComms } from './NostrCommsProvider'; 