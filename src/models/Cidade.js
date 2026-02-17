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
    },
    efetivo_ideal: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: { args: [0], msg: 'Efetivo ideal não pode ser negativo.' }
      }
    },
    efetivo_atual: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: { args: [0], msg: 'Efetivo atual não pode ser negativo.' }
      }
    },
    efetivo_pos: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment: 'Simulação do efetivo após processamento (antes de fechar temporada)'
    }
  }, {
    tableName: 'cidades'
  });

  return Cidade;
};
