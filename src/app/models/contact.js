import User from './user';

var ContactModel = {
    get: async function(account) {
        retun await DB.contacts.get(account);
    }
}