/*tba.js
The Bitcoin Academy API
*/


const { google } = require('googleapis');
const sheets = google.sheets('v4');
const credentials = require('../credentials.json')
const jwt = new google.auth.JWT(
    credentials.client_email, null, credentials.private_key,
    ['https://www.googleapis.com/auth/spreadsheets']
);

const service = google.sheets({ version: 'v4', auth: jwt });

let tbaModule = {
    register: async (req, res) => {

        const student = req.body;

        /*TODO: Check Address Before adding to spreadsheet: req.body.aptNumber & req.body.address*/
        student.aptNumber = student.aptNumber.trim().split(' ').join('');
        student.address = student.address.split(" ").length > 2 ? student.address.substring(0,student.address.lastIndexOf(" ")) : student.address;

        



        var spreadsheetId = '1zbe4mGXGs8T5PUn0TEbfnoQRrQEcb1X6RYNqTvfEhAo';
        var range = "A1";
        var rows = [student.firstName, student.lastName, student.email, student.phone, student.aptNumber, student.address];
        try {
            const result = await service.spreadsheets.values.append({
                spreadsheetId,
                range,
                "valueInputOption": "USER_ENTERED",
                resource: {
                    values: [rows]
                },
            });

            return res.send({success:"ok"});
            console.log();
        } catch (err) {
            return res.send({ error: err });
        }


    }

}


module.exports = tbaModule;