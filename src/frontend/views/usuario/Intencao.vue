<template>

    <div>
      <h1 class="text-h5 font-weight-bold mb-1">Pedido de Remoção</h1>
      <p class="text-body-2 text-medium-emphasis mb-6">
        Selecione até 3 cidades de destino em ordem de preferência
      </p>

      <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4"></v-progress-linear>

      <!-- Prazo Encerrado -->
      <v-alert
        v-if="configStore.prazoEncerrado"
        type="warning"
        variant="tonal"
        class="mb-6"
        rounded="xl"
        icon="mdi-clock-alert"
      >
        <div class="font-weight-bold">Prazo Encerrado</div>
        <div>O período para envio ou edição de pedidos encerrou em <strong>{{ configStore.dataFormatada }}</strong>.</div>
        <div class="text-caption mt-1">Se você já possui um pedido, ele será processado conforme os critérios.</div>
      </v-alert>

      <!-- Mensagem Informativa sobre o Status Atual -->
      <v-alert
        v-if="pedido"
        :color="pedido.status === 'atendido' ? 'success' : (pedido.status === 'nao_atendido' ? 'warning' : 'info')"
        variant="tonal"
        class="mb-6"
        rounded="xl"
      >
        <template v-if="pedido.status === 'atendido'">
          <div class="font-weight-bold">Prévia: Pedido Atendido</div>
          <div>
            Com base na última análise, feita em <strong>{{ configStore.ultimoProcessamentoFormatado }}</strong>,
            você seria removido para: <strong>{{ pedido.destinoFinal?.nome }}</strong>
          </div>
          <div class="text-caption mt-1">{{ pedido.observacao }}</div>
          <div class="text-caption mt-2 font-weight-bold" v-if="!configStore.prazoEncerrado">
            Você pode alterar seu pedido até a data limite. Isso reiniciará a análise do seu caso.
          </div>
        </template>
        <template v-else-if="pedido.status === 'nao_atendido'">
          <div class="font-weight-bold">Prévia: Pedido Não Atendido</div>
          <div>Atualmente não há vagas para suas opções.</div>
          <div class="text-caption mt-1">Isso pode mudar conforme novos pedidos entram ou saem até a data limite.</div>
        </template>
        <template v-else>
          <div class="font-weight-bold">Pedido Pendente</div>
          <div>Aguardando próximo processamento.</div>
        </template>
      </v-alert>

      <v-row>
        <!-- Formulário -->
        <v-col cols="12" md="7">
          <v-card rounded="xl" variant="outlined" class="pa-6">
            <v-form @submit.prevent="salvar" ref="form" :disabled="configStore.prazoEncerrado">
              <v-alert type="info" variant="tonal" density="compact" class="mb-4" rounded="lg">
                <div class="text-caption">
                  Sua cidade atual: <strong>{{ authStore.usuario?.cidadeLotacao?.nome }}</strong>.
                  Escolha cidades diferentes da sua lotação atual.
                </div>
              </v-alert>

              <v-card class="pa-4 mb-4" variant="outlined" rounded="lg" style="border-color: rgba(var(--v-theme-primary), 0.5)">
                <div class="test-subtitle-2 font-weight-bold text-primary mb-2">Prioridade Máxima (Opcional)</div>
                <p class="text-caption text-medium-emphasis mb-2">
                    Ordem de prioridade na Regra Aprimorada: <strong>Segurança > Saúde > Unidade Familiar</strong>.
                    <br>
                    Em caso de empate no motivo, o desempate é feito pela <strong>antiguidade</strong>.
                </p>
                
                <v-radio-group v-model="formData.motivo_prioridade" color="primary" density="compact" hide-details>
                    <v-radio value="nenhum" label="Nenhum (Apenas Antiguidade)"></v-radio>
                    
                    <v-radio value="saude">
                        <template v-slot:label>
                            <div>
                                <strong class="text-body-2">Motivo de Saúde</strong>
                                <div class="text-caption text-medium-emphasis">Do servidor, cônjuge ou dependente.</div>
                            </div>
                        </template>
                    </v-radio>

                    <v-radio value="unidade_familiar">
                        <template v-slot:label>
                            <div>
                                <strong class="text-body-2">Unidade Familiar</strong>
                                <div class="text-caption text-medium-emphasis">Acompanhamento de cônjuge (servidor) deslocado de ofício.</div>
                            </div>
                        </template>
                    </v-radio>

                    <v-radio value="seguranca">
                        <template v-slot:label>
                            <div>
                                <strong class="text-body-2">Segurança Pessoal</strong>
                                <div class="text-caption text-medium-emphasis">Vítima de violência doméstica ou ameaça de vida.</div>
                            </div>
                        </template>
                    </v-radio>
                </v-radio-group>
                
                <div class="mt-3">
                  <div v-if="simulando" class="text-caption text-center text-primary">
                    <v-progress-circular indeterminate size="20" width="2" class="mr-2"></v-progress-circular>
                    Calculando novas chances...
                  </div>
                  <div v-if="rankingSimulado" class="text-caption text-center mt-1 text-success font-weight-bold">
                    Ranking atualizado para: {{ formData.motivo_prioridade === 'nenhum' ? 'Antiguidade' : 'Prioridade Selecionada' }}
                  </div>
                </div>
              </v-card>

              <v-select
                v-model="formData.opcao1"
                :items="cidadesDisponiveis"
                item-title="nome"
                item-value="id"
                label="1ª Opção de Destino *"
                prepend-inner-icon="mdi-numeric-1-circle"
                variant="outlined"
                density="comfortable"
                :rules="[v => !!v || 'Obrigatório']"
                class="mb-3"
              >
                <template v-slot:item="{ item, props }">
                  <v-list-item v-bind="props">
                    <template v-slot:append>
                      <v-chip size="x-small" :color="corConcorrencia(item.raw.id)" variant="tonal">
                        {{ labelVagas(item.raw.id) }}
                      </v-chip>
                    </template>
                  </v-list-item>
                </template>
              </v-select>

              <v-select
                v-model="formData.opcao2"
                :items="cidadesDisponiveis.filter(c => c.id !== formData.opcao1)"
                item-title="nome"
                item-value="id"
                label="2ª Opção de Destino (opcional)"
                prepend-inner-icon="mdi-numeric-2-circle"
                variant="outlined"
                density="comfortable"
                clearable
                class="mb-3"
              >
                <template v-slot:item="{ item, props }">
                  <v-list-item v-bind="props">
                    <template v-slot:append>
                      <v-chip size="x-small" color="info" variant="tonal" class="mr-1" v-if="labelRanking(item.raw.id)">
                        {{ labelRanking(item.raw.id) }}
                      </v-chip>
                      <v-chip size="x-small" :color="corConcorrencia(item.raw.id)" variant="tonal">
                        {{ labelVagas(item.raw.id) }}
                      </v-chip>
                    </template>
                  </v-list-item>
                </template>
              </v-select>

              <v-select
                v-model="formData.opcao3"
                :items="cidadesDisponiveis.filter(c => c.id !== formData.opcao1 && c.id !== formData.opcao2)"
                item-title="nome"
                item-value="id"
                label="3ª Opção de Destino (opcional)"
                prepend-inner-icon="mdi-numeric-3-circle"
                variant="outlined"
                density="comfortable"
                clearable
                class="mb-3"
              >
                <template v-slot:item="{ item, props }">
                  <v-list-item v-bind="props">
                    <template v-slot:append>
                      <v-chip size="x-small" :color="corConcorrencia(item.raw.id)" variant="tonal">
                        {{ labelVagas(item.raw.id) }}
                      </v-chip>
                    </template>
                  </v-list-item>
                </template>
              </v-select>

              <div class="d-flex flex-column flex-sm-row ga-3 w-100">
                <v-btn
                  :block="mobile"
                  type="submit"
                  color="primary"
                  size="large"
                  rounded="lg"
                  prepend-icon="mdi-content-save"
                  :loading="salvando"
                  :disabled="configStore.prazoEncerrado"
                >
                  {{ pedido ? 'Atualizar Pedido' : 'Enviar Pedido' }}
                </v-btn>

                <v-btn
                  v-if="pedido"
                  :block="mobile"
                  color="error"
                  variant="outlined"
                  size="large"
                  rounded="lg"
                  prepend-icon="mdi-delete"
                  @click="dialogCancelar = true"
                  :disabled="configStore.prazoEncerrado"
                >
                  Cancelar Pedido
                </v-btn>
              </div>
            </v-form>
          </v-card>
        </v-col>

        <!-- Painel de Concorrência -->
        <v-col cols="12" md="5">
          <v-card rounded="xl" variant="outlined" class="pa-4">
            <div class="d-flex align-center mb-3">
              <v-icon icon="mdi-chart-bar" color="primary" class="mr-2"></v-icon>
              <span class="text-subtitle-2 font-weight-bold">Concorrência por Cidade</span>
            </div>
            <p class="text-caption text-medium-emphasis mb-4">
              Dados em tempo real dos pedidos pendentes. Atualize suas preferências para ver sua posição.
            </p>

            <div v-if="cidadesStore.concorrencia.length === 0" class="text-center pa-4 text-medium-emphasis">
              <v-progress-circular v-if="loading" indeterminate size="24"></v-progress-circular>
              <span v-else>Nenhum dado disponível.</span>
            </div>

            <div v-for="cidade in cidadesSelecionadasConcorrencia" :key="cidade.id" class="mb-3">
              <v-card
                variant="tonal"
                :color="corConcorrencia(cidade.id)"
                rounded="lg"
                class="pa-3"
              >
                <div class="d-flex align-center justify-space-between mb-1">
                  <span class="text-subtitle-2 font-weight-bold">{{ cidade.nome }}</span>
                  <v-chip
                    :color="corConcorrencia(cidade.id)"
                    size="x-small"
                    variant="elevated"
                  >
                    {{ labelChance(cidade.id) }}
                  </v-chip>
                </div>
                <div class="d-flex ga-4 text-caption">
                  <div>
                    <v-icon icon="mdi-door-open" size="14" class="mr-1"></v-icon>
                    <strong>{{ cidade.vagasIniciais }}</strong> vaga(s)
                  </div>
                  <div>
                    <v-icon icon="mdi-account-group" size="14" class="mr-1"></v-icon>
                    <strong>{{ cidade.totalOutros !== undefined ? cidade.totalOutros : cidade.totalPedidos }}</strong> interessados
                  </div>
                  <div v-if="cidade.minhaPosicao" class="text-primary font-weight-bold">
                    <v-icon icon="mdi-trophy" size="14" class="mr-1"></v-icon>
                    Sua posição: {{ cidade.minhaPosicao }}º
                  </div>
                </div>
                <v-progress-linear
                  class="mt-2"
                  :model-value="cidade.vagasIniciais > 0 ? Math.min(100, (cidade.totalPedidos / cidade.vagasIniciais) * 100) : 100"
                  :color="corConcorrencia(cidade.id)"
                  height="4"
                  rounded
                ></v-progress-linear>
                <div class="text-caption text-medium-emphasis mt-1">
                  <span v-if="cidade.como1a > 0">{{ cidade.como1a }} como 1ª opção</span>
                  <span v-if="cidade.como2a > 0"> · {{ cidade.como2a }} como 2ª</span>
                  <span v-if="cidade.como3a > 0"> · {{ cidade.como3a }} como 3ª</span>
                </div>
              </v-card>
            </div>

            <!-- Legenda -->
            <v-divider class="my-3"></v-divider>
            <div class="d-flex flex-wrap ga-2">
              <v-chip color="success" size="x-small" variant="tonal">Provável</v-chip>
              <v-chip color="warning" size="x-small" variant="tonal">Competitivo</v-chip>
              <v-chip color="error" size="x-small" variant="tonal">Improvável</v-chip>
              <v-chip color="grey" size="x-small" variant="tonal">Sem vagas</v-chip>
            </div>
            <p class="text-caption text-medium-emphasis mt-2">
              A posição no ranking é baseada na antiguidade (data de ingresso).
              Dados podem mudar conforme outros servidores enviam ou alteram pedidos.
            </p>
          </v-card>
        </v-col>
      </v-row>

      <!-- Dialog Cancelar -->
      <v-dialog v-model="dialogCancelar" max-width="380">
        <v-card rounded="xl" class="pa-2">
          <v-card-title class="text-error">Cancelar Pedido</v-card-title>
          <v-card-text>Tem certeza que deseja cancelar seu pedido de remoção?</v-card-text>
          <v-card-actions class="d-flex flex-column flex-sm-row pa-4 pt-0 w-100 ga-2">
            <v-spacer class="hidden-xs-only"></v-spacer>
            <v-btn :block="mobile" variant="text" @click="dialogCancelar = false">Não</v-btn>
            <v-btn :block="mobile" color="error" variant="flat" rounded="lg" @click="cancelar">Sim, cancelar</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </div>
  
