const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const { Servidor, PedidoRemocao, Cidade } = require('../models');
const { autenticar, apenasAdmin } = require('../middleware/auth');

// GET /api/servidores — lista todos (admin)
router.get('/', autenticar, apenasAdmin, async (_req, res) => {
  try {
    const servidores = await Servidor.findAll({
      attributes: { exclude: ['senha_hash'] },
      include: [
        { model: Cidade, as: 'cidadeLotacao' },
        {
          model: PedidoRemocao,
          as: 'pedido',
          include: [
            { model: Cidade, as: 'opcao1' },
            { model: Cidade, as: 'opcao2' },
            { model: Cidade, as: 'opcao3' },
            { model: Cidade, as: 'destinoFinal' }
          ]
        }
      ],
      order: [['data_ingresso', 'ASC']]
    });

    res.json(servidores);
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
    const { Configuracao } = require('../models');
    const config = await Configuracao.findOne({ where: { chave: 'data_limite_pedidos' } });
    if (config && config.valor_data) {
      if (new Date() > new Date(config.valor_data)) {
        return res.status(403).json({ error: 'O prazo para envio ou edição de pedidos já encerrou.' });
      }
    }

    const { opcao1_cidade_id, opcao2_cidade_id, opcao3_cidade_id } = req.body;

    // Buscar servidor com cidade atual
    const servidor = await Servidor.findByPk(req.usuario.id);
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

    // Validar que as cidades existem
    for (const cidadeId of opcoes) {
      const existe = await Cidade.findByPk(cidadeId);
      if (!existe) {
        return res.status(400).json({ error: `Cidade com ID ${cidadeId} não encontrada.` });
      }
    }

    // Verificar se já tem pedido
    let pedido = await PedidoRemocao.findOne({
      where: { servidor_id: req.usuario.id }
    });

    if (pedido) {
      // Se já existe pedido, verificamos se podemos alterar.
      // O frontend já checa a 'data limite', e aqui também checamos 'data_limite_pedidos' linhas acima.
      // Portanto, se a data limite não passou, DEVE ser permitido alterar, INDEPENDENTE do status atual (atendido/não atendido).
      // Isso permite que o usuário mude de ideia mesmo se a "prévia" do algoritmo já o atendeu.

      await pedido.update({
        opcao1_cidade_id,
        opcao2_cidade_id: opcao2_cidade_id || null,
        opcao3_cidade_id: opcao3_cidade_id || null,
        // Ao alterar o pedido, resetamos o status para 'pendente' para garantir que ele entre novamente na fila de processamento limpo
        // ou mantemos o status, mas o próximo processamento irá sobrescrevê-lo de qualquer forma.
        // O ideal é resetar para 'pendente' visualmente para indicar que foi modificado e aguarda nova análise.
        status: 'pendente',
        cidade_destino_final_id: null,
        observacao: 'Pedido alterado pelo servidor. Aguardando novo processamento.'
      });
    } else {
      pedido = await PedidoRemocao.create({
        servidor_id: req.usuario.id,
        opcao1_cidade_id,
        opcao2_cidade_id: opcao2_cidade_id || null,
        opcao3_cidade_id: opcao3_cidade_id || null
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

    res.status(201).json(pedido);
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
    const { Configuracao } = require('../models');
    const config = await Configuracao.findOne({ where: { chave: 'data_limite_pedidos' } });
    if (config && config.valor_data) {
      if (new Date() > new Date(config.valor_data)) {
        return res.status(403).json({ error: 'O prazo para cancelamento de pedidos já encerrou.' });
      }
    }

    // Se a data limite não passou, PERMITE cancelar independente do status (atendido/pendente).
    // if (pedido.status !== 'pendente') { ... } // Removido

    await pedido.destroy();
    res.json({ mensagem: 'Pedido cancelado com sucesso.' });
  } catch (err) {
    console.error('Erro ao cancelar pedido:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

module.exports = router;
