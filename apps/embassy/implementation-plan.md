# Embassy Implementation Plan

A step-by-step guide to rebuilding the embassy functionality.

## Phase 1: Basic Setup ✅
- [x] Core types and interfaces
- [x] Basic class structure
- [x] Global initialization
- [x] window.nostr installation

## Phase 2: Iframe Management
- [ ] Create iframe element
- [ ] Style iframe (hidden by default)
- [ ] Show/hide iframe methods
- [ ] Iframe security attributes (sandbox, etc.)

## Phase 3: Message Communication
- [ ] Set up postMessage listener
- [ ] Message validation (origin check)
- [ ] Basic request/response pattern
- [ ] Message type definitions

## Phase 4: Core Nostr Methods
- [ ] getPublicKey implementation
- [ ] signEvent implementation
- [ ] Error handling for each method
- [ ] Loading states

## Phase 5: Authentication Flow
- [ ] Detect if user is authenticated
- [ ] Handle auth required state
- [ ] Store auth state
- [ ] Logout functionality

## Phase 6: Advanced Features
- [ ] getRelays implementation
- [ ] NIP-04 encrypt/decrypt
- [ ] Request queuing
- [ ] Retry logic

## Phase 7: UI Elements
- [ ] Login button
- [ ] Button styling
- [ ] Position configuration
- [ ] Theme support

## Phase 8: Production Features
- [ ] Permission management
- [ ] Biometric authentication
- [ ] Provider override system
- [ ] Event dispatching

## Implementation Tips

1. **Start Simple**: Get basic iframe + postMessage working first
2. **Test Each Step**: Build a test page to verify each function
3. **Security First**: Always validate message origins
4. **Error Handling**: Every promise should handle rejections
5. **Debug Mode**: Use config.debug to log helpful info

## Testing Checklist

For each implemented function:
- [ ] Works in isolation
- [ ] Handles errors gracefully
- [ ] Communicates with vault correctly
- [ ] Updates UI appropriately
- [ ] Works with real Nostr apps