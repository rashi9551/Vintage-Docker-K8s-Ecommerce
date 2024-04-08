const userModel = require('../../model/userModel')
const otpModel = require('../../model/otpModel')
const catModel = require('../../model/categModel')
const productModel = require('../../model/productModel')
const cartModel = require('../../model/cartModel')
const passport = require('passport');
const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const flash = require('express-flash')
const otpGenerator = require('otp-generator');
const nodemailer = require('nodemailer');
const userRouter = require('../../routers/user');
// const { user } = require('../../routers/user')

const Email = process.env.Email;
const pass = process.env.pass;

const generateotp = () => {
    try {
        const otp = otpGenerator.generate(4, {
            upperCaseAlphabets: false, specialChars: false, lowerCaseAlphabets: false
        });
        console.log('OTP:', otp);
        return otp;
    } catch (err) {
        console.log(err);
        res.render('user/serverError')
    }
};

const sendmail = async (email, otp) => {
    try {
        let transporter = nodemailer.createTransport({
            service: 'gmail',
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user: Email,
                pass: pass,
            },
        })
        let mailOptions = {
            from: 'Vintagerags<vintageragsonline@gmail.com>',
            to: email,
            subject: 'E-mail Verification',
            html: `<p>Dear User,</p>
           <p>Thank you for signing up with Vintagerags! To complete your registration, please use the following<br> <span style="font-weight: bold; color: #ff0000;">OTP: ${otp}</span></p>
           <p>Enter this OTP on our website to verify your email address and access your account.</p>
           <p>If you did not sign up for Vintagerags, please disregard this email.</p>
           <p>Welcome aboard!</p>
           <p>Best regards,<br/>The Vintagerags Team</p>`
        }
        await transporter.sendMail(mailOptions);
        console.log("Email sent Successfully");
    } catch (err) {
        console.log(err)

    }
}


const index = async (req, res) => {

    try {
        const id = req.session.userId;
        const categories = await catModel.find({ status: true })
        const products = await productModel.find().limit(9)
        if (req.user) {
            req.session.isAuth = true;
            req.session.userId = req.user._id;
        }
        const result = await cartModel.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(id) } },
            { $unwind: '$item' },
            { $group: { _id: null, itemCount: { $sum: 1 } } },
        ])
        console.log(result);
        if (result.length > 0) {
            const itemCount = result[0].itemCount;
            req.session.cartCount = itemCount;
        } else {
            console.log('Cart not found for the user.');
        }
        const itemCount = req.session.cartCount;
        res.render('user/index', { categories, products, itemCount })
    } catch (error) {
        console.log(error)
        res.render('user/serverError')
    }
}

const contact = async (req, res) => {
    try {
        const categories = await catModel.find()
        const itemCount = req.session.cartCount;
        res.render('user/contact', { categories, itemCount })
    } catch (error) {
        console.log(error)
        res.render('user/serverError')
    }
}





const login = async (req, res) => {
    try {
        res.render('user/login', {
            expressFlash: {
                invaliduser: req.flash('invaliduser'),
                invalidpassword: req.flash('invalidpassword'),
                userSuccess: req.flash('userSuccess')
            }
        })
    } catch (error) {
        console.log(error)
        res.render('user/serverError')
    }
}
const signup = async (req, res) => {
    try {
        res.render('user/signup', {
            expressFlash: {
                emailerror: req.flash('emailerror'),
                passworderror: req.flash('passworderror')
            }
        })
    } catch (error) {
        console.log(error)
        res.render('user/serverError')
    }
}

