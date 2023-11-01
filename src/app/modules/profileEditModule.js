import User from '../models/user.js';
import Auth from '../services/auth.js';
import { nip19, generatePrivateKey, getPublicKey } from 'nostr-tools';
import {
    relayInit,
    getEventHash,
    signEvent
} from 'nostr-tools'
let errors = { name: [] };
const relay = relayInit('wss://big.fist.black');


let profileEditModule = {
    keys: {},
    fkeys:{},
    oninit: async () => {
        User.getUserData().then(function(userdata) {
            if(userdata) User._data = userdata;
            localStorage.setItem('_userData', JSON.stringify(userdata));
            if (!User._data.encyrptedKeys) {
                profileEditModule.keys.sk = generatePrivateKey();
                profileEditModule.keys.pk = getPublicKey(profileEditModule.keys.sk);
                profileEditModule.keys.nsec = nip19.nsecEncode(profileEditModule.keys.sk);
                profileEditModule.keys.npub = nip19.npubEncode(profileEditModule.keys.pk);
                User._data.npub = profileEditModule.keys.npub;
                User._data.pk = profileEditModule.keys.pk;

            }
        }).catch(console.error);

        profileEditModule.fkeys.sk = generatePrivateKey();
        profileEditModule.fkeys.pk = getPublicKey(profileEditModule.fkeys.sk);
        profileEditModule.fkeys.nsec = nip19.nsecEncode(profileEditModule.fkeys.sk);
        profileEditModule.fkeys.npub = nip19.npubEncode(profileEditModule.fkeys.pk);

        console.log(profileEditModule.fkeys);
        relay.on('connect', () => {
            console.log(`connected to ${relay.url}`)
        })
        relay.on('error', () => {
            console.log(`failed to connect to ${relay.url}`)
        })


        await relay.connect()
    },
    usernameAvailable: true,
    copyHit: false,
    updateUserData: () => {

        console.log(!User._data.encyrptedKeys, "exists");
        if(!User._data.apps) User._data.apps = {0:"loveandpeace"};
        User._data.encyrptedKeys = !User._data.encyrptedKeys ? payload.encrypt(JSON.stringify(profileEditModule.keys), Auth.pin) : User._data.encyrptedKeys;
        User.updateUserData(User._data).then((res) => {


            let sub = relay.sub([{
                kinds: [3],
                authors: [profileEditModule.keys.pk]
            }])
            sub.on('event', event => {
                console.log('got event:', event)
            })

            let event = {
                kind: 0,
                pubkey: profileEditModule.keys.pk,
                created_at: Math.floor(Date.now() / 1000),
                tags: [],
                content: JSON.stringify(User._data)
            }
            console.log(event)
            event.id = getEventHash(event)
            event.sig = signEvent(event, profileEditModule.keys.sk)

            let pub = relay.publish(event)
            pub.on('ok', () => {
                console.log(`${relay.url} has accepted our event`)
            })
            pub.on('failed', reason => {
                console.log(`failed to publish to ${relay.url}: ${reason}`)
            });
            m.route.set('dash');
        });
    },
    view: () => {
        return [m("form", {
                onsubmit: (e) => {
                    e.preventDefault();
                    if (profileEditModule.usernameAvailable)
                        profileEditModule.updateUserData();
                    else
                        alert('You have to choose a unique username');
                }
            },
            [m('h2', "Create your Profile"),
                m('div.npub-label', "npub:", m('a.underline-text', {
                    onclick: (e) => {
                        // Copy the text inside the text field
                        navigator.clipboard.writeText(User._data.npub);
                        profileEditModule.copyHit = true;
                        setTimeout(() => {
                            profileEditModule.copyHit = false;
                            m.redraw()
                        }, 1000)

                    }
                }, "copy"), m('span.copied', { class: profileEditModule.copyHit ? "show" : "" }, 'copied!')),
                m('h4.npub', User._data.npub),
                m("p",
                    [

                        m("label[for='display_name']",
                            "Username:"
                        ),
                        m("br"),
                        m("input[type='text'][id='display_name']", {
                            "style": {
                                "margin-top": "5px",
                                "width": "100%"
                            },
                            onchange: (e) => {
                                User.checkIfUsernameIsAvailable(e.target.value).then(resp => {
                                    if (resp.error) {
                                        errors.name.push(resp.error);
                                        profileEditModule.usernameAvailable = false;
                                    } else {
                                        profileEditModule.usernameAvailable = true;
                                    }

                                });
                                User.setProperty("name", e.target.value);
                            },
                            value: User._data.name
                        }),
                        m('.errors', errors.name.map(error => { return m('p', error) }))
                    ]
                ),
                !User._data.encyrptedKeys && m("p",
                    [
                        m("label[for='pin']",
                            "pin: (Choose a secure password, for recovery)"
                        ),
                        m("br"),
                        m("input[type='password'][id='pin'][required]", {
                            "style": {
                                "margin-top": "5px",
                                "width": "100%"
                            },
                            oninput: (e) => {
                                Auth.pin = e.target.value;
                            },
                            value: Auth.pin
                        })
                    ]
                ),
                m("p",
                    [
                        m("label[for='displayName']",
                            "Display Name:"
                        ),
                        m("br"),
                        m("input[type='text'][id='displayName']", {
                            "style": { "margin-top": "5px", "width": "100%" },
                            oninput: (e) => {
                                return User.setProperty("displayName", e.target.value);
                            },
                            value: User._data.displayName
                        })
                    ]
                ),
                m("p",
                    [
                        m("label[for='picture']",
                            "Picture url:"
                        ),
                        m("br"),
                        m("input[type='text'][id='picture']", {
                            "style": { "margin-top": "5px", "width": "100%" },
                            oninput: (e) => {
                                return User.setProperty("picture", e.target.value);
                            },
                            value: User._data.picture
                        })
                    ]
                ),
                m("p",
                    m("input[type='file']")
                ),
                m("p",
                    m("img[src='")
                ),
                m("p"),
                m("p",
                    [
                        m("label[for='about']",
                            "About:"
                        ),
                        m("br"),
                        m("input[type='text'][id='about']", {
                            "style": { "margin-top": "5px", "width": "100%" },
                            oninput: (e) => {
                                return User.setProperty("about", e.target.value);
                            },
                            value: User._data.about
                        })
                    ]
                ),
                m("p",
                    [
                        m("label[for='banner']",
                            "Banner url:"
                        ),
                        m("br"),
                        m("input[type='text'][id='banner']", {
                            "style": { "margin-top": "5px", "width": "100%" },
                            oninput: (e) => {
                                return User.setProperty("bannerUrl", e.target.value);
                            },
                            value: User._data.bannerUrl
                        })
                    ]
                ),
                m("p",
                    m("input[type='file']")
                ),
                m("p"),
                m("p",
                    [
                        m("label[for='website']",
                            "website:"
                        ),
                        m("br"),
                        m("input[type='text'][id='website']", {
                            "style": { "margin-top": "5px", "width": "100%" },
                            oninput: (e) => {
                                return User.setProperty("website", e.target.value);
                            },
                            value: User._data.website
                        })
                    ]
                ),
                m("p",
                    [
                        m("label[for='lud16']",
                            "Bitcoin lightning address ⚡ (lud16):"
                        ),
                        m("br"),
                        m("input[type='text'][id='lud16']", {
                            "style": { "margin-top": "5px", "width": "100%" },
                            oninput: (e) => {
                                return User.setProperty("lud16", e.target.value);
                            },
                            value: User._data.lud16
                        })
                    ]
                ),
                m("p",
                    [
                        m("label[for='nip05']",
                            "Nostr address (nip05):"
                        ),
                        m("br"),
                        m("input[type='text'][id='nip05']", {
                            "style": { "margin-top": "5px", "width": "100%" },
                            oninput: (e) => {
                                return User.setProperty("nip05", e.target.value);
                            },
                            value: User._data.nip05
                        })
                    ]
                ),


                m("p",
                    m("button.sc-beySbM.bVbvXf[type='submit']", {
                            /*onclick: (e) => {
                                //e.preventDefault();
                                
                            }*/
                        },
                        "Save"
                    )
                )
            ]
        )]
    }

}

export default function() { return profileEditModule };