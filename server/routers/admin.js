const express = require('express')
const adminRouter = express.Router()


const adminController = require('../controller/adminController/adminController')
const productController = require('../controller/adminController/productController')
const categoryController = require('../controller/adminController/categoryController')
const orderController = require('../controller/adminController/orderController')
const couponController = require('../controller/adminController/couponController')
const sessions = require('../../middleware/adminAuth')
const multer = require('multer')

const upload = multer({ dest: 'uploads/' })

adminRouter.use(express.urlencoded({ extended: true }))

adminRouter.get('/', sessions.adLogout, adminController.login)
adminRouter.post("/adminlogin", adminController.loginPost)
adminRouter.get('/adminPanel', sessions.adAuth, adminController.adminPanel)

adminRouter.get('/users', sessions.adAuth, adminController.user)
adminRouter.get("/unblock/:id", sessions.adAuth, adminController.unblock)
adminRouter.post('/search', sessions.adAuth, adminController.search)
adminRouter.get('/searchView', sessions.adAuth, adminController.searchView)

adminRouter.get('/products', sessions.adAuth, productController.product)
adminRouter.get('/addProduct', sessions.adAuth, productController.addProduct)
adminRouter.post('/addProduct', sessions.adAuth, upload.array('images'), productController.addProductPost)
adminRouter.get("/unlist/:id", sessions.adAuth, productController.unlist)
adminRouter.get("/updateProduct/:id", sessions.adAuth, productController.updateProduct)
adminRouter.post("/updateProduct/:id", sessions.adAuth, productController.updateProductPost)
adminRouter.get("/editImage/:id", sessions.adAuth, productController.editImage)
adminRouter.get('/deleteImage', sessions.adAuth, productController.deleteImage)
adminRouter.post('/updateImage/:id', sessions.adAuth, upload.array('image'), productController.updateImage)
adminRouter.post('/searchProduct', sessions.adAuth, productController.searchProduct)
adminRouter.get('/searchProductView', sessions.adAuth, productController.searchProductView)



adminRouter.get('/categories', sessions.adAuth, categoryController.category)
adminRouter.get('/addCategory', sessions.adAuth, categoryController.addCategory)
adminRouter.post('/addCategory', sessions.adAuth, categoryController.addCategoryPost)
adminRouter.get('/unlistCat/:id', sessions.adAuth, categoryController.unlist)
adminRouter.get('/updateCategory/:id', sessions.adAuth, categoryController.updateCategory)
adminRouter.post('/updateCategory/:id', sessions.adAuth, categoryController.updateCategoryPost)

adminRouter.get('/orders', sessions.adAuth, orderController.order)
adminRouter.post('/updateOrderStatus', sessions.adAuth, orderController.orderstatus)
adminRouter.get('/orderReturn', sessions.adAuth, orderController.orderReturn)
adminRouter.get('/returnApprove/:id', sessions.adAuth, orderController.returnApprove)
adminRouter.get('/returnReject/:id', sessions.adAuth, orderController.returnReject)



adminRouter.get('/coupons', sessions.adAuth, couponController.couponlist)
adminRouter.get('/newcoupon', sessions.adAuth, couponController.addcouponpage)
adminRouter.post('/add_coupon', sessions.adAuth, couponController.createCoupon)
adminRouter.get('/unlistCoupon/:id', sessions.adAuth, couponController.unlistCoupon)
adminRouter.get('/editCouponGet/:id', sessions.adAuth, couponController.editCouponPage)
adminRouter.post('/updateCoupon', sessions.adAuth, couponController.updateCoupon)


adminRouter.post('/chartData', sessions.adAuth, adminController.chartData)
adminRouter.post('/downloadsales', sessions.adAuth, adminController.downloadsales)

adminRouter.get('/best', sessions.adAuth, adminController.bestProducts)

adminRouter.get('/adLogout', sessions.adAuth, adminController.adLogout)

module.exports = adminRouter