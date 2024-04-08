const adminModel = require('../../model/userModel')
const orderModel = require('../../model/orderModel')
const fs = require('fs')
const os = require('os');
const path = require('path')
const puppeteer = require('puppeteer')
const exceljs = require('exceljs')
const bcrypt = require('bcrypt')
const flash = require('express-flash')

const login = (req, res) => {
    try {
        if (req.session.isAdAuth) {
            return res.redirect('/admin/adminPanel')
        }
        res.render('admin/adLogin', { passwordError: req.query.passwordError })
    } catch (error) {
        console.log(error);
        res.render("user/serverError");
    }
}

const loginPost = async (req, res) => {
    try {
        const password = req.body.password
        const user = await adminModel.findOne({ email: req.body.email });
        if (user.isAdmin == true && await bcrypt.compare(password, user.password)) {
            req.session.isAdAuth = true;
            res.redirect('/admin/adminPanel');
        } else {
            res.redirect("/admin?passwordError=Invalid%20password%2Fusername");
        }
    } catch (error) {
        console.log(error);
        res.render("user/serverError");
    }
}

const adminPanel = async (req, res) => {
    try {
        const perPage = 3;
        const page = parseInt(req.query.page) || 1;
        const products = await orderModel.aggregate([
            {
                $unwind: '$items',
            },
            {
                $lookup: {
                    from: 'productdetails',
                    localField: 'items.productId',
                    foreignField: '_id',
                    as: 'productDetailss',
                },
            },
            {
                $unwind: '$productDetailss',
            },
            {
                $group: {
                    _id: '$items.productId',
                    totalSold: { $sum: '$items.quantity' },
                    totalPrice: { $sum: { $multiply: ['$items.quantity', '$productDetailss.price'] } },
                    totalDiscountPercent: { $first: '$productDetailss.discount' },
                    productName: { $first: '$productDetailss.name' },
                    productImage: { $first: '$productDetailss.image' },
                },
            },
            {
                $addFields: {
                    totalDiscount: { $multiply: ['$totalPrice', { $divide: ['$totalDiscountPercent', 100] }] },
                },
            },
            {
                $sort: { totalSold: -1 },
            },
        ]);
        let totalDiscountSum = 0;

        products.forEach(product => {
            totalDiscountSum += product.totalDiscount;
        });

        const orders = await orderModel.aggregate([
            {
                $match: {
                    status: {
                        $nin: ["Cancelled", "returned"]
                    }
                },
            },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalAmount: { $sum: '$amount' },
                },
            },
        ]);
        const totalPages = Math.ceil(products.length / perPage);
        const startIndex = (page - 1) * perPage;
        const endIndex = page * perPage;
        const productsPaginated = products.slice(startIndex, endIndex);
        const derror = req.flash('derror')
        res.render('admin/adminPanel', { derror, products: productsPaginated, currentPage: page, totalPages, orders, totalDiscountSum })
    } catch (err) {
        console.log(err);
        res.render("user/serverError");
    }
}

const adLogout = (req, res) => {
    try {
        req.session.isAdAuth = false;
        res.redirect('/admin')
    } catch (err) {
        console.log(err);
        res.render("user/serverError");
    }
}

const user = async (req, res) => {
    try {
        const user = await adminModel.find({})
        res.render('admin/users', { users: user })
    } catch (err) {
        console.log(err);
        res.render("user/serverError");
    }
}

const unblock = async (req, res) => {
    try {
        const id = req.params.id;
        const user = await adminModel.findById(id);
        const newValue = !user.blocked;
        await adminModel.updateOne({ _id: id }, { $set: { blocked: newValue } });
        req.session.isAuth = false;
        res.redirect('/admin/users')
    } catch (err) {
        console.log(err);
        res.render("user/serverError");
    }
}

const search = async (req, res) => {
    try {
        const searchName = req.body.search;
        const data = await adminModel.find({
            username: { $regex: new RegExp(`^${searchName}`, `i`) },
        });
        req.session.searchUser = data;
        res.redirect('/admin/searchView')
    } catch (err) {
        console.log(err);
        res.render("user/serverError");
    }
}

const searchView = async (req, res) => {
    try {
        const user = req.session.searchUser;
        res.render('admin/users', { users: user })
    } catch (err) {
        console.log(err);
        res.render("user/serverError");
    }
}

const isFutureDate = (selectedDate) => {
    try {
        const selectedDateTime = new Date(selectedDate);
        const currentDate = new Date();
        return selectedDateTime >= currentDate;

    } catch (error) {
        console.log(error);
        res.render("users/serverError")
    }
}

