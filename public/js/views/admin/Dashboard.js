// Admin — Dashboard
const AdminDashboard = {
  template: `
    <div>
      <h1 class="text-h5 font-weight-bold mb-1">Dashboard</h1>
      <p class="text-body-2 text-medium-emphasis mb-6">Visão geral do sistema de remoção</p>

      <v-progress-linear v-if="store.carregando" indeterminate color="primary" class="mb-4"></v-progress-linear>

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

        <!-- Vagas por Cidade -->
        <v-card rounded="xl" class="mb-6" variant="outlined">
          <v-card-title class="d-flex align-center">
            <v-icon icon="mdi-city" class="mr-2"></v-icon>
            Vagas por Cidade
          </v-card-title>
          <v-table density="comfortable">
            <thead>
              <tr>
                <th>Cidade</th>
                <th class="text-center">Vagas Iniciais</th>
                <th class="text-center">Servidores Lotados</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in store.dashboard.vagasPorCidade" :key="c.id">
                <td class="font-weight-medium">{{ c.nome }}</td>
                <td class="text-center">
                  <v-chip :color="c.vagasIniciais > 0 ? 'success' : 'grey'" size="small" variant="tonal">
                    {{ c.vagasIniciais }}
                  </v-chip>
                </td>
                <td class="text-center mono">{{ c.totalServidores }}</td>
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

    Vue.onMounted(() => store.carregarDashboard());

    return { store, stats };
  }
};
