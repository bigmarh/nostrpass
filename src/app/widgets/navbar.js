import User from "../models/user";
import Auth from "../services/auth";



export default function(drawer) {
    return {
        oninit: function() {

        },
        view: function() {

            return [

                m("section.mdc-top-app-bar__section.balance-section", [
                    User.pic(User.current.user() &&
                        User.current.user().photoURL, {
                            onclick: function() {
                                drawer.open = true;
                            }
                        }),
                    m("a[id='title-balance'][onclick='document.getElementById(\'menu-transaction\').click()']", {
                        onclick: () => {
                            m.route.set("/transactions")
                        }
                    }, [
                        m('span', User.balance.native ? User.formatAmount(User.balance.native) : "0"),
                        m('img.small-denomination', { src: "images/Satoshi regular black.svg" })
                    ])
                ]),
                m("section.main-nav.mdc-top-app-bar__section.mdc-top-app-bar__section--align-end[role='toolbar']",
                    [
                        /*m("a.material-icons.mdc-top-app-bar__action-item", {
                                                        href: "#/share"
                                                    },
                                                    "share"
                                                ),*/
                        m("a.material-icons.mdc-top-app-bar__action-item[alt='Print this page'][aria-label='Print this page'][href='#/dash'][onclick='document.getElementById(\'menu-payment\').click()']",
                            "account_balance_wallet"
                        ),
                        m("a.material-icons.mdc-top-app-bar__action-item[alt='Print this page'][aria-label='Print this page']", {
                            onclick: User.privateKey ? function() {
                                User.privateKey = ""
                            } : Auth.openPin.bind(Auth, function(response) {
                                console.log('unlocked', new Date())
                            })
                        }, [
                            ((User.privateKey) ? m("i.material-icons", "lock_open") : m("i.material-icons", "lock"))
                        ])
                    ])
            ]

        }
    }
}