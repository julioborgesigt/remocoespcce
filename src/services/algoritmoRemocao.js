/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  ALGORITMO DE REMOÇÃO POR ANTIGUIDADE COM PERMUTAS      ║
 * ║                                                          ║
 * ║  Fase 1: Alocação direta iterativa (por antiguidade)     ║
 * ║  Fase 2: Detecção e resolução de ciclos (permutas)       ║
 * ║  Fase 3: Re-iteração até estabilizar                     ║
 * ╚══════════════════════════════════════════════════════════╝
 */

const { Cidade, Servidor, PedidoRemocao, sequelize } = require('../models');

/**
 * Função Helper: Executa alocação direta iterativa.
 * Percorre a lista de pedidos por ordem de prioridade.
 * Se houver vaga na cidade desejada, aloca.
 * 
 * Retorna true se houver movimentação.
 */
function executarAlocacaoDireta(pedidosOrdenados, statusPedidos, vagas, rotuloObservacao) {
  const MAX_ITERACOES = 100;
  let houveAlguma = false;
  let houveAlteracao = true;
  let iteracao = 0;

  while (houveAlteracao && iteracao < MAX_ITERACOES) {
    houveAlteracao = false;
    iteracao++;

    for (const pedido of pedidosOrdenados) {
      const status = statusPedidos.get(pedido.id);
      if (status.alocado) continue;

      const cidadeOrigem = pedido.servidor.cidade_lotacao_id;
      const preferencias = [
        pedido.opcao1_cidade_id,
        pedido.opcao2_cidade_id,
        pedido.opcao3_cidade_id
      ].filter(Boolean);

      for (let i = 0; i < preferencias.length; i++) {
        const cidadeDestinoId = preferencias[i];
        if (cidadeDestinoId === cidadeOrigem) continue;

        const vagasDisponiveis = vagas.get(cidadeDestinoId) || 0;

        if (vagasDisponiveis > 0) {
          vagas.set(cidadeDestinoId, vagasDisponiveis - 1);
          // A vaga na origem libera "virtualmente" para a próxima iteração
          vagas.set(cidadeOrigem, (vagas.get(cidadeOrigem) || 0) + 1);

          status.alocado = true;
          status.cidadeDestino = cidadeDestinoId;
          status.observacao = `${rotuloObservacao} (${i + 1}ª opção)`;

          houveAlteracao = true;
          houveAlguma = true;
          break; // Sai do loop de preferências deste pedido
        }
      }

      if (houveAlteracao) break; // Reinicia o loop principal para respeitar antiguidade
    }
  }

  return houveAlguma;
}

/**
 * Função Helper: Busca um ciclo de permuta usando DFS.
 * Tenta encontrar um caminho que volte para a cidade de origem do servidor inicial.
 * Considera TODAS as opções (1, 2, 3) de cada passo.
 */
function buscarCiclo(pedidoInicial, pedidosOrdenados, statusPedidos, profMax = 10) {
  const cidadeOrigemInicial = pedidoInicial.servidor.cidade_lotacao_id;

  // Caminho atual: [{ pedido, cidadeDestino }]
  // Visitados: Set<cidadeId> para evitar loops internos improdutivos

  // Stack para DFS: { pedidoAtual, caminhoAteAgora, cidadesVisitadas }
  const stack = [{
    pedido: pedidoInicial,
    caminho: [],
    visitados: new Set([cidadeOrigemInicial])
  }];

  while (stack.length > 0) {
    const { pedido, caminho, visitados } = stack.pop();

    if (caminho.length >= profMax) continue;

    const opcoes = [
      pedido.opcao1_cidade_id,
      pedido.opcao2_cidade_id,
      pedido.opcao3_cidade_id
    ].filter(id => id && id !== pedido.servidor.cidade_lotacao_id);

    for (const destino of opcoes) {
      // Se o destino é a cidade de origem inicial, FECHAMOS O CICLO!
      if (destino === cidadeOrigemInicial) {
        // Ciclo encontrado!
        return [...caminho, { pedido, cidadeDestino: destino }];
      }

      // Se já visitamos esse destino neste ramo, ignorar (evitar loop infinito local)
      if (visitados.has(destino)) continue;

      // Buscar quem quer sair dessa cidade 'destino'
      // O algoritmo original pegava só o "mais antigo" (pendantes[0]).
      // AQUI pegamos QUALQUER UM que esteja nessa cidade e queira sair.
      // Pela ordem de antiguidade (`pedidosOrdenados`), tentaremos os mais antigos primeiro.

      const candidatos = pedidosOrdenados.filter(p =>
        !statusPedidos.get(p.id).alocado &&
        p.servidor.cidade_lotacao_id === destino
        // && !caminho.some(item => item.pedido.id === p.id) // Não reutilizar pedido (já garantido pelo filtro de alocado mas bom reforçar)
      );

      for (const candidato of candidatos.slice().reverse()) {
        // Inserir no stack (reverse para processar o mais antigo primeiro no pop)
        stack.push({
          pedido: candidato,
          caminho: [...caminho, { pedido, cidadeDestino: destino }],
          visitados: new Set([...visitados, destino])
        });
      }
    }
  }

  return null; // Nenhum ciclo encontrado envolvendo este pedido
}

