var welcomeSubmodule = function(ctrl) {
    return {
        oninit: function() {
            
        },
        view: function() {
            return [
                m("nav.navbar.navbar-expand-lg.navbar-dark.bg-black", [
                    m("a.navbar-brand[href='#']", [
                        m("img[src='img/logo.svg']")
                    ]),
                    m("button.navbar-toggler[aria-controls='navbarNav'][aria-expanded='false'][aria-label='Toggle navigation'][data-target='#navbarNav'][data-toggle='collapse'][type='button']", [
                        m("span.navbar-toggler-icon")
                    ]),
                    m(".collapse.navbar-collapse[id='navbarNav']", [
                        m("ul.navbar-nav", [
                            m("li.nav-item.active", [
                                m("a.nav-link[href='#']", [
                                    "Home",
                                    m("span.sr-only",
                                        "(current)"
                                    )
                                ])
                            ]),
                            m("li.nav-item", [
                                m("a.nav-link[href='javascript:;']", "Features")
                            ]),
                            m("li.nav-item", [
                                m("a.nav-link[href='javascript:;']", "Pricing")
                            ]),
                            m("li.nav-item", [
                                m("a.nav-link[href='javascript:;']", {
                                    onclick: function() {
                                        return m.route.set('/login')
                                    }
                                }, "Login")
                            ])
                        ])
                    ])
                ]),
                m("section.header",[
                    m(".container",[
                        m(".row", [
                            m(".col-sm-12.col-md-6", [
                                m("h1.mb-3", "Welcome to Wacoinda"),
                                m("p.mb-5", "Get your visa passport and earn coins by inviting friends, Co-signing new Wacoindans Becoming the top Wacoindan of the month")
                            ]),
                            m(".col-sm-12.col-md-6", [
                                m(".mb-3.shadow-4-8", [
                                    m("img.img-fluid[src='img/card.png']")
                                ]),
                                m(".btn.btn-primary.btn-block.btn-lg", {
                                    onclick: function() {
                                        return m.route.set('/login')
                                    }
                                }, "Sign up now")
                            ])
                        ])
                    ])
                ]),
                m("section.border-bottom.border-secondary",
                    m(".container",
                        m(".row",
                            m(".col", [
                                m("h1.mb-4", [
                                    "Join the",
                                    m("br"),
                                    "movement"
                                ]),
                                m("p.mb-4", "Get your visa passport and earn coins by inviting friends, Co-signing new Wacoindans Becoming the top Wacoindan of the month"),
                                m("ul.list-group.list-group-flush", [
                                    m("li.list-group-item", "A good point and highlight"),
                                    m("li.list-group-item", "A good point and highlight"),
                                    m("li.list-group-item", "A good point and highlight")
                                ])
                            ])
                        )
                    )
                ),
                m(".container",
                    m("section",
                        m(".row",
                            m(".col", [
                                m("h1.text-center.mb-4", [
                                    "Join the",
                                    m("br"),
                                    "movement"
                                ]),
                                m("p.text-center.mb-5",
                                    "Get your visa passport and earn coins by inviting friends, Co-signing new Wacoindans Becoming the top Wacoindan of the month"
                                ),
                                m("ul.list-group.list-group-flush.mb-5", [
                                    m("li.list-group-item", "A good point and highlight"),
                                    m("li.list-group-item", "A good point and highlight"),
                                    m("li.list-group-item", "A good point and highlight")
                                ]),
                                m(".btn.btn-primary.btn-block.btn-lg", {
                                    onclick: function() {
                                        return m.route.set('/login')
                                    }
                                }, "Sign up now")
                            ])
                        )
                    )
                ),
                m("footer",
                    m(".container", [
                        m(".row",
                            m("span.square-12")
                        ),
                        m(".row.mb-5", [
                            m(".col",
                                m("ul.list-unstyled", [
                                    m("li.mb-3", [
                                        m("a[href='javascript:;']", "Contact us")
                                    ]),
                                    m("li.mb-3", [
                                        m("a[href='javascript:;']", "Privacy")
                                    ]),
                                    m("li.mb-3", [
                                        m("a[href='javascript:;']", "Terms of Service")
                                    ])
                                ])
                            ),
                            m(".col",
                                m("ul.list-unstyled.text-right", [
                                    m("li.mb-3", "Icon"),
                                    m("li.mb-3", "Icon"),
                                    m("li.mb-3", "Icon")
                                ])
                            )
                        ]),
                        m(".row", [
                            m(".col", [
                                m("div", [
                                    m("img[src='img/logo.svg']")
                                ]),
                                m("small", "Wacoinda 2018")
                            ])
                        ])
                    ])
                )
            ]
            /*return [
                ((!sessionStorage.igCode) ? [
                    m("nav.navbar.navbar-expand-lg.navbar-dark.bg-black", [
                        m("a.navbar-brand[href='#']", [
                            m("img[src='img/logo.svg']")
                        ]),
                        m("button.navbar-toggler[aria-controls='navbarNav'][aria-expanded='false'][aria-label='Toggle navigation'][data-target='#navbarNav'][data-toggle='collapse'][type='button']", [
                            m("span.navbar-toggler-icon")
                        ]),
                        m(".collapse.navbar-collapse[id='navbarNav']", [
                            m("ul.navbar-nav", [
                                m("li.nav-item.active", [
                                    m("a.nav-link[href='javascript:;']", [
                                        "Home",
                                        m("span.sr-only", "(current)")
                                    ])
                                ]),
                                m("li.nav-item", [
                                    m("a.nav-link[href='javascript:;']", "Features")
                                ]),
                                m("li.nav-item", [
                                    m("a.nav-link[href='javascript:;']", "Pricing")
                                ]),
                                m("li.nav-item", [
                                    m("a.nav-link[href='javascript:;']", {
                                        onclick: function() {
                                            return m.route.set('/login');
                                        }
                                    }, "Login")
                                ])
                            ])
                        ])
                    ]),
                    m("section.header", [
                        m(".container", [
                            m(".row", [
                                m(".col", [
                                    m("h1.mb-3", "Welcome to Wacoinda"),
                                    m("p.mb-5", "Get your visa passport and earn coins by inviting friends, Co-signing new Wacoindans Becoming the top Wacoindan of the month"),
                                    m(".mb-3.shadow-4-8", [
                                        m("img.img-fluid[src='img/card.png']")
                                    ]),
                                    m(".btn.btn-primary.btn-block.btn-lg", {
                                        onclick: function() {
                                            return m.route.set('/login');
                                        }
                                    }, "Sign up now")
                                ])
                            ])
                        ])
                    ]),
                    m("section.border-bottom.border-secondary", [
                        m(".container", [
                            m(".row", [
                                m(".col", [
                                    m("h1.mb-4", [
                                        "Join the",
                                        m("br"),
                                        "movement"
                                    ]),
                                    m("p.mb-4", "Get your visa passport and earn coins by inviting friends, Co-signing new Wacoindans Becoming the top Wacoindan of the month"),
                                    m("ul.list-group.list-group-flush", [
                                        m("li.list-group-item", "A good point and highlight"),
                                        m("li.list-group-item", "A good point and highlight"),
                                        m("li.list-group-item", "A good point and highlight")
                                    ])
                                ])
                            ])
                        ])
                    ]),
                    m(".container", [
                        m("section", [
                            m(".row", [
                                m(".col", [
                                    m("h1.text-center.mb-4", [
                                        "Join the",
                                        m("br"),
                                        "movement"
                                    ]),
                                    m("p.text-center.mb-5", "Get your visa passport and earn coins by inviting friends, Co-signing new Wacoindans Becoming the top Wacoindan of the month"),
                                    m("ul.list-group.list-group-flush.mb-5", [
                                        m("li.list-group-item", "A good point and highlight"),
                                        m("li.list-group-item", "A good point and highlight"),
                                        m("li.list-group-item", "A good point and highlight")
                                    ]),
                                    m(".btn.btn-primary.btn-block.btn-lg", {
                                        onclick: function() {
                                            return m.route.set('/login');
                                        }
                                    }, "Sign up now")
                                ])
                            ])
                        ])
                    ]),
                    m("footer", [
                        m(".container", [
                            m(".row", [
                                m("span.square-12")
                            ]),
                            m(".row.mb-5", [
                                m(".col", [
                                    m("ul.list-unstyled", [
                                        m("li.mb-3", [
                                            m("a[href='']", "Contact us")
                                        ]),
                                        m("li.mb-3", [
                                            m("a[href='']", "Privacy")
                                        ]),
                                        m("li.mb-3", [
                                            m("a[href='']", "Terms of Service")
                                        ])
                                    ])
                                ]),
                                m(".col", [
                                    m("ul.list-unstyled.text-right", [
                                        m("li.mb-3", "Icon"),
                                        m("li.mb-3", "Icon"),
                                        m("li.mb-3", "Icon")
                                    ])
                                ])
                            ]),
                            m(".row", [
                                m(".col", [
                                    m("div", [
                                        m("img[src='img/logo.svg']")
                                    ]),
                                    m("small", "Wacoinda 2018")
                                ])
                            ])
                        ])
                    ])
                ] : '')
            ]*/
        }
    }
}

export default welcomeSubmodule