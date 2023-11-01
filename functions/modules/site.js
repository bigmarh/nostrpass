const stripeObj = config.stripeObj;
const url = require('url');
var bcrypt = require('bcrypt');

var EC = require('elliptic').ec;
var ec = new EC('secp256k1');

const { admin } = require('googleapis/build/src/apis/admin');

module.exports = {
    dashLogin: (request, response) => {
        const currentState = request.currentState;
        var subfix = currentState === "test" ? "_test" : "";

        return db.collection('userData' + subfix)
            .where('email', '==', request.body.email)
            .get()
            .then(snapshot => {
                var users = [];
                snapshot.forEach(user => {
                    users.push({ user: user.data(), id: user.id });
                })

                var user = users[0] || null;

                if (!user) {
                    return response.status(403).send({
                        error: 'The password/username combination is wrong'
                    })
                }
                return bcrypt.compare(request.body.password, user.user.encryptedpassword).then(function (res) {
                    if (res) {
                        return admin.auth().createCustomToken(user.id)
                            .then(function (customToken) {
                                delete user.user.encryptedpassword;
                                return done(null, { token: customToken, user: user })
                            })
                            .catch(function (error) {
                                return done("Error creating custom token:", error, null);
                            });
                    } else {
                        return response.status(401).send({
                            error: 'The password/username combination is wrong'
                        })
                    }
                }).catch(err => response.status(400).send(err));
            })

        function done(err, data) {
            if (err) response.status(401).send({ error: err })
            response.send(data);
        }

    },
    getUserData: function (request, response) {
        /*        if (request.decoded.uid != request.params.id) return response.status(403).send({ error: "User doesn't have access to this resource" });
         */
        console.log("Get User Data")
        const siteURL = new url.parse(request.headers.origin).href;
        const currentState = request.currentState;
        var subfix = currentState === "test" ? "_test" : "";
        console.log("Worked", request.decoded.uid, `userData${subfix}`);
        return db.collection(`userData${subfix}`).doc(request.decoded.uid)
            .get()
            .then(doc => {
                let user = doc.data();
                if (!user) return response.send({});
                if (user.encryptedpassword) delete user.encryptedpassword;
                return response.send({ user: doc.data() });
            }).catch(function (e) { console.log(e) })

    },
    startPaidSubscription: async (request, response) => {
        const companyId = request.body.companyId,
            planId = request.body.plan.id,
            card = request.body.card,
            token = request.body.token,
            userId = request.body.userId,
            email = request.body.email

        const currentState = request.currentState;
        const stripe = require("stripe")(stripeObj[currentState].apiKey);
        const subfix = currentState === "test" ? "_test" : "";
        const userRef = await db.doc(`bbb_jobs${subfix}_userData/${userId}`).get()

        // Make customer, then subscribe them to the plan
        const stripeCustomer = await stripe.customers.create({
            source: token,
            email: email,
        });

        stripe.subscriptions.create({
            customer: stripeCustomer.id,
            items: [{
                plan: planId,
                quantity: 1,
            }]
        }, async (err, subscription) => {
            // subscription.id
            await db.doc(`bbb_jobs${subfix}_userData/${userId}`).update({
                subscriptionId: subscription.id,
                cards: [card],
                numberOfJobs: request.body.plan.numberOfJobs,
                unlimited_jobs: request.body.plan.unlimited
            })

            return response.status(200).send({
                success: true
            })
        })
    },
    createCustomer: (request, response) => {
        response.set('Access-Control-Allow-Origin', '*');
        const url = require('url');
        const siteURL = new url.parse(request.headers.origin).href;
        const currentState = request.currentState;
        console.log(`current state: ${currentState}`)
        var subfix = currentState === "test" ? "_test" : "";
        let user = request.body;
        user.charges = [];
        var stripe = require("stripe")(stripeObj[currentState].apiKey);
        (async () => {
            var customer = {};
            if (!request.userExists) { //Create Customer
                console.log("User Doesn't exist")

                customer = await stripe.customers.create({
                    source: user.stripe.tokenId,
                    email: user.email,
                });

                const charge = await stripe.charges.create({
                    amount: user.totalCharge,
                    currency: 'usd',
                    customer: customer.id,
                    statement_descriptor_suffix: "DistroM"
                });

                delete user.totalCharge;

                console.log("Get Customer", customer.id);
                user.stripe.customerId = customer.id;
                let newRef = db.collection('userData' + subfix).doc(user.uid);
                user.membership = {
                    active: true,
                    dateActivated: new Date().getTime(),
                    expires: user.trialMembership ? 1575090000000 : new Date().getTime() + 31536000000,
                }

                user.membershipId = generatePassword(6, false, /[\d]|[a-z]/);

                user.membership.readbleExpiration = new Date(user.membership.expires);
                user.order = { chargeId: charge.id, cartitems: user.order }
                user.charges.push(user.order);
                delete user.order;
                console.log("First charge", charge.id, "phone", user.phoneNumber);

                return newRef.set(user).then(function () {
                    return response.send({ success: customer.id, message: message });
                    /*return plivo.sendSms(user.phoneNumber, `Welcome to the Sunjoined Distro team!  Your Member # is "${user.membershipId}".\n \nPlease fill out this REQUIRED application. https://forms.gle/MB1Cd8D2YatiYaZYA.  Thank you!`)
                        .then((message) => {
                            console.log(message);
                            return response.send({ success: customer.id, message: message });
                        })
                        .catch((err) => { return response.send({ err: err }) })*/

                }).catch((err) => {
                    console.log(err);
                    return response.send({ err: err })
                })



            } else {
                customer.id = request.userExists.stripe.customerId;
                user.stripe.customerId = customer.id;
                const charge = await stripe.charges.create({
                    amount: user.totalCharge,
                    currency: 'usd',
                    customer: customer.id,
                    statement_descriptor_suffix: "DistroM"
                });


                delete user.totalCharge;

                let newRef = db.collection('userData' + subfix).doc(user.uid);
                user.membership = {
                    active: true,
                    dateActivated: new Date().getTime(),
                    expires: user.trialMembership ? 1575090000000 : new Date().getTime() + 31536000000,

                }

                user.membership.readbleExpiration = new Date(user.membership.expires);
                user.order = { chargeId: charge.id, cartitems: user.order }
                user.charges = admin.firestore.FieldValue.arrayUnion(user.order);
                user.cards = admin.firestore.FieldValue.arrayUnion(user.cards[0]);
                delete user.order;
                console.log("Loaded", user);

                return newRef.update(user).then(function () {
                    return response.send({ success: customer.id });
                }).catch((err) => {
                    return response.send({ err: err })
                })
            }
        })();
    },
    applyToJob: async (request) => {
        return new Promise(async(resolve, reject) => {
            const currentState = request.currentState;
            const subfix = currentState === "test" ? "_test" : "";
            // User ID and path
            const userId = request.body.userId
            const userRefPath = `bbb_jobs${subfix}_userData/${userId}`
            // Job path
            const jobRefPath = `bbb_jobs${subfix}_jobs/${request.body.jobId}`
    
            // Fetch user and check to see if they are uploading a new resume
            const userRef = await db.doc(userRefPath).get()
            let resumeUrl = request.body.resume
    
            if (request.body.newResume) {
                let currentResumes = userRef.data().resumes || []
                currentResumes.push(resumeUrl)
    
                await db.doc(userRefPath).update({
                    resumes: currentResumes
                })
            }
    
            // Now apply to the job
            let jobRef = await db.doc(jobRefPath).get()
            let currentApps = jobRef.data().applications || []
            currentApps.push({
                name: request.body.name,
                email: request.body.email,
                dateApplied: new Date().toISOString(),
                resume: resumeUrl
            })
    
            await db.doc(jobRefPath).update({
                applications: currentApps
            })
    
            return resolve({
                companyId: jobRef.data().companyId,
                jobData: {
                    name: request.body.name,
                    position: jobRef.data().title,
                    email: request.body.email,
                    dateApplied: new Date().toISOString(),
                    resume: resumeUrl
                },
                currentState: currentState
            })
        })
    }
}