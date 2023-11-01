const config = require('../config')
const axios = require('axios')
const StellarSdk = require('stellar-sdk');
const StellarHDWallet = require('stellar-hd-wallet');
const server = new StellarSdk.Server("https://horizon-testnet.stellar.org");

module.exports = {
    generateAccount: () => {
        return new Promise(async(resolve, reject) => {
            const mnemonic = StellarHDWallet.generateMnemonic()
            const wallet = StellarHDWallet.fromMnemonic(mnemonic)
            const publicKey = wallet.getPublicKey(0)
            const secret = wallet.getSecret(0)
    
            await axios.get(`https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`)
    
            return resolve({
                mnemonic,
                publicKey,
                secret
            })
        })
    },
    createAsset: async (req) => {
        return new Promise(async (resolve, reject) => {
            console.log(`creating new ticket(s)...`)
            const currentState = req.currentState;
            var subfix = currentState === "test" ? "_test" : "";

            const id = req.body.id,
                event = req.body.event

            // const user = await db.doc(`userData${subfix}/${id}`).get()
            // const secret = user.data().wallet.secret
            const artistSecret = "SCQG5LFVH4NKDP47RGA4SJZNRN4TOASZ6M6A5LJTAGSSUU5RJLAMWDS2"
            await mintTickets(event, artist)

            console.log(`asset created and trustline set up to artist...`)

            // Send the event to the artist before we list it for sale 
            // on the Stellar DEX
            const ticketsSent = await sendTicketsToArtist(artistSecret, event)

            console.log(`created and sent to artist. Now deploying sell order...`)
            console.log("view on explorer here")
            console.log(ticketsSent._links.transaction.href)

            // const newDoc = await db.collection(`tickets${subfix}`).add({
            //     creator: id,
            //     issuingAddress: user.data().wallet.publicKey,
            //     ticketName: event.name,
            //     count: event.ticketCount,
            //     assetCode: assetCode,
            //     link: `https://stellar.expert/explorer/testnet/asset/${assetCode}-${user.data().wallet.publicKey}`
            // })

            // await db.doc(`tickets${subfix}/${newDoc.id}`).update({
            //     id: newDoc.id
            // })

            // Now that the asset is in the artist's wallet and in the
            // database, create a new sell order for users to be able to
            // buy the ticket at market price

            const sellOrder = await sellTicketsOnMarketplace(event, artistSecret)
            console.log(`tickets now on marketplacce`)
            console.log(sellOrder)
            return resolve(sellOrder)
        })
    },
    buyTicket: async (req) => {
        return new Promise(async (resolve, reject) => {
            const currentState = request.currentState;
            var subfix = currentState === "test" ? "_test" : "";
            const purchaseData = req.body

            // @TODO: Uncomment this when using database

            const userSecret = "SBKSWAT4YE4SZQ7LYA4IT5ZGXYE65EZIOTDTR7NG5X4T3YI45JYRIMMU"
            const userKeys = StellarSdk.Keypair.fromSecret(userSecret);
            const user = await server.loadAccount(userKeys.publicKey())
            const assetCode = event.name.split(" ").join("")
            const newEventAsset = new StellarSdk.Asset(assetCode, issuingKeys.publicKey());

            var transaction = new StellarSdk.TransactionBuilder(artist, {
                fee: 100,
                networkPassphrase: StellarSdk.Networks.TESTNET,
            }).addOperation(
                StellarSdk.Operation.manageSellOffer({
                    selling: newEventAsset,
                    buying: StellarSdk.Asset.native(),
                    amount: String(event.ticketCount),
                    price: String(event.price)
                })
            ).setTimeout(100).build();
            transaction.sign(artistKeys);
            const marketOrder = await server.submitTransaction(transaction).catch(e => {
                console.log(`error issuing asset`)
                console.log(e.response.data.extras)
            });

            return resolve(marketOrder)





            // return
            // const ticket = await db.doc(`tickets${subfix}/${purchaseData.asset}`).get()
            // const userSecret = purchaseData.secret
            // const assetCode = ticket.data().assetCode
            // console.log(ticket.data())
            // return
            // const sourceKeys = StellarSdk.Keypair.fromSecret(userSecret);
            // const sourceAccount = await server.loadAccount(sourceKeys.publicKey());

            // const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
            //     fee: StellarSdk.BASE_FEE,
            //     networkPassphrase: StellarSdk.Networks.TESTNET,
            // }).addOperation(
            //     StellarSdk.Operation.payment({
            //         destination: destinationId,
            //         // Because Stellar allows transaction in many currencies, you must
            //         // specify the asset type. The special "native" asset represents Lumens.
            //         asset: StellarSdk.Asset.native(),
            //         amount: "10",
            //     }),
            // )

            //     // Wait a maximum of three minutes for the transaction
            //     .setTimeout(180)
            //     .build();
            // // Sign the transaction to prove you are actually the person sending it.
            // transaction.sign(sourceKeys);
            // // And finally, send it off to Stellar!
            // return server.submitTransaction(transaction);



            // var issuingKeys = StellarSdk.Keypair.fromSecret(config.issuingSecret);
            // var artistKeys = StellarSdk.Keypair.fromSecret(secret);
            // var newEvent = new StellarSdk.Asset(event.name.split(" ").join(""), issuingKeys.publicKey());

            // const artist = await server.loadAccount(artistKeys.publicKey())

            // var transaction = new StellarSdk.TransactionBuilder(artist, {
            //     fee: 100,
            //     networkPassphrase: StellarSdk.Networks.TESTNET,
            // }).addOperation(
            //     StellarSdk.Operation.changeTrust({
            //         asset: newEvent,
            //         limit: event.ticketCount,
            //     })
            // ).setTimeout(100).build();
            // transaction.sign(artistKeys);
            // await server.submitTransaction(transaction).catch(e => {
            //     console.log(`error issuing asset`)
            //     console.log(e.response.data.extras)
            // });

            // const issuer = await server.loadAccount(config.issuingPub);
            // // Now send new event to artist
            // var transaction = new StellarSdk.TransactionBuilder(issuer, {
            //     fee: 100,
            //     networkPassphrase: StellarSdk.Networks.TESTNET,
            // }).addOperation(
            //     StellarSdk.Operation.payment({
            //         destination: artistKeys.publicKey(),
            //         asset: newEvent,
            //         amount: event.ticketCount,
            //     }),
            // ).setTimeout(100).build();

            // transaction.sign(issuingKeys);
            // const newEventOnChain = await server.submitTransaction(transaction);
            // return resolve(newEventOnChain)
        })
    }
}

