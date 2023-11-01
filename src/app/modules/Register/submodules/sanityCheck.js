import Auth from "../../../services/auth";
import Utils from "../../../services/utils";
import User from "../../../models/user";
import fullLoader from "../../../services/fullLoader";
import stopSign from "../../../widgets/stopSign";
var controller = {};
var showQuiz = false;
var words;
var randomWord;

var state = {
    quizWord: "",
    setQuizWord: function(v) {
        this.quizWord = v;
    }
}
var sanitySubmodule = function(ctrl) {

    var sanityCheck = {

        oninit: function() {
            randomWord = Utils.getRandomInt(0, 23);

            words = ctrl.mnemonic.split(" ");
            console.log(words.map((word, index) => {
                return (index + 1) + " " + word;
            }))
            ctrl.showLoader = false;
            if (!Auth.pin) return m.route.set('/mnemonic');
            //if (!User.current.userdata) return m.route.set('/login');
        },
        quiz: function() {
            if (!showQuiz) { showQuiz = true; return m.redraw(); }

            if (state.quizWord.toLowerCase() == words[randomWord]) {
                ctrl.createWallets().then(function(wallets) {
                    console.log("Creating Wallet");
                    return m.route.set('/dash');

                })
            } else {
                alert("Please write your mnemonic down or at least make a screenshot,which is not advised, this time!")
                return m.route.set('/mnemonic');
            }
        },
        view: function() {
            return [

                m(".reg-page", [
                    m('h4', 'Create Wallet'),
                    m(".mdc-card.registration-card",
                        [
                            m(".mdc-card__media.mdc-card__media--square",
                                m(".mdc-card__media-content",

                                    !showQuiz ? [m(stopSign()), m(".message", [
                                        m("h3", "Did you really write down your mnemonic?"),
                                        m("p", "If not create a new one.", m("h2", "AND WRITE IT DOWN")),
                                        m("p", "Please."),
                                        m("p", "THIS REALLY IS SERIOUS.")
                                    ])] : [
                                        m('p', "Quiz: What is the number " + (randomWord + 1) + " word in your mnemonic?"),
                                        m("input.form-control.sanityCheck", {
                                            oncreate: function(vnode) {
                                                vnode.dom.focus();
                                            },
                                            oninput: (e) => { state.setQuizWord(e.target.value) },
                                            value: state.quizWord
                                        })
                                    ]


                                )), m(".mdc-card__actions",
                                [
                                    m(".mdc-card__action-icons.left", m(".mdc-card__action-buttons",
                                        [
                                            m("button.mdc-button.mdc-card__action.mdc-card__action--button", {
                                                    onclick: () => { m.route.set('/mnemonic'); }
                                                },
                                                "No"
                                            )
                                        ]
                                    )),
                                    m(".mdc-card__action-icons", m(".mdc-card__action-buttons",
                                        [
                                            Auth.confirmPin === Auth.pin && m(".button.mdc-button.mdc-card__action.mdc-card__action--button" + ((Auth.confirmPin !== Auth.pin || ctrl.showLoader) ? '.disabled' : ''), {
                                                onclick: sanityCheck.quiz
                                            }, !showQuiz ? "Yes" : "Prove it"),
                                            ((ctrl.showLoader) ? m(fullLoader("Creating your wallet...")) : '')
                                        ]
                                    ))
                                ]
                            )
                        ])
                ])
            ]

        }
    }

    return sanityCheck;


}

export default sanitySubmodule;