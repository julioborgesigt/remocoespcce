// Store de Autenticação
const useAuthStore = Pinia.defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || null,
    usuario: JSON.parse(localStorage.getItem('usuario') || 'null'),
    carregando: false,
    erro: null
  }),

  getters: {
    isLoggedIn: (state) => !!state.token,
    isAdmin: (state) => state.usuario?.perfil === 'admin',
    nomeUsuario: (state) => state.usuario?.nome || ''
  },

  actions: {
    async login(matricula, senha) {
      this.carregando = true;
      this.erro = null;
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matricula, senha })
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || data.errors?.[0]?.msg || 'Erro no login');
        }

        this.token = data.token;
        this.usuario = data.usuario;
        localStorage.setItem('token', data.token);
        localStorage.setItem('usuario', JSON.stringify(data.usuario));
        return true;
      } catch (err) {
        this.erro = err.message;
        return false;
      } finally {
        this.carregando = false;
      }
    },

    async registrar(dados) {
      this.carregando = true;
      this.erro = null;
      try {
        const res = await fetch('/api/auth/registrar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dados)
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || data.errors?.[0]?.msg || 'Erro no registro');
        }

        this.token = data.token;
        this.usuario = data.usuario;
        localStorage.setItem('token', data.token);
        localStorage.setItem('usuario', JSON.stringify(data.usuario));
        return true;
      } catch (err) {
        this.erro = err.message;
        return false;
      } finally {
        this.carregando = false;
      }
    },

    logout() {
      this.token = null;
      this.usuario = null;
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
    },

    // Helper para chamadas autenticadas
    authHeaders() {
      return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      };
    }
  }
});
