import User from "../../../models/user"
import loader from '../../../services/loaders'
import Auth from '../../../services/auth';
import fullLoader from '../../../services/fullLoader';


var mnemonicSubmodule = function(ctrl) {
    return {
        oninit: function() {

            if(!Auth.pin) m.route.set('/pinCreation');
            if (!window.Worker && !ctrl.mnemonic) Wallet.generateMnemonic().then(function(mnemonic) {
                ctrl.mnemonic = mnemonic;
                m.redraw();
            });
        },
        view: function() {
            let numOfRows = 8;
            let numPerRow = 3;
            return m(".reg-page", [
                m('h4', 'Create Wallet'),
                m(".mdc-card.registration-card",
                    [
                        m(".mdc-card__media.mdc-card__media--square",
                            m(".mdc-card__media-content",
                                m("h5.mb-5", "Save your mnemonic:"),
                                m(".card.bg-gradient.p-3.mb-4", [
                                    m("p", "Your mnemonic is a very important piece of data and cannot be lost. It is your secret backup phrase that will allow you to recover your wallet."),
                                    m("p.text-danger.font-weight-bold.text-uppercase", { style: { fontSize: "1.2em", textAlign: "center" } }, "Please write the following words down and keep them safe."),
                                    !ctrl.mnemonic ? m('.loading-mnemonic', m(loader("spinning-circles", { id: "mnemonic-loader" }))) : m("p.alert.alert-dark", m('table.mnemonic',
                                        new Array(numOfRows).fill('').map((_, i) => {
                                            let words = ctrl.mnemonic.split(" ");
                                            let row = words.slice(i * numPerRow, (i + 1) * numPerRow);
                                            return m('tr', row.map((word, index) => {
                                                let count = 1 + numPerRow * (i);
                                                return m('td', m("b", (index + count) + "."), m("span.text-center", word + " "))
                                            }))
                                        })))
                                ])
                            )
                        ),
                        m(".mdc-card__actions",
                            [
                                m(".mdc-card__action-icons.left", m(".mdc-card__action-buttons",
                                    [
                                        m("button.mdc-button.mdc-card__action.mdc-card__action--button", {
                                                onclick: Auth.logout
                                            },
                                            "Cancel"
                                        )
                                    ]
                                )),
                                m(".mdc-card__action-icons", m(".mdc-card__action-buttons",
                                    [
                                        m(".button.mdc-button.mdc-card__action.mdc-card__action--button", {
                                            onclick: function() {
                                                return m.route.set('/sanityCheck');
                                            }
                                        }, "Next"),
                                    ]
                                ))
                            ]
                        )
                    ]
                )
            ])
        }
    }
}

export default mnemonicSubmodule