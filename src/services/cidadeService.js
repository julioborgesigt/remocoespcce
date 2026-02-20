const { Cidade, Servidor, PedidoRemocao } = require('../models');

async function getEstatisticasConcorrencia(usuarioId) {
    const servidor = await Servidor.findByPk(usuarioId);
    if (!servidor) {
        throw new Error('Servidor não encontrado.');
    }

    const cidades = await Cidade.findAll({ order: [['nome', 'ASC']] });

    const pedidos = await PedidoRemocao.findAll({
        where: { status: 'pendente' },
        include: [{
            model: Servidor,
            as: 'servidor',
            attributes: ['id', 'data_ingresso', 'matricula']
        }]
    });

    return cidades.map(cidade => {
        const pedidosCidade = pedidos.filter(p =>
            p.opcao1_cidade_id === cidade.id ||
            p.opcao2_cidade_id === cidade.id ||
            p.opcao3_cidade_id === cidade.id
        );

        const como1a = pedidos.filter(p => p.opcao1_cidade_id === cidade.id).length;
        const como2a = pedidos.filter(p => p.opcao2_cidade_id === cidade.id).length;
        const como3a = pedidos.filter(p => p.opcao3_cidade_id === cidade.id).length;

        const concorrentes = pedidosCidade
            .map(p => ({
                id: p.servidor.id,
                dataIngresso: p.servidor.data_ingresso,
                matricula: p.servidor.matricula
            }))
            .sort((a, b) => {
                const dA = new Date(a.dataIngresso).getTime();
                const dB = new Date(b.dataIngresso).getTime();
                if (dA !== dB) return dA - dB;
                return a.matricula.localeCompare(b.matricula);
            });

        const minhaPosicao = concorrentes.findIndex(c => c.id === usuarioId);

        return {
            id: cidade.id,
            nome: cidade.nome,
            vagasIniciais: cidade.vagas_iniciais,
            totalPedidos: pedidosCidade.length,
            como1a,
            como2a,
            como3a,
            totalConcorrentes: concorrentes.length,
            minhaPosicao: minhaPosicao >= 0 ? minhaPosicao + 1 : null,
            totalNoRanking: concorrentes.length
        };
    });
}

async function getListaCidadesCompleta() {
    const cidades = await Cidade.findAll({
        order: [['nome', 'ASC']],
        include: [{
            model: Servidor,
            as: 'servidoresLotados',
            attributes: ['id']
        }]
    });

    const pedidosPendentes = await PedidoRemocao.findAll({
        where: { status: 'pendente' },
        attributes: ['opcao1_cidade_id', 'opcao2_cidade_id', 'opcao3_cidade_id']
    });

    const interessadosMap = new Map();
    pedidosPendentes.forEach(p => {
        [p.opcao1_cidade_id, p.opcao2_cidade_id, p.opcao3_cidade_id].filter(Boolean).forEach(id => {
            interessadosMap.set(id, (interessadosMap.get(id) || 0) + 1);
        });
    });

    const pedidosAtendidos = await PedidoRemocao.findAll({
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

    pedidosAtendidos.forEach(p => {
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

    return cidades.map(c => {
        const saidas = saidasMap.get(c.id) || 0;
        const entradasConsomeVaga = entradasConsomeVagaMap.get(c.id) || 0;

        const vagasFinal = Math.max(0, (c.vagas_iniciais || 0) + saidas - entradasConsomeVaga);
        const efetivoPos = c.efetivo_pos;

        return {
            id: c.id,
            nome: c.nome,
            vagasIniciais: c.vagas_iniciais,
            vagasFinal,
            efetivoIdeal: c.efetivo_ideal,
            efetivoAtual: c.efetivo_atual,
            efetivoPos,
            totalServidores: c.servidoresLotados?.length || 0,
            totalInteressados: interessadosMap.get(c.id) || 0
        };
    });
}

async function criarCidade(dados) {
    const { nome, vagas_iniciais, efetivo_ideal, efetivo_atual } = dados;

    const existente = await Cidade.findOne({ where: { nome: nome.trim() } });
    if (existente) {
        throw new Error('Cidade já cadastrada.');
    }

    const vIniciais = Number(vagas_iniciais);
    const vIdeal = Number(efetivo_ideal || 0);
    const vAtual = Number(efetivo_atual || 0);

    const maxVagas = Math.max(0, vIdeal - vAtual);
    if (vIniciais > maxVagas) {
        throw new Error(`Vagas iniciais (${vIniciais}) não podem exceder o déficit de efetivo (${maxVagas}).`);
    }

    const cidade = await Cidade.create({
        nome: nome.trim(),
        vagas_iniciais: vIniciais,
        efetivo_ideal: vIdeal,
        efetivo_atual: vAtual
    });

    return {
        id: cidade.id,
        nome: cidade.nome,
        vagasIniciais: cidade.vagas_iniciais,
        efetivoIdeal: cidade.efetivo_ideal,
        efetivoAtual: cidade.efetivo_atual,
        totalServidores: 0,
        totalInteressados: 0
    };
}

async function atualizarCidade(id, dados) {
    const cidade = await Cidade.findByPk(id);
    if (!cidade) {
        throw new Error('Cidade não encontrada.');
    }

    if (dados.nome !== undefined) cidade.nome = dados.nome.trim();

    const nextVagas = dados.vagas_iniciais !== undefined ? Number(dados.vagas_iniciais) : cidade.vagas_iniciais;
    const nextIdeal = dados.efetivo_ideal !== undefined ? Number(dados.efetivo_ideal) : cidade.efetivo_ideal;
    const nextAtual = dados.efetivo_atual !== undefined ? Number(dados.efetivo_atual) : cidade.efetivo_atual;

    const maxVagas = Math.max(0, nextIdeal - nextAtual);
    if (nextVagas > maxVagas) {
        throw new Error(`Vagas iniciais (${nextVagas}) não podem exceder o déficit de efetivo (${maxVagas}).`);
    }

    cidade.vagas_iniciais = nextVagas;
    cidade.efetivo_ideal = nextIdeal;
    cidade.efetivo_atual = nextAtual;

    await cidade.save();

    return {
        id: cidade.id,
        nome: cidade.nome,
        vagasIniciais: cidade.vagas_iniciais,
        efetivoIdeal: cidade.efetivo_ideal,
        efetivoAtual: cidade.efetivo_atual
    };
}

async function removerCidade(id) {
    const cidade = await Cidade.findByPk(id, {
        include: [{ model: Servidor, as: 'servidoresLotados', attributes: ['id'] }]
    });

    if (!cidade) {
        throw new Error('Cidade não encontrada.');
    }

    if (cidade.servidoresLotados?.length > 0) {
        throw new Error(`Não é possível remover: ${cidade.servidoresLotados.length} servidor(es) lotado(s) nesta cidade.`);
    }

    await cidade.destroy();
    return true;
}

module.exports = {
    getEstatisticasConcorrencia,
    getListaCidadesCompleta,
    criarCidade,
    atualizarCidade,
    removerCidade
};
