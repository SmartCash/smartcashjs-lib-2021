const { fromWIF } = require('./ecpair');
const { fromBase58Check } = require('./address');

function isAddress(address) {
    return new Promise((resolve, reject) => {
        try {
            fromBase58Check(address);
            resolve(address);
        } catch (e) {
            return reject(e);
        }
    });
}

function isPK(keyString) {
    return new Promise((resolve, reject) => {
        try {
            fromWIF(keyString);
            resolve(keyString);
        } catch (e) {
            return reject(e);
        }
    });
}

