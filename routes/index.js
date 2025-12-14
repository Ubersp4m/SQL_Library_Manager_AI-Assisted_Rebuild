var express = require('express');
var router = express.Router();
var db = require('../models');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index');
});

/* GET all books page. setup pagination and search */
router.get('/books', function(req, res, next) {
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
      res.render('all_books', {
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
router.get('/books/new', function(req, res, next) {
  res.render('new_book');
});

/* POST create new book. */
router.post('/books/new', function(req, res, next) {
  var title = req.body.title ? req.body.title.trim() : '';
  var author = req.body.author ? req.body.author.trim() : '';
  var genre = req.body.genre ? req.body.genre.trim() : null;
  var firstPublished = req.body.first_published ? req.body.first_published.trim() : null;
  
  // Convert first_published to integer if provided, otherwise null
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
      // Success - redirect to books list
      res.redirect('/books');
    })
    .catch(function(error) {
      // Handle Sequelize validation errors
      if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
        var errors = [];
        error.errors.forEach(function(err) {
          errors.push(err.message);
        });
        
        // Re-render form with errors and form data
        var bookData = {
          title: title,
          author: author,
          genre: genre,
          first_published: firstPublished
        };
        res.render('new_book', { book: bookData, errors: errors });
      } else {
        // Other errors - pass to error handler
        next(error);
      }
    });
});

/* GET update book page. */
router.get('/books/:id', function(req, res, next) {
  var bookId = parseInt(req.params.id);
  
  db.Book.findByPk(bookId)
    .then(function(book) {
      if (!book) {
        var err = new Error('Book not found');
        err.status = 404;
        return next(err);
      }
      res.render('update_book', { book: book });
    })
    .catch(function(error) {
      next(error);
    });
});

/* POST update book. */
router.post('/books/:id', function(req, res, next) {
  var bookId = parseInt(req.params.id);
  var title = req.body.title ? req.body.title.trim() : '';
  var author = req.body.author ? req.body.author.trim() : '';
  var genre = req.body.genre ? req.body.genre.trim() : null;
  var firstPublished = req.body.first_published ? req.body.first_published.trim() : null;
  
  // Convert first_published to integer if provided, otherwise null
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
      
      // Update book with new data
      return book.update({
        title: title,
        author: author,
        genre: genre,
        first_published: firstPublished
      });
    })
    .then(function(book) {
      // Success - redirect to books list
      res.redirect('/books');
    })
    .catch(function(error) {
      // Handle Sequelize validation errors
      if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
        var errors = [];
        error.errors.forEach(function(err) {
          errors.push(err.message);
        });
        
        // Re-fetch the book to re-render the form
        return db.Book.findByPk(bookId)
          .then(function(book) {
            if (!book) {
              var err = new Error('Book not found');
              err.status = 404;
              return next(err);
            }
            // Merge form data with book data for re-rendering
            var bookData = {
              id: book.id,
              title: title || book.title,
              author: author || book.author,
              genre: genre !== null ? genre : book.genre,
              first_published: firstPublished !== null ? firstPublished : book.first_published
            };
            res.render('update_book', { book: bookData, errors: errors });
          });
      } else {
        // Other errors - pass to error handler
        next(error);
      }
    });
});

