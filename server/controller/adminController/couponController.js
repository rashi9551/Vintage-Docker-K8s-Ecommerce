const couponModel = require('../../model/couponModel')
const flash = require('express-flash')

const couponlist = async (req, res) => {
    try {
        const coupons = await couponModel.find({})
        const couponExists = req.flash('couponExists')
        res.render('admin/couponList', { coupons, couponExists })

    }
    catch (err) {
        console.log(err);
        res.render("user/serverError");

    }
}

const addcouponpage = async (req, res) => {
    try {
        const couponExists = req.flash('couponExists')
        res.render('admin/addCoupon', { couponExists })
    }
    catch (err) {
        console.log(err);
        res.render("user/serverError");

    }
}

const createCoupon = async (req, res) => {
    try {
        const { couponCode, minimumPrice, discount, expiry, maxRedeem, couponType } = req.body

        const couponExists = await couponModel.findOne({ couponCode: couponCode });

        if (couponExists) {
            req.flash('couponExists', "Coupon already exists")
            console.log("Coupon exists");
            res.redirect('/admin/add_coupon');
        }
        else {
            await couponModel.create({
                couponCode: couponCode,
                type: couponType,
                minimumPrice: minimumPrice,
                discount: discount,
                maxRedeem: maxRedeem,
                expiry: expiry
            })
            console.log("COUPON created");
            res.redirect('/admin/coupons');

        }
    } catch (error) {
        console.log(error);
        res.render("user/serverError");
    }
}

const unlistCoupon = async (req, res) => {
    try {
        const id = req.params.id;
        const coupon = await couponModel.findOne({ _id: id });

        coupon.status = !coupon.status;
        await coupon.save();
        res.redirect('/admin/coupons')
    }
    catch (err) {
        console.log(err);
        res.render("user/serverError");
    }
}

const editCouponPage = async (req, res) => {
    try {
        const id = req.params.id
        const coupon = await couponModel.findOne({ _id: id })
        res.render('admin/editCouponPage', { coupon: coupon })
    }
    catch (err) {
        console.log(err);
        res.render("user/serverError");
    }
}

const updateCoupon = async (req, res) => {
    try {
        const { couponId, couponCode, minimumPrice, discount, expiry, maxRedeem, couponType } = req.body
        const couponExists = await couponModel.findOne({ couponCode: couponCode });
        if (couponExists) {
            req.flash('couponExists', "Coupon already exists")
            res.redirect('/admin/coupons');
        }
        else {
            const updatedCoupon = await couponModel.findByIdAndUpdate(
                couponId,
                {
                    $set: {
                        couponCode: couponCode,
                        type: couponType,
                        minimumPrice: minimumPrice,
                        discount: discount,
                        maxRedeem: maxRedeem,
                        expiry: expiry,
                    }
                }


            );

            console.log("COUPON created");
            res.redirect('/admin/coupons');

        }


    }
    catch (err) {
        console.log(err);
        res.render("user/serverError");
    }
}

module.exports = { couponlist, addcouponpage, createCoupon, unlistCoupon, editCouponPage, updateCoupon }