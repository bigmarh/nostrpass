// Tester file for creating the asset and putting it on the LTC blockchain
// Will be multisig for security purposes since it's the funding address

const CryptoJS = require('crypto-js')
const config = require('./config')
// const Litecore = require('litecore-lib')
console.log(`@TODO: Remove this and load LTC instead...`)
const Bitcore = require('bitcoinjs-lib')
const WalletHelper = require('./subapis/blockcypher')
const axios = require('axios')

const signerOne = config.ltcSignerOne
signerTwo = config.ltcSignerTwo

go()

async function go() {
    // 1. Generate new asset wallet
    let newAssetWallet = await WalletHelper.generateAssetAccount()
    console.log(newAssetWallet)
    // 2. Fund the wallet with a small amount of LTC so that we can create the asset
    const funded = await fundNewWallet(newAssetWallet.original_address)


    db.collection("unused_assets_test").add(newAssetWallet)
    .then(function(saved) {
        db.doc(`unused_assets_test/${saved.id}`).update({
            id: id
        }).then(resp => console.log("DONE"))
    })


    // 3. Issue the asset with the OAP address via Blockcypher
    // console.log("@TODO: Pull this pending issuance from database, OR pass it in")
    // let pendingIssuance = {
    //     amount: 100000,
    //     metadata: {
    //         name: "Tour",
    //         creator: "Retti",
    //         amountInSats: 1000000
    //     }
    // }

    // const issueResponse = await issueAsset(pendingIssuance, newAssetWallet)
    // console.log(issueResponse)

    // console.log(`\n\n`)
    // console.log(`******* Final Data *******`)
    // const txUrl = "https://api.blockcypher.com/v1/bcy/test/txs/" + issueResponse.data.hash
    // let newAssetDataToSave = {
    //     url: txUrl,
    //     assetId: issueResponse.data.assetid,
    //     assetName: pendingIssuance.metadata.name,
    //     amountInSats: pendingIssuance.metadata.amountInSats,
    //     creator: pendingIssuance.metadata.creator,
    //     numberOfTickets: pendingIssuance.amount,
    //     wallet: newAssetWallet
    // }
    // console.log(newAssetDataToSave)
}

/**
 * Funds a new wallet for issuance for assets
 *
 * @param   {String}  addr  The new asset original address
 *
 * @return  {Object}        The signed and sent transaction response via Blockcypher
 */
async function fundNewWallet(addr) {
    return new Promise(async (resolve, reject) => {
        const INIT_AMOUNT = 10000 // sats
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
        const keys = Bitcore.ECPair.fromPrivateKey(keyBuffer)

        tmptx.pubkeys = [];
        tmptx.signatures = tmptx.tosign.map((tosign, n) => {
            tmptx.pubkeys.push(keys.publicKey.toString('hex'));
            return Bitcore.script.signature.encode(
                keys.sign(Buffer.from(tosign, "hex")),
                0x01,
            ).toString("hex").slice(0, -2);
        });

        console.log(`@TODO: Change this link to live litecoin`)
        // sending back the transaction with all the signatures to broadcast
        const fundedTxResp = await axios.post('https://api.blockcypher.com/v1/bcy/test/txs/send', JSON.stringify(tmptx))
        return resolve(fundedTxResp.data)
    })
}

function transferAsset(toWallet, fromWallet, assetId) {
    return new Promise(async (resolve, reject) => {
        const URL = "https://api.blockcypher.com/v1/bcy/test/oap/" + assetId + "/transfer?token=" + config.blockcypherToken
        const transferResp = await axios.post(URL, {
            "from_private": fromWallet.private,
            "to_address": toWallet.oap_address,
            "amount": 200
        })

        return resolve(transferResp.data)
    })
}

function issueAsset(pendingIssuanceData, newAssetWallet) {
    return new Promise(async (resolve, reject) => {
        console.log("@TODO: Change this url")
        const URL = "https://api.blockcypher.com/v1/bcy/test/oap/issue?token=" + config.blockcypherToken
        const issueData = {
            "from_private": newAssetWallet.private,
            "to_address": newAssetWallet.oap_address,
            "amount": pendingIssuanceData.amount
        }

        console.log(`ISSUE DATA`, issueData)

        const issueResp = await axios.post(URL, issueData).catch(e => {
            console.log(`error issuing asset`)
            console.log(e.response.data.error)
            return reject(e)
        })


        return resolve(issueResp)
    })
}

function metadataToHex(metadata) {
    const str = JSON.stringify(metadata)
    const encoded = Buffer(str).toString('hex');
    return encoded
}

function hexToMetadata(hex) {
    const decoded = Buffer(hex, 'hex').toString();
    return JSON.parse(decode)
}