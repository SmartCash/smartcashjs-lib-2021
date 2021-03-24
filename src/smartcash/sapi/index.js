'use strict';
Object.defineProperty(exports, '__esModule', { value: true });

const { sumFloats } = require('./../satoshi/math');

const CryptoJS = require('crypto-js');
const smartCash = require('./../../index');
const request = require('request-promise');
const _ = require('lodash');
const LOCKED = 'pubkeyhashlocked';
//const OP_RETURN_DEFAULT = 'Sent from SmartHub.';
const MIN_FEE = 0.001;
const MIN_AMOUNT_TO_SEND = 0.001;

const random = require('random');

async function getEnabledNodes() {
    try {
        const nodes = await request.get(`https://sapi.smartcash.cc/v1/smartnode/check/ENABLED`, {
            json: true,
            cache: true,
        });
        const servers = nodes.map((node) => 'http://' + node.ip.replace(':9678', ':8080'));
        return servers;
    } catch (err) {
        console.error(err);
    }
}

async function GetSapiUrl() {
    const sapis = await getEnabledNodes();
    const electedSapi = sapis[random.int(0, sapis.length - 1)];
    console.log(`electedSapi`, electedSapi);
    return electedSapi;
}

async function createAndSendRawTransaction({
    toAddress,
    amount,
    privateKey,
    messageOpReturn,
    unspentList,
    fee,
    unlockedBalance,
    password,
    isChat,
    rsaKeyPairFromSender,
    rsaKeyPairFromRecipient,
    locked,
}) {
    if (!toAddress) {
        return {
            status: 400,
            value: 'You must provide the destination address.',
        };
    }

    if (!amount) {
        return {
            status: 400,
            value: 'You must provide the amount.',
        };
    }

    if (!privateKey) {
        return {
            status: 400,
            value: 'You must provide the private key to sign the raw transaction.',
        };
    }

    if (!password) {
        return {
            status: 400,
            value: 'You must provide the password.',
        };
    }

    if (!unspentList) {
        return {
            status: 400,
            value: 'You must provide the unspent list.',
        };
    }

    if (!unspentList.utxos) {
        return {
            status: 400,
            value: 'You must provide the UTXOs unspent list.',
        };
    }

    if (!unspentList.utxos.length === 0) {
        return {
            status: 400,
            value: 'You must provide the UTXOs unspent list.',
        };
    }

    if (!fee) {
        return {
            status: 400,
            value: 'You must provide the calculated fee.',
        };
    }

    if (!unlockedBalance) {
        return {
            status: 400,
            value: 'You must provide the unlocked balance.',
        };
    }

    if (unlockedBalance < amount + fee) {
        return {
            status: 400,
            value: 'The amount exceeds your balance!',
        };
    }

    if (amount < MIN_AMOUNT_TO_SEND) {
        return {
            status: 400,
            value: 'The amount is smaller than the minimum accepted. Minimum amount: 0.001.',
        };
    }

    try {
        const decryptedWallet = CryptoJS.enc.Utf8.stringify(CryptoJS.AES.decrypt(privateKey, password));
        let decriptKey;

        if (!decryptedWallet) decriptKey = privateKey;
        else decriptKey = decryptedWallet;

        let key = smartCash.ECPair.fromWIF(decriptKey);
        let fromAddress = key.getAddress().toString();
        let transaction = new smartCash.TransactionBuilder();
        let change = unlockedBalance - amount - fee;
        transaction.setLockTime(unspentList.blockHeight);

        //SEND TO
        transaction.addOutput(toAddress, parseFloat(smartCash.amount(amount.toString()).toString()));

        if (messageOpReturn && messageOpReturn.trim().length > 0) {
            let dataScript = null;
            if (isChat) {
                dataScript = smartCash.script.compile([
                    smartCash.opcodes.OP_RETURN,
                    Buffer.from(
                        'smart-chat: ' +
                            JSON.stringify({
                                messageFromSender: encryptTextWithRSAPublicKey(
                                    rsaKeyPairFromSender.rsaPublicKey,
                                    messageOpReturn
                                ),
                                messageToRecipient: encryptTextWithRSAPublicKey(
                                    rsaKeyPairFromRecipient.rsaPublicKey,
                                    messageOpReturn
                                ),
                            }),
                        'utf8'
                    ),
                ]);
            } else {
                //OP RETURN
                dataScript = smartCash.script.compile([smartCash.opcodes.OP_RETURN, Buffer.from(messageOpReturn, 'utf8')]);
            }

            transaction.addOutput(dataScript, 0);
        }

        if (locked) {
            //const lockTime = bip65.encode({ utc: utcNow() - 3600 * 3 });
            // const redeemScript = cltvBasicTemplate(smartCash.ECPair.fromWIF(privateKey), 5);
        }

        if (change >= fee) {
            //Change TO
            transaction.addOutput(fromAddress, parseFloat(smartCash.amount(change.toString()).toString()));
        } else {
            fee = change;
        }

        //Add unspent and sign them all
        if (!_.isUndefined(unspentList.utxos) && unspentList.utxos.length > 0) {
            unspentList.utxos.forEach((element) => {
                transaction.addInput(element.txid, element.index);
            });

            for (let i = 0; i < unspentList.utxos.length; i += 1) {
                transaction.sign(i, key);
            }
        }

        let signedTransaction = transaction.build().toHex();
        let tx = await sendTransaction(signedTransaction, isChat);

        if (tx.status === 400) {
            return {
                status: 400,
                value: tx.value,
            };
        }

        return {
            status: 200,
            value: tx.txid,
        };
    } catch (err) {
        return {
            status: 400,
            value: err.message,
        };
    }
}

