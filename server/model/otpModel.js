const mongoose = require('mongoose')

const otpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    otp: {
        type: Number,
        required: true
    },
    expiry: {
        type: Date,
        required: true
    }
})

const otpModel = new mongoose.model('otpDetails', otpSchema)

module.exports = otpModel