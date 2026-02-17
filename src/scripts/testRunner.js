
// Debug: Log para stderr para não quebrar o JSON do stdout
console.error(`[TestRunner] Iniciando teste no banco: ${process.env.DB_NAME} (${process.env.DB_DIALECT})`);

const { sequelize } = require('../models');

// DEBUG PROFUNDO: Verificar configuração REAL do Sequelize
const config = sequelize.config;
console.error(`[TestRunner] Sequelize Config: DB=${config.database}, Host=${config.host}, Port=${config.port}, Dialect=${config.dialect}`);
console.error(`[TestRunner] Env Vars: DB_NAME=${process.env.DB_NAME}`);

if (config.database !== 'remocoespcce_teste') {
    console.error('FATAL: TestRunner conectado ao banco ERRADO. Abortando.');
    process.exit(1);
}
const Cenarios = require('../services/cenariosTeste');
const { processarRemocao } = require('../services/algoritmoRemocao');

async function runTest() {
    const cenarioNome = process.argv[2];

    if (!cenarioNome || !Cenarios[cenarioNome]) {
        console.error(JSON.stringify({
            sucesso: false,
            mensagem: `Cenário '${cenarioNome}' não encontrado.`
        }));
        process.exit(1);
    }

    try {
        // 1. Setup do Banco (SQLite em memória)
        await sequelize.authenticate();
        // await sequelize.sync({ force: true }); // Já feito dentro dos cenários, mas o cenário usa limparBanco que faz sync.
        // O Cenarios.js usa 'sequelize.sync({ force: true })'.
        // Como estamos num processo isolado com SQLite em memória, isso é seguro e rápido.

        // 2. Setup do Cenário
        const setupData = await Cenarios[cenarioNome]();
        const mensagemSetup = setupData.mensagem || setupData; // Compatibilidade caso retorne só string
        const resultadoEsperado = setupData.resultadoEsperado || null;

        // 2.5 Buscar Dados Iniciais (Para visualização no front)
        const { PedidoRemocao, Servidor, Cidade } = sequelize.models;
        const dadosIniciais = await PedidoRemocao.findAll({
            include: [
                {
                    model: Servidor,
                    as: 'servidor',
                    attributes: ['nome', 'matricula', 'data_ingresso'],
                    include: [{ model: Cidade, as: 'cidadeLotacao', attributes: ['nome'] }]
                },
                { model: Cidade, as: 'opcao1', attributes: ['nome', 'vagas_iniciais'] },
                { model: Cidade, as: 'opcao2', attributes: ['nome', 'vagas_iniciais'] },
                { model: Cidade, as: 'opcao3', attributes: ['nome', 'vagas_iniciais'] }
            ],
            order: [[{ model: Servidor, as: 'servidor' }, 'data_ingresso', 'ASC']]
        });

        const cidades = await Cidade.findAll({
            attributes: ['nome', 'vagas_iniciais'],
            order: [['nome', 'ASC']]
        });

        // [NOVO] Se for apenas setup, retornar agora
        if (process.argv.includes('--setup-only')) {
            console.log(JSON.stringify({
                sucesso: true,
                mensagem: mensagemSetup,
                resultadoEsperado,
                dadosIniciais,
                cidades
            }));
            process.exit(0);
        }

        // 3. Execução do Algoritmo
        const resultado = await processarRemocao();

        // 4. Retorno (JSON para stdout)
        console.log(JSON.stringify({
            sucesso: true,
            mensagem: mensagemSetup,
            resultadoEsperado,
            dadosIniciais, // [NOVO] Enviando estado inicial
            cidades,
            resultado
        }));

        process.exit(0);

    } catch (err) {
        console.error(JSON.stringify({
            sucesso: false,
            mensagem: 'Erro fatal no runner.',
            erro: err.message,
            stack: err.stack
        }));
        process.exit(1);
    }
}

runTest();
