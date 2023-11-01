let refAward = 1000;
var uuid = require("uuid");


var endPoints = {

    checkUsernameAvailabilty: async (request, response) => {
        var snapshot = await db.collection('userData').where('displayName', "==", request.params.username).count().get();
        if (snapshot.data().count > 0)
            return response.status(400).send({ error: "Username Not available", available: false });
        else
            return response.status(200).send({ available: true });

    },
    getUserData: (request, response) => {
        db.collection('userData').doc(request.decoded.uid).get()
            .then((doc) => {
                if (!doc.exists) {

                    var userdataSchema = {
                        when: new Date(),
                    }

                    db.collection('userData').doc(request.decoded.uid).set(userdataSchema);
                    return response.send(userdataSchema);
                }

                return response.send(doc.data());

            })
            .catch((err) => response.status(401).send(err));
    },

    checkBridge: async (req, res) => {
        let doc = await db.collection('apps').doc(req.params.app).get();
        let app = doc.data();
        let snap = await db.collection('userData').where("npub", "==", req.params.npub).get();
        let docs = [];
        await snap.forEach(doc => docs.push(doc.data()));
        console.log(docs);
        if (!docs[0] || !docs[0].apps[req.params.app]) return res.status(200).send({ connected: false, app: app })
        return res.status(200).send({ connected: true, token: docs[0].apps[req.params.app].token })

    },
    getUserByAddress: function(request, response) {
        db.collection('userData')
            .where('wallets.account', '==', request.params.address)
            .get()
            .then(snapshot => {
                var users = [];
                snapshot.forEach(user => {
                    if (user.data().wallets) {
                        users.push({
                            coinId: user.data().coinId,
                            photoURL: user.data().photoURL,
                            account: user.data().wallets.account
                        })
                    }
                })

                var user = users[0] || null;
                if (!user) return response.send({
                    error: 'No user with referralCode ' + request.params.code
                })

                return response.json(user);

            })
    },

    setUserData: (request, response) => {
        finishSet();

        if (request.body.apps) Object.keys(request.body.apps).forEach(key => {
            request.body.apps[key].token = uuid.v4();
        })

        function finishSet() {
            db.collection('userData').doc(request.decoded.uid).set(request.body, {
                    merge: true
                }).then((results) => {
                    return response.send(results);
                })
                .catch((err) => response.status(401).send(err));
        }
    },
    getTransactions: (request, response) => {
        return getTransactions(request.params).then(function(results) {
            return response.send(results);
        }).catch(function(e) { response.status(401).send(e) });
    },
    getUserByCoinId: (request, response) => {
        return getUserByCoinId(response, { to: request.params.name }, response.send);
    }


}

function getUserByCoinId(response, data, cb) {
    db.collection('userData')
        .where('coinId', '==', data.to.toLowerCase().trim())
        .get()
        .then(snapshot => {
            var users = [];
            snapshot.forEach(user => {
                if (user.data().wallets) {
                    users.push({
                        coinId: user.data().coinId,
                        photoURL: user.data().photoURL,
                        account: user.data().wallets.account
                    })
                }
            })

            var user = users[0] || null;
            if (!user) return response.status(401).send('No user with coinID "' + data.to + '"')
            response.send(user)
        })
}

function validateSignature(req, res) {
    return new Promise((resolve, reject) => {
        if (req.body.publicKey && req.body.data) {

            try {
                var data = PayloadHelper.ecies.decrypt(req.body.data, adminConfig.serverPrvKey, req.body.publicKey);
                return resolve(JSON.parse(data));
            } catch (e) {
                console.log("error decrypting:", e);
                return reject(e);
            }
        }
    });
}

function getTransactions(params) {
    return new Promise((resolve, reject) => {
        Promise.all([getFromTransactions(), getToTransactions()]).then(function(data) {
            var txs = data[0].concat(data[1]).sort(function(a, b) { return (a.date < b.date) ? 1 : ((b.date < a.date) ? -1 : 0); })
            return resolve(txs);
        })

        function getFromTransactions() {
            return new Promise((resolve, reject) => {
                var txRef = db.collection('transaction')
                    .where('from.account', '==', params.address);

                if (params.lastTime !== "undefined") txRef = txRef.where("date", ">", params.lastTime);
                txRef.get()
                    .then(function(snapshot) {
                        var txs = [];
                        snapshot.forEach(doc => {
                            txs.push(doc.data());
                        })
                        return resolve(txs);
                    }).catch(function(e) {
                        return reject(e);
                    })
            });
        }

        function getToTransactions() {
            return new Promise((resolve, reject) => {
                var txRef = db.collection('transaction')
                    .where('to.account', '==', params.address);
                if (params.lastTime !== "undefined") txRef = txRef.where("date", ">", params.lastTime)
                txRef.get()
                    .then(function(snapshot) {
                        var txs = [];
                        snapshot.forEach(doc => {
                            txs.push(doc.data());
                        })
                        return resolve(txs);
                    }).catch(function(e) {
                        return reject(e);
                    })
            });
        }
    });
}

module.exports = endPoints;