// App principal
const { createApp, ref, onMounted } = Vue;

const app = createApp({
  setup() {
    const appReady = ref(false);
    const authStore = useAuthStore();

    onMounted(async () => {
      // Obter token CSRF
      await authStore.fetchCsrfToken();

      // Se tem token, valida
      if (authStore.token) {
        try {
          const res = await fetch('/api/auth/me', {
            headers: authStore.authHeaders()
          });
          if (!res.ok) {
            authStore.logout();
          } else {
            const data = await res.json();
            authStore.usuario = data;
            localStorage.setItem('usuario', JSON.stringify(data));

            // Redirecionar para rota correta
            if (window.location.pathname === '/' || window.location.pathname === '') {
              const rota = data.perfil === 'admin' ? '/admin/dashboard' : '/perfil';
              router.push(rota);
            }
          }
        } catch {
          authStore.logout();
        }
      }
      appReady.value = true;
    });

    return { appReady, authStore };
  }
});

// Registrar componentes globais
app.component('login-page', LoginPage);
app.component('app-layout', AppLayout);

// Tema salvo pelo usuário
const temaInicial = localStorage.getItem('tema') || 'light';

// Vuetify
const vuetify = Vuetify.createVuetify({
  theme: {
    defaultTheme: temaInicial,
    themes: {
      light: {
        colors: {
          primary: '#1565C0',
          secondary: '#546E7A',
          success: '#2E7D32',
          warning: '#E65100',
          error: '#C62828',
          info: '#0277BD',
          surface: '#FFFFFF',
          background: '#F5F5F5'
        }
      },
      dark: {
        dark: true,
        colors: {
          primary: '#42A5F5',
          secondary: '#78909C',
          success: '#66BB6A',
          warning: '#FFA726',
          error: '#EF5350',
          info: '#29B6F6',
          surface: '#1E1E1E',
          background: '#121212'
        }
      }
    }
  },
  defaults: {
    VBtn: { variant: 'flat' },
    VCard: { elevation: 0 },
    VTextField: { color: 'primary' },
    VSelect: { color: 'primary' }
  }
});

// Pinia
const pinia = Pinia.createPinia();

app.use(pinia);
app.use(vuetify);
app.use(router);

app.mount('#app');
