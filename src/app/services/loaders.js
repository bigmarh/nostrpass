/*
Created by: https://samherbert.net/svg-loaders/
Converted by: Lamar "Bigmarh" Wilson, https://bigmarh.com

*/
export default function(loader,config) {
    config = config ? config:{id:"loader-"+loader};
    var loaders = {
        "rings": m("svg[height='45'][stroke='#fff'][viewBox='0 0 45 45'][width='45'][xmlns='http://www.w3.org/2000/svg']",config,
            m("g[fill='none'][fill-rule='evenodd'][stroke-width='2'][transform='translate(1 1)']", [
                m("circle[cx='22'][cy='22'][r='6'][stroke-opacity='0']", [
                    m("animate[attributeName='r'][begin='1.5s'][calcMode='linear'][dur='3s'][repeatCount='indefinite'][values='6;22']"),
                    m("animate[attributeName='stroke-opacity'][begin='1.5s'][calcMode='linear'][dur='3s'][repeatCount='indefinite'][values='1;0']"),
                    m("animate[attributeName='stroke-width'][begin='1.5s'][calcMode='linear'][dur='3s'][repeatCount='indefinite'][values='2;0']")
                ]),
                m("circle[cx='22'][cy='22'][r='6'][stroke-opacity='0']", [
                    m("animate[attributeName='r'][begin='3s'][calcMode='linear'][dur='3s'][repeatCount='indefinite'][values='6;22']"),
                    m("animate[attributeName='stroke-opacity'][begin='3s'][calcMode='linear'][dur='3s'][repeatCount='indefinite'][values='1;0']"),
                    m("animate[attributeName='stroke-width'][begin='3s'][calcMode='linear'][dur='3s'][repeatCount='indefinite'][values='2;0']")
                ]),
                m("circle[cx='22'][cy='22'][r='8']",
                    m("animate[attributeName='r'][begin='0s'][calcMode='linear'][dur='1.5s'][repeatCount='indefinite'][values='6;1;2;3;4;5;6']")
                )
            ])
        ),
        "audio": m("svg[fill='#FFF'][height='80'][viewBox='0 0 55 80'][width='55'][xmlns='http://www.w3.org/2000/svg']",config,
            m("g[transform='matrix(1 0 0 -1 0 80)']", [
                m("rect[height='20'][rx='3'][width='10']",
                    m("animate[attributeName='height'][begin='0s'][calcMode='linear'][dur='4.3s'][repeatCount='indefinite'][values='20;45;57;80;64;32;66;45;64;23;66;13;64;56;34;34;2;23;76;79;20']")
                ),
                m("rect[height='80'][rx='3'][width='10'][x='15']",
                    m("animate[attributeName='height'][begin='0s'][calcMode='linear'][dur='2s'][repeatCount='indefinite'][values='80;55;33;5;75;23;73;33;12;14;60;80']")
                ),
                m("rect[height='50'][rx='3'][width='10'][x='30']",
                    m("animate[attributeName='height'][begin='0s'][calcMode='linear'][dur='1.4s'][repeatCount='indefinite'][values='50;34;78;23;56;23;34;76;80;54;21;50']")
                ),
                m("rect[height='30'][rx='3'][width='10'][x='45']",
                    m("animate[attributeName='height'][begin='0s'][calcMode='linear'][dur='2s'][repeatCount='indefinite'][values='30;45;13;80;56;72;45;76;34;23;67;30']")
                )
            ])
        ),
        "ball-triangle": m("svg[height='57'][stroke='#fff'][viewBox='0 0 57 57'][width='57'][xmlns='http://www.w3.org/2000/svg']",config,
            m("g[fill='none'][fill-rule='evenodd']",
                m("g[stroke-width='2'][transform='translate(1 1)']", [
                    m("circle[cx='5'][cy='50'][r='5']", [
                        m("animate[attributeName='cy'][begin='0s'][calcMode='linear'][dur='2.2s'][repeatCount='indefinite'][values='50;5;50;50']"),
                        m("animate[attributeName='cx'][begin='0s'][calcMode='linear'][dur='2.2s'][repeatCount='indefinite'][values='5;27;49;5']")
                    ]),
                    m("circle[cx='27'][cy='5'][r='5']", [
                        m("animate[attributeName='cy'][begin='0s'][calcMode='linear'][dur='2.2s'][from='5'][repeatCount='indefinite'][to='5'][values='5;50;50;5']"),
                        m("animate[attributeName='cx'][begin='0s'][calcMode='linear'][dur='2.2s'][from='27'][repeatCount='indefinite'][to='27'][values='27;49;5;27']")
                    ]),
                    m("circle[cx='49'][cy='50'][r='5']", [
                        m("animate[attributeName='cy'][begin='0s'][calcMode='linear'][dur='2.2s'][repeatCount='indefinite'][values='50;50;5;50']"),
                        m("animate[attributeName='cx'][begin='0s'][calcMode='linear'][dur='2.2s'][from='49'][repeatCount='indefinite'][to='49'][values='49;5;27;49']")
                    ])
                ])
            )
        ),
        "bars": m("svg[fill='#fff'][height='140'][viewBox='0 0 135 140'][width='135'][xmlns='http://www.w3.org/2000/svg']",config, [
            m("rect[height='120'][rx='6'][width='15'][y='10']", [
                m("animate[attributeName='height'][begin='0.5s'][calcMode='linear'][dur='1s'][repeatCount='indefinite'][values='120;110;100;90;80;70;60;50;40;140;120']"),
                m("animate[attributeName='y'][begin='0.5s'][calcMode='linear'][dur='1s'][repeatCount='indefinite'][values='10;15;20;25;30;35;40;45;50;0;10']")
            ]),
            m("rect[height='120'][rx='6'][width='15'][x='30'][y='10']", [
                m("animate[attributeName='height'][begin='0.25s'][calcMode='linear'][dur='1s'][repeatCount='indefinite'][values='120;110;100;90;80;70;60;50;40;140;120']"),
                m("animate[attributeName='y'][begin='0.25s'][calcMode='linear'][dur='1s'][repeatCount='indefinite'][values='10;15;20;25;30;35;40;45;50;0;10']")
            ]),
            m("rect[height='140'][rx='6'][width='15'][x='60']", [
                m("animate[attributeName='height'][begin='0s'][calcMode='linear'][dur='1s'][repeatCount='indefinite'][values='120;110;100;90;80;70;60;50;40;140;120']"),
                m("animate[attributeName='y'][begin='0s'][calcMode='linear'][dur='1s'][repeatCount='indefinite'][values='10;15;20;25;30;35;40;45;50;0;10']")
            ]),
            m("rect[height='120'][rx='6'][width='15'][x='90'][y='10']", [
                m("animate[attributeName='height'][begin='0.25s'][calcMode='linear'][dur='1s'][repeatCount='indefinite'][values='120;110;100;90;80;70;60;50;40;140;120']"),
                m("animate[attributeName='y'][begin='0.25s'][calcMode='linear'][dur='1s'][repeatCount='indefinite'][values='10;15;20;25;30;35;40;45;50;0;10']")
            ]),
            m("rect[height='120'][rx='6'][width='15'][x='120'][y='10']", [
                m("animate[attributeName='height'][begin='0.5s'][calcMode='linear'][dur='1s'][repeatCount='indefinite'][values='120;110;100;90;80;70;60;50;40;140;120']"),
                m("animate[attributeName='y'][begin='0.5s'][calcMode='linear'][dur='1s'][repeatCount='indefinite'][values='10;15;20;25;30;35;40;45;50;0;10']")
            ])
        ]),
        "circles": m("svg[fill='#fff'][height='135'][viewBox='0 0 135 135'][width='135'][xmlns='http://www.w3.org/2000/svg']",config, [
            m("path[d='M67.447 58c5.523 0 10-4.477 10-10s-4.477-10-10-10-10 4.477-10 10 4.477 10 10 10zm9.448 9.447c0 5.523 4.477 10 10 10 5.522 0 10-4.477 10-10s-4.478-10-10-10c-5.523 0-10 4.477-10 10zm-9.448 9.448c-5.523 0-10 4.477-10 10 0 5.522 4.477 10 10 10s10-4.478 10-10c0-5.523-4.477-10-10-10zM58 67.447c0-5.523-4.477-10-10-10s-10 4.477-10 10 4.477 10 10 10 10-4.477 10-10z']",
                m("animateTransform[attributeName='transform'][dur='2.5s'][from='0 67 67'][repeatCount='indefinite'][to='-360 67 67'][type='rotate']")
            ),
            m("path[d='M28.19 40.31c6.627 0 12-5.374 12-12 0-6.628-5.373-12-12-12-6.628 0-12 5.372-12 12 0 6.626 5.372 12 12 12zm30.72-19.825c4.686 4.687 12.284 4.687 16.97 0 4.686-4.686 4.686-12.284 0-16.97-4.686-4.687-12.284-4.687-16.97 0-4.687 4.686-4.687 12.284 0 16.97zm35.74 7.705c0 6.627 5.37 12 12 12 6.626 0 12-5.373 12-12 0-6.628-5.374-12-12-12-6.63 0-12 5.372-12 12zm19.822 30.72c-4.686 4.686-4.686 12.284 0 16.97 4.687 4.686 12.285 4.686 16.97 0 4.687-4.686 4.687-12.284 0-16.97-4.685-4.687-12.283-4.687-16.97 0zm-7.704 35.74c-6.627 0-12 5.37-12 12 0 6.626 5.373 12 12 12s12-5.374 12-12c0-6.63-5.373-12-12-12zm-30.72 19.822c-4.686-4.686-12.284-4.686-16.97 0-4.686 4.687-4.686 12.285 0 16.97 4.686 4.687 12.284 4.687 16.97 0 4.687-4.685 4.687-12.283 0-16.97zm-35.74-7.704c0-6.627-5.372-12-12-12-6.626 0-12 5.373-12 12s5.374 12 12 12c6.628 0 12-5.373 12-12zm-19.823-30.72c4.687-4.686 4.687-12.284 0-16.97-4.686-4.686-12.284-4.686-16.97 0-4.687 4.686-4.687 12.284 0 16.97 4.686 4.687 12.284 4.687 16.97 0z']",
                m("animateTransform[attributeName='transform'][dur='8s'][from='0 67 67'][repeatCount='indefinite'][to='360 67 67'][type='rotate']")
            )
        ]),
        "grid": m("svg[fill='#fff'][height='105'][viewBox='0 0 105 105'][width='105'][xmlns='http://www.w3.org/2000/svg']",config, [
            m("circle[cx='12.5'][cy='12.5'][r='12.5']",
                m("animate[attributeName='fill-opacity'][begin='0s'][calcMode='linear'][dur='1s'][repeatCount='indefinite'][values='1;.2;1']")
            ),
            m("circle[cx='12.5'][cy='52.5'][fill-opacity='.5'][r='12.5']",
                m("animate[attributeName='fill-opacity'][begin='100ms'][calcMode='linear'][dur='1s'][repeatCount='indefinite'][values='1;.2;1']")
            ),
            m("circle[cx='52.5'][cy='12.5'][r='12.5']",
                m("animate[attributeName='fill-opacity'][begin='300ms'][calcMode='linear'][dur='1s'][repeatCount='indefinite'][values='1;.2;1']")
            ),
            m("circle[cx='52.5'][cy='52.5'][r='12.5']",
                m("animate[attributeName='fill-opacity'][begin='600ms'][calcMode='linear'][dur='1s'][repeatCount='indefinite'][values='1;.2;1']")
            ),
            m("circle[cx='92.5'][cy='12.5'][r='12.5']",
                m("animate[attributeName='fill-opacity'][begin='800ms'][calcMode='linear'][dur='1s'][repeatCount='indefinite'][values='1;.2;1']")
            ),
            m("circle[cx='92.5'][cy='52.5'][r='12.5']",
                m("animate[attributeName='fill-opacity'][begin='400ms'][calcMode='linear'][dur='1s'][repeatCount='indefinite'][values='1;.2;1']")
            ),
            m("circle[cx='12.5'][cy='92.5'][r='12.5']",
                m("animate[attributeName='fill-opacity'][begin='700ms'][calcMode='linear'][dur='1s'][repeatCount='indefinite'][values='1;.2;1']")
            ),
            m("circle[cx='52.5'][cy='92.5'][r='12.5']",
                m("animate[attributeName='fill-opacity'][begin='500ms'][calcMode='linear'][dur='1s'][repeatCount='indefinite'][values='1;.2;1']")
            ),
            m("circle[cx='92.5'][cy='92.5'][r='12.5']",
                m("animate[attributeName='fill-opacity'][begin='200ms'][calcMode='linear'][dur='1s'][repeatCount='indefinite'][values='1;.2;1']")
            )
        ]),
        "hearts": m("svg[fill='#fff'][height='64'][viewBox='0 0 140 64'][width='140'][xmlns='http://www.w3.org/2000/svg']",config, [
            m("path[d='M30.262 57.02L7.195 40.723c-5.84-3.976-7.56-12.06-3.842-18.063 3.715-6 11.467-7.65 17.306-3.68l4.52 3.76 2.6-5.274c3.717-6.002 11.47-7.65 17.305-3.68 5.84 3.97 7.56 12.054 3.842 18.062L34.49 56.118c-.897 1.512-2.793 1.915-4.228.9z'][fill-opacity='.5']",
                m("animate[attributeName='fill-opacity'][begin='0s'][calcMode='linear'][dur='1.4s'][repeatCount='indefinite'][values='0.5;1;0.5']")
            ),
            m("path[d='M105.512 56.12l-14.44-24.272c-3.716-6.008-1.996-14.093 3.843-18.062 5.835-3.97 13.588-2.322 17.306 3.68l2.6 5.274 4.52-3.76c5.84-3.97 13.592-2.32 17.307 3.68 3.718 6.003 1.998 14.088-3.842 18.064L109.74 57.02c-1.434 1.014-3.33.61-4.228-.9z'][fill-opacity='.5']",
                m("animate[attributeName='fill-opacity'][begin='0.7s'][calcMode='linear'][dur='1.4s'][repeatCount='indefinite'][values='0.5;1;0.5']")
            ),
            m("path[d='M67.408 57.834l-23.01-24.98c-5.864-6.15-5.864-16.108 0-22.248 5.86-6.14 15.37-6.14 21.234 0L70 16.168l4.368-5.562c5.863-6.14 15.375-6.14 21.235 0 5.863 6.14 5.863 16.098 0 22.247l-23.007 24.98c-1.43 1.556-3.757 1.556-5.188 0z']")
        ]),
        "oval": m("svg[height='38'][stroke='#fff'][viewBox='0 0 38 38'][width='38'][xmlns='http://www.w3.org/2000/svg']",config,
            m("g[fill='none'][fill-rule='evenodd']",
                m("g[stroke-width='2'][transform='translate(1 1)']", [
                    m("circle[cx='18'][cy='18'][r='18'][stroke-opacity='.5']"),
                    m("path[d='M36 18c0-9.94-8.06-18-18-18']",
                        m("animateTransform[attributeName='transform'][dur='1s'][from='0 18 18'][repeatCount='indefinite'][to='360 18 18'][type='rotate']")
                    )
                ])
            )
        ),
        "puff": m("svg[height='44'][stroke='#fff'][viewBox='0 0 44 44'][width='44'][xmlns='http://www.w3.org/2000/svg']",config,
            m("g[fill='none'][fill-rule='evenodd'][stroke-width='2']", [
                m("circle[cx='22'][cy='22'][r='1']", [
                    m("animate[attributeName='r'][begin='0s'][calcMode='spline'][dur='1.8s'][keySplines='0.165, 0.84, 0.44, 1'][keyTimes='0; 1'][repeatCount='indefinite'][values='1; 20']"),
                    m("animate[attributeName='stroke-opacity'][begin='0s'][calcMode='spline'][dur='1.8s'][keySplines='0.3, 0.61, 0.355, 1'][keyTimes='0; 1'][repeatCount='indefinite'][values='1; 0']")
                ]),
                m("circle[cx='22'][cy='22'][r='1']", [
                    m("animate[attributeName='r'][begin='-0.9s'][calcMode='spline'][dur='1.8s'][keySplines='0.165, 0.84, 0.44, 1'][keyTimes='0; 1'][repeatCount='indefinite'][values='1; 20']"),
                    m("animate[attributeName='stroke-opacity'][begin='-0.9s'][calcMode='spline'][dur='1.8s'][keySplines='0.3, 0.61, 0.355, 1'][keyTimes='0; 1'][repeatCount='indefinite'][values='1; 0']")
                ])
            ])
        ),
        "spinning-circles": m("svg[height='58'][viewBox='0 0 58 58'][width='58'][xmlns='http://www.w3.org/2000/svg']",config,
            m("g[fill='none'][fill-rule='evenodd']",
                m("g[stroke='#FFF'][stroke-width='1.5'][transform='translate(2 1)']", [
                    m("circle[cx='42.601'][cy='11.462'][fill='#fff'][fill-opacity='1'][r='5']",
                        m("animate[attributeName='fill-opacity'][begin='0s'][calcMode='linear'][dur='1.3s'][repeatCount='indefinite'][values='1;0;0;0;0;0;0;0']")
                    ),
                    m("circle[cx='49.063'][cy='27.063'][fill='#fff'][fill-opacity='0'][r='5']",
                        m("animate[attributeName='fill-opacity'][begin='0s'][calcMode='linear'][dur='1.3s'][repeatCount='indefinite'][values='0;1;0;0;0;0;0;0']")
                    ),
                    m("circle[cx='42.601'][cy='42.663'][fill='#fff'][fill-opacity='0'][r='5']",
                        m("animate[attributeName='fill-opacity'][begin='0s'][calcMode='linear'][dur='1.3s'][repeatCount='indefinite'][values='0;0;1;0;0;0;0;0']")
                    ),
                    m("circle[cx='27'][cy='49.125'][fill='#fff'][fill-opacity='0'][r='5']",
                        m("animate[attributeName='fill-opacity'][begin='0s'][calcMode='linear'][dur='1.3s'][repeatCount='indefinite'][values='0;0;0;1;0;0;0;0']")
                    ),
                    m("circle[cx='11.399'][cy='42.663'][fill='#fff'][fill-opacity='0'][r='5']",
                        m("animate[attributeName='fill-opacity'][begin='0s'][calcMode='linear'][dur='1.3s'][repeatCount='indefinite'][values='0;0;0;0;1;0;0;0']")
                    ),
                    m("circle[cx='4.938'][cy='27.063'][fill='#fff'][fill-opacity='0'][r='5']",
                        m("animate[attributeName='fill-opacity'][begin='0s'][calcMode='linear'][dur='1.3s'][repeatCount='indefinite'][values='0;0;0;0;0;1;0;0']")
                    ),
                    m("circle[cx='11.399'][cy='11.462'][fill='#fff'][fill-opacity='0'][r='5']",
                        m("animate[attributeName='fill-opacity'][begin='0s'][calcMode='linear'][dur='1.3s'][repeatCount='indefinite'][values='0;0;0;0;0;0;1;0']")
                    ),
                    m("circle[cx='27'][cy='5'][fill='#fff'][fill-opacity='0'][r='5']",
                        m("animate[attributeName='fill-opacity'][begin='0s'][calcMode='linear'][dur='1.3s'][repeatCount='indefinite'][values='0;0;0;0;0;0;0;1']")
                    )
                ])
            )
        ),
        "tail-spin": m("svg[height='38'][viewBox='0 0 38 38'][width='38'][xmlns='http://www.w3.org/2000/svg']",config, [
            m("defs",
                m("linearGradient[id='a'][x1='8.042%'][x2='65.682%'][y1='0%'][y2='23.865%']", [
                    m("stop[offset='0%'][stop-color='#fff'][stop-opacity='0']"),
                    m("stop[offset='63.146%'][stop-color='#fff'][stop-opacity='.631']"),
                    m("stop[offset='100%'][stop-color='#fff']")
                ])
            ),
            m("g[fill='none'][fill-rule='evenodd']",
                m("g[transform='translate(1 1)']", [
                    m("path[d='M36 18c0-9.94-8.06-18-18-18'][id='Oval-2'][stroke='url(#a)'][stroke-width='2']",
                        m("animateTransform[attributeName='transform'][dur='0.9s'][from='0 18 18'][repeatCount='indefinite'][to='360 18 18'][type='rotate']")
                    ),
                    m("circle[cx='36'][cy='18'][fill='#fff'][r='1']",
                        m("animateTransform[attributeName='transform'][dur='0.9s'][from='0 18 18'][repeatCount='indefinite'][to='360 18 18'][type='rotate']")
                    )
                ])
            )
        ]),
        "three-dots": m("svg[fill='#fff'][height='30'][viewBox='0 0 120 30'][width='120'][xmlns='http://www.w3.org/2000/svg']",config, [
            m("circle[cx='15'][cy='15'][r='15']", [
                m("animate[attributeName='r'][begin='0s'][calcMode='linear'][dur='0.8s'][from='15'][repeatCount='indefinite'][to='15'][values='15;9;15']"),
                m("animate[attributeName='fill-opacity'][begin='0s'][calcMode='linear'][dur='0.8s'][from='1'][repeatCount='indefinite'][to='1'][values='1;.5;1']")
            ]),
            m("circle[cx='60'][cy='15'][fill-opacity='0.3'][r='9']", [
                m("animate[attributeName='r'][begin='0s'][calcMode='linear'][dur='0.8s'][from='9'][repeatCount='indefinite'][to='9'][values='9;15;9']"),
                m("animate[attributeName='fill-opacity'][begin='0s'][calcMode='linear'][dur='0.8s'][from='0.5'][repeatCount='indefinite'][to='0.5'][values='.5;1;.5']")
            ]),
            m("circle[cx='105'][cy='15'][r='15']", [
                m("animate[attributeName='r'][begin='0s'][calcMode='linear'][dur='0.8s'][from='15'][repeatCount='indefinite'][to='15'][values='15;9;15']"),
                m("animate[attributeName='fill-opacity'][begin='0s'][calcMode='linear'][dur='0.8s'][from='1'][repeatCount='indefinite'][to='1'][values='1;.5;1']")
            ])
        ])
    }
    return { view: function() { return loaders[loader] } };
}