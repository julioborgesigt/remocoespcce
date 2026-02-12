const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Servidor = sequelize.define('Servidor', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    matricula: {
      type: DataTypes.STRING(30),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: { msg: 'Matrícula é obrigatória.' }
      }
    },
    nome: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Nome é obrigatório.' },
        len: { args: [3, 150], msg: 'Nome deve ter entre 3 e 150 caracteres.' }
      }
    },
    senha_hash: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    data_ingresso: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        isDate: { msg: 'Data de ingresso inválida.' },
        naoFutura(value) {
          const amanha = new Date();
          amanha.setDate(amanha.getDate() + 1);
          if (new Date(value) >= amanha) {
            throw new Error('Data de ingresso não pode ser futura.');
          }
        }
      }
    },
    cidade_lotacao_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'cidades', key: 'id' }
    },
    perfil: {
      type: DataTypes.ENUM('admin', 'usuario'),
      allowNull: false,
      defaultValue: 'usuario'
    }
  }, {
    tableName: 'servidores',
    indexes: [
      { unique: true, fields: ['matricula'] },
      { fields: ['cidade_lotacao_id'] },
      { fields: ['data_ingresso'] }
    ]
  });

  return Servidor;
};
