require('dotenv').config();
const { sequelize } = require('../models');

async function fix() {
    try {
        await sequelize.authenticate();
        console.log('✅ Conexão estabelecida.');

        // 1. Listar Indexes
        const [results] = await sequelize.query("SHOW INDEX FROM cidades");
        console.log(`🔍 Total de índices encontrados: ${results.length}`);

        // Filtrar índices que não são PRIMARY
        // Agrupar por nome para não tentar deletar o mesmo index múltiplas vezes (embora DROP INDEX seja por nome)
        const indexNames = [...new Set(results
            .filter(idx => idx.Key_name !== 'PRIMARY')
            .map(idx => idx.Key_name))];

        console.log(`🗑️ Encontrados ${indexNames.length} índices para remover.`);

        // 2. Remover Indexes Excessivos
        for (const indexName of indexNames) {
            try {
                console.log(`Dropping index: ${indexName}...`);
                await sequelize.query(`DROP INDEX \`${indexName}\` ON cidades`);
            } catch (e) {
                // Ignorar erro se o índice já não existir ou outro erro menor
                console.log(`⚠️ Erro ao remover ${indexName}: ${e.message}`);
            }
        }

        console.log('✅ Limpeza de índices concluída. O sequelize.sync deve recriar apenas o necessário agora.');

    } catch (err) {
        console.error('❌ Erro fatal:', err);
    } finally {
        await sequelize.close();
    }
}

fix();
