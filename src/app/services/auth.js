import User from '../models/user';
import Wallet from './wallet';
import Modal from './modal';
import config from "../../config";
import Denominations from "../services/denominations"
var appState = "production";



var Auth = {
    loggedInRoute: '/balances',
    loggedOutRoute: '/',
    openPin: function(successfulPin, cancelPin) {
        Modal.launch(Wallet.getPin, {
            setPin: Auth.setPin,
            pin: Auth.pin,
            submitPin: Auth.setDetails,
            cancelPin: (typeof cancelPin === "function") ? cancelPin : function() { console.log("Pin entry canceled") }

        });

        document.getElementById('pin').focus();

        console.log(successfulPin);

        Auth.onSuccessfulPin = successfulPin;
    },
    resetPin: function() {
        Modal.launch(Wallet.resetPin, {
            submitMnemonic: Auth.validateMnemonic,
            mnemonic: Auth.resetMnemonicValue,
            setResetMnemonic: Auth.setResetMnemonic
        });

        document.getElementById('resetMnemonicInput').focus();
    },
    setInitialPin: function(pin) {
        Auth.initialPin = pin;
    },
    setConfirmPin: function(pin) {
        Auth.confirmPin = pin;
    },
    setPin: function(pin) {
        Auth.pin = pin;
    },
    setDetails: function() {
        try {

            var decrypted = Wallet.decrypt(User.walletDetails(), Auth.pin);
            if (!decrypted) {
                document.getElementById('pin').value = ""
                throw "Incorrect PIN!";
            }
            User.privateKey = decrypted;

            Auth.setPin("");
            Modal.hide();
            if (Auth.onSuccessfulPin) {
                M.toast({
                    html: "Wallet unlocked!",
                    displayLength: 3000
                });

                Auth.onSuccessfulPin();
            }

            m.redraw();
        } catch (e) {
            console.log(e.stack)
            document.getElementById('pin').value = ""
            alert("Incorrect PIN!")
        }
    },
    checkAuthState: function() {
        var loggedInObj = {
            loggedIn: true
        }

        return new Promise(function(resolve, reject) {
            if (User.current.user()) {

                return User.getUserData().then(function(data) {
                    if (!data.user)
                        resolve(loggedInObj);

                    if (data.balance) {
                        User.garveyBalance = data.balance.balance;
                        User.cjBalance = (data.balance.balance) / 1e6
                        User.selectedCurrency = 'GV'
                    }

                    if (data.transactions) {
                        User.transactions = data.transactions
                    }



                    if (data.user && data.user.settings) {
                        User.currentDenomination = Denominations.Garveys[data.user.settings.preferredDenomination['Garveys']]
                    } else {
                        User.currentDenomination = Denominations.Garveys['gv']
                    }

                    return User.setUserData(data.user)
                }).then(function(data) {
                    var loggedInObj = {
                        loggedIn: true
                    }
                    resolve(loggedInObj)
                });
            } else {
                loggedInObj.loggedIn = false;
                // No user is signed in.
                resolve(loggedInObj)
            }

        })
    },
    verifyLink: function() {
        // Confirm the link is a sign-in with email link.
        if (firebase.auth().isSignInWithEmailLink(window.location.href)) {
            // Additional state parameters can also be passed via URL.
            // This can be used to continue the user's intended action before triggering
            // the sign-in operation.
            // Get the email if available. This should be available if the user completes
            // the flow on the same device where they started it.
            var email = window.localStorage.getItem('emailForSignIn');
            if (!email) {

                // User opened the link on a different device. To prevent session fixation
                // attacks, ask the user to provide the associated email again. For example:
                email = window.prompt('Please provide your email for confirmation');
            }
            // The client SDK will parse the code from the link for you.
            firebase.auth().signInWithEmailLink(email, window.location.href)
                .then(function(result) {
                    // Clear email from storage.
                    let user = result.user
                    if (user.displayName) {
                        if (user.photoURL) return m.route.set("/dash");
                        return m.route.set("/mnemonic");
                    }
                    m.route.set("/createUsername");
                    window.localStorage.removeItem('emailForSignIn');
                    // You can access the new user via result.user
                    // Additional user info profile not available via:
                    // result.additionalUserInfo.profile == null
                    // You can check if the user is new or existing:
                    // result.additionalUserInfo.isNewUser
                })
                .catch(function(error) {
                    // Some error occurred, you can inspect the code: error.code
                    // Common errors could be invalid email and invalid or expired OTPs.
                    console.log(error)
                });
        }
    },
    /**
     * Logs a user in via a third-party provider (Facebook, Google, etc.)
     * @param  {Firebase AuthProvider} provider The AuthProvider object
     * @return {Object}                         The user's wallet
     */
    login: function(provider) {
        return new Promise(function(resolve, reject) {
            firebase.auth().signInWithPopup(provider).then(function(result) {
                //fetch user to make sure they have wallet
                User.getUserData().then(function(data) {
                    if (!data.user) {
                        return resolve(null)
                    } else {
                        User.setUserData(data.user);
                        return resolve(data.user && data.user.wallets);
                    }

                });
            }).catch(function(error) {
                return reject(error)
            });
        })
    },
    getIGCode: function() {
        window.location.href = IG.get_authorization_url(IG_REQUEST_URI, {
            scope: ['basic']
        }), 'name';
    },
    logInWithInstagram: function() {
        return new Promise(function(resolve, reject) {
            IG.authorize_user(localStorage.igCode, IG_REQUEST_URI, function(err, user) {
                if (!user || err) {
                    localStorage.igCode = '';
                } else {
                    localStorage.igCodeUsed = true;
                    m.request({
                        method: "POST",
                        url: config.apiUrl[appState] + "/createInstagramFirebaseToken",
                        data: {
                            instagramUserID: 'instagram:' + user.user.id
                        }
                    }).then(function(data) {
                        firebase.auth().signInWithCustomToken(data.firebaseToken).then(function(signInResponse) {
                            User.getUserData().then(function(data) {
                                User.setUserData(data);
                                resolve(data.wallets);
                            });
                        })
                    }).catch(function(error) {
                        console.log("error in createInstagramFirebaseTokenAndSignUserIn:", error);
                    })
                }
            });
        });
    },
    /**
     * Logs a user into the application via their email and password
     * @param  {String} email           The user's email address
     * @param  {Stirng} password        The user's password
     * @return {Object} data            The user's data from Firebase
     */
    loginWithEmailAndPassword: function(email, password) {
        return new Promise(function(resolve, reject) {
            firebase.auth().signInWithEmailAndPassword(email, password).then(function(result) {
                    if (result.error) return resolve(result);
                    User.getUserData().then(function(data) {
                        return resolve(data);
                    });
                })
                .catch(function(error) {
                    resolve({
                        error: error.code
                    });
                });
        })
    },
    /**
     * Signs the user up via their email and password, and adds the name that they
     * gave us to their user object in Firebase
     * @param  {Object} data    Data object containing the user's name, email, and password
     * @return {Object}         The Firebase user object
     */
    signUpWithEmailAndPassword: function(data) {
        return new Promise(function(resolve, reject) {
            firebase.auth().createUserWithEmailAndPassword(data.email, data.password).then(function(user) {
                    firebase.auth().currentUser.updateProfile({
                        displayName: data.fullName
                    }).then(function() {
                        resolve(user);
                    }).catch(function(error) {
                        console.log("error updating new user:", error);
                    });
                })
                .catch(function(error) {
                    resolve({
                        error: error.code
                    })
                })
        })
    },
    logout: function() {
        firebase.auth().signOut().then(function() {
            sessionStorage.clear();
            localStorage.clear();
            delete User._data;
            // Sign-out successful.
           window.location = "/";
        }).catch(function(error) {
            // An error happened.
        });
    }
}

export default Auth;