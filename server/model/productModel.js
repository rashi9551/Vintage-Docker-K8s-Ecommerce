const mongoose = require('mongoose')

const productSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true
        },
        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'categories',
            required: true,
        },
        description: {
            type: String,
            required: true
        },
        price: {
            type: Number,
            required: true
        },
        discount: {
            type: Number,
            required: true
        },
        discountPrice: {
            type: Number,
            required: true
        },
        stock: [{
            size: {
                type: String,
                required: true,
            },
            quantity: {
                type: Number,
                required: true,
            },
        }],
        totalstock: {
            type: Number,
            required: true,
        },
        image: {
            type: Array,
            required: true,
        },
        status: {
            type: Boolean,
            default: true,
        }
    }
)

const productModel = new mongoose.model('productDetails', productSchema)

module.exports = productModel; 