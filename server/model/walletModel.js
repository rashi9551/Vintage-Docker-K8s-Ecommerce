const mongoose = require('mongoose')
const schema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'userDetails'
    },

    history: [{

        transaction: {
            type: String,
            required: true,
        },
        amount: {
            type: Number,
            required: true,
        },
        date: {
            type: Date,
            required: true,
        },
        reason: {
            type: String
        }
    },
    ],

});


const walletModel = new mongoose.model("wallet", schema)

module.exports = walletModel