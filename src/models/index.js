const sequelize = require('../config/database');

// Importa e inicializa cada model
const Cidade = require('./Cidade')(sequelize);
const Servidor = require('./Servidor')(sequelize);
const PedidoRemocao = require('./PedidoRemocao')(sequelize);
const Configuracao = require('./Configuracao')(sequelize);

// ── Associações ────────────────────────────────────────────

// Servidor pertence a uma Cidade (lotação atual)
Servidor.belongsTo(Cidade, {
  foreignKey: 'cidade_lotacao_id',
  as: 'cidadeLotacao'
});
Cidade.hasMany(Servidor, {
  foreignKey: 'cidade_lotacao_id',
  as: 'servidoresLotados'
});

// PedidoRemocao pertence a um Servidor
PedidoRemocao.belongsTo(Servidor, {
  foreignKey: 'servidor_id',
  as: 'servidor'
});
Servidor.hasOne(PedidoRemocao, {
  foreignKey: 'servidor_id',
  as: 'pedido'
});

// PedidoRemocao → Opções de cidade
PedidoRemocao.belongsTo(Cidade, { foreignKey: 'opcao1_cidade_id', as: 'opcao1' });
PedidoRemocao.belongsTo(Cidade, { foreignKey: 'opcao2_cidade_id', as: 'opcao2' });
PedidoRemocao.belongsTo(Cidade, { foreignKey: 'opcao3_cidade_id', as: 'opcao3' });
PedidoRemocao.belongsTo(Cidade, { foreignKey: 'cidade_destino_final_id', as: 'destinoFinal' });

module.exports = {
  sequelize,
  Cidade,
  Servidor,
  PedidoRemocao,
  Configuracao
};
