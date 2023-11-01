var InviteModel = {
    inviteUser: function(data) {
        return new Promise(function(resolve, reject) {
            resolve('123');
        });
    },
    request: function(reqObj) {
        return new Promise(function(resolve, reject) {
            firebase.auth().currentUser && firebase.auth().currentUser.getIdToken().then(function(authToken) {
                reqObj.headers = { 'Authorization': 'Bearer ' + authToken }
                reqObj.url = "http://localhost:5000/bigmarh-wallet/us-central1" + reqObj.endpoint

                m.request(reqObj).then(function(response) {
                        resolve(response)
                    })
                    .catch(function(error) {
                        reject(error);
                    });
            })
        });
    }
}

export default InviteModel;