</template>

<script setup>
import { ref, reactive, onMounted, computed, inject, watch } from 'vue';
import { useDisplay } from 'vuetify';
import { useAuthStore } from '../../stores/auth';
import { useCidadesStore } from '../../stores/cidades';
import { useServidoresStore } from '../../stores/servidores';
import { useConfigStore } from '../../stores/config';

const { mobile } = useDisplay();
const authStore = useAuthStore();
const cidadesStore = useCidadesStore();
const srvStore = useServidoresStore();
const configStore = useConfigStore();
const showSnackbar = inject('showSnackbar', () => { });

const loading = ref(true);
const salvando = ref(false);
const simulando = ref(false);
const rankingSimulado = ref(false);
const dialogCancelar = ref(false);

const formData = reactive({ opcao1: null, opcao2: null, opcao3: null, motivo_prioridade: 'nenhum' });

const pedido = computed(() => srvStore.meuPedido);

const cidadesDisponiveis = computed(() =>
    cidadesStore.lista.filter(c => c.id !== authStore.usuario?.cidadeLotacao?.id)
);

// Cidades selecionadas pelo usuário, com dados de concorrência e ranking
const cidadesSelecionadasConcorrencia = computed(() => {
    const ids = [formData.opcao1, formData.opcao2, formData.opcao3].filter(Boolean);
    let lista = [];

    if (ids.length === 0) {
        lista = cidadesStore.concorrencia.filter(
            c => c.id !== authStore.usuario?.cidadeLotacao?.id
        );
    } else {
        lista = ids
            .map(id => cidadesStore.concorrencia.find(c => c.id === id))
            .filter(Boolean);
    }

    return lista.map(c => {
        const rank = cidadesStore.ranking.find(r => r.cidadeId === c.id);
        return {
            ...c,
            minhaPosicao: rank ? rank.posicao : '-',
            totalNoRanking: rank ? rank.totalConcorrentes : '-',
            totalOutros: rank ? rank.totalOutros : '-'
        };
    }).sort((a, b) => {
        const getScore = (item) => {
            if (item.vagasIniciais === 0) return 4;
            let pos = item.minhaPosicao;
            if (pos === '-') return 3;
            if (pos <= item.vagasIniciais) return 1;
            if (pos <= item.vagasIniciais * 2) return 2;
            return 3;
        };
        return getScore(a) - getScore(b);
    });
});

