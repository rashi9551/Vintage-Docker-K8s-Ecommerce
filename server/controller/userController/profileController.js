const userModel = require('../../model/userModel')
const cartModel = require('../../model/cartModel')
const productModel = require('../../model/productModel')
const addressModel = require('../../model/addressModel')
const orderModel = require('../../model/orderModel')
const catModel = require('../../model/categModel')
const walletModel = require('../../model/walletModel')
const couponModel=require('../../model/couponModel')
const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const flash = require('express-flash')
const Razorpay = require('razorpay')
const fs = require('fs');
const path = require('path');
const easyinvoice = require('easyinvoice')


const order = async (req, res) => {
    const categories = await catModel.find();
    const userId = req.session.userId;
    try {
        const orders = await orderModel
            .find({ userId: userId })
            .sort({ createdAt: -1 })
            .populate({
                path: 'items.productId',
                select: 'name image _id',
            })
            .exec();
        const itemCount = req.session.cartCount;
        res.render('user/orders', { orders: orders, categories: categories, itemCount });
    } catch (error) {
        console.log(error)
        res.render('user/serverError')
    }
}

const ordercancelling = async (req, res) => {
    try {
        const id = req.params.id
        const update = await orderModel.updateOne({ _id: id }, { status: "Cancelled", updated: new Date() })
        const result = await orderModel.findOne({ _id: id })

        if (result.payment == 'upi' || result.payment == 'wallet') {
            const userId = req.session.userId
            const user = await userModel.findOne({ _id: userId })
            console.log(result.amount)
            user.wallet += parseInt(result.amount)
            await user.save()

            const wallet = await walletModel.findOne({ userId: userId })
            if (!wallet) {
                const newWallet = new walletModel({
                    userId: userId,
                    history: [
                        {
                            transaction: "Credited",
                            amount: result.amount,
                            date: new Date(),
                            reason: "Order Cancelled"
                        }
                    ]
                })
                await newWallet.save();
            } else {
                wallet.history.push({
                    transaction: "Credited",
                    amount: result.amount,
                    date: new Date(),
                    reason: "Order Cancelled"
                })
                await wallet.save();
            }
        }

        const items = result.items.map(item => ({
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
        res.redirect("/orders")
    } catch (error) {
        console.log(error)
        res.render('user/serverError')
    }
}
const ordertracking = async (req, res) => {
    try {
        const id = req.params.id;
        const categories = await catModel.find();
        const order = await orderModel.findOne({ _id: id }).populate({
            path: 'items.productId',
            select: 'name images'
        });
        const orderSuccess = req.flash('orderSuccess');
        const itemCount = req.session.cartCount;
        res.render('user/ordertracking', { order: order, categories, orderSuccess, itemCount })
    } catch (error) {
        console.log(error)
        res.render('user/serverError')
    }
}

const downloadInvoice = async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await orderModel.findOne({ orderId: orderId }).populate({
            path: 'items.productId',
            select: 'name',
        });


        const pdfBuffer = await generateInvoice(order);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderId}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.log(error)
        res.render('user/serverError')
    }
}

const generateInvoice = async (order) => {
    try {
        let totalAmount = order.amount;
        const data = {
            documentTitle: 'Invoice',
            currency: 'INR',
            marginTop: 25,
            marginRight: 25,
            marginLeft: 25,
            marginBottom: 25,
            images: {
                logo: "https://i.ibb.co/6sgJyMz/logo.png",
            },
            sender: {
                company: 'VintageRags',
                address: '13th Cross, Madiwala, Banglore, India',
                zip: '651323',
                city: 'Banglore',
                country: 'INDIA',
                phone: '9605912125',
                email: 'vintageragsonline@gmail.com',
                website: 'www.vintagerags.com',
            },
            invoiceNumber: `INV-${order.orderId}`,
            invoiceDate: new Date().toJSON(),
            products: order.items.map(item => ({
                quantity: item.quantity,
                description: item.productId.name,
                price: item.price,
            })),
            total: `₹${totalAmount.toFixed(2)}`,
            tax: 0,
            bottomNotice: 'Thank you for shopping at VintageRags!',
        };

        const result = await easyinvoice.createInvoice(data);
        const pdfBuffer = Buffer.from(result.pdf, 'base64');
        return pdfBuffer;
    } catch (error) {
        console.log(error);
    }
};


const reOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
        const ordersId = orderId.trim();
        const userId = req.session.userId;
        const order = await orderModel.findOne({ orderId: ordersId });
        const { pay, wallet } = req.body;
        const parsedWallet = parseInt(wallet);
        if (pay == 'paymentPending') {
            res.redirect(`/order-tracking/${order._id}`)
        } else if (pay == 'wallet') {
            const update = await orderModel.updateOne({ orderId: ordersId }, {
                wallet: parsedWallet,
                payment: pay,
                status: "pending",
                updated: new Date()
            })
            const userWallet = await walletModel.findOne({ userId: userId })
            userWallet.history.push({
                transaction: "Debited",
                amount: parsedWallet,
                date: new Date(),
                reason: "Product Purchased"
            })
            await userWallet.save();
            const user = await userModel.findOne({ _id: userId })
            user.wallet -= parsedWallet;
            await user.save();
        } else {
            const update = await orderModel.updateOne({ orderId: ordersId }, {
                payment: pay,
                status: "pending",
                updated: new Date()
            })
        }
        req.flash('orderSuccess', 'Your Order is Successfull!')
        res.redirect(`/order-tracking/${order._id}`)
    } catch (error) {
        console.log(error);
        res.render('user/serverError');
    }
}

const itemCancel = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const productId = req.params.productId;
        const order = await orderModel.findOne({ _id: orderId });
        if (!order) {
            console.log('Order not found');
            return res.redirect("/orders");
        }

        const product = order.items.find(item => item.productId.toString() === productId.toString());
        if (!product) {
            console.log('Product not found in order');
            return res.redirect("/orders");
        }

        if (order.items.length === 1) {
            order.status = 'Cancelled';
            order.updated = new Date();
        } else {
            order.amount -= product.price;
            order.items.pull({ productId: productId, size: product.size })
            order.updated = new Date();
        }

        await order.save();

        if (order.payment === 'upi' || order.payment === 'wallet') {
            const userId = req.session.userId;
            const user = await userModel.findOne({ _id: userId });
            if (user) {
                user.wallet += product.price;
                await user.save();

                const wallet = await walletModel.findOne({ userId: userId });
                if (!wallet) {
                    const newWallet = new walletModel({
                        userId: userId,
                        history: [{ transaction: "Credited", amount: product.price, date: new Date(), reason: "Item Cancelled" }]
                    });
                    await newWallet.save();
                } else {
                    wallet.history.push({ transaction: "Credited", amount: product.price, date: new Date(), reason: "Item Cancelled" });
                    await wallet.save();
                }
            }
        }
        const products = await productModel.find({ _id: productId });
        let sizeIndex = -1;
        for (let i = 0; i < products[0].stock.length; i++) {
            if (products[0].stock[i].size === product.size) {
                sizeIndex = i;
                break;
            }
        }

        if (sizeIndex !== -1) {
            products[0].stock[sizeIndex].quantity += product.quantity;
            products[0].totalstock += product.quantity;
            await products[0].save();
        } else {
            console.log('Size not found in product stock');
        }

        res.redirect("/orders");
    } catch (error) {
        console.log(error);
        res.render('user/serverError');
    }
};



const returnReason = async (req, res) => {
    try {
        const itemId = req.body.itemId;
        const reason = req.body.reason;
        const order = await orderModel.findById(itemId);
        if (!order.return || order.return.length === 0) {
            order.return = [{ reason, status: "Pending" }];
        } else {
            order.return[0].reason = reason;
            order.return[0].status = "Pending";
        }

        order.updated = new Date();
        await order.save();

        res.status(200).json({ message: 'Order return request processed successfully' });
    } catch (error) {
        console.log(error);
        res.render('user/serverError');
    }
}



