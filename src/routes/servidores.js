const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const { Servidor, PedidoRemocao, Cidade, Configuracao } = require('../models');
const { autenticar, apenasAdmin } = require('../middleware/auth');

// GET /api/servidores — lista todos (admin) com paginação
router.get('/', autenticar, apenasAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const comPedido = req.query.com_pedido === 'true';

    const { count, rows: servidores } = await Servidor.findAndCountAll({
      where: { perfil: 'usuario' },
      attributes: { exclude: ['senha_hash'] },
      include: [
        { model: Cidade, as: 'cidadeLotacao' },
        {
          model: PedidoRemocao,
          as: 'pedido',
          required: comPedido, // Se true, faz INNER JOIN (só traz quem tem pedido)
          include: [
            { model: Cidade, as: 'opcao1' },
            { model: Cidade, as: 'opcao2' },
            { model: Cidade, as: 'opcao3' },
            { model: Cidade, as: 'destinoFinal' }
          ]
        }
      ],
      order: [['data_ingresso', 'ASC']],
      limit,
      offset,
      distinct: true
    });

    res.json({
      data: servidores,
      paginacao: {
        total: count,
        pagina: page,
        limite: limit,
        totalPaginas: Math.ceil(count / limit)
      }
    });
  } catch (err) {
    console.error('Erro ao listar servidores:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// GET /api/servidores/meu-pedido — pedido do usuário logado
router.get('/meu-pedido', autenticar, async (req, res) => {
  try {
    const pedido = await PedidoRemocao.findOne({
      where: { servidor_id: req.usuario.id },
      include: [
        { model: Cidade, as: 'opcao1' },
        { model: Cidade, as: 'opcao2' },
        { model: Cidade, as: 'opcao3' },
        { model: Cidade, as: 'destinoFinal' }
      ]
    });

    res.json(pedido || null);
  } catch (err) {
    console.error('Erro ao buscar pedido:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// POST /api/servidores/pedido — criar/atualizar pedido de remoção
router.post('/pedido', autenticar, [
  body('opcao1_cidade_id').isInt({ min: 1 }).withMessage('1ª opção é obrigatória.'),
  body('opcao2_cidade_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('opcao3_cidade_id').optional({ nullable: true }).isInt({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Verificar Data Limite
    const config = await Configuracao.findOne({ where: { chave: 'data_limite_pedidos' } });
    if (config && config.valor_data) {
      if (new Date() > new Date(config.valor_data)) {
        return res.status(403).json({ error: 'O prazo para envio ou edição de pedidos já encerrou.' });
      }
    }

    const { opcao1_cidade_id, opcao2_cidade_id, opcao3_cidade_id, motivo_prioridade } = req.body;

    let pedido = await PedidoRemocao.findOne({ where: { servidor_id: req.usuario.id } });
    let isNovo = false;

    if (pedido) {
      await pedido.update({
        opcao1_cidade_id,
        opcao2_cidade_id: opcao2_cidade_id || null,
        opcao3_cidade_id: opcao3_cidade_id || null,
        motivo_prioridade: motivo_prioridade || 'nenhum',
        status: 'pendente',
        cidade_destino_final_id: null,
        observacao: 'Pedido alterado pelo servidor. Aguardando novo processamento.'
      });
    } else {
      isNovo = true;
      pedido = await PedidoRemocao.create({
        servidor_id: req.usuario.id,
        opcao1_cidade_id,
        opcao2_cidade_id: opcao2_cidade_id || null,
        opcao3_cidade_id: opcao3_cidade_id || null,
        motivo_prioridade: motivo_prioridade || 'nenhum'
      });
    }

    // Recarregar com includes
    pedido = await PedidoRemocao.findByPk(pedido.id, {
      include: [
        { model: Cidade, as: 'opcao1' },
        { model: Cidade, as: 'opcao2' },
        { model: Cidade, as: 'opcao3' },
        { model: Cidade, as: 'destinoFinal' }
      ]
    });

    res.status(isNovo ? 201 : 200).json(pedido);
  } catch (err) {
    console.error('Erro ao salvar pedido:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// DELETE /api/servidores/pedido — cancelar pedido
router.delete('/pedido', autenticar, async (req, res) => {
  try {
    const pedido = await PedidoRemocao.findOne({
      where: { servidor_id: req.usuario.id }
    });

    if (!pedido) {
      return res.status(404).json({ error: 'Nenhum pedido encontrado.' });
    }

    // Verificar Data Limite antes de cancelar
    const configLimite = await Configuracao.findOne({ where: { chave: 'data_limite_pedidos' } });
    if (configLimite && configLimite.valor_data) {
      if (new Date() > new Date(configLimite.valor_data)) {
        return res.status(403).json({ error: 'O prazo para cancelamento de pedidos já encerrou.' });
      }
    }

    await pedido.destroy();
    res.json({ mensagem: 'Pedido cancelado com sucesso.' });
  } catch (err) {
    console.error('Erro ao cancelar pedido:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// PUT /api/servidores/:id/pedido — Admin editar opções de um servidor
router.put('/:id/pedido', autenticar, apenasAdmin, [
  body('opcao1_cidade_id').isInt({ min: 1 }).withMessage('1ª opção é obrigatória.'),
  body('opcao2_cidade_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('opcao3_cidade_id').optional({ nullable: true }).isInt({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const servidorId = req.params.id;
    const { opcao1_cidade_id, opcao2_cidade_id, opcao3_cidade_id } = req.body;

    const servidor = await Servidor.findByPk(servidorId);
    if (!servidor) {
      return res.status(404).json({ error: 'Servidor não encontrado.' });
    }

    // Validar que não está escolhendo a própria cidade
    const opcoes = [opcao1_cidade_id, opcao2_cidade_id, opcao3_cidade_id].filter(Boolean);
    if (opcoes.includes(servidor.cidade_lotacao_id)) {
      return res.status(400).json({ error: 'Não é possível escolher a cidade de lotação atual como destino.' });
    }

    // Validar que não há duplicatas
    const opcoesUnicas = new Set(opcoes);
    if (opcoesUnicas.size !== opcoes.length) {
      return res.status(400).json({ error: 'As opções de destino devem ser diferentes entre si.' });
    }

    // Validar existência das cidades
    for (const cidadeId of opcoes) {
      const existe = await Cidade.findByPk(cidadeId);
      if (!existe) {
        return res.status(400).json({ error: `Cidade com ID ${cidadeId} não encontrada.` });
      }
    }

    let pedido = await PedidoRemocao.findOne({ where: { servidor_id: servidorId } });

    if (pedido) {
      await pedido.update({
        opcao1_cidade_id,
        opcao2_cidade_id: opcao2_cidade_id || null,
        opcao3_cidade_id: opcao3_cidade_id || null,
        motivo_prioridade: req.body.motivo_prioridade || 'nenhum',
        status: 'pendente',
        cidade_destino_final_id: null,
        observacao: 'Pedido alterado pelo administrador.'
      });
    } else {
      pedido = await PedidoRemocao.create({
        servidor_id: servidorId,
        opcao1_cidade_id,
        opcao2_cidade_id: opcao2_cidade_id || null,
        opcao3_cidade_id: opcao3_cidade_id || null,
        motivo_prioridade: req.body.motivo_prioridade || 'nenhum',
        status: 'pendente',
        observacao: 'Pedido criado pelo administrador.'
      });
    }

    res.json(pedido);

  } catch (err) {
    console.error('Erro ao editar pedido (admin):', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// PUT /api/servidores/:id — Admin editar dados do servidor (incluindo datas de antiguidade)
router.put('/:id', autenticar, apenasAdmin, async (req, res) => {
  try {
    const servidorId = req.params.id;
    const {
      nome,
      matricula,
      data_ingresso,
      cidade_lotacao_id,
      data_posse_cargo,
      data_lotacao_atual,
      tempo_servico_total_dias
    } = req.body;

    const servidor = await Servidor.findByPk(servidorId);
    if (!servidor) {
      return res.status(404).json({ error: 'Servidor não encontrado.' });
    }

    // Se estiver mudando matrícula, verificar duplicidade (exceto o próprio)
    if (matricula && matricula !== servidor.matricula) {
      const existe = await Servidor.findOne({ where: { matricula } });
      if (existe) {
        return res.status(400).json({ error: 'Matrícula já existente.' });
      }
    }

    await servidor.update({
      nome: nome || servidor.nome,
      matricula: matricula || servidor.matricula,
      data_ingresso: data_ingresso || servidor.data_ingresso,
      cidade_lotacao_id: cidade_lotacao_id || servidor.cidade_lotacao_id,
      data_posse_cargo: data_posse_cargo || null,
      data_lotacao_atual: data_lotacao_atual || null,
      tempo_servico_total_dias: tempo_servico_total_dias || 0
    });

    res.json(servidor);
  } catch (err) {
    console.error('Erro ao editar servidor:', err);
    res.status(500).json({ error: 'Erro ao atualizar dados do servidor.' });
  }
});

module.exports = router;