/**
 * Comparador de pedidos baseado na regra.
 * Retorna < 0 se A tem prioridade sobre B.
 */
function compararPedidos(a, b, regra) {
  const sA = a.servidor;
  const sB = b.servidor;

  if (regra === 'aprimorada') {
    // 1. Prioridade Legal (Segurança > Saúde > Unidade Familiar > Nenhum)
    const prioridadePeso = { seguranca: 3, saude: 2, unidade_familiar: 1, nenhum: 0 };
    const pA = prioridadePeso[a.motivo_prioridade] || 0;
    const pB = prioridadePeso[b.motivo_prioridade] || 0;

    if (pA !== pB) return pB - pA; // Maior peso primeiro

    // 2. Tempo no Cargo Atual (Mais antigo primeiro - Data menor)
    const dataPosseA = sA.data_posse_cargo ? new Date(sA.data_posse_cargo) : new Date(sA.data_ingresso);
    const dataPosseB = sB.data_posse_cargo ? new Date(sB.data_posse_cargo) : new Date(sB.data_ingresso);
    if (dataPosseA.getTime() !== dataPosseB.getTime()) return dataPosseA - dataPosseB;

    // 3. Tempo na Lotação Atual (Mais antigo primeiro - Data menor)
    const dataLotacaoA = sA.data_lotacao_atual ? new Date(sA.data_lotacao_atual) : new Date(sA.data_ingresso);
    const dataLotacaoB = sB.data_lotacao_atual ? new Date(sB.data_lotacao_atual) : new Date(sB.data_ingresso);
    if (dataLotacaoA.getTime() !== dataLotacaoB.getTime()) return dataLotacaoA - dataLotacaoB;

    // 4. Tempo de Serviço Total (Mais tempo primeiro - Valor maior)
    const tempoTotalA = sA.tempo_servico_total_dias || 0;
    const tempoTotalB = sB.tempo_servico_total_dias || 0;
    if (tempoTotalA !== tempoTotalB) return tempoTotalB - tempoTotalA;
  }

  // Fallback e Regra 'antiguidade': Data de Ingresso (Mais antigo primeiro)
  const dataA = new Date(sA.data_ingresso);
  const dataB = new Date(sB.data_ingresso);
  if (dataA.getTime() !== dataB.getTime()) return dataA - dataB;

  return sA.matricula.localeCompare(sB.matricula);
}

/**
 * Calcula o ranking de um servidor para uma lista de cidades.
 * Retorna um array de objetos { cidadeId, posicao, totalConcorrentes }.
 */
async function calcularRankingSimulado(servidorId, regra = 'aprimorada', simulacao = {}) {
  // Busca o servidor solicitante
  const servidorSolicitante = await Servidor.findByPk(servidorId, {
    // ...
    include: [{ model: Cidade, as: 'cidadeLotacao' }]
  });
  if (!servidorSolicitante) throw new Error('Servidor não encontrado');

  // Busca todos os pedidos pendentes de OUTROS servidores
  const pedidosOutros = await PedidoRemocao.findAll({
    where: {
      status: 'pendente',
    },
    include: [{
      model: Servidor,
      as: 'servidor',
      include: [{ model: Cidade, as: 'cidadeLotacao' }]
    }]
  });

  const cidades = await Cidade.findAll();
  const resultado = [];

  // Objeto "falso" de pedido para o servidor solicitante
  let pedidoExistente = pedidosOutros.find(p => p.servidor_id === servidorId);

  // Determinar motivo: simulado > existente > nenhum
  const motivoPrioridade = simulacao.motivo || (pedidoExistente ? pedidoExistente.motivo_prioridade : 'nenhum');

  const pedidoSolicitante = {
    id: pedidoExistente ? pedidoExistente.id : 'simulado',
    servidor: servidorSolicitante,
    motivo_prioridade: motivoPrioridade,
    // Preservar opções originais se existirem, mas para o ranking global isso importa pouco
    // O importante é a "Força" do pedido (prioridade + antiguidade)
  };

  // Filtra lista de competidores (exclui o próprio solicitante da lista real se ele já estava lá)
  const competidores = pedidosOutros.filter(p => p.servidor_id !== servidorId);

  for (const cidade of cidades) {
    if (cidade.id === servidorSolicitante.cidade_lotacao_id) continue;

    const interessados = competidores.filter(p =>
      p.opcao1_cidade_id === cidade.id ||
      p.opcao2_cidade_id === cidade.id ||
      p.opcao3_cidade_id === cidade.id
    );

    const listaSimulada = [...interessados, pedidoSolicitante];

    listaSimulada.sort((a, b) => compararPedidos(a, b, regra));

    const index = listaSimulada.indexOf(pedidoSolicitante);
    const posicao = index + 1;

    const como1a = interessados.filter(p => p.opcao1_cidade_id === cidade.id).length;
    const como2a = interessados.filter(p => p.opcao2_cidade_id === cidade.id).length;
    const como3a = interessados.filter(p => p.opcao3_cidade_id === cidade.id).length;

    resultado.push({
      cidadeId: cidade.id,
      nomeCidade: cidade.nome,
      posicao: posicao,
      totalConcorrentes: interessados.length + 1, // Total COM você
      totalOutros: interessados.length, // Total SEM você
      como1a, como2a, como3a,
      vagas: cidade.vagas_iniciais
    });
  } // loop cidades

  return resultado;
}



