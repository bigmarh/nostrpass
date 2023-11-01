//Create Iframe
function prepareFrame() {
        var ifrm = document.createElement("iframe");
        ifrm.setAttribute("src", "http://google.com/");
        ifrm.style.width = "0px";
        ifrm.style.height = "0px";
        document.getElementById('nostr-bridge').appendChild(ifrm);
}

//load 
//
//