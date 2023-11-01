require('./wasm_exec.js');
const fs = require('fs');
const go = new Go();

(async () => {
        const result = await WebAssembly.instantiate(fs.readFileSync('hello.wasm'), go.importObject)
        go.run(result.instance)
        /*let privateKey = KeyHelper.GenerateKeys();
        let publicKey = KeyHelper.getPublicKey(privateKey)
        let signature = KeyHelper.sign(privateKey, "Peace");
        console.log(KeyHelper)
        console.log("JS.privateKey:", privateKey);
        console.log("JS.publicKey:", publicKey);
        console.log("JS.Signature:", signature);
        console.log("JS.getHash:", KeyHelper.getHash("Love"));
        console.log("JS.Verification:", KeyHelper.verifySign("Peace", signature, publicKey));*/
    }
)()