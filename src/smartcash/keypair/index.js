'use strict';
Object.defineProperty(exports, '__esModule', { value: true });

const { smartcash: smartMainNetwork } = require('./../../networks');

function getAddressFromWIF(privateKey) {
    let keyPair = ECPair.fromWIF(privateKey);
    const { address } = payments.p2pkh({ pubkey: keyPair.publicKey });
    return address;
}

function getAddressFromKeyPair(keyPair, network) {
    return payments.p2pkh({ pubkey: keyPair.publicKey, network: network || smartMainNetwork }).address;
}

module.exports = {
    getAddressFromWIF: getAddressFromWIF,
    getAddressFromKeyPair: getAddressFromKeyPair,
};
