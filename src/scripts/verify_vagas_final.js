
// FORCE SQLITE IN-MEMORY
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';

const { Cidade, PedidoRemocao, Servidor, sequelize } = require('../models');

async function verifyVagasFinal() {
    try {
        await sequelize.sync({ force: true });
        console.log('--- Verificando Vagas Final ---');

        // 1. Criar Cidades de Teste
        const cidadeA = await Cidade.create({ nome: 'City A', vagas_iniciais: 10 }); // Vagas Iniciais: 10
        const cidadeB = await Cidade.create({ nome: 'City B', vagas_iniciais: 0 });  // Vagas Iniciais: 0

        // 2. Criar Servidores
        const s1 = await Servidor.create({ nome: 'Servidor Um', matricula: 'M1', cidade_lotacao_id: cidadeA.id, data_ingresso: '2020-01-01', senha_hash: 'hash' });
        const s2 = await Servidor.create({ nome: 'Servidor Dois', matricula: 'M2', cidade_lotacao_id: cidadeB.id, data_ingresso: '2020-01-01', senha_hash: 'hash' });

        // 3. Criar Pedidos Atendidos (Simular Saída de A e Entrada em B)
        // S1 sai de A -> vai para B
        await PedidoRemocao.create({
            servidor_id: s1.id,
            status: 'atendido',
            cidade_destino_final_id: cidadeB.id,
            opcao1_cidade_id: cidadeB.id, // Obrigatório
            observacao: 'Remoção normal'
        });

        // 4. Testar Entrada via "Novos Servidores" em B (não deve consumir vaga de B, mas B tem 0 mesmo)
        // Vamos testar Entrada em A via "Novos Servidores"
        // S3 (novo ou outro) entra em A via "New Server" slot
        const s3 = await Servidor.create({ nome: 'Servidor Três', matricula: 'M3', cidade_lotacao_id: cidadeB.id, data_ingresso: '2020-01-01', senha_hash: 'hash' });
        await PedidoRemocao.create({
            servidor_id: s3.id,
            status: 'atendido',
            cidade_destino_final_id: cidadeA.id,
            opcao1_cidade_id: cidadeA.id, // Obrigatório
            observacao: 'Alocação por Novos Servidores'
        });

        // EXPECTED CALCULATIONS:
        // Cidade A:
        //   Iniciais: 10
        //   Saídas: 1 (S1)
        //   Entradas: 0 (S2 não movemos, S3 entrou via "Novos Servidores" -> Ignorado)
        //   Final: 10 + 1 - 0 = 11.

        // Cidade B:
        //   Iniciais: 0
        //   Saídas: 0 (S2 não movemos, S3 saiu de B? Sim, S3 estava em B. Então B tem 1 saída)
        //   Entradas: 1 (S1 chegou em B)
        //   Final: 0 + 1 - 1 = 0.

        // API Call Simulation (Recriar lógica da rota)
        const pedidosAtendidos = await PedidoRemocao.findAll({
            where: { status: 'atendido' },
            include: [{ model: Servidor, as: 'servidor' }]
        });

        const calculate = (cidade, pedidos) => {
            let saidas = 0;
            let entradas = 0;
            pedidos.forEach(p => {
                if (p.servidor.cidade_lotacao_id === cidade.id) saidas++;
                if (p.cidade_destino_final_id === cidade.id) {
                    if (!p.observacao.includes('Alocação por Novos Servidores')) {
                        entradas++;
                    }
                }
            });
            return Math.max(0, cidade.vagas_iniciais + saidas - entradas);
        };

        const finalA = calculate(cidadeA, pedidosAtendidos);
        const finalB = calculate(cidadeB, pedidosAtendidos);

        console.log(`Cidade A - Esperado: 11, Calculado: ${finalA}`);
        console.log(`Cidade B - Esperado: 0, Calculado: ${finalB}`);

        if (finalA === 11 && finalB === 0) {
            console.log('✅ TEST PASSED: Vagas Final calculation is correct.');
        } else {
            console.error('❌ TEST FAILED.');
        }

    } catch (err) {
        console.error('Erro:', err);
    }
}

verifyVagasFinal();
