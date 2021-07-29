//const { fromBase58Check } = require('./src/address');
//const { hash160 } = require('./src/crypto');
//const smartCash = require('./src/index');
//const { mnemonic } = require('./src/index');
const { decode } = require('./src/smartcash/bs58smartcheck');
const { hash160, ripemd160 } = require('./src/crypto');
const { decodeUnsafe } = require('bs58');
const { fromBase58Check } = require('./src/address');
const { getSpendableInputs, createAndSendRawTransaction, getBalance } = require('./src/smartcash/sapi');

// pay correctly!!!
console.log(fromBase58Check("SNxFyszmGEAa2n2kQbzw7gguHa5a4FC7Ay").hash.toString('hex'))



//return;

//criar nova wallet
/*
const keyPair = smartCash.ECPair.makeRandom();
const { address } = smartCash.payments.p2pkh({ pubkey: keyPair.publicKey });
console.log(address, keyPair.toWIF());
console.log(`publicKey`, keyPair.publicKey.toString('hex'));
console.log(`decoded address`, decode(address).toString('hex'));
console.log(`HASH 160 decoded address`, hash160(decode(address)).toString('hex'));
console.log(`decoded address fromBase58Check`, fromBase58Check(address).hash.toString('hex'));
console.log(`HASH 160 fromBase58Check`, hash160(fromBase58Check(address).hash).toString('hex'));
*/
/*
const TEST_PHRASE = 'grape front option already anxiety mixed public bulb final expose chef traffic';
console.log(mnemonic.generatePhrase());
console.log(mnemonic.validatePhrase({ words: TEST_PHRASE }));
console.log(JSON.stringify(mnemonic.getFromDerivationPaths({ words: TEST_PHRASE })));
*/

async function submitSendAmount() {
    // You must get the latest unspent from the NODE
    const unspent = await getSpendableInputs(`SW9bjKVgow8dfSKqe56e4A7Y9ka3KVjP23`);

    const balance = await getBalance(`SW9bjKVgow8dfSKqe56e4A7Y9ka3KVjP23`);

    console.log(balance);

    await createAndSendRawTransaction({
        toAddress: `SdTbBZADiCSpr736oAVVQH8hWtEHjE9GVN`,
        amount: Number(Number(0.3).toFixed(8)),
        privateKey: `VPwKhfTohBqspTweuVM6xyGb7QPLgu5LtQqUC5ViyfBF7inekBhY`,
        messageOpReturn: `testing locked`,
        unspentList: unspent,
        fee: 0.002,
        unlockedBalance: balance.unlocked,
        password: `0`,
        locked: true,
    })
        .then((data) => {
            if (!data) {
                console.log('Something wrong with trying to send the transaction');
            }

            if (data && data.status === 400) {
                console.log(data.value);
            }

            if (data && data.status === 200) {
                console.log(data?.value);
            }
        })
        .catch((error) => console.error(error[0]?.message))
        .finally(() => console.info(`Locked transaction called`));
}


async function submitSendAmountLocked() {
    // You must get the latest unspent from the NODE
    const unspent = await getSpendableInputs(`8STEweupHZj4VBEz2PEREWfPrKp6UQbppe`);

    const balance = await getBalance(`8STEweupHZj4VBEz2PEREWfPrKp6UQbppe`);

    console.log(balance);

    await createAndSendRawTransaction({
        toAddress: `SW9bjKVgow8dfSKqe56e4A7Y9ka3KVjP23`,
        amount: Number(Number(0.05).toFixed(8)),
        privateKey: `VHr9d2UmcTt3BPsiFmc5MiULNWPSpNgMmP1iprTYC3SHs5HDb2RL`,
        messageOpReturn: `testing locked`,
        unspentList: unspent,
        fee: 0.002,
        unlockedBalance: balance.unlocked,
        password: `0`,
        locked: false,
    })
        .then((data) => {
            if (!data) {
                console.log('Something wrong with trying to send the transaction');
            }

            if (data && data.status === 400) {
                console.log(data.value);
            }

            if (data && data.status === 200) {
                console.log(data?.value);
            }
        })
        .catch((error) => console.error(error[0]?.message))
        .finally(() => console.info(`Locked transaction called`));
}

submitSendAmount();
