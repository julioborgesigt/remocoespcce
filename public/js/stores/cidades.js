// Store de Cidades
const useCidadesStore = Pinia.defineStore('cidades', {
  state: () => ({
    lista: [],
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

    async criar(nome, vagasIniciais) {
      const auth = useAuthStore();
      const res = await fetch('/api/cidades', {
        method: 'POST',
        headers: auth.authHeaders(),
        body: JSON.stringify({ nome, vagas_iniciais: vagasIniciais })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.errors?.[0]?.msg || 'Erro');
      this.lista.push(data);
      return data;
    },

    async atualizar(id, nome, vagasIniciais) {
      const auth = useAuthStore();
      const res = await fetch(`/api/cidades/${id}`, {
        method: 'PUT',
        headers: auth.authHeaders(),
        body: JSON.stringify({ nome, vagas_iniciais: vagasIniciais })
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
    }
  }
});
