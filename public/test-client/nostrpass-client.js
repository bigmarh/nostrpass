import {
    relayInit,
    getEventHash,
    signEvent
} from 'nostr-tools'

class Nostr {
    constructor(window) {
        this.bridgeWindow = window;
        window.addEventListener(
            "message",
            (event) => {
                console.log(event.data)
                /* console.log(event.source,ifrm.contentWindow)
                 if (event.source !== ifrm.contentWindow) return;*/

                if (event.data.sig) {
                    pubsub.publish('got-signature', event.data.event)
                }
                if (event.data.redirect) {
                    window.location = event.data.redirect;
                }
                if ((event.data.token && !localStorage.getItem('nostrpass')) || event.data.connected) {
                    localStorage.setItem('nostrpass', JSON.stringify(event.data));
                    button.style.display = "none";
                }
                if (event.data.connected === false) {
                    window.location = bridgeUrl;
                } else if (localStorage.getItem('nostrpass')) {
                    button.style.display = "none";
                }
                if (event.data.method == 'get-sig') {

                }
            },
            false
        );
    }

   	lastResolve;

    //nip-07 methods
    async signEvent(event) {
        event.id = getEventHash(event);
        event.pubkey = await this.getPublicKey();
        this.bridgeWindow.postMessage({ method: "get-sig", data: event, cb: 'publish' }, "*");
    }

    async getPublicKey() {
        this.bridgeWindow.postMessage({ method: "get-pk", data: event, cb: 'publish' }, "*");
    }
}