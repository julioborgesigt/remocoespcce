<template>

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
            <template #activator="{ props }">
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
  
</template>

<script setup>
import { ref, onMounted, inject, watch, computed, reactive } from 'vue';
import { useServidoresStore } from '../../stores/servidores';
import { useCidadesStore } from '../../stores/cidades';
import { useAuthStore } from '../../stores/auth';
import { exportToExcel, exportToCSV, exportToPDF } from '../../utils/exporter';

const store = useServidoresStore();
const cidadesStore = useCidadesStore();
const authStore = useAuthStore();

const busca = ref('');
const paginaAtual = ref(1);
const showSnackbar = inject('showSnackbar');

onMounted(async () => {
  await store.carregarTodos(1, 50, true);
  cidadesStore.carregar();
});

const modoExibicao = ref('ativos');
const listaArquivados = ref([]);
const carregandoArquivados = ref(false);

watch(modoExibicao, async (novoModo) => {
  if (novoModo === 'arquivados' && listaArquivados.value.length === 0) {
    carregandoArquivados.value = true;
    try {
      listaArquivados.value = await store.carregarHistorico();
    } finally {
      carregandoArquivados.value = false;
    }
  } else if (novoModo === 'ativos') {
    paginaAtual.value = 1;
    await store.carregarTodos(1, 50, true);
  }
});

const filtrados = computed(() => {
  const listaBase = store.lista;
  let resultado = listaBase.filter(s => s.perfil !== 'admin');
  
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

const dialogEditar = ref(false);
const salvandoEdicao = ref(false);
const servidorEdicao = ref(null);

const formEdicao = reactive({
  opcao1: null,
  opcao2: null,
  opcao3: null,
  motivo_prioridade: 'nenhum',
  data_posse_cargo: null,
  data_lotacao_atual: null,
  tempo_servico_total_dias: 0,
  data_ingresso: null
});

const cidadesOpcoes = computed(() => {
  if (!servidorEdicao.value) return [];
  return cidadesStore.lista.filter(c => c.id !== servidorEdicao.value.cidade_lotacao_id);
});

function abrirDialogEdicao(servidor) {
  servidorEdicao.value = servidor;
  formEdicao.data_posse_cargo = servidor.data_posse_cargo;
  formEdicao.data_lotacao_atual = servidor.data_lotacao_atual;
  formEdicao.tempo_servico_total_dias = servidor.tempo_servico_total_dias;
  formEdicao.data_ingresso = servidor.data_ingresso;

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

  if (cidadesStore.lista.length === 0) cidadesStore.carregar();
  dialogEditar.value = true;
}

async function salvarEdicao() {
  if ((formEdicao.opcao2 || formEdicao.opcao3) && !formEdicao.opcao1) {
    if (showSnackbar) showSnackbar('1ª Opção é obrigatória se houver outras opções.', 'warning');
    return;
  }
  salvandoEdicao.value = true;
  try {
    const token = store.token || authStore.token;

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

    if (showSnackbar) showSnackbar('Dados atualizados com sucesso!');
    dialogEditar.value = false;
    store.carregarTodos(paginaAtual.value, 50, true);
  } catch (error) {
    console.error(error);
    if (showSnackbar) showSnackbar(error.message, 'error');
  } finally {
    salvandoEdicao.value = false;
  }
}

function getVagas(cidadeId) {
  if (!cidadeId) return '-';
  const cidade = cidadesStore.lista.find(c => c.id === cidadeId);
  return cidade ? cidade.vagasIniciais : '?';
}

function exportar(tipo) {
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
    exportToExcel(dados, filename);
  } else if (tipo === 'csv') {
    exportToCSV(dados, filename);
  } else if (tipo === 'pdf') {
    const headers = Object.keys(dados[0]);
    const rows = dados.map(obj => Object.values(obj));
    exportToPDF(headers, rows, 'Relatório de Servidores', filename);
  }
}
</script>
