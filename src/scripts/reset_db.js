require('dotenv').config();
const { sequelize } = require('../models');

async function reset() {
    try {
        console.log('🔄 Iniciando reset do banco de dados...');
        await sequelize.authenticate();

        // Desabilitar verificação de FK para permitir drops em qualquer ordem
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');

        console.log('🗑️ Dropping tables...');
        // Lista de tabelas para garantir limpeza total
        const tables = [
            'historico_remocoes',
            'pedidos_remocao',
            'servidores',
            'cidades',
            'configuracoes' // ou 'Configs' dependendo do nome no banco
        ];

        for (const table of tables) {
            try {
                await sequelize.query(`DROP TABLE IF EXISTS \`${table}\``);
                console.log(`   - ${table} apagada.`);
            } catch (e) {
                console.log(`   - Erro ao apagar ${table} (ignorável): ${e.message}`);
            }
        }

        // Reabilitar FK
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

        console.log('✨ Tabelas limpas. Sincronizando schema...');
        // Sincronizar (criar tabelas do zero)
        await sequelize.sync({ force: true });

        console.log('✅ Banco de dados resetado e recriado com sucesso!');
        console.log('👉 Se necessário, rode os seeders agora para popular os dados.');

    } catch (err) {
        console.error('❌ Erro fatal:', err);
    } finally {
        await sequelize.close();
    }
}

reset();