/**
 * Executa o processamento completo de remoção.
 */
async function processarRemocao(regra = 'antiguidade', novosServidores = 0) {
  const transaction = await sequelize.transaction();

  try {
    // ── 1. Carregar dados ────────────────────────────────────
    const cidades = await Cidade.findAll({ transaction });
    const pedidos = await PedidoRemocao.findAll({
      where: { status: 'pendente' },
      include: [{
        model: Servidor,
        as: 'servidor',
        include: [{ model: Cidade, as: 'cidadeLotacao' }]
      }],
      transaction
    });

    if (pedidos.length === 0) {
      await transaction.rollback();
      return { sucesso: true, mensagem: 'Nenhum pedido pendente.', movimentacoes: [], naoAtendidos: [] };
    }

    // ── 2. Inicialização ─────────────────────────────────────
    const vagas = new Map();
    for (const cidade of cidades) {
      vagas.set(cidade.id, cidade.vagas_iniciais);
    }

    // Filtrar pedidos inválidos
    const pedidosValidos = pedidos.filter(p => {
      const origem = p.servidor.cidade_lotacao_id;
      const opcoes = [p.opcao1_cidade_id, p.opcao2_cidade_id, p.opcao3_cidade_id].filter(Boolean);
      const temOpcaoValida = opcoes.some(dest => dest !== origem);
      return temOpcaoValida;
    });

    // Ordenar pedidos baseado na regra selecionada
    const pedidosOrdenados = [...pedidosValidos].sort((a, b) => compararPedidos(a, b, regra));

    // Status: { alocado: false, cidadeDestino: null }
    const statusPedidos = new Map();
    for (const p of pedidosOrdenados) {
      statusPedidos.set(p.id, { alocado: false, cidadeDestino: null, observacao: '' });
    }

    // ── 2.1. Contagem atual de servidores por cidade ─────────
    const servidoresPorCidade = await Servidor.count({
      group: ['cidade_lotacao_id']
    });
    const contagemMap = new Map(); // CidadeID -> QtdServidores
    servidoresPorCidade.forEach(item => {
      contagemMap.set(item.cidade_lotacao_id, item.count);
    });

    // ── 3. FASE 1.5 — Alocação com Novos Servidores (REMOVIDO A PEDIDO)
    // O usuário solicitou que apenas vagas iniciais explícitas ou permutas permitam lotação.
    // A lógica anterior de preencher déficit automaticamente foi desativada.

    // (Código anterior removido para garantir apenas Vagas Iniciais ou Permuta)

    // ── 3. FASE 1 — Alocação Direta (Restante) ──────────────────────────
    executarAlocacaoDireta(pedidosOrdenados, statusPedidos, vagas, 'Alocação direta');

    // ── 4. FASE 2 — Detecção e Resolução de Permutas (Ciclos) 
    let houvePermuta = true;
    while (houvePermuta) {
      houvePermuta = false;

      // Percorrer a lista ordenada. O servidor mais antigo que conseguir formar ciclo tem prioridade.
      for (const pedido of pedidosOrdenados) {
        if (statusPedidos.get(pedido.id).alocado) continue;

        // Tentar encontrar um ciclo que envolva este pedido
        const ciclo = buscarCiclo(pedido, pedidosOrdenados, statusPedidos);

        if (ciclo) {
          // Ciclo encontrado! Aplicar permuta.
          const cicloStr = ciclo.length.toString();

          for (const passo of ciclo) {
            const status = statusPedidos.get(passo.pedido.id);
            const opcaoNum = [
              passo.pedido.opcao1_cidade_id,
              passo.pedido.opcao2_cidade_id,
              passo.pedido.opcao3_cidade_id
            ].indexOf(passo.cidadeDestino) + 1;

            status.alocado = true;
            status.cidadeDestino = passo.cidadeDestino;
            status.observacao = `Permuta circular (${opcaoNum}ª opção, ciclo de ${cicloStr})`;
          }

          houvePermuta = true;
          // Reinicia a varredura do zero, pois o grafo mudou (vários pedidos foram alocados)
          break;
        }
      }

      // Se houve permuta, rodar alocação direta novamente antes de buscar mais ciclos
      // Isso é importante porque permutas podem não abrir vagas novas (troca 1 por 1),
      // mas é uma boa prática garantir que vagas liberadas sejam ocupadas imediatamente.
      if (houvePermuta) {
        executarAlocacaoDireta(pedidosOrdenados, statusPedidos, vagas, 'Alocação pós-permuta');
      }
    }

    // ── 5. FASE 3 - Alocação Final (Cleanup) ────────────────
    // Tenta uma última passada de alocação direta para garantir q nada foi perdido
    executarAlocacaoDireta(pedidosOrdenados, statusPedidos, vagas, 'Alocação final');


    // ── 6. Persistir resultados ──────────────────────────────
    const movimentacoes = [];
    const naoAtendidos = [];
    const cidadesMap = new Map(cidades.map(c => [c.id, c.nome]));

    for (const pedido of pedidosOrdenados) {
      const status = statusPedidos.get(pedido.id);

      if (status.alocado) {
        await pedido.update({
          status: 'atendido',
          cidade_destino_final_id: status.cidadeDestino,
          observacao: status.observacao
        }, { transaction });

        movimentacoes.push({
          servidor: pedido.servidor.nome,
          matricula: pedido.servidor.matricula,
          dataIngresso: pedido.servidor.data_ingresso,
          cidadeOrigem: cidadesMap.get(pedido.servidor.cidade_lotacao_id) || 'N/A',
          cidadeDestino: cidadesMap.get(status.cidadeDestino) || 'N/A',
          observacao: status.observacao
        });
      } else {
        await pedido.update({
          status: 'nao_atendido',
          observacao: 'Nenhuma vaga disponível nas opções solicitadas.'
        }, { transaction });

        naoAtendidos.push({
          servidor: pedido.servidor.nome,
          matricula: pedido.servidor.matricula,
          dataIngresso: pedido.servidor.data_ingresso,
          cidadeOrigem: cidadesMap.get(pedido.servidor.cidade_lotacao_id) || 'N/A',
          opcoes: [
            cidadesMap.get(pedido.opcao1_cidade_id),
            cidadesMap.get(pedido.opcao2_cidade_id),
            cidadesMap.get(pedido.opcao3_cidade_id)
          ].filter(Boolean)
        });
      }
    }

    // Vagas remanescentes
    const vagasRemanescentes = [];
    for (const cidade of cidades) {
      vagasRemanescentes.push({
        cidade: cidade.nome,
        cidadeId: cidade.id,
        vagasIniciais: cidade.vagas_iniciais,
        vagasAtuais: vagas.get(cidade.id) || 0
      });
    }

    // ── 7. Atualizar Efetivo Pós nas Cidades ─────────────────
    // Calcular o delta de movimentação para cada cidade e persistir em efetivo_pos
    const deltaMap = new Map(); // cidadeId -> saldo
    cidades.forEach(c => deltaMap.set(c.id, 0));

    // Iterar sobre statusPedidos para calcular deltas
    for (const [pedidoId, status] of statusPedidos) {
      if (status.alocado) {
        const pedido = pedidosOrdenados.find(p => p.id === pedidoId);
        if (pedido) {
          const origemId = pedido.servidor.cidade_lotacao_id;
          const destinoId = status.cidadeDestino;

          // Sai da origem
          if (origemId) {
            deltaMap.set(origemId, (deltaMap.get(origemId) || 0) - 1);
          }
          // Entra no destino
          if (destinoId) {
            deltaMap.set(destinoId, (deltaMap.get(destinoId) || 0) + 1);
          }
        }
      }
    }

    // Persistir no banco
    for (const cidade of cidades) {
      const delta = deltaMap.get(cidade.id) || 0;
      const atual = Number(cidade.efetivo_atual) || 0;
      // Novo efetivo simulado
      const pos = Math.max(0, atual + delta);

      await cidade.update({ efetivo_pos: pos }, { transaction });
    }

    await transaction.commit();

    return {
      sucesso: true,
      mensagem: `Processamento concluído. ${movimentacoes.length} remoções efetivadas, ${naoAtendidos.length} não atendidos.`,
      totalPedidos: pedidos.length,
      movimentacoes,
      naoAtendidos,
      vagasRemanescentes
    };

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

module.exports = { processarRemocao, calcularRankingSimulado, compararPedidos };
