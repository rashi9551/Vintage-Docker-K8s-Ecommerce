const catModel = require('../../model/categModel')
const productModel = require('../../model/productModel')
const favModel = require('../../model/favModel')
const mongoose = require('mongoose')
const flash = require('express-flash')






const shop = async (req, res) => {
    try {
        let products;
        const perPage = 3;
        const categoryId = req.query.category;
        const sortBy = req.query.sortBy;
        const search = req.query.search;
        const page = parseInt(req.query.page) || 1;

        if (search) {
            const searchRegex = new RegExp(search, 'i');
            let searchCriteria = { name: searchRegex, status: true };

            if (req.session.filterCat) {
                searchCriteria.category = new mongoose.Types.ObjectId(req.session.filterCat);
                console.log("one", req.session.filterCat);
            }

            if (sortBy) {
                products = await getProductsWithSorting(searchCriteria, sortBy);
                console.log("two", req.session.filterCat);
            } else {
                products = await productModel.find(searchCriteria).exec();
                console.log("three", req.session.filterCat);
            }
        } else {
            if (sortBy) {
                let filter = { status: true };

                if (req.session.filterCat) {
                    filter.category = new mongoose.Types.ObjectId(req.session.filterCat);
                }

                products = await getProductsWithSorting(filter, sortBy);
            } else {
                if (categoryId) {
                    products = await productModel.find({ category: categoryId, status: true }).exec();
                    req.session.filterCat = categoryId;
                } else {
                    delete req.session.filterCat;
                    products = await productModel.find({ status: true }).exec();
                }
            }
        }

        const totalPages = Math.ceil(products.length / perPage);
        const startIndex = (page - 1) * perPage;
        const endIndex = page * perPage;
        const productsPaginated = products.slice(startIndex, endIndex);

        const categoryCounts = await getCategoryCounts();
        const categories = await catModel.find({ status: true });
        const itemCount = req.session.cartCount;
        res.render('user/shop', { products: productsPaginated, categories, categoryCounts, currentPage: page, totalPages, sortBy, categoryId, search, itemCount });
    } catch (error) {
        console.log(error);
        res.render('user/serverError');
    }
}




const getProductsWithSorting = async (filter, sortBy) => {
    const aggregationPipeline = [
        { $match: filter }
    ];

    if (sortBy === 'nameAZ') {
        aggregationPipeline.push(
            { $addFields: { name_lower: { $toLower: "$name" } } },
            { $sort: { name_lower: 1 } }
        );
    }
    if (sortBy === 'nameZA') {
        aggregationPipeline.push(
            { $addFields: { name_lower: { $toLower: "$name" } } },
            { $sort: { name_lower: -1 } }
        );
    }
    if (sortBy === 'priceHigh') {
        aggregationPipeline.push(
            { $sort: { price: 1 } }
        );
    }
    if (sortBy === 'priceLow') {
        aggregationPipeline.push(
            { $sort: { price: -1 } }
        );
    }
    if (sortBy == 'newArrivals') {
        aggregationPipeline.push(
            { $sort: { _id: -1 } },
            { $limit: 6 }
        )
    }


    return productModel.aggregate(aggregationPipeline).exec();
}

const getCategoryCounts = async () => {
    const aggregationPipeline = [
        { $match: { status: true } },
        { $group: { _id: "$category", count: { $sum: 1 } } }
    ];

    const categoryCounts = await productModel.aggregate(aggregationPipeline);
    const categoryCountsMap = {};

    categoryCounts.forEach(count => {
        categoryCountsMap[count._id] = count.count;
    });

    return categoryCountsMap;
}





const shopSingle = async (req, res) => {
    try {
        const productId = req.params.id;
        const categories = await catModel.find();
        const productOne = await productModel.findById(productId);
        let pass;
        if (productOne.totalstock == 0) {
            pass = 'Out of Stock'
        }
        const products = await productModel.find({ category: productOne.category });
        const itemCount = req.session.cartCount;
        res.render('user/shop-single', { productOne, products, categories, pass, itemCount });
    } catch (error) {
        console.log(error);
        res.render('user/serverError');
    }
}



const addToFav = async (req, res) => {
    try {
        const size = req.query.size;
        const pid = req.params.id;
        const userId = req.session.userId;
        let fav = await favModel.findOne({ userId: userId });

        if (!fav) {
            fav = new favModel({
                userId: userId,
                item: [{ productId: pid, size: size }]
            });
        } else {
            const existingProductIndex = fav.item.findIndex(item => item.productId.toString() === pid && item.size !== size);
            if (existingProductIndex === -1) {
                fav.item.push({ productId: pid, size: size });
            } else {
                fav.item[existingProductIndex].size = size;
            }
        }

        await fav.save();
        res.redirect('/wishlist');
    } catch (error) {
        console.log(error);
        res.render('user/serverError');
    }
};


const viewFav = async (req, res) => {
    try {
        const userId = req.session.userId
        const categories = await catModel.find()
        const fav = await favModel.findOne({ userId: userId }).populate({
            path: 'item.productId',
            select: "_id name image"
        })
        const itemCount = req.session.cartCount;
        res.render('user/wishlist', { fav: fav, categories, itemCount })
    } catch (error) {
        console.log(error);
        res.render('user/serverError');
    }
}

const removeFav = async (req, res) => {
    try {
        const userId = req.session.userId;
        const productIdToRemove = req.params.id;
        const result = await favModel.updateOne(
            { userId: userId },
            { $pull: { item: { productId: productIdToRemove } } }
        );

        res.redirect('/wishlist')
    } catch (error) {
        console.log(error);
        res.render('user/serverError');
    }
}
module.exports = { shop, shopSingle, addToFav, viewFav, removeFav }