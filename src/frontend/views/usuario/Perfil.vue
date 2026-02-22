<template>

    <div>
      <h1 class="text-h5 font-weight-bold mb-1">Meu Perfil</h1>
      <p class="text-body-2 text-medium-emphasis mb-6">Suas informações no sistema</p>

      <v-card rounded="xl" variant="outlined" class="pa-6" max-width="600">
        <div class="d-flex align-center justify-space-between mb-6">
          <div class="d-flex align-center">
            <v-avatar color="primary" size="64" class="mr-4">
              <v-icon icon="mdi-account" size="32"></v-icon>
            </v-avatar>
            <div>
              <h2 class="text-h6 font-weight-bold">{{ user?.nome }}</h2>
              <p class="mono text-body-2 text-medium-emphasis">{{ user?.matricula }}</p>
            </div>
          </div>
          <v-btn 
            v-if="!isEditing"
            variant="tonal" 
            prepend-icon="mdi-pencil" 
            color="primary"
            size="small"
            @click="ativarEdicao"
          >
            Editar Perfil
          </v-btn>
        </div>

        <v-divider class="mb-4"></v-divider>

        <v-slide-y-transition mode="out-in">
          <v-form v-if="isEditing" @submit.prevent="salvarEdicao" ref="formRef">
            <v-alert v-if="authStore.erro" type="error" variant="tonal" density="compact" class="mb-4">
              {{ authStore.erro }}
            </v-alert>
            <v-row>
              <v-col cols="12" md="12">
                <v-text-field
                  v-model="editForm.nome"
                  label="Nome Completo"
                  variant="outlined"
                  density="comfortable"
                  :rules="[v => !!v || 'Campo obrigatório', v => v.length >= 3 || 'Mínimo 3 caracteres']"
                ></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="editForm.data_ingresso"
                  label="Data de Ingresso"
                  type="date"
                  variant="outlined"
                  density="comfortable"
                  :rules="[v => !!v || 'Campo obrigatório']"
                ></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="editForm.data_posse_cargo"
                  label="Data da Posse"
                  type="date"
                  variant="outlined"
                  density="comfortable"
                ></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="editForm.data_lotacao_atual"
                  label="Data na Lotação Atual"
                  type="date"
                  variant="outlined"
                  density="comfortable"
                ></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-select
                  v-model="editForm.cidade_lotacao_id"
                  :items="cidadesStore.lista"
                  item-title="nome"
                  item-value="id"
                  label="Cidade de Lotação"
                  variant="outlined"
                  density="comfortable"
                  :rules="[v => !!v || 'Campo obrigatório']"
                ></v-select>
              </v-col>
              <v-col cols="12" class="d-flex justify-end pt-0 mt-2">
                <v-btn variant="text" color="grey" class="mr-2" @click="cancelarEdicao" :disabled="authStore.carregando">
                  Cancelar
                </v-btn>
                <v-btn color="primary" type="submit" :loading="authStore.carregando">
                  Salvar
                </v-btn>
              </v-col>
            </v-row>
          </v-form>

          <!-- Dados Pessoais (visualização) -->
          <v-row v-else>
            <v-col cols="12" sm="6">
            <div class="text-caption text-medium-emphasis text-uppercase" style="letter-spacing:1px">Matrícula</div>
            <div class="text-body-1 font-weight-medium mono mt-1">{{ user?.matricula }}</div>
          </v-col>
          <v-col cols="12" sm="6">
             <div class="text-caption text-medium-emphasis text-uppercase" style="letter-spacing:1px">Perfil de Acesso</div>
            <v-chip color="primary" variant="tonal" size="small" class="mt-1">
              {{ user?.perfil === 'admin' ? 'Administrador' : 'Servidor' }}
            </v-chip>
          </v-col>

           <v-col cols="12">
            <v-divider></v-divider>
          </v-col>

          <!-- Datas -->
          <v-col cols="12" sm="4">
            <div class="text-caption text-medium-emphasis text-uppercase" style="letter-spacing:1px">Data de Ingresso</div>
            <div class="text-body-2 font-weight-bold mt-1">
                <v-icon icon="mdi-calendar-start" size="16" class="mr-1 text-medium-emphasis"></v-icon>
                {{ formatDate(user?.data_ingresso) }}
            </div>
          </v-col>
          <v-col cols="12" sm="4">
            <div class="text-caption text-medium-emphasis text-uppercase" style="letter-spacing:1px">Data de Posse (Cargo)</div>
            <div class="text-body-2 font-weight-bold mt-1">
                <v-icon icon="mdi-calendar-check" size="16" class="mr-1 text-medium-emphasis"></v-icon>
                {{ formatDate(user?.data_posse_cargo) }}
            </div>
          </v-col>
           <v-col cols="12" sm="4">
            <div class="text-caption text-medium-emphasis text-uppercase" style="letter-spacing:1px">Data na Lotação</div>
            <div class="text-body-2 font-weight-bold mt-1">
                <v-icon icon="mdi-map-clock" size="16" class="mr-1 text-medium-emphasis"></v-icon>
                {{ formatDate(user?.data_lotacao_atual) }}
            </div>
          </v-col>

          <v-col cols="12">
            <v-divider></v-divider>
          </v-col>

          <!-- Lotação e Tempo -->
          <v-col cols="12" sm="6">
            <div class="text-caption text-medium-emphasis text-uppercase" style="letter-spacing:1px">Cidade de Lotação Atual</div>
            <div class="text-h6 font-weight-bold mt-1 text-primary">
              <v-icon icon="mdi-map-marker" size="20" color="primary" class="mr-1"></v-icon>
              {{ user?.cidadeLotacao?.nome || 'Não definida' }}
            </div>
          </v-col>
          
          <v-col cols="12" sm="6">
            <div class="text-caption text-medium-emphasis text-uppercase" style="letter-spacing:1px">Tempo de Serviço Total</div>
            <div class="text-body-1 font-weight-bold mt-1">
                <v-icon icon="mdi-timer-sand" size="18" class="mr-1 text-medium-emphasis"></v-icon>
                {{ user?.tempo_servico_total_dias || 0 }} dias
            </div>
            <div class="text-caption text-medium-emphasis">
                {{ formatarTempo(user?.tempo_servico_total_dias) }}
            </div>
          </v-col>
        </v-row>

        <!-- Status do Pedido -->
        <template v-if="srvStore.meuPedido && !isEditing">
          <v-divider class="my-4"></v-divider>
          <div class="text-caption text-medium-emphasis text-uppercase mb-2" style="letter-spacing:1px">
            Status do Pedido de Remoção
          </div>
          
          <!-- Se o prazo NÃO encerrou, mostra status genérico de "Em andamento" -->
          <v-alert
            v-if="!configStore.prazoEncerrado"
            type="info"
            variant="tonal"
            density="compact"
          >
            Em andamento, consulte a aba "pedido de remoção" para mais detalhes.
          </v-alert>

          <!-- Se o prazo encerrou, mostra o resultado final -->
          <v-alert
            v-else
            :type="pedidoAlertType"
            variant="tonal"
            density="compact"
          >
            <template v-if="srvStore.meuPedido.status === 'pendente'">
              Seu pedido está <strong>pendente</strong> de processamento final.
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
        </v-slide-y-transition>
      </v-card>
    </div>
  
