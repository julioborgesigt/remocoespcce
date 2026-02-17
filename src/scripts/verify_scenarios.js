// FORCE SQLITE IN-MEMORY
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';

const { sequelize, Cidade, Servidor, PedidoRemocao } = require('../models');
const { processarRemocao } = require('../services/algoritmoRemocao');

async function verifyScenarios() {
    try {
        await sequelize.sync({ force: true });
        console.log('Database synced.');

        // ── SCENARIO A: No New Servers (Strict Cycle) ──
        console.log('\n--- SCENARIO A: No New Servers (Strict Cycle) ---');
        // Expect: A stuck, B swaps with C.

        const cA = await Cidade.create({ nome: 'Cidade A', vagas_iniciais: 0, efetivo_ideal: 10 });
        const cB = await Cidade.create({ nome: 'Cidade B', vagas_iniciais: 0, efetivo_ideal: 10 });
        const cTarget = await Cidade.create({ nome: 'Cidade Alvo', vagas_iniciais: 0, efetivo_ideal: 10 });

        // User A: High Priority (Seguranca), in A, wants Target
        const uA = await Servidor.create({
            matricula: 'USER_A',
            nome: 'User A (Priority)',
            cidade_lotacao_id: cA.id,
            data_ingresso: '2015-01-01',
            senha_hash: 'hash'
        });
        // Wants Target.
        await PedidoRemocao.create({ servidor_id: uA.id, opcao1_cidade_id: cTarget.id, motivo_prioridade: 'seguranca', status: 'pendente' });

        // User B: No Priority, in B, wants Target
        const uB = await Servidor.create({
            matricula: 'USER_B',
            nome: 'User B (No Priority)',
            cidade_lotacao_id: cB.id,
            data_ingresso: '2020-01-01',
            senha_hash: 'hash'
        });
        // Wants Target.
        await PedidoRemocao.create({ servidor_id: uB.id, opcao1_cidade_id: cTarget.id, motivo_prioridade: 'nenhum', status: 'pendente' });

        // User C: In Target, wants B (Matches User B!)
        const uC = await Servidor.create({
            matricula: 'USER_C',
            nome: 'User C (In Target)',
            cidade_lotacao_id: cTarget.id,
            data_ingresso: '2018-01-01',
            senha_hash: 'hash'
        });
        // Wants B.
        await PedidoRemocao.create({ servidor_id: uC.id, opcao1_cidade_id: cB.id, motivo_prioridade: 'nenhum', status: 'pendente' });

        console.log("Running processing (Novos = 0)...");
        await processarRemocao('aprimorada', 0);

        let rA = await PedidoRemocao.findOne({ where: { servidor_id: uA.id } });
        let rB = await PedidoRemocao.findOne({ where: { servidor_id: uB.id } });
        let rC = await PedidoRemocao.findOne({ where: { servidor_id: uC.id } });

        console.log(`User A (Priority): ${rA.status}`);
        console.log(`User B (No Priority): ${rB.status}`);
        console.log(`User C (Swap Partner): ${rC.status}`);

        if (rA.status !== 'atendido' && rB.status === 'atendido') {
            console.log('✅ PASS Scen A: Priority stuck, Swap happened.');
        } else {
            console.log('❌ FAIL Scen A.');
        }


        // ── SCENARIO B: With New Servers ──
        console.log('\n--- SCENARIO B: With New Servers (Novos = 1, Ideal = 10) ---');
        // Reset Data
        await PedidoRemocao.update({ status: 'pendente', observacao: null, cidade_destino_final_id: null }, { where: {} });

        // Now we have 1 New Server available.
        // Target City has 1 current server (uC) and Ideal is 10. So it HAS space (1 < 10).
        // User A (Priority) should grab this "New Server" slot because he is evaluated first/highest priority.
        // User B and C should still swap because C wants B and B wants Target.
        // BUT wait, does B still finding a spot in Target? 
        // Target had 0 real vacancies. uA takes 1 "New" slot.
        // uC leaves Target (to go to B). That opens a REAL vacancy in Target?
        // If uC swaps with uB, uB takes uC's spot.
        // So uA takes "New Slot", uB takes "uC's Slot". Everyone moves!

        console.log("Running processing (Novos = 1)...");
        await processarRemocao('aprimorada', 1);

        rA = await PedidoRemocao.findOne({ where: { servidor_id: uA.id } });
        rB = await PedidoRemocao.findOne({ where: { servidor_id: uB.id } });
        rC = await PedidoRemocao.findOne({ where: { servidor_id: uC.id } });

        console.log(`User A (Priority): ${rA.status} (${rA.observacao})`);
        console.log(`User B (No Priority): ${rB.status} (${rB.observacao})`);
        console.log(`User C (Swap Partner): ${rC.status} (${rC.observacao})`);

        if (rA.status === 'atendido' && rB.status === 'atendido' && rC.status === 'atendido') {
            console.log('✅ PASS Scen B: Everyone moved! A used New Server, B & C swapped.');
        } else {
            console.log('❌ FAIL Scen B.');
        }

    } catch (err) {
        console.error(err);
    }
}

verifyScenarios();
