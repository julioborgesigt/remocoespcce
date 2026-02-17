const AdminTestes = {
    template: `
    <div>
      <h1 class="text-h4 mb-6">Testes de Algoritmo</h1>

      <v-row>
        <!-- Coluna de Cenários -->
        <v-col cols="12" md="4">
          <v-card class="mb-4" elevation="2">
            <v-card-title class="bg-primary text-white">
              <v-icon start icon="mdi-test-tube"></v-icon>
              1. Escolher Cenário
            </v-card-title>
            <v-card-text class="pa-4">
                <p class="text-body-2 mb-4 text-medium-emphasis">
                    Selecione um cenário para preparar a simulação.
                </p>
                
                <v-list density="compact" nav>
                    <v-list-item 
                        v-for="cenario in cenarios" 
                        :key="cenario.chave"
                        :title="cenario.titulo"
                        :subtitle="cenario.descricao"
                        @click="selecionarCenario(cenario.chave)"
                        :active="cenarioAtual === cenario.chave"
                        color="primary"
                        rounded="lg"
                        class="mb-2"
                        :prepend-icon="cenarioAtual === cenario.chave ? 'mdi-radiobox-marked' : 'mdi-radiobox-blank'"
                    ></v-list-item>
                </v-list>
            </v-card-text>
          </v-card>

          <!-- Ação de Executar -->
          <v-card elevation="2" :loading="loading" v-if="cenarioAtual">
             <v-card-title class="bg-success text-white">
                <v-icon start icon="mdi-play-circle"></v-icon>
                2. Executar Simulação
             </v-card-title>
             <v-card-text class="pa-4">
                <p class="text-caption mb-4">
                    <v-icon icon="mdi-database-check" size="small" color="success" class="mr-1"></v-icon>
                    Ambiente Seguro: Banco <strong>remocoespcce_teste</strong>.
                </p>
                <v-btn 
                    block 
                    color="success" 
                    size="large" 
                    @click="executarSimulacao"
                    :disabled="loading"
                    prepend-icon="mdi-play"
                    variant="elevated"
                >
                    Rodar Simulação
                </v-btn>
             </v-card-text>
          </v-card>
        </v-col>

        <!-- Coluna de Resultados -->
        <v-col cols="12" md="8">
            <v-expand-transition>
                <div v-if="dadosIniciais">
                    
                    <!-- TABELA: Dados Iniciais -->
                    <v-card class="mb-6" elevation="3" border>
                        <v-card-title class="d-flex align-center bg-grey-lighten-4">
                            <v-icon start icon="mdi-account-group" color="primary"></v-icon>
                            Configuração do Cenário (Antes da Execução)
                        </v-card-title>
                        
                        <div class="px-4 py-2 bg-blue-lighten-5 text-blue-darken-4 mb-2" v-if="resultadoEsperado">
                            <div class="text-caption font-weight-bold text-uppercase">Resultado Esperado</div>
                            <div class="text-body-2">{{ resultadoEsperado }}</div>
                        </div>

                        <v-divider></v-divider>

                        <v-card-text class="pa-0">
                            <v-table density="compact" hover>
                                <thead>
                                    <tr>
                                        <th>Antiguidade</th>
                                        <th>Servidor</th>
                                        <th class="border-e">Cidade Atual</th>
                                        
                                        <th class="pl-4">1ª Opção</th>
                                        <th class="text-center px-1 border-e" style="width:50px">Vagas</th>
                                        
                                        <th class="pl-4">2ª Opção</th>
                                        <th class="text-center px-1 border-e" style="width:50px">Vagas</th>
                                        
                                        <th class="pl-4">3ª Opção</th>
                                        <th class="text-center px-1" style="width:50px">Vagas</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="pedido in dadosIniciais" :key="pedido.id">
                                        <td>{{ formatarData(pedido.servidor.data_ingresso) }}</td>
                                        <td class="font-weight-medium">
                                            {{ pedido.servidor.nome }}
                                            <div class="text-caption text-medium-emphasis">{{ pedido.servidor.matricula }}</div>
                                        </td>
                                        <td class="text-red-darken-1 font-weight-bold border-e">{{ pedido.servidor.cidadeLotacao?.nome }}</td>
                                        
                                        <td class="text-blue-darken-2 pl-4">{{ pedido.opcao1?.nome }}</td>
                                        <td class="text-center text-caption font-weight-bold border-e">{{ pedido.opcao1 ? pedido.opcao1.vagas_iniciais : '-' }}</td>

                                        <td class="text-medium-emphasis pl-4">{{ pedido.opcao2?.nome || '-' }}</td>
                                        <td class="text-center text-caption text-medium-emphasis border-e">{{ pedido.opcao2 ? pedido.opcao2.vagas_iniciais : '-' }}</td>

                                        <td class="text-medium-emphasis pl-4">{{ pedido.opcao3?.nome || '-' }}</td>
                                        <td class="text-center text-caption text-medium-emphasis">{{ pedido.opcao3 ? pedido.opcao3.vagas_iniciais : '-' }}</td>
                                    </tr>
                                </tbody>
                            </v-table>
                        </v-card-text>
                    </v-card>

                    <!-- TABELA: Resultados -->
                    <v-card class="mb-4 border-s-lg border-success" elevation="3" v-if="resultado">
                        <v-card-title class="d-flex justify-space-between align-center">
                            Resultado da Simulação
                            <v-chip color="success" variant="flat">Sucesso</v-chip>
                        </v-card-title>
                        <v-card-text>
                            <p class="text-h6 mb-2">{{ mensagemSetup }}</p>
                            
                            <v-divider class="my-3"></v-divider>
                            
                            <div class="d-flex ga-4 mb-4">
                                <div>
                                    <div class="text-caption text-uppercase">Movimentações</div>
                                    <div class="text-h5 font-weight-bold change-count">{{ resultado.movimentacoes.length }}</div>
                                </div>
                                <div>
                                    <div class="text-caption text-uppercase">Não Atendidos</div>
                                    <div class="text-h5 font-weight-bold text-medium-emphasis">{{ resultado.naoAtendidos.length }}</div>
                                </div>
                            </div>

                            <div v-if="resultado.movimentacoes.length > 0">
                                <h3 class="text-subtitle-1 font-weight-bold mb-2 text-success">Movimentações Realizadas</h3>
                                <v-table density="compact" hover class="mb-4">
                                    <thead>
                                        <tr>
                                            <th>Servidor</th>
                                            <th>Origem</th>
                                            <th>Destino</th>
                                            <th>Obs</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="(mov, i) in resultado.movimentacoes" :key="i">
                                            <td>{{ mov.servidor }}</td>
                                            <td class="text-error text-decoration-line-through">{{ mov.cidadeOrigem }}</td>
                                            <td class="text-success font-weight-bold">
                                                <v-icon icon="mdi-arrow-right" size="x-small" class="mr-1"></v-icon>
                                                {{ mov.cidadeDestino }}
                                            </td>
                                            <td class="text-caption">{{ mov.observacao }}</td>
                                        </tr>
                                    </tbody>
                                </v-table>
                            </div>

                            <div v-if="resultado.naoAtendidos.length > 0">
                                <h3 class="text-subtitle-1 font-weight-bold mb-2 text-medium-emphasis">Não Atendidos</h3>
                                <v-table density="compact" hover>
                                    <thead>
                                        <tr>
                                            <th>Servidor</th>
                                            <th>Origem</th>
                                            <th>Obs</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="(nao, i) in resultado.naoAtendidos" :key="i">
                                            <td class="text-medium-emphasis">{{ nao.servidor }}</td>
                                            <td class="text-medium-emphasis">{{ nao.cidadeOrigem }}</td>
                                            <td class="text-caption text-medium-emphasis">{{ nao.observacao }}</td>
                                        </tr>
                                    </tbody>
                                </v-table>
                            </div>
                        </v-card-text>
                    </v-card>
                </div>
            </v-expand-transition>
        </v-col>
      </v-row>
    </div>
  `,
    setup() {
        const authStore = useAuthStore();
        const showSnackbar = Vue.inject('showSnackbar');

        const loading = Vue.ref(false);
        const cenarioAtual = Vue.ref(null);
        const mensagemSetup = Vue.ref('');
        const resultadoEsperado = Vue.ref('');
        const resultado = Vue.ref(null);
        const dadosIniciais = Vue.ref(null);
        const cidades = Vue.ref([]);

        const cenarios = [
            { chave: 'cicloSimples', titulo: 'Ciclo Simples (2 pontas)', descricao: 'A quer B, B quer A' },
            { chave: 'cicloTriangular', titulo: 'Ciclo Triangular (3 pontas)', descricao: 'A->B->C->A' },
            { chave: 'bloqueioAntiguidade', titulo: 'Bloqueio Antiguidade (Fix)', descricao: 'Antigo trava. Novo deve permutar.' },
            { chave: 'disputaVaga', titulo: 'Disputa de Vaga', descricao: '2 candidatos, 1 vaga.' },
            { chave: 'cenarioCompleto', titulo: 'Cenário Completo', descricao: 'Múltiplos casos misturados.' },
            { chave: 'complexo10Servidores', titulo: 'Cenário Complexo (10 Servidores)', descricao: '10 servidores, 3 opções cada. Ciclos e cadeias.' }
        ];

        async function selecionarCenario(chave) {
            cenarioAtual.value = chave;
            resultado.value = null;
            dadosIniciais.value = null;
            mensagemSetup.value = '';

            // [NOVO] Buscar dados iniciais imediatamente (Preview)
            loading.value = true;
            try {
                const token = authStore.token;
                const res = await fetch('/api/testes/setup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ cenario: chave, setupOnly: true })
                });

                if (res.ok) {
                    const data = await res.json();
                    dadosIniciais.value = data.dadosIniciais;
                    cidades.value = data.cidades || [];
                    resultadoEsperado.value = data.resultadoEsperado || '';
                    mensagemSetup.value = data.mensagem; // Opcional: mostrar mensagem de setup
                }
            } catch (error) {
                console.error('Erro ao carregar preview do cenário:', error);
            } finally {
                loading.value = false;
            }
        }

        function formatarData(dataString) {
            if (!dataString) return '-';
            const [ano, mes, dia] = dataString.split('-');
            return `${dia}/${mes}/${ano}`;
        }

        async function executarSimulacao() {
            if (!cenarioAtual.value) return;

            loading.value = true;
            resultado.value = null;
            // dadosIniciais.value = null; // Não limpar, pois já temos o preview

            try {
                const token = authStore.token;
                const res = await fetch('/api/testes/setup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ cenario: cenarioAtual.value }) // setupOnly: false (padrão)
                });

                if (!res.ok) throw new Error('Falha ao executar simulação.');
                const data = await res.json();

                mensagemSetup.value = data.mensagem;
                resultadoEsperado.value = data.resultadoEsperado || '';
                resultado.value = data.resultadoExecucao || data.resultado; // backend retorna 'resultado' ou 'resultadoExecucao'? Verifiquei: retorna 'resultado'.
                dadosIniciais.value = data.dadosIniciais; // Atualiza com o estado fresco (deve ser igual)
                cidades.value = data.cidades || [];

                showSnackbar('Simulação executada com sucesso!');

            } catch (err) {
                console.error(err);
                showSnackbar('Erro ao simular cenário.', 'error');
            } finally {
                loading.value = false;
            }
        }

        return {
            cenarios,
            cenarioAtual,
            selecionarCenario,
            executarSimulacao,
            loading,
            mensagemSetup,
            resultado,
            dadosIniciais,
            cidades,
            resultadoEsperado,
            formatarData
        };
    }
};
