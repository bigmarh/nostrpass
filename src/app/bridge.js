import User from './models/user';
import Auth from './services/auth';
import {
    relayInit,
    getEventHash,
    signEvent
} from 'nostr-tools'
const params = new Proxy(new URLSearchParams(window.location.search), {
    get: (searchParams, prop) => searchParams.get(prop),
});
if (!params.app || !params.key) window.location = params.redirect;
localStorage.setItem('lastBridgedApp', params.app);
localStorage.setItem('lastBridgedKey', params.key);
localStorage.setItem('lastBridgedRedirect', params.redirect);

import Payload from "./services/payload";

window.payload = Payload;


switch (process.env.NODE_ENV) {
    case "production":
        window.appState = "production";
        break;
    default:
        window.appState = "localdev";
        break;
}
document.addEventListener('DOMContentLoaded', function() {

    firebase.auth().onAuthStateChanged(function(user) {
        console.log("Auth state change", user)
    });


    let userData = localStorage.getItem('_userData') ? JSON.parse(localStorage.getItem('_userData')) : {};
    let state = {};
    let bridgeModule = {
        oninit: () => {
            window.addEventListener(
                "message",
                (event) => {
                    if (!state.connected);

                    console.log(event.data)
                    if (event.data.method == 'check-login') {

                        if (!localStorage.getItem(`nostrpass-${params.app}`)) {
                            return event.source.postMessage({ redirect: window.location.href }, event.origin)
                        } else {
                            return event.source.postMessage({ connected: true, token: state.token, npub: userData.npub, pk: userData.pk }, event.origin);
                        }
                    }
                    if (event.data.method == 'get-sig') {
                        let u = JSON.parse(localStorage.getItem('_userData'));
                        var pl = JSON.parse(payload.decrypt(u.encyrptedKeys, prompt("Enter your pin!")));
                        console.log(u, localStorage.getItem(`nostrpass-${params.app}`))
                        event.data.data.sig = signEvent(event.data.data, pl.sk);
                        return event.source.postMessage({ method: "push-sig", sig: event.data.data.sig, event: event.data.data }, event.origin);
                    }

                    if (event.origin !== params.redirect.slice(0, -1)) return;
                    if (state.token) {
                        console.log("has connection");
                        try {
                            return event.source.postMessage({ token: state.token, npub: userData.npub, pk: userData.pk }, event.origin)
                        } catch (e) { console.log(e) }
                    } else {

                        return event.source.postMessage({ redirect: window.location.href }, event.origin)
                    }


                },
                false
            );
            m.request({
                method: 'GET',
                url: `http://localhost:5001/nostrpass/us-central1/userApi/checkBridge/${userData.npub}/${params.app}`
            }).then(res => {
                if (!res.connected) {
                    return state.currentApp = res.app;
                }
                state.connected = res.connected;
                state.token = res.token;
                console.log(res);
                localStorage.setItem(`nostrpass-${params.app}`, res.token);
            })


        },
        view: () => {

            console.log(state.currentApp);
            return !state.currentApp ? " " : m('.app', [

                m('.appName', [
                    m('h2.name', state.currentApp.name),
                    m('.logo', m('img', { src: state.currentApp.image })),
                    m(".description", state.currentApp.description),
                    m('.permissions', [m('h3.permissions', `${state.currentApp.name} wants these permissions:`), state.currentApp.scope.map(per => {
                        return m('ul', m("li.scope", per))
                    })])
                ]),
                [m('input[type="password"][placeholder="Type Pin"]', { oninput: (e) => { return Auth.pin = e.target.value }, value: Auth.pin }),
                    m('br'),
                    m('button', {
                        onclick: () => {
                            let reqObj = { apps: {} };
                            reqObj.apps[state.currentApp.npub] = state.currentApp;

                            /*let pin = prompt("Please enter your pin", "Enter your encryption pin");*/
                            console.log(User.updateUserData(reqObj));

                            User.updateUserData(reqObj).then(() => {

                                window.location = params.redirect+"?connected=true";
                            });

                        }
                    }, "Allow"),
                    m('button', {
                        onclick: () => {
                            window.location = params.redirect;
                        }
                    }, "Cancel")
                ]

            ])
        }
    }


    console.log(bridgeModule)

    m.mount(document.querySelector('.content'), bridgeModule);
})