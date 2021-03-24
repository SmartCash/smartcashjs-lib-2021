'use strict';
Object.defineProperty(exports, '__esModule', { value: true });

function amount(amount, fee = '0') {
    fee = parseInt((parseFloat(fee) * 1000000000) / 10, 10);
    amount = parseInt((parseFloat(amount) * 1000000000) / 10, 10);
    return amount - fee;
}

exports.amount = amount;
