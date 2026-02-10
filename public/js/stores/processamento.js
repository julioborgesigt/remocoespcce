// Store de Processamento
const useProcessamentoStore = Pinia.defineStore('processamento', {
  state: () => ({
    dashboard: null,
    resultado: null,
    carregando: false,
    processando: false,
    erro: null
  }),

  actions: {
    async carregarDashboard() {
      const auth = useAuthStore();
      this.carregando = true;
      try {
        const res = await fetch('/api/processamento/dashboard', {
          headers: auth.authHeaders()
        });
        if (!res.ok) throw new Error('Erro ao carregar dashboard');
        this.dashboard = await res.json();
      } catch (err) {
        this.erro = err.message;
      } finally {
        this.carregando = false;
      }
    },

    async executar() {
      const auth = useAuthStore();
      this.processando = true;
      this.erro = null;
      try {
        const res = await fetch('/api/processamento/executar', {
          method: 'POST',
          headers: auth.authHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro no processamento');
        this.resultado = data;
        return data;
      } catch (err) {
        this.erro = err.message;
        throw err;
      } finally {
        this.processando = false;
      }
    },

    async resetar() {
      const auth = useAuthStore();
      try {
        const res = await fetch('/api/processamento/resetar', {
          method: 'POST',
          headers: auth.authHeaders()
        });
        if (!res.ok) throw new Error('Erro ao resetar');
        this.resultado = null;
        await this.carregarDashboard();
      } catch (err) {
        this.erro = err.message;
        throw err;
      }
    }
  }
});
