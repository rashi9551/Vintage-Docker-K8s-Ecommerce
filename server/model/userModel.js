const mongoose = require('mongoose')

const userSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true,
            unique: true
        },
        phone: {
            type: String,
            required: true
        },
        password: {
            type: String,
            required: true
        },
        isAdmin: {
            type: Boolean,
            required: true,
            default: false
        },
        blocked: {
            type: Boolean,
            required: true,
            default: false
        },
        wallet: {
            type: Number,
            default: 0
        },
        usedCoupons: [{
            type: String
        }]
    }
)

const userModel = new mongoose.model('userDetails', userSchema)

module.exports = userModel;  