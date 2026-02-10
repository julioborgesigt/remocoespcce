const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { Servidor, Cidade } = require('../models');
const { gerarToken, autenticar } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', [
  body('matricula').trim().notEmpty().withMessage('Matrícula é obrigatória.'),
  body('senha').notEmpty().withMessage('Senha é obrigatória.')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { matricula, senha } = req.body;

    const servidor = await Servidor.findOne({
      where: { matricula: matricula.toUpperCase().trim() },
      include: [{ model: Cidade, as: 'cidadeLotacao' }]
    });

    if (!servidor) {
      return res.status(401).json({ error: 'Matrícula ou senha incorretos.' });
    }

    const senhaValida = await bcrypt.compare(senha, servidor.senha_hash);
    if (!senhaValida) {
      return res.status(401).json({ error: 'Matrícula ou senha incorretos.' });
    }

    const token = gerarToken(servidor);

    res.json({
      token,
      usuario: {
        id: servidor.id,
        matricula: servidor.matricula,
        nome: servidor.nome,
        perfil: servidor.perfil,
        dataIngresso: servidor.data_ingresso,
        cidadeLotacao: servidor.cidadeLotacao
          ? { id: servidor.cidadeLotacao.id, nome: servidor.cidadeLotacao.nome }
          : null
      }
    });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// POST /api/auth/registrar
router.post('/registrar', [
  body('matricula').trim().notEmpty().withMessage('Matrícula é obrigatória.')
    .isLength({ max: 30 }).withMessage('Matrícula: máx 30 caracteres.'),
  body('nome').trim().notEmpty().withMessage('Nome é obrigatório.')
    .isLength({ min: 3, max: 150 }),
  body('senha').isLength({ min: 6 }).withMessage('Senha: mínimo 6 caracteres.'),
  body('data_ingresso').isISO8601().withMessage('Data de ingresso inválida.'),
  body('cidade_lotacao_id').isInt({ min: 1 }).withMessage('Cidade de lotação é obrigatória.')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { matricula, nome, senha, data_ingresso, cidade_lotacao_id } = req.body;
    const matriculaUp = matricula.toUpperCase().trim();

    // Verifica se matrícula já existe
    const existente = await Servidor.findOne({ where: { matricula: matriculaUp } });
    if (existente) {
      return res.status(409).json({ error: 'Matrícula já cadastrada.' });
    }

    // Verifica se cidade existe
    const cidade = await Cidade.findByPk(cidade_lotacao_id);
    if (!cidade) {
      return res.status(400).json({ error: 'Cidade de lotação não encontrada.' });
    }

    const senha_hash = await bcrypt.hash(senha, 12);

    const servidor = await Servidor.create({
      matricula: matriculaUp,
      nome: nome.trim(),
      senha_hash,
      data_ingresso,
      cidade_lotacao_id,
      perfil: 'usuario'
    });

    const token = gerarToken(servidor);

    res.status(201).json({
      token,
      usuario: {
        id: servidor.id,
        matricula: servidor.matricula,
        nome: servidor.nome,
        perfil: servidor.perfil,
        dataIngresso: servidor.data_ingresso,
        cidadeLotacao: { id: cidade.id, nome: cidade.nome }
      }
    });
  } catch (err) {
    console.error('Erro no registro:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// GET /api/auth/me
router.get('/me', autenticar, async (req, res) => {
  try {
    const servidor = await Servidor.findByPk(req.usuario.id, {
      attributes: { exclude: ['senha_hash'] },
      include: [{ model: Cidade, as: 'cidadeLotacao' }]
    });

    if (!servidor) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    res.json({
      id: servidor.id,
      matricula: servidor.matricula,
      nome: servidor.nome,
      perfil: servidor.perfil,
      dataIngresso: servidor.data_ingresso,
      cidadeLotacao: servidor.cidadeLotacao
        ? { id: servidor.cidadeLotacao.id, nome: servidor.cidadeLotacao.nome }
        : null
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno.' });
  }
});

module.exports = router;