/**
 * Creates and mints a new Asset on the Stellar blockchain
 *
 * @param   {Object}  event         The event data from the artist
 * @param   {String}  artistSecret  The secret key to the artist's wallet
 *
 * @return  {Object}                The confirmed Stellar tx
 */
function mintTickets(event, artistSecret) {
    return new Promise(async (resolve, reject) => {
        const artistKeys = StellarSdk.Keypair.fromSecret(artistSecret);
        const artist = await server.loadAccount(artistKeys.publicKey())
        const issuingKeys = StellarSdk.Keypair.fromSecret(config.issuingSecret);
        const assetCode = event.name.split(" ").join("")
        const newEventAsset = new StellarSdk.Asset(assetCode, issuingKeys.publicKey());

        var transaction = new StellarSdk.TransactionBuilder(artist, {
            fee: 100,
            networkPassphrase: StellarSdk.Networks.TESTNET,
        }).addOperation(
            StellarSdk.Operation.changeTrust({
                asset: newEventAsset,
                limit: String(event.ticketCount),
            })
        ).setTimeout(100).build();
        transaction.sign(artistKeys);
        const confirmedTx = await server.submitTransaction(transaction).catch(e => {
            console.log(`error issuing asset`)
            console.log(e.response.data.extras)
        });

        return resolve(confirmedTx)
    })
}

/**
 * Sends new tickets from the issuing account to the artist, as well as
 * sets up the artist's trustline to the asset 
 *
 * @param   {String}  artistSecret  The artist's secret key
 * @param   {Object}  event         The event data from the artist
 *
 * @return  {Object}                The confirmed Stellar tx
 */
function sendTicketsToArtist(artistSecret, event) {
    return new Promise(async (resolve, reject) => {
        const artistKeys = StellarSdk.Keypair.fromSecret(artistSecret);
        const issuer = await server.loadAccount(config.issuingPub);
        const issuingKeys = StellarSdk.Keypair.fromSecret(config.issuingSecret);
        const assetCode = event.name.split(" ").join("")
        const newEventAsset = new StellarSdk.Asset(assetCode, issuingKeys.publicKey());

        var transaction = new StellarSdk.TransactionBuilder(issuer, {
            fee: 100,
            networkPassphrase: StellarSdk.Networks.TESTNET,
        }).addOperation(
            StellarSdk.Operation.payment({
                destination: artistKeys.publicKey(),
                asset: newEventAsset,
                amount: String(event.ticketCount),
            }),
        ).setTimeout(100).build();

        transaction.sign(issuingKeys);
        const ticketsSentTx = await server.submitTransaction(transaction);
        return resolve(ticketsSentTx)
    })
}

/**
 * Sells all of the new tickets that the artist has minted onto the Stellar DEX
 *
 * @param   {Object}  event         The event data from the artist
 * @param   {String}  artistSecret  The artist's secret key
 *
 * @return  {Object}                The confirmed Stellar tx
 */
function sellTicketsOnMarketplace(event, artistSecret) {
    return new Promise(async (resolve, reject) => {
        const issuingKeys = StellarSdk.Keypair.fromSecret(config.issuingSecret);
        const artistKeys = StellarSdk.Keypair.fromSecret(artistSecret);
        const artist = await server.loadAccount(artistKeys.publicKey())
        const assetCode = event.name.split(" ").join("")
        const newEventAsset = new StellarSdk.Asset(assetCode, issuingKeys.publicKey());

        var transaction = new StellarSdk.TransactionBuilder(artist, {
            fee: 100,
            networkPassphrase: StellarSdk.Networks.TESTNET,
        }).addOperation(
            StellarSdk.Operation.manageSellOffer({
                selling: newEventAsset,
                buying: StellarSdk.Asset.native(),
                amount: String(event.ticketCount),
                price: String(event.price)
            })
        ).setTimeout(100).build();
        transaction.sign(artistKeys);
        const marketOrder = await server.submitTransaction(transaction).catch(e => {
            console.log(`error issuing asset`)
            console.log(e.response.data.extras)
        });

        return resolve(marketOrder)
    })
}