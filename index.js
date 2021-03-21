const smartCash = require('./src/index');

const keyPair = smartCash.ECPair.makeRandom();
const { address } = smartCash.payments.p2pkh({ pubkey: keyPair.publicKey });

console.log(address, keyPair.toWIF())