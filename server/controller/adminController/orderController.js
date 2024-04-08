const productModel = require('../../model/productModel')
const orderModel = require('../../model/orderModel')
const userModel = require('../../model/userModel')
const walletModel = require('../../model/walletModel')


const order = async (req, res) => {
    try {
        const order = await orderModel.find({}).sort({ createdAt: -1 }).populate({
            path: 'items.productId',
            select: 'name'
        })
        res.render("admin/order", { order: order })
    } catch (error) {
        console.log(error);
        res.render("user/serverError");
    }
}

const orderstatus = async (req, res) => {
    try {
        const { orderId, status } = req.body
        const updateOrder = await orderModel.updateOne({ _id: orderId }, { status: status, updated: new Date() })
        res.redirect('/admin/orders')
    } catch (error) {
        console.log(error);
        res.render("user/serverError");
    }
}

const orderReturn = async (req, res) => {
    try {
        const order = await orderModel.find({ 'return': { $exists: true, $ne: [] } }).sort({ createdAt: -1 }).populate({
            path: 'items.productId',
            select: 'name'
        })
        res.render("admin/return", { order: order })
    } catch (error) {
        console.log(error);
        res.render("user/serverError");
    }
}

const returnApprove = async (req, res) => {
    try {
        const orderId = req.params.id;
        const update = await orderModel.updateOne(
            { _id: orderId, 'return.status': 'Pending' },
            { $set: { status: 'returned', updated: new Date(), 'return.$.status': 'Accepted' } }
        );
        const order = await orderModel.findOne({ _id: orderId })
        const userId = order.userId;
        const user = await userModel.findOne({ _id: userId })
        user.wallet += order.amount
        await user.save()

        const wallet = await walletModel.findOne({ userId: userId })
        if (!wallet) {
            const newWallet = new walletModel({
                userId: userId,
                history: [
                    {
                        transaction: "Credited",
                        amount: order.amount,
                        date: new Date(),
                        reason: "Order Returned"
                    }
                ]
            })
            await newWallet.save();
        } else {
            wallet.history.push({
                transaction: "Credited",
                amount: order.amount,
                date: new Date(),
                reason: "Order Returned"
            })
            await wallet.save();
        }

        const items = order.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            size: item.size,

        }))
        for (const item of items) {
            const product = await productModel.findOne({ _id: item.productId })

            const size = product.stock.findIndex(size => size.size == item.size)
            product.stock[size].quantity += item.quantity
            product.totalstock += item.quantity
            await product.save()
        }

        res.redirect('/admin/orderReturn');
    } catch (error) {
        console.log(error);
        res.render("user/serverError");
    }
}

const returnReject = async (req, res) => {
    try {
        const orderId = req.params.id;
        const update = await orderModel.updateOne(
            { _id: orderId, 'return.status': 'Pending' },
            { $set: { 'return.$.status': 'Rejected' } }
        );
        res.redirect('/admin/orderReturn');
    } catch (error) {
        console.log(error);
        res.render("user/serverError");
    }
}

module.exports = { order, orderstatus, orderReturn, returnApprove, returnReject }