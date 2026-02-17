// FORCE SQLITE IN-MEMORY FOR SAFETY
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';

const { sequelize, Cidade, Servidor, PedidoRemocao } = require('../models');
const { processarRemocao } = require('../services/algoritmoRemocao');

async function reproIssue() {
    try {
        await sequelize.sync({ force: true });
        console.log('Database synced.');

        // ── SCENARIO 1: Direct Competition (The "Is it broken?" test) ──
        console.log('\n--- SCENARIO 1: Direct Competition (Priority vs Seniority) ---');

        // Create base cities - Target has 1 vacancy
        const cityOrigin = await Cidade.create({ nome: 'Origem Comum', vagas_iniciais: 10 });
        const cityTarget = await Cidade.create({ nome: 'Destino Disputado', vagas_iniciais: 1 });

        // User A: Priority 'unidade_familiar', Seniority 2015
        const sPriority = await Servidor.create({
            matricula: 'PRIORIDADE',
            nome: 'Servidor Prioridade (Unidade Familiar)',
            senha_hash: 'hash',
            cidade_lotacao_id: cityOrigin.id,
            data_ingresso: '2015-01-01',
            data_posse_cargo: '2015-01-01'
        });

        // User B: Priority 'nenhum', Seniority 2010 (More Senior)
        const sSenior = await Servidor.create({
            matricula: 'ANTIGO',
            nome: 'Servidor Antigo (Sem Prioridade)',
            senha_hash: 'hash',
            cidade_lotacao_id: cityOrigin.id,
            data_ingresso: '2010-01-01',
            data_posse_cargo: '2010-01-01'
        });

        // Requests
        await PedidoRemocao.create({
            servidor_id: sPriority.id,
            opcao1_cidade_id: cityTarget.id,
            motivo_prioridade: 'unidade_familiar',
            status: 'pendente'
        });

        await PedidoRemocao.create({
            servidor_id: sSenior.id,
            opcao1_cidade_id: cityTarget.id,
            motivo_prioridade: 'nenhum',
            status: 'pendente'
        });

        // Run Algorithm with 'aprimorada'
        const result1 = await processarRemocao('aprimorada');

        // Refresh
        const resPriority = await PedidoRemocao.findOne({ where: { servidor_id: sPriority.id } });
        const resSenior = await PedidoRemocao.findOne({ where: { servidor_id: sSenior.id } });

        console.log(`Unidade Familiar (2015): ${resPriority.status} (${resPriority.observacao})`);
        console.log(`Sem Prioridade (2010): ${resSenior.status} (${resSenior.observacao})`);

        // ── SCENARIO 2: Permutation Bypass (Strict Cycle) ──
        console.log('\n--- SCENARIO 2: Permutation Bypass (Strict Cycle) ---');
        // Wipe DB
        await PedidoRemocao.destroy({ where: {}, truncate: true });
        await Servidor.destroy({ where: {}, truncate: true });
        await Cidade.destroy({ where: {}, truncate: true });

        // EVERYTHING IS FULL (0 vacancies)
        const cA = await Cidade.create({ nome: 'Cidade A', vagas_iniciais: 0 });
        const cB = await Cidade.create({ nome: 'Cidade B', vagas_iniciais: 0 });
        const cTarget = await Cidade.create({ nome: 'Cidade Alvo', vagas_iniciais: 0 });

        // User A: High Priority (Seguranca), in A, wants Target
        const uA = await Servidor.create({
            matricula: 'USER_A',
            nome: 'User A (Priority)',
            senha_hash: 'hash',
            cidade_lotacao_id: cA.id,
            data_ingresso: '2015-01-01',
            data_posse_cargo: '2015-01-01'
        });
        // Wants Target.
        await PedidoRemocao.create({ servidor_id: uA.id, opcao1_cidade_id: cTarget.id, motivo_prioridade: 'seguranca', status: 'pendente' });

        // User B: No Priority, in B, wants Target
        const uB = await Servidor.create({
            matricula: 'USER_B',
            nome: 'User B (No Priority)',
            senha_hash: 'hash',
            cidade_lotacao_id: cB.id,
            data_ingresso: '2020-01-01', // Junior
            data_posse_cargo: '2020-01-01'
        });
        // Wants Target.
        await PedidoRemocao.create({ servidor_id: uB.id, opcao1_cidade_id: cTarget.id, motivo_prioridade: 'nenhum', status: 'pendente' });

        // User C: In Target, wants B (Matches User B!)
        const uC = await Servidor.create({
            matricula: 'USER_C',
            nome: 'User C (In Target)',
            senha_hash: 'hash',
            cidade_lotacao_id: cTarget.id,
            data_ingresso: '2018-01-01',
            data_posse_cargo: '2018-01-01'
        });
        // Wants B.
        await PedidoRemocao.create({ servidor_id: uC.id, opcao1_cidade_id: cB.id, motivo_prioridade: 'nenhum', status: 'pendente' });

        console.log("Running processing...");
        await processarRemocao('aprimorada');

        const rA = await PedidoRemocao.findOne({ where: { servidor_id: uA.id } });
        const rB = await PedidoRemocao.findOne({ where: { servidor_id: uB.id } });
        const rC = await PedidoRemocao.findOne({ where: { servidor_id: uC.id } });

        console.log(`User A (Priority, wants Target): ${rA.status} (${rA.observacao})`);
        console.log(`User B (No Priority, wants Target): ${rB.status} (${rB.observacao})`);
        console.log(`User C (In Target, wants B): ${rC.status} (${rC.observacao})`);

        // Only B and C should move because they form a cycle: B->Target->B
        // A cannot enter the cycle.
        if (rA.status !== 'atendido' && rB.status === 'atendido' && rC.status === 'atendido') {
            console.log('✅ PASS: Strict Permuta happened. B and C swapped. A was excluded properly despite priority.');
            console.log('ℹ️ EXPLANATION: B offered a seat in City B that C wanted. A offered a seat in City A that nobody wanted.');
        } else {
            console.log('❓ Unexpected outcome.');
        }
    } catch (err) {
        console.error(err);
    }
}

reproIssue();