const resetPassword = async (req, res) => {
    try {
        const categories = await catModel.find()
        const pass = req.flash('pass')
        res.render('user/resetpassword', { pass, categories })
    } catch (error) {
        console.log(error)
        res.render('user/serverError')
    }
}

const updatePassword = async (req, res) => {
    try {
        const { pass, npass, cpass } = req.body
        const userId = req.session.userId
        const user = await userModel.findOne({ _id: userId })
        const isPassword = await bcrypt.compare(npass, user.password)
        if (isPassword) {
            req.flash('pass', 'Enter Different Password')
            return res.redirect('/resetpassword');
        }
        if (npass !== cpass) {
            req.flash('pass', 'Passwords do not match')
            return res.redirect('/resetpassword');
        }
        const passwordmatch = await bcrypt.compare(pass, user.password)
        if (passwordmatch) {
            const hashedpassword = await bcrypt.hash(npass, 10)
            const newuser = await userModel.updateOne({ _id: userId }, { password: hashedpassword })
            console.log("password updated");
            req.flash("success", "Password updated successfully!");
            return res.redirect('/profile')

        }
        else {
            req.flash("pass", "Invalid Password");
            return res.redirect('/resetpassword');
        }

    } catch (error) {
        console.log(error)
        res.render('user/serverError')
    }
}

const showaddress = async (req, res) => {
    try {
        const userId = req.session.userId
        const categories = await catModel.find()
        const data = await addressModel.findOne({ userId: userId })
        req.session.checkoutSave = false;
        const itemCount = req.session.cartCount;
        res.render('user/address', { userData: data, categories, itemCount })
    } catch (error) {
        console.log(error)
        res.render('user/serverError')
    }
}

const editAddress = async (req, res) => {
    try {
        const userId = req.session.userId
        const categories = await catModel.find()
        const id = req.params.id
        const address = await addressModel.aggregate([
            {
                $match: { userId: new mongoose.Types.ObjectId(userId) }
            },
            {
                $unwind: '$address'
            },
            {
                $match: { 'address._id': new mongoose.Types.ObjectId(id) }
            }
        ]);
        res.render('user/editAddress', { adress: address[0], categories })
    } catch (error) {
        console.log(error)
        res.render('user/serverError')
    }
}

const deleteAddress = async (req, res) => {
    try {
        const userId = req.session.userId;
        const id = req.params.id;
        const result = await addressModel.updateOne(
            { userId: userId, 'address._id': id },
            { $pull: { address: { _id: id } } }
        );
        res.redirect('/address');
    } catch (error) {
        console.log(error)
        res.render('user/serverError')
    }
}

const addressPost = async (req, res) => {
    try {
        const { name, mobile, email, housename, street, city, state, country, pincode, saveas } = req.body;
        const addressId = req.params.id
        const userId = req.session.userId;

        const isAddressExists = await addressModel.findOne({
            'userId': userId,
            'address': {
                $elemMatch: {
                    '_id': { $ne: addressId },
                    'save_as': saveas,
                    'email': email,
                    'name': name,
                    'mobile': mobile,
                    'housename': housename,
                    'street': street,
                    'pincode': pincode,
                    'city': city,
                    'state': state,
                    'country': country,

                }
            }
        });

        if (isAddressExists) {
            return res.status(400).send('Address already exists');
        }
        const result = await addressModel.updateOne(
            { 'userId': userId, 'address._id': addressId },
            {
                $set: {
                    'address.$.save_as': saveas,
                    'address.$.name': name,
                    'address.$.email': email,
                    'address.$.mobile': mobile,
                    'address.$.housename': housename,
                    'address.$.street': street,
                    'address.$.pincode': pincode,
                    'address.$.city': city,
                    'address.$.state': state,
                    'address.$.country': country,

                }
            }
        );

        res.redirect('/address');
    } catch (error) {
        console.log(error)
        res.render('user/serverError')
    }
}


