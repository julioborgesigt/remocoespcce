require('dotenv').config();
const { sequelize } = require('../models');

async function addColumn() {
    try {
        await sequelize.authenticate();
        console.log('Autenticado com sucesso.');

        const queryInterface = sequelize.getQueryInterface();
        const tableDesc = await queryInterface.describeTable('cidades');

        if (!tableDesc.efetivo_pos) {
            console.log('Adicionando coluna efetivo_pos...');
            await queryInterface.addColumn('cidades', 'efetivo_pos', {
                type: 'INTEGER',
                allowNull: true,
                defaultValue: null
            });
            console.log('Coluna adicionada com sucesso.');
        } else {
            console.log('Coluna efetivo_pos já existe.');
        }

        process.exit(0);
    } catch (error) {
        console.error('Erro ao adicionar coluna:', error);
        process.exit(1);
    }
}

addColumn();