const chartData = async (req, res) => {
    try {
        const selected = req.body.selected
        if (selected == 'month') {
            const orderByMonth = await orderModel.aggregate([
                {
                    $group: {
                        _id: {
                            month: { $month: '$createdAt' },
                        },
                        count: { $sum: 1 },
                    }
                }
            ])
            const salesByMonth = await orderModel.aggregate([
                {
                    $group: {
                        _id: {
                            month: { $month: '$createdAt' },
                        },

                        totalAmount: { $sum: '$amount' },

                    }
                }
            ])
            const responseData = {
                order: orderByMonth,
                sales: salesByMonth
            };


            res.status(200).json(responseData);
        }
        else if (selected == 'year') {
            const orderByYear = await orderModel.aggregate([
                {
                    $group: {
                        _id: {
                            year: { $year: '$createdAt' },
                        },
                        count: { $sum: 1 },
                    }
                }
            ])
            const salesByYear = await orderModel.aggregate([
                {
                    $group: {
                        _id: {
                            year: { $year: '$createdAt' },
                        },
                        totalAmount: { $sum: '$amount' },
                    }
                }
            ])
            const responseData = {
                order: orderByYear,
                sales: salesByYear,
            }
            res.status(200).json(responseData);
        }

    }
    catch (err) {
        console.log(err);
        res.send("Error Occured")
    }

}

const downloadsales = async (req, res) => {
    try {
        const { startDate, endDate, submitBtn } = req.body;
        console.log(startDate, endDate);
        let sdate = isFutureDate(startDate)
        let edate = isFutureDate(endDate)
        if (!startDate || !endDate) {
            req.flash('derror', 'Choose a date')
            return res.redirect('/admin/adminPanel')
        }
        if (sdate) {
            req.flash('derror', 'invalid date')
            return res.redirect('/admin/adminPanel')
        }
        if (edate) {
            req.flash('derror', 'invalid date')
            return res.redirect('/admin/adminPanel')

        }

        const salesData = await orderModel.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: new Date(startDate),
                        $lt: new Date(endDate),
                    },
                    status: {
                        $nin: ["Cancelled", "returned"]
                    }
                },
            },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalAmount: { $sum: '$amount' },
                },
            },
        ]);
        const products = await orderModel.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: new Date(startDate),
                        $lt: new Date(endDate),
                    },
                },
            },
            {
                $unwind: '$items',
            },
            {
                $lookup: {
                    from: 'productdetails',
                    localField: 'items.productId',
                    foreignField: '_id',
                    as: 'productDetailss',
                },
            },
            {
                $unwind: '$productDetailss',
            },
            {
                $group: {
                    _id: '$items.productId',
                    totalSold: { $sum: '$items.quantity' },
                    totalPrice: { $sum: { $multiply: ['$items.quantity', '$productDetailss.price'] } },
                    totalDiscountPercent: { $first: '$productDetailss.discount' },
                    productName: { $first: '$productDetailss.name' },
                },
            },
            {
                $addFields: {
                    totalDiscount: { $multiply: ['$totalPrice', { $divide: ['$totalDiscountPercent', 100] }] }
                },
            },
            {
                $sort: { totalSold: -1 },
            },
        ]);
        const htmlContent = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Sales Report</title>
                <style>
                    body {
                        margin-left: 20px;
                    }
                </style>
            </head>
            <body>
                <h2 align="center"> Sales Report</h2>
                Start Date:${startDate}<br>
                End Date:${endDate}<br> 
                <center>
                    <table style="border-collapse: collapse;">
                        <thead>
                            <tr>
                                <th style="border: 1px solid #000; padding: 8px;">Sl N0</th>
                                <th style="border: 1px solid #000; padding: 8px;">Product Name</th>
                                <th style="border: 1px solid #000; padding: 8px;">Quantity Sold</th>
                                <th style="border: 1px solid #000; padding: 8px;">Total Price</th>
                                <th style="border: 1px solid #000; padding: 8px;">Discount(%)</th>
                                <th style="border: 1px solid #000; padding: 8px;">Total Discount Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${products.map((item, index) => `
                                <tr>
                                    <td style="border: 1px solid #000; padding: 8px;">${index + 1}</td>
                                    <td style="border: 1px solid #000; padding: 8px;">${item.productName}</td>
                                    <td style="border: 1px solid #000; padding: 8px;">${item.totalSold}</td>
                                    <td style="border: 1px solid #000; padding: 8px;">${item.totalPrice}</td>
                                    <td style="border: 1px solid #000; padding: 8px;">${item.totalDiscountPercent}%</td>
                                    <td style="border: 1px solid #000; padding: 8px;">${item.totalDiscount}</td>
                                </tr>`).join("")}
                                <tr>
                                </tr>
                            <tr>
                                <td style="border: 1px solid #000; padding: 8px;"></td>
                                <td style="border: 1px solid #000; padding: 8px;">Total No of Orders</td>
                                <td style="border: 1px solid #000; padding: 8px;">${salesData[0]?.totalOrders || 0}</td>
                            </tr>
                            <tr>
                                <td style="border: 1px solid #000; padding: 8px;"></td>
                                <td style="border: 1px solid #000; padding: 8px;">Total Revenue</td>
                                <td style="border: 1px solid #000; padding: 8px;">${salesData[0]?.totalAmount || 0}</td>
                            </tr>
                        </tbody>
                    </table>
                </center>
            </body>
            </html>
        `;
        if (submitBtn == 'pdf') {
            const browser = await puppeteer.launch();
            const page = await browser.newPage();
            await page.setContent(htmlContent);
            const pdfBuffer = await page.pdf();
            await browser.close();
            const pdfFileName = 'sales.pdf';
            const pdfFilePath = path.join(os.homedir(), 'Downloads', pdfFileName);
            fs.writeFileSync(pdfFilePath, pdfBuffer);
            const pdfUrl = `http://${req.headers.host}/${pdfFileName}`;
            res.send(`<iframe src="${pdfUrl}" width="100%" height="600px"></iframe>`);
        } else {

            const totalAmount = salesData[0]?.totalAmount || 0;
            const workbook = new exceljs.Workbook();
            const sheet = workbook.addWorksheet("Sales Report");
            sheet.columns = [
                { header: "Sl No", key: "slNo", width: 10 },
                { header: "Product Name", key: "productName", width: 25 },
                { header: "Quantity Sold", key: "productQuantity", width: 15 },
                { header: "Total Price", key: "productTotal", width: 15 },
                { header: "Discount(%)", key: "totalDiscountPercent", width: 15 },
                { header: "Total Discount Amount", key: "totalDiscount", width: 20 }
            ];
            products.forEach((item, index) => {
                sheet.addRow({
                    slNo: index + 1,
                    productName: item.productName,
                    productQuantity: item.totalSold,
                    productTotal: item.totalPrice,
                    totalDiscountPercent: `${item.totalDiscountPercent}%`,
                    totalDiscount: item.totalDiscount
                });
            });
            sheet.addRow({});
            sheet.addRow({ productName: 'Total No of Orders', productQuantity: salesData[0]?.totalOrders || 0 });
            sheet.addRow({ productName: 'Total Revenue', productQuantity: totalAmount });
            res.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            );
            res.setHeader(
                "Content-Disposition",
                "attachment;filename=report.xlsx"
            );
            await workbook.xlsx.write(res);
        }
    } catch (err) {
        console.error(err);
        res.render("user/serverError");
    }
};



