'use strict';
Object.defineProperty(exports, '__esModule', { value: true });

var base58 = require('bs58');
var sha3 = require('js-sha3').keccak256;

function keccak(buffer) {
    var tmp = new sha3.update(buffer);
    return new Buffer(tmp.digest('hex'), 'hex');
}

// Encode a buffer as a base58-check encoded string
function encode(payload) {
    var checksum = keccak(payload);

    return base58.encode(Buffer.concat([payload, checksum], payload.length + 4));
}

function decodeRaw(buffer) {
    var payload = buffer.slice(0, -4);
    var checksum = buffer.slice(-4);
    var newChecksum = keccak(payload);

    if (
        (checksum[0] ^ newChecksum[0]) |
        (checksum[1] ^ newChecksum[1]) |
        (checksum[2] ^ newChecksum[2]) |
        (checksum[3] ^ newChecksum[3])
    )
        return;

    return payload;
}

// Decode a base58-check encoded string to a buffer, no result if checksum is wrong
function decodeUnsafe(string) {
    var buffer = base58.decodeUnsafe(string);
    if (!buffer) return;

    return decodeRaw(buffer);
}

function decode(string) {
    var buffer = base58.decode(string);
    var payload = decodeRaw(buffer);
    if (!payload) throw new Error('Invalid checksum');
    return payload;
}

module.exports = {
    encode: encode,
    decode: decode,
    decodeUnsafe: decodeUnsafe,
};
