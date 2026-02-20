const router = require('express').Router();
const { PedidoRemocao, Servidor, Cidade, Configuracao, sequelize } = require('../models');
const { autenticar, apenasAdmin } = require('../middleware/auth');
const { processarRemocao } = require('../services/algoritmoRemocao');
const { getDashboardData } = require('../services/dashboardService');
const { fecharTemporadaBase } = require('../services/temporadaService');
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
    const data = await getDashboardData();
    res.json(data);
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
  try {
    const result = await fecharTemporadaBase();
    res.json(result);
  } catch (error) {
    console.error('Erro ao fechar temporada:', error);
    res.status(error.message === 'Nenhum pedido para fechar a temporada.' ? 400 : 500)
      .json({ error: error.message || 'Erro ao fechar temporada.' });
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
