'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Patron extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Patron has many Loans
      Patron.hasMany(models.Loan, {
        foreignKey: 'patron_id',
        as: 'Loans'
      });
    }
  }
  Patron.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    first_name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'First Name is required'
        }
      }
    },
    last_name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Last Name is required'
        }
      }
    },
    address: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        notEmpty: {
          msg: 'Address is required'
        }
      }
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: true,
        notEmpty: {
          msg: 'Email is required'
        }
      }
    },
    library_id: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: {
          msg: 'Library ID is required'
        }
      }
    },  
    zip_code: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isNumeric: {
          msg: 'Zip Code must be a number'
        },
        notEmpty: {
          msg: 'Zip Code is required'
        }
      }
    }
  }, {
    sequelize,
    modelName: 'Patron',
    timestamps: false,
  });
  return Patron;
};

