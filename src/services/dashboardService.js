const { PedidoRemocao, Servidor, Cidade, Configuracao } = require('../models');

async function getDashboardData() {
    const totalServidores = await PedidoRemocao.count();
    const totalCidades = await Cidade.count();
    const totalPedidos = await PedidoRemocao.count();
    const pedidosPendentes = await PedidoRemocao.count({ where: { status: 'pendente' } });
    const pedidosAtendidos = await PedidoRemocao.count({ where: { status: 'atendido' } });
    const pedidosNaoAtendidos = await PedidoRemocao.count({ where: { status: 'nao_atendido' } });

    // Últimos resultados
    const ultimosAtendidos = await PedidoRemocao.findAll({
        where: { status: 'atendido' },
        include: [
            {
                model: Servidor, as: 'servidor',
                attributes: ['nome', 'matricula', 'data_ingresso'],
                include: [{ model: Cidade, as: 'cidadeLotacao' }]
            },
            { model: Cidade, as: 'destinoFinal' }
        ],
        order: [['updated_at', 'DESC']],
        limit: 50
    });

    const ultimosNaoAtendidos = await PedidoRemocao.findAll({
        where: { status: 'nao_atendido' },
        include: [
            {
                model: Servidor, as: 'servidor',
                attributes: ['nome', 'matricula', 'data_ingresso'],
                include: [{ model: Cidade, as: 'cidadeLotacao' }]
            },
            { model: Cidade, as: 'opcao1' },
            { model: Cidade, as: 'opcao2' },
            { model: Cidade, as: 'opcao3' }
        ],
        order: [['updated_at', 'DESC']],
        limit: 50
    });

    // Vagas por cidade e Dados de Efetivo
    const cidades = await Cidade.findAll({
        include: [{
            model: Servidor,
            as: 'servidoresLotados',
            attributes: ['id'],
            where: { perfil: 'usuario' },
            required: false
        }],
        order: [['nome', 'ASC']]
    });

    const configUltimo = await Configuracao.findOne({ where: { chave: 'ultimo_processamento' } });

    // --- CÁLCULO DETALHADO POR CIDADE ---
    const todosPedidosPendentes = await PedidoRemocao.findAll({
        where: { status: ['pendente', 'atendido', 'nao_atendido'] },
        attributes: ['opcao1_cidade_id', 'opcao2_cidade_id', 'opcao3_cidade_id', 'motivo_prioridade']
    });

    const interessadosMap = new Map();
    const pedidosPorPrioridade = { nenhum: 0, unidade_familiar: 0, saude: 0, seguranca: 0 };
    const concorrenciaMap = new Map();

    todosPedidosPendentes.forEach(p => {
        if (pedidosPorPrioridade[p.motivo_prioridade] !== undefined) {
            pedidosPorPrioridade[p.motivo_prioridade]++;
        } else {
            pedidosPorPrioridade['nenhum']++;
        }

        if (p.opcao1_cidade_id) {
            concorrenciaMap.set(p.opcao1_cidade_id, (concorrenciaMap.get(p.opcao1_cidade_id) || 0) + 1);
        }

        [p.opcao1_cidade_id, p.opcao2_cidade_id, p.opcao3_cidade_id].filter(Boolean).forEach(id => {
            interessadosMap.set(id, (interessadosMap.get(id) || 0) + 1);
        });
    });

    const todosPedidosAtendidos = await PedidoRemocao.findAll({
        where: { status: 'atendido' },
        include: [{
            model: Servidor,
            as: 'servidor',
            attributes: ['cidade_lotacao_id']
        }],
        attributes: ['cidade_destino_final_id', 'observacao']
    });

    const saidasMap = new Map();
    const entradasTotaisMap = new Map();
    const entradasConsomeVagaMap = new Map();

    todosPedidosAtendidos.forEach(p => {
        if (p.servidor && p.servidor.cidade_lotacao_id) {
            const origem = p.servidor.cidade_lotacao_id;
            saidasMap.set(origem, (saidasMap.get(origem) || 0) + 1);
        }
        if (p.cidade_destino_final_id) {
            const destino = p.cidade_destino_final_id;
            entradasTotaisMap.set(destino, (entradasTotaisMap.get(destino) || 0) + 1);

            const ehNovoServidor = p.observacao && p.observacao.includes('Alocação por Novos Servidores');
            if (!ehNovoServidor) {
                entradasConsomeVagaMap.set(destino, (entradasConsomeVagaMap.get(destino) || 0) + 1);
            }
        }
    });

    let totalVagasIniciais = 0;
    let deficitTotal = 0;
    let excedenteTotal = 0;

    const vagasPorCidade = cidades.map(c => {
        const storedAtual = c.efetivo_atual || 0;
        const realCount = c.servidoresLotados?.length || 0;
        const ideal = c.efetivo_ideal || 0;
        const vagas = c.vagas_iniciais || 0;

        const efetivoConsiderado = storedAtual + vagas;
        totalVagasIniciais += vagas;
        if (efetivoConsiderado < ideal) deficitTotal += (ideal - efetivoConsiderado);
        if (efetivoConsiderado > ideal) excedenteTotal += (efetivoConsiderado - ideal);

        const saidas = saidasMap.get(c.id) || 0;
        const entradasTotais = entradasTotaisMap.get(c.id) || 0;
        const entradasConsomeVaga = entradasConsomeVagaMap.get(c.id) || 0;

        const vagasFinal = Math.max(0, vagas + saidas - entradasConsomeVaga);
        const efetivoPos = c.efetivo_pos;
        const interessados = interessadosMap.get(c.id) || 0;

        return {
            id: c.id,
            nome: c.nome,
            vagasIniciais: vagas,
            efetivoIdeal: ideal,
            efetivoAtual: storedAtual,
            efetivoPos,
            vagasFinal,
            totalInteressados: interessados,
            deficit: Math.max(0, ideal - efetivoConsiderado),
            excedente: Math.max(0, efetivoConsiderado - ideal),
            deficitAtual: Math.max(0, ideal - storedAtual),
            excedenteAtual: Math.max(0, storedAtual - ideal),
            totalServidores: realCount
        };
    });

    const cidadesMaisConcorridas = [...concorrenciaMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, count]) => {
            const c = cidades.find(city => city.id === id);
            return { nome: c ? c.nome : 'Desconhecida', total: count };
        });

    const movimentacoes = ultimosAtendidos.map(p => ({
        servidor: p.servidor.nome,
        matricula: p.servidor.matricula,
        dataIngresso: p.servidor.data_ingresso,
        cidadeOrigem: p.servidor.cidadeLotacao ? p.servidor.cidadeLotacao.nome : 'N/A',
        cidadeDestino: p.destinoFinal ? p.destinoFinal.nome : 'N/A',
        observacao: p.observacao
    }));

    const naoAtendidos = ultimosNaoAtendidos.map(p => ({
        servidor: p.servidor.nome,
        matricula: p.servidor.matricula,
        dataIngresso: p.servidor.data_ingresso,
        cidadeAtual: p.servidor.cidadeLotacao ? p.servidor.cidadeLotacao.nome : 'N/A',
        opcoes: [
            p.opcao1 ? p.opcao1.nome : null,
            p.opcao2 ? p.opcao2.nome : null,
            p.opcao3 ? p.opcao3.nome : null
        ].filter(Boolean)
    }));

    return {
        resumo: {
            totalServidores,
            totalCidades,
            totalPedidos,
            pedidosPendentes,
            pedidosAtendidos,
            pedidosNaoAtendidos
        },
        resultadoCompativel: {
            sucesso: true,
            mensagem: configUltimo ? `Último processamento em ${new Date(configUltimo.valor_data).toLocaleString('pt-BR')}` : 'Nenhum processamento registrado.',
            movimentacoes,
            naoAtendidos,
            totalPedidos: movimentacoes.length + naoAtendidos.length
        },
        ultimosAtendidos,
        ultimosNaoAtendidos,
        vagasPorCidade,
        statsExtras: {
            totalVagasIniciais,
            deficitTotal,
            excedenteTotal,
            pedidosPorPrioridade,
            cidadesMaisConcorridas
        },
        ultimoProcessamento: configUltimo ? configUltimo.valor_data : null
    };
}

module.exports = {
    getDashboardData
};
