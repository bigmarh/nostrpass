const CryptoJS = require('crypto-js')
const Litecore = require('litecore-lib')
const BitcoinJSLib = require('bitcoinjs-lib')
const config = require('../config')
const axios = require('axios')
const Bip39 = require('bip39')

module.exports = {
    generateNewLtcWallet: () => {
        const mnemonic = Bip39.generateMnemonic()
        let value = Buffer(mnemonic);
        let hash = Litecore.crypto.Hash.sha256(value);
        let bn = Litecore.crypto.BN.fromBuffer(hash);
        const privateKey = new Litecore.PrivateKey(bn)

        return {
            raw: mnemonic,
            mnemonic: CryptoJS.AES.encrypt(mnemonic, config.encryptionKey).toString(),
            address: privateKey.toAddress().toString()
        }
    },
    generateAssetAccount: () => {
        return new Promise(async (resolve, reject) => {
            // const URL = `https://api.blockcypher.com/v1/ltc/main/oap/addrs?token=${config.blockcypherToken}`
            const URL = `https://api.blockcypher.com/v1/bcy/test/oap/addrs?token=${config.blockcypherToken}`
            const newAccount = await axios.post(URL)
            newAccount.data.private = CryptoJS.AES.encrypt(newAccount.data.private, config.encryptionKey).toString()
            return resolve(newAccount.data)
        })
    },
    /**
     * Funds a new wallet for issuance for assets
     *
     * @param   {String}  addr  The new asset original address
     *
     * @return  {Object}        The signed and sent transaction response via Blockcypher
     */
    fundNewWallet: async function (addr) {
        return new Promise(async (resolve, reject) => {
            const INIT_AMOUNT = 100000 // sats
            // LTC
            // var fundingTx = {
            //     inputs: [{ addresses: [config.ltcAddr] }],
            //     outputs: [{ addresses: [addr], value: INIT_AMOUNT }],
            //     includeToSignTx: true
            // };

            // Test wallet
            /*
            {
                "private": "ea9fb5ca7a94d30a3bc04d5a2ee656246dc1a72d2bb29b0abcc9d6e5b4e26c39",
                "public": "02e58b492287a71da78539fe05ae504e5d29442ee5248fe9d67577d92bae6338e8",
                "address": "C7EN1VEe5Hk8EydmQqifpwLEsGKHxRbAZk",
                "wif": "BwC7GeF7URZHfnrU8PGoCTbJRgUx8Zz322BE8dkePAXMVDKbAegg"
            }
            */

            var fundingTx = {
                inputs: [{ addresses: ["C7EN1VEe5Hk8EydmQqifpwLEsGKHxRbAZk"] }],
                outputs: [{ addresses: [addr], value: INIT_AMOUNT }]
            };

            console.log(`@TODO: load real private keys here...`)
            // const keys = BitccoinJSLib.ECPair.fromPrivateKey(keyBuffer)
            // console.log(`keuys`, keys)

            // const URL = `https://api.blockcypher.com/v1/ltc/main/txs/new`
            const URL = `https://api.blockcypher.com/v1/bcy/test/txs/new`
            const unsignedTxData = await axios.post(URL, fundingTx).catch(e => {
                console.log(e.response.data.errors)
            })

            const tmptx = unsignedTxData.data

            const keyBuffer = Buffer.from("ea9fb5ca7a94d30a3bc04d5a2ee656246dc1a72d2bb29b0abcc9d6e5b4e26c39", "hex")
            const keys = BitcoinJSLib.ECPair.fromPrivateKey(keyBuffer)

            tmptx.pubkeys = [];
            tmptx.signatures = tmptx.tosign.map((tosign, n) => {
                tmptx.pubkeys.push(keys.publicKey.toString('hex'));
                return BitcoinJSLib.script.signature.encode(
                    keys.sign(Buffer.from(tosign, "hex")),
                    0x01,
                ).toString("hex").slice(0, -2);
            });

            console.log(`@TODO: Change this link to live litecoin`)
            // sending back the transaction with all the signatures to broadcast
            const fundedTxResp = await axios.post('https://api.blockcypher.com/v1/bcy/test/txs/send', JSON.stringify(tmptx))
            return resolve(fundedTxResp.data)
        })
    },
    issueAsset: (req, res) => {
        return new Promise(async (resolve, reject) => {
            const currentState = req.currentState;
            var subfix = currentState === "test" ? "_test" : "";

            let newAssetWalletDoc = await db.collection("unused_assets" + subfix)
                .limit(1)
                .get()

            let newAssetWallet = newAssetWalletDoc.docs[0].data()

            console.log("@TODO: Change this url")
            const URL = "https://api.blockcypher.com/v1/bcy/test/oap/issue?token=" + config.blockcypherToken
            const issueData = {
                "from_private": CryptoJS.AES.decrypt(newAssetWallet.private, config.encryptionKey).toString(CryptoJS.enc.Utf8),
                "to_address": newAssetWallet.oap_address,
                "amount": req.body.ticketCount || 100
            }

            const issueResp = await axios.post(URL, issueData).catch(e => {
                console.log(`error issuing asset`)
                console.log(e.response.data.error)
                return reject(e)
            })

            db.doc(`unused_assets${subfix}/${newAssetWalletDoc.docs[0].id}`).delete()

            // Save to user
            db.doc(`userData${subfix}/${req.body.id}`).get().then(async function (userResp) {
                let currentTickets = userResp.data().tickets

                const txUrl = "https://api.blockcypher.com/v1/bcy/test/txs/" + issueResp.data.hash
                let newAssetData = {
                    url: txUrl,
                    assetId: issueResp.data.assetid,
                    assetName: req.body.name,
                    amountInSats: req.body.amountInSats,
                    creator: req.body.id,
                    numberOfTickets: req.body.ticketCount,
                    wallet: newAssetWallet
                }

                currentTickets.push(newAssetData)

                await db.doc(`userData${subfix}/${req.body.id}`).update({
                    tickets: currentTickets
                })
                
                return resolve(issueResp.data)
            })
        })
    },
    buyTicket: async (req) => {
        return new Promise(async (resolve, reject) => {

        })
    }
}