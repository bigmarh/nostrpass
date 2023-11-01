import { CipherSeed } from 'aezeed';

onmessage = function(e) {
	var Buffer = require('buffer');

	console.log("Worker is working");
    console.time("Key")
    let mn = CipherSeed.random().toMnemonic();
    postMessage(mn);
    console.timeEnd("Key");
}