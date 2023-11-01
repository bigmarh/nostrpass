const SECRET = 'd28d0b618f1045c4d99b565eb239fcedcdf29b09c9b0c9785530445ffacc010d';
crypto = require('crypto');
module.exports = {
    verifyIdToken: (req, res, next) => {
        const tokenId = req.get('Authorization').split('Bearer ')[1];
        admin.auth().verifyIdToken(tokenId).then((decoded) => {
                req.decoded = decoded;
                return next()
            })
            .catch((err) => res.status(401).send(err));
    },

    checkLocal: (req, res, next) => {
        //if (req.headers.host !== 'localhost:5000') return res.status(403).send("Access forbidden");
        return next();
    },

    checkEmail: (req, res, next) => {
        const currentState = req.currentState;
        console.log(currentState);
        var subfix = currentState === "test" ? "bbb_jobs_test" : "bbb_jobs";
        db.collection(`${subfix}_userData`).where("email", "==", req.body.email)
            .get()
            .then(snapshot => {
                var users = [];
                if (!snapshot.size) {
                    req.userExists = false;
                    return next();
                }
                snapshot.forEach(user => {
                    users.push({ user: user.data(), id: user.id });
                })

                var user = users[0] || null;
                req.userExists = user.user;
                return next();
            })
            .catch((err, resp) => res.status(401).send({ error: err.stack, resp: resp }));
    },



    verifyShopifyWebHook: (req, res, next) => {

        var digest = crypto.createHmac('SHA256', SECRET)
            .update(Buffer.from(req.rawBody))
            .digest('base64');

        if (digest === req.headers['x-shopify-hmac-sha256']) return next();
        return res.status(401).send({ error: "webhook not valid" })

    },
    currentAppState: (req, res, next) => {
        /*       admin.auth().updateUser("KfDnktmuFXaZS2ewMDxdAdRfvK12", {
                       email: 'info@phvibez.com',
                   })
                   .then(function(userRecord) {
                       // See the UserRecord reference doc for the contents of userRecord.
                       console.log('Successfully updated user', userRecord.toJSON());
                     
                   })
                   .catch(function(error) {
                       console.log('Error updating user:', error);
                   });*/
        req.currentState = config.origins.includes(req.headers.origin) ? 'live' : 'test';        
        next();
    }
}