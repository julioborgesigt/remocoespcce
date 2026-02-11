// Admin — Gestão de Cidades
const AdminCidades = {
  template: `
    <div>
      <div class="d-flex align-center justify-space-between mb-6">
        <div>
          <h1 class="text-h5 font-weight-bold mb-1">Cidades</h1>
          <p class="text-body-2 text-medium-emphasis">Gerencie as cidades e vagas disponíveis</p>
        </div>
        <v-btn color="primary" prepend-icon="mdi-plus" rounded="lg" @click="abrirDialog()">
          Nova Cidade
        </v-btn>
      </div>

      <v-card rounded="xl" variant="outlined">
        <v-table density="comfortable" hover>
          <thead>
            <tr>
              <th>ID</th>
              <th>Cidade</th>
              <th class="text-center">Vagas Iniciais</th>
              <th class="text-center">Servidores</th>
              <th class="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="cidadesStore.lista.length === 0">
              <td colspan="5" class="text-center text-medium-emphasis pa-8">
                Nenhuma cidade cadastrada. Clique em "Nova Cidade" para começar.
              </td>
            </tr>
            <tr v-for="c in cidadesStore.lista" :key="c.id">
              <td class="mono text-medium-emphasis">{{ c.id }}</td>
              <td class="font-weight-medium">{{ c.nome }}</td>
              <td class="text-center">
                <v-chip
                  :color="c.vagasIniciais > 0 ? 'success' : 'grey'"
                  size="small"
                  variant="tonal"
                >
                  {{ c.vagasIniciais }}
                </v-chip>
              </td>
              <td class="text-center mono">{{ c.totalServidores || 0 }}</td>
              <td class="text-right">
                <v-btn icon="mdi-pencil" size="small" variant="text" @click="abrirDialog(c)"></v-btn>
                <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="confirmarRemover(c)"></v-btn>
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card>

      <!-- Dialog Criar/Editar -->
      <v-dialog v-model="dialog" max-width="440" persistent>
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
              <v-text-field
                v-model.number="form.vagas"
                label="Vagas Iniciais"
                type="number"
                min="0"
                variant="outlined"
                density="comfortable"
                :rules="[v => v >= 0 || 'Mínimo 0']"
                hint="Pode ser 0 (zero). A vaga pode surgir dinamicamente."
                persistent-hint
              ></v-text-field>
            </v-form>
          </v-card-text>
          <v-card-actions class="pa-4 pt-0">
            <v-spacer></v-spacer>
            <v-btn variant="text" @click="dialog = false">Cancelar</v-btn>
            <v-btn color="primary" variant="flat" rounded="lg" @click="salvar" :loading="salvando">
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
          <v-card-actions class="pa-4 pt-0">
            <v-spacer></v-spacer>
            <v-btn variant="text" @click="dialogRemover = false">Cancelar</v-btn>
            <v-btn color="error" variant="flat" rounded="lg" @click="remover" :loading="removendo">Remover</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </div>
  `,

  setup() {
    const cidadesStore = useCidadesStore();
    const showSnackbar = Vue.inject('showSnackbar', () => { });

    const dialog = Vue.ref(false);
    const dialogRemover = Vue.ref(false);
    const editando = Vue.ref(false);
    const editandoId = Vue.ref(null);
    const salvando = Vue.ref(false);
    const removendo = Vue.ref(false);
    const cidadeRemover = Vue.ref(null);

    const form = Vue.reactive({ nome: '', vagas: 0 });

    Vue.onMounted(() => cidadesStore.carregar());

    function abrirDialog(cidade) {
      if (cidade) {
        editando.value = true;
        editandoId.value = cidade.id;
        form.nome = cidade.nome;
        form.vagas = cidade.vagasIniciais;
      } else {
        editando.value = false;
        editandoId.value = null;
        form.nome = '';
        form.vagas = 0;
      }
      dialog.value = true;
    }

    async function salvar() {
      if (!form.nome) return;
      salvando.value = true;
      try {
        if (editando.value) {
          await cidadesStore.atualizar(editandoId.value, form.nome, form.vagas);
          showSnackbar('Cidade atualizada!');
        } else {
          await cidadesStore.criar(form.nome, form.vagas);
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

    return {
      cidadesStore, dialog, dialogRemover, editando, form,
      salvando, removendo, cidadeRemover,
      abrirDialog, salvar, confirmarRemover, remover
    };
  }
};
