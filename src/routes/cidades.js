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

    // Buscar contagem de interessados (pedidos pendentes)
    // Buscar contagem de interessados (pedidos pendentes)
    const pedidosPendentes = await PedidoRemocao.findAll({
      where: { status: 'pendente' },
      attributes: ['opcao1_cidade_id', 'opcao2_cidade_id', 'opcao3_cidade_id']
    });

    const interessadosMap = new Map();
    pedidosPendentes.forEach(p => {
      [p.opcao1_cidade_id, p.opcao2_cidade_id, p.opcao3_cidade_id].filter(Boolean).forEach(id => {
        interessadosMap.set(id, (interessadosMap.get(id) || 0) + 1);
      });
    });

    // Calcular Vagas Final e Efetivo Pós Remoções
    // Efetivo Pós = Efetivo Atual + Entradas (Totais) - Saídas
    // Vagas Final = Vagas Iniciais + Saídas - Entradas (Exceto "Novos Servidores")

    const pedidosAtendidos = await PedidoRemocao.findAll({
      where: { status: 'atendido' },
      include: [{
        model: Servidor,
        as: 'servidor',
        attributes: ['cidade_lotacao_id'] // Origem do servidor
      }],
      attributes: ['cidade_destino_final_id', 'observacao']
    });

    const saidasMap = new Map();
    const entradasTotaisMap = new Map();     // Todas as entradas (para Efetivo Pós)
    const entradasConsomeVagaMap = new Map(); // Entradas que consomem vaga (para Vagas Final)

    pedidosAtendidos.forEach(p => {
      // Saída: Servidor saiu da cidade de origem
      if (p.servidor && p.servidor.cidade_lotacao_id) {
        const origem = p.servidor.cidade_lotacao_id;
        saidasMap.set(origem, (saidasMap.get(origem) || 0) + 1);
      }

      // Entrada: Servidor chegou na cidade de destino
      if (p.cidade_destino_final_id) {
        const destino = p.cidade_destino_final_id;

        // Contabiliza entrada total
        entradasTotaisMap.set(destino, (entradasTotaisMap.get(destino) || 0) + 1);

        // Só conta como consumo de vaga se NÃO for alocação por novos servidores
        const ehNovoServidor = p.observacao && p.observacao.includes('Alocação por Novos Servidores');

        if (!ehNovoServidor) {
          entradasConsomeVagaMap.set(destino, (entradasConsomeVagaMap.get(destino) || 0) + 1);
        }
      }
    });

    const resultado = cidades.map(c => {
      const saidas = saidasMap.get(c.id) || 0;
      const entradasTotais = entradasTotaisMap.get(c.id) || 0;
      const entradasConsomeVaga = entradasConsomeVagaMap.get(c.id) || 0;

      const vagasFinal = Math.max(0, (c.vagas_iniciais || 0) + saidas - entradasConsomeVaga);
      const efetivoPos = c.efetivo_pos; // Usar valor persistido (pode ser null)

      return {
        id: c.id,
        nome: c.nome,
        vagasIniciais: c.vagas_iniciais,
        vagasFinal,
        efetivoIdeal: c.efetivo_ideal,
        efetivoAtual: c.efetivo_atual,
        efetivoPos, // Novo campo
        totalServidores: c.servidoresLotados?.length || 0,
        totalInteressados: interessadosMap.get(c.id) || 0
      };
    });

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

    const { nome, vagas_iniciais, efetivo_ideal, efetivo_atual } = req.body;

    const existente = await Cidade.findOne({ where: { nome: nome.trim() } });
    if (existente) {
      return res.status(409).json({ error: 'Cidade já cadastrada.' });
    }

    // Validação de Regra de Negócio: Vagas <= (Ideal - Atual)
    // Se não enviado, assume 0
    const vIniciais = Number(vagas_iniciais);
    const vIdeal = Number(efetivo_ideal || 0);
    const vAtual = Number(efetivo_atual || 0);

    const maxVagas = Math.max(0, vIdeal - vAtual);
    if (vIniciais > maxVagas) {
      return res.status(400).json({
        error: `Vagas iniciais (${vIniciais}) não podem exceder o déficit de efetivo (${maxVagas}).`
      });
    }

    const cidade = await Cidade.create({
      nome: nome.trim(),
      vagas_iniciais: vIniciais,
      efetivo_ideal: vIdeal,
      efetivo_atual: vAtual
    });

    res.status(201).json({
      id: cidade.id,
      nome: cidade.nome,
      vagasIniciais: cidade.vagas_iniciais,
      efetivoIdeal: cidade.efetivo_ideal,
      efetivoAtual: cidade.efetivo_atual,
      totalServidores: 0,
      totalInteressados: 0
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
  body('vagas_iniciais').optional().isInt({ min: 0 }),
  body('efetivo_ideal').optional().isInt({ min: 0 }),
  body('efetivo_atual').optional().isInt({ min: 0 })
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

    // Preparar valores para validação
    const nextVagas = req.body.vagas_iniciais !== undefined ? Number(req.body.vagas_iniciais) : cidade.vagas_iniciais;
    const nextIdeal = req.body.efetivo_ideal !== undefined ? Number(req.body.efetivo_ideal) : cidade.efetivo_ideal;
    const nextAtual = req.body.efetivo_atual !== undefined ? Number(req.body.efetivo_atual) : cidade.efetivo_atual;

    const maxVagas = Math.max(0, nextIdeal - nextAtual);
    if (nextVagas > maxVagas) {
      return res.status(400).json({
        error: `Vagas iniciais (${nextVagas}) não podem exceder o déficit de efetivo (${maxVagas}).`
      });
    }

    cidade.vagas_iniciais = nextVagas;
    cidade.efetivo_ideal = nextIdeal;
    cidade.efetivo_atual = nextAtual;

    await cidade.save();

    res.json({
      id: cidade.id,
      nome: cidade.nome,
      vagasIniciais: cidade.vagas_iniciais,
      efetivoIdeal: cidade.efetivo_ideal,
      efetivoAtual: cidade.efetivo_atual
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
