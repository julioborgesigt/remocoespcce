const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Cidade = sequelize.define('Cidade', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    nome: {
      type: DataTypes.STRING(120),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: { msg: 'Nome da cidade é obrigatório.' },
        len: { args: [2, 120], msg: 'Nome deve ter entre 2 e 120 caracteres.' }
      }
    },
    vagas_iniciais: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: { args: [0], msg: 'Vagas não podem ser negativas.' }
      }
    }
  }, {
    tableName: 'cidades',
    indexes: [
      { unique: true, fields: ['nome'] }
    ]
  });

  return Cidade;
};
