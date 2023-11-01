import Auth from "../../../services/auth";
import User from "../../../models/user";
import fullLoader from '../../../services/fullLoader';


var usernameSubmodule = function(ctrl) {
    return {
        oninit: function() {
            ctrl.showLoader = false;
            ctrl.usernameAvailable = false;
            if (User.current.user().displayName) return m.rou

        },
        view: function() {
            return Auth.loading ? m(fullLoader()) : [

                m(".reg-page", [m('h4', 'Create Username'),
                    m(".mdc-card.registration-card",
                        [
                            m(".mdc-card__media.mdc-card__media--square",
                                m(".mdc-card__media-content",
                                    m("h5.mb-5", "Create your username"),
                                    m(".card.bg-gradient.p-3.mb-4", [
                                        m("p", "Select your username."),
                                        m("p", "Your username makes it easier for people within the network to find you."), m('b', "HINT:Choose a name that is easy to type."),
                                        m(".input-group.mb-3", [
                                           
                                            m("input.form-control[aria-describedby='basic-addon2'][aria-label='Username'][placeholder='username'][type='text'][id='username']", {
                                                oninput: function(e) {
                                                    ctrl.errorMessage = '';
                                                    ctrl.usernameAvailable = false;
                                                    ctrl.username = e.target.value;
                                                },
                                                oncreate: function(vnode) {
                                                    vnode.dom.addEventListener("keydown", function(e) {
                                                        if (e.keyCode == 13) {
                                                            e.preventDefault();
                                                            return m.route.set('/mnemonic');
                                                        }
                                                    });
                                                    vnode.dom.focus();
                                                    var typingTimer;
                                                    var doneTypingInterval = 500;
                                                    vnode.dom.addEventListener('keyup', function() {
                                                        clearTimeout(typingTimer);
                                                        typingTimer = setTimeout(ctrl.checkIfUsernameIsAvailable, doneTypingInterval);
                                                    });

                                                    vnode.dom.addEventListener('keydown', function() {
                                                        clearTimeout(typingTimer);
                                                    });

                                                }
                                            }), m('span.at-symbol', "@nostrpass.com")
                                        ]),
                                        ((ctrl.errorMessage) ? m(".alert.alert-danger[role='alert']", ctrl.errorMessage) : '')
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
                                            !ctrl.errorMessage && ctrl.username ? m("button.mdc-button.mdc-card__action.mdc-card__action--button", {
                                                    onclick: function() {
                                                        if (!ctrl.allowUserToCreateUsername()) return;
                                                        ctrl.showLoader = true;
                                                        let username = ctrl.username.toLowerCase().trim()
                                                        firebase.auth().currentUser.updateProfile({ displayName: username }).then(function() {
                                                            User.updateUserData({
                                                                username: username,
                                                                photoURL: firebase.auth().currentUser.photoURL,
                                                            }).then(function(response) {
                                                                ctrl.showLoader = false;
                                                                if (!response.error) return m.route.set('/mnemonic')
                                                            })
                                                        })

                                                    }
                                                },
                                                "Next"
                                            ) :
                                            ""
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

export default usernameSubmodule;