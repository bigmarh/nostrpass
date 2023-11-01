import Auth from "../../../services/auth";

var registrationSubmodule = function(ctrl) {
    return {
        oninit: function() {
            welcomeCtrl.mnemonic = '';
            welcomeCtrl.mnemonicCopy = '';
            welcomeCtrl.showEmailAndPassword = false;
            welcomeCtrl.email = '';
            welcomeCtrl.password = '';
            welcomeCtrl.confirmPassword = '';
            welcomeCtrl.errorMessage = '';
        },
        view: function() {
            var FacebookAuthProvider = new firebase.auth.FacebookAuthProvider();
            var GoogleProvider = new firebase.auth.GoogleAuthProvider();
            var TwitterAuthProvider = new firebase.auth.TwitterAuthProvider();
            var GithubAuthProvider = new firebase.auth.GithubAuthProvider();
            //var InstagramAuthProvider = new firebase.auth.TwitterAuthProvider();

            return [
                (welcomeCtrl.errorMessage) ? [
                    m(".text-white.bg-danger.text-center.u-padding-20[role='alert']", [
                        m("strong", [
                            m.trust(welcomeCtrl.errorMessage)
                        ])
                    ])
                ] : [],
                m(".container.text-center", [
                    m(".row", [
                        m(".col-sm-12", [
                            m(".u-padding-top40", [
                                m("h3", "Register with One Love LCA")
                            ]),
                            m(".form-signin", [
                                m("span.btn.btn-light.btn-block", {
                                    onclick: function() {
                                        Auth.login(FacebookAuthProvider).then(welcomeCtrl.checkIfUserHasWallets);
                                    }
                                }, "Create account with Facebook"),
                                m("span.btn.btn-light.btn-block", {
                                    onclick: function() {
                                        Auth.login(GoogleProvider).then(welcomeCtrl.checkIfUserHasWallets);
                                    }
                                }, "Create account with Google"),
                                m("strong", "or"),
                                m("form", [
                                    m("input.form-control[id='inputName'][name='inputName'][required=''][placeholder='First and Last Name'][type='text']"),
                                    m("input.form-control[autofocus=''][id='inputEmail'][placeholder='Email address'][required=''][type='email']"),
                                    m("input.form-control[id='inputPassword'][placeholder='Password'][required=''][type='password'][minlength='6']"),
                                    m("input.form-control[id='inputConfirmPassword'][placeholder='Confirm Password'][required=''][type='password'][minlength='6']"),
                                    m(".checkbox.mb-3", [
                                        m("input[type='checkbox'][value='remember-me']"),
                                        " Remember me"
                                    ]),
                                    m("button.btn.btn-lg.btn-primary.btn-block[type='submit']" + ((!welcomeCtrl.signUpFormComplete()) ? '.disabled' : ''), {
                                        onclick: function(e) {
                                            e.preventDefault();
                                            if (welcomeCtrl.signUpFormComplete()) {
                                                var email = document.getElementById('inputEmail').value;
                                                var password = document.getElementById('inputPassword').value;
                                                var fullName = document.getElementById('inputName').value;

                                                Auth.signUpWithEmailAndPassword({
                                                    email: email,
                                                    password: password,
                                                    fullName: fullName
                                                }).then(function(result) {
                                                    if (result.error) return welcomeCtrl.setErrorMessage(result.error);
                                                    Wallet.generateMnemonic().then(function(mnemonic) {
                                                        console.log("here it is:", mnemonic);
                                                        welcomeCtrl.mnemonic = mnemonic;
                                                        m.route.set('/mnemonic')
                                                    });
                                                });
                                            }
                                        }
                                    }, "Sign Up"),
                                    m("p.mt-5.mb-3.text-muted", [
                                        m.trust("&copy;"),
                                        " 2017-2018"
                                    ])
                                ]),
                                m("p.u-padding-top40", [
                                    "Already a member?",
                                    m("a[href='javascript:;']", {
                                        onclick: function() {
                                            m.route.set('/login');
                                        }
                                    }, " Sign in")
                                ])
                            ])
                        ])
                    ])
                ])
            ]
        }
    }
}

export default registrationSubmodule;