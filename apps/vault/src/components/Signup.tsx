import { Component, createSignal, Show, For } from 'solid-js';
import { createUser } from '../services/userService';
import type { UserMasterKey } from '@nostrpass/types';

export const Signup: Component = () => {
  const [isCreating, setIsCreating] = createSignal(false);
  const [userMasterKey, setUserMasterKey] = createSignal<UserMasterKey | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  const handleSignup = async () => {
    try {
      setIsCreating(true);
      setError(null);
      
      console.log('Creating new user...');
      const newUser = await createUser();
      console.log('User created:', newUser);
      
      setUserMasterKey(newUser);
    } catch (err) {
      console.error('Signup error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div style={{ padding: '20px', 'max-width': '600px', margin: '0 auto' }}>
      <h1>NostrPass Signup</h1>
      
      <Show
        when={userMasterKey()}
        fallback={
          <>
            <p>Click the button below to create a new user with a master key and initial "Personal" identity.</p>
            
            <button 
              onClick={handleSignup} 
              disabled={isCreating()}
              style={{
                padding: '10px 20px',
                'font-size': '16px',
                cursor: isCreating() ? 'not-allowed' : 'pointer',
                opacity: isCreating() ? 0.5 : 1
              }}
            >
              {isCreating() ? 'Creating...' : 'Create New User'}
            </button>
            
            <Show when={error()}>
              <div style={{ color: 'red', 'margin-top': '10px' }}>
                Error: {error()}
              </div>
            </Show>
          </>
        }
      >
        <div>
          <h2>User Created Successfully!</h2>
          
          <div style={{ 'margin-top': '20px' }}>
            <h3>Master Key (xpriv)</h3>
            <p style={{ 
              'word-break': 'break-all', 
              'font-family': 'monospace',
              'background-color': '#f5f5f5',
              padding: '10px',
              'border-radius': '4px'
            }}>
              {userMasterKey()!.xpriv}
            </p>
            <p style={{ color: '#666', 'font-size': '14px', 'margin-top': '5px' }}>
              ⚠️ Keep this private! This is your master key.
            </p>
          </div>
          
          <div style={{ 'margin-top': '20px' }}>
            <h3>Identities</h3>
            <For each={userMasterKey()!.identities}>
              {(identity) => (
                <div style={{
                  border: '1px solid #ddd',
                  padding: '10px',
                  'margin-bottom': '10px',
                  'border-radius': '4px'
                }}>
                  <h4>{identity.nickname}</h4>
                  <p style={{ 'font-family': 'monospace', 'font-size': '14px' }}>
                    Path: {identity.path}
                  </p>
                </div>
              )}
            </For>
          </div>
          
          <button 
            onClick={() => setUserMasterKey(null)}
            style={{
              'margin-top': '20px',
              padding: '10px 20px',
              'font-size': '16px',
              cursor: 'pointer'
            }}
          >
            Start Over
          </button>
        </div>
      </Show>
    </div>
  );
};