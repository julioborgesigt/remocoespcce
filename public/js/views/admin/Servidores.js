// Admin — Lista de Servidores
const AdminServidores = {
  template: `
    <div>
      <h1 class="text-h5 font-weight-bold mb-1">Pedidos</h1>


      <p class="text-body-2 text-medium-emphasis mb-6">Lista ordenada por antiguidade (mais antigo primeiro)</p>

      <!-- Toggle View -->
      <div class="d-flex justify-center mb-6">
        <v-btn-toggle
          v-model="modoExibicao"
          color="primary"
          rounded="xl"
          group
          mandatory
        >
          <v-btn value="ativos" prepend-icon="mdi-format-list-checks">
            Pedidos em Aberto
          </v-btn>
          <v-btn value="arquivados" prepend-icon="mdi-archive-check">
            Arquivados (Atendidos)
          </v-btn>
        </v-btn-toggle>
      </div>

      <div class="d-flex align-center gap-4 mb-4">
        <v-text-field
            v-model="busca"
            prepend-inner-icon="mdi-magnify"
            label="Buscar por nome ou matrícula"
            variant="outlined"
            density="comfortable"
            clearable
            rounded="lg"
            hide-details
            style="max-width:400px"
        ></v-text-field>

        <v-menu>
            <template v-slot:activator="{ props }">
            <v-btn color="secondary" variant="tonal" prepend-icon="mdi-export" v-bind="props" class="ml-2">
                Exportar
            </v-btn>
            </template>
            <v-list>
            <v-list-item @click="exportar('pdf')" prepend-icon="mdi-file-pdf-box" title="PDF"></v-list-item>
            <v-list-item @click="exportar('csv')" prepend-icon="mdi-file-delimited" title="CSV"></v-list-item>
            <v-list-item @click="exportar('xlsx')" prepend-icon="mdi-microsoft-excel" title="Excel"></v-list-item>
            </v-list>
        </v-menu>
      </div>

      </div>

      <!-- Tabela Ativos -->
      <v-card v-if="modoExibicao === 'ativos'" rounded="xl" variant="outlined">
        <v-progress-linear v-if="store.carregando" indeterminate color="primary"></v-progress-linear>
        <v-table density="comfortable" hover>
          <thead>
            <tr>
              <th>Matrícula</th>
              <th>Nome</th>
              <th>Data Ingresso</th>
              <th>Cidade Atual</th>
              <th>Status Pedido</th>
              <th>Opções</th>
              <th class="text-center text-caption px-1" style="width:50px">Vagas Op1</th>
              <th class="text-center text-caption px-1" style="width:50px">Vagas Op2</th>
              <th class="text-center text-caption px-1" style="width:50px">Vagas Op3</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in filtrados" :key="s.id">
              <td class="mono font-weight-medium">{{ s.matricula }}</td>
              <td>{{ s.nome }}</td>
              <td class="mono">{{ formatDate(s.data_ingresso) }}</td>
              <td>{{ s.cidadeLotacao?.nome || '-' }}</td>
              <td>
                <v-chip
                  v-if="s.pedido"
                  :color="statusColor(s.pedido.status)"
                  size="small"
                  variant="tonal"
                >
                  {{ statusLabel(s.pedido.status) }}
                </v-chip>
                <span v-else class="text-caption text-medium-emphasis">Sem pedido</span>
              </td>
              <td>
                <div class="d-flex align-center">
                    <div style="flex:1">
                        <template v-if="s.pedido">
                        <span class="text-caption">
                            1ª {{ s.pedido.opcao1?.nome || '-' }}
                            <template v-if="s.pedido.opcao2"> · 2ª {{ s.pedido.opcao2.nome }}</template>
                            <template v-if="s.pedido.opcao3"> · 3ª {{ s.pedido.opcao3.nome }}</template>
                        </span>
                        <template v-if="s.pedido.destinoFinal">
                            <br />
                            <v-icon icon="mdi-arrow-right" size="12" color="success"></v-icon>
                            <span class="text-caption text-success font-weight-bold">{{ s.pedido.destinoFinal.nome }}</span>
                        </template>
                        </template>
                        <span v-else class="text-caption text-medium-emphasis">—</span>
                    </div>
                    <v-btn icon="mdi-pencil" size="x-small" variant="text" color="primary" @click="abrirDialogEdicao(s)"></v-btn>
                </div>
              </td>
              <td class="text-center text-caption text-medium-emphasis">
                {{ s.pedido ? getVagas(s.pedido.opcao1?.id || s.pedido.opcao1_cidade_id) : '-' }}
              </td>
              <td class="text-center text-caption text-medium-emphasis">
                 {{ s.pedido && s.pedido.opcao2 ? getVagas(s.pedido.opcao2.id || s.pedido.opcao2_cidade_id) : '-' }}
              </td>
              <td class="text-center text-caption text-medium-emphasis">
                 {{ s.pedido && s.pedido.opcao3 ? getVagas(s.pedido.opcao3.id || s.pedido.opcao3_cidade_id) : '-' }}
              </td>
            </tr>
            <tr v-if="filtrados.length === 0 && !store.carregando">
              <td colspan="9" class="text-center pa-8 text-medium-emphasis">
                {{ busca ? 'Nenhum servidor encontrado.' : 'Nenhum servidor cadastrado.' }}
              </td>
            </tr>
          </tbody>
        </v-table>
        <div v-if="store.paginacao.totalPaginas > 1" class="d-flex justify-center pa-4">
          <v-pagination
            v-model="paginaAtual"
            :length="store.paginacao.totalPaginas"
            :total-visible="5"
            density="comfortable"
            rounded="lg"
            @update:model-value="mudarPagina"
          ></v-pagination>
        </div>
        <div class="text-caption text-medium-emphasis text-center pb-3">
          {{ store.paginacao.total }} servidor(es) no total
        </div>
      </v-card>

      <!-- Tabela Arquivados -->
      <v-card v-else rounded="xl" variant="outlined">
        <v-progress-linear v-if="carregandoArquivados" indeterminate color="primary"></v-progress-linear>
        
        <v-alert v-if="!listaArquivados.length && !carregandoArquivados" type="info" variant="text" class="ma-4">
            Nenhum registro arquivado da última temporada.
        </v-alert>

        <v-table v-else density="comfortable" hover>
            <thead>
                <tr>
                    <th>Matrícula</th>
                    <th>Nome</th>
                    <th>Origem</th>
                    <th>Destino Final</th>
                    <th>Status</th>
                    <th>Observação</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="h in listaArquivados" :key="h.id">
                    <td class="mono font-weight-medium">{{ h.matricula }}</td>
                    <td>{{ h.nome }}</td>
                    <td>{{ h.cidade_origem_id }}</td>
                    <td class="font-weight-bold text-success">{{ h.cidade_destino_id || '-' }}</td>
                    <td>
                        <v-chip color="success" size="small" variant="tonal" v-if="h.status === 'atendido'">Atendido</v-chip>
                        <v-chip color="error" size="small" variant="tonal" v-else-if="h.status === 'nao_atendido'">Não Atendido</v-chip>
                        <v-chip size="small" variant="tonal" v-else>Pendente</v-chip>
                    </td>
                    <td class="text-caption">{{ h.observacao }}</td>
                </tr>
            </tbody>
        </v-table>
      </v-card>

      <!-- Dialog Edição de Opções -->
      <v-dialog v-model="dialogEditar" max-width="500">
        <v-card rounded="xl">
            <v-card-title class="bg-primary text-white">Editar Opções de Remoção</v-card-title>
            <v-card-text class="pa-4">
                <p class="mb-4 text-body-2">
                    Editando pedido de <strong>{{ servidorEdicao?.nome }}</strong>.<br>
                    Lotado em: <strong>{{ servidorEdicao?.cidadeLotacao?.nome }}</strong>
                </p>

                <v-form @submit.prevent="salvarEdicao">
                    <v-row>
                        <!-- Dados do Servidor (Regra Aprimorada) -->
                        <v-col cols="12">
                            <h3 class="text-subtitle-2 font-weight-bold mb-2">Dados de Antiguidade (Regra Aprimorada)</h3>
                            <v-row dense>
                                <v-col cols="6">
                                    <v-text-field v-model="formEdicao.data_posse_cargo" label="Data Posse Cargo" type="date" variant="outlined" density="compact"></v-text-field>
                                </v-col>
                                <v-col cols="6">
                                    <v-text-field v-model="formEdicao.data_lotacao_atual" label="Data Lotação Atual" type="date" variant="outlined" density="compact"></v-text-field>
                                </v-col>
                                <v-col cols="6">
                                    <v-text-field v-model="formEdicao.tempo_servico_total_dias" label="Tempo Serviço (Dias)" type="number" variant="outlined" density="compact"></v-text-field>
                                </v-col>
                                <v-col cols="6">
                                    <v-text-field v-model="formEdicao.data_ingresso" label="Data Ingresso (Antiguidade)" type="date" variant="outlined" density="compact"></v-text-field>
                                </v-col>
                            </v-row>
                        </v-col>

                        <v-divider class="my-3"></v-divider>

                        <!-- Dados do Pedido -->
                        <v-col cols="12">
                            <h3 class="text-subtitle-2 font-weight-bold mb-2">Opções e Prioridade</h3>
                            
                            <v-select
                                v-model="formEdicao.motivo_prioridade"
                                :items="[
                                    { title: 'Nenhuma', value: 'nenhum' },
                                    { title: 'Unidade Familiar', value: 'unidade_familiar' },
                                    { title: 'Saúde', value: 'saude' },
                                    { title: 'Segurança (Risco de Vida)', value: 'seguranca' }
                                ]"
                                label="Prioridade Legal"
                                variant="outlined"
                                density="compact"
                                class="mb-3"
                            ></v-select>

                            <v-autocomplete
                                v-model="formEdicao.opcao1"
                                :items="cidadesOpcoes"
                                item-title="nome"
                                item-value="id"
                                label="1ª Opção (Obrigatória)"
                                variant="outlined"
                                density="comfortable"
                                clearable
                                class="mb-3"
                            ></v-autocomplete>

                            <v-autocomplete
                                v-model="formEdicao.opcao2"
                                :items="cidadesOpcoes"
                                item-title="nome"
                                item-value="id"
                                label="2ª Opção (Opcional)"
                                variant="outlined"
                                density="comfortable"
                                clearable
                                class="mb-3"
                            ></v-autocomplete>

                            <v-autocomplete
                                v-model="formEdicao.opcao3"
                                :items="cidadesOpcoes"
                                item-title="nome"
                                item-value="id"
                                label="3ª Opção (Opcional)"
                                variant="outlined"
                                density="comfortable"
                                clearable
                            ></v-autocomplete>
                        </v-col>
                    </v-row>
                </v-form>
            </v-card-text>
            <v-card-actions class="pa-4 pt-0">
                <v-spacer></v-spacer>
                <v-btn variant="text" @click="dialogEditar = false">Cancelar</v-btn>
                <v-btn color="primary" variant="flat" :loading="salvandoEdicao" @click="salvarEdicao">Salvar Alterações</v-btn>
            </v-card-actions>
        </v-card>
      </v-dialog>
    </div>
  `,

  setup() {
    const store = useServidoresStore();
    const busca = Vue.ref('');
    const paginaAtual = Vue.ref(1);
    const showSnackbar = Vue.inject('showSnackbar'); // Injeção correta no root do setup

    Vue.onMounted(async () => {
      // Carrega apenas com pedido inicialmente (aba "ativos")
      await store.carregarTodos(1, 50, true);
      cidadesStore.carregar();
    });

    const modoExibicao = Vue.ref('ativos'); // 'ativos' | 'arquivados'
    const listaArquivados = Vue.ref([]);
    const carregandoArquivados = Vue.ref(false);

    // Watch para carregar arquivados quando trocar de aba
    Vue.watch(modoExibicao, async (novoModo) => {
      if (novoModo === 'arquivados' && listaArquivados.value.length === 0) {
        carregandoArquivados.value = true;
        try {
          listaArquivados.value = await store.carregarHistorico();
        } finally {
          carregandoArquivados.value = false;
        }
      } else if (novoModo === 'ativos') {
        // Recarrega ativos com filtro
        paginaAtual.value = 1;
        await store.carregarTodos(1, 50, true);
      }
    });

    const filtrados = Vue.computed(() => {
      const listaBase = store.lista;

      // Filtro 1: Apenas usuários (não admin) -- Backend já filtra perfil='usuario' mas ok manter
      let resultado = listaBase.filter(s => s.perfil !== 'admin');

      // Removido Filtro 2 (com pedido) pois o backend já traz filtrado

      // Filtro 3: Busca de Texto
      if (busca.value) {
        const q = busca.value.toLowerCase();
        resultado = resultado.filter(s =>
          s.nome.toLowerCase().includes(q) || s.matricula.toLowerCase().includes(q)
        );
      }

      return resultado;
    });

    function mudarPagina(page) {
      paginaAtual.value = page;
      // Se modo for ativos, carrega com pedido, senão carrega normal (mas aqui só tem tabela ativos usando paginacao do store)
      // A tabela arquivados usa listaArquivados separada.
      store.carregarTodos(page, 50, true);
    }

    function formatDate(d) {
      if (!d) return '-';
      return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
    }

    function statusColor(s) {
      return { pendente: 'warning', atendido: 'success', nao_atendido: 'error' }[s] || 'grey';
    }

    function statusLabel(s) {
      return { pendente: 'Pendente', atendido: 'Atendido', nao_atendido: 'Não Atendido' }[s] || s;
    }

    // --- Edição de Pedido (Admin) ---
    const dialogEditar = Vue.ref(false);
    const salvandoEdicao = Vue.ref(false);
    const servidorEdicao = Vue.ref(null);
    const cidadesStore = useCidadesStore(); // Precisa garantir que CidadesStore está carregada

    // Form de edição
    const formEdicao = Vue.reactive({
      opcao1: null,
      opcao2: null,
      opcao3: null,
      motivo_prioridade: 'nenhum',
      data_posse_cargo: null,
      data_lotacao_atual: null,
      tempo_servico_total_dias: 0,
      data_ingresso: null
    });

    const cidadesOpcoes = Vue.computed(() => {
      // Retorna cidades exceto a de lotação do servidor em edição
      if (!servidorEdicao.value) return [];
      return cidadesStore.lista.filter(c => c.id !== servidorEdicao.value.cidade_lotacao_id);
    });

    function abrirDialogEdicao(servidor) {
      servidorEdicao.value = servidor;

      // Init Dados Servidor
      formEdicao.data_posse_cargo = servidor.data_posse_cargo;
      formEdicao.data_lotacao_atual = servidor.data_lotacao_atual;
      formEdicao.tempo_servico_total_dias = servidor.tempo_servico_total_dias;
      formEdicao.data_ingresso = servidor.data_ingresso;

      // Init Dados Pedido
      if (servidor.pedido) {
        formEdicao.opcao1 = servidor.pedido.opcao1_cidade_id;
        formEdicao.opcao2 = servidor.pedido.opcao2_cidade_id;
        formEdicao.opcao3 = servidor.pedido.opcao3_cidade_id;
        formEdicao.motivo_prioridade = servidor.pedido.motivo_prioridade || 'nenhum';
      } else {
        formEdicao.opcao1 = null;
        formEdicao.opcao2 = null;
        formEdicao.opcao3 = null;
        formEdicao.motivo_prioridade = 'nenhum';
      }

      // Garantir que cidades estão carregadas
      if (cidadesStore.lista.length === 0) cidadesStore.carregar();

      dialogEditar.value = true;
    }

    async function salvarEdicao() {
      // 1. Validar Opção 1 se houver alguma opção selecionada
      if ((formEdicao.opcao2 || formEdicao.opcao3) && !formEdicao.opcao1) {
        if (showSnackbar) showSnackbar('1ª Opção é obrigatória se houver outras opções.', 'warning');
        return;
      }

      salvandoEdicao.value = true;

      try {
        const authStore = useAuthStore();
        const token = store.token || authStore.token;

        // A. Salvar Dados do Servidor
        const resServidor = await fetch(`/api/servidores/${servidorEdicao.value.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            data_posse_cargo: formEdicao.data_posse_cargo,
            data_lotacao_atual: formEdicao.data_lotacao_atual,
            tempo_servico_total_dias: formEdicao.tempo_servico_total_dias,
            data_ingresso: formEdicao.data_ingresso
          })
        });

        if (!resServidor.ok) throw new Error('Falha ao atualizar dados do servidor.');

        // B. Salvar Pedido (apenas se houver opção 1 ou se quiser salvar prioridade sem opções - mas prioridade usually goes with request)
        // Se não tiver opcao1, talvez o usuário queira limpar o pedido?
        // Vamos assumir que se o admin abriu, ele quer salvar o estado atual.

        // Se tem ID de opção 1, atualiza/cria. Se não tem nada, não faz nada com pedido OU se tinha pedido antes e agora tá null, deleta? 
        // Por simplicidade, vamo criar/update se tiver opcao1.

        if (formEdicao.opcao1) {
          const resPedido = await fetch(`/api/servidores/${servidorEdicao.value.id}/pedido`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              opcao1_cidade_id: formEdicao.opcao1,
              opcao2_cidade_id: formEdicao.opcao2,
              opcao3_cidade_id: formEdicao.opcao3,
              motivo_prioridade: formEdicao.motivo_prioridade
            })
          });

          if (!resPedido.ok) {
            const data = await resPedido.json();
            throw new Error(data.error || 'Erro ao salvar pedido.');
          }
        }

        // Sucesso
        if (showSnackbar) showSnackbar('Dados atualizados com sucesso!');
        dialogEditar.value = false;
        store.carregarTodos(paginaAtual.value); // Recarregar lista

      } catch (error) {
        console.error(error);
        if (showSnackbar) showSnackbar(error.message, 'error');
      } finally {
        salvandoEdicao.value = false;
      }
    }


    // Helper para obter vagas de uma cidade
    function getVagas(cidadeId) {
      if (!cidadeId) return '-';
      const cidade = cidadesStore.lista.find(c => c.id === cidadeId);
      return cidade ? cidade.vagasIniciais : '?';
    }

    function exportar(tipo) {
      // Exporta a lista que está visível (Ativos ou Arquivados)
      const listaParaExportar = modoExibicao.value === 'ativos' ? filtrados.value : listaArquivados.value;

      if (!listaParaExportar.length) return;

      let dados = [];
      let filename = '';

      if (modoExibicao.value === 'ativos') {
        dados = listaParaExportar.map(s => ({
          Matrícula: s.matricula,
          Nome: s.nome,
          'Data Ingresso': formatDate(s.data_ingresso),
          'Cidade Atual': s.cidadeLotacao?.nome || '-',
          'Status Pedido': statusLabel(s.pedido?.status || '-')
        }));
        filename = 'relatorio_pedidos_ativos';
      } else {
        dados = listaParaExportar.map(h => ({
          Matrícula: h.matricula,
          Nome: h.nome,
          Origem: h.cidade_origem_id,
          Destino: h.cidade_destino_id || '-',
          Status: h.status,
          Obs: h.observacao
        }));
        filename = 'relatorio_historico_arquivado';
      }

      if (tipo === 'xlsx') {
        window.Exporter.exportToExcel(dados, filename);
      } else if (tipo === 'csv') {
        window.Exporter.exportToCSV(dados, filename);
      } else if (tipo === 'pdf') {
        const headers = Object.keys(dados[0]);
        const rows = dados.map(obj => Object.values(obj));
        window.Exporter.exportToPDF(headers, rows, 'Relatório de Servidores', filename);
      }
    }

    return {
      store, busca, paginaAtual, filtrados, mudarPagina, formatDate, statusColor, statusLabel,
      dialogEditar, salvandoEdicao, servidorEdicao, formEdicao, cidadesOpcoes, abrirDialogEdicao, salvarEdicao,
      getVagas, exportar,
      modoExibicao, listaArquivados, carregandoArquivados // Novos retornos
    };
  }
};