function cltvBasicTemplate(ecPair, lockTime) {
    return smartCash.script.fromASM(
        `${smartCash.script.number.encode(lockTime).toString('hex')}
        OP_CHECKLOCKTIMEVERIFY
        OP_DROP
        OP_DUP
        OP_HASH160
        ${smartCash.crypto.hash160(ecPair.publicKey).toString('hex')}
        OP_EQUALVERIFY
        OP_CHECKSIG`
            .trim()
            .replace(/\s+/g, ' ')
    );
}

function getAddress(privateKey) {
    let keyPair = smartCash.ECPair.fromWIF(privateKey);
    const { address } = smartCash.payments.p2pkh({ pubkey: keyPair.publicKey });
    return address;
}

function createNewWalletKeyPair() {
    let keyPair = smartCash.ECPair.makeRandom();
    let key = keyPair.toWIF();
    let address = getAddress(key);
    return {
        privateKey: key,
        address: address,
    };
}

function createRSAKeyPair(password) {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem',
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem',
            cipher: 'aes-256-cbc',
            passphrase: password,
        },
    });
    const RSA = {
        rsaPublicKey: publicKey,
        rsaPrivateKey: privateKey,
    };
    return RSA;
}

// We must encrypt a message with the receiver PUBLIC KEY so when this person receives it
// They can decrypt with their Private Key
function encryptTextWithRSAPublicKey(rsaReceiverPublicKey, message) {
    var encMsg = crypto.publicEncrypt(rsaReceiverPublicKey, Buffer.from(message));
    return encMsg.toString('base64');
}

function decryptTextWithRSAPrivateKey(rsaPrivateKey, passphrase, encryptedMessage) {
    const privateKeyWithPassphrase = {
        key: rsaPrivateKey,
        passphrase: passphrase,
    };
    var decMsg = crypto.privateDecrypt(privateKeyWithPassphrase, Buffer.from(encryptedMessage, 'base64'));
    return decMsg.toString('utf8');
}

async function getBalance(_address) {
    try {
        const balanceResponse = await request.get(`${await GetSapiUrl()}/v1/address/balance/${_address}`, {
            json: true,
        });
        balanceResponse.balance.unlocked = balanceResponse.balance.unlocked + balanceResponse.unconfirmed.delta;
        return balanceResponse.balance;
    } catch (err) {
        console.error(err);
    }
}