const signupPost = async (req, res) => {
    try {
        const username = req.body.username;
        const email = req.body.email;
        const phone = req.body.phone;
        const password = req.body.password;
        const cpassword = req.body.confirmPassword;
        const user = await userModel.findOne({ email: email })
        if (!user) {
            if (password !== cpassword) {
                req.flash('passworderror', "Passwords do not match. Please try again.")
                return res.redirect('/signup')
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const user = {
                username: username,
                email: email,
                phone: phone,
                password: hashedPassword,
            }
            req.session.user = user;
            req.session.signup = true;

            const otp = generateotp();
            // console.log(req.session.user)

            const currTime = Date.now();
            const expTime = currTime + 60 * 1000;
            await otpModel.updateOne({ email: email }, { $set: { email: email, otp: otp, expiry: new Date(expTime) } }, { upsert: true });
            await sendmail(email, otp);
            res.redirect('/otp')
        } else {
            req.flash('emailerror', "User alredy exist")
            res.redirect('/signup')
        }

    }

    catch (error) {
        console.error("Error during signup:", error);
        req.flash('emailerror', "An error occurred during signup");
        res.redirect('/signup');
    }
}

const otp = async (req, res) => {
    try {
        const otp = await otpModel.findOne({ email: req.session.user.email })
        res.render('user/otp', {
            expressFlash: {
                otperror: req.flash('otperror')
            },
            otp: otp
        })
    } catch (err) {
        console.log(err);
        res.render('user/serverError')
    }
}

const verifyotp = async (req, res) => {
    try {
        const enteredotp = req.body.otp;
        const user = req.session.user;
        // console.log(user)
        const email = req.session.user.email;
        const userdb = await otpModel.findOne({ email: email });
        const otp = userdb.otp;
        const expiry = userdb.expiry;
        // console.log(otp,expiry)
        if (enteredotp == otp && expiry.getTime() >= Date.now()) {
            user.isVerified = true;
            if (req.session.forgot) {
                res.redirect('/newpassword')
            }
            if (req.session.signup) {
                await userModel.create(user);
                const userdata = await userModel.findOne({ email: email });
                req.session.userId = userdata._id;
                req.session.isAuth = true;
                req.session.signup = false;
                res.redirect('/')
            }
        } else {
            req.flash('otperror', 'wrong otp or time expired')
            return res.redirect('/otp')
        }
    } catch (err) {
        console.log(err);
        res.render('user/serverError')
    }
}



const resendotp = async (req, res) => {
    try {
        const email = req.session.user.email;
        const otp = generateotp();

        const currTime = Date.now()
        const expiry = currTime + 60 * 1000;
        await otpModel.updateOne({ email: email }, { otp: otp, expiry: new Date(expiry) });
        await sendmail(email, otp);
        res.redirect('/otp')
    } catch (err) {
        console.log(err);
        res.render('user/serverError')
    }
}

const loginPost = async (req, res) => {
    try {
        const email = req.body.email;
        const password = req.body.password;

        const user = await userModel.findOne({ email: email });
        if (user.blocked == false && await bcrypt.compare(password, user.password)) {
            req.session.userId = user._id;
            req.session.username = user.username;
            req.session.user = user
            req.session.isAuth = true;
            res.redirect('/');
        } else {
            req.flash('invalidpassword', "Invalid Email or Password");
            res.redirect('/login');
        }
    } catch {
        req.flash('invaliduser', "Invalid Email or Password");
        res.redirect('/login');
    }
}

const forgotPassword = async (req, res) => {
    try {
        const categories = await catModel.find()
        const emailExist = req.flash('emailExist')
        res.render('user/forgot', { categories, emailExist })
    } catch (err) {
        console.log(err);
        res.render('user/serverError')
    }
}

const forgotPasswordPost = async (req, res) => {
    try {
        const email = req.body.gmail;
        const emailExist = await userModel.find({ email })
        console.log(email, emailExist);
        if (emailExist[0].email == email) {
            req.session.forgot = true;
            req.session.signup = false;
            req.session.user = { email: email }
            const otp = generateotp();
            // console.log(req.session.user)

            const currTime = Date.now();
            const expTime = currTime + 60 * 1000;
            await otpModel.updateOne({ email: email }, { $set: { email: email, otp: otp, expiry: new Date(expTime) } }, { upsert: true });
            await sendmail(email, otp);
            res.redirect('/otp')
        } else {
            req.flash('emailExist', 'Email Already Exist')
            res.redirect('/forgotPassword')
        }
    } catch (err) {
        console.log(err);
        res.render('user/serverError')
    }
}

const newPassword = async (req, res) => {
    try {
        const passwordError = req.flash('passwordError')
        res.render('user/newPassword', { passwordError })
    } catch (err) {
        console.log(err);
        res.render('user/serverError')
    }
}

const newPasswordPost = async (req, res) => {
    try {
        const password = req.body.password;
        const cpassword = req.body.cpassword;
        if (password === cpassword) {
            const hashedpassword = await bcrypt.hash(password, 10);
            const email = req.session.user.email;
            await userModel.updateOne({ email: email }, { password: hashedpassword });
            req.session.forgot = false;
            res.redirect("/");
        } else {
            req.flash('passwordError', 'Password Does not match')
            res.redirect('/newPassword')
        }
    } catch (err) {
        console.log(err);
        res.render('user/serverError')
    }
}


const profile = async (req, res) => {
    try {
        const id = req.session.userId;
        const categories = await catModel.find()
        const user = await userModel.findOne({ _id: id })
        const name = user.username
        const email = user.email
        const success = req.flash('success')
        const itemCount = req.session.cartCount;
        res.render('user/profile', { name, email, categories, success, itemCount })
    } catch (err) {
        console.log(err);
        res.render('user/serverError')
    }
}

const logout = async (req, res) => {
    try {
        req.session.isAuth = false;
        req.logOut(function (err) {
            if (err) {
                console.error("Error logging out:", err);
                // Handle error, if any
                return res.render('user/serverError');
            }
            // Redirect to the home page after successful logout
            res.redirect('/');
        });
    } catch (err) {
        console.log(err)
        res.render('user/serverError')
    }
}

const googleSignIn = passport.authenticate('google', { scope: ['email', 'profile'] });

const googleCallback = passport.authenticate('google', {
    successRedirect: '/',
    failureRedirect: '/auth/failure'
});

const authFailure = (req, res) => {
    res.send('Something went wrong..');
};


module.exports = { index, contact, login, signup, signupPost, loginPost, otp, verifyotp, resendotp, profile, logout, googleSignIn, googleCallback, authFailure, forgotPassword, forgotPasswordPost, newPassword, newPasswordPost };