const bestProducts = async (req, res) => {
    try {
        const bestProducts = await orderModel.aggregate([
            {
                $unwind: '$items',
            },
            {
                $group: {
                    _id: '$items.productId',
                    totalSold: { $sum: '$items.quantity' },
                },
            },
            {
                $lookup: {
                    from: 'productdetails',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'productDetails',
                },
            },
            {
                $unwind: '$productDetails',
            },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'productDetails.category',
                    foreignField: '_id',
                    as: 'categoryDetails',
                },
            },
            {
                $project: {
                    _id: 1,
                    totalSold: 1,
                    productName: '$productDetails.name',
                    productCategory: { $arrayElemAt: ['$categoryDetails.name', 0] },
                    productImage: '$productDetails.image',
                    stockLeft: '$productDetails.totalstock',
                },
            },
            {
                $sort: { totalSold: -1 },
            },
            {
                $limit: 10,
            },
        ]);
        const bestCategories = await orderModel.aggregate([
            {
                $unwind: '$items',
            },
            {
                $lookup: {
                    from: 'productdetails',
                    localField: 'items.productId',
                    foreignField: '_id',
                    as: 'productDetails',
                },
            },
            {
                $unwind: '$productDetails',
            },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'productDetails.category',
                    foreignField: '_id',
                    as: 'categoryDetails',
                },
            },
            {
                $unwind: '$categoryDetails',
            },
            {
                $group: {
                    _id: '$categoryDetails.name',
                    totalSold: { $sum: '$items.quantity' },
                    numProducts: { $addToSet: '$productDetails._id' },
                },
            },
            {
                $project: {
                    _id: 1,
                    totalSold: 1,
                    numProducts: { $size: '$numProducts' },
                },
            },
            {
                $sort: { totalSold: -1 },
            },
            {
                $limit: 10,
            },
        ]);
        const worstProducts = await orderModel.aggregate([
            {
                $unwind: '$items',
            },
            {
                $group: {
                    _id: '$items.productId',
                    totalSold: { $sum: '$items.quantity' },
                },
            },
            {
                $lookup: {
                    from: 'productdetails',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'productDetails',
                },
            },
            {
                $unwind: '$productDetails',
            },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'productDetails.category',
                    foreignField: '_id',
                    as: 'categoryDetails',
                },
            },
            {
                $project: {
                    _id: 1,
                    totalSold: 1,
                    productName: '$productDetails.name',
                    productCategory: { $arrayElemAt: ['$categoryDetails.name', 0] },
                    productImage: '$productDetails.image',
                    stockLeft: '$productDetails.totalstock',
                },
            },
            {
                $sort: { totalSold: 1 },
            },
            {
                $limit: 10,
            },
        ]);

        res.render('admin/bestProduct', { bestProducts, bestCategories, worstProducts })
    } catch (error) {
        console.error(error);
        res.render("user/serverError");
    }
}




module.exports = { login, loginPost, adminPanel, adLogout, user, unblock, search, searchView, downloadsales, chartData, bestProducts }