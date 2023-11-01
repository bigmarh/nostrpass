const CryptoJS = require('crypto-js')
const config = require('../config')
const SpeakEasy = require('speakeasy')
// const StellarHelper = require('../subapis/stellar')
const WalletHelper = require('../subapis/blockcypher')
const axios = require('axios')
const BigNumber = require('bignumber.js')
const plivo = require('plivo');
const functions = require('firebase-functions');
let client = new plivo.Client(functions.config().plivo.id, functions.config().plivo.token);
let plivoNumber = "16053168554";

module.exports = {
    sendSms: (to, message) => {
        return client.messages.create(plivoNumber, to, message)
    },
    sendMobileInvoice: (payload, req, res) => {

        var invoiceMessage = `Welcome, you've completed the first step. \n\n Note: This pass will be for the House Only!\n\n Now, using Cash App\n\nPay: ${payload.data.amount} satoshis\n\nTo: ${payload.data.payto}\n\nWith memo: ${payload.data.memo}\n\nto finish your registration.\nPlease follow all instructions to ensure success.`;
        var invoiceMessage = "You are registered for the giveaway";
        return module.exports.sendSms(payload.fromNumber, invoiceMessage /*"I am sorry RSVP's are closed. Thank you."*/ )
    },
    // Create account 
    createAccount: async (req, res) => {
        const currentState = req.currentState;
        var subfix = currentState === "test" ? "_test" : "";

        let wallet = await WalletHelper.generateNewLtcWallet()

        const authSecret = SpeakEasy.generateSecret({
            symbols: "PlusPlusPass"
        });
        const tempSecret = authSecret.base32;

        db.doc(`userData${subfix}/${req.body.id}`).update({
            wallet: wallet,
            secret: tempSecret
        })

        return res.status(200).send(wallet)
    },
    createTicket: async (req, res) => {
        const newAsset = await WalletHelper.issueAsset(req).catch(e => {
            return res.status(500).send({
                success: false,
                error: e.response.data.error
            })
        })

        return res.status(200).send(newAsset)
    },
    buyTicket: async (req, res) => {
        const purchase = await WalletHelper.buyTicket(req)
        return res.status(200).send(purchase)
    },
    createInvoice: async (req, res) => {
        const currentState = req.currentState;
        // Sender's phone number
        var from_number = req.body.From || req.query.From;
        // Receiver's phone number - Plivo number
        var to_number = req.body.To || req.query.To;
        var subfix = currentState === "test" ? "_test" : "";

        // const user = await db.doc(`userData${subfix}/${req.body.id}`).get()
        // const depositMemo = SpeakEasy.totp({
        //     secret: user.data().secret,
        //     encoding: 'base32'
        // });
        // 
         const authSecret = SpeakEasy.generateSecret({
            symbols: `PlusPlusPass:${from_number}`
        });
        const tempSecret = authSecret.base32;

        const depositMemo = SpeakEasy.totp({
            secret: tempSecret,
            encoding: "base32"
        })

        const amount = req.body.amount,
            payto = "$toshipay"

        const invoiceRef = await db.collection(`invoices${subfix}`).add({
            memo: depositMemo,
            paid: false,
            amount: amount,
            houseOnly:true,
            cashtag: req.cashtag || null,
            signup: req.signup || null,
            // user: req.body.id,
            payto: payto,
            invoiceId: req.body.invoiceId || from_number
        })


        let payload = {
            toNumber: to_number,
            fromNumber: from_number,
            success: true,
            data: {
                memo: depositMemo,
                amount: amount,
                payto: payto
            }
        }

        return req.mobile ? module.exports.sendMobileInvoice(payload, req, res) : res.status(200).send(payload);
    },
    invoiceWebhook: async (req, res) => {
        res.sendStatus(200)
        //Check to see if it's a cash tag if so 
        if (req.body.Text.charAt(0) == "$") {
            req.mobile = true;
            req.body.amount = 320000;
            req.cashtag = req.body.Text;
            req.signup = true;
            return module.exports.createInvoice(req, res);
        }




        const currentState = req.currentState;
        var subfix = currentState === "test" ? "_test" : "";
        console.log(`here is the text we just got from the webhook!`)
        console.log(req.body.Text)

        // let text = "Lamar Wilson sent you 0.001 BTC (~$121.12) for 261406"
        let text = req.body.Text

        // BTC
        let btcIndex = text.split(" ").indexOf("BTC")
        let isSats = false
        if (btcIndex === -1) {
            btcIndex = text.split(" ").indexOf("sats")
            isSats = true
        }

        let amountInSats = text.split(" ")[btcIndex - 1].replace(',', '');
        console.log(amountInSats, "Before conversion");
        if (!isSats) {
            amountInSats = new BigNumber(amountInSats).times(1e8).toNumber()
        } else {
            amountInSats = parseInt(amountInSats)
        }

        // Memo
        let memo = text.split(" for ")[1]
        if (memo) {
            memo = memo.replace(/\D/g, '')
        }
        console.log(`amount in btc: ${amountInSats}`)
        console.log(`memo: ${memo}`)



        if (!amountInSats || !memo) return;
        console.log(`ready to check`)


        const invoiceRef = await db.collection(`invoices${subfix}`)
            .where("memo", "==", String(memo))
            .where("amount", "==", amountInSats)
            .where("paid", "==", false)
            .get();

        console.log(`after check`, invoiceRef.size);
        if (invoiceRef.size) {
            let invoicePaid = invoiceRef.docs[0]
            db.doc(`invoices${subfix}/${invoicePaid.id}`).update({
                paid: true
            })
        }
    }
}