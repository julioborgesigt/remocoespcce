const router = require('express').Router();
const { body, param, validationResult } = require('express-validator');
const { Cidade, Servidor } = require('../models');
const { autenticar, apenasAdmin } = require('../middleware/auth');

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
