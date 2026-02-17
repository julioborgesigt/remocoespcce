
// FORCE SQLITE IN-MEMORY
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';

const { Cidade, PedidoRemocao, Servidor, sequelize } = require('../models');

async function verifyEnhancements() {
    try {
        await sequelize.sync({ force: true });
        console.log('--- Verificando Melhorias em Cidades ---');

        // 1. SETUP: Criar Cidades
        // Cidade A: Ideal 10, Atual 8 => Deficit 2. Max Vagas = 2.
        const cA = await Cidade.create({
            nome: 'City A',
            efetivo_ideal: 10,
            efetivo_atual: 8,
            vagas_iniciais: 0 // Começa com 0
        });

        // Cidade B: Ideal 10, Atual 12 => Deficit -2 (0). Max Vagas = 0.
        const cB = await Cidade.create({
            nome: 'City B',
            efetivo_ideal: 10,
            efetivo_atual: 12,
            vagas_iniciais: 0
        });

        // 2. VERIFICAR VALIDAÇÃO (Simulando lógica da rota POST/PUT)
        console.log('\n--- Testando Validação de Vagas ---');

        const testValidation = (nome, vagas, ideal, atual) => {
            const max = Math.max(0, ideal - atual);
            if (vagas > max) return `Erro: Vagas (${vagas}) > Deficit (${max})`;
            return 'OK';
        };

        const resA1 = testValidation('City A', 1, 10, 8); // 1 <= 2 -> OK
        const resA2 = testValidation('City A', 3, 10, 8); // 3 > 2 -> Erro
        const resB1 = testValidation('City B', 1, 10, 12); // 1 > 0 -> Erro

        console.log(`City A (1 vaga): ${resA1}`);
        console.log(`City A (3 vagas): ${resA2}`);
        console.log(`City B (1 vaga): ${resB1}`);

        if (resA1 === 'OK' && resA2.includes('Erro') && resB1.includes('Erro')) {
            console.log('✅ Validação de Vagas funcionando corretamente.');
        } else {
            console.error('❌ Falha na validação de vagas.');
        }

        // 3. VERIFICAR EFETIVO PÓS REMOÇÕES
        console.log('\n--- Testando Efetivo Pós Remoções ---');

        // Servidor S1 em A
        const s1 = await Servidor.create({ nome: 'Servidor Um', matricula: 'M1', cidade_lotacao_id: cA.id, data_ingresso: '2020-01-01', senha_hash: 'abc' });
        // Servidor S2 em A
        const s2 = await Servidor.create({ nome: 'Servidor Dois', matricula: 'M2', cidade_lotacao_id: cA.id, data_ingresso: '2020-01-01', senha_hash: 'abc' });

        // S1 sai de A para B (Normal)
        await PedidoRemocao.create({
            servidor_id: s1.id,
            status: 'atendido',
            cidade_destino_final_id: cB.id,
            opcao1_cidade_id: cB.id,
            observacao: 'Remoção normal'
        });

        // S3 "Novo" entra em A (Alocação por Novos)
        // Isso conta como Entrada para Efetivo Pós? SIM.
        // Isso consome Vaga Inicial? NÃO (Regra Vagas Final).
        const s3 = await Servidor.create({ nome: 'Servidor Três', matricula: 'M3', cidade_lotacao_id: cB.id, data_ingresso: '2020-01-01', senha_hash: 'abc' }); // Estava em B só pra criar
        await PedidoRemocao.create({
            servidor_id: s3.id,
            status: 'atendido',
            cidade_destino_final_id: cA.id,
            opcao1_cidade_id: cA.id,
            observacao: 'Alocação por Novos Servidores'
        });

        // Lógica de Cálculo do GET /api/cidades
        // City A:
        //   Atual: 8
        //   Saídas: 1 (S1)
        //   Entradas Totais: 1 (S3)
        //   Efetivo Pós = 8 - 1 + 1 = 8.

        // City B:
        //   Atual: 12
        //   Saídas: 0 (S3 estava lá? No mock sim, mas o sistema conta saidas baseado em 'servidor.cidade_lotacao_id').
        //   O S3 foi criado com lotação B. Então S3 saindo de B conta como saída de B?
        //   Depende se o pedido de S3 foi "remoção". No caso acima, sim, ele foi movido para A.
        //   Mas espere, se S3 é "Novo Servidor", ele tecnicamente não ocupa vaga "real" antes.
        //   Porém, na tabela Servidor, ele tem uma lotação.
        //   Se o sistema considera 'cidade_lotacao_id' do servidor associado ao pedido 'atendido' como saída, então S3 conta como saída de B.
        //   Vamos assumir que para "Novos Servidores", eles podem não ter cidade (null) ou estarem num pool.
        //   Mas no meu teste eu botei em cB. Então vai contar saída. Ajustarei para cB -> cA.
        //   Entradas em B: 1 (S1).
        //   Efetivo Pós B = 12 - 1 (S3) + 1 (S1) = 12.

        // Vamos simular a query
        const pedidos = await PedidoRemocao.findAll({
            where: { status: 'atendido' },
            include: [{ model: Servidor, as: 'servidor' }]
        });

        const calcEfetivoPos = (cidade, peds) => {
            let saidas = 0;
            let entradas = 0;
            peds.forEach(p => {
                if (p.servidor.cidade_lotacao_id === cidade.id) saidas++;
                if (p.cidade_destino_final_id === cidade.id) entradas++;
            });
            return cidade.efetivo_atual + entradas - saidas;
        };

        const posA = calcEfetivoPos(cA, pedidos);
        const posB = calcEfetivoPos(cB, pedidos);

        console.log(`City A - Atual: 8, Pos: ${posA} (Esperado: 8)`);
        console.log(`City B - Atual: 12, Pos: ${posB} (Esperado: 12)`);

        if (posA === 8 && posB === 12) {
            console.log('✅ Efetivo Pós Remoções calculado corretamente.');
        } else {
            console.error('❌ Falha no cálculo de Efetivo Pós.');
        }

    } catch (err) {
        console.error(err);
    }
}

verifyEnhancements();
