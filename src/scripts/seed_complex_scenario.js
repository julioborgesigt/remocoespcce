require('dotenv').config();
const { sequelize, Cidade, Servidor, PedidoRemocao, Configuracao, HistoricoRemocao } = require('../models');

async function seedComplexScenario() {
    const transaction = await sequelize.transaction();
    try {
        console.log('🔄 Cleaning up database (preserving Admin and Cidades)...');

        // 1. Limpar tabelas dependentes
        await HistoricoRemocao.destroy({ where: {}, transaction });
        await PedidoRemocao.destroy({ where: {}, transaction });

        // 2. Remover apenas servidores comuns (preservar admin)
        // Assumindo que admin tem perfil 'admin' ou outro. Se não tiver diferenciação clara, 
        // o ideal seria pelo ID ou username, mas 'perfil: usuario' deve cobrir os testes.
        await Servidor.destroy({ where: { perfil: 'usuario' }, transaction });

        console.log('🔄 Preparing Cidades (Upserting)...');

        const cidadesDefinicoes = [
            { nome: 'Fortaleza', vagas_iniciais: 0, efetivo_atual: 50, efetivo_ideal: 50 },
            { nome: 'Sobral', vagas_iniciais: 2, efetivo_atual: 10, efetivo_ideal: 15 },
            { nome: 'Juazeiro do Norte', vagas_iniciais: 1, efetivo_atual: 12, efetivo_ideal: 15 },
            { nome: 'Quixadá', vagas_iniciais: 0, efetivo_atual: 5, efetivo_ideal: 8 },
            { nome: 'Caucaia', vagas_iniciais: 0, efetivo_atual: 20, efetivo_ideal: 20 },
            { nome: 'Maracanaú', vagas_iniciais: 0, efetivo_atual: 15, efetivo_ideal: 18 },
            { nome: 'Crato', vagas_iniciais: 1, efetivo_atual: 8, efetivo_ideal: 10 },
            { nome: 'Iguatu', vagas_iniciais: 0, efetivo_atual: 6, efetivo_ideal: 8 },
            { nome: 'Itapipoca', vagas_iniciais: 2, efetivo_atual: 4, efetivo_ideal: 8 },
            { nome: 'Russas', vagas_iniciais: 0, efetivo_atual: 5, efetivo_ideal: 5 }
        ];

        const cidadeMap = {};

        for (const def of cidadesDefinicoes) {
            // Tenta encontrar, se não, cria. Se encontrar, atualiza.
            let [cidade, created] = await Cidade.findOrCreate({
                where: { nome: def.nome },
                defaults: def,
                transaction
            });

            if (!created) {
                await cidade.update(def, { transaction });
            }
            cidadeMap[def.nome] = cidade;
        }

        console.log('🔄 Creating 20 Servidores with mixed priorities...');

        const prioridades = ['nenhum', 'unidade_familiar', 'saude', 'seguranca'];
        const servidoresData = [];
        // Data base para antiguidade (quanto menor, mais antigo)
        const baseDate = new Date('2010-01-01');

        for (let i = 1; i <= 20; i++) {
            const pIndex = (i - 1) % 4;
            const prioridade = prioridades[pIndex];

            const dataIngresso = new Date(baseDate);
            dataIngresso.setMonth(baseDate.getMonth() + (i * 2)); // Espalhar datas

            let lotacao;
            // Distribuição estratégica
            if (i <= 5) lotacao = cidadeMap['Fortaleza'].id;
            else if (i <= 10) lotacao = cidadeMap['Caucaia'].id;
            else if (i <= 15) lotacao = cidadeMap['Maracanaú'].id;
            else lotacao = cidadeMap['Quixadá'].id;

            let nomeServidor = `Servidor Teste ${i} - ${prioridade.toUpperCase()}`;
            if (prioridade === 'nenhum') nomeServidor = `Servidor Teste ${i} - SEM PRIORIDADE`;

            servidoresData.push({
                nome: nomeServidor,
                matricula: `teste${1000 + i}`,
                cpf: `000.${i < 10 ? '0' + i : i}0.000-00`, // CPF único dummy
                senha_hash: '$2a$10$dummyhashformockingpurposesonly',
                perfil: 'usuario',
                data_ingresso: dataIngresso,
                cidade_lotacao_id: lotacao
            });
        }

        const servidores = await Servidor.bulkCreate(servidoresData, { transaction, returning: true });

        console.log('🔄 Creating Pedidos with complex options...');
        const pedidosData = [];

        servidores.forEach((serv, index) => {
            let op1, op2, op3;
            // Lógica de opções para gerar conflitos

            // Grupo 1 (Fortaleza): Querem Interior com vagas (Sobral, Juazeiro)
            if (index < 5) {
                op1 = cidadeMap['Sobral'].id; // 2 vagas
                op2 = cidadeMap['Juazeiro do Norte'].id; // 1 vaga
                op3 = cidadeMap['Itapipoca'].id; // 2 vagas
            }
            // Grupo 2 (Caucaia): Querem Crato (1 vaga) ou Iguatu (0)
            else if (index < 10) {
                op1 = cidadeMap['Crato'].id;
                op2 = cidadeMap['Iguatu'].id;
                op3 = cidadeMap['Russas'].id;
            }
            // Grupo 3 (Maracanaú): Competem com Grupo 1 por Sobral
            else if (index < 15) {
                op1 = cidadeMap['Sobral'].id; // Conflito direto
                op2 = cidadeMap['Itapipoca'].id;
                op3 = null;
            }
            // Grupo 4 (Quixadá): Querem ir pra Capital (sem vagas)
            else {
                op1 = cidadeMap['Fortaleza'].id;
                op2 = null;
                op3 = null;
            }

            let motivo = 'nenhum';
            if (serv.nome.includes('UNIDADE_FAMILIAR')) motivo = 'unidade_familiar';
            if (serv.nome.includes('SAUDE')) motivo = 'saude';
            if (serv.nome.includes('SEGURANCA')) motivo = 'seguranca';

            pedidosData.push({
                servidor_id: serv.id,
                opcao1_cidade_id: op1,
                opcao2_cidade_id: op2,
                opcao3_cidade_id: op3,
                motivo_prioridade: motivo,
                status: 'pendente'
            });
        });

        await PedidoRemocao.bulkCreate(pedidosData, { transaction });

        // Atualizar Configuração Geral para ter saldo de vagas suficiente para nao travar validações
        const config = await Configuracao.findOne({ where: { chave: 'total_novos_servidores' }, transaction });
        if (config) {
            await config.update({ valor_texto: '10' }, { transaction });
        } else {
            await Configuracao.create({ chave: 'total_novos_servidores', valor_texto: '10', descricao: 'Seeder Test' }, { transaction });
        }

        await transaction.commit();
        console.log('✅ Complex Scenario created successfully!');
        process.exit(0);

    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error('❌ Error creating scenario:', error);
        process.exit(1);
    }
}

seedComplexScenario();
