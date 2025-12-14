var express = require('express');
var router = express.Router();
var db = require('../models');

/* GET all books page. setup pagination and search */
router.get('/', function(req, res, next) {
  var page = parseInt(req.query.page) || 1;
  var limit = 10;
  var offset = (page - 1) * limit;
  var search = req.query.search || '';

  var whereClause = {};
  if (search) {
    var Op = db.Sequelize.Op;
    whereClause = {
      [Op.or]: [
        { title: { [Op.like]: '%' + search + '%' } },
        { author: { [Op.like]: '%' + search + '%' } },
        { genre: { [Op.like]: '%' + search + '%' } }
      ]
    };
  }

  db.Book.findAndCountAll({
    where: whereClause,
    order: [['title', 'ASC']],
    limit: limit,
    offset: offset
  })
    .then(function(result) {
      var totalPages = Math.ceil(result.count / limit);
      res.render('books/all_books', {
        books: result.rows,
        currentPage: page,
        totalPages: totalPages,
        search: search,
        hasPrevious: page > 1,
        hasNext: page < totalPages
      });
    })
    .catch(function(error) {
      next(error);
    });
});

/* GET new book page. */
router.get('/new', function(req, res, next) {
  res.render('books/new_book');
});

/* POST create new book. */
router.post('/new', function(req, res, next) {
  var title = req.body.title ? req.body.title.trim() : '';
  var author = req.body.author ? req.body.author.trim() : '';
  var genre = req.body.genre ? req.body.genre.trim() : null;
  var firstPublished = req.body.first_published ? req.body.first_published.trim() : null;

  if (firstPublished && firstPublished !== '') {
    firstPublished = parseInt(firstPublished);
    if (isNaN(firstPublished)) {
      firstPublished = null;
    }
  } else {
    firstPublished = null;
  }

  db.Book.create({
    title: title,
    author: author,
    genre: genre,
    first_published: firstPublished
  })
    .then(function(book) {
      res.redirect('/books');
    })
    .catch(function(error) {
      if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
        var errors = [];
        error.errors.forEach(function(err) { errors.push(err.message); });
        var bookData = { title: title, author: author, genre: genre, first_published: firstPublished };
        res.render('books/new_book', { book: bookData, errors: errors });
      } else {
        next(error);
      }
    });
});

/* GET update book page. */
router.get('/:id', function(req, res, next) {
  var bookId = parseInt(req.params.id);

  db.Book.findByPk(bookId)
    .then(function(book) {
      if (!book) {
        var err = new Error('Book not found');
        err.status = 404;
        return next(err);
      }
      res.render('books/update_book', { book: book });
    })
    .catch(function(error) {
      next(error);
    });
});

/* PUT update book. */
router.put('/:id', function(req, res, next) {
  var bookId = parseInt(req.params.id);
  var title = req.body.title ? req.body.title.trim() : '';
  var author = req.body.author ? req.body.author.trim() : '';
  var genre = req.body.genre ? req.body.genre.trim() : null;
  var firstPublished = req.body.first_published ? req.body.first_published.trim() : null;

  if (firstPublished && firstPublished !== '') {
    firstPublished = parseInt(firstPublished);
    if (isNaN(firstPublished)) {
      firstPublished = null;
    }
  } else {  
    firstPublished = null;
  }

  db.Book.findByPk(bookId)
    .then(function(book) {
      if (!book) {
        var err = new Error('Book not found');
        err.status = 404;
        return next(err);
      }
      return book.update({ title: title, author: author, genre: genre, first_published: firstPublished });
    })
    .then(function(book) {
      res.redirect('/books');
    })
    .catch(function(error) {
      console.log('Error updating book: '+error);
      if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
        var errors = [];
        error.errors.forEach(function(err) { errors.push(err.message); });
        return db.Book.findByPk(bookId)
          .then(function(book) {
            if (!book) { var err = new Error('Book not found'); err.status = 404; return next(err); }
            var bookData = {
              id: book.id,
              title: title || book.title,
              author: author || book.author,
              genre: genre !== null ? genre : book.genre,
              first_published: firstPublished !== null ? firstPublished : book.first_published
            };
            res.render('books/update_book', { book: bookData, errors: errors });
          });
      } else {
        next(error);
      }
    });
});

module.exports = router;
