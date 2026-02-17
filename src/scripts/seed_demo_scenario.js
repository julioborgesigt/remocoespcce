require('dotenv').config();
const { Cidade, Servidor, PedidoRemocao, Configuracao, sequelize } = require('../models');
const bcrypt = require('bcryptjs');

async function seedDemoScenario() {
    try {
        await sequelize.authenticate();
        console.log('Conexão estabelecida com sucesso.');

        // Sync para garantir tabelas
        await sequelize.sync();

        const transaction = await sequelize.transaction();
        try {
            console.log('--- Iniciando Criação do Cenário de Demonstração ---');

            // 1. Limpar Banco de Dados
            console.log('Limpando dados existentes...');
            await PedidoRemocao.destroy({ where: {}, truncate: false, transaction });
            await Servidor.destroy({ where: {}, truncate: false, transaction });
            await Cidade.destroy({ where: {}, truncate: false, transaction });
            await Configuracao.destroy({ where: {}, truncate: false, transaction });

            // 2. Configuração Global
            console.log('Configurando parâmetros globais...');
            await Configuracao.create({
                chave: 'total_novos_servidores',
                valor_texto: '5',
                descricao: 'Pool de vagas para novos servidores'
            }, { transaction });

            // 3. Criar Cidades
            console.log('Criando cidades estratégicas...');
            const cidades = await Cidade.bulkCreate([
                { nome: 'Fortaleza (Capital)', vagas_iniciais: 0, efetivo_ideal: 100, efetivo_atual: 100 }, // Lotada, só entra por permuta/saída
                { nome: 'Sobral (Norte)', vagas_iniciais: 1, efetivo_ideal: 20, efetivo_atual: 15 }, // 1 Vaga Real
                { nome: 'Juazeiro do Norte (Sul)', vagas_iniciais: 0, efetivo_ideal: 20, efetivo_atual: 10 }, // 0 Vagas, mas Deficit Alto (Alvo para "Novos")
                { nome: 'Tauá (Inhamuns)', vagas_iniciais: 5, efetivo_ideal: 15, efetivo_atual: 10 }, // Origem comum
                { nome: 'Quixadá (Sertão)', vagas_iniciais: 2, efetivo_ideal: 15, efetivo_atual: 12 }
            ], { transaction, validate: true });

            const [for_city, sob, jua, tau, quix] = cidades;
            const passHash = await bcrypt.hash('123456', 8);

            // 4. Criar Servidores e Pedidos

            // --- CASO 1: Prioridade Legal Vence Antiguidade (Disputa por Sobral - 1 vaga) ---
            // Candidato A: Antigão (2010), sem prioridade
            const sgtAntigo = await Servidor.create({
                nome: 'Sgt. Maria Antiga',
                matricula: 'PM-2010',
                senha_hash: passHash,
                data_ingresso: '2010-01-01',
                cidade_lotacao_id: tau.id, // Está em Tauá
                tempo_servico_total_dias: 5000
            }, { transaction });

            await PedidoRemocao.create({
                servidor_id: sgtAntigo.id,
                opcao1_cidade_id: sob.id, // Quer Sobral
                motivo_prioridade: 'nenhum',
                status: 'pendente'
            }, { transaction });

            // Candidato B: Novato (2023), mas com Risco de Vida (Segurança)
            const sdNovato = await Servidor.create({
                nome: 'Sd. João Novato (Risco de Vida)',
                matricula: 'PM-2023',
                senha_hash: passHash,
                data_ingresso: '2023-01-01',
                cidade_lotacao_id: tau.id, // Está em Tauá
                tempo_servico_total_dias: 365
            }, { transaction });

            await PedidoRemocao.create({
                servidor_id: sdNovato.id,
                opcao1_cidade_id: sob.id, // Quer Sobral (Disputa a mesma vaga)
                motivo_prioridade: 'seguranca', // PRIORIDADE MÁXIMA
                status: 'pendente'
            }, { transaction });


            // --- CASO 2: Alocação por Novos Servidores (Juazeiro - 0 vagas, Deficit 10) ---
            // Servidor quer ir pra lá. Normalmente não conseguiria (0 vagas).
            // Mas como tem deficit e temos 5 "Novos Servidores" no pool, ele deve conseguir.
            const inspMeio = await Servidor.create({
                nome: 'Insp. Carlos Meio-Termo',
                matricula: 'PC-2018',
                senha_hash: passHash,
                data_ingresso: '2018-01-01',
                cidade_lotacao_id: quix.id,
                tempo_servico_total_dias: 2000
            }, { transaction });

            await PedidoRemocao.create({
                servidor_id: inspMeio.id,
                opcao1_cidade_id: jua.id, // Quer Juazeiro (0 vagas)
                motivo_prioridade: 'nenhum',
                status: 'pendente'
            }, { transaction });


            // --- CASO 3: Permuta/Cadeia (Fortaleza Bloqueada) ---
            // Fortaleza tem 0 vagas e está cheia. Ninguém entra se ninguém sair.

            // Del. Ana (Em Fortaleza) quer Tauá.
            const delAna = await Servidor.create({
                nome: 'Del. Ana Capital',
                matricula: 'PC-2015',
                senha_hash: passHash,
                data_ingresso: '2015-01-01',
                cidade_lotacao_id: for_city.id, // Em Fortaleza
                tempo_servico_total_dias: 3000
            }, { transaction });

            await PedidoRemocao.create({
                servidor_id: delAna.id,
                opcao1_cidade_id: tau.id, // Quer ir pro interior
                motivo_prioridade: 'nenhum',
                status: 'pendente'
            }, { transaction });

            // Esc. Pedro (Em Tauá) quer Fortaleza.
            // Só consegue se Ana sair.
            const escPedro = await Servidor.create({
                nome: 'Esc. Pedro Interior',
                matricula: 'PC-2019',
                senha_hash: passHash,
                data_ingresso: '2019-01-01',
                cidade_lotacao_id: tau.id, // Em Tauá
                tempo_servico_total_dias: 1500
            }, { transaction });

            await PedidoRemocao.create({
                servidor_id: escPedro.id,
                opcao1_cidade_id: for_city.id, // Quer Fortaleza
                motivo_prioridade: 'nenhum',
                status: 'pendente'
            }, { transaction });

            // Admin User (from .env or default)
            const adminMatricula = process.env.ADMIN_MATRICULA || 'admin';
            const adminSenha = process.env.ADMIN_SENHA || '12312312';
            const adminPassHash = await bcrypt.hash(adminSenha, 8);

            await Servidor.create({
                nome: 'Administrador',
                matricula: adminMatricula,
                senha_hash: adminPassHash,
                data_ingresso: '2000-01-01',
                cidade_lotacao_id: for_city.id, // Colocando em Fortaleza por conveniência
                perfil: 'admin'
            }, { transaction });

            await transaction.commit();
            console.log('✅ Cenário criado com sucesso!');
            console.log(`
    RESUMO DO CENÁRIO:
1. DISPUTA EM SOBRAL(1 Vaga):
- Sgt.Maria Antiga(2010) vs Sd.João Novato(2023, Risco de Vida).
       -> Esperado na Regra Aprimorada: João vence por prioridade.
    
    2. VAGA "CRIADA" EM JUAZEIRO (0 Vagas, Deficit Alto):
       - Insp. Carlos (Quixadá) quer Juazeiro.
       -> Esperado: NÃO CONSEGUE, pois não tem Vagas Iniciais (Regra Restrita).
       
    3. PERMUTA TÁCITA(FORTALEZA x TAUÁ):
- Del.Ana sai de Fortaleza -> Abre vaga.
       - Esc.Pedro entra em Fortaleza(ocupa a vaga de Ana).
    `);

        } catch (err) {
            await transaction.rollback();
            console.error('Erro ao criar cenário:', err);
        }
    } catch (err) {
        console.error('Erro fatal:', err);
    }
}

seedDemoScenario();