const addAddress = async (req, res) => {
    try {
        const categories = await catModel.find()
        res.render('user/addAddress', { categories })
    } catch (error) {
        console.log(error)
        res.render('user/serverError')
    }
}

const addaddressPost = async (req, res) => {
    try {
        const { name, mobile, email, housename, street, city, state, country, pincode, saveas } = req.body;
        const userId = req.session.userId;
        const existingUser = await addressModel.findOne({ userId: userId });

        if (existingUser) {
            const existingAddress = await addressModel.findOne({
                'userId': userId,
                'address.name': name,
                'address.mobile': mobile,
                'address.email': email,
                'address.housename': housename,
                'address.street': street,
                'address.city': city,
                'address.state': state,
                'address.country': country,
                'address.pincode': pincode,
                'address.save_as': saveas
            });

            if (existingAddress) {
                if (req.session.checkoutSave) {
                    console.log("aaaaa")
                    return res.redirect(`/checkout`)
                }
                console.log("bb")
                return res.redirect(`/address`)
            }

            existingUser.address.push({
                name: name,
                mobile: mobile,
                email: email,
                housename: housename,
                street: street,
                city: city,
                state: state,
                country: country,
                pincode: pincode,
                save_as: saveas
            });

            await existingUser.save();
            if (req.session.checkoutSave) {
                return res.redirect(`/checkout`)
            }
            return res.redirect('/address');
        }

        const newAddress = await addressModel.create({
            userId: userId,
            address: {
                name: name,
                mobile: mobile,
                email: email,
                housename: housename,
                street: street,
                city: city,
                state: state,
                country: country,
                pincode: pincode,
                save_as: saveas,
            },
        });
        if (req.session.checkoutSave) {
            return res.redirect(`/checkout`)
        }
        return res.redirect('/address');
    } catch (error) {
        console.log(error)
        res.render('user/serverError')
    }
}

const wallet = async (req, res) => {
    try {
        const userId = req.session.userId;
        const categories = await catModel.find()
        const user = await userModel.findOne({ _id: userId })
        const wallet = await walletModel.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId) } },
            { $unwind: "$history" },
            { $sort: { "history.date": -1 } }
        ]);
        const itemCount = req.session.cartCount;
        res.render('user/wallet', { wallet: wallet, user: user, categories, itemCount })
    } catch (error) {
        console.log(error)
        res.render('user/serverError')
    }
}

const instance = new Razorpay({
    key_id: process.env.KEY_ID,
    key_secret: process.env.KEY_SECRET,
});

const walletupi = async (req, res) => {
    console.log(req.body);
    var options = {
        amount: 500,
        currency: "INR",
        receipt: "order_rcpt"
    };
    instance.orders.create(options, function (err, order) {
        res.send({ orderId: order.id })
    })
}

const walletTopup = async (req, res) => {
    try {
        const userId = req.session.userId;
        const user = await userModel.findOne({ _id: userId })
        const Amount = parseFloat(req.body.Amount)
        const wallet = await walletModel.findOne({ userId: userId });
        user.wallet += Amount;
        wallet.history.push({
            transaction: "Credited",
            amount: Amount,
            date: new Date(),
            reason: "Wallet Topup"
        });

        await wallet.save();
        await user.save();
        res.redirect("/wallet")
    } catch (error) {
        console.error('Error handling Razorpay callback:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

const coupons=async(req,res)=>{
    try{
        const categories = await catModel.find();
        const coupons = await couponModel.find({status:true})
        const itemCount = req.session.cartCount;
        res.render('user/coupons',{coupons,itemCount,categories})
    }catch(error){
        console.log(error)
        res.render('user/serverError')
    }
}

module.exports = { order, ordercancelling, ordertracking, resetPassword, updatePassword, showaddress, editAddress, deleteAddress, addressPost, addAddress, addaddressPost, returnReason, itemCancel, wallet, walletupi, walletTopup, downloadInvoice, reOrder ,coupons}