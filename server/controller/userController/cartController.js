const productModel = require("../../model/productModel");
const catModel = require("../../model/categModel");
const cartModel = require("../../model/cartModel");
const mongoose = require('mongoose')
const flash = require('express-flash')

const showcart = async (req, res) => {
    try {
        const id = req.session.userId;
        const sessionId = req.session.id;
        const categories = await catModel.find();
        let cart;
        if (id) {
            cart = await cartModel.findOne({ userId: id }).populate({
                path: "item.productId",
                select: "name stock image",
            });
        } else {
            cart = await cartModel.findOne({ sessionId }).populate({
                path: "item.productId",
                select: "name stock image",
            });
        }
        
        if (!cart || !cart.item) {
            cart = new cartModel({
                sessionId: req.session.id,
                item: [],
                total: 0
            });
        }
        
        const insufficientStock = [];
        for (const cartItem of cart.item) {
            const product = cartItem.productId;
            const size = product.stock.findIndex((s) => s.size == cartItem.size);
            if (product.stock[size].quantity < cartItem.quantity) {
                insufficientStock.push({
                    item: cartItem,
                    availableQuantity: size !== -1 ? product.stock[size].quantity : 0,
                });
            }
        }
        const result = await cartModel.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(id) } },
            { $unwind: '$item' },
            { $group: { _id: null, itemCount: { $sum: 1 } } },
        ])
        if (result.length > 0) {
            const itemCount = result[0].itemCount;
            req.session.cartCount = itemCount;
        } 
        if(result.length===0){
            req.session.cartCount=0;
        }
        req.session.checkout = true;
        const nostock = req.flash('nostock')
        const itemCount = req.session.cartCount;
        res.render("user/cart", { cart, insufficientStock, categories, nostock, itemCount });
    } catch (error) {
        console.log(error);
        res.render("user/serverError");
    }
};

const addcart = async (req, res) => {
    try {
        const selectedSize = req.body.size;
        const pid = req.params.id;
        const product = await productModel.findOne({ _id: pid });
        const userId = req.session.userId;
        const price = product.discountPrice;
        const stock = await productModel.findOne({
            _id: pid,
            "stock.size": selectedSize,
        });
        const selectedStock = stock.stock.find((item) => item.size == selectedSize);
        const quantity = 1;

        if (selectedStock.quantity === 0) {
            req.flash('nostock', 'No stock Found')
            res.redirect("/cart");
        } else {
            let cart;

            if (userId) {
                cart = await cartModel.findOne({ userId });
            }

            if (!cart) {
                cart = await cartModel.findOne({ sessionId: req.session.id });
            }

            if (!cart) {
                cart = new cartModel({
                    sessionId: req.session.id,
                    item: [],
                    total: 0,
                });
            }

            const productExist = cart.item.findIndex(
                (item) => item.productId == pid && item.size === selectedSize
            );

            if (productExist !== -1) {
                cart.item[productExist].quantity += 1;
                cart.item[productExist].total =
                    cart.item[productExist].quantity * price;
            } else {
                const newItem = {
                    productId: pid,
                    quantity: quantity,
                    size: selectedSize,
                    price: price,
                    stock: selectedStock.quantity,
                    total: quantity * price,
                };
                cart.item.push(newItem);
            }

            if (userId && !cart.userId) {
                cart.userId = userId;
            }

            cart.total = cart.item.reduce((acc, item) => acc + item.total, 0);
            await cart.save();
            res.redirect("/cart");
        }
    } catch (err) {
        console.log(err);
        res.render("user/serverError");
    }
};

const updateCart = async (req, res) => {
    try {
        const { productId, size } = req.params;
        const { action, cartId } = req.body;
        const cart = await cartModel.findOne({ _id: cartId });
        const itemIndex = cart.item.findIndex(
            (item) => item._id == productId && item.size == size
        );
        const currentQuantity = cart.item[itemIndex].quantity;
        const stockLimit = cart.item[itemIndex].stock;
        const price = cart.item[itemIndex].price;
        const opid = cart.item[itemIndex].productId;
        const product = await productModel.findOne({ _id: opid });
        const selectedinfo = product.stock.findIndex((stock) => stock.size == size);
        const stockLimit2 = product.stock[selectedinfo].quantity;
        let updatedQuantity;

        if (action == "1") {
            updatedQuantity = currentQuantity + 1;
        } else if (action == "-1") {
            updatedQuantity = currentQuantity - 1;
        } else {
            return res.status(400).json({ success: false, error: "Invalid action" });
        }

        if (updatedQuantity > stockLimit2 && action == "1") {
            return res
                .status(400)
                .json({ success: false, error: "Quantity exceeds stock limits" });
        } else if (updatedQuantity == 0) {
            return res
                .status(400)
                .json({ success: false, error: "Quantity cannot be zero" });
        }
        cart.item[itemIndex].quantity = updatedQuantity;

        const newProductTotal = price * updatedQuantity;
        cart.item[itemIndex].total = newProductTotal;
        await cart.save();
        const total = cart.item.reduce((acc, item) => acc + item.total, 0);
        cart.total = total;
        await cart.save();
        res.json({
            success: true,
            newQuantity: updatedQuantity,
            newProductTotal,
            total: total,
        });
    } catch (error) {
        console.error("Error updating cart quantity:", error);
        res.redirect("/error");
    }
};

const deleteCart = async (req, res) => {
    try {
        const userId = req.session.userId;
        const pid = req.params.id;
        const size = req.params.size;

        const result = await cartModel.updateOne(
            { userId: userId },
            { $pull: { item: { _id: pid, size: size } } }
        );

        const updatedCart = await cartModel.findOne({ userId: userId });
        const newTotal = updatedCart.item.reduce(
            (acc, item) => acc + item.total,
            0
        );
        updatedCart.total = newTotal;
        await updatedCart.save();
        res.redirect("/cart");
    } catch (error) {
        console.error("Error updating cart quantity:", error);
        res.redirect("/error");
    }
};

module.exports = { showcart, addcart, updateCart, deleteCart };
