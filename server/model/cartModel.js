const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'userDetails'
    },
    sessionId: String,
    item: [
        {
            productId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'productDetails',
                required: true
            },
            stock: {
                type: String,
                required: true,
            },
            quantity: {
                type: Number,
                required: true
            },
            size: {
                type: String,
                required: true
            },
            price: {
                type: Number,
                required: true
            },
            total: {
                type: Number,
                required: true
            },
        }
    ],
    total: Number,
}, { strictPopulate: false });

const cartModel = mongoose.model('cart', cartSchema);

module.exports = cartModel;