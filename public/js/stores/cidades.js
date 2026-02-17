// Store de Cidades
const useCidadesStore = Pinia.defineStore('cidades', {
  state: () => ({
    lista: [],
    concorrencia: [],
    ranking: [],
    carregando: false,
    erro: null
  }),

  actions: {
    async carregar() {
      this.carregando = true;
      try {
        const res = await fetch('/api/cidades');
        if (!res.ok) throw new Error('Erro ao carregar cidades');
        this.lista = await res.json();
      } catch (err) {
        this.erro = err.message;
      } finally {
        this.carregando = false;
      }
    },

    async carregarConcorrencia() {
      const auth = useAuthStore();
      try {
        const res = await fetch('/api/cidades/concorrencia', {
          headers: auth.authHeaders()
        });
        if (!res.ok) throw new Error('Erro ao carregar concorrência');
        this.concorrencia = await res.json();
      } catch (err) {
        this.erro = err.message;
      }
    },

    async criar(nome, vagasIniciais, efetivoIdeal, efetivoAtual) {
      const auth = useAuthStore();
      const res = await fetch('/api/cidades', {
        method: 'POST',
        headers: auth.authHeaders(),
        body: JSON.stringify({
          nome,
          vagas_iniciais: vagasIniciais,
          efetivo_ideal: efetivoIdeal,
          efetivo_atual: efetivoAtual
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.errors?.[0]?.msg || 'Erro');
      this.lista.push(data);
      return data;
    },

    async atualizar(id, nome, vagasIniciais, efetivoIdeal, efetivoAtual) {
      const auth = useAuthStore();
      const res = await fetch(`/api/cidades/${id}`, {
        method: 'PUT',
        headers: auth.authHeaders(),
        body: JSON.stringify({
          nome,
          vagas_iniciais: vagasIniciais,
          efetivo_ideal: efetivoIdeal,
          efetivo_atual: efetivoAtual
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro');
      const idx = this.lista.findIndex(c => c.id === id);
      if (idx !== -1) this.lista.splice(idx, 1, { ...this.lista[idx], ...data });
      return data;
    },

    async remover(id) {
      const auth = useAuthStore();
      const res = await fetch(`/api/cidades/${id}`, {
        method: 'DELETE',
        headers: auth.authHeaders()
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro');
      }
      this.lista = this.lista.filter(c => c.id !== id);
    },

    async carregarRanking(filtros = {}) {
      const auth = useAuthStore();
      const params = new URLSearchParams(filtros).toString();
      const url = params ? `/api/ranking?${params}` : '/api/ranking';

      try {
        const res = await fetch(url, { // Default regra=aprimorada
          headers: auth.authHeaders()
        });
        if (!res.ok) throw new Error('Erro ao carregar ranking');
        this.ranking = await res.json();
      } catch (err) {
        console.error('Erro ao carregar ranking:', err);
      }
    }
  }
});
