var express = require('express');
var router = express.Router();
var db = require('../models');

/* GET all loans page. setup pagination and search */
router.get('/', function(req, res, next) {
  var page = parseInt(req.query.page) || 1;
  var limit = 10;
  var offset = (page - 1) * limit;
  var search = req.query.search || '';

  var whereClause = {};
  var includeClause = [
    { model: db.Book, as: 'Book', required: true },
    { model: db.Patron, as: 'Patron', required: true }
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

  db.Loan.findAndCountAll({ where: whereClause, include: includeClause, order: [['loaned_on', 'DESC']], limit: limit, offset: offset })
    .then(function(result) {
      var totalPages = Math.ceil(result.count / limit);
      res.render('loans/all_loans', { loans: result.rows, currentPage: page, totalPages: totalPages, search: search, hasPrevious: page > 1, hasNext: page < totalPages });
    })
    .catch(function(error) { next(error); });
});

/* GET active loans page. setup pagination */
router.get('/active', function(req, res, next) {
  var page = parseInt(req.query.page) || 1;
  var limit = 10;
  var offset = (page - 1) * limit;
  var Op = db.Sequelize.Op;

  db.Loan.findAndCountAll({
    where: { returned_on: null },
    include: [ { model: db.Book, as: 'Book', required: true }, { model: db.Patron, as: 'Patron', required: true } ],
    order: [['loaned_on', 'DESC']],
    limit: limit,
    offset: offset
  })
    .then(function(result) {
      var totalPages = Math.ceil(result.count / limit);
      res.render('loans/active_loans', { loans: result.rows, currentPage: page, totalPages: totalPages, hasPrevious: page > 1, hasNext: page < totalPages });
    })
    .catch(function(error) { next(error); });
});

/* GET overdue loans page. setup pagination */
router.get('/overdue', function(req, res, next) {
  var page = parseInt(req.query.page) || 1;
  var limit = 10;
  var offset = (page - 1) * limit;
  var Op = db.Sequelize.Op;
  var today = new Date(); today.setHours(0,0,0,0); var todayString = today.toISOString().split('T')[0];

  db.Loan.findAndCountAll({
    where: { [Op.and]: [ { return_by: { [Op.lt]: todayString } }, { returned_on: null } ] },
    include: [ { model: db.Book, as: 'Book', required: true }, { model: db.Patron, as: 'Patron', required: true } ],
    order: [['return_by', 'ASC']],
    limit: limit,
    offset: offset
  })
    .then(function(result) {
      var totalPages = Math.ceil(result.count / limit);
      res.render('loans/overdue_loans', { loans: result.rows, currentPage: page, totalPages: totalPages, hasPrevious: page > 1, hasNext: page < totalPages });
    })
    .catch(function(error) { next(error); });
});

/* GET new loan page. */
router.get('/new', function(req, res, next) {
  var Op = db.Sequelize.Op;

  db.Loan.findAll({ where: { returned_on: null }, attributes: ['book_id'] })
    .then(function(activeLoans) {
      var checkedOutIds = activeLoans.map(function(l) { return l.book_id; });
      var bookWhere = {};
      if (checkedOutIds.length > 0) { bookWhere = { id: { [Op.notIn]: checkedOutIds } }; }

      return db.Book.findAll({ where: bookWhere, order: [['title', 'ASC']] })
        .then(function(books) {
          return db.Patron.findAll({ order: [['library_id', 'ASC']] })
            .then(function(patrons) { res.render('loans/new_loan', { books: books, patrons: patrons }); });
        });
    })
    .catch(function(error) { next(error); });
});

/* POST create new loan. */
router.post('/new', function(req, res, next) {
  var bookId = parseInt(req.body.book_id);
  var patronId = parseInt(req.body.patron_id);
  var today = new Date(); today.setHours(0,0,0,0); var todayString = today.toISOString().split('T')[0];
  var returnByDate = new Date(today); returnByDate.setDate(returnByDate.getDate() + 7); var returnByString = returnByDate.toISOString().split('T')[0];

  db.Loan.create({ book_id: bookId, patron_id: patronId, loaned_on: todayString, return_by: returnByString, returned_on: null })
    .then(function(loan) { if (loan && loan.id) { res.redirect('/loans'); } })
    .catch(function(error) {
      if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
        var errors = [];
        const dbErrorMessage =  error.parent.message;
        error.errors.forEach(function(err) { errors.push(err.message); });
        if (dbErrorMessage === 'SQLITE_CONSTRAINT: NOT NULL constraint failed: loans.book_id' || dbErrorMessage === 'SQLITE_CONSTRAINT: NOT NULL constraint failed: loans.patron_id') {
          errors.push('Please select both a book and a patron for the loan');
        }
        var Op = db.Sequelize.Op;
        return db.Loan.findAll({ where: { returned_on: null }, attributes: ['book_id'] })
          .then(function(activeLoans) {
            var checkedOutIds = activeLoans.map(function(l) { return l.book_id; });
            var bookWhere = {};
            if (checkedOutIds.length > 0) { bookWhere = { id: { [Op.notIn]: checkedOutIds } }; }
            return db.Book.findAll({ where: bookWhere, order: [['title', 'ASC']] })
              .then(function(books) {
                return db.Patron.findAll({ order: [['library_id', 'ASC']] })
                  .then(function(patrons) {
                    res.status(400).render('new_loan', { books: books, patrons: patrons, errors: errors, book_id: bookId, patron_id: patronId });
                  });
              });
          });
      } else if (error.parent && error.parent.message) {
        console.error('Database constraint error:', error.parent.message);
      } else {
        next(error);
      }
    });
});

