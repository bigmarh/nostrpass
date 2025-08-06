import { NostrPassEmbassy } from "./embassy";

export const embassyMessageHandlers = function (embassyInstance: NostrPassEmbassy) {


    return {
        HIDE_VAULT: () => {
            console.log('Hide vault signal received');
            embassyInstance.hide();
            return { acknowledged: true };
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
        AUTH_STATUS: () => {
            console.log('Auth status signal received');
            return { acknowledged: true };
        },
        GET_RELAYS: () => {
            console.log('Get relays signal received');
            return { acknowledged: true };
        },
        GOT_ERROR: () => {
            console.log('Error signal received');
            return { acknowledged: true };
        }
    }
};