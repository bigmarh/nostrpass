import { nip19, generatePrivateKey, getPublicKey } from 'nostr-tools';
import {
    relayInit,
    getEventHash,
    signEvent
} from 'nostr-tools'
const PubSub = require('PubSub').default;
const pubsub = new PubSub();


window.pop = () => { console.log(1) };

let state = {
    note: "This is my prefilled note",
    publish: (event) => {
        let pub = relay.publish(event)
        pub.on('ok', () => {
            console.log(`${relay.url} has accepted our event`)
        })
        pub.on('failed', reason => {
            console.log(`failed to publish to ${relay.url}: ${reason}`)
        })
    },
    submitNote: () => {
        let pass = JSON.parse(localStorage.getItem('nostrpass'));
        let event = {
            kind: 1,
            pubkey: pass.pk,
            created_at: Math.floor(Date.now() / 1000),
            tags: [],
            content: state.note
        }
        event.id = getEventHash(event)
        //event.sig = signEvent(event, sk)

        ifrm.contentWindow.postMessage({ method: "get-sig", data: event, cb: 'publish' }, "*");

    }
}

let testModule = {
    oninit: async () => {
        window.relay = relayInit('wss://relay.damus.io')
        relay.on('connect', () => {
            console.log(`connected to ${relay.url}`)
        })
        relay.on('error', () => {
            console.log(`failed to connect to ${relay.url}`)
        })

        await relay.connect();

        const onUserAdd = pubsub.subscribe('got-signature', (data, topic) => {
           console.log(data);
            state.publish(data);
        });



    },
    view: () => {
        return [
            m('.current', 'Current User npub: ', state.current), m('.noteTaker', m('textarea.note', {
                oninput: (e) => {
                    state.note = e.target.value;
                }
            }, state.note)), m("button", { onclick: state.submitNote }, "Submit Note")
        ]
    }
}

window.addEventListener(
            "message",
            (event) => {
                console.log(event.data)
               /* console.log(event.source,ifrm.contentWindow)
                if (event.source !== ifrm.contentWindow) return;*/

                if(event.data.sig){
                    pubsub.publish('got-signature',event.data.event)
                }
                if(event.data.redirect){
                    window.location = event.data.redirect;
                }
                if ((event.data.token && !localStorage.getItem('nostrpass') ) || event.data.connected) {
                    localStorage.setItem('nostrpass', JSON.stringify(event.data));
                    button.style.display = "none";
                }
                if(event.data.connected === false) {
                    window.location = bridgeUrl;
                }

                else if(localStorage.getItem('nostrpass')){
                   button.style.display = "none"; 
                }
                if (event.data.method == 'get-sig') {

                }
            },
            false
        );

m.mount(document.querySelector('.main'), testModule);