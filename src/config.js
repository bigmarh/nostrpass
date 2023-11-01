export default {
    apiUrl: {
        localdev: "http://localhost:5001/nostrpass/us-central1/userApi",
        production: "https://us-central1-nostrpass.cloudfunctions.net/userApi"
    },
    clientUrl: {
        localdev: "http://localhost:5006/#",
        production: "https://cjwallet.web.app/#"
    },
    appState: 'localdev',
    //appState: 'production',
    firebaseConfig: {
        "localdev": {
            apiKey: "AIzaSyAzRLcJL_ZFUqyOO8w_IkemJYrcsejuMHE",
            authDomain: "nostrpass.firebaseapp.com",
            projectId: "nostrpass",
            storageBucket: "nostrpass.appspot.com",
            messagingSenderId: "1017564555670",
            appId: "1:1017564555670:web:1639cb0063521242ead5b7",
            measurementId: "G-ELQLLECE95"
        },
        "production": {
            apiKey: "AIzaSyAzRLcJL_ZFUqyOO8w_IkemJYrcsejuMHE",
            authDomain: "nostrpass.firebaseapp.com",
            projectId: "nostrpass",
            storageBucket: "nostrpass.appspot.com",
            messagingSenderId: "1017564555670",
            appId: "1:1017564555670:web:1639cb0063521242ead5b7",
            measurementId: "G-ELQLLECE95"
        }
    },
    chainProvider: 'http://35.196.161.206:23000',
    appUrl: 'http://localhost:5006',
    serverPublicKey: "0293262bddf235eac93acce261025a783f7c3ae0df9b7e44424ff41560f6809f68"
}