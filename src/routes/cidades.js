const router = require('express').Router();
const { body, param, validationResult } = require('express-validator');
const { Cidade, Servidor, PedidoRemocao } = require('../models');
const { autenticar, apenasAdmin } = require('../middleware/auth');
const { getEstatisticasConcorrencia, getListaCidadesCompleta, criarCidade, atualizarCidade, removerCidade } = require('../services/cidadeService');

// GET /api/cidades/concorrencia — estatísticas de concorrência por cidade (autenticado)
router.get('/concorrencia', autenticar, async (req, res) => {
  try {
    const resultado = await getEstatisticasConcorrencia(req.usuario.id);
    res.json(resultado);
  } catch (err) {
    if (err.message === 'Servidor não encontrado.') {
      return res.status(404).json({ error: err.message });
    }
    console.error('Erro ao buscar concorrência:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// GET /api/cidades — lista todas (pública para selects)
router.get('/', async (_req, res) => {
  try {
    const resultado = await getListaCidadesCompleta();
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
  body('vagas_iniciais').isInt({ min: 0 }).withMessage('Vagas deve ser >= 0.'),
  body('efetivo_ideal').optional().isInt({ min: 0 }).withMessage('Efetivo ideal deve ser >= 0.'),
  body('efetivo_atual').optional().isInt({ min: 0 }).withMessage('Efetivo atual deve ser >= 0.')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const result = await criarCidade(req.body);
    res.status(201).json(result);
  } catch (err) {
    if (err.message.includes('não podem exceder o déficit')) return res.status(400).json({ error: err.message });
    if (err.message === 'Cidade já cadastrada.') return res.status(409).json({ error: err.message });
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// PUT /api/cidades/:id — atualizar (admin)
router.put('/:id', autenticar, apenasAdmin, [
  param('id').isInt({ min: 1 }),
  body('nome').optional().trim().isLength({ min: 2, max: 120 }),
  body('vagas_iniciais').optional().isInt({ min: 0 }),
  body('efetivo_ideal').optional().isInt({ min: 0 }),
  body('efetivo_atual').optional().isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const result = await atualizarCidade(req.params.id, req.body);
    res.json(result);
  } catch (err) {
    if (err.message === 'Cidade não encontrada.') return res.status(404).json({ error: err.message });
    if (err.message.includes('não podem exceder o déficit')) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// DELETE /api/cidades/:id — remover (admin)
router.delete('/:id', autenticar, apenasAdmin, [
  param('id').isInt({ min: 1 })
], async (req, res) => {
  try {
    await removerCidade(req.params.id);
    res.json({ mensagem: 'Cidade removida com sucesso.' });
  } catch (err) {
    if (err.message === 'Cidade não encontrada.') return res.status(404).json({ error: err.message });
    if (err.message.includes('Não é possível remover')) return res.status(409).json({ error: err.message });
    res.status(500).json({ error: 'Erro interno.' });
  }
});

module.exports = router;
