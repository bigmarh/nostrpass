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

            // Handle next action after unlock
            if (data?.nextAction === 'account-picker') {
                console.log('🔄 Unlock requested account-picker continuation, switching to account-picker page');
                // Navigate to account-picker page with query params (uses default 'tall' size)
                const queryParams: Record<string, string> = {};
                if (data.appOrigin) queryParams.appOrigin = data.appOrigin;
                if (data.appName) queryParams.appName = data.appName;
                if (data.requestId) queryParams.requestId = data.requestId;
                if (data.permissions) queryParams.permissions = data.permissions;

                (embassyInstance as any).openPage('account', {
                    // Use default 'tall' size from VAULT_PAGES config
                    queryParams
                });
            }

            // Dispatch window event for NostrPassButton and other listeners
            window.dispatchEvent(new CustomEvent('nostrpass:unlocked', { detail: data }));

            // Don't return anything - this is a notification, not a request/response
        },
        'nostrpass:logout': (data: any) => {
            console.log('🚪 Logout signal received from vault iframe', data);
            // Dispatch window event for NostrPassButton and other listeners
            window.dispatchEvent(new CustomEvent('nostrpass:logout', { detail: data }));
            console.log('🚪 ✅ nostrpass:logout event dispatched to window');
        },
        VAULT_DATA_UPDATED: (data: any) => {
            console.log('📦 [Embassy] Vault data updated signal received from vault iframe', data);
            // Dispatch window event for NostrPassButton and other listeners
            console.log('📦 [Embassy] Dispatching vault-data-refresh event to window');
            window.dispatchEvent(new CustomEvent('vault-data-refresh', { detail: data }));
            console.log('📦 [Embassy] ✅ vault-data-refresh event dispatched');
        },
        ACCOUNT_PICKER_SELECTED: (data: any) => {
            console.log('✅ [Embassy] Account picker selected signal received from vault iframe', data);
            // Dispatch window event for NostrPassButton and other listeners
            window.dispatchEvent(new CustomEvent('account-picker-selected', { detail: data }));
            console.log('✅ [Embassy] account-picker-selected event dispatched to window');
        },
        PERMISSION_GRANTED: (data: any) => {
            console.log('✅ [Embassy] Permission granted signal received from vault iframe', data);
            // Dispatch window event so permission manager can resolve the promise
            window.dispatchEvent(new CustomEvent('permission-granted', { detail: data }));
        },
        PERMISSION_DENIED: (data: any) => {
            console.log('❌ [Embassy] Permission denied signal received from vault iframe', data);
            // Dispatch window event so permission manager can reject the promise
            window.dispatchEvent(new CustomEvent('permission-denied', { detail: data }));
        }
    }
};