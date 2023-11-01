import Auth from "../../../services/auth";
import User from "../../../models/user";
import fullLoader from "../../../services/fullLoader";

var pinConfirmSubmodule = function(ctrl) {
    return {
        oninit: function() {

            ctrl.showLoader = false;
            if (!Auth.pin) return m.route.set('/mnemonic');
            //if (!User.current.userdata) return m.route.set('/login');
        },
        view: function() {
            return [

                m(".reg-page", [
                    m('h4', 'Create Wallet'),
                    m(".mdc-card.registration-card",
                        [
                            m(".mdc-card__media.mdc-card__media--square",
                                m(".mdc-card__media-content", m("h4.mb-5", "Verify your PIN"),
                                    m(".card.bg-gradient.p-3.mb-4", [
                                        (Auth.confirmPin !== Auth.pin || ctrl.showLoader) ?
                                        m(".alert.alert-danger.text-center.mt-3", [
                                            m("span", "Your pin must match previously entered pin."),

                                        ]) :
                                        m(".alert.alert-success.text-center.mt-3", "Great, your pins match! "),
                                        m("p", "Re-enter your PIN to verify."),
                                        m("input.form-control[name='pin'][placeholder='Re-enter PIN '][type='password'][minlength='4']", {
                                            autofocus: true,
                                            oncreate: function(vnode) {
                                                vnode.dom.addEventListener("keydown", function(e) {

                                                    if (e.keyCode == 13 && Auth.confirmPin == Auth.pin) {
                                                        e.preventDefault();
                                                        return m.route.set('/mnemonic');
                                                    }
                                                })
                                                vnode.dom.focus();
                                            },
                                            onkeyup: function(e) {
                                                Auth.confirmPin = e.target.value;
                                            }
                                        }),
                                        m('div.underline-text', { style: { marginTop: "20px" } }, "Try again? ", m("u.btn", {
                                            style: { cursor: "pointer" },
                                            onclick: function() {
                                                return m.route.set('/pinCreation');
                                            }
                                        }, "Click to create a new pin."))

                                    ]),

                                ), m(".mdc-card__actions",
                                    [
                                        m(".mdc-card__action-icons.left", m(".mdc-card__action-buttons",
                                            [
                                                m("button.mdc-button.mdc-card__action.mdc-card__action--button", {
                                                        onclick: m.route.set.bind(this, '/pinCreation')
                                                    },
                                                    "Cancel"
                                                )
                                            ]
                                        )),
                                        m(".mdc-card__action-icons", m(".mdc-card__action-buttons",
                                            [
                                                Auth.confirmPin === Auth.pin && m(".button.mdc-button.mdc-card__action.mdc-card__action--button" + ((Auth.confirmPin !== Auth.pin || ctrl.showLoader) ? '.disabled' : ''), {
                                                    onclick: function() {
                                                        if (Auth.confirmPin !== Auth.pin || ctrl.showLoader) return;
                                                        //user has confirmed PIN, create wallets
                                                        ctrl.showLoader = true;
                                                        m.redraw();
                                                        return m.route.set('/mnemonic')

                                                    }
                                                }, "Continue to username"), ,
                                                ((ctrl.showLoader) ? m(fullLoader("Creating your wallet...")) : '')
                                            ]
                                        ))
                                    ]
                                ))
                        ])
                ])
            ]
        }
    }
}

export default pinConfirmSubmodule;