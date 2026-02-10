// Admin — Processamento do Algoritmo
const AdminProcessamento = {
  template: `
    <div>
      <h1 class="text-h5 font-weight-bold mb-1">Processamento</h1>
      <p class="text-body-2 text-medium-emphasis mb-6">
        Execute o algoritmo de distribuição de vagas por antiguidade e permutas
      </p>

      <!-- Controles -->
      <v-card rounded="xl" variant="outlined" class="pa-6 mb-6">
        <div class="d-flex flex-wrap ga-3 align-center">
          <v-btn
            color="primary"
            size="large"
            rounded="lg"
            prepend-icon="mdi-play-circle"
            @click="executar"
            :loading="store.processando"
            :disabled="store.processando"
          >
            Executar Processamento
          </v-btn>

          <v-btn
            variant="outlined"
            color="warning"
            rounded="lg"
            prepend-icon="mdi-refresh"
            @click="dialogReset = true"
          >
            Resetar Pedidos
          </v-btn>

          <v-spacer></v-spacer>

          <v-chip v-if="store.dashboard" color="info" variant="tonal">
            <v-icon start icon="mdi-clock-outline"></v-icon>
            {{ store.dashboard.resumo.pedidosPendentes }} pedido(s) pendente(s)
          </v-chip>
        </div>

        <v-alert v-if="store.erro" type="error" variant="tonal" class="mt-4" closable @click:close="store.erro = null">
          {{ store.erro }}
        </v-alert>
      </v-card>

      <!-- Resultado do Processamento -->
      <template v-if="store.resultado">
        <v-alert
          :type="store.resultado.sucesso ? 'success' : 'error'"
          variant="tonal"
          class="mb-6"
          rounded="xl"
        >
          <div class="text-h6 font-weight-bold mb-1">{{ store.resultado.mensagem }}</div>
          <div class="text-body-2" v-if="store.resultado.totalPedidos">
            Total processado: {{ store.resultado.totalPedidos }} pedido(s)
          </div>
        </v-alert>

        <!-- Movimentações -->
        <v-card v-if="store.resultado.movimentacoes?.length" rounded="xl" variant="outlined" class="result-card mb-6">
          <v-card-title class="d-flex align-center">
            <v-icon icon="mdi-check-circle" color="success" class="mr-2"></v-icon>
            Remoções Efetivadas ({{ store.resultado.movimentacoes.length }})
          </v-card-title>
          <v-table density="comfortable">
            <thead>
              <tr>
                <th>Matrícula</th>
                <th>Servidor</th>
                <th>Data Ingresso</th>
                <th>Origem</th>
                <th></th>
                <th>Destino</th>
                <th>Tipo</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(m, i) in store.resultado.movimentacoes" :key="i">
                <td class="mono font-weight-medium">{{ m.matricula }}</td>
                <td>{{ m.servidor }}</td>
                <td class="mono">{{ formatDate(m.dataIngresso) }}</td>
                <td>{{ m.cidadeOrigem }}</td>
                <td class="text-center"><v-icon icon="mdi-arrow-right" color="success" size="20"></v-icon></td>
                <td class="font-weight-bold text-success">{{ m.cidadeDestino }}</td>
                <td>
                  <v-chip size="x-small" variant="tonal" :color="tipoColor(m.observacao)">
                    {{ tipoLabel(m.observacao) }}
                  </v-chip>
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card>

        <!-- Não Atendidos -->
        <v-card v-if="store.resultado.naoAtendidos?.length" rounded="xl" variant="outlined" class="result-card result-card--error mb-6">
          <v-card-title class="d-flex align-center">
            <v-icon icon="mdi-close-circle" color="error" class="mr-2"></v-icon>
            Não Atendidos ({{ store.resultado.naoAtendidos.length }})
          </v-card-title>
          <v-table density="comfortable">
            <thead>
              <tr>
                <th>Matrícula</th>
                <th>Servidor</th>
                <th>Cidade Atual</th>
                <th>Opções Solicitadas</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(n, i) in store.resultado.naoAtendidos" :key="i">
                <td class="mono font-weight-medium">{{ n.matricula }}</td>
                <td>{{ n.servidor }}</td>
                <td>{{ n.cidadeAtual }}</td>
                <td class="text-caption">{{ n.opcoes.join(', ') }}</td>
              </tr>
            </tbody>
          </v-table>
        </v-card>

        <!-- Vagas Remanescentes -->
        <v-card v-if="store.resultado.vagasRemanescentes?.length" rounded="xl" variant="outlined" class="mb-6">
          <v-card-title class="d-flex align-center">
            <v-icon icon="mdi-city" class="mr-2"></v-icon>
            Vagas Remanescentes
          </v-card-title>
          <v-table density="comfortable">
            <thead>
              <tr>
                <th>Cidade</th>
                <th class="text-center">Vagas Iniciais</th>
                <th class="text-center">Vagas Após Processamento</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="v in store.resultado.vagasRemanescentes" :key="v.cidadeId">
                <td class="font-weight-medium">{{ v.cidade }}</td>
                <td class="text-center mono">{{ v.vagasIniciais }}</td>
                <td class="text-center">
                  <v-chip :color="v.vagasAtuais > 0 ? 'success' : 'grey'" size="small" variant="tonal" class="mono">
                    {{ v.vagasAtuais }}
                  </v-chip>
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card>
      </template>

      <!-- Dialog Reset -->
      <v-dialog v-model="dialogReset" max-width="400">
        <v-card rounded="xl" class="pa-2">
          <v-card-title class="text-warning">Resetar Pedidos</v-card-title>
          <v-card-text>
            Isso vai reverter <strong>todos</strong> os pedidos para o status "pendente",
            permitindo reprocessar. As lotações dos servidores <strong>não</strong> serão revertidas.
          </v-card-text>
          <v-card-actions class="pa-4 pt-0">
            <v-spacer></v-spacer>
            <v-btn variant="text" @click="dialogReset = false">Cancelar</v-btn>
            <v-btn color="warning" variant="flat" rounded="lg" @click="resetar">Confirmar Reset</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </div>
  `,

  setup() {
    const store = useProcessamentoStore();
    const showSnackbar = Vue.inject('showSnackbar', () => {});
    const dialogReset = Vue.ref(false);

    Vue.onMounted(() => store.carregarDashboard());

    async function executar() {
      try {
        await store.executar();
        showSnackbar('Processamento concluído!');
        store.carregarDashboard();
      } catch (err) {
        showSnackbar(err.message, 'error');
      }
    }

    async function resetar() {
      try {
        await store.resetar();
        showSnackbar('Pedidos resetados!', 'warning');
        dialogReset.value = false;
      } catch (err) {
        showSnackbar(err.message, 'error');
      }
    }

    function formatDate(d) {
      if (!d) return '-';
      return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
    }

    function tipoLabel(obs) {
      if (!obs) return '-';
      if (obs.includes('Permuta')) return 'Permuta';
      if (obs.includes('pós-permuta')) return 'Cascata';
      return 'Direta';
    }

    function tipoColor(obs) {
      if (!obs) return 'grey';
      if (obs.includes('Permuta')) return 'purple';
      if (obs.includes('pós-permuta')) return 'blue';
      return 'green';
    }

    return { store, dialogReset, executar, resetar, formatDate, tipoLabel, tipoColor };
  }
};