</template>

<script setup>
import { onMounted, computed, ref, reactive } from 'vue';
import { useAuthStore } from '../../stores/auth';
import { useServidoresStore } from '../../stores/servidores';
import { useConfigStore } from '../../stores/config';
import { useCidadesStore } from '../../stores/cidades';

const configStore = useConfigStore();
const authStore = useAuthStore();
const srvStore = useServidoresStore();
const cidadesStore = useCidadesStore();

const isEditing = ref(false);
const formRef = ref(null);
const editForm = reactive({
  nome: '',
  data_ingresso: '',
  data_posse_cargo: '',
  data_lotacao_atual: '',
  cidade_lotacao_id: null
});

onMounted(async () => {
  await Promise.all([
    srvStore.carregarMeuPedido(),
    configStore.fetchConfig(),
    cidadesStore.carregar()
  ]);
});

const user = computed(() => authStore.usuario);

function ativarEdicao() {
  if (!user.value) return;
  authStore.erro = null;
  editForm.nome = user.value.nome;
  editForm.data_ingresso = user.value.data_ingresso || '';
  editForm.data_posse_cargo = user.value.data_posse_cargo || '';
  editForm.data_lotacao_atual = user.value.data_lotacao_atual || '';
  editForm.cidade_lotacao_id = user.value.cidadeLotacao?.id || null;
  isEditing.value = true;
}

function cancelarEdicao() {
  isEditing.value = false;
  authStore.erro = null;
}

async function salvarEdicao() {
  const { valid } = await formRef.value.validate();
  if (!valid) return;

  const ok = await authStore.atualizarPerfil(editForm);
  if (ok) {
    isEditing.value = false;
  }
}

function formatDate(d) {
  if (!d) return '-';
  const parts = d.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
}

function formatarTempo(dias) {
  if (!dias) return '';
  const anos = Math.floor(dias / 365);
  const resto = dias % 365;
  const meses = Math.floor(resto / 30);

  let texto = [];
  if (anos > 0) texto.push(`${anos} ano(s)`);
  if (meses > 0) texto.push(`${meses} mês(es)`);
  if (texto.length === 0) return 'Menos de 1 mês';

  return '~ ' + texto.join(' e ');
}

const pedidoAlertType = computed(() => {
  if (!configStore.prazoEncerrado) return 'info'; // Sempre azul enquanto aberto
  const s = srvStore.meuPedido?.status;
  return { pendente: 'warning', atendido: 'success', nao_atendido: 'error' }[s] || 'info';
});
</script>
