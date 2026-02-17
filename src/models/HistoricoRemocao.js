const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const HistoricoRemocao = sequelize.define('HistoricoRemocao', {
        temporada_data: {
            type: DataTypes.DATE,
            allowNull: false
        },
        servidor_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false
        },
        matricula: {
            type: DataTypes.STRING,
            allowNull: false
        },
        nome: {
            type: DataTypes.STRING,
            allowNull: false
        },
        cidade_origem_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true
        },
        cidade_destino_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true
        },
        status: {
            type: DataTypes.STRING, // 'atendido', 'nao_atendido'
            allowNull: false
        },
        observacao: {
            type: DataTypes.STRING,
            allowNull: true
        },
        detalhes_json: {
            type: DataTypes.TEXT, // Para armazenar opções escolhidas se nao atendido, etc
            allowNull: true
        }
    }, {
        tableName: 'historico_remocoes',
        underscored: true,
        timestamps: true
    });

    HistoricoRemocao.associate = (models) => {
        HistoricoRemocao.belongsTo(models.Servidor, { foreignKey: 'servidor_id', as: 'servidor' });
        HistoricoRemocao.belongsTo(models.Cidade, { foreignKey: 'cidade_origem_id', as: 'cidadeOrigem' });
        HistoricoRemocao.belongsTo(models.Cidade, { foreignKey: 'cidade_destino_id', as: 'cidadeDestino' });
    };

    return HistoricoRemocao;
};
