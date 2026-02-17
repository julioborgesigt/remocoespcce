// Verify Distribution Config Logic
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';

const { sequelize, Configuracao } = require('../models');

async function verify() {
    try {
        await sequelize.sync({ force: true });

        // 1. Initial State
        let config = await Configuracao.findOne({ where: { chave: 'total_novos_servidores' } });
        console.log(`Initial: ${config?.valor_texto}`); // Expect undefined

        // 2. Create Config
        await Configuracao.create({
            chave: 'total_novos_servidores',
            valor_texto: '100',
            descricao: 'Teste'
        });

        // 3. Update Logic (Simulate route logic)
        config = await Configuracao.findOne({ where: { chave: 'total_novos_servidores' } });
        if (config) {
            config.valor_texto = '105';
            await config.save();
        }

        // 4. Check Final
        const finalConfig = await Configuracao.findOne({ where: { chave: 'total_novos_servidores' } });
        console.log(`Final: ${finalConfig.valor_texto}`);

        if (finalConfig.valor_texto === '105') {
            console.log('✅ PASS: Config saving correctly.');
        } else {
            console.log('❌ FAIL: Config not updated.');
        }

    } catch (err) {
        console.error(err);
    }
}

verify();
