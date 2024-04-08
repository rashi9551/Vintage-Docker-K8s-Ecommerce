const userModel = require('../../model/userModel')
const cartModel = require('../../model/cartModel')
const productModel = require('../../model/productModel')
const addressModel = require('../../model/addressModel')
const orderModel = require('../../model/orderModel')
const catModel = require('../../model/categModel')
const walletModel = require('../../model/walletModel')
const couponModel = require('../../model/couponModel')
const mongoose = require('mongoose')
const Razorpay = require('razorpay');

var instance = new Razorpay({
  key_id: process.env.KEY_ID,
  key_secret: process.env.KEY_SECRET,
});



const checkout = async (req, res) => {
  try {
    const userId = req.session.userId;
    req.session.checkoutSave = true;
    const categories = await catModel.find()
    const address = await addressModel.findOne({ userId: userId })
    const data = await cartModel.findOne({ userId }).populate({
      path: 'item.productId',
      select: 'name image'
    })
    for (const cartItem of data.item || []) {
      const pro = cartItem.productId;
      const product = await productModel.findOne({ _id: pro._id })
      const size = product.stock.findIndex(s => s.size == cartItem.size);
      if (product.stock[size].quantity < cartItem.quantity) {
        console.log('Selected quantity exceeds available stock for productId:', product._id);
        return res.redirect('/cart');
      }
    }
    if (data.item.length == 0) {
      return res.redirect('/cart')
    }
    const user = await userModel.findById(userId)
    const availableCoupons = await couponModel.find({
      couponCode: { $nin: user.usedCoupons },
      status: true,
    });
    const itemCount = req.session.cartCount;
    res.render('user/checkout', { data: data, address: address, availableCoupons, categories, itemCount })
  } catch (error) {
    console.log(error);
    res.render("user/serverError");
  }
}

const order = async (req, res) => {
  try {
    const categories = await catModel.find()
    const { address, pay } = req.body
    let wallet = parseInt(req.body.wallet)
    let amount = parseInt(req.body.amount);
    console.log(typeof amount, typeof wallet); // Log type of amount
    const userId = req.session.userId;
    const cart = await cartModel.findOne({ userId: userId })
    const useraddress = await addressModel.findOne({ userId: userId })
    const selectedaddress = useraddress.address[address]
    const items = cart.item.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      size: item.size,
      price: item.price,
    }))
    for (const item of items) {
      const product = await productModel.findOne({ _id: item.productId })
      const size = product.stock.findIndex(size => size.size == item.size)
      product.stock[size].quantity -= item.quantity
      product.totalstock -= item.quantity;
      await product.save()
    }
    let order;
    if (pay == "paymentPending") {
      order = new orderModel({
        userId: userId,
        items: items,
        amount: amount,
        wallet: wallet,
        status: "paymentPending",
        payment: pay,
        address: selectedaddress,
        createdAt: new Date(),
        updated: new Date()
      })
    } else {
      order = new orderModel({
        userId: userId,
        items: items,
        amount: amount,
        wallet: wallet,
        payment: pay,
        address: selectedaddress,
        createdAt: new Date(),
        updated: new Date()
      })
    }
    cart.item = []
    cart.total = 0
    if (wallet > 0) {
      const userWallet = await walletModel.findOne({ userId: userId })
      userWallet.history.push({
        transaction: "Debited",
        amount: wallet,
        date: new Date(),
        reason: "Product Purchased"
      })
      await userWallet.save();
      const user = await userModel.findOne({ _id: userId })
      user.wallet -= wallet;
      await user.save();

    }
    const savedOrder = await order.save()
    await cart.save()
    req.session.orderId = savedOrder.orderId;
    res.redirect('/confirmPage')
  } catch (error) {
    console.log(error);
    res.render("user/serverError");
  }
}

const upi = async (req, res) => {
  var options = {
    amount: req.body.amount,
    currency: "INR",
    receipt: "order_rcpt"
  };
  instance.orders.create(options, function (err, order) {
    res.send({ orderId: order.id })
  })
}

const wallet = async (req, res) => {
  try {
    const amount = req.body.amount
    const user = await userModel.findOne({ _id: req.session.userId })
    console.log(typeof user.wallet)
    if (user.wallet >= amount) {
      res.json({ success: true })
    }
    else {
      res.json({ success: false, amount: user.wallet })
    }
  } catch (error) {
    console.log(error);
    res.render("user/serverError");
  }
}

const applyCoupon = async (req, res) => {
  try {
    const { couponCode, subtotal } = req.body;
    const userId = req.session.userId;
    const coupon = await couponModel.findOne({ couponCode: couponCode });
    if (coupon && coupon.status === true) {
      const user = await userModel.findById(userId);

      if (user && user.usedCoupons.includes(couponCode)) {
        res.json({ success: false, message: "Already Redeemed" });
      } else if (
        coupon.expiry > new Date() &&
        coupon.minimumPrice <= subtotal
      ) {
        console.log("Coupon is valid");
        let dicprice;
        let price;
        if (coupon.type === "percentageDiscount") {
          dicprice = (subtotal * coupon.discount) / 100;
          if (dicprice >= coupon.maxRedeem) {
            dicprice = coupon.maxRedeem;
          }
          price = subtotal - dicprice;
        } else if (coupon.type === "flatDiscount") {
          dicprice = coupon.discount;
          price = subtotal - dicprice;
        }
        await userModel.findByIdAndUpdate(
          userId,
          { $addToSet: { usedCoupons: couponCode } },
          { new: true }
        );
        res.json({ success: true, dicprice, price });
      } else {
        res.json({ success: false, message: "Invalid Coupon" });
      }
    } else {
      res.json({ success: false, message: "Coupon not found" });
    }
  } catch (err) {
    console.error(err);
    res.render("users/serverError")
  }
};
const revokeCoupon = async (req, res) => {
  try {
    const { couponCode, subtotal } = req.body;
    const userId = req.session.userId;
    const coupon = await couponModel.findOne({ couponCode: couponCode });

    if (coupon) {
      const user = await userModel.findOne({ userId: userId });
      if (coupon.expiry > new Date() && coupon.minimumPrice <= subtotal) {
        console.log("Coupon is valid");
        const dprice = (subtotal * coupon.discount) / 100;
        const dicprice = 0;

        const price = subtotal;
        console.log(price);

        await userModel.findByIdAndUpdate(
          userId,
          { $pull: { usedCoupons: couponCode } },
          { new: true }
        );
        res.json({ success: true, dicprice, price });
      } else {
        res.json({ success: false, message: "Invalid Coupon" });
      }
    } else {
      res.json({ success: false, message: "coupon not found" });
    }
  } catch (error) {
    console.log(error);
    res.render("user/serverError")
  }
};

const confirmPage = async (req, res) => {
  try {
    const categories = await catModel.find()
    const orderconfirmation = await orderModel.findOne({ orderId: req.session.orderId }).populate({
      path: 'items.productId',
      select: 'name'
    })
    req.session.cartCount = 0;
    const itemCount = req.session.cartCount;
    res.render('user/thankyou', { order: orderconfirmation, categories, itemCount })
  } catch (error) {
    console.log(error);
    res.render("user/serverError")
  }
}

module.exports = { checkout, order, upi, wallet, applyCoupon, revokeCoupon, confirmPage }
