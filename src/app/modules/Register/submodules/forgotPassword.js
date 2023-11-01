var forgotPasswordSubmodule = function(ctrl) {
    return {
        oninit: function() {
            ctrl.resetMessages();
        },
        view: function() {
            return m(".wrapper[id='content']", [
                m(".container", [
                    (ctrl.errorMessage) ? [
                        m(".text-white.bg-danger.text-center.u-padding-20[role='alert']", [
                            m("strong", ctrl.errorMessage)
                        ])
                    ] : [],
                    m(".row", [
                        m(".col-sm-12", [
                            m("h2", "Forgot Password"),
                            m("p", "Enter your email address and we will send you a forgot password email."),
                            m("input[placeholder='Email'][id='forgotPasswordEmail']"),
                            m('br'),
                            m("button.btn.btn-primary" + ((ctrl.showLoader) ? '.disabled' : ''), {
                                onclick: function() {
                                    if (ctrl.showLoader) return;
                                    var email = document.getElementById('forgotPasswordEmail').value;
                                    ctrl.resetPassword(email);
                                }
                            }, "Reset Password"),
                            m("button.btn.btn-primary" + ((ctrl.showLoader) ? '.disabled' : ''), {
                                onclick: function() {
                                    if (ctrl.showLoader) return;
                                    m.route.set('/login')
                                }
                            }, "Back to Login")
                        ])
                    ])
                ])
            ])
        }
    }
}

export default forgotPasswordSubmodule;