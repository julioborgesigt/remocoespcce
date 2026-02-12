const router = require('express').Router();
const { PedidoRemocao, Servidor, Cidade, Configuracao } = require('../models');
const { autenticar, apenasAdmin } = require('../middleware/auth');
const { processarRemocao } = require('../services/algoritmoRemocao');

// POST /api/processamento/executar — roda o algoritmo (admin)
router.post('/executar', autenticar, apenasAdmin, async (_req, res) => {
  try {
    const resultado = await processarRemocao();

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
    const totalServidores = await Servidor.count({ where: { perfil: 'usuario' } });
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

    // Vagas por cidade
    const cidades = await Cidade.findAll({
      include: [{ model: Servidor, as: 'servidoresLotados', attributes: ['id'] }],
      order: [['nome', 'ASC']]
    });

    const configUltimo = await Configuracao.findOne({ where: { chave: 'ultimo_processamento' } });

    const vagasPorCidade = cidades.map(c => ({
      id: c.id,
      nome: c.nome,
      vagasIniciais: c.vagas_iniciais,
      totalServidores: c.servidoresLotados?.length || 0
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
      ultimosAtendidos,
      ultimosNaoAtendidos,
      vagasPorCidade,
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
    res.json({ mensagem: 'Todos os pedidos foram resetados para pendente.' });
  } catch (err) {
    console.error('Erro ao resetar:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

module.exports = router;
