const adAuth = (req, res, next) => {
    try {
        if (req.session.isAdAuth) {
            next()
        } else {
            res.redirect('/admin')
        }
    } catch (err) {
        console.log(err)
        res.render('user/serverError')
    }
}

const adLogout = (req, res, next) => {
    try {
        if (req.session.isAdAuth) {
            res.redirect('/admin/adminPanel')
        } else {
            next()
        }

    } catch (err) {
        console.log(err)
        res.render('user/serverError')
    }
}

module.exports = { adAuth, adLogout }