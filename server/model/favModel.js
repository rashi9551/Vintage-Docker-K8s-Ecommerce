const mongoose = require('mongoose')

const schema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'userDetails',
        required: true,
    },

    item: [{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'productDetails',
            required: true,
        },
        size: String
    }
    ],
})


const favModel = new mongoose.model("wishlist", schema)

module.exports = favModel