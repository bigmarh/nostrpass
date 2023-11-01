import User from '../models/user.js';
import Auth from '../services/auth.js';
let DashModule = {
    oninit: async function() {
      	if(!User._data.encyrptedKeys) m.route.set('/profile/edit')
    },
    view: () => {
        return [User._data.npub,JSON.stringify(User._data),m('button',{onclick:() => {return m.route.set('/profile/edit');}},"edit")]
    }
}
export default function() { return DashModule };