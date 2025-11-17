export const embassyMessageHandlers = function (embassyInstance) {
    return {
        HIDE_VAULT: () => {
            console.log('🔙 Hide vault signal received from vault iframe');
            try {
                embassyInstance.hide();
                console.log('✅ Vault hidden successfully');
                return { acknowledged: true };
            }
            catch (error) {
                console.error('❌ Failed to hide vault:', error);
                return { acknowledged: false, error: error instanceof Error ? error.message : 'Unknown error' };
            }
        },
        SHOW_VAULT: (page = 'vault') => {
            console.log('Show vault signal received');
            embassyInstance.show(page);
            return { acknowledged: true };
        },
        VAULT_READY: () => {
            console.log('Vault ready signal received');
            // Set the embassy as ready
            embassyInstance._isReady = true;
            // Dispatch ready event
            const readyEvent = new CustomEvent('nostr:ready', {
                detail: { embassy: embassyInstance }
            });
            window.dispatchEvent(readyEvent);
            return { acknowledged: true };
        },
        AUTH_STATUS: (data) => {
            console.log('Auth status signal received', data);
            return { acknowledged: true };
        },
        GET_RELAYS: () => {
            console.log('Get relays signal received');
            return { acknowledged: true };
        },
        GOT_ERROR: () => {
            console.log('Error signal received');
            return { acknowledged: true };
        },
        PROMPT_REQUIRED: async (data) => {
            console.log('Prompt requested by vault:', data);
            if (data?.promptType === 'PIN_PAD') {
                const ok = await embassyInstance.requestPinUnlock();
                if (!ok) {
                    console.warn('PIN prompt canceled or failed');
                }
            }
            return { acknowledged: true };
        },
        'nostrpass:unlocked': (data) => {
            console.log('🔓 Vault unlocked signal received from vault iframe', data);
            // Notify any waiting operations that unlock is complete
            if (data?.forOperation) {
                console.log('✅ Unlock was for an operation, notifying waiters');
                embassyInstance.notifyUnlocked();
            }
            // Dispatch window event for NostrPassButton and other listeners
            window.dispatchEvent(new CustomEvent('nostrpass:unlocked', { detail: data }));
            // Don't return anything - this is a notification, not a request/response
        }
    };
};
//# sourceMappingURL=embassyMessageHandlers.js.map