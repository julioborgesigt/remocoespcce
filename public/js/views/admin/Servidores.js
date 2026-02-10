// Admin — Lista de Servidores
const AdminServidores = {
  template: `
    <div>
      <h1 class="text-h5 font-weight-bold mb-1">Servidores</h1>
      <p class="text-body-2 text-medium-emphasis mb-6">Lista ordenada por antiguidade (mais antigo primeiro)</p>

      <v-text-field
        v-model="busca"
        prepend-inner-icon="mdi-magnify"
        label="Buscar por nome ou matrícula"
        variant="outlined"
        density="comfortable"
        clearable
        rounded="lg"
        class="mb-4"
        style="max-width:400px"
      ></v-text-field>

      <v-card rounded="xl" variant="outlined">
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
              </td>
            </tr>
            <tr v-if="filtrados.length === 0 && !store.carregando">
              <td colspan="6" class="text-center pa-8 text-medium-emphasis">
                {{ busca ? 'Nenhum servidor encontrado.' : 'Nenhum servidor cadastrado.' }}
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card>
    </div>
  `,

  setup() {
    const store = useServidoresStore();
    const busca = Vue.ref('');

    Vue.onMounted(() => store.carregarTodos());

    const filtrados = Vue.computed(() => {
      if (!busca.value) return store.lista.filter(s => s.perfil !== 'admin');
      const q = busca.value.toLowerCase();
      return store.lista.filter(s =>
        s.perfil !== 'admin' &&
        (s.nome.toLowerCase().includes(q) || s.matricula.toLowerCase().includes(q))
      );
    });

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

    return { store, busca, filtrados, formatDate, statusColor, statusLabel };
  }
};
