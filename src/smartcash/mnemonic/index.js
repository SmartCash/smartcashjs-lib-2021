'use strict';
Object.defineProperty(exports, '__esModule', { value: true });

const { bip32, ECPair } = require('./../../index');

const Mnemonic = require('bitcore-mnemonic');
const bitcoinjsBip38 = require('bip38');
const { getAddressFromKeyPair } = require('../keypair');
const { smartcash: smartCashMainNetwork } = require('../../networks');

function getBIP32HDKeyPair({ words, passphrase }) {
    var mnemonic = new Mnemonic(words);
    const seed = mnemonic.toSeed(passphrase);
    const fromSeed = bip32.fromSeed(seed, smartCashMainNetwork);
    return fromSeed;
}

function getDerivationPaths() {
    const purpose = 44;
    const coin = 224;
    const account = 0;
    const change = 0;
    let path = 'm/';
    path += purpose + "'/";
    path += coin + "'/";
    path += account + "'/";
    path += change;
    const BIP44DerivationPath = path;
    const BIP32DerivationPath = 'm/0';

    return {
        BIP44DerivationPath: BIP44DerivationPath,
        BIP32DerivationPath: BIP32DerivationPath,
    };
}

function getBIP32ExtendedKey({ words, passphrase, derivationPath }) {
    let extendedKey = getBIP32HDKeyPair({ words: words, passphrase: passphrase });
    return extendedKey.derivePath(derivationPath);
}

function getAddressesFromDerived({ start = 0, total = 10, extendedKey, derivationPath }) {
    const addresses = [];
    for (var i = 0; i < total; i++) {
        var index = i + start;
        addresses.push(new calcAddressesFromDerived({ index: index, extendedKey: extendedKey, derivationPath: derivationPath }));
    }
    return addresses;
}

function calcAddressesFromDerived({
    index,
    useHardenedAddresses = false,
    useBip38 = false,
    bip38password = '',
    extendedKey,
    derivationPath,
}) {
    // derive HDkey for this row of the table
    var key = 'NA';
    if (useHardenedAddresses) {
        key = extendedKey.deriveHardened(index);
    } else {
        key = extendedKey.derive(index);
    }
    // bip38 requires uncompressed keys
    // see https://github.com/iancoleman/bip39/issues/140#issuecomment-352164035
    var keyPair = key;
    var useUncompressed = useBip38;
    if (useUncompressed) {
        keyPair = new ECPair(keyPair.d);
    }
    // get address
    var address = getAddressFromKeyPair(keyPair);
    // get privkey
    var hasPrivkey = !key.isNeutered();
    var privkey = 'NA';
    if (hasPrivkey) {
        privkey = keyPair.privateKey;
        // BIP38 encode private key if required
        if (useBip38) {
            privkey = bitcoinjsBip38.encrypt(keyPair.d.toBuffer(), false, bip38password, function(p) {
                console.log('Progressed ' + p.percent.toFixed(1) + '% for index ' + index);
            });
        }
    }
    // get pubkey
    var pubkey = keyPair.publicKey.toString('hex');
    var indexText = derivationPath + '/' + index;
    if (useHardenedAddresses) {
        indexText = indexText + "'";
    }

    // console.log(`derivationPath`, { indexText, address, pubkey, privkey });

    return { indexText, address, pubkey, privkey: keyPair.toWIF() };
}

function generatePhrase() {
    const mnemonic = new Mnemonic();
    return mnemonic.toString();
}

function validatePhrase({ words }) {
    return Mnemonic.isValid(words);
}

function getFromDerivationPaths({ words, passphrase }) {
    const bip44ExtendedKey = getBIP32ExtendedKey({
        words: words,
        passphrase: passphrase,
        derivationPath: getDerivationPaths().BIP44DerivationPath,
    });
    const bip32ExtendedKey = getBIP32ExtendedKey({
        words: words,
        passphrase: passphrase,
        derivationPath: getDerivationPaths().BIP32DerivationPath,
    });
    return {
        BIP_44: {
            bip44ExtendedKey: bip44ExtendedKey,
            xPrivateKey: bip44ExtendedKey.toBase58(),
            xPublicKey: bip44ExtendedKey.neutered().toBase58(),
            addresses: getAddressesFromDerived({
                extendedKey: bip44ExtendedKey,
                derivationPath: getDerivationPaths().BIP44DerivationPath,
            }),
        },
        BIP_32: {
            bip32ExtendedKey: bip32ExtendedKey,
            xPrivateKey: bip32ExtendedKey.toBase58(),
            xPublicKey: bip32ExtendedKey.neutered().toBase58(),
            addresses: getAddressesFromDerived({
                extendedKey: bip32ExtendedKey,
                derivationPath: getDerivationPaths().BIP32DerivationPath,
            }),
        },
    };
}

exports.getFromDerivationPaths = getFromDerivationPaths;
exports.validatePhrase = validatePhrase;
exports.generatePhrase = generatePhrase;
