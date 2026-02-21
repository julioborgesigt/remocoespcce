// Admin — Dashboard
const AdminDashboard = {
  template: `
    <div>
      <h1 class="text-h5 font-weight-bold mb-1">Dashboard</h1>
      <p class="text-body-2 text-medium-emphasis mb-6">Visão geral do sistema de remoção</p>

      <!-- Configurações Rápidas -->
      <v-card class="mb-6 pa-4" variant="outlined" color="primary">
        <div class="d-flex align-center justify-space-between flex-wrap">
          <div>
            <div class="text-subtitle-1 font-weight-bold">
              <v-icon icon="mdi-calendar-clock" class="mr-2"></v-icon>
              Data Limite para Pedidos
            </div>
            <div class="text-body-2 mt-1">
              Atualmente: <strong>{{ configStore.dataFormatada }}</strong>
              <span v-if="configStore.prazoEncerrado" class="text-error ml-2 font-weight-bold">(Encerrado)</span>
              <span v-else class="text-success ml-2 font-weight-bold">(Aberto)</span>
            </div>
          </div>
          <div class="d-flex flex-column flex-sm-row align-sm-center mt-2 mt-sm-0 w-100 w-sm-auto" style="gap: 10px">
            <input type="datetime-local" class="custom-date-input flex-grow-1 flex-sm-grow-0" style="min-width: 0" v-model="novaData" />
            <v-btn 
                color="primary" 
                variant="flat" 
                size="small" 
                :loading="configStore.loading"
                :disabled="!novaData"
                @click="atualizarData"
                class="w-100 w-sm-auto"
            >
              Atualizar Prazo
            </v-btn>
          </div>
        </div>
      </v-card>

      <v-progress-linear v-if="store.carregando" indeterminate color="primary" class="mb-4"></v-progress-linear>

      <!-- Snackbar -->
      <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="3000">
        {{ snackbarText }}
      </v-snackbar>

      <template v-if="store.dashboard">
        <!-- Stats Cards -->
        <v-row class="mb-6">
          <v-col cols="6" md="3" v-for="stat in stats" :key="stat.label">
            <v-card class="stat-card pa-4" :color="stat.bg" variant="tonal">
              <div class="stat-value" :class="'text-' + stat.color">{{ stat.value }}</div>
              <div class="stat-label mt-2">{{ stat.label }}</div>
            </v-card>
          </v-col>
        </v-row>

        <!-- Panorama de Pessoal (Novo) -->
        <v-row class="mb-6" v-if="store.dashboard.statsExtras">
            <!-- Balanço de Vagas -->
            <v-col cols="12" md="4">
                <v-card rounded="xl" variant="outlined" class="h-100">
                    <v-card-title class="d-flex align-center">
                        <v-icon icon="mdi-scale-balance" class="mr-2" color="primary"></v-icon>
                        Balanço de Pessoal
                    </v-card-title>
                    <v-card-text>
                        <v-list density="compact">
                            <v-list-item>
                                <template v-slot:prepend><v-icon icon="mdi-seat" color="grey"></v-icon></template>
                                <v-list-item-title>Total de Vagas</v-list-item-title>
                                <template v-slot:append><strong class="stat-value-small">{{ store.dashboard.statsExtras.totalVagasIniciais }}</strong></template>
                            </v-list-item>
                            <v-divider></v-divider>
                            <v-list-item>
                                <template v-slot:prepend><v-icon icon="mdi-account-alert" color="error"></v-icon></template>
                                <v-list-item-title>Déficit Total (Vagas em aberto)</v-list-item-title>
                                <template v-slot:append><strong class="stat-value-small text-error">{{ store.dashboard.statsExtras.deficitTotal }}</strong></template>
                            </v-list-item>
                            <v-divider></v-divider>
                            <v-list-item>
                                <template v-slot:prepend><v-icon icon="mdi-account-plus" color="warning"></v-icon></template>
                                <v-list-item-title>Excedente Total</v-list-item-title>
                                <template v-slot:append><strong class="stat-value-small text-warning">{{ store.dashboard.statsExtras.excedenteTotal }}</strong></template>
                            </v-list-item>
                        </v-list>
                    </v-card-text>
                </v-card>
            </v-col>

            <!-- Pedidos por Prioridade -->
            <v-col cols="12" md="4">
                <v-card rounded="xl" variant="outlined" class="h-100">
                    <v-card-title class="d-flex align-center">
                        <v-icon icon="mdi-priority-high" class="mr-2" color="warning"></v-icon>
                        Pedidos por Prioridade
                    </v-card-title>
                    <v-card-text>
                         <v-list density="compact">
                            <v-list-item v-for="(qtd, tipo) in store.dashboard.statsExtras.pedidosPorPrioridade" :key="tipo">
                                <template v-slot:prepend>
                                    <v-icon :icon="iconePrioridade(tipo)" :color="corPrioridade(tipo)"></v-icon>
                                </template>
                                <v-list-item-title class="text-capitalize">{{ labelPrioridade(tipo) }}</v-list-item-title>
                                <template v-slot:append>
                                    <v-chip size="small" :color="corPrioridade(tipo)" variant="tonal"><strong>{{ qtd }}</strong></v-chip>
                                </template>
                            </v-list-item>
                        </v-list>
                    </v-card-text>
                </v-card>
            </v-col>
            
            <!-- Top Cidades -->
            <v-col cols="12" md="4">
                <v-card rounded="xl" variant="outlined" class="h-100">
                    <v-card-title class="d-flex align-center">
                        <v-icon icon="mdi-star" class="mr-2" color="secondary"></v-icon>
                        Cidades Mais Procuradas
                    </v-card-title>
                    <v-card-text>
                         <v-list density="compact">
                            <v-list-item v-for="(cidade, i) in store.dashboard.statsExtras.cidadesMaisConcorridas" :key="i">
                                <template v-slot:prepend>
                                    <div class="text-caption font-weight-bold text-medium-emphasis mr-3">{{ i + 1 }}º</div>
                                </template>
                                <v-list-item-title>{{ cidade.nome }}</v-list-item-title>
                                <template v-slot:append>
                                    <span class="text-caption text-medium-emphasis">{{ cidade.total }} interessados</span>
                                </template>
                            </v-list-item>
                            <div v-if="store.dashboard.statsExtras.cidadesMaisConcorridas.length === 0" class="text-center text-caption text-medium-emphasis mt-2">
                                Nenhuma cidade procurada ainda.
                            </div>
                        </v-list>
                    </v-card-text>
                </v-card>
            </v-col>
        </v-row>

        <!-- Vagas por Cidade (Tabela Melhorada) -->
        <v-card rounded="xl" class="mb-6 overflow-x-auto" variant="outlined">
          <v-card-title class="d-flex align-center min-w-max-content">
            <v-icon icon="mdi-city" class="mr-2"></v-icon>
            Vagas e Efetivo por Cidade
          </v-card-title>
          <v-table density="comfortable" hover class="min-w-max-content">
            <thead>
              <tr>
                <th>Cidade</th>
                <th class="text-center">Vagas Iniciais</th>
                <th class="text-center text-medium-emphasis">Ideal</th>
                <th class="text-center">Atual</th>
                <th class="text-center">Interessados</th>
                <th class="text-center font-weight-bold">Efetivo Pós</th>
                <th class="text-center text-primary font-weight-bold">Vagas Final</th>
                <th class="text-center">Situação Atual</th>
                <th class="text-center">Situação com Vagas</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in store.dashboard.vagasPorCidade" :key="c.id">
                <td class="font-weight-medium">{{ c.nome }}</td>
                <td class="text-center">
                  <v-chip :color="c.vagasIniciais > 0 ? 'success' : 'grey'" size="small" variant="tonal" class="font-weight-bold">
                    {{ c.vagasIniciais }}
                  </v-chip>
                </td>
                <td class="text-center mono text-medium-emphasis">{{ c.efetivoIdeal }}</td>
                <td class="text-center mono">{{ c.efetivoAtual }}</td>
                <td class="text-center">
                  <v-chip :color="c.totalInteressados > 0 ? 'info' : 'grey'" size="small" variant="tonal">
                     {{ c.totalInteressados }}
                  </v-chip>
                </td>
                <td class="text-center mono font-weight-bold">
                  <span v-if="c.efetivoPos !== null">{{ c.efetivoPos }}</span>
                  <span v-else>-</span>
                </td>
                <td class="text-center">
                   <v-chip :color="c.vagasFinal > 0 ? 'primary' : 'grey'" size="small" variant="flat" class="font-weight-bold">
                      {{ c.vagasFinal }}
                   </v-chip>
                </td>
                <td class="text-center">
                    <v-chip v-if="c.deficitAtual > 0" color="error" size="small" variant="flat">
                        - {{ c.deficitAtual }} (Déficit)
                    </v-chip>
                    <v-chip v-else-if="c.excedenteAtual > 0" color="warning" size="small" variant="tonal">
                        + {{ c.excedenteAtual }} (Excedente)
                    </v-chip>
                    <v-chip v-else color="success" size="small" variant="text">
                        <v-icon start icon="mdi-check"></v-icon> Ideal
                    </v-chip>
                </td>
                <td class="text-center">
                    <v-chip v-if="c.deficit > 0" color="error" size="small" variant="flat">
                        - {{ c.deficit }} (Déficit)
                    </v-chip>
                    <v-chip v-else-if="c.excedente > 0" color="warning" size="small" variant="tonal">
                        + {{ c.excedente }} (Excedente)
                    </v-chip>
                    <v-chip v-else color="success" size="small" variant="text">
                        <v-icon start icon="mdi-check"></v-icon> Ideal
                    </v-chip>
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card>

        <!-- Últimos Atendidos -->
        <v-row>
          <v-col cols="12" md="6">
            <v-card rounded="xl" variant="outlined" class="result-card">
              <v-card-title class="d-flex align-center">
                <v-icon icon="mdi-check-circle" color="success" class="mr-2"></v-icon>
                Remoções Efetivadas ({{ store.dashboard.resumo.pedidosAtendidos }})
              </v-card-title>
              <v-card-text v-if="store.dashboard.ultimosAtendidos.length === 0">
                <p class="text-body-2 text-medium-emphasis">Nenhum pedido atendido ainda.</p>
              </v-card-text>
              <v-list v-else density="compact">
                <v-list-item v-for="p in store.dashboard.ultimosAtendidos" :key="p.id">
                  <template v-slot:prepend>
                    <v-avatar color="success" size="32" variant="tonal">
                      <v-icon icon="mdi-arrow-right" size="16"></v-icon>
                    </v-avatar>
                  </template>
                  <v-list-item-title class="text-body-2 font-weight-medium">
                    {{ p.servidor?.nome }}
                    <span class="mono text-caption text-medium-emphasis ml-1">({{ p.servidor?.matricula }})</span>
                  </v-list-item-title>
                  <v-list-item-subtitle class="text-caption">
                    → {{ p.destinoFinal?.nome || 'N/A' }}
                    <span class="text-medium-emphasis"> · {{ p.observacao }}</span>
                  </v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-card>
          </v-col>

          <v-col cols="12" md="6">
            <v-card rounded="xl" variant="outlined" class="result-card result-card--error">
              <v-card-title class="d-flex align-center">
                <v-icon icon="mdi-close-circle" color="error" class="mr-2"></v-icon>
                Não Atendidos ({{ store.dashboard.resumo.pedidosNaoAtendidos }})
              </v-card-title>
              <v-card-text v-if="store.dashboard.ultimosNaoAtendidos.length === 0">
                <p class="text-body-2 text-medium-emphasis">Nenhum pedido não atendido.</p>
              </v-card-text>
              <v-list v-else density="compact">
                <v-list-item v-for="p in store.dashboard.ultimosNaoAtendidos" :key="p.id">
                  <template v-slot:prepend>
                    <v-avatar color="error" size="32" variant="tonal">
                      <v-icon icon="mdi-close" size="16"></v-icon>
                    </v-avatar>
                  </template>
                  <v-list-item-title class="text-body-2 font-weight-medium">
                    {{ p.servidor?.nome }}
                    <span class="mono text-caption text-medium-emphasis ml-1">({{ p.servidor?.matricula }})</span>
                  </v-list-item-title>
                  <v-list-item-subtitle class="text-caption">
                    Queria: {{ [p.opcao1?.nome, p.opcao2?.nome, p.opcao3?.nome].filter(Boolean).join(', ') }}
                  </v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-card>
          </v-col>
        </v-row>
      </template>
    </div>
  `,

  setup() {
    const store = useProcessamentoStore();
    const configStore = useConfigStore();

    const novaData = Vue.ref('');
    const snackbar = Vue.ref(false);
    const snackbarColor = Vue.ref('success');
    const snackbarText = Vue.ref('');

    const stats = Vue.computed(() => {
      if (!store.dashboard) return [];
      const r = store.dashboard.resumo;
      return [
        { label: 'Servidores', value: r.totalServidores, color: 'primary', bg: 'blue' },
        { label: 'Pedidos Pendentes', value: r.pedidosPendentes, color: 'warning', bg: 'orange' },
        { label: 'Atendidos', value: r.pedidosAtendidos, color: 'success', bg: 'green' },
        { label: 'Não Atendidos', value: r.pedidosNaoAtendidos, color: 'error', bg: 'red' }
      ];
    });

    const atualizarData = async () => {
      if (!novaData.value) return;
      try {
        await configStore.updateDataLimite(novaData.value);
        snackbarText.value = 'Data limite atualizada com sucesso!';
        snackbarColor.value = 'success';
        snackbar.value = true;
        novaData.value = '';
      } catch (err) {
        snackbarText.value = 'Erro ao atualizar: ' + err.message;
        snackbarColor.value = 'error';
        snackbar.value = true;
      }
    };

    Vue.onMounted(() => {
      store.carregarDashboard();
      configStore.fetchConfig();
    });

    const iconePrioridade = (tipo) => ({
      seguranca: 'mdi-shield-alert',
      saude: 'mdi-hospital-box',
      unidade_familiar: 'mdi-home-heart',
      nenhum: 'mdi-account'
    }[tipo] || 'mdi-help');

    const corPrioridade = (tipo) => ({
      seguranca: 'error',
      saude: 'info',
      unidade_familiar: 'primary',
      nenhum: 'grey'
    }[tipo] || 'grey');

    const labelPrioridade = (tipo) => ({
      seguranca: 'Risco de Vida',
      saude: 'Saúde',
      unidade_familiar: 'Unidade Familiar',
      nenhum: 'Sem Prioridade'
    }[tipo] || tipo);

    return { store, configStore, stats, novaData, atualizarData, snackbar, snackbarColor, snackbarText, iconePrioridade, corPrioridade, labelPrioridade };
  }
};
