const adminModel = require('../../model/userModel');
const CatModel = require('../../model/categModel');
const productModel = require('../../model/productModel');

const category = async (req, res) => {
    try {
        const updateSuccess = req.flash('updateSuccess');
        const catSuccess = req.flash('catSuccess');
        const categories = await CatModel.find({});
        res.render('admin/category', { category: categories, updateSuccess, catSuccess });
    } catch (err) {
        console.log(err);
        res.render("user/serverError");
    }
};

const addCategory = async (req, res) => {
    try {
        const catError = req.flash('catError');
        res.render('admin/addCategory', { catError });
    } catch (err) {
        console.log(err);
        res.render("user/serverError");
    }
};

const addCategoryPost = async (req, res) => {
    try {
        const catName = req.body.name;
        const catDescription = req.body.description;
        const discount = req.body.discount;
        const catExist = await CatModel.findOne({ name: { $regex: new RegExp("^" + catName + "$", "i") } });
        console.log(catName);
        if (catExist) {
            console.log("Already Exist");
            req.flash('catError', 'Category Already Exists');
            return res.redirect('/admin/addCategory');
        } else {
            await CatModel.create({ name: catName, description: catDescription, discount: discount });
            req.flash('catSuccess', "Category Added Successfully")
            res.redirect('/admin/categories');
        }
    } catch (err) {
        console.log(err);
        res.render("user/serverError");
    }
};

const unlist = async (req, res) => {
    try {
        const id = req.params.id;
        const category = await CatModel.findById(id);
        category.status = !category.status;
        await category.save();
        res.redirect('/admin/categories')
    } catch (err) {
        console.log(err);
        res.render("user/serverError");
    }
}

const updateCategory = async (req, res) => {
    try {
        const id = req.params.id;
        const category = await CatModel.findById(id);
        const catError = req.flash('catError');
        res.render('admin/updateCategory', { category, catError })
    } catch (err) {
        console.log(err);
        res.render("user/serverError");
    }
}

const updateCategoryPost = async (req, res) => {
    try {
        const id = req.params.id;
        const product = await productModel.find({ category: id })
        const category = await CatModel.findById(id);
        const catName = req.body.name;
        const isNameModified = catName !== category.name;

        if (isNameModified) {
            const catExist = await CatModel.findOne({ name: { $regex: new RegExp("^" + catName + "$", "i") } });
            if (catExist) {
                console.log("Already Exist");
                req.flash('catError', 'Category Already Exists');
                return res.redirect('/admin/updateCategory/' + id);
            }
        }

        category.description = req.body.description;
        category.discount = req.body.discount;
        category.name = catName;
        await category.save();
        const categoryDiscount = category.discount;
        product.forEach(async (element) => {
            if (categoryDiscount > element.discount) {
                element.discount = categoryDiscount;
            }
            element.discountPrice = element.price - (element.price * (element.discount / 100));
            await element.save();
        });
        console.log(categoryDiscount);
        req.flash('updateSuccess', "Category Updated Successfully");
        res.redirect('/admin/categories');
    } catch (err) {
        console.log(err);
        res.render("user/serverError");
    }
}


module.exports = { category, addCategory, addCategoryPost, unlist, updateCategory, updateCategoryPost };
