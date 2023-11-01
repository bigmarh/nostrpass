import User from "../models/user";
import Auth from "../services/auth";


export default function(drawer) {
    return {
        oninit: function() {
            User.getUserData();
        },
        upload: function(e) {
            var file = e.target.files[0];

            storageRef.child(User.displayName() + "-pic").put(file).then(function(snapshot) {
                snapshot.ref.getDownloadURL().then(function(downloadURL) {
                    console.log('File available at', downloadURL);
                    User.updateUserData({ photoURL: downloadURL }).then(function(user) {
                        User.current.userdata.photoURL = downloadURL;
                    }).catch(console.error)
                });
            });
        },
        view: function(vnode) {
            return [
                m(".close-side",{
                            onclick: function() {
                                drawer.open = false;
                            }
                        }, "x"),
                m(".name-plate",

                    User.pic(User.current.user() &&
                        User.current.user().photoURL, {}),
                    /*[
                                       m("i.material-icons",{ onclick: function() { document.getElementById('upload-pic').click(); } }, "photo_camera"),
                                       m('input[type="file"]#upload-pic.hide', { onchange: this.upload })
                                   ]*/
                    m('.name', [
                        m("h6.mdc-drawer__subtitle",
                            "coinID"
                        ),
                        m("h4.mdc-drawer__title",
                            "@" + User.displayName()
                        )

                    ])
                )
            ]

        }
    }
}