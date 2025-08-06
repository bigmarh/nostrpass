import { ParentComponent } from 'solid-js';
import { CoreProvider } from './CoreProvider';
import { SimpleAuthProvider } from './SimpleAuthProvider';
import { DataProvider } from './DataProvider';

/**
 * Consolidated provider structure that reduces nesting from 6 to 3 providers:
 * 1. CoreProvider - Environment, Messenger, CryptoWorker, NostrComms
 * 2. SimpleAuthProvider - Authentication and session management
 * 3. DataProvider - Application data and state
 */
export const AppProviders: ParentComponent = (props) => {
  return (
    <CoreProvider>
      <SimpleAuthProvider>
        <DataProvider>
          {props.children}
        </DataProvider>
      </SimpleAuthProvider>
    </CoreProvider>
  );
};