/* GET all patrons page. setup pagination and search */
router.get('/patrons', function(req, res, next) {
  var page = parseInt(req.query.page) || 1;
  var limit = 10;
  var offset = (page - 1) * limit;
  var search = req.query.search || '';

  var whereClause = {};
  if (search) {
    var Op = db.Sequelize.Op;
    whereClause = {
      [Op.or]: [
        { first_name: { [Op.like]: '%' + search + '%' } },
        { last_name: { [Op.like]: '%' + search + '%' } },
        { email: { [Op.like]: '%' + search + '%' } },
        { library_id: { [Op.like]: '%' + search + '%' } }
      ]
    };
  }

  db.Patron.findAndCountAll({
    where: whereClause,
    order: [['last_name', 'ASC'], ['first_name', 'ASC']],
    limit: limit,
    offset: offset
  })
    .then(function(result) {
      var totalPages = Math.ceil(result.count / limit);
      res.render('all_patrons', {
        patrons: result.rows,
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

/* GET new patron page. */
router.get('/patrons/new', function(req, res, next) {
  res.render('new_patron');
});

/* POST create new patron. */
router.post('/patrons/new', function(req, res, next) {
  var firstName = req.body.first_name ? req.body.first_name.trim() : '';
  var lastName = req.body.last_name ? req.body.last_name.trim() : '';
  var address = req.body.address ? req.body.address.trim() : null;
  var email = req.body.email ? req.body.email.trim() : '';
  var libraryId = req.body.library_id ? req.body.library_id.trim() : '';
  var zipCode = req.body.zip_code ? req.body.zip_code.trim() : null;
  
  db.Patron.create({
    first_name: firstName,
    last_name: lastName,
    address: address,
    email: email,
    library_id: libraryId,
    zip_code: zipCode
  })
    .then(function(patron) {
      // Success - redirect to patrons list
      res.redirect('/patrons');
    })
    .catch(function(error) {
      // Handle Sequelize validation errors
      if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
        var errors = [];
        error.errors.forEach(function(err) {
          errors.push(err.message);
        });
        
        // Re-render form with errors and form data
        var patronData = {
          first_name: firstName,
          last_name: lastName,
          address: address,
          email: email,
          library_id: libraryId,
          zip_code: zipCode
        };
        res.render('new_patron', { patron: patronData, errors: errors });
      } else {
        // Other errors - pass to error handler
        next(error);
      }
    });
});

/* GET update patron page. */
router.get('/patrons/:id', function(req, res, next) {
  var patronId = parseInt(req.params.id);
  
  db.Patron.findByPk(patronId)
    .then(function(patron) {
      if (!patron) {
        var err = new Error('Patron not found');
        err.status = 404;
        return next(err);
      }
      res.render('update_patron', { patron: patron });
    })
    .catch(function(error) {
      next(error);
    });
});

/* POST update patron. */
router.post('/patrons/:id', function(req, res, next) {
  var patronId = parseInt(req.params.id);
  var firstName = req.body.first_name ? req.body.first_name.trim() : '';
  var lastName = req.body.last_name ? req.body.last_name.trim() : '';
  var address = req.body.address ? req.body.address.trim() : null;
  var email = req.body.email ? req.body.email.trim() : '';
  var libraryId = req.body.library_id ? req.body.library_id.trim() : '';
  var zipCode = req.body.zip_code ? req.body.zip_code.trim() : null;
  
  db.Patron.findByPk(patronId)
    .then(function(patron) {
      if (!patron) {
        var err = new Error('Patron not found');
        err.status = 404;
        return next(err);
      }
      
      // Update patron with new data
      return patron.update({
        first_name: firstName,
        last_name: lastName,
        address: address,
        email: email,
        library_id: libraryId,
        zip_code: zipCode
      });
    })
    .then(function(patron) {
      // Success - redirect to patrons list
      res.redirect('/patrons');
    })
    .catch(function(error) {
      // Handle Sequelize validation errors
      if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
        var errors = [];
        error.errors.forEach(function(err) {
          errors.push(err.message);
        });
        
        // Re-fetch the patron to re-render the form
        return db.Patron.findByPk(patronId)
          .then(function(patron) {
            if (!patron) {
              var err = new Error('Patron not found');
              err.status = 404;
              return next(err);
            }
            // Merge form data with patron data for re-rendering
            var patronData = {
              id: patron.id,
              first_name: firstName || patron.first_name,
              last_name: lastName || patron.last_name,
              address: address !== null ? address : patron.address,
              email: email || patron.email,
              library_id: libraryId || patron.library_id,
              zip_code: zipCode !== null ? zipCode : patron.zip_code
            };
            res.render('update_patron', { patron: patronData, errors: errors });
          });
      } else {
        // Other errors - pass to error handler
        next(error);
      }
    });
});

/* GET all loans page. setup pagination and search */
router.get('/loans', function(req, res, next) {
  var page = parseInt(req.query.page) || 1;
  var limit = 10;
  var offset = (page - 1) * limit;
  var search = req.query.search || '';

  var whereClause = {};
  var includeClause = [
    {
      model: db.Book,
      as: 'Book',
      required: true
    },
    {
      model: db.Patron,
      as: 'Patron',
      required: true
    }
  ];

  if (search) { 
    var Op = db.Sequelize.Op;
    whereClause = {
      [Op.or]: [
        { '$Book.title$': { [Op.like]: '%' + search + '%' } },
        { '$Book.author$': { [Op.like]: '%' + search + '%' } },
        { '$Patron.first_name$': { [Op.like]: '%' + search + '%' } },
        { '$Patron.last_name$': { [Op.like]: '%' + search + '%' } }
      ]
    };
  }

  db.Loan.findAndCountAll({
    where: whereClause,
    include: includeClause,
    order: [['loaned_on', 'DESC']],
    limit: limit,
    offset: offset
  })
    .then(function(result) {
      var totalPages = Math.ceil(result.count / limit);
      res.render('all_loans', {
        loans: result.rows,
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

/* GET active loans page. setup pagination */
router.get('/loans/active', function(req, res, next) {
  var page = parseInt(req.query.page) || 1;
  var limit = 10;
  var offset = (page - 1) * limit;
  var Op = db.Sequelize.Op;
  
  db.Loan.findAndCountAll({
    where: {
      returned_on: null
    },
    include: [
      {
        model: db.Book,
        as: 'Book',
        required: true
      },
      {
        model: db.Patron,
        as: 'Patron',
        required: true
      }
    ],
    order: [['loaned_on', 'DESC']],
    limit: limit,
    offset: offset
  })
    .then(function(result) {
      var totalPages = Math.ceil(result.count / limit);
      res.render('active_loans', {
        loans: result.rows,
        currentPage: page,
        totalPages: totalPages,
        hasPrevious: page > 1,
        hasNext: page < totalPages
      });
    })
    .catch(function(error) {
      next(error);
    });
});

/* GET overdue loans page. setup pagination */
router.get('/loans/overdue', function(req, res, next) {
  var page = parseInt(req.query.page) || 1;
  var limit = 10;
  var offset = (page - 1) * limit;
  var Op = db.Sequelize.Op;
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var todayString = today.toISOString().split('T')[0];
  
  db.Loan.findAndCountAll({
    where: {
      [Op.and]: [
        { return_by: { [Op.lt]: todayString } },
        { returned_on: null }
      ]
    },
    include: [
      {
        model: db.Book,
        as: 'Book',
        required: true
      },
      {
        model: db.Patron,
        as: 'Patron',
        required: true
      }
    ],
    order: [['return_by', 'ASC']],
    limit: limit,
    offset: offset
  })
    .then(function(result) {
      var totalPages = Math.ceil(result.count / limit);
      res.render('overdue_loans', {
        loans: result.rows,
        currentPage: page,
        totalPages: totalPages,
        hasPrevious: page > 1,
        hasNext: page < totalPages
      });
    })
    .catch(function(error) {
      next(error);
    });
});

/* GET new loan page. */
router.get('/loans/new', function(req, res, next) {
  db.Book.findAll({
    order: [['title', 'ASC']]
  })
    .then(function(books) {
      return db.Patron.findAll({
        order: [['last_name', 'ASC'], ['first_name', 'ASC']]
      })
        .then(function(patrons) {
          res.render('new_loan', { books: books, patrons: patrons });
        });
    })
    .catch(function(error) {
      next(error);
    });
});

/* POST create new loan. */
router.post('/loans/new', function(req, res, next) {
  var bookId = parseInt(req.body.book_id);
  var patronId = parseInt(req.body.patron_id);
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var todayString = today.toISOString().split('T')[0];
  var returnByDate = new Date(today);
  returnByDate.setDate(returnByDate.getDate() + 7);
  var returnByString = returnByDate.toISOString().split('T')[0];
  
  // Check if book is already checked out
  db.Loan.findOne({
    where: {
      book_id: bookId,
      returned_on: null
    }
  })
    .then(function(existingLoan) {
      if (existingLoan) {
        // Book is already checked out
        return db.Book.findAll({
          order: [['title', 'ASC']]
        })
          .then(function(books) {
            return db.Patron.findAll({
              order: [['last_name', 'ASC'], ['first_name', 'ASC']]
            })
              .then(function(patrons) {
                var errors = ['This book is checked out and cannot be loaned'];
                res.render('new_loan', {
                  books: books,
                  patrons: patrons,
                  errors: errors,
                  book_id: bookId,
                  patron_id: patronId
                });
              });
          });
      }
      
      // Book is available, create the loan
      return db.Loan.create({
        book_id: bookId,
        patron_id: patronId,
        loaned_on: todayString,
        return_by: returnByString,
        returned_on: null
      });
    })
    .then(function(loan) {
      if (loan && loan.id) {
        // Success - redirect to loans list
        res.redirect('/loans');
      }
    })
    .catch(function(error) {
      // Handle Sequelize validation errors
      if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
        var errors = [];
        error.errors.forEach(function(err) {
          errors.push(err.message);
        });
        
        return db.Book.findAll({
          order: [['title', 'ASC']]
        })
          .then(function(books) {
            return db.Patron.findAll({
              order: [['last_name', 'ASC'], ['first_name', 'ASC']]
            })
              .then(function(patrons) {
                res.render('new_loan', {
                  books: books,
                  patrons: patrons,
                  errors: errors,
                  book_id: bookId,
                  patron_id: patronId
                });
              });
          });
      } else {
        // Other errors - pass to error handler
        next(error);
      }
    });
});

/* GET return book page. */
router.get('/loans/:id/return', function(req, res, next) {
  res.render('return_book');
});

module.exports = router;
