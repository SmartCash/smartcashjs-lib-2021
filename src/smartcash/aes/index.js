'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const CryptoJS = require('crypto-js');

function encrypt(dataToEncrypt, secret) {
    return CryptoJS.AES.encrypt(dataToEncrypt, secret).toString();
}

function decrypt(encryptedData, secret) {
    return CryptoJS.enc.Utf8.stringify(CryptoJS.AES.decrypt(encryptedData, secret));
}

module.exports = {
    encrypt: encrypt,
    decrypt: decrypt,
};
