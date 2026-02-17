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
        const data = await res.json();
        this.dashboard = data;
        // Se houver dados de último processamento, exibe como resultado
        if (data.resultadoCompativel && (data.resultadoCompativel.movimentacoes.length > 0 || data.resultadoCompativel.naoAtendidos.length > 0)) {
          this.resultado = data.resultadoCompativel;
        }
      } catch (err) {
        this.erro = err.message;
      } finally {
        this.carregando = false;
      }
    },

    async executar(regra, novosServidores = 0) {
      this.processando = true;
      this.erro = null;
      const auth = useAuthStore();
      try {
        const res = await fetch('/api/processamento/executar', {
          method: 'POST',
          headers: auth.authHeaders(),
          body: JSON.stringify({ regra, novosServidores })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro no processamento.');
        this.resultado = data;
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
    },

    async carregarHistoricoUltima() {
      const auth = useAuthStore();
      try {
        const res = await fetch('/api/processamento/historico/ultima', {
          headers: auth.authHeaders()
        });
        if (!res.ok) throw new Error('Erro ao carregar histórico');
        return await res.json();
      } catch (err) {
        this.erro = err.message;
        throw err;
      }
    },

    async reabrirTemporada() {
      const auth = useAuthStore();
      try {
        const res = await fetch('/api/processamento/reabrir-temporada', {
          method: 'POST',
          headers: auth.authHeaders()
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Erro ao reabrir temporada');
        }
        await this.carregarDashboard();
        return await res.json();
      } catch (err) {
        this.erro = err.message;
        throw err;
      }
    }
  }
});
