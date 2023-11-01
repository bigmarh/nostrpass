var Utils = {
    validateEmail: function(email) {
        var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(String(email).toLowerCase());
    },
    getRandomInt: function(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },
    fallbackCopyTextToClipboard(text,cb) {
        var textArea = document.createElement("textarea");
        textArea.value = text;

        // Avoid scrolling to bottom
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.position = "fixed";

        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            var successful = document.execCommand('copy');
            var msg = successful ? 'successful' : 'unsuccessful';
            console.log('Copying was ' + msg);
        } catch (err) {
            console.error('Oops, unable to copy', err);
        }

        document.body.removeChild(textArea);
    },
    copyTextToClipboard(text,cb) {
        if (!navigator.clipboard) {
            this.fallbackCopyTextToClipboard(text,cb);
            return;
        }
        navigator.clipboard.writeText(text).then(function() {
            cb('Copying to clipboard was successful!');
        }, function(err) {
            cb('Could not copy text: ' + err);
        });
    }
}


export default Utils;