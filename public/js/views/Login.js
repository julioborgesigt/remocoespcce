// Login / Registro
const LoginPage = {
  template: `
    <v-main class="login-bg d-flex align-center justify-center">
      <v-container class="d-flex justify-center">
        <v-card class="login-card pa-8" width="440" rounded="xl" elevation="0">
          <div class="text-center mb-6">
            <v-icon icon="mdi-shield-account" size="56" color="blue-lighten-3" class="mb-3"></v-icon>
            <h1 class="login-title text-h5 text-white">Sistema de Remoção</h1>
            <p class="text-caption text-blue-grey-lighten-3 mt-1">Gestão de remoção de servidores por antiguidade</p>
          </div>

          <v-tabs v-model="tab" color="blue-lighten-3" align-tabs="center" class="mb-6">
            <v-tab value="login">Entrar</v-tab>
            <v-tab value="registro">Registrar</v-tab>
          </v-tabs>

          <!-- LOGIN -->
          <v-window v-model="tab">
            <v-window-item value="login">
              <v-form @submit.prevent="handleLogin" ref="loginForm">
                <v-text-field
                  v-model="loginForm.matricula"
                  label="Matrícula"
                  prepend-inner-icon="mdi-badge-account"
                  variant="outlined"
                  density="comfortable"
                  :rules="[rules.required]"
                  class="mb-2"
                  dark
                ></v-text-field>

                <v-text-field
                  v-model="loginForm.senha"
                  label="Senha"
                  prepend-inner-icon="mdi-lock"
                  :type="showPass ? 'text' : 'password'"
                  :append-inner-icon="showPass ? 'mdi-eye-off' : 'mdi-eye'"
                  @click:append-inner="showPass = !showPass"
                  variant="outlined"
                  density="comfortable"
                  :rules="[rules.required]"
                  class="mb-2"
                ></v-text-field>

                <v-alert v-if="authStore.erro" type="error" variant="tonal" density="compact" class="mb-3">
                  {{ authStore.erro }}
                </v-alert>

                <v-btn
                  type="submit"
                  block
                  color="blue-lighten-1"
                  size="large"
                  rounded="lg"
                  :loading="authStore.carregando"
                >
                  Entrar
                </v-btn>
              </v-form>
            </v-window-item>

            <!-- REGISTRO -->
            <v-window-item value="registro">
              <v-form @submit.prevent="handleRegistro" ref="regForm">
                <v-text-field
                  v-model="regForm.matricula"
                  label="Matrícula"
                  prepend-inner-icon="mdi-badge-account"
                  variant="outlined"
                  density="comfortable"
                  :rules="[rules.required]"
                  class="mb-2"
                ></v-text-field>

                <v-text-field
                  v-model="regForm.nome"
                  label="Nome Completo"
                  prepend-inner-icon="mdi-account"
                  variant="outlined"
                  density="comfortable"
                  :rules="[rules.required, rules.minLen3]"
                  class="mb-2"
                ></v-text-field>

                <v-text-field
                  v-model="regForm.senha"
                  label="Senha"
                  prepend-inner-icon="mdi-lock"
                  type="password"
                  variant="outlined"
                  density="comfortable"
                  :rules="[rules.required, rules.minLen6]"
                  class="mb-2"
                ></v-text-field>

                <v-text-field
                  v-model="regForm.data_ingresso"
                  label="Data de Ingresso"
                  prepend-inner-icon="mdi-calendar"
                  type="date"
                  variant="outlined"
                  density="comfortable"
                  :rules="[rules.required]"
                  class="mb-2"
                ></v-text-field>

                <v-select
                  v-model="regForm.cidade_lotacao_id"
                  :items="cidadesStore.lista"
                  item-title="nome"
                  item-value="id"
                  label="Cidade de Lotação"
                  prepend-inner-icon="mdi-map-marker"
                  variant="outlined"
                  density="comfortable"
                  :rules="[rules.required]"
                  :loading="cidadesStore.carregando"
                  class="mb-2"
                ></v-select>

                <v-alert v-if="authStore.erro" type="error" variant="tonal" density="compact" class="mb-3">
                  {{ authStore.erro }}
                </v-alert>

                <v-btn
                  type="submit"
                  block
                  color="blue-lighten-1"
                  size="large"
                  rounded="lg"
                  :loading="authStore.carregando"
                >
                  Registrar
                </v-btn>
              </v-form>
            </v-window-item>
          </v-window>
        </v-card>
      </v-container>
    </v-main>
  `,

  setup() {
    const authStore = useAuthStore();
    const cidadesStore = useCidadesStore();

    const tab = Vue.ref('login');
    const showPass = Vue.ref(false);

    const loginForm = Vue.reactive({ matricula: '', senha: '' });
    const regForm = Vue.reactive({
      matricula: '', nome: '', senha: '',
      data_ingresso: '', cidade_lotacao_id: null
    });

    const rules = {
      required: v => !!v || 'Campo obrigatório',
      minLen3: v => (v && v.length >= 3) || 'Mínimo 3 caracteres',
      minLen6: v => (v && v.length >= 6) || 'Mínimo 6 caracteres'
    };

    Vue.onMounted(() => {
      cidadesStore.carregar();
    });

    async function handleLogin() {
      authStore.erro = null;
      const ok = await authStore.login(loginForm.matricula, loginForm.senha);
      if (ok) {
        window.location.reload();
      }
    }

    async function handleRegistro() {
      authStore.erro = null;
      const ok = await authStore.registrar(regForm);
      if (ok) {
        window.location.reload();
      }
    }

    return {
      authStore, cidadesStore, tab, showPass,
      loginForm, regForm, rules,
      handleLogin, handleRegistro
    };
  }
};
