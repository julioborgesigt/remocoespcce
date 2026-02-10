// Usuário — Perfil
const UsuarioPerfil = {
  template: `
    <div>
      <h1 class="text-h5 font-weight-bold mb-1">Meu Perfil</h1>
      <p class="text-body-2 text-medium-emphasis mb-6">Suas informações no sistema</p>

      <v-card rounded="xl" variant="outlined" class="pa-6" max-width="600">
        <div class="d-flex align-center mb-6">
          <v-avatar color="primary" size="64" class="mr-4">
            <v-icon icon="mdi-account" size="32"></v-icon>
          </v-avatar>
          <div>
            <h2 class="text-h6 font-weight-bold">{{ user?.nome }}</h2>
            <p class="mono text-body-2 text-medium-emphasis">{{ user?.matricula }}</p>
          </div>
        </div>

        <v-divider class="mb-4"></v-divider>

        <v-row>
          <v-col cols="12" sm="6">
            <div class="text-caption text-medium-emphasis text-uppercase" style="letter-spacing:1px">Data de Ingresso</div>
            <div class="text-body-1 font-weight-medium mono mt-1">{{ formatDate(user?.dataIngresso) }}</div>
          </v-col>
          <v-col cols="12" sm="6">
            <div class="text-caption text-medium-emphasis text-uppercase" style="letter-spacing:1px">Cidade de Lotação</div>
            <div class="text-body-1 font-weight-medium mt-1">
              <v-icon icon="mdi-map-marker" size="16" color="primary" class="mr-1"></v-icon>
              {{ user?.cidadeLotacao?.nome || 'Não definida' }}
            </div>
          </v-col>
          <v-col cols="12" sm="6">
            <div class="text-caption text-medium-emphasis text-uppercase" style="letter-spacing:1px">Antiguidade</div>
            <div class="text-body-1 font-weight-medium mt-1">{{ calcAntiguidade() }}</div>
          </v-col>
          <v-col cols="12" sm="6">
            <div class="text-caption text-medium-emphasis text-uppercase" style="letter-spacing:1px">Perfil</div>
            <v-chip color="primary" variant="tonal" size="small" class="mt-1">
              {{ user?.perfil === 'admin' ? 'Administrador' : 'Servidor' }}
            </v-chip>
          </v-col>
        </v-row>

        <!-- Status do Pedido -->
        <template v-if="srvStore.meuPedido">
          <v-divider class="my-4"></v-divider>
          <div class="text-caption text-medium-emphasis text-uppercase mb-2" style="letter-spacing:1px">
            Status do Pedido de Remoção
          </div>
          <v-alert
            :type="pedidoAlertType"
            variant="tonal"
            density="compact"
          >
            <template v-if="srvStore.meuPedido.status === 'pendente'">
              Seu pedido está <strong>pendente</strong> de processamento.
            </template>
            <template v-else-if="srvStore.meuPedido.status === 'atendido'">
              Seu pedido foi <strong>atendido</strong>!
              Destino: <strong>{{ srvStore.meuPedido.destinoFinal?.nome }}</strong>
            </template>
            <template v-else>
              Seu pedido <strong>não foi atendido</strong>. Nenhuma vaga disponível nas opções solicitadas.
            </template>
          </v-alert>
        </template>
      </v-card>
    </div>
  `,

  setup() {
    const authStore = useAuthStore();
    const srvStore = useServidoresStore();
    const user = Vue.computed(() => authStore.usuario);

    Vue.onMounted(() => srvStore.carregarMeuPedido());

    function formatDate(d) {
      if (!d) return '-';
      return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
    }

    function calcAntiguidade() {
      if (!user.value?.dataIngresso) return '-';
      const ingresso = new Date(user.value.dataIngresso + 'T00:00:00');
      const agora = new Date();
      const anos = agora.getFullYear() - ingresso.getFullYear();
      const meses = agora.getMonth() - ingresso.getMonth();
      const totalMeses = anos * 12 + meses;
      const a = Math.floor(totalMeses / 12);
      const m = totalMeses % 12;
      return `${a} ano(s) e ${m} mês(es)`;
    }

    const pedidoAlertType = Vue.computed(() => {
      const s = srvStore.meuPedido?.status;
      return { pendente: 'warning', atendido: 'success', nao_atendido: 'error' }[s] || 'info';
    });

    return { user, srvStore, formatDate, calcAntiguidade, pedidoAlertType };
  }
};
