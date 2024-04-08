const mongoose = require('mongoose')
const shortid = require('shortid')
const Schema = mongoose.Schema;

const schema = new mongoose.Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'userDetails',
    },
    orderId: {
        type: String,
        default: shortid.generate,
        unique: true
    },
    items: [{
        productId: {
            type: Schema.Types.ObjectId,
            ref: 'productDetails',
        },
        quantity: {
            type: Number,
            required: true,
        },
        size: {
            type: String,
            required: true,
        },
        price: {
            type: Number,
            required: true,
        },

    }],
    wallet: {
        type: Number,
    },
    status: {
        type: String,
        default: "pending",
        required: true
    },
    address: {
        type: Array,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    payment: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        required: true
    },
    updated: {
        type: Date,
        required: true
    },
    return: [{
        reason: {
            type: String,
        },
        status: {
            type: String,
            default: 'Pending'
        }
    }]
})


const orderModel = new mongoose.model("orders", schema)

module.exports = orderModel