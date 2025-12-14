var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index');
});

// Mount modular routers
router.use('/books', require('./books'));
router.use('/patrons', require('./patrons'));
router.use('/loans', require('./loans'));

module.exports = router;
