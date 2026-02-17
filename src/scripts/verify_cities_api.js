// Verify Cities API Logic (without HTTP, just controller logic simulation)
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';

const { sequelize, Cidade, Servidor, PedidoRemocao } = require('../models');

async function verify() {
    await sequelize.sync({ force: true });

    const c1 = await Cidade.create({ nome: 'Fortaleza', efetivo_atual: 100, efetivo_ideal: 120 });
    const c2 = await Cidade.create({ nome: 'Sobral', efetivo_atual: 50, efetivo_ideal: 60 });

    // 1. Create a request for Fortaleza (c1)
    // Request needs a server.
    const s1 = await Servidor.create({
        matricula: 'USER1',
        nome: 'User 1',
        cidade_lotacao_id: c2.id,
        senha_hash: 'abc',
        data_ingresso: '2020-01-01'
    });
    await PedidoRemocao.create({ servidor_id: s1.id, status: 'pendente', opcao1_cidade_id: c1.id });

    // 2. Create another request for Fortaleza (c1) as 2nd option
    const s2 = await Servidor.create({
        matricula: 'USER2',
        nome: 'User 2',
        cidade_lotacao_id: c2.id,
        senha_hash: 'abc',
        data_ingresso: '2021-01-01'
    });
    await PedidoRemocao.create({ servidor_id: s2.id, status: 'pendente', opcao1_cidade_id: c2.id, opcao2_cidade_id: c1.id });

    // Now emulate the logic in GET /api/cidades

    // Buscar todas as cidades
    const cidades = await Cidade.findAll({
        order: [['nome', 'ASC']],
        include: [{
            model: Servidor,
            as: 'servidoresLotados',
            attributes: ['id']
        }]
    });

    // Buscar contagem de interessados (pedidos pendentes)
    const pedidos = await PedidoRemocao.findAll({
        where: { status: 'pendente' },
        attributes: ['opcao1_cidade_id', 'opcao2_cidade_id', 'opcao3_cidade_id']
    });

    const interessadosMap = new Map();
    pedidos.forEach(p => {
        [p.opcao1_cidade_id, p.opcao2_cidade_id, p.opcao3_cidade_id].filter(Boolean).forEach(id => {
            interessadosMap.set(id, (interessadosMap.get(id) || 0) + 1);
        });
    });

    const resultado = cidades.map(c => ({
        id: c.id,
        nome: c.nome,
        efetivoAtual: c.efetivo_atual,
        totalInteressados: interessadosMap.get(c.id) || 0
    }));

    console.log(JSON.stringify(resultado, null, 2));

    const fort = resultado.find(c => c.nome === 'Fortaleza');
    if (fort.efetivoAtual === 100 && fort.totalInteressados === 2) {
        console.log('✅ PASS: Fortaleza has 100 effective and 2 interested.');
    } else {
        console.log('❌ FAIL: Fortaleza data mismatch.');
    }
}

verify();
