'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Loan extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Loan belongs to Book
      Loan.belongsTo(models.Book, {
        foreignKey: 'book_id',
        as: 'Book'
      });
      // Loan belongs to Patron
      Loan.belongsTo(models.Patron, {
        foreignKey: 'patron_id',
        as: 'Patron'
      });
    }
  }
  Loan.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    book_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
        validate: {
          notNull: {
            msg: 'Book ID is required'
          },
          notEmpty: {
            msg: 'Please select a book to loan'
          }
        }
    },
    patron_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notNull: {
          msg: 'Patron ID is required'
        },
        notEmpty: {
          msg: 'Please select a patron for the loan'
        }
      }
    },
    loaned_on: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    return_by: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    returned_on: {
      type: DataTypes.DATEONLY,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Loan',
    timestamps: false,
  });
  return Loan;
};

