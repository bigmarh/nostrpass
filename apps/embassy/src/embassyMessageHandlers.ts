import { NostrPassEmbassy } from "./embassy";

export const embassyMessageHandlers = function (embassyInstance: NostrPassEmbassy) {


    return {
        HIDE_VAULT: () => {
            console.log('🔙 Hide vault signal received from vault iframe');
            try {
                embassyInstance.hide();
                console.log('✅ Vault hidden successfully');
                return { acknowledged: true };
            } catch (error) {
                console.error('❌ Failed to hide vault:', error);
                return { acknowledged: false, error: error instanceof Error ? error.message : 'Unknown error' };
            }
        },
        SHOW_VAULT: (page: string = 'vault') => {
            console.log('Show vault signal received');
            embassyInstance.show(page);
            return { acknowledged: true };
        },
        VAULT_READY: () => {
            console.log('Vault ready signal received');
            
            // Set the embassy as ready
            (embassyInstance as any)._isReady = true;
            
            // Dispatch ready event
            const readyEvent = new CustomEvent('nostr:ready', {
                detail: { embassy: embassyInstance }
            });
            window.dispatchEvent(readyEvent);
            
            return { acknowledged: true };
        },
        AUTH_STATUS: (data?: any) => {
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
        PROMPT_REQUIRED: async (data: any) => {
            console.log('Prompt requested by vault:', data);
            if (data?.promptType === 'PIN_PAD') {
                const ok = await (embassyInstance as any).requestPinUnlock();
                if (!ok) {
                    console.warn('PIN prompt canceled or failed');
                }
            }
            return { acknowledged: true };
        },
        'nostrpass:unlocked': (data: any) => {
            console.log('🔓 Vault unlocked signal received from vault iframe', data);
            // Notify any waiting operations that unlock is complete
            if (data?.forOperation) {
                console.log('✅ Unlock was for an operation, notifying waiters');
                (embassyInstance as any).notifyUnlocked();
            }
            // Don't return anything - this is a notification, not a request/response
        }
    }
};