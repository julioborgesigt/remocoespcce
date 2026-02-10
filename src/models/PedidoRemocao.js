const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PedidoRemocao = sequelize.define('PedidoRemocao', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    servidor_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'servidores', key: 'id' }
    },
    opcao1_cidade_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'cidades', key: 'id' },
      comment: '1ª opção de destino'
    },
    opcao2_cidade_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: 'cidades', key: 'id' },
      comment: '2ª opção de destino'
    },
    opcao3_cidade_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: 'cidades', key: 'id' },
      comment: '3ª opção de destino'
    },
    status: {
      type: DataTypes.ENUM('pendente', 'atendido', 'nao_atendido'),
      allowNull: false,
      defaultValue: 'pendente'
    },
    cidade_destino_final_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: 'cidades', key: 'id' },
      comment: 'Cidade para onde foi efetivamente removido'
    },
    observacao: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Detalhes do processamento'
    }
  }, {
    tableName: 'pedidos_remocao',
    indexes: [
      { unique: true, fields: ['servidor_id'] },
      { fields: ['status'] }
    ]
  });

  return PedidoRemocao;
};
