const functions = require("firebase-functions");

admin = require('firebase-admin');
const express = require("express")
var bodyParser = require('body-parser')
const app = express();

const endpoints = require('./endpoints');

app.use(bodyParser.json({
    verify: (req, res, buf) => {
        req.rawBody = buf
    }
}))

config = require('./config');
const cors = require('cors');
//Allow CORS and use middleware
const mw = require('./middleware')
app.use(cors({ origin: true }))

config.firebase = JSON.parse(process.env.FIREBASE_CONFIG)

var serviceAccount = require("./serviceacct.json")
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: config.firebase.databaseURL
});

db = admin.firestore();

let verifyIdToken = (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    const tokenId = req.get('Authorization').split('Bearer ')[1];
    admin.auth().verifyIdToken(tokenId).then((decoded) => {
        console.log("Verify");
        req.decoded = decoded;
        return next()
    }).catch((err) => res.status(401).send(err));
}


const api = functions.https.onRequest(app)
module.exports = { api}; /*addMemberToMailList, invoiceListener }*/




