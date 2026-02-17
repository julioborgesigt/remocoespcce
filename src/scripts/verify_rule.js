// FORCE SQLITE IN-MEMORY FOR SAFETY
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';

const { sequelize, Cidade, Servidor, PedidoRemocao } = require('../models');
const { processarRemocao } = require('../services/algoritmoRemocao');

async function verifyRules() {
    try {
        await sequelize.sync({ force: true });
        console.log('Database synced.');

        const cA = await Cidade.create({ nome: 'Cidade A', vagas_iniciais: 1 });
        const cB = await Cidade.create({ nome: 'Cidade B', vagas_iniciais: 1 }); // Vaga target
        const cC = await Cidade.create({ nome: 'Cidade C', vagas_iniciais: 1 });

        // Servidor A: Mais antigo de ingresso, mas sem prioridade legal
        const sA = await Servidor.create({
            matricula: 'ANTIGO',
            nome: 'Sr. Antigo',
            senha_hash: 'hash',
            cidade_lotacao_id: cA.id,
            data_ingresso: '2010-01-01',
            data_posse_cargo: '2019-01-01'
        });

        // Servidor B: Mais novo de ingresso, mas com prioridade legal (Segurança)
        const sB = await Servidor.create({
            matricula: 'NOVO_PRIORITARIO',
            nome: 'Sr. Novo Prioritário',
            senha_hash: 'hash',
            cidade_lotacao_id: cC.id,
            data_ingresso: '2020-01-01',
            data_posse_cargo: '2020-01-01'
        });

        // Wait, 'motivo_prioridade' is on PedidoRemocao, not Servidor.
        // Let's create orders.

        console.log('Creating Orders...');

        // Both want to go to Cidade B (1 vaga)
        await PedidoRemocao.create({
            servidor_id: sA.id,
            opcao1_cidade_id: cB.id,
            status: 'pendente',
            motivo_prioridade: 'nenhum'
        });

        await PedidoRemocao.create({
            servidor_id: sB.id,
            opcao1_cidade_id: cB.id,
            status: 'pendente',
            motivo_prioridade: 'seguranca'
        });

        // ---------------------------------------------------------
        // TEST 1: Regra Antiguidade
        // ---------------------------------------------------------
        console.log('\n--- TEST 1: Regra Antiguidade ---');
        // Reset processed status shim (needs a reload or just rely on 'pendente' check in alg)
        // The algorithm fetches 'pendente' orders. created above.

        // We run in a transaction in the service, but here we want to peek.
        // Actually the service commits. So verify changes.

        // But wait, if I run one, the state changes.
        // I should probably reset between runs or run logic dry.
        // The service updates orders to 'atendido'.

        // Strategy: Run Antiguidade, check who won. Reset DB. Run Aprimorada, check who won.

        await processarRemocao('antiguidade');

        const pedA_1 = await PedidoRemocao.findOne({ where: { servidor_id: sA.id } });
        const pedB_1 = await PedidoRemocao.findOne({ where: { servidor_id: sB.id } });

        console.log('Antiguidade Result:');
        console.log(`Sr. Antigo (2010): ${pedA_1.status}`);
        console.log(`Sr. Novo (2020 + Segurança): ${pedB_1.status}`);

        if (pedA_1.status === 'atendido' && pedB_1.status !== 'atendido') {
            console.log('PASSED: Antiguidade respected (Oldest won).');
        } else {
            console.log('FAILED: Antiguidade unexpected result.');
        }

        // ---------------------------------------------------------
        // RESET FOR TEST 2
        // ---------------------------------------------------------
        await PedidoRemocao.update({ status: 'pendente', cidade_destino_final_id: null, observacao: null }, { where: {} });
        await Cidade.update({ vagas_iniciais: 1 }, { where: { id: cB.id } }); // Reset vagas if logic consumed it?
        // Logic uses 'vagas' map initialized from DB.
        // But if 'atendido', server won't pick it up. Resetting to 'pendente' is enough.

        console.log('\n--- TEST 2: Regra Aprimorada ---');
        await processarRemocao('aprimorada');

        const pedA_2 = await PedidoRemocao.findOne({ where: { servidor_id: sA.id } });
        const pedB_2 = await PedidoRemocao.findOne({ where: { servidor_id: sB.id } });

        console.log('Aprimorada Result:');
        console.log(`Sr. Antigo (2010): ${pedA_2.status}`);
        console.log(`Sr. Novo (2020 + Segurança): ${pedB_2.status}`);

        if (pedB_2.status === 'atendido' && pedA_2.status !== 'atendido') {
            console.log('PASSED: Aprimorada respected (Priority won).');
        } else {
            console.log('FAILED: Aprimorada unexpected result.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sequelize.close();
    }
}

verifyRules();
