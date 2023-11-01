export default function(message) {
    return {
        view: function() {
            return m("figure.stop-sign.animated.rubberBand", m("div",
                    m("div",
                        m("div",
                            m("div",
                                m("div",
                                    m("div",

                                    )
                                )
                            )
                        )
                    )
                ),
                m("span",
                    "STOP"
                ))
        }
    };
}