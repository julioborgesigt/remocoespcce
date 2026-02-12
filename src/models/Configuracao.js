const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Configuracao = sequelize.define('Configuracao', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    chave: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    valor_texto: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    valor_data: {
      type: DataTypes.DATE,
      allowNull: true
    },
    descricao: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    tableName: 'configuracoes',
    timestamps: true
  });

  return Configuracao;
};
