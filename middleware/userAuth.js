const userModel = require("../server/model/userModel")

const logged = async (req, res, next) => {
    try {
        const user = await userModel.findOne({ _id: req.session.userId })
        if (req.session.isAuth && user&&user.blocked==false) {
            next()
        } else {
            res.redirect('/login')
        }

    } catch (err) {
        console.log(err)
        res.render('user/serverError')
    }
}

const ifLogged = async (req, res, next) => {
    try {
        if (req.session.isAuth) {
            res.redirect('/')
        } else {
            next();
        }

    } catch (err) {
        console.log(err);
        res.render('user/serverError')
    }
}

const forgot=async(req,res,next)=>{
    try {
        if(req.session.forgot){
            next()
        }else{
            res.redirect('/')
        }
    } catch (err) {
        console.log(err);
        res.render('user/serverError')
    }
}

const signed=async(req,res,next)=>{
    try {
        if(req.session.signup||req.session.forgot){
            next()
        }else{
            res.redirect('/')
        }
    } catch (err) {
        console.log(err);
        res.render('user/serverError')
    }
}

const checkoutValid=async(req,res,next)=>{
    try{
        if(req.session.checkout){
            next()
        }else{
            res.redirect('/login')
        }
    } catch (err) {
        console.log(err);
        res.render('user/serverError')
    }
}


module.exports = { logged, ifLogged ,forgot,signed,checkoutValid}