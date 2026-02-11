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
const { Op } = require('sequelize');

/**
 * Executa o processamento completo de remoção.
 * Retorna um objeto com o resultado detalhado.
 */
async function processarRemocao() {
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

    // ── 2. Estruturas de controle ────────────────────────────
    // Mapa de vagas disponíveis por cidade
    const vagas = new Map();
    for (const cidade of cidades) {
      vagas.set(cidade.id, cidade.vagas_iniciais);
    }

    // Filtrar pedidos inválidos (onde todas opções são a própria cidade de origem)
    // Isso evita processamento desnecessário e "ruído" nos dados.
    const pedidosValidos = pedidos.filter(p => {
      const origem = p.servidor.cidade_lotacao_id;
      const opcoes = [p.opcao1_cidade_id, p.opcao2_cidade_id, p.opcao3_cidade_id].filter(Boolean);

      // Se não tem opções ou todas as opções são iguais à origem
      const temOpcaoValida = opcoes.some(dest => dest !== origem);

      if (!temOpcaoValida && opcoes.length > 0) {
        console.warn(`[ALERTA] Pedido ${p.id} (Matrícula: ${p.servidor.matricula}) ignorado: Todas as opções são para a própria lotação (${origem}).`);
      }
      return temOpcaoValida;
    });

    // Ordenar pedidos por antiguidade (menor data = mais antigo = prioridade)
    const pedidosOrdenados = [...pedidosValidos].sort((a, b) => {
      const dataA = new Date(a.servidor.data_ingresso);
      const dataB = new Date(b.servidor.data_ingresso);
      if (dataA.getTime() !== dataB.getTime()) return dataA - dataB;
      // Desempate por matrícula (menor primeiro)
      return a.servidor.matricula.localeCompare(b.servidor.matricula);
    });

    // Status de cada pedido: { alocado: bool, cidadeDestino: id|null }
    const statusPedidos = new Map();
    for (const p of pedidosOrdenados) {
      statusPedidos.set(p.id, { alocado: false, cidadeDestino: null, observacao: '' });
    }

    // ── 3. FASE 1 — Alocação Direta Iterativa ───────────────
    let houveAlteracao = true;
    let iteracao = 0;
    const MAX_ITERACOES = 100; // safety guard

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

          // Não pode ir para a própria cidade
          if (cidadeDestinoId === cidadeOrigem) continue;

          const vagasDisponiveis = vagas.get(cidadeDestinoId) || 0;

          if (vagasDisponiveis > 0) {
            // Alocar!
            vagas.set(cidadeDestinoId, vagasDisponiveis - 1);
            vagas.set(cidadeOrigem, (vagas.get(cidadeOrigem) || 0) + 1); // Vaga dinâmica

            status.alocado = true;
            status.cidadeDestino = cidadeDestinoId;
            status.observacao = `Alocação direta (${i + 1}ª opção, iteração ${iteracao})`;

            houveAlteracao = true;

            // IMPORTANTE: Se alocamos uma vaga, devemos reiniciar a iteração desde o início da lista de pedidos.
            // Isso garante que um servidor MAIS ANTIGO, que foi pulado anteriormente por falta de vaga,
            // tenha prioridade sobre servidores mais novos caso a vaga que abriu seja a que ele queria.
            break;
          }
        }

        // Se houve alteração (alocação), sai do loop de pedidos para reiniciar o while (voltar ao topo da lista)
        if (houveAlteracao) break;
      }
    }

    // ── 4. FASE 2 — Detecção de Ciclos (Permutas) ───────────
    let ciclosResolvidos = true;

    while (ciclosResolvidos) {
      ciclosResolvidos = false;

      // Pedidos ainda pendentes
      const pendentes = pedidosOrdenados.filter(p => !statusPedidos.get(p.id).alocado);
      if (pendentes.length < 2) break;

      // Construir grafo: cidadeOrigem → [{ pedido, cidadeDestino }]
      // Para cada cidade, o servidor mais antigo que quer sair
      const grafoCidades = new Map(); // cidadeOrigem → cidadeDestino (do servidor mais antigo)
      const servidorNoCiclo = new Map(); // cidadeOrigem → pedido (o mais antigo pendente daquela cidade)

      for (const pedido of pendentes) {
        const cidadeOrigem = pedido.servidor.cidade_lotacao_id;

        // Se já tem alguém dessa cidade no grafo, o atual é menos prioritário (lista já ordenada)
        if (servidorNoCiclo.has(cidadeOrigem)) continue;

        // Pega a primeira preferência viável
        const preferencias = [
          pedido.opcao1_cidade_id,
          pedido.opcao2_cidade_id,
          pedido.opcao3_cidade_id
        ].filter(id => id && id !== cidadeOrigem);

        if (preferencias.length > 0) {
          // Tenta cada preferência para formar ciclo
          for (const destino of preferencias) {
            servidorNoCiclo.set(cidadeOrigem, { pedido, destino });
            grafoCidades.set(cidadeOrigem, destino);
            break; // Usa a primeira preferência; se não formar ciclo, tentaremos outras depois
          }
        }
      }

      // Detectar ciclos usando DFS
      const ciclos = detectarCiclos(grafoCidades);

      for (const ciclo of ciclos) {
        // Verificar se todos os nós do ciclo têm um servidor disposto
        const todosPresentes = ciclo.every(cidadeId => servidorNoCiclo.has(cidadeId));
        if (!todosPresentes) continue;

        // Verificar se as preferências formam o ciclo corretamente
        let cicloValido = true;
        for (let i = 0; i < ciclo.length; i++) {
          const cidadeAtual = ciclo[i];
          const cidadeProxima = ciclo[(i + 1) % ciclo.length];
          const info = servidorNoCiclo.get(cidadeAtual);

          if (!info || info.destino !== cidadeProxima) {
            cicloValido = false;
            break;
          }
        }

        if (!cicloValido) continue;

        // Executar a permuta circular!
        for (const cidadeId of ciclo) {
          const info = servidorNoCiclo.get(cidadeId);
          const status = statusPedidos.get(info.pedido.id);
          const opcaoNum = [
            info.pedido.opcao1_cidade_id,
            info.pedido.opcao2_cidade_id,
            info.pedido.opcao3_cidade_id
          ].indexOf(info.destino) + 1;

          status.alocado = true;
          status.cidadeDestino = info.destino;
          status.observacao = `Permuta circular (${opcaoNum}ª opção, ciclo de ${ciclo.length} servidores)`;
        }

        ciclosResolvidos = true;
      }

      // Se resolvemos ciclos, tentar mais preferências para novos ciclos
      if (!ciclosResolvidos) {
        // Tentar com preferências alternativas
        const cicloComAlternativas = tentarCiclosComAlternativas(pendentes, statusPedidos, servidorNoCiclo);
        if (cicloComAlternativas) {
          ciclosResolvidos = true;
        }
      }

      // Após resolver ciclos, re-executar alocação direta (novas vagas podem ter aberto)
      if (ciclosResolvidos) {
        let houveNova = true;
        while (houveNova) {
          houveNova = false;
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
                vagas.set(cidadeOrigem, (vagas.get(cidadeOrigem) || 0) + 1);
                status.alocado = true;
                status.cidadeDestino = cidadeDestinoId;
                status.observacao = `Alocação pós-permuta (${i + 1}ª opção)`;
                houveNova = true;

                // Reiniciar do início se alocou
                break;
              }
            }
            if (houveNova) break;
          }
        }
      }
    }

    // ── 5. Persistir resultados ──────────────────────────────
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

        // ATENÇÃO: NÃO atualizamos a lotação do servidor aqui.
        // O processamento serve para indicar o STATUS atual do pedido (se seria atendido ou não).
        // A efetivação da mudança deve ser um passo administrativo posterior (homologação).
        /*
        await pedido.servidor.update({
          cidade_lotacao_id: status.cidadeDestino
        }, { transaction });
        */

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
          cidadeAtual: cidadesMap.get(pedido.servidor.cidade_lotacao_id) || 'N/A',
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

