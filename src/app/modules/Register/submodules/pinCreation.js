import Auth from "../../../services/auth";
import User from "../../../models/user";

var pinCreationSubmodule = function(ctrl) {
    return {
        oninit: function() {
           
            console.log("Start Worker");
            newWorker.postMessage('Make New Mnemonic');
            ctrl.showLoader = false;
            if (User.data().mainWallet) return m.route.set("/dash")
        },
        view: function() {
            return [

                m(".reg-page", [
                    m('h4', 'Create Pin'),
                    m(".mdc-card.registration-card",
                        [
                            m(".mdc-card__media.mdc-card__media--square",
                                m(".mdc-card__media-content",
                                    m("h5.mb-5", "Create your PIN"),
                                    m(".card.bg-gradient.p-3.mb-4", [
                                        m("p", "This PIN allows you to secure the access of your account."),
                                        m("input.form-control[name='pin'][placeholder='Enter PIN '][type='password'][minlength='4']", {
                                            autofocus: true,
                                            oncreate: function(vnode) {
                                                vnode.dom.addEventListener("keydown", function(e) {

                                                    if (e.keyCode == 13) {
                                                        e.preventDefault();
                                                        return m.route.set('/confirmPin');
                                                    }
                                                })
                                                vnode.dom.focus();
                                            },
                                            onkeyup: function(e) {
                                                Auth.setPin(e.target.value)
                                            }
                                        })
                                    ])
                                )
                            ),
                            m(".mdc-card__actions",
                                [
                                    
                                    m(".mdc-card__action-icons", m(".mdc-card__action-buttons",
                                        [
                                            (Auth.pin && Auth.pin.length > 3) ? m(".button.mdc-button.mdc-card__action.mdc-card__action--button", {
                                                onclick: function() {

                                                    return m.route.set('/confirmPin');
                                                }
                                            }, "Next") : "",
                                        ]
                                    ))
                                ]
                            )
                        ]
                    )
                ])


            ]



        }
    }
}

export default pinCreationSubmodule;