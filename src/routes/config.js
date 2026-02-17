const router = require('express').Router();
const { Configuracao } = require('../models');
const { autenticar, apenasAdmin } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// GET /api/config — retorna configurações públicas (data limite)
router.get('/', async (req, res) => {
  try {
    const dataLimite = await Configuracao.findOne({ where: { chave: 'data_limite_pedidos' } });
    const ultimoProcessamento = await Configuracao.findOne({ where: { chave: 'ultimo_processamento' } });
    const totalNovosServidores = await Configuracao.findOne({ where: { chave: 'total_novos_servidores' } });

    res.json({
      dataLimite: dataLimite ? dataLimite.valor_data : null,
      ultimoProcessamento: ultimoProcessamento ? ultimoProcessamento.valor_data : null,
      totalNovosServidores: totalNovosServidores ? Number(totalNovosServidores.valor_texto) : 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// POST /api/config — admin define configurações
router.post('/', autenticar, apenasAdmin, [
  body('dataLimite').optional().isISO8601().toDate(),
  body('totalNovosServidores').optional().isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { dataLimite, totalNovosServidores } = req.body;

    if (dataLimite !== undefined) {
      let config = await Configuracao.findOne({ where: { chave: 'data_limite_pedidos' } });
      if (config) {
        config.valor_data = dataLimite;
        await config.save();
      } else {
        await Configuracao.create({
          chave: 'data_limite_pedidos',
          valor_data: dataLimite,
          descricao: 'Data limite para servidores enviarem ou editarem pedidos.'
        });
      }
    }

    if (totalNovosServidores !== undefined) {
      let config = await Configuracao.findOne({ where: { chave: 'total_novos_servidores' } });
      if (config) {
        config.valor_texto = String(totalNovosServidores);
        await config.save();
      } else {
        await Configuracao.create({
          chave: 'total_novos_servidores',
          valor_texto: String(totalNovosServidores),
          descricao: 'Total de novos servidores disponíveis para distribuição de vagas.'
        });
      }
    }

    res.json({ success: true, message: 'Configuração atualizada.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

module.exports = router;
