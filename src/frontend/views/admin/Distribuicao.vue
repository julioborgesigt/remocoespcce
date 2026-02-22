<template>

    <div>
      <v-card class="mb-6 pa-4" rounded="xl" variant="outlined" color="primary">
        <div class="d-flex align-center flex-wrap ga-4">
          <div style="min-width: 200px">
             <div class="text-subtitle-2 font-weight-bold text-primary mb-1">Configuração de Vagas</div>
             <div class="text-caption text-medium-emphasis">Defina o total de novos servidores para distribuir vagas.</div>
          </div>
          
          <v-divider vertical class="hidden-xs-only mx-2"></v-divider>

          <v-text-field
            v-model.number="totalNovosInput"
            label="Novos"
            type="number"
            min="0"
            variant="solo"
            density="compact"
            hide-details
            class="flex-grow-0"
            style="width: 100px"
            bg-color="surface"
            @blur="atualizarConfig"
            @keyup.enter="atualizarConfig"
          ></v-text-field>

          <div class="d-flex ga-2 align-center">
             <v-chip color="primary" variant="flat" size="small">
                Total: {{ totalNovosServidores }}
             </v-chip>
             <v-chip color="warning" variant="tonal" size="small">
                Distr: {{ totalDistribuidas }}
             </v-chip>
             <v-chip :color="vagasRestantes >= 0 ? 'success' : 'error'" variant="tonal" size="small">
                Rest: {{ vagasRestantes }}
             </v-chip>
          </div>
        </div>
      </v-card>

      <div class="d-flex flex-column flex-sm-row align-center justify-space-between mb-6 ga-4">
        <div>
          <h1 class="text-h5 font-weight-bold mb-1">Distribuição</h1>
          <p class="text-body-2 text-medium-emphasis">Gerencie as cidades e vagas disponíveis</p>
        </div>
        <div class="d-flex flex-column flex-sm-row ga-2 w-100" style="max-width: sm ? '100%' : 'auto'">
            <v-menu>
              <template v-slot:activator="{ props }">
                <v-btn :block="mobile" color="secondary" variant="tonal" prepend-icon="mdi-export" v-bind="props">
                  Exportar
                </v-btn>
              </template>
              <v-list>
                <v-list-item @click="exportar('pdf')" prepend-icon="mdi-file-pdf-box" title="PDF"></v-list-item>
                <v-list-item @click="exportar('csv')" prepend-icon="mdi-file-delimited" title="CSV"></v-list-item>
                <v-list-item @click="exportar('xlsx')" prepend-icon="mdi-microsoft-excel" title="Excel"></v-list-item>
              </v-list>
            </v-menu>
            <v-btn :block="mobile" color="primary" prepend-icon="mdi-plus" rounded="lg" @click="abrirDialog()">
              Nova Cidade
            </v-btn>
        </div>
      </div>

      <v-card rounded="xl" variant="outlined">
        <v-table density="comfortable" hover>
          <thead>
            <tr>
              <th>ID</th>
              <th>Cidade</th>
              <th class="text-center">Efetivo Atual</th>
              <th class="text-center">Efetivo Ideal</th>
              <th class="text-center">Vagas Iniciais</th>
              <th class="text-center">Interessados</th>
              <th class="text-center font-weight-bold">Efetivo Pós</th>
              <th class="text-center text-primary font-weight-bold">Vagas Final</th>
              <th class="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="cidadesStore.lista.length === 0">
              <td colspan="7" class="text-center text-medium-emphasis pa-8">
                Nenhuma cidade cadastrada. Clique em "Nova Cidade" para começar.
              </td>
            </tr>
            <tr v-for="c in cidadesStore.lista" :key="c.id">
              <td class="mono text-medium-emphasis">{{ c.id }}</td>
              <td class="font-weight-medium">{{ c.nome }}</td>
              <td class="text-center mono">{{ c.efetivoAtual || 0 }}</td>
              <td class="text-center mono">{{ c.efetivoIdeal || 0 }}</td>
              <td class="text-center">
                <v-chip
                  :color="c.vagasIniciais > 0 ? 'success' : 'grey'"
                  size="small"
                  variant="tonal"
                  class="font-weight-bold"
                >
                  {{ c.vagasIniciais }}
                </v-chip>
              </td>
              <td class="text-center">
                <v-chip
                  :color="c.totalInteressados > 0 ? 'info' : 'grey'"
                  size="small"
                  variant="tonal"
                >
                  {{ c.totalInteressados || 0 }}
                </v-chip>
              </td>
              <td class="text-center mono font-weight-bold">
                 {{ (c.efetivoPos !== undefined && c.efetivoPos !== null) ? c.efetivoPos : '-' }}
              </td>
              <td class="text-center">
                <v-chip
                  :color="c.vagasFinal > 0 ? 'primary' : (c.vagasFinal < 0 ? 'error' : 'grey')"
                  size="small"
                  variant="flat"
                  class="font-weight-bold"
                >
                  {{ c.vagasFinal !== undefined ? c.vagasFinal : '-' }}
                </v-chip>
              </td>
              <td class="text-right">
                <v-btn icon="mdi-pencil" size="small" variant="text" @click="abrirDialog(c)"></v-btn>
                <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="confirmarRemover(c)"></v-btn>
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card>

      <!-- Dialog Criar/Editar -->
      <v-dialog v-model="dialog" max-width="500" persistent>
        <v-card rounded="xl" class="pa-2">
          <v-card-title>{{ editando ? 'Editar Cidade' : 'Nova Cidade' }}</v-card-title>
          <v-card-text>
            <v-form @submit.prevent="salvar" ref="formRef">
              <v-text-field
                v-model="form.nome"
                label="Nome da Cidade"
                variant="outlined"
                density="comfortable"
                :rules="[v => !!v || 'Obrigatório']"
                class="mb-3"
                autofocus
              ></v-text-field>
              
              <div class="d-flex ga-3 mb-3">
                 <v-text-field
                    v-model.number="form.efetivo_atual"
                    label="Efetivo Atual"
                    type="number"
                    min="0"
                    variant="outlined"
                    density="comfortable"
                    :rules="[v => v >= 0 || 'Mínimo 0']"
                    hint="Servidores reais lotados"
                    persistent-hint
                ></v-text-field>
                <v-text-field
                    v-model.number="form.efetivo_ideal"
                    label="Efetivo Ideal"
                    type="number"
                    min="0"
                    variant="outlined"
                    density="comfortable"
                    :rules="[v => v >= 0 || 'Mínimo 0']"
                    hint="Meta de servidores"
                    persistent-hint
                ></v-text-field>
              </div>

               <v-text-field
                    v-model.number="form.vagas"
                    label="Vagas Iniciais"
                    type="number"
                    min="0"
                    variant="outlined"
                    density="comfortable"
                    :rules="[
                        v => v >= 0 || 'Mínimo 0',
                        v => v <= maxVagasPermitidas || 'Máximo permitido: ' + maxVagasPermitidas,
                        v => v <= Math.max(0, form.efetivo_ideal - form.efetivo_atual) || 'Máximo permitido pelo déficit: ' + Math.max(0, form.efetivo_ideal - form.efetivo_atual)
                    ]"
                    :hint="totalNovosServidores === 0 ? 'Defina Novos Servidores para adicionar vagas' : 'Disponível para adicionar: ' + vagasDisponiveisParaInput"
                    persistent-hint
                ></v-text-field>
            </v-form>
          </v-card-text>
          <v-card-actions class="d-flex flex-column flex-sm-row pa-4 pt-0 w-100 ga-2">
            <v-spacer class="hidden-xs-only"></v-spacer>
            <v-btn :block="mobile" variant="text" @click="dialog = false">Cancelar</v-btn>
            <v-btn :block="mobile" color="primary" variant="flat" rounded="lg" @click="salvar" :loading="salvando">
              {{ editando ? 'Salvar' : 'Criar' }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <!-- Dialog Confirmar Remoção -->
      <v-dialog v-model="dialogRemover" max-width="380">
        <v-card rounded="xl" class="pa-2">
          <v-card-title class="text-error">Remover Cidade</v-card-title>
          <v-card-text>
            Tem certeza que deseja remover <strong>{{ cidadeRemover?.nome }}</strong>?
          </v-card-text>
          <v-card-actions class="d-flex flex-column flex-sm-row pa-4 pt-0 w-100 ga-2">
            <v-spacer class="hidden-xs-only"></v-spacer>
            <v-btn :block="mobile" variant="text" @click="dialogRemover = false">Cancelar</v-btn>
            <v-btn :block="mobile" color="error" variant="flat" rounded="lg" @click="remover" :loading="removendo">Remover</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
      <!-- Divider Visual -->
      <v-divider class="my-8 border-opacity-25" :thickness="3" color="primary"></v-divider>

      <!-- SEÇÃO PROCESSAMENTO -->
      <div class="d-flex align-center mb-6">
        <div>
           <h1 class="text-h6 font-weight-bold mb-1">Processamento</h1>
           <p class="text-body-2 text-medium-emphasis">
             Execute o algoritmo de distribuição de vagas por antiguidade e permutas
           </p>
        </div>
      </div>

      <!-- Controles Processamento -->
      <v-card rounded="lg" variant="outlined" class="pa-4 mb-6">
        <div class="d-flex flex-column flex-sm-row flex-wrap ga-3 align-sm-center">
          <v-tooltip location="bottom" text="Executa o algoritmo de distribuição de vagas com base na regra selecionada.">
            <template v-slot:activator="{ props }">
              <v-btn
                :block="mobile"
                color="primary"
                prepend-icon="mdi-play-circle"
                v-bind="props"
                @click="executar"
                :loading="procStore.processando"
                :disabled="procStore.processando"
              >
                Executar Processamento
              </v-btn>
            </template>
          </v-tooltip>

          <div class="d-flex align-center w-100 w-sm-auto mb-2 mb-sm-0">
              <v-menu open-on-hover location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn icon="mdi-information" variant="text" size="small" color="info" v-bind="props"></v-btn>
                </template>
                <v-sheet class="pa-4" max-width="300" rounded="xl">
                    <p class="font-weight-bold mb-1">Regra: {{ regra === 'antiguidade' ? 'Antiguidade Pura' : 'Regra Aprimorada' }}</p>
                    <div class="text-caption" v-if="regra === 'antiguidade'">
                        Ordena apenas pela <strong>Data de Ingresso</strong> e Matrícula.
                    </div>
                    <div class="text-caption" v-else>
                        Considera nesta ordem:
                        <ol class="pl-4 mt-1">
                            <li>Prioridade Legal (Segurança > Saúde > Família)</li>
                            <li>Tempo no Cargo Atual</li>
                            <li>Tempo na Lotação Atual</li>
                            <li>Tempo de Serviço Total</li>
                            <li>Data Ingresso (Desempate)</li>
                        </ol>
                    </div>
                </v-sheet>
              </v-menu>

              <v-radio-group v-model="regra" inline density="compact" hide-details class="mr-sm-4 mx-auto mx-sm-0 flex-grow-1 flex-sm-grow-0">
                <v-radio label="Regra Antiguidade" value="antiguidade"></v-radio>
                <v-radio label="Regra Aprimorada" value="aprimorada"></v-radio>
              </v-radio-group>
          </div>

          <v-divider vertical class="hidden-xs-only mx-2"></v-divider>

          <v-tooltip location="bottom" text="Desfaz o último processamento e permite fazer alterações novamente.">
            <template v-slot:activator="{ props }">
              <v-btn
                :block="mobile"
                variant="outlined"
                color="warning"
                size="small"
                prepend-icon="mdi-undo"
                v-bind="props"
                @click="dialogReset = true"
              >
                Desfazer Processamento
              </v-btn>
            </template>
          </v-tooltip>

          <v-divider vertical class="hidden-xs-only mx-2"></v-divider>

          <v-tooltip location="bottom" text="Encerra o ciclo atual, efetiva as remoções atendidas e gera histórico.">
            <template v-slot:activator="{ props }">
              <v-btn
                :block="mobile"
                color="error"
                size="small"
                prepend-icon="mdi-lock-check"
                v-bind="props"
                @click="dialogFechar = true"
              >
                Fechar Temporada
              </v-btn>
            </template>
          </v-tooltip>

          <v-tooltip location="bottom" text="Reabre a última temporada fechada, revertendo as mudanças.">
            <template v-slot:activator="{ props }">
              <v-btn
                :block="mobile"
                variant="text"
                color="warning"
                size="small"
                prepend-icon="mdi-backup-restore"
                v-bind="props"
                @click="dialogReabrir = true"
              >
               Reabrir Temp.
              </v-btn>
            </template>
          </v-tooltip>

          <v-spacer class="hidden-xs-only"></v-spacer>

          <div class="w-100 w-sm-auto d-flex justify-center mt-2 mt-sm-0">
              <v-chip v-if="procStore.dashboard" color="info" size="small" variant="tonal">
                <v-icon start icon="mdi-clock-outline"></v-icon>
                {{ procStore.dashboard.resumo.pedidosPendentes }} pendente(s)
              </v-chip>
          </div>
        </div>

        <v-alert v-if="procStore.erro" type="error" variant="tonal" class="mt-4" closable @click:close="procStore.erro = null">
          {{ procStore.erro }}
        </v-alert>
      </v-card>

      <!-- Resultado do Processamento -->
      <template v-if="procStore.resultado">
        <v-alert
          :type="procStore.resultado.sucesso ? 'success' : 'error'"
          variant="tonal"
          class="mb-6"
          rounded="xl"
        >
          <div class="text-h6 font-weight-bold mb-1">{{ procStore.resultado.mensagem }}</div>
          <div class="text-body-2" v-if="procStore.resultado.totalPedidos">
            Total processado: {{ procStore.resultado.totalPedidos }} pedido(s)
          </div>
        </v-alert>

        <div class="d-flex justify-end mb-2 w-100">
           <v-menu>
              <template v-slot:activator="{ props }">
                <v-btn :block="mobile" color="secondary" variant="tonal" size="small" prepend-icon="mdi-export" v-bind="props">
                  Exportar Resultados
                </v-btn>
              </template>
              <v-list density="compact">
                <v-list-subheader>Movimentações</v-list-subheader>
                <v-list-item @click="exportarResultado('pdf', 'movimentacoes')" title="PDF" prepend-icon="mdi-file-pdf-box"></v-list-item>
                <v-list-item @click="exportarResultado('csv', 'movimentacoes')" title="CSV" prepend-icon="mdi-file-delimited"></v-list-item>
                <v-list-item @click="exportarResultado('xlsx', 'movimentacoes')" title="Excel" prepend-icon="mdi-microsoft-excel"></v-list-item>
                
                <v-divider class="my-1"></v-divider>
                <v-list-subheader>Não Atendidos</v-list-subheader>
                <v-list-item @click="exportarResultado('pdf', 'naoAtendidos')" title="PDF" prepend-icon="mdi-file-pdf-box"></v-list-item>
                <v-list-item @click="exportarResultado('csv', 'naoAtendidos')" title="CSV" prepend-icon="mdi-file-delimited"></v-list-item>
                <v-list-item @click="exportarResultado('xlsx', 'naoAtendidos')" title="Excel" prepend-icon="mdi-microsoft-excel"></v-list-item>
              </v-list>
           </v-menu>
        </div>

        <!-- Movimentações -->
        <v-card v-if="procStore.resultado.movimentacoes?.length" rounded="xl" variant="outlined" class="result-card mb-6">
          <v-card-title class="d-flex align-center">
            <v-icon icon="mdi-check-circle" color="success" class="mr-2"></v-icon>
            Remoções Efetivadas ({{ procStore.resultado.movimentacoes.length }})
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
              <tr v-for="(m, i) in procStore.resultado.movimentacoes" :key="i">
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
        <v-card v-if="procStore.resultado.naoAtendidos?.length" rounded="xl" variant="outlined" class="result-card result-card--error mb-6">
          <v-card-title class="d-flex align-center">
            <v-icon icon="mdi-close-circle" color="error" class="mr-2"></v-icon>
            Não Atendidos ({{ procStore.resultado.naoAtendidos.length }})
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
              <tr v-for="(n, i) in procStore.resultado.naoAtendidos" :key="i">
                <td class="mono font-weight-medium">{{ n.matricula }}</td>
                <td>{{ n.servidor }}</td>
                <td>{{ n.cidadeAtual }}</td>
                <td class="text-caption">{{ n.opcoes.join(', ') }}</td>
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
          <v-card-actions class="d-flex flex-column flex-sm-row pa-4 pt-0 w-100 ga-2">
            <v-spacer class="hidden-xs-only"></v-spacer>
            <v-btn :block="mobile" variant="text" @click="dialogReset = false">Cancelar</v-btn>
            <v-btn :block="mobile" color="warning" variant="flat" rounded="lg" @click="resetar">Confirmar Reset</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <!-- Dialog Fechar Temporada -->
      <v-dialog v-model="dialogFechar" max-width="500">
        <v-card rounded="xl" class="pa-2">
            <v-card-title class="text-error font-weight-bold">
                <v-icon icon="mdi-alert-circle" start></v-icon>
                Fechar Temporada
            </v-card-title>
            <v-card-text>
                <p class="mb-4">
                    <strong>Atenção:</strong> Esta ação é irreversível e deve ser feita apenas ao final do ciclo de remoções.
                </p>
                <ul class="pl-4 mb-4 text-body-2">
                    <li>Todos os pedidos <strong>ATENDIDOS</strong> serão efetivados (servidores mudarão de cidade no sistema).</li>
                    <li>Será gerado um histórico de todas as movimentações.</li>
                    <li>Pedidos <strong>NÃO ATENDIDOS</strong> serão mantidos como pendentes para o próximo ciclo.</li>
                </ul>
                <p>Deseja realmente continuar?</p>
            </v-card-text>
            <v-card-actions class="d-flex flex-column flex-sm-row pa-4 pt-0 w-100 ga-2">
                <v-spacer class="hidden-xs-only"></v-spacer>
                <v-btn :block="mobile" variant="text" @click="dialogFechar = false">Cancelar</v-btn>
                <v-btn :block="mobile" color="error" variant="flat" rounded="lg" :loading="fechando" @click="fecharTemporada">
                    Confirmar Fechamento
                </v-btn>
            </v-card-actions>
        </v-card>
      </v-dialog>

      <!-- Dialog Reabrir Temporada -->
      <v-dialog v-model="dialogReabrir" max-width="500">
        <v-card rounded="xl" class="pa-2">
            <v-card-title class="text-warning font-weight-bold">
                <v-icon icon="mdi-backup-restore" start></v-icon>
                Reabrir Temporada Anterior
            </v-card-title>
            <v-card-text>
                <p class="mb-4">
                    <strong>Cuidado:</strong> Esta ação irá desfazer o fechamento da última temporada.
                </p>
                <ul class="pl-4 mb-4 text-body-2">
                    <li>Servidores efetivados voltarão para a cidade de origem.</li>
                    <li>Pedidos serão restaurados para o status anterior (Atendidos/Não Atendidos).</li>
                    <li>O histórico da temporada será apagado.</li>
                    <li><strong>Vagas Iniciais</strong> poderão estar zeradas e precisarão ser reinseridas.</li>
                </ul>
                <p>Tem certeza que deseja reabrir?</p>
            </v-card-text>
            <v-card-actions class="d-flex flex-column flex-sm-row pa-4 pt-0 w-100 ga-2">
                <v-spacer class="hidden-xs-only"></v-spacer>
                <v-btn :block="mobile" variant="text" @click="dialogReabrir = false">Cancelar</v-btn>
                <v-btn :block="mobile" color="warning" variant="flat" rounded="lg" :loading="reabrindo" @click="reabrirTemporada">
                    Confirmar Reabertura
                </v-btn>
            </v-card-actions>
        </v-card>
      </v-dialog>

    </div>
  
</template>

<script setup>
import { ref, reactive, onMounted, computed, inject } from 'vue';
import { useDisplay } from 'vuetify';
import { useCidadesStore } from '../../stores/cidades';
import { useConfigStore } from '../../stores/config';
import { useProcessamentoStore } from '../../stores/processamento';

const { mobile } = useDisplay();
const cidadesStore = useCidadesStore();
    const configStore = useConfigStore();
    const procStore = useProcessamentoStore();
    const showSnackbar = inject('showSnackbar', () => { });

    const dialog = ref(false);
    const dialogRemover = ref(false);
    const editando = ref(false);
    const editandoId = ref(null);
    const salvando = ref(false);
    const removendo = ref(false);
    const cidadeRemover = ref(null);

    const totalNovosInput = ref(0);

    const form = reactive({ nome: '', vagas: 0, efetivo_ideal: 0, efetivo_atual: 0 });

    onMounted(async () => {
      await Promise.all([cidadesStore.carregar(), configStore.fetchConfig(), procStore.carregarDashboard()]);
      totalNovosInput.value = configStore.totalNovosServidores;
    });

    // Computeds para Distribuição
    const totalNovosServidores = computed(() => configStore.totalNovosServidores || 0);

    const totalDistribuidas = computed(() => {
      return cidadesStore.lista.reduce((acc, c) => acc + (c.vagasIniciais || 0), 0);
    });

    const vagasRestantes = computed(() => {
      return totalNovosServidores.value - totalDistribuidas.value;
    });

    // Computeds para Validação no Form
    const vagasAtuaisEdicao = computed(() => {
      // Se estiver editando, considera as vagas que a cidade JÁ tem como "crédito"
      if (editando.value && editandoId.value) {
        const cidade = cidadesStore.lista.find(c => c.id === editandoId.value);
        return cidade ? cidade.vagasIniciais : 0;
      }
      return 0;
    });

    const maxVagasPermitidas = computed(() => {
      // Máximo = Vagas Restantes (no pool) + Vagas que esta cidade já ocupa
      return vagasRestantes.value + vagasAtuaisEdicao.value;
    });

    const vagasDisponiveisParaInput = computed(() => {
      if (form.vagas <= vagasAtuaisEdicao.value) {
        // Se reduziu ou manteve, sobra saldo
        return vagasRestantes.value + (vagasAtuaisEdicao.value - form.vagas);
      }
      // Se aumentou, desconta do saldo
      return vagasRestantes.value - (form.vagas - vagasAtuaisEdicao.value);
    });


    async function atualizarConfig() {
      if (totalNovosInput.value < 0) totalNovosInput.value = 0;
      try {
        await configStore.updateTotalNovosServidores(totalNovosInput.value);
        showSnackbar('Configuração atualizada!');
      } catch (err) {
        showSnackbar(err.message, 'error');
        // Reverter em caso de erro
        totalNovosInput.value = configStore.totalNovosServidores;
      }
    }

    function abrirDialog(cidade) {
      if (cidade) {
        editando.value = true;
        editandoId.value = cidade.id;
        form.nome = cidade.nome;
        form.vagas = cidade.vagasIniciais;
        form.efetivo_ideal = cidade.efetivoIdeal || 0;
        form.efetivo_atual = cidade.efetivoAtual || 0;
      } else {
        editando.value = false;
        editandoId.value = null;
        form.nome = '';
        form.vagas = 0;
        form.efetivo_ideal = 0;
        form.efetivo_atual = 0;
      }
      dialog.value = true;
    }

    async function salvar() {
      if (!form.nome) return;
      if (form.vagas > maxVagasPermitidas.value) {
        showSnackbar(`Limite excedido! Máximo permitido: ${maxVagasPermitidas.value}`, 'error');
        return;
      }

      salvando.value = true;
      try {
        if (editando.value) {
          await cidadesStore.atualizar(editandoId.value, form.nome, form.vagas, form.efetivo_ideal, form.efetivo_atual);
          showSnackbar('Cidade atualizada!');
        } else {
          await cidadesStore.criar(form.nome, form.vagas, form.efetivo_ideal, form.efetivo_atual);
          showSnackbar('Cidade criada!');
        }
        dialog.value = false;
      } catch (err) {
        showSnackbar(err.message, 'error');
      } finally {
        salvando.value = false;
      }
    }

    function confirmarRemover(cidade) {
      cidadeRemover.value = cidade;
      dialogRemover.value = true;
    }

    async function remover() {
      removendo.value = true;
      try {
        await cidadesStore.remover(cidadeRemover.value.id);
        showSnackbar('Cidade removida!');
        dialogRemover.value = false;
      } catch (err) {
        showSnackbar(err.message, 'error');
      } finally {
        removendo.value = false;
      }
    }
    
    import { exportToExcel, exportToCSV, exportToPDF } from '../../utils/exporter';

    function exportar(tipo) {
      if (!cidadesStore.lista.length) return;

      const dados = cidadesStore.lista.map(c => ({
        ID: c.id,
        Cidade: c.nome,
        'Efetivo Atual': c.efetivoAtual || 0,
        'Efetivo Ideal': c.efetivoIdeal || 0,
        'Vagas Iniciais': c.vagasIniciais || 0,
        'Interessados': c.totalInteressados || 0,
        'Efetivo Pós': c.efetivoPos || 0,
        'Vagas Final': c.vagasFinal || 0
      }));

      const filename = 'relatorio_cidades';

      if (tipo === 'xlsx') {
        exportToExcel(dados, filename);
      } else if (tipo === 'csv') {
        exportToCSV(dados, filename);
      } else if (tipo === 'pdf') {
        const headers = Object.keys(dados[0]);
        const rows = dados.map(obj => Object.values(obj));
        exportToPDF(headers, rows, 'Relatório de Cidades', filename);
      }
    }

    // --- Lógica Processamento ---
    const regra = ref('aprimorada');
    const dialogReset = ref(false);

    async function executar() {
      try {
        await procStore.executar(regra.value);
        showSnackbar('Processamento concluído!');
        procStore.carregarDashboard();
        await cidadesStore.carregar();
      } catch (err) {
        showSnackbar(err.message, 'error');
      }
    }

    async function resetar() {
      try {
        await procStore.resetar();
        showSnackbar('Pedidos resetados!', 'warning');
        dialogReset.value = false;
        cidadesStore.carregar();
      } catch (err) {
        showSnackbar(err.message, 'error');
      }
    }

    // --- Fechar Temporada Logic ---
    const dialogFechar = ref(false);
    const fechando = ref(false);

    import { useAuthStore } from '../../stores/auth';

    async function fecharTemporada() {
      fechando.value = true;
      try {
        const authStore = useAuthStore();
        const res = await fetch('/api/processamento/fechar-temporada', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authStore.token}`
          }
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Erro ao fechar temporada');
        }

        const data = await res.json();
        showSnackbar(data.message, 'success');
        dialogFechar.value = false;
        procStore.carregarDashboard();
        cidadesStore.carregar();
      } catch (err) {
        showSnackbar(err.message, 'error');
      } finally {
        fechando.value = false;
      }
    }

    // --- Reabrir Temporada Logic ---
    const dialogReabrir = ref(false);
    const reabrindo = ref(false);

    async function reabrirTemporada() {
      reabrindo.value = true;
      try {
        await procStore.reabrirTemporada();
        showSnackbar('Temporada reaberta com sucesso!');
        dialogReabrir.value = false;
        cidadesStore.carregar();
      } catch (err) {
        showSnackbar(err.message, 'error');
      } finally {
        reabrindo.value = false;
      }
    }

    // Helpers Processamento
    function formatDate(d) {
      if (!d) return '-';
      return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
    }

    function tipoLabel(obs) {
      if (!obs) return '-';
      if (obs.includes('Novos Servidores')) return 'Novos Servidores';
      if (obs.includes('Permuta')) return 'Permuta';
      if (obs.includes('pós-permuta')) return 'Cascata';
      return 'Direta';
    }

    function tipoColor(obs) {
      if (!obs) return 'grey';
      if (obs.includes('Novos Servidores')) return 'orange';
      if (obs.includes('Permuta')) return 'purple';
      if (obs.includes('pós-permuta')) return 'blue';
      return 'green';
    }

    function exportarResultado(tipo, listaAlvo) {
      let dados = [];
      let filename = '';
      let title = '';

      if (listaAlvo === 'movimentacoes') {
        if (!procStore.resultado?.movimentacoes?.length) return;
        dados = procStore.resultado.movimentacoes.map(m => ({
          Matrícula: m.matricula,
          Servidor: m.servidor,
          'Data Ingresso': formatDate(m.dataIngresso),
          Origem: m.cidadeOrigem,
          Destino: m.cidadeDestino,
          Tipo: tipoLabel(m.observacao)
        }));
        filename = 'relatorio_movimentacoes';
        title = 'Relatório de Movimentações';
      } else if (listaAlvo === 'naoAtendidos') {
        if (!procStore.resultado?.naoAtendidos?.length) return;
        dados = procStore.resultado.naoAtendidos.map(n => ({
          Matrícula: n.matricula,
          Servidor: n.servidor,
          'Cidade Atual': n.cidadeAtual,
          'Opções Solicitadas': n.opcoes.join(', ')
        }));
        filename = 'relatorio_nao_atendidos';
        title = 'Relatório de Pedidos Não Atendidos';
      }

      if (tipo === 'xlsx') {
        exportToExcel(dados, filename);
      } else if (tipo === 'csv') {
        exportToCSV(dados, filename);
      } else if (tipo === 'pdf') {
        const headers = Object.keys(dados[0]);
        const rows = dados.map(obj => Object.values(obj));
        exportToPDF(headers, rows, title, filename);
      }
    }
</script>
