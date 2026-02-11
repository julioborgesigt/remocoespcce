const router = require('express').Router();
const { Configuracao } = require('../models');
const { autenticar, apenasAdmin } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// GET /api/config — retorna configurações públicas (data limite)
router.get('/', async (req, res) => {
    try {
        const dataLimite = await Configuracao.findOne({ where: { chave: 'data_limite_pedidos' } });
        const ultimoProcessamento = await Configuracao.findOne({ where: { chave: 'ultimo_processamento' } });

        res.json({
            dataLimite: dataLimite ? dataLimite.valor_data : null,
            ultimoProcessamento: ultimoProcessamento ? ultimoProcessamento.valor_data : null
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// POST /api/config — admin define data limite
router.post('/', autenticar, apenasAdmin, [
    body('dataLimite').optional().isISO8601().toDate()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { dataLimite } = req.body;

        if (dataLimite) {
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

        res.json({ success: true, message: 'Configuração atualizada.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro interno' });
    }
});

module.exports = router;
