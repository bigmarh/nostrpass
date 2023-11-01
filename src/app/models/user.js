import config from "../../config";
import Payload from "../services/payload";
import BNmath from "../services/bigNumberMath"
import Denominations from "../services/denominations"
import Auth from '../services/auth';

window.payload = Payload;
window.BN = BNmath.BN;
var UserModel = {
    picMap: {},
    balance: {
        native: ""
    },
    _data: {
        apps: { 0: "" },
        name: 'bigmarh2',
        displayName: "Big Black Cupid",
        picture: 'https://nostr.build/i/nostr.build_e6d5e0dcd09ffa70…c7491bf935088f9e81a451d06455d0fec6e8ae75de61.webp',
        about: 'Love.Freedom.Humor.Motivation. There is no fear in… but perfect love casteth out fear - 1 John 4:18a',
        lud16: 'bigmarh@getalby.com',
        website: "blackbitcoinbillionaire.com",
        nip05: 'bigmarh@bigmarh.com'
    },
    setProperty: (prop, value) => UserModel._data[prop] = value,

    data: () => {
        return JSON.parse(localStorage.getItem('_userData'));
    },
    getProvider: function(provider) {
        if (!provider) {
            provider = firebase.auth().currentUser.providerData[0].providerId
        }

        switch (provider) {
            case 'google.com':
                return 'google'
                break;
            case 'facebook.com':
                return 'facebook'
                break;
            case 'twitter.com':
                return 'twitter'
                break;
            case 'github.com':
                return 'github'
                break;
        }
    },
    current: {
        user: function() {
            return firebase.auth().currentUser
        }
    },
    getPrivateKey: function(caller) {
        if (!UserModel.privateKey) return Auth.openPin(caller);
        return UserModel.privateKey;
    },
    displayName: function() {
        return UserModel.current.user() && UserModel.current.user().displayName;
    },
    accountAddress: function() {
        return UserModel.current.user().photoURL.split(":")[0]
    },
    pic: function(userPic, opts, elements) {
        if (userPic) opts.style = { 'background-image': `url(${userPic})` }
        return m('.user-pic', opts, elements)
    },
    walletDetails: function() {
        return this.data().wallets.main;
    },
    get: function(elements) {
        if (!UserModel.current.userdata) return;
        var newObject = UserModel.current.userdata;
        if (!elements) return newObject;
        var elements = elements.split('.');
        if (elements.length = 1) return newObject[elements[0]];
        elements.forEach(function(element) {
            if (newObject[element]) newObject = newObject[element];
        })
        return newObject || null;
    },
    updateBalance: function() {
        return;
    },
    getUserByAccount: function(account) {
        var reqObj = {
            method: "GET",
            endpoint: "/getUserByAddress/" + account
        }
        return UserModel.request(reqObj)
    },
    getUserData: function() {
        if (!firebase.auth().currentUser) return "You must be logged in";
        var reqObj = {
            method: "GET",
            endpoint: "/getUserData"
        }

        return UserModel.request(reqObj);
    },
    updateUserData: function(body) {
        console.log(body);
        var reqObj = {
            method: "PUT",
            endpoint: "/setUserData",
            body: body
        }
        return UserModel.request(reqObj);
    },
    setUserData: function(body) {
        UserModel.current.userdata = data;
        localStorage.currentUserData = JSON.stringify(body);
        if (!UserModel.balanceFilter && data.wallets) UserModel.addBalanceCheck();
        return data;
    },
    getTransactions: function(account) {
        return new Promise(function(resolve, reject) {
            var reqObj = {
                method: "GET",
                endpoint: "/getTransactions/" + account + "/" + localStorage.lastTime
            }
            return UserModel.request(reqObj).then(resolve);
        })
    },
    setTransactions: function(txs) {
        UserModel.transactions = txs;
    },
    /**
     * Checks to see if a username is available
     * @param  {String} username The requested usernamme
     * @return {Boolean}        True/False if the username is available
     */
    checkIfUsernameIsAvailable: function(username) {
        return UserModel.request({
            method: "get",
            endpoint: "/checkIfUsernameIsAvailable/" + username,
            data: {
                username: username
            }
        })
    },
    changeDenomination: function(denomination) {
        if (denomination.toLowerCase() == "toggle") {
            UserModel.currentDenomination = UserModel.currentDenomination.abbr == "GV" ? Denominations.Garveys["cj"] : Denominations.Garveys["gv"];
            UserModel.current.userdata.settings.preferredDenomination['Garveys'] = (UserModel.currentDenomination.abbr == "GV") ? "gv" : "cj";
            UserModel.updateUserData(UserModel.current.userdata)
            return;
        }

        return UserModel.currentDenomination = Denominations.Garveys[denomination];
    },
    /**
     * Checks to see if a user is part of the Wacoinda Facebook group
     * @param  {String} id      User's Facebook ID
     * @return {Boolean}        True/False if the user is in the group
     */

    /**
     * Attempts to add a sponsor via referal code
     * @param {String} code The code
     */
    addSponsorByReferralCode: function(code) {
        return UserModel.request({
            method: "POST",
            endpoint: "/addSponsorByReferralCode",
            data: {
                code: code
            }
        })
    },
    /**
     * Creates a new instance of the Account contract
     * @param  {Object} data Data object containing the user's address and initial contract params
     * @return {Void}        Contract address
     */
    createNewInstanceOfAccount: function(body) {
        return UserModel.request({
            method: "POST",
            endpoint: "/createNewInstanceOfAccount",
            body: body
        })
    },

    formatAmount: function(amount) {
        amount = String(amount);
        var split = amount.split('.');
        var whole = split[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        var decimal = split[1];
        return amount === "0" ? "0" : (split.length > 1 ? [whole, decimal].join(".") : whole);
    },
    formatDateString: function(dateObj) {
        var hours = dateObj.getHours();
        var minutes = dateObj.getMinutes();
        var ampm = hours >= 12 ? 'pm' : 'am';
        hours = hours % 12;
        hours = hours ? hours : 12;
        minutes = minutes < 10 ? '0' + minutes : minutes;
        var strTime = hours + ':' + minutes + ' ' + ampm;

        var stringToReturn = dateObj.getMonth() + 1 + "/" + dateObj.getDate() + "/" + dateObj.getFullYear()
        if (dateObj.setHours(0, 0, 0, 0) == new Date().setHours(0, 0, 0, 0)) {
            stringToReturn = strTime
        }

        return stringToReturn
    },
    getAllusernamesAndImageUrls: function() {
        return new Promise(function(resolve, reject) {
            UserModel.request({
                method: "POST",
                endpoint: "/getAllusernamesAndImageUrls"
            }).then(function(response) {
                var users = [];
                response.forEach(function(user) {
                    if (user.username != UserModel.current.userdata.username) {
                        users.push(user);
                    }
                })

                UserModel.users = users;
            })
        })
    },
    sendAccountTransaction: function(txObject) {
        return UserModel.request({
            method: "POST",
            endpoint: "/sendAccountTransaction",
            data: txObject
        })
    },
    transferFunds: function(txObject) {
        return UserModel.request({
            method: "POST",
            endpoint: "/transferFunds",
            data: txObject
        })
    },
    getUserByusername: function(username) {
        return UserModel.request({
            method: "GET",
            endpoint: "/getUserByusername/" + username,
        })
    },

    request: function(reqObj) {
        try{    
                console.log("peace")
                if(!firebase.auth().currentUser) return "";
                return firebase.auth().currentUser && firebase.auth().currentUser.getIdToken().then(function(authToken) {
                       console.log("yo")
                    reqObj.headers = { 'Authorization': 'Bearer ' + authToken }
                    console.log(config.apiUrl[appState]);
                    reqObj.url = config.apiUrl[appState] + reqObj.endpoint
        
                    if (reqObj.data && reqObj.data.privateKey) {
                        reqObj.data.data = Payload.ecies.encrypt(JSON.stringify(reqObj.data.data), reqObj.data.privateKey, config.serverPublicKey);
                        delete reqObj.data.privateKey;
                    }
        
        
                    return m.request(reqObj);
                })}
                catch(e){
                    console.log(e);
                }
    }

}

//window.UserModel = UserModel;
export default UserModel;


function browserIsMobile() {
    var check = false;
    (function(a) { if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4))) check = true; })(navigator.userAgent || navigator.vendor || window.opera);
    return check;
};