function getConcorrencia(cidadeId) {
    return cidadesStore.concorrencia.find(c => c.id === cidadeId);
}

function corConcorrencia(cidadeId) {
    const c = cidadesSelecionadasConcorrencia.value.find(c => c.id === cidadeId) || getConcorrencia(cidadeId);
    if (!c) return 'grey';
    if (c.vagasIniciais === 0) return 'grey';

    if (c.minhaPosicao && c.minhaPosicao !== '-') {
        if (c.minhaPosicao <= c.vagasIniciais) return 'success';
        if (c.minhaPosicao <= c.vagasIniciais * 2) return 'warning';
        return 'error';
    }

    const total = c.totalPedidos || 0;
    if (total === 0) return 'success';
    const ratio = total / c.vagasIniciais;
    if (ratio <= 1) return 'success';
    if (ratio <= 2) return 'warning';
    return 'error';
}

function labelVagas(cidadeId) {
    const c = getConcorrencia(cidadeId);
    if (!c) return '...';
    return c.vagasIniciais + ' vaga(s) · ' + c.totalPedidos + ' pedido(s)';
}

function labelChance(cidadeId) {
    const c = cidadesSelecionadasConcorrencia.value.find(c => c.id === cidadeId) || getConcorrencia(cidadeId);
    if (!c) return '...';
    if (c.vagasIniciais === 0) return 'Sem vagas';

    if (c.minhaPosicao && c.minhaPosicao !== '-') {
        if (c.minhaPosicao <= c.vagasIniciais) return 'Provável';
        if (c.minhaPosicao <= c.vagasIniciais * 2) return 'Competitivo';
        return 'Improvável';
    }

    const total = c.totalPedidos || 0;
    const ratio = total / c.vagasIniciais;
    if (ratio <= 1) return 'Provável';
    if (ratio <= 2) return 'Competitivo';
    return 'Improvável';
}

