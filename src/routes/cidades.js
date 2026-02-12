const router = require('express').Router();
const { body, param, validationResult } = require('express-validator');
const { Cidade, Servidor, PedidoRemocao } = require('../models');
const { autenticar, apenasAdmin } = require('../middleware/auth');

// GET /api/cidades/concorrencia — estatísticas de concorrência por cidade (autenticado)
router.get('/concorrencia', autenticar, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;

    // Buscar servidor logado
    const servidor = await Servidor.findByPk(usuarioId);
    if (!servidor) {
      return res.status(404).json({ error: 'Servidor não encontrado.' });
    }

    // Buscar todas as cidades com vagas
    const cidades = await Cidade.findAll({ order: [['nome', 'ASC']] });

    // Buscar todos os pedidos pendentes com dados do servidor
    const pedidos = await PedidoRemocao.findAll({
      where: { status: 'pendente' },
      include: [{
        model: Servidor,
        as: 'servidor',
        attributes: ['id', 'data_ingresso', 'matricula']
      }]
    });

    // Para cada cidade, calcular estatísticas
    const resultado = cidades.map(cidade => {
      // Quantos pedidos têm essa cidade como 1a, 2a ou 3a opção
      const pedidosCidade = pedidos.filter(p =>
        p.opcao1_cidade_id === cidade.id ||
        p.opcao2_cidade_id === cidade.id ||
        p.opcao3_cidade_id === cidade.id
      );

      // Contagem por posição de preferência
      const como1a = pedidos.filter(p => p.opcao1_cidade_id === cidade.id).length;
      const como2a = pedidos.filter(p => p.opcao2_cidade_id === cidade.id).length;
      const como3a = pedidos.filter(p => p.opcao3_cidade_id === cidade.id).length;

      // Ranking de antiguidade dos concorrentes (todos que pediram essa cidade)
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

      // Posição do usuário logado no ranking (null se não pediu essa cidade)
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
        minhaPosicao: minhaPosicao >= 0 ? minhaPosicao + 1 : null, // 1-indexed, null se não pediu
        totalNoRanking: concorrentes.length
      };
    });

    res.json(resultado);
  } catch (err) {
    console.error('Erro ao buscar concorrência:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// GET /api/cidades — lista todas (pública para selects)
router.get('/', async (_req, res) => {
  try {
    const cidades = await Cidade.findAll({
      order: [['nome', 'ASC']],
      include: [{
        model: Servidor,
        as: 'servidoresLotados',
        attributes: ['id']
      }]
    });

    const resultado = cidades.map(c => ({
      id: c.id,
      nome: c.nome,
      vagasIniciais: c.vagas_iniciais,
      totalServidores: c.servidoresLotados?.length || 0
    }));

    res.json(resultado);
  } catch (err) {
    console.error('Erro ao listar cidades:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// POST /api/cidades — criar (admin)
router.post('/', autenticar, apenasAdmin, [
  body('nome').trim().notEmpty().withMessage('Nome é obrigatório.')
    .isLength({ min: 2, max: 120 }),
  body('vagas_iniciais').isInt({ min: 0 }).withMessage('Vagas deve ser >= 0.')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { nome, vagas_iniciais } = req.body;

    const existente = await Cidade.findOne({ where: { nome: nome.trim() } });
    if (existente) {
      return res.status(409).json({ error: 'Cidade já cadastrada.' });
    }

    const cidade = await Cidade.create({
      nome: nome.trim(),
      vagas_iniciais: Number(vagas_iniciais)
    });

    res.status(201).json({
      id: cidade.id,
      nome: cidade.nome,
      vagasIniciais: cidade.vagas_iniciais,
      totalServidores: 0
    });
  } catch (err) {
    console.error('Erro ao criar cidade:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// PUT /api/cidades/:id — atualizar (admin)
router.put('/:id', autenticar, apenasAdmin, [
  param('id').isInt({ min: 1 }),
  body('nome').optional().trim().isLength({ min: 2, max: 120 }),
  body('vagas_iniciais').optional().isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const cidade = await Cidade.findByPk(req.params.id);
    if (!cidade) {
      return res.status(404).json({ error: 'Cidade não encontrada.' });
    }

    if (req.body.nome !== undefined) cidade.nome = req.body.nome.trim();
    if (req.body.vagas_iniciais !== undefined) cidade.vagas_iniciais = Number(req.body.vagas_iniciais);

    await cidade.save();

    res.json({
      id: cidade.id,
      nome: cidade.nome,
      vagasIniciais: cidade.vagas_iniciais
    });
  } catch (err) {
    console.error('Erro ao atualizar cidade:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// DELETE /api/cidades/:id — remover (admin)
router.delete('/:id', autenticar, apenasAdmin, [
  param('id').isInt({ min: 1 })
], async (req, res) => {
  try {
    const cidade = await Cidade.findByPk(req.params.id, {
      include: [{ model: Servidor, as: 'servidoresLotados', attributes: ['id'] }]
    });

    if (!cidade) {
      return res.status(404).json({ error: 'Cidade não encontrada.' });
    }

    if (cidade.servidoresLotados?.length > 0) {
      return res.status(409).json({
        error: `Não é possível remover: ${cidade.servidoresLotados.length} servidor(es) lotado(s) nesta cidade.`
      });
    }

    await cidade.destroy();
    res.json({ mensagem: 'Cidade removida com sucesso.' });
  } catch (err) {
    console.error('Erro ao remover cidade:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

module.exports = router;