/**
 * Detecta ciclos em um grafo dirigido (Map<chave, valor> = Map<origem, destino>).
 * Retorna um array de ciclos, onde cada ciclo é um array de nós.
 */
function detectarCiclos(grafo) {
  const ciclos = [];
  const visitado = new Set();
  const emPilha = new Set();

  function dfs(no, caminho) {
    if (emPilha.has(no)) {
      // Encontramos um ciclo! Extrair a partir de onde o nó aparece no caminho
      const inicio = caminho.indexOf(no);
      if (inicio !== -1) {
        ciclos.push(caminho.slice(inicio));
      }
      return;
    }

    if (visitado.has(no)) return;

    visitado.add(no);
    emPilha.add(no);
    caminho.push(no);

    const proximo = grafo.get(no);
    if (proximo !== undefined) {
      dfs(proximo, caminho);
    }

    caminho.pop();
    emPilha.delete(no);
  }

  for (const no of grafo.keys()) {
    if (!visitado.has(no)) {
      dfs(no, []);
    }
  }

  return ciclos;
}

/**
 * Tenta formar ciclos usando preferências alternativas (2ª e 3ª opção).
 */
function tentarCiclosComAlternativas(pendentes, statusPedidos, servidorNoCicloAtual) {
  // Para cada cidade de origem, tentar a próxima preferência
  for (const [cidadeOrigem, info] of servidorNoCicloAtual) {
    const pedido = info.pedido;
    const preferencias = [
      pedido.opcao1_cidade_id,
      pedido.opcao2_cidade_id,
      pedido.opcao3_cidade_id
    ].filter(id => id && id !== cidadeOrigem);

    const idxAtual = preferencias.indexOf(info.destino);
    if (idxAtual < preferencias.length - 1) {
      // Tem mais preferências para tentar
      for (let i = idxAtual + 1; i < preferencias.length; i++) {
        const novoGrafo = new Map();
        const novoMapa = new Map(servidorNoCicloAtual);

        // Atualizar este nó com nova preferência
        novoMapa.set(cidadeOrigem, { pedido, destino: preferencias[i] });

        for (const [origem, inf] of novoMapa) {
          if (!statusPedidos.get(inf.pedido.id).alocado) {
            novoGrafo.set(origem, inf.destino);
          }
        }

        const ciclos = detectarCiclos(novoGrafo);

        for (const ciclo of ciclos) {
          let cicloValido = true;
          for (let j = 0; j < ciclo.length; j++) {
            const cidadeAtual = ciclo[j];
            const cidadeProxima = ciclo[(j + 1) % ciclo.length];
            const inf = novoMapa.get(cidadeAtual);
            if (!inf || inf.destino !== cidadeProxima) {
              cicloValido = false;
              break;
            }
          }

          if (cicloValido) {
            // Executar!
            for (const cid of ciclo) {
              const inf = novoMapa.get(cid);
              const status = statusPedidos.get(inf.pedido.id);
              const opcaoNum = [
                inf.pedido.opcao1_cidade_id,
                inf.pedido.opcao2_cidade_id,
                inf.pedido.opcao3_cidade_id
              ].indexOf(inf.destino) + 1;

              status.alocado = true;
              status.cidadeDestino = inf.destino;
              status.observacao = `Permuta circular alternativa (${opcaoNum}ª opção, ciclo de ${ciclo.length})`;
            }
            return true;
          }
        }
      }
    }
  }

  return false;
}

module.exports = { processarRemocao };
