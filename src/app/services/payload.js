
module.exports = function() {
    var CryptoJS = require('crypto-js');
    var elliptic = require('elliptic');
    var ECDSA = require('elliptic').ec;
    var ecdsa = new ECDSA("ed25519")

    var payload = {
        encrypt: function(string, key) {
            var encryptedString = CryptoJS.AES.encrypt(string, key, {
                iv: this.iv,
                padding: CryptoJS.pad.Pkcs7,
                mode: CryptoJS.mode.CBC
            });
            return encryptedString.toString();
        },

        decrypt: function(string, key) {
            try {
                var decryptedString = CryptoJS.AES.decrypt(string, key, {
                    iv: this.iv,
                    mode: CryptoJS.mode.CBC,
                    padding: CryptoJS.pad.Pkcs7
                }).toString(CryptoJS.enc.Utf8);
            } catch (error) {
                return false;
            }
            return decryptedString;
        },
        encryptMemo: function(string, publicKey, secret) {
            const sharedKey = this.getSharedKey(publicKey, secret)
            const cryptr = new Cryptr(sharedKey);
            string = string.padEnd(16, " ");
            return cryptr.encrypt(string);
        },
        decryptMemo: function(string, publicKey, secret,fromChain) {
            //Base64decode chain value 
            if(fromChain) string = new Buffer.from(string, 'Base64').toString('hex');
            const sharedKey = this.getSharedKey(publicKey, secret)
            const cryptr = new Cryptr(sharedKey);
            return cryptr.decrypt(string).trim();
        },
        toHexString: function(byteArray) {
            return Array.prototype.map.call(byteArray, function(byte) {
                return ('0' + (byte & 0xFF).toString(16)).slice(-2);
            }).join('');
        },
        convertPublicKeyToCurve25519ByteArray: function(publicKey) {
            var key = StellarSdk.Keypair.fromPublicKey(publicKey);
            console.log(key._publicKey)
            return new Uint8Array(ed2curve.convertPublicKey(key._publicKey));
        },
        convertSecretKeyToCurve25519ByteArray: function(secret) {
            var key = StellarSdk.Keypair.fromSecret(secret);
            return new Uint8Array(ed2curve.convertSecretKey(key._secretKey));
        },
        getSharedKey: function(publicKey, secret) {
            var pKey = StellarSdk.Keypair.fromPublicKey(publicKey);
            var sKey = StellarSdk.Keypair.fromSecret(secret);
            var convertedSecret = ed2curve.convertSecretKey(sKey._secretKey);
            var convertedPublicKey = ed2curve.convertPublicKey(pKey._publicKey);
            return naclUtil.encodeBase64(nacl.box.before(convertedPublicKey, convertedSecret));
        },
        boxUp: function(string, publicKey, secret) {
            var pKey = StellarSdk.Keypair.fromPublicKey(publicKey);
            var sKey = StellarSdk.Keypair.fromSecret(secret);
            var nonce = new Uint8Array(nacl.box.nonceLength);
            for (var i = 0; i < nonce.length; i++) nonce[i] = (32 + i) & 0xff;
            var convertedSecret = ed2curve.convertSecretKey(sKey._secretKey);
            var convertedPublicKey = ed2curve.convertPublicKey(pKey._publicKey);
            var anotherMessage = naclUtil.decodeUTF8(string);
            return nacl.box(anotherMessage, nonce, convertedPublicKey, convertedSecret);

        },
        unbox: function(encryptedMessage, publicKey, secret) {
            var pKey = StellarSdk.Keypair.fromPublicKey(publicKey);
            var sKey = StellarSdk.Keypair.fromSecret(secret);
            var nonce = new Uint8Array(nacl.box.nonceLength);
            for (var i = 0; i < nonce.length; i++) nonce[i] = (32 + i) & 0xff;
            var convertedSecret = ed2curve.convertSecretKey(sKey._secretKey);
            var convertedPublicKey = ed2curve.convertPublicKey(pKey._publicKey);
            return naclUtil.encodeUTF8(nacl.box.open(encryptedMessage, nonce, convertedPublicKey, convertedSecret));
        },
        ecies: {
            encrypt: function(message, senderPrivateKey, receiverPublicKey) {
                sPrivateKey = ecdsa.keyFromPrivate(senderPrivateKey);
                rPublicKey = ecdsa.keyFromPublic(receiverPublicKey, 'hex');
                var sh1 = this.deriveSharedKey(sPrivateKey, rPublicKey.getPublic());
                return payload.encrypt(message, sh1.toString(16)).toString('hex');
            },
            decrypt: function(encryptedMessage, receiverPrivateKey, senderPublicKey) {
                rPrivateKey = ecdsa.keyFromPrivate(receiverPrivateKey);
                sPublicKey = ecdsa.keyFromPublic(senderPublicKey, 'hex');
                var sh1 = this.deriveSharedKey(rPrivateKey, sPublicKey.getPublic());
                return payload.decrypt(encryptedMessage, sh1);
            },
            getPublicKey: function(privateKey) {
                return ecdsa.keyFromPrivate(privateKey).getPublic(true, 'hex').toString();
            },
            deriveSharedKey: function(privKey, pubKey) {
                return privKey.derive(pubKey).toString(16);
            }
        }
    }

    window.PAYLOAD = payload;
    window.ecdsa = ecdsa;

    return payload;
}()