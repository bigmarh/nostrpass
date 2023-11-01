const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');
const functions = require("firebase-functions")

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file'];
const TOKEN_PATH = `${__dirname}/token.json`;
const CREDENTIALS_PATH = `${__dirname}/credentials.json`
let nextPage = null;
let members = [];
let auth = null;
let groupMembers = [];

// Authentication here
fs.readFile(CREDENTIALS_PATH, (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    // Authorize a client with credentials, then call the Google Sheets API.
    authorize(JSON.parse(content), (auth) => auth = auth);
});

/**
* Create an OAuth2 client with the given credentials, and then execute the
* given callback function.
*
* @param {Object} credentials The authorization client credentials.
* @param {function} callback The callback to call with the authorized client.
*/
function authorize(credentials, callback) {
    const { client_secret, client_id, redirect_uris } = credentials.web;
    const oauth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token.
    oauth2Client.credentials = require(TOKEN_PATH)
    if (!oauth2Client.credentials) return getNewToken(oauth2Client, callback);
    auth = oauth2Client;
    callback(oauth2Client);
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oauth2Client.getToken(code, (err, token) => {
            if (err) return console.error('Error retrieving access token', err);
            oauth2Client.credentials = token;
            storeToken(token);
            auth = oauth2Client;
            callback(oauth2Client);
        });
    });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
    fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.warn(`Token not stored to ${TOKEN_PATH}`, err);
        console.log(`Token stored to ${TOKEN_PATH}`);
    });
}

module.exports = function (request, response) {
    const actions = {
        addMember: addMember,
        createCompanySpreadsheet: createCompanySpreadsheet,
        addApplicationToCompanySpreadsheet: addApplicationToCompanySpreadsheet
    }

    // ----------------------------------------------
    // -------------- Client endpoints --------------
    // ----------------------------------------------

    async function createCompanySpreadsheet(userEmail, companyData) {
        return new Promise(async (resolve, reject) => {
            var sheets = google.sheets('v4');
            sheets.spreadsheets.create({
                auth: auth,
                resource: {
                    properties: {
                        title: `${companyData.name} Applications`
                    }
                }
            }, async function (err, spreadsheet) {
                if (err) {
                    console.log('The API returned an error: ' + err);
                    return;
                }

                // Add beginning data to the sheet and share with them via Google Drive
                // const drive = google.drive('v3');
                // const res = await drive.permissions.create({
                //     emailMessage: 'Your company applications spreadsheet',
                //     fileId: spreadsheet.data.spreadsheetId,
                //     requestBody: {
                //         emailAddress: userEmail
                //     }
                // });

                sheets.spreadsheets.values.append({
                    auth: auth,
                    spreadsheetId: spreadsheet.data.spreadsheetId,
                    range: 'Sheet1!A1:E',
                    valueInputOption: "USER_ENTERED",
                    resource: {
                        values: [[
                            "Applicant Name",
                            "Position",
                            "Email",
                            "Resume",
                            "Date Applied"
                        ]]
                    }
                }, (err, response) => {
                    if (err) {
                        console.log('The API returned an error: ' + err);
                        return;
                    }

                    const spreadsheetId = spreadsheet.data.spreadsheetId,
                        spreadsheetUrl = spreadsheet.data.spreadsheetUrl

                    return resolve({
                        spreadsheetId,
                        spreadsheetUrl
                    })
                });
            });
        })
    }

    async function addApplicationToCompanySpreadsheet(application) {
        return new Promise(async (resolve, reject) => {
            const currentState = application.currentState
            const subfix = currentState === "test" ? "_test" : "";

            const companyRef = await db.doc(`bbb_jobs${subfix}_company/${application.companyId}`).get()

            // If the company doesn't have a spreadsheet, we'll fetch the user who
            // created the company and make them one
            if (!companyRef.data().spreadsheetId) {
                const users = await db.collection(`bbb_jobs${subfix}_userData`)
                    .where("companyId", "==", application.companyId)
                    .limit(1)
                    .get()

                let user = null
                users.docs.forEach(doc => user = doc)

                const newSpreadsheet = await createCompanySpreadsheet(user.data().email, companyRef.data())

                await db.doc(`bbb_jobs${subfix}_company/${application.companyId}`).update({
                    spreadsheetId: newSpreadsheet.spreadsheetId,
                    spreadsheetUrl: newSpreadsheet.spreadsheetUrl
                })
            }

            var sheets = google.sheets('v4');
            sheets.spreadsheets.values.append({
                auth: auth,
                spreadsheetId: companyRef.data().spreadsheetId,
                range: 'Sheet1!A1:E',
                valueInputOption: "USER_ENTERED",
                resource: {
                    values: [[
                        application.jobData.name,
                        application.jobData.position,
                        application.jobData.email,
                        application.jobData.resume,
                        new Date().toLocaleDateString()
                    ]]
                }
            }, (err, response) => {
                if (err) {
                    console.log('The API returned an error: ' + err);
                    return;
                }
            });
        })
    }

    function addMember(email) {
        return new Promise((resolve, reject) => {
            function cleared() {
                email = email || request.body.memberKey;
                groupKey = request && request.body.groupKey;

                if (!email) return console.log("Can't add memeber without an email");
                let memberResource = {
                    "kind": "admin#directory#member",
                    "email": email,
                    "role": "MEMBER",
                    "delivery_settings": "ALL_MAIL"
                }

                let query = {
                    groupKey: groupKey || "00haapch0iblmp0",
                    requestBody: memberResource
                }

                const service = google.admin({ version: 'directory_v1', auth });
                return service.members.insert(query).then(resolve).catch(reject);

            }
            authorize(result, cleared);

        });
    }

    return actions;
}