async function getBalances(addresses) {
    let balances = [];

    let options = {
        method: 'POST',
        uri: `${await GetSapiUrl()}/v1/address/balances`,
        body: addresses,
        json: true,
    };

    try {
        balances = await request.post(options);

        balances = balances.map((balanceResponse) => {
            balanceResponse.balance.unlocked = balanceResponse.balance.unlocked + balanceResponse.unconfirmed.delta;
            return balanceResponse;
        });
    } catch (err) {
        balances = [];
    }
    return balances;
}

async function getTxId(_txId) {
    try {
        return await request.get(`${await GetSapiUrl()}/v1/transaction/check/${_txId}`, {
            json: true,
        });
    } catch (err) {
        console.error(err);
    }
}

async function getRewards(_address) {
    try {
        return await request.get(`${await GetSapiUrl()}/v1/smartrewards/check/${_address}`, {
            json: true,
        });
    } catch (err) {
        console.error(err);
    }
}

const UXTO_TYPE = {
    SPENDABLE: 1,
    LOCKED: 0,
    ALL: -1,
};

async function getUnspent(_address, uxtoType = UXTO_TYPE.ALL, updateLocalUnspent = false) {
    let inputs = {};

    let options = {
        method: 'POST',
        uri: `${await GetSapiUrl()}/v1/address/unspent`,
        body: {
            address: _address,
            pageNumber: 1,
            pageSize: 500,
            ascending: false,
        },
        json: true,
    };

    try {
        inputs = await request.post(options);
        if (uxtoType === UXTO_TYPE.SPENDABLE) {
            inputs.utxos = inputs.utxos.filter((input) => input.spendable === UXTO_TYPE.SPENDABLE);
        } else if (uxtoType === UXTO_TYPE.LOCKED) {
            inputs.utxos = inputs.utxos.filter((input) => input.spendable === UXTO_TYPE.LOCKED);
        }
    } catch (err) {
        inputs = {};
    }
    return inputs;
}

async function getSpendableInputs(address) {
    return await getUnspent(address, UXTO_TYPE.SPENDABLE);
}

async function getLockedInputs(address) {
    return await getUnspent(address, UXTO_TYPE.LOCKED);
}

async function getSpendableBalance(address, unspents) {
    const unspentList = unspents ? unspents : await getUnspent(address, UXTO_TYPE.SPENDABLE);
    const balance = Number(sumFloats(unspentList.utxos.map((utxo) => utxo.value)).toFixed(8));
    return Number(balance.toFixed(8));
}

async function getLockedBalance(address) {
    const unspentList = await getUnspent(address, UXTO_TYPE.LOCKED);
    const balance = Number(sumFloats(unspentList.utxos.map((utxo) => utxo.value)).toFixed(8));
    return Number(balance.toFixed(8));
}

async function getTransactionHistory(address, pageSize = 5) {
    try {
        var options = {
            method: 'POST',
            uri: `${await GetSapiUrl()}/v1/address/transactions`,
            body: {
                address,
                pageNumber: 1,
                pageSize,
            },
            json: true, // Automatically stringifies the body to JSON
        };
        return await request.post(options).then((res) => res.data);
    } catch (err) {
        console.error(err);
    }
}

