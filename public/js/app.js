// App principal
const { createApp, ref, onMounted } = Vue;

const app = createApp({
  setup() {
    const appReady = ref(false);
    const authStore = useAuthStore();

    onMounted(async () => {
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

// Vuetify
const vuetify = Vuetify.createVuetify({
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        colors: {
          primary: '#1565C0',
          secondary: '#546E7A',
          success: '#2E7D32',
          warning: '#E65100',
          error: '#C62828',
          info: '#0277BD'
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
