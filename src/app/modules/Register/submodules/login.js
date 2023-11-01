import Auth from "../../../services/auth";
import fullLoader from '../../../services/fullLoader'
import User from '../../../models/user'

var loginSubmodule = function(ctrl) {
    return {
        oninit: function() {
             if(Auth.isLoggedIn.user()) return m.route.set('/visa');
            if (window.location.search.indexOf('code') > -1) {
                localStorage.igCode = window.location.search.split('code=')[1];
                localStorage.igCodeUsed = false;
                //reset url
                window.history.pushState({}, {}, "/#/login")
            }

            if (localStorage.igCode && localStorage.igCodeUsed === 'false') {
                ctrl.showLoader = true;
                return Auth.logInWithInstagram().then(ctrl.checkIfUserHasWallets)
            } else {
                delete localStorage.igCode
            }

            //look for registration code
            if (window.location.href.indexOf('referralCode') > -1) {
                localStorage.referralCode = window.location.href.split('referralCode=')[1];
            }

            ctrl.showEmailAndPassword = false;
            ctrl.showLoader = false;
            ctrl.email = '';
            ctrl.password = '';
            ctrl.confirmPassword = '';
            ctrl.errorMessage = '';
        },
        view: function() {
            var FacebookAuthProvider = new firebase.auth.FacebookAuthProvider();
            var GoogleAuthProvider = new firebase.auth.GoogleAuthProvider();
            var TwitterAuthProvider = new firebase.auth.TwitterAuthProvider();
            var GithubAuthProvider = new firebase.auth.GithubAuthProvider();
            
            return [
                m("section.pt-0", [
                    m(".container", [
                        m(".row", [
                            m(".col", [
                                m("h4.mb-5", "Login"),
                                m(".sign-up-buttons", [
                                    m(".btn.btn-facebook.btn-block.btn-lg.mb-3", {
                                        onclick: function() {
                                            ctrl.resetMessages();
                                            ctrl.showLoader = true;
                                            m.redraw();
                                            Auth.login(FacebookAuthProvider)
                                                .then(ctrl.checkIfUserHasWallets)
                                                .catch(function(error) {
                                                    ctrl.setErrorMessage(error)
                                                })
                                        }
                                    }, "Facebook"),
                                    m(".btn.btn-twitter.btn-block.btn-lg.mb-3", {
                                        onclick: function() {
                                            ctrl.resetMessages();
                                            ctrl.showLoader = true;
                                            m.redraw();
                                            Auth.login(TwitterAuthProvider)
                                                .then(ctrl.checkIfUserHasWallets)
                                                .catch(function(error) {
                                                    ctrl.setErrorMessage(error)
                                                })
                                        }
                                    }, "Twitter"),
                                    m(".btn.btn-google.btn-block.btn-lg.mb-3", {
                                        onclick: function() {
                                            ctrl.resetMessages();
                                            ctrl.showLoader = true;
                                            m.redraw();
                                            Auth.login(GoogleAuthProvider)
                                                .then(ctrl.checkIfUserHasWallets)
                                                .catch(function(error) {
                                                    ctrl.setErrorMessage(error)
                                                })
                                        }
                                    }, "Google"),
                                    m(".btn.btn-github.btn-block.btn-lg.mb-3", {
                                        onclick: function() {
                                            ctrl.resetMessages();
                                            ctrl.showLoader = true;
                                            m.redraw();
                                            Auth.login(GithubAuthProvider)
                                                .then(ctrl.checkIfUserHasWallets)
                                                .catch(function(error) {
                                                    ctrl.setErrorMessage(error)
                                                })
                                        }
                                    }, "Github"),
                                    /*m(".btn.btn-instagram.btn-block.btn-lg.mb-3", {
                                        onclick: function() {
                                            ctrl.resetMessages();
                                            ctrl.showLoader = true;
                                            m.redraw();
                                            Auth.getIGCode();
                                        }
                                    }, "Instagram")*/
                                ]),
                                m("span", "By using our products and services, you acknowledge that you've reviewed and agree to our "),
                                m("a[href='javascript:;']", {
                                    onclick: function() {
                                        return m.route.set('/tos')
                                    }
                                }, "Terms of Use"),
                                m("span", " and "),
                                m("a[href='javascript:;']", {
                                    onclick: function() {
                                        return m.route.set('/privacy')
                                    }
                                }, "Privacy Policy"),
                                m("span", "."),
                                ((ctrl.showLoader) ? m(fullLoader()) : ''),
                                ((!ctrl.showLoader && ctrl.errorMessage) ? m(".alert.alert-danger.text-center.mt-3", ctrl.errorMessage) : '')
                            ])
                        ])
                    ])
                ])
            ]
        }
    }
}

export default loginSubmodule