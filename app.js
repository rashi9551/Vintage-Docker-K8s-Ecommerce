const express = require('express');
require('dotenv').config();
const path = require('path');
const mongoose = require('mongoose');
const os = require('os');
const nocache = require('nocache');
const session = require('express-session');
const flash = require('express-flash');
const passport = require('passport');
const userRouter = require('./server/routers/user');
const adminRouter = require('./server/routers/admin')
const multer = require('multer')


const PORT = process.env.PORT || 8000;

mongoose.connect(process.env.MONGO_URL).then(() => {
  console.log("connected");
}).catch((error) => {
  console.log(error);
});

const app = express();

app.use(session({
  secret: 'qwertyasdfghj',
  resave: false,
  saveUninitialized: true
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(flash());
app.use(nocache());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/static', express.static(path.join(__dirname, 'static')));
app.use(express.static(path.join(os.homedir(), 'Downloads')));

app.set('view engine', 'ejs');
app.use('/uploads', express.static("uploads"));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname + ".png");
  }
});

const upload = multer({ storage: storage });

app.post('/your-upload-route', upload.array('files'), (req, res) => {
  console.log(req.files);
});

app.use('/', userRouter);
app.use('/admin', adminRouter);


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}/`);
});