async function getChatTransactionHistory(address, pageSize = 5) {
    try {
        var options = {
            method: 'POST',
            uri: `https://sapi.smartcash.cc/v1/address/transactions`,
            body: {
                address,
                pageNumber: 1,
                pageSize,
            },
            json: true, // Automatically stringifies the body to JSON
        };
        return await request.post(options).then((res) => res.data);
    } catch (err) {
        console.error(err);
    }
}
async function getTransactionHistoryFromMemoryPool(address) {
    try {
        const transactions = await request.get(
            `https://sapi.smartcash.cc/v1/address/mempool/SX7SyErLpXjhsq3wAvqxLaE9FDZF5Dbokn`,
            {
                json: true,
            }
        );
        const mappedTx = await Promise.all(
            transactions.map(async (transaction) => {
                const tx = await getTxId(transaction.txid);
                tx.address = address;
                tx.message = getOpReturnMessage(tx);
                tx.direction = getTransactionDirection(tx, address);
                tx.time = parseInt(new Date().getTime() / 1000);
                return tx;
            })
        );
        return mappedTx;
    } catch (err) {
        console.error(err);
    }
}

function getTransactionDirection(tx, address) {
    if (tx && tx.vin && tx.vin[0].coinbase) {
        return 'Coinbase';
    } else {
        if (tx && tx.vin && tx.vin[0].scriptPubKey && tx.vin[0].scriptPubKey.addresses) {
            if (
                tx.vin.some(
                    (vin) => vin && vin.scriptPubKey && vin.scriptPubKey.addresses && vin.scriptPubKey.addresses.includes(address)
                )
            )
                return 'Sent';
        }
        return 'Received';
    }
}

async function getTransactionHistoryGroupedByAddresses(address) {
    try {
        const history = await getChatTransactionHistory(address, 50);
        /*
        const memoryPool = await getTransactionHistoryFromMemoryPool(address);
        const histories = [...history, ...memoryPool];
        console.log(`memoryPool`, memoryPool);
        console.log(`histories`, histories);*/

        const mappedHistory = await Promise.all(
            history.map(async (tx) => {
                var msg = getOpReturnMessage(tx);

                if (!tx.time) {
                    tx.amount = 0;
                    tx.blockhash = '';
                    tx.address = address;
                    tx.message = msg;
                    tx.direction = getTransactionDirection(tx, address);
                    tx.time = parseInt(new Date().getTime() / 1000);
                }

                return tx;
            })
        );
        return groupByAddress([...new Set(mappedHistory)]);
    } catch (err) {
        console.error(err);
    }
}

function isLockedTransaction(tx, address) {
    try {
        return (
            tx &&
            tx.vout &&
            tx.vout.find(
                (f) =>
                    f.scriptPubKey &&
                    f.scriptPubKey.addresses &&
                    f.scriptPubKey.addresses.includes(address) &&
                    f.scriptPubKey.type &&
                    f.scriptPubKey.type === LOCKED
            )
        );
    } catch (err) {
        console.error(err);
        return false;
    }
}

function getOpReturnMessage(tx) {
    try {
        if (tx && tx.vout) {
            const outWithOpReturn = tx.vout.find(
                (f) => f.scriptPubKey && f.scriptPubKey.asm && f.scriptPubKey.asm.includes('OP_RETURN')
            );
            if (outWithOpReturn && outWithOpReturn.scriptPubKey && outWithOpReturn.scriptPubKey.asm) {
                const message = outWithOpReturn.scriptPubKey.asm.toString().replace('OP_RETURN ', '');
                if (message) {
                    const convert = (from, to) => (str) => Buffer.from(str, from).toString(to);
                    const hexToUtf8 = convert('hex', 'utf8');
                    const decodedMessage = hexToUtf8(message);
                    return decodedMessage.replace('smart-chat: ', '');
                }
            }
        }
        return '';
    } catch (err) {
        console.error(err);
        return '';
    }
}

function groupByAddress(txs) {
    try {
        let parsedTransactions = txs
            .map((tx) => getAddressAndMessage(tx))
            .filter((f) => f !== null)
            .sort((a, b) => (a.time > b.time ? 1 : -1));

        let uniqueTransactions = _.uniq(parsedTransactions.map((t) => JSON.stringify(t)));

        parsedTransactions = uniqueTransactions.map((t) => JSON.parse(t)).sort((a, b) => (a.time > b.time ? 1 : -1));

        var grouped = _(parsedTransactions)
            .groupBy('toAddress')
            .map(function(messages, key) {
                return {
                    chatAddress: key,
                    messages: messages,
                };
            })
            .value();
        return grouped;
    } catch (err) {
        console.error(err);
        return [];
    }
}

