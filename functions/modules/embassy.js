let embassyModule = {
    listAction: async (request, response) => {
        console.log(request.body, request.params)
        let update = { currentBatch: {} };
        update.currentBatch[request.body.row] = {};
        update.currentBatch[request.body.row][request.params.action] = request.params.action == 'declined' ? request.body.message : new Date().getTime();
        let docRef = db.collection('embassy_users').doc(request.params.user);
        switch (request.params.action) {
            case "declined":
                docRef.set(update, { merge: true }).catch(e => { console.log(e) })
                break;
            case "paid":
                docRef.set(update, { merge: true }).catch(e => { console.log(e) })
                break;
            case "batchCompleted":
                if(request.params.user == "lamar") return response.send({ updated: "Ok" });
                docRef.set({ currentBatch: { batchCompletedOn: new Date(), batchCompleted: true } }, { merge: true }).catch(e => { console.log(e) });
                break;
            case "getnewlist":
                    return response({batch:{}});
                let list = await embassyModule.getList(request, response);
                return docRef.get().then(doc => {
                    let user = doc.data();
                    let lastRow = user.currentBatch.lastRow;
                    docRef.collection('batches').doc(String(lastRow)).set(user.currentBatch);

                    user.currentBatch = list;
                    docRef.set(user).catch(e => { console.log(e) });
                    let obj = {};
                    obj.currentBatch = {};
                    obj.currentBatch[lastRow + ":" + user.cashtag] = { cashtag: user.cashtag, email: user.email, payout: request.body.payout };

                    db.collection('embassy_users').doc('lamar').set(obj, { merge: true });
                    return response.send({ batch: list });
                })
                break;
        }

        return response.send({ updated: "Ok" });
    },

    authorize: (request, response) => {
        db.collection("embassy_users")
            .where('email', '==', request.body.email)
            .where('cashtag', '==', request.body.cashtag)
            .get()
            .then((snap) => {
                if (snap.empty) return response.send({ error: "Ambassador doesn’t exist." });
                snap.forEach(async doc => {
                    var user = doc.data();
                    if (user.currentBatch) return response.send(user);
                    request.u = user;
                    var batch = await embassyModule.getList(request, response);
                    if (Object.keys(batch).length) {
                        user.id = doc.id;
                        user.currentBatch = {};
                        doc.ref.set(user, { merge: true })
                        return response.send(user);
                    } else {
                        console.log("No batch");
                        response.send("No batch");

                    }
                })
            })
    },
    getList: (request, response) => {
        let lastRow = 0;
        //Get Last
        return db.collection('embassy_users').doc('settings').get()
            .then(doc => {
                let list = {};
                settings = doc.data();
                return db.collection('embassy_rows')
                    .where("row", ">", parseInt(settings.lastRow))
                    .limit(100)
                    .get()
                    .then(snap => {

                        snap.forEach(doc => {
                            let person = doc.data();
                            list[person.row] = {
                                name: person['First Name'] ? person['First Name'] + " " + person['Last Name'] : "",
                                cashtag: person['What is your $Cashtag?']
                            }
                            lastRow = person.row;
                        })
                        list.lastRow = parseInt(lastRow);
                        list.requestStartFunds = false;
                        doc.ref.set({ lastRow: parseInt(lastRow) });
                        return list;
                    })

            })

    },

}


module.exports = embassyModule;