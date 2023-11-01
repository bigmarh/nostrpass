import CryptoJS from "crypto-js";
import Modal from './modal';
import User from '../models/user';
import Auth from './auth';
import config from "../../config";
import TransactionModel from '../models/transactions';

import { CipherSeed } from 'aezeed';


var WalletModule = {
    /**
     * Generates a new mnemonic
     * @return {String} The mnemonic
     */
    generateMnemonic: function() {
        return new Promise(function(resolve, reject) {
            console.time("Key")
            let mn = CipherSeed.random().toMnemonic();
            resolve(mn);
            console.timeEnd("Key");
        })
    },
    /**
     * Generates wallets for a new user - currently it generates an Ethereum and Stellar wallet
     * @param  {String} mnemonic The user's mnemonic
     */
    createWalletKey: function(mnemonic) {
        return new Promise(function(resolve, reject) {
            resolve(new Mnemonic(mnemonic).toHDPrivateKey().toString());
        });
    },
    /**
     * Returns wallet(s) from derived key that has been decrypted
     * @param  {String} derivedKey The derived key
     * @return {Object}            The wallet
     */
    getWallet: function(derivedKey, account) {
        account = account || 0;
        this.stellar = function() {
            var wallet = StellarHDWallet.fromSeed(derivedKey);
            return {
                a: wallet.getPublicKey(account),
                s: wallet.getSecret(account)
            }
        }
    },
    getHDkeyfromExtendedKey: function(xpriv) {
        return HDKey.fromExtendedKey(xpriv);
    },
    createWallet: function(sKey) {
        var pair = StellarSdk.Keypair.random();
        return { s: pair.secret(), a: pair.publicKey() }
    },
    formatMemoType: function(memo_type) {
        return memo_type.split("_")[1].toLowerCase();
    },
    getInvoice: () => {
        console.log("Go get invoice");
        return new Promise(function(resolve, reject) {
            resolve("lnbc34260n1ps3agezpp5xd7ncwq7dqcgpmv6w39pgn4x7zwe4j7lv6vuq24y8d9r3ckpuj6sdz0235x2grswfjhqcted4jkuapqvehhygrpyp3ksctwdejkcgr0wpjku6twvusxzapqf38yy6289e3k7mgcqzpgxqrpxasp59revpcde7dk4y45k9man88ff4vudzgzwz62fu6ec6va3w2az9llq9qy9qsqpzjwkmgp9f6kp6v07tj386t4eer8j4le8ctyku9sdxcmvuhz76l42xhd3supdayzz553rh2dwx2yelplx5q5dmcqr9p0gewwn3lmtjsppc62va")
        })
    },
    _sendTransaction: function(data) {

        var reqObj = {
            method: "POST",
            endpoint: "/sendTransaction",
            data: data
        }
        return User.request(reqObj);

    },
    paymentHandler: function(record) {

    },
    paymentWatcher: function() {

    },
    _account_merge: function(transObj, txOptions, sourceAccount, resolve, reject) {
        return server
            .loadAccount(sourceAccount.publicKey()).then(function(mother) {
                var transaction = new StellarBase.TransactionBuilder(mother, txOptions).addOperation(
                    StellarBase.Operation.accountMerge({
                        destination: transObj.account
                    })).build();

                transaction.sign(sourceAccount);
                return server.submitTransaction(transaction);
            })
            .then(function(results) {
                resolve(results);
            }).catch(function(e) {
                return reject(e);
            })
    },
    sendTransaction: function(transObj) {
        var details = User.privateKey;
        var userSecret = new Wallet.getWallet(details).stellar().s;
        return new Promise(function(resolve, reject) {
            if (!details) return Auth.openPin(WalletModule.sendTransaction.bind(WalletModule, transObj));
            transObj = JSON.parse('' + transObj);
            transObj.amount = User.formatFromGarvey(transObj.amount, User.currentDenomination.abbr);

            var data = {
                from: {
                    account: User.accountAddress(),
                    coinId: User.displayName()
                },
                to: {
                    account: transObj.account,
                    coinId: transObj.to
                },
                memo: transObj.memo,
                amount: transObj.amount
            }

            var txOptions = { fee: 0 };
            if (transObj.memo) {
                const encryptedString = PAYLOAD.encryptMemo(transObj.memo, data.to.account, userSecret);
                txOptions.memo = StellarBase.Memo.hash(encryptedString);
            }

            let sourceAccount = StellarBase.Keypair.fromSecret(userSecret);


            console.log(transObj.amount, User.balance.native, User.balance.native.substr(0, User.balance.native.length - 1), transObj.amount === User.balance.native.substr(0, User.balance.native.length - 1));
            if (transObj.amount === User.balance.native.substr(0, User.balance.native.length - 1))
                return WalletModule._account_merge(transObj, txOptions, sourceAccount, resolve, reject);
            else
                return server
                    .loadAccount(sourceAccount.publicKey())
                    .then(function(account) {
                        var transaction = new StellarBase.TransactionBuilder(account, txOptions)
                            .addOperation(StellarBase.Operation.payment({
                                destination: transObj.account,
                                asset: StellarBase.Asset.native(),
                                amount: transObj.amount
                            }))
                            .build();

                        transaction.sign(sourceAccount); // sign the transaction
                        return server.submitTransaction(transaction);
                    })
                    .catch(function(err) {
                        return server.loadAccount(sourceAccount.publicKey()).then(function(mother) {
                            var transaction = new StellarBase.TransactionBuilder(mother, txOptions).addOperation(
                                StellarBase.Operation.createAccount({
                                    destination: transObj.account,
                                    startingBalance: transObj.amount
                                })).build();

                            transaction.sign(sourceAccount);
                            return server.submitTransaction(transaction);
                        })
                    })
                    .then(function(transactionResult) {
                        resolve(transactionResult);
                    })
                    .catch(function(err) {
                        console.log(err.stack);
                        // Catch errors, most likely with the network or your transaction
                        reject(err);
                    })
        });
    },
    encrypt: function(string, pass) {
        return CryptoJS.AES.encrypt(string, pass);
    },
    decrypt: function(encrypted, pass) {
        return CryptoJS.AES.decrypt(encrypted, pass).toString(CryptoJS.enc.Utf8).replace(/['"]+/g, '');
    },
    getPin: {
        view: function(vnode) {
            return [
                m(".card-body", [
                    m("p.mb-2", "Enter pin to unlock your wallet"),
                    m("p.mb-2.text-whiteText", [
                        m("input.form-control[name=''][placeholder='Enter PIN'][id='pin'][type='password']", {
                            autofocus: true,
                            type: "password",
                            oncreate: function(vnode) {
                                return vnode.dom.focus();
                            },
                            onkeydown: function(e) {
                                if (e.keyCode == "13") vnode.attrs.submitPin()
                            },
                            oninput: (e) => {
                                vnode.attrs.setPin(e.target.value)
                            },
                            value: vnode.attrs.pin
                        })
                    ])
                ]),
                m(".border-top.border-light.p-2.modal-footer", [

                    m("button.mdc-button[type='button']", {
                        onclick: function() {
                            vnode.attrs.setPin("");
                            document.getElementById('coinIdSearch') && document.getElementById('coinIdSearch').select();
                            vnode.attrs.cancelPin()
                            Modal.hide();
                        }
                    }, "Cancel"),
                    m("button.mdc-button[type='button']", {
                        onclick: vnode.attrs.submitPin
                    }, "Submit")

                ]),
            ]
        }
    },
    setInitialPin: function(initialPin) {
        return {
            view: function(vnode) {
                return m(".modal-dialog", [
                    m(".modal-content", [
                        m(".modal-header", [
                            m("h5.modal-title[id='exampleModalLabel']", ((initialPin) ? "Enter Initial PIN" : "Confirm PIN")),
                            m("button.close[aria-label='Close'][type='button']", {
                                onclick: function() {
                                    vnode.attrs.setPin("");
                                    Modal.hide();
                                }
                            }, [
                                m("span[aria-hidden='true']", m.trust("&times;"))
                            ])
                        ]),
                        m(".modal-body", [
                            m(".form-group", [
                                m("label[for='pin']", ((initialPin) ? "Enter Initial PIN" : "Confirm PIN")),
                                m("input.input-group[autofocus=''][id='pin'][type='password']", {
                                    autofocus: true,
                                    type: "password",
                                    onkeyup: function(e) {
                                        if (e.keyCode == "13") vnode.attrs.submitPin()
                                    },
                                    oninput: m.withAttr('value', vnode.attrs.setPin),
                                    value: vnode.attrs.pin
                                })
                            ])
                        ]),
                        m(".modal-footer", [
                            m(".btn.btn-light", {
                                onclick: function() {
                                    vnode.attrs.setPin("");
                                    Modal.hide();
                                }
                            }, "Cancel"),
                            m(".btn.btn-primary", {
                                onclick: vnode.attrs.submitPin
                            }, "Submit Pin")
                        ])
                    ])
                ])
            }
        }
    }
}


String.prototype.hexEncode = function() {
    var hex, i;

    var result = "";
    for (i = 0; i < this.length; i++) {
        hex = this.charCodeAt(i).toString(16);
        result += ("000" + hex).slice(-4);
    }

    return result
}
String.prototype.hexDecode = function() {
    var j;
    var hexes = this.match(/.{1,4}/g) || [];
    var back = "";
    for (j = 0; j < hexes.length; j++) {
        back += String.fromCharCode(parseInt(hexes[j], 16));
    }

    return back;
}
export default WalletModule;