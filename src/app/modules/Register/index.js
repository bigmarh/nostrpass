import config from '../../../config';
import Auth from "../../services/auth";
import Payload from "../../services/payload";
import User from "../../models/user";
import Wallet from "../../services/wallet";
import loader from "../../services/loaders";

window.Wallet = Wallet;



/*newWorker.onmessage = function(e) {
    welcomeCtrl.mnemonic = e.data;
    m.redraw();
}*/
var welcomeCtrl = {
        mnemonic: '',
        mnemonicCopy: '',
        email: '',
        password: '',
        confirmPassword: '',
        errorMessage: '',
        successMessage: '',
        showEmailAndPassword: false,
        showLoader: false,
        signUpDataValidated: function() {
            return welcomeCtrl.email.length > 0 &&
                welcomeCtrl.password.length > 0 &&
                welcomeCtrl.confirmPassword.length > 0 &&
                welcomeCtrl.confirmPassword === welcomeCtrl.password
        },
        /**
         * Checks to make sure all fields required on sign up are complete
         * @return {Boolean} True/False if the fields have been filled in
         */
        signUpFormComplete: function() {
            try {
                var inputName = document.getElementById('inputName').value
                var inputEmail = document.getElementById('inputEmail').value
                var inputPassword = document.getElementById('inputPassword').value
                var inputConfirmPassword = document.getElementById('inputConfirmPassword').value

                return inputEmail.length > 0 &&
                    inputPassword.length > 0 &&
                    inputName.length > 0 &&
                    inputConfirmPassword === inputPassword;
            } catch (e) {
                return false;
            }
        },
        /**
         * Sets error message when user is signing up or logging into the application
         * @param {String} errorCode The error code given from FB/Google/Email Authenticator
         */
        setErrorMessage: function(error) {
            switch (error.code) {
                case 'auth/invalid-email':
                    welcomeCtrl.errorMessage = "The email address you entered is not valid.";
                    break;
                case 'auth/user-disabled':
                    welcomeCtrl.errorMessage = "Your account has been disabled. Please contact support.";
                    break;
                case 'auth/user-not-found':
                    welcomeCtrl.errorMessage = "We could not find an account matching the email address you entered. Please check your email address and try again.";
                    break;
                case 'auth/wrong-password':
                    welcomeCtrl.errorMessage = "The password you entered was incorrect. Please check your username and password and try again.";
                    break;
                case 'auth/email-already-in-use':
                    welcomeCtrl.errorMessage = "An account with that email address already exists.";
                    break;
                case 'auth/invalid-email':
                    welcomeCtrl.errorMessage = "The email address you entered is not valid.";
                    break;
                case 'auth/weak-password':
                    welcomeCtrl.errorMessage = "Your password is not strong enough. Please enter at least 6 characters.";
                    break;
                case 'auth/account-exists-with-different-credential':
                    welcomeCtrl.errorMessage = 'An account already exists with email address "' + error.email + '". Please sign in with that email and add this account in the settings page.'
                    break;
                default:
                    welcomeCtrl.errorMessage = "There was an error signing you in. Please try again.";
                    break;
            }
            welcomeCtrl.showLoader = false
            m.redraw();
        },
        /**
         * Checks to see if the user that has signed up via FB or Google has a wallet
         * @param  {Object/Void} wallet The wallet pulled from the DB
         * @return {Void}               This function does not return anything
         */
        checkIfUserHasWallets: function(wallet) {
            if (wallet) {
                Auth.checkAuthState().then(function(data) {
                    if (!User.balanceFilter) User.addBalanceCheck();
                    return m.route.set('/visa');
                })
            } else {
                return m.route.set('/createUsername')
            }
        },
        resetPassword: function(email) {
            welcomeCtrl.showLoader = true;
            welcomeCtrl.errorMessage = '';
            welcomeCtrl.successMessage = '';

            firebase.auth().sendPasswordResetEmail(email).then(function(result) {
                welcomeCtrl.showLoader = false;
                alert('An email has been sent to ' + email + ' for you to reset your password.');
                m.route.set('/login');
                m.redraw();
            }).catch(function(error) {
                welcomeCtrl.showLoader = false;
                welcomeCtrl.setErrorMessage(error.code)
            });
        },
        resetMessages: function() {
            welcomeCtrl.errorMessage = '';
            welcomeCtrl.successMessage = '';
            welcomeCtrl.showLoader = false;
        },
        createWallets: function() {
            return new Promise(function(resolve, reject){

                let encryptedKey = Wallet.encrypt(welcomeCtrl.mnemonic, Auth.pin).toString(); 
                User.updateUserData({
                    mainWallet:true,
                    wallets: { main: encryptedKey },
                    settings: {}
                }).then(function(result) {
                    Auth.pin = '';
                    return resolve(result);
                }).catch(e => {
                    console.log(e);
                    reject(e);
                });

            });
    },
    /**
     * Verification function that enables/disables button during username creation
     * @return {Boolean} True/False whether to show the button or not
     */
    allowUserToCreateUsername: function() {
        return !welcomeCtrl.showLoader && welcomeCtrl.coinId && welcomeCtrl.coinId.length > 0 && welcomeCtrl.usernameAvailable
    },
    checkIfUsernameIsAvailable: function() {
        User.checkIfUsernameIsAvailable(welcomeCtrl.coinId).then(function(response) {
            if (!response.available) return welcomeCtrl.errorMessage = 'Username unavailable';
            welcomeCtrl.usernameAvailable = response.available
        })
    }
}

//Load submodules

import welcome from './submodules/welcome'
import login from './submodules/login'
import mnemonic from './submodules/mnemonic'
import username from './submodules/username'
import pinCreation from './submodules/pinCreation'
import pinConfirm from './submodules/confirmPin'
import forgotPassword from './submodules/forgotPassword'
import privacyPolicy from './submodules/privacy'
import termsOfService from './submodules/tos'
import sanityCheck from './submodules/sanityCheck'

var loginAndRegistrationModule = {
    welcome: welcome(welcomeCtrl),
    login: login(welcomeCtrl),
    mnemonic: mnemonic(welcomeCtrl),
    usernameCreation: username(welcomeCtrl),
    pinCreation: pinCreation(welcomeCtrl),
    pinConfirm: pinConfirm(welcomeCtrl),
    forgotPassword: forgotPassword(welcomeCtrl),
    privacyPolicy: privacyPolicy(welcomeCtrl),
    termsOfService: termsOfService(welcomeCtrl),
    sanityCheck: sanityCheck(welcomeCtrl)
}

export default loginAndRegistrationModule;