function getAddressAndMessage(tx) {
    let transaction = {};
    transaction.fromAddress = tx.address;
    transaction.direction = tx.direction;
    transaction.time = tx.time;
    try {
        if (tx && tx.vout) {
            if (tx.direction === 'Sent') {
                const outAddress = tx.vout.find(
                    (f) =>
                        f.scriptPubKey &&
                        f.scriptPubKey.addresses &&
                        f.scriptPubKey.addresses.length > 0 &&
                        !f.scriptPubKey.addresses.includes(tx.address)
                );

                if (outAddress) {
                    const address = outAddress.scriptPubKey.addresses[0];
                    transaction.toAddress = address;
                }
            } else {
                const input = tx.vin[0];
                if (input) {
                    const inputAddress = input.scriptPubKey.addresses[0];
                    transaction.toAddress = inputAddress;
                }
            }

            const outWithOpReturn = tx.vout.find(
                (f) => f.scriptPubKey && f.scriptPubKey.asm && f.scriptPubKey.asm.includes('OP_RETURN')
            );
            if (outWithOpReturn) {
                const message = outWithOpReturn.scriptPubKey.asm.toString().replace('OP_RETURN ', '');

                if (message) {
                    const convert = (from, to) => (str) => Buffer.from(str, from).toString(to);
                    const hexToUtf8 = convert('hex', 'utf8');
                    const decodedMessage = hexToUtf8(message);
                    transaction.message = decodedMessage.replace('smart-chat: ', '');
                } else {
                    return null;
                }
            } else {
                return null;
            }
        }
        if (!transaction.toAddress) return null;
    } catch (err) {
        console.error(err);
        return '';
    }
    return transaction;
}

async function getSmallestUnspentInput({ unspentList }) {
    if (!unspentList) {
        return {
            status: 400,
            value: 'You must provide the unspent list.',
        };
    }

    if (!unspentList.utxos) {
        return {
            status: 400,
            value: 'You must provide the UTXOs unspent list.',
        };
    }

    if (!unspentList.utxos.length === 0) {
        return {
            status: 400,
            value: 'You must provide the UTXOs unspent list.',
        };
    }

    const unspentAux = unspentList;

    // get the smallest unspent to activate a transaction
    unspentAux.utxos = [_.minBy(unspentList.utxos.filter((w) => w.value > MIN_AMOUNT_TO_SEND + MIN_FEE), 'value')];
    return unspentAux;
}

async function activateRewards({ toAddress, unspentList, privateKey, password }) {
    let minUnspentList = await getSmallestUnspentInput({ unspentList });

    // Should return an ERROR if it has no unspent
    if (minUnspentList.status && minUnspentList.status === 400) {
        return minUnspentList;
    }

    let calculateUTXOAmountLessFee = 0;
    let unlockedBalance = 0;

    calculateUTXOAmountLessFee = minUnspentList.utxos[0].value - MIN_FEE;
    unlockedBalance = minUnspentList.utxos[0].value;

    const tx = await createAndSendRawTransaction({
        toAddress,
        fee: MIN_FEE,
        amount: calculateUTXOAmountLessFee,
        unlockedBalance,
        privateKey,
        unspentList: minUnspentList,
        password,
    });

    console.log(`activation-tx`, tx);

    return tx;
}

async function sendTransaction(hex, isChat) {
    //Chat needs the same NODE always to get MEM POOL transactions
    const url = isChat ? 'https://sapi.smartcash.cc' : await GetSapiUrl();
    var options = {
        method: 'POST',
        uri: `${url}/v1/transaction/send`,
        body: {
            data: `${hex}`,
            instantpay: false,
            overrideFees: false,
        },
        json: true, // Automatically stringifies the body to JSON
    };

    try {
        return await request.post(options);
    } catch (err) {
        return {
            status: 400,
            value: err.error[0].message,
        };
    }
}

async function calculateFee(listUnspent, messageOpReturn) {
    if (!listUnspent || listUnspent.length === 0) return MIN_FEE;
    let countUnspent = listUnspent.length;

    let newFee =
        0.001 *
        Math.round(
            1.27 +
                (countUnspent * 148 +
                    2 * 34 +
                    10 +
                    9 +
                    (messageOpReturn ? messageOpReturn.length : 0)) /*OP_RETURN_DEFAULT.length*/ /
                    1024
        );

    return newFee;
}

function roundUp(num, precision) {
    precision = Math.pow(10, precision);
    return Math.ceil(num * precision) / precision;
}

async function getSmartRewardsRoi() {
    let options = {
        method: 'GET',
        uri: `${await GetSapiUrl()}/v1/smartrewards/roi`,
        json: true,
    };
    return request.get(options);
}

async function getSmartNodeRoi() {
    let options = {
        method: 'GET',
        uri: `${await GetSapiUrl()}/v1/smartnode/roi`,
        json: true,
    };
    return request.get(options);
}

async function getNodesUrl() {
    try {
        var options = {
            method: 'GET',
            uri: `https://${await GetSapiUrl()}/v1/smartnode/check/ENABLED`,
            json: true, // Automatically stringifies the body to JSON
        };

        let retorno;
        await request.get(options).then((res) => (retorno = res));
        console.log(retorno);
        return retorno;
    } catch (err) {
        console.error(err);
    }
}

function getSupportedCurrencies() {
    let options = {
        method: 'GET',
        uri: `https://api.coingecko.com/api/v3/simple/supported_vs_currencies`,
        json: true,
    };
    return request.get(options);
}

function getCurrenciePrice({ vs_currencies = 'usd,btc' }) {
    let options = {
        method: 'GET',
        uri: `https://api.coingecko.com/api/v3/simple/price?ids=smartcash&vs_currencies=${vs_currencies}`,
        json: true,
    };
    return request.get(options);
}

module.exports = {
    getCurrenciePrice: getCurrenciePrice,
    getSupportedCurrencies: getSupportedCurrencies,
    getNodesUrl: getNodesUrl,
    getSmartNodeRoi: getSmartNodeRoi,
    roundUp: roundUp,
    calculateFee: calculateFee,
    sendTransaction: sendTransaction,
    activateRewards: activateRewards,
    getAddressAndMessage: getAddressAndMessage,
    groupByAddress: groupByAddress,
    getOpReturnMessage: getOpReturnMessage,
    isLockedTransaction: isLockedTransaction,
    getTransactionHistoryGroupedByAddresses: getTransactionHistoryGroupedByAddresses,
    getTransactionDirection: getTransactionDirection,
    getTransactionHistoryFromMemoryPool: getTransactionHistoryFromMemoryPool,
    getChatTransactionHistory: getChatTransactionHistory,
    getTransactionHistory: getTransactionHistory,
    getLockedBalance: getLockedBalance,
    getSpendableBalance: getSpendableBalance,
    getLockedInputs: getLockedInputs,
    getSpendableInputs: getSpendableInputs,
    getUnspent: getUnspent,
    UXTO_TYPE: UXTO_TYPE,
    getRewards: getRewards,
    getTxId: getTxId,
    getBalances: getBalances,
    getBalance: getBalance,
    decryptTextWithRSAPrivateKey: decryptTextWithRSAPrivateKey,
    encryptTextWithRSAPublicKey: encryptTextWithRSAPublicKey,
    createRSAKeyPair: createRSAKeyPair,
    createNewWalletKeyPair: createNewWalletKeyPair,
    getAddress: getAddress,
    createAndSendRawTransaction: createAndSendRawTransaction,
    GetSapiUrl: GetSapiUrl,
    getEnabledNodes: getEnabledNodes,
};
