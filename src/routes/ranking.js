const express = require('express');
const router = express.Router();
const { autenticar } = require('../middleware/auth');
const { calcularRankingSimulado } = require('../services/algoritmoRemocao');

/**
 * GET /api/ranking
 * Retorna o ranking simulado para o usuário logado em todas as cidades.
 */
router.get('/', autenticar, async (req, res) => {
    try {
        const servidorId = req.usuario.id;

        // TODO: Get regra from config or query param? Taking default 'aprimorada' for now or from query
        const regra = req.query.regra || 'aprimorada';
        const simulacao = req.query.motivo ? { motivo: req.query.motivo } : {};

        const ranking = await calcularRankingSimulado(servidorId, regra, simulacao);

        res.json(ranking);
    } catch (error) {
        console.error('Erro ao calcular ranking:', error);
        res.status(500).json({ error: 'Erro ao calcular ranking.' });
    }
});

module.exports = router;
