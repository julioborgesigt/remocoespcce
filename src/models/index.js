const sequelize = require('../config/database');

// Importa e inicializa cada model
const Cidade = require('./Cidade')(sequelize);
const Servidor = require('./Servidor')(sequelize);
const PedidoRemocao = require('./PedidoRemocao')(sequelize);
const Configuracao = require('./Configuracao')(sequelize);
const HistoricoRemocao = require('./HistoricoRemocao')(sequelize);

// ── Associações ────────────────────────────────────────────

// Initialize associations if defined (Universal method)
[Cidade, Servidor, PedidoRemocao, Configuracao, HistoricoRemocao].forEach(model => {
  if (model.associate) {
    model.associate({ Cidade, Servidor, PedidoRemocao, Configuracao, HistoricoRemocao });
  }
});

// Associações Manuais (Legado - Mantendo para garantir compatibilidade se usadas diretamente)
// Servidor pertence a uma Cidade (lotação atual)
Servidor.belongsTo(Cidade, {
  foreignKey: 'cidade_lotacao_id',
  as: 'cidadeLotacao',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE'
});
Cidade.hasMany(Servidor, {
  foreignKey: 'cidade_lotacao_id',
  as: 'servidoresLotados'
});

// PedidoRemocao pertence a um Servidor
PedidoRemocao.belongsTo(Servidor, {
  foreignKey: 'servidor_id',
  as: 'servidor',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});
Servidor.hasOne(PedidoRemocao, {
  foreignKey: 'servidor_id',
  as: 'pedido'
});

// PedidoRemocao → Opções de cidade
PedidoRemocao.belongsTo(Cidade, { foreignKey: 'opcao1_cidade_id', as: 'opcao1', onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
PedidoRemocao.belongsTo(Cidade, { foreignKey: 'opcao2_cidade_id', as: 'opcao2', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
PedidoRemocao.belongsTo(Cidade, { foreignKey: 'opcao3_cidade_id', as: 'opcao3', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
PedidoRemocao.belongsTo(Cidade, { foreignKey: 'cidade_destino_final_id', as: 'destinoFinal', onDelete: 'SET NULL', onUpdate: 'CASCADE' });

module.exports = {
  sequelize,
  Cidade,
  Servidor,
  PedidoRemocao,
  Configuracao,
  HistoricoRemocao
};