function labelRanking(cidadeId) {
    const rank = cidadesStore.ranking.find(r => r.cidadeId === cidadeId);
    if (!rank) return '';
    return `#${rank.posicao}`;
}

onMounted(async () => {
    await Promise.all([
        cidadesStore.carregar(),
        cidadesStore.carregarConcorrencia(),
        cidadesStore.carregarRanking(),
        srvStore.carregarMeuPedido(),
        configStore.fetchConfig()
    ]);

    if (pedido.value) {
        formData.opcao1 = pedido.value.opcao1_cidade_id;
        formData.opcao2 = pedido.value.opcao2_cidade_id;
        formData.opcao3 = pedido.value.opcao3_cidade_id;
        formData.motivo_prioridade = pedido.value.motivo_prioridade || 'nenhum';
    }
    loading.value = false;
});

watch(
    () => formData.motivo_prioridade,
    async (newVal) => {
        simulando.value = true;
        try {
            await cidadesStore.carregarRanking({ motivo: newVal });
            rankingSimulado.value = true;
            setTimeout(() => { rankingSimulado.value = false; }, 2000);
        } catch (e) {
            showSnackbar('Erro ao atualizar ranking', 'error');
        } finally {
            simulando.value = false;
        }
    }
);

async function salvar() {
    if (configStore.prazoEncerrado) return;
    if (!formData.opcao1) return;
    salvando.value = true;
    try {
        await srvStore.salvarPedido(formData.opcao1, formData.opcao2, formData.opcao3, formData.motivo_prioridade);
        await cidadesStore.carregarConcorrencia();
        showSnackbar('Pedido salvo com sucesso!');
    } catch (err) {
        showSnackbar(err.message, 'error');
    } finally {
        salvando.value = false;
    }
}

async function cancelar() {
    if (configStore.prazoEncerrado) return;
    try {
        await srvStore.cancelarPedido();
        formData.opcao1 = null;
        formData.opcao2 = null;
        formData.opcao3 = null;
        formData.motivo_prioridade = 'nenhum';
        dialogCancelar.value = false;
        await cidadesStore.carregarConcorrencia();
        showSnackbar('Pedido cancelado.', 'warning');
    } catch (err) {
        showSnackbar(err.message, 'error');
    }
}
</script>
