const router = require('express').Router();
const { PedidoRemocao, Servidor, Cidade, Configuracao, sequelize } = require('../models');
const { autenticar, apenasAdmin } = require('../middleware/auth');
const { processarRemocao } = require('../services/algoritmoRemocao');

// POST /api/processamento/executar — roda o algoritmo (admin)
router.post('/executar', autenticar, apenasAdmin, async (req, res) => {
  try {
    const { regra } = req.body; // 'antiguidade' ou 'aprimorada'

    // [NOVO] Resetar todos os pedidos para 'pendente' antes de rodar
    await PedidoRemocao.update(
      { status: 'pendente', cidade_destino_final_id: null, observacao: null },
      { where: {} }
    );

    // Buscar configuração global de novos servidores
    const configNovos = await Configuracao.findOne({ where: { chave: 'total_novos_servidores' } });
    const novosServidores = configNovos ? Number(configNovos.valor_texto) : 0;

    const resultado = await processarRemocao(regra || 'antiguidade', novosServidores);

    // Atualizar data do último processamento
    let config = await Configuracao.findOne({ where: { chave: 'ultimo_processamento' } });
    if (config) {
      config.valor_data = new Date();
      await config.save();
    } else {
      await Configuracao.create({
        chave: 'ultimo_processamento',
        valor_data: new Date(),
        descricao: 'Data da última execução da lógica de remoção.'
      });
    }

    res.json(resultado);
  } catch (err) {
    console.error('Erro no processamento:', err);
    res.status(500).json({ error: 'Erro ao processar remoções.' });
  }
});

