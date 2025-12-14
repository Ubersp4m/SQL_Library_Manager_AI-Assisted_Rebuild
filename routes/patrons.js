var express = require('express');
var router = express.Router();
var db = require('../models');

/* GET all patrons page. setup pagination and search */
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
      res.render('patrons/all_patrons', {
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
router.get('/new', function(req, res, next) {
  // Compute next library_id (max + 1) and pass to the form so users see the assigned id
  db.Patron.max('library_id')
    .then(function(maxLibId) {
      var nextId = 1;
      if (maxLibId !== null && !isNaN(Number(maxLibId))) {
        nextId = Number(maxLibId) + 1;
      }
      // Provide the computed library_id to the view as part of a patron object
      res.render('patrons/new_patron', { patron: { library_id: String(nextId) } });
    })
    .catch(function(error) {
      // On error, just render the form without a library_id (handler will show error)
      console.error('Failed to compute next library_id:', error);
      res.render('patrons/new_patron');
    });
});

/* POST create new patron. */
router.post('/new', function(req, res, next) {
  var firstName = req.body.first_name ? req.body.first_name.trim() : '';
  var lastName = req.body.last_name ? req.body.last_name.trim() : '';
  var address = req.body.address ? req.body.address.trim() : null;
  var email = req.body.email ? req.body.email.trim() : '';
  // We'll auto-assign the next library_id based on the current max in the DB
  var libraryId = null;
  var zipCode = req.body.zip_code ? req.body.zip_code.trim() : null;
  // Compute next library_id (max + 1). Use Sequelize.max to get current max.
  db.Patron.max('library_id')
    .then(function(maxLibId) {
      var nextId = 1;
      if (maxLibId !== null && !isNaN(Number(maxLibId))) {
        nextId = Number(maxLibId) + 1;
      }
      libraryId = String(nextId);

      return db.Patron.create({
        first_name: firstName,
        last_name: lastName,
        address: address,
        email: email,
        library_id: libraryId,
        zip_code: zipCode
      });
    })
    .then(function(patron) {
      res.redirect('/patrons');
    })
    .catch(function(error) {
      if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
        var errors = [];
        error.errors.forEach(function(err) { errors.push(err.message); });
        var patronData = { first_name: firstName, last_name: lastName, address: address, email: email, library_id: libraryId, zip_code: zipCode };
        res.render('patrons/new_patron', { patron: patronData, errors: errors });
      } else {
        next(error);
      }
    });
});

/* GET update patron page. */
router.get('/:id', function(req, res, next) {
  var patronId = parseInt(req.params.id);
  var page = parseInt(req.query.page) || 1;
  var limit = 10;
  var offset = (page - 1) * limit;

  var countPromise = db.Loan.count({ where: { patron_id: patronId } });

  var patronPromise = db.Patron.findByPk(patronId, {
    include: [
      {
        model: db.Loan,
        as: 'Loans',
        include: [ { model: db.Book, as: 'Book', required: false } ],
        separate: true,
        limit: limit,
        offset: offset,
        order: [['loaned_on', 'DESC']]
      }
    ]
  });

  Promise.all([patronPromise, countPromise])
    .then(function(results) {
      var patron = results[0];
      var totalLoans = results[1];

      if (!patron) {
        var err = new Error('Patron not found');
        err.status = 404;
        return next(err);
      }

      var totalPages = Math.ceil(totalLoans / limit) || 1;
      res.render('patrons/update_patron', {
        patron: patron,
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

/* PUT update patron. */
router.put('/:id', function(req, res, next) {
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
      console.log('Updating patron:', patronId);
      return patron.update({ first_name: firstName, last_name: lastName, address: address, email: email, library_id: libraryId, zip_code: zipCode });
    })
    .then(function(patron) {
      res.redirect('/patrons');
    })
    .catch(function(error) {
      if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
        var errors = [];
        error.errors.forEach(function(err) { errors.push(err.message); });

        // Re-fetch patron with paginated Loans (so the view can use patron.Loans)
        var page = parseInt(req.query.page) || 1;
        var limit = 10;
        var offset = (page - 1) * limit;

        var countPromise = db.Loan.count({ where: { patron_id: patronId } });
        var patronWithLoansPromise = db.Patron.findByPk(patronId, {
          include: [
            {
              model: db.Loan,
              as: 'Loans',
              include: [ { model: db.Book, as: 'Book', required: false } ],
              separate: true,
              limit: limit,
              offset: offset,
              order: [['loaned_on', 'DESC']]
            }
          ]
        });

        return Promise.all([countPromise, patronWithLoansPromise])
          .then(function(results) {
            var totalLoans = results[0];
            var patronWithLoans = results[1];
            var totalPages = Math.ceil(totalLoans / limit) || 1;

            // Overwrite patron fields with the submitted form values
            patronWithLoans.first_name = firstName || patronWithLoans.first_name;
            patronWithLoans.last_name = lastName || patronWithLoans.last_name;
            patronWithLoans.address = address !== null ? address : patronWithLoans.address;
            patronWithLoans.email = email || patronWithLoans.email;
            patronWithLoans.library_id = libraryId || patronWithLoans.library_id;
            patronWithLoans.zip_code = zipCode !== null ? zipCode : patronWithLoans.zip_code;

            res.render('patrons/update_patron', {
              patron: patronWithLoans,
              errors: errors,
              currentPage: page,
              totalPages: totalPages,
              hasPrevious: page > 1,
              hasNext: page < totalPages
            });
          });
      } else {
        next(error);
      }
    });
});

module.exports = router;