/* GET return book page. */
router.get('/:id/return', function(req, res, next) {
  var loanId = parseInt(req.params.id);
  var today = new Date(); today.setHours(0,0,0,0); var todayString = today.toISOString().split('T')[0];

  db.Loan.findByPk(loanId, { include: [ { model: db.Book, as: 'Book', required: true }, { model: db.Patron, as: 'Patron', required: true } ] })
    .then(function(loan) {
      if (!loan) { var err = new Error('Loan not found'); err.status = 404; return next(err); }
      res.render('loans/return_book', { loan: loan, returnedOn: todayString });
    })
    .catch(function(error) { next(error); });
});

/* POST return book - set returned_on date */
router.post('/:id/return', function(req, res, next) {
  var loanId = parseInt(req.params.id);
  var returnedOn = req.body.returned_on ? req.body.returned_on.trim() : null;
  if (!returnedOn || returnedOn === '') { var today = new Date(); today.setHours(0,0,0,0); returnedOn = today.toISOString().split('T')[0]; }

  db.Loan.update({ returned_on: returnedOn }, { where: { id: loanId, returned_on: null } })
    .then(function(result) {
      var affected = Array.isArray(result) ? result[0] : result;
      if (!affected || affected === 0) {
        return db.Loan.findByPk(loanId, { include: [ { model: db.Book, as: 'Book', required: false }, { model: db.Patron, as: 'Patron', required: false } ] })
          .then(function(loan) {
            if (!loan) { var err = new Error('Loan not found'); err.status = 404; return next(err); }
            var errors = ['This loan has already been returned'];
            res.status(409).render('return_book', { loan: loan, returnedOn: returnedOn, errors: errors });
          });
      }
      res.redirect('/loans');
    })
    .catch(function(error) {
      if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
        var errors = [];
        error.errors.forEach(function(err) { errors.push(err.message); });
        return db.Loan.findByPk(loanId, { include: [ { model: db.Book, as: 'Book', required: false }, { model: db.Patron, as: 'Patron', required: false } ] })
          .then(function(loan) { if (!loan) { var err = new Error('Loan not found'); err.status = 404; return next(err); } res.render('loans/return_book', { loan: loan, returnedOn: returnedOn, errors: errors }); });
      }
      next(error);
    });
});

module.exports = router;