// GET /api/processamento/dashboard — dados do dashboard (admin)
router.get('/dashboard', autenticar, apenasAdmin, async (_req, res) => {
  try {
    // [MODIFICADO] Total de servidores no dashboard agora reflete apenas quem tem PEDIDO (ativo/pendente/nao_atendido/atendido)
    // O count total da tabela PedidoRemocao reflete isso
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

    // --- CÁLCULO DETALHADO POR CIDADE (Métrica de Cidades.js) ---

    // 1. Interessados (Pedidos Pendentes)
    const todosPedidosPendentes = await PedidoRemocao.findAll({
      where: { status: 'pendente' },
      attributes: ['opcao1_cidade_id', 'opcao2_cidade_id', 'opcao3_cidade_id', 'motivo_prioridade']
    });

    const interessadosMap = new Map(); // Para tabela
    const pedidosPorPrioridade = { nenhum: 0, unidade_familiar: 0, saude: 0, seguranca: 0 }; // Para stats
    const concorrenciaMap = new Map(); // Para stats

    todosPedidosPendentes.forEach(p => {
      // Stats: Prioridade
      if (pedidosPorPrioridade[p.motivo_prioridade] !== undefined) {
        pedidosPorPrioridade[p.motivo_prioridade]++;
      } else {
        pedidosPorPrioridade['nenhum']++;
      }

      // Stats: Top Cidades (Opção 1)
      if (p.opcao1_cidade_id) {
        concorrenciaMap.set(p.opcao1_cidade_id, (concorrenciaMap.get(p.opcao1_cidade_id) || 0) + 1);
      }

      // Tabela: Interessados (Qualquer opção)
      [p.opcao1_cidade_id, p.opcao2_cidade_id, p.opcao3_cidade_id].filter(Boolean).forEach(id => {
        interessadosMap.set(id, (interessadosMap.get(id) || 0) + 1);
      });
    });

    // 2. Movimentações (Pedidos Atendidos - TODOS para cálculo correto)
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
      // Saída
      if (p.servidor && p.servidor.cidade_lotacao_id) {
        const origem = p.servidor.cidade_lotacao_id;
        saidasMap.set(origem, (saidasMap.get(origem) || 0) + 1);
      }
      // Entrada
      if (p.cidade_destino_final_id) {
        const destino = p.cidade_destino_final_id;
        entradasTotaisMap.set(destino, (entradasTotaisMap.get(destino) || 0) + 1);

        const ehNovoServidor = p.observacao && p.observacao.includes('Alocação por Novos Servidores');
        if (!ehNovoServidor) {
          entradasConsomeVagaMap.set(destino, (entradasConsomeVagaMap.get(destino) || 0) + 1);
        }
      }
    });

    // 3. Montar VagasPorCidade Completo
    let totalVagasIniciais = 0;
    let deficitTotal = 0;
    let excedenteTotal = 0;

    const vagasPorCidade = cidades.map(c => {
      // Dados Básicos: Usar 'efetivo_atual' armazenado (Baseline Manual)
      const storedAtual = c.efetivo_atual || 0;
      const realCount = c.servidoresLotados?.length || 0; // Apenas informativo
      const ideal = c.efetivo_ideal || 0;
      const vagas = c.vagas_iniciais || 0;

      // Stats Globais
      const efetivoConsiderado = storedAtual + vagas;
      totalVagasIniciais += vagas;
      if (efetivoConsiderado < ideal) deficitTotal += (ideal - efetivoConsiderado);
      if (efetivoConsiderado > ideal) excedenteTotal += (efetivoConsiderado - ideal);

      // Dados Calculados
      const saidas = saidasMap.get(c.id) || 0;
      const entradasTotais = entradasTotaisMap.get(c.id) || 0;
      const entradasConsomeVaga = entradasConsomeVagaMap.get(c.id) || 0;

      const vagasFinal = Math.max(0, vagas + saidas - entradasConsomeVaga);
      // Efetivo Pós agora vem do banco (calculado no processamento)
      // Se for null, mostra '-' (tratado no front). Se tiver valor, usa.
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
        deficitAtual: Math.max(0, ideal - storedAtual), // [NOVO] Sem considerar vagas
        excedenteAtual: Math.max(0, storedAtual - ideal), // [NOVO] Sem considerar vagas
        totalServidores: realCount // Mantém o count real separado se precisar
      };
    });

    // Stats: Top 5 Cidades (baseado no mapa populado acima)
    const cidadesMaisConcorridas = [...concorrenciaMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => {
        const c = cidades.find(city => city.id === id);
        return { nome: c ? c.nome : 'Desconhecida', total: count };
      });



    // Normalizar dados para o formato de 'resultado' (mesma estrutura do algoritmo)
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

    res.json({
      resumo: {
        totalServidores,
        totalCidades,
        totalPedidos,
        pedidosPendentes,
        pedidosAtendidos,
        pedidosNaoAtendidos
      },
      // Dados compatíveis com a view de resultado
      resultadoCompativel: {
        sucesso: true,
        mensagem: configUltimo ? `Último processamento em ${new Date(configUltimo.valor_data).toLocaleString('pt-BR')}` : 'Nenhum processamento registrado.',
        movimentacoes,
        naoAtendidos,
        totalPedidos: movimentacoes.length + naoAtendidos.length // Estimativa
      },
      ultimosAtendidos, // Mantém compatibilidade se alguém usar
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
    });
  } catch (err) {
    console.error('Erro no dashboard:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// POST /api/processamento/resetar — reseta pedidos para pendente (admin)
router.post('/resetar', autenticar, apenasAdmin, async (_req, res) => {
  try {
    await PedidoRemocao.update(
      { status: 'pendente', cidade_destino_final_id: null, observacao: null },
      { where: {} }
    );
    // [NOVO] Limpar Efetivo Pós das Cidades
    await Cidade.update({ efetivo_pos: null }, { where: {} });

    res.json({ mensagem: 'Todos os pedidos foram resetados para pendente.' });
  } catch (err) {
    console.error('Erro ao resetar:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// Fechar Temporada (POST)
router.post('/fechar-temporada', autenticar, apenasAdmin, async (req, res) => {
  const t = await sequelize.transaction();

  try {
    // 1. Buscar todos os pedidos
    const pedidos = await PedidoRemocao.findAll({
      include: [{ model: Servidor, as: 'servidor' }],
      transaction: t
    });

    if (pedidos.length === 0) {
      await t.rollback();
      return res.status(400).json({ error: 'Nenhum pedido para fechar a temporada.' });
    }

    const agora = new Date();
    const historicos = [];
    const removidosIds = [];

    // 2. Processar pedidos Atendidos
    for (const p of pedidos) {
      const isAtendido = p.status === 'atendido';

      // Criar registro no histórico para TODOS os pedidos
      historicos.push({
        temporada_data: agora,
        servidor_id: p.servidor_id,
        matricula: p.servidor.matricula,
        nome: p.servidor.nome,
        cidade_origem_id: p.servidor.cidade_lotacao_id,
        cidade_destino_id: isAtendido ? p.cidade_destino_final_id : null,
        status: p.status,
        observacao: p.observacao,
        detalhes_json: JSON.stringify({
          opcao1: p.opcao1_cidade_id,
          opcao2: p.opcao2_cidade_id,
          opcao3: p.opcao3_cidade_id,
          motivo: p.motivo_prioridade
        })
      });

      if (isAtendido) {
        // Atualizar lotação do servidor
        await Servidor.update(
          {
            cidade_lotacao_id: p.cidade_destino_final_id,
            data_lotacao_atual: agora // Atualiza data de lotação para hoje
          },
          {
            where: { id: p.servidor_id },
            transaction: t
          }
        );
        removidosIds.push(p.id);
      }
    }

    // 3. Salvar Histórico em Batch
    const { HistoricoRemocao } = require('../models');
    await HistoricoRemocao.bulkCreate(historicos, { transaction: t });

    // 4. Limpar/Resetar Pedidos
    // Atendidos: Excluir (já foram efetivados e historico salvo)
    // Pendentes/Não Atendidos: Resetar para 'pendente' e manter para próxima temporada

    // a) Remover os atendidos
    if (removidosIds.length > 0) {
      await PedidoRemocao.destroy({
        where: { id: removidosIds },
        transaction: t
      });
    }

    // b) Resetar os restantes para 'pendente'
    await PedidoRemocao.update(
      {
        status: 'pendente',
        observacao: null,
        cidade_destino_final_id: null
      },
      {
        where: { status: ['nao_atendido', 'pendente'] }, // Garante que só reseta o que sobrou
        transaction: t
      }
    );

    // 5. Atualizar Cidades (Efetivo Atual e Vagas) e Salvar Snapshot
    // Recalcular efetivo atual real após as mudanças

    // a) Snapshot das vagas atuais antes de zerar
    const snapshotVagas = {};
    const cidadesAtuais = await Cidade.findAll({ transaction: t });
    for (const c of cidadesAtuais) {
      snapshotVagas[c.id] = c.vagas_iniciais;
    }

    // b) Salvar Snapshot na Configuração
    const configNovosAtual = await Configuracao.findOne({ where: { chave: 'total_novos_servidores' }, transaction: t });
    const snapshotNovos = configNovosAtual ? configNovosAtual.valor_texto : '0';

    // Salvar ou Atualizar configuração de backup
    const configBackup = await Configuracao.findOne({ where: { chave: 'backup_ultima_temporada' }, transaction: t });
    if (configBackup) {
      configBackup.tipo = 'json'; // Garantir tipo se existir campo (não existe no model mas ok, usamos valor_texto/json se tiver)
      // O model Configuracao tem 'valor_texto', vamos usar JSON.stringify nele
      configBackup.descricao = JSON.stringify({ vagas: snapshotVagas, novos: snapshotNovos });
      configBackup.valor_data = agora; // Data do backup
      await configBackup.save({ transaction: t });
    } else {
      await Configuracao.create({
        chave: 'backup_ultima_temporada',
        descricao: JSON.stringify({ vagas: snapshotVagas, novos: snapshotNovos }),
        valor_data: agora
      }, { transaction: t });
    }

    // c) Atualizar Cidades (Efetivo Atual = Efetivo Pós)
    // Se temos o efetivo_pos gravado, usamos ele. Se não (fallback), usamos a lógica Delta.

    // Calcular Deltas (para fallback ou verificação)
    const deltaMap = new Map();
    const cidadesParaUpdate = await Cidade.findAll({ transaction: t });
    cidadesParaUpdate.forEach(c => deltaMap.set(c.id, 0));

    for (const h of historicos) {
      if (h.status === 'atendido') {
        if (h.cidade_origem_id) deltaMap.set(h.cidade_origem_id, (deltaMap.get(h.cidade_origem_id) || 0) - 1);
        if (h.cidade_destino_id) deltaMap.set(h.cidade_destino_id, (deltaMap.get(h.cidade_destino_id) || 0) + 1);
      }
    }

    // Aplicar Atualização
    for (const c of cidadesParaUpdate) {
      let novoEfetivo;

      if (c.efetivo_pos !== null && c.efetivo_pos !== undefined) {
        // Usa o valor persistido
        novoEfetivo = c.efetivo_pos;
      } else {
        // Fallback: Calcula via Delta
        const delta = deltaMap.get(c.id) || 0;
        const atual = Number(c.efetivo_atual) || 0;
        novoEfetivo = Math.max(0, atual + delta);
      }

      await c.update({
        efetivo_atual: novoEfetivo,
        vagas_iniciais: 0,
        efetivo_pos: null // Limpa o simulado para a nova temporada
      }, { transaction: t });
    }

    // 6. Resetar Configuração de Novos Servidores
    await Configuracao.update(
      { valor_texto: '0' },
      { where: { chave: 'total_novos_servidores' }, transaction: t }
    );

    await t.commit();
    res.json({ sucess: true, message: 'Temporada fechada com sucesso! Servidores removidos e histórico salvo.' });

  } catch (error) {
    await t.rollback();
    console.error('Erro ao fechar temporada:', error);
    res.status(500).json({ error: 'Erro ao fechar temporada.' });
  }
});

// GET /api/processamento/historico/ultima — retorna o histórico da última temporada fechada
router.get('/historico/ultima', autenticar, apenasAdmin, async (req, res) => {
  try {
    const { HistoricoRemocao } = require('../models');

    // 1. Descobrir qual a última data de temporada
    const ultima = await HistoricoRemocao.findOne({
      order: [['temporada_data', 'DESC']],
      attributes: ['temporada_data']
    });

    if (!ultima) {
      return res.json({ mensagem: 'Nenhum histórico encontrado.', historico: [] });
    }

    const dataUltima = ultima.temporada_data;

    // 2. Buscar todos os registros dessa data
    const historico = await HistoricoRemocao.findAll({
      where: { temporada_data: dataUltima },
      order: [['nome', 'ASC']]
    });

    res.json({
      data: dataUltima,
      historico
    });

  } catch (err) {
    console.error('Erro ao buscar histórico:', err);
    res.status(500).json({ error: 'Erro ao buscar histórico.' });
  }
});

// POST /api/processamento/reabrir-temporada
router.post('/reabrir-temporada', autenticar, apenasAdmin, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { HistoricoRemocao } = require('../models');

    // 1. Encontrar a última temporada fechada
    const ultima = await HistoricoRemocao.findOne({
      order: [['temporada_data', 'DESC']],
      attributes: ['temporada_data']
    });

    if (!ultima) {
      await t.rollback();
      return res.status(400).json({ error: 'Nenhum histórico encontrado para reabrir.' });
    }

    const dataUltima = ultima.temporada_data;

    // 2. Buscar todos os registros dessa temporada
    const historico = await HistoricoRemocao.findAll({
      where: { temporada_data: dataUltima },
      transaction: t
    });

    if (!historico.length) {
      await t.rollback();
      return res.status(400).json({ error: 'Histórico vazio.' });
    }

    // 3. Reverter Lotações e Pedidos
    for (const h of historico) {
      const detalhes = JSON.parse(h.detalhes_json || '{}');

      // A. Reverter Lotação (apenas para quem foi atendido e mudou de cidade)
      if (h.status === 'atendido' && h.cidade_origem_id) {
        // Volta o servidor para a origem
        await Servidor.update(
          { cidade_lotacao_id: h.cidade_origem_id },
          { where: { id: h.servidor_id }, transaction: t }
        );
      }

      // B. Restaurar Pedido
      // Verifica se já existe pedido (não deveria, mas por segurança)
      const pedidoExistente = await PedidoRemocao.findOne({
        where: { servidor_id: h.servidor_id },
        transaction: t
      });

      if (pedidoExistente) {
        // Se já existe, atualiza com os dados originais
        await pedidoExistente.update({
          opcao1_cidade_id: detalhes.opcao1,
          opcao2_cidade_id: detalhes.opcao2,
          opcao3_cidade_id: detalhes.opcao3,
          motivo_prioridade: detalhes.motivo,
          status: h.status,
          cidade_destino_final_id: h.cidade_destino_id,
          observacao: h.observacao
        }, { transaction: t });
      } else {
        // Se foi deletado (atendido), recria
        await PedidoRemocao.create({
          servidor_id: h.servidor_id,
          opcao1_cidade_id: detalhes.opcao1,
          opcao2_cidade_id: detalhes.opcao2,
          opcao3_cidade_id: detalhes.opcao3,
          motivo_prioridade: detalhes.motivo,
          status: h.status,
          cidade_destino_final_id: h.cidade_destino_id,
          observacao: h.observacao
        }, { transaction: t });
      }
    }

    // 4. Restaurar Vagas Iniciais e Configuração (Snapshot)
    const configBackup = await Configuracao.findOne({ where: { chave: 'backup_ultima_temporada' }, transaction: t });
    if (configBackup && configBackup.descricao) {
      try {
        const snapshot = JSON.parse(configBackup.descricao);

        // Restaurar Vagas das Cidades
        if (snapshot.vagas) {
          for (const [cidadeId, vagas] of Object.entries(snapshot.vagas)) {
            await Cidade.update(
              { vagas_iniciais: vagas },
              { where: { id: cidadeId }, transaction: t }
            );
          }
        }

        // Restaurar Novos Servidores
        if (snapshot.novos !== undefined) {
          await Configuracao.update(
            { valor_texto: snapshot.novos },
            { where: { chave: 'total_novos_servidores' }, transaction: t }
          );
        }

      } catch (e) {
        console.error('Erro ao restaurar snapshot de vagas:', e);
        // Não falha o processo todo, mas avisa
      }
    }

    // 5. Apagar Histórico desta temporada
    await HistoricoRemocao.destroy({
      where: { temporada_data: dataUltima },
      transaction: t
    });

    // 6. Reverter Efetivos das Cidades (Delta Inverso)
    // Se no fechamento: Origem - 1, Destino + 1
    // Na reabertura: Origem + 1, Destino - 1
    // Usamos os dados do histórico para calcular onde cada um estava e pra onde foi

    const deltaReabertura = new Map();
    const cidadesRecalc = await Cidade.findAll({ transaction: t });
    cidadesRecalc.forEach(c => deltaReabertura.set(c.id, 0));

    for (const h of historico) {
      if (h.status === 'atendido') {
        // Reverter Movimento:
        // Ele SAUDA da Origem (então Origem recupera +1)
        if (h.cidade_origem_id) {
          const atual = deltaReabertura.get(h.cidade_origem_id) || 0;
          deltaReabertura.set(h.cidade_origem_id, atual + 1);
        }
        // Ele ENTROU no Destino (então Destino perde -1)
        if (h.cidade_destino_id) {
          const atual = deltaReabertura.get(h.cidade_destino_id) || 0;
          deltaReabertura.set(h.cidade_destino_id, atual - 1);
        }
      }
    }

    for (const c of cidadesRecalc) {
      const delta = deltaReabertura.get(c.id) || 0;
      const atualNoBanco = Number(c.efetivo_atual) || 0;

      // Evitar negativo por segurança, mas logicamente deve bater
      const novoEfetivoAtual = Math.max(0, atualNoBanco + delta);

      // O valor atual do banco (pós-fechamento) torna-se o 'efetivo_pos' (previsão)
      // O 'efetivo_atual' regressa ao estado anterior
      await c.update({
        efetivo_atual: novoEfetivoAtual,
        efetivo_pos: atualNoBanco
      }, { transaction: t });
    }

    await t.commit();
    res.json({ success: true, message: 'Temporada reaberta com sucesso! Lotações, pedidos e vagas restaurados.' });

  } catch (err) {
    await t.rollback();
    console.error('Erro ao reabrir temporada:', err);
    res.status(500).json({ error: 'Erro ao reabrir temporada: ' + err.message });
  }
});

module.exports = router;
