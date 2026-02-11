// Usuário — Formulário de Intenção de Remoção
const UsuarioIntencao = {
  template: `
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

      <!-- Formulário -->
      <!-- Removemos a restrição v-if="!pedido || pedido.status === 'pendente'" para permitir edição sempre -->
      <v-card rounded="xl" variant="outlined" class="pa-6" max-width="600">
        <v-form @submit.prevent="salvar" ref="form" :disabled="configStore.prazoEncerrado">
          <v-alert type="info" variant="tonal" density="compact" class="mb-4" rounded="lg">
            <div class="text-caption">
              Sua cidade atual: <strong>{{ authStore.usuario?.cidadeLotacao?.nome }}</strong>.
              Escolha cidades diferentes da sua lotação atual.
            </div>
          </v-alert>

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
                  <v-chip size="x-small" :color="item.raw.vagasIniciais > 0 ? 'success' : 'grey'" variant="tonal">
                    {{ item.raw.vagasIniciais }} vaga(s)
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
                  <v-chip size="x-small" :color="item.raw.vagasIniciais > 0 ? 'success' : 'grey'" variant="tonal">
                    {{ item.raw.vagasIniciais }} vaga(s)
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
                  <v-chip size="x-small" :color="item.raw.vagasIniciais > 0 ? 'success' : 'grey'" variant="tonal">
                    {{ item.raw.vagasIniciais }} vaga(s)
                  </v-chip>
                </template>
              </v-list-item>
            </template>
          </v-select>

          <div class="d-flex ga-3">
            <v-btn
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

      <!-- (Removido o card de 'Pedido Atual' simples, pois agora o form mostra os dados) -->
      <!-- Dialog Cancelar -->
      <v-dialog v-model="dialogCancelar" max-width="380">
        <v-card rounded="xl" class="pa-2">
          <v-card-title class="text-error">Cancelar Pedido</v-card-title>
          <v-card-text>Tem certeza que deseja cancelar seu pedido de remoção?</v-card-text>
          <v-card-actions class="pa-4 pt-0">
            <v-spacer></v-spacer>
            <v-btn variant="text" @click="dialogCancelar = false">Não</v-btn>
            <v-btn color="error" variant="flat" rounded="lg" @click="cancelar">Sim, cancelar</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </div>
  `,

  setup() {
    const authStore = useAuthStore();
    const cidadesStore = useCidadesStore();
    const srvStore = useServidoresStore();
    const configStore = useConfigStore(); // Novo
    const showSnackbar = Vue.inject('showSnackbar', () => { });

    const loading = Vue.ref(true);
    const salvando = Vue.ref(false);
    const dialogCancelar = Vue.ref(false);

    const formData = Vue.reactive({ opcao1: null, opcao2: null, opcao3: null });

    const pedido = Vue.computed(() => srvStore.meuPedido);

    const cidadesDisponiveis = Vue.computed(() =>
      cidadesStore.lista.filter(c => c.id !== authStore.usuario?.cidadeLotacao?.id)
    );

    Vue.onMounted(async () => {
      await Promise.all([
        cidadesStore.carregar(),
        srvStore.carregarMeuPedido(),
        configStore.fetchConfig() // Carregar configuração
      ]);

      // Preencher form se já tem pedido (independente do status, pois pode editar até o prazo)
      if (pedido.value) {
        formData.opcao1 = pedido.value.opcao1_cidade_id;
        formData.opcao2 = pedido.value.opcao2_cidade_id;
        formData.opcao3 = pedido.value.opcao3_cidade_id;
      }

      loading.value = false;
    });

    async function salvar() {
      if (configStore.prazoEncerrado) return; // Proteção extra
      if (!formData.opcao1) return;
      salvando.value = true;
      try {
        await srvStore.salvarPedido(formData.opcao1, formData.opcao2, formData.opcao3);
        showSnackbar('Pedido salvo com sucesso!');
      } catch (err) {
        showSnackbar(err.message, 'error');
      } finally {
        salvando.value = false;
      }
    }

    async function cancelar() {
      if (configStore.prazoEncerrado) return; // Proteção extra
      try {
        await srvStore.cancelarPedido();
        formData.opcao1 = null;
        formData.opcao2 = null;
        formData.opcao3 = null;
        dialogCancelar.value = false;
        showSnackbar('Pedido cancelado.', 'warning');
      } catch (err) {
        showSnackbar(err.message, 'error');
      }
    }

    return {
      authStore, cidadesDisponiveis, pedido, formData,
      loading, salvando, dialogCancelar,
      salvar, cancelar, configStore // Expor configStore
    };
  }
};
