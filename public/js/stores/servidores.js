// Store de Servidores
const useServidoresStore = Pinia.defineStore('servidores', {
  state: () => ({
    lista: [],
    paginacao: { total: 0, pagina: 1, limite: 50, totalPaginas: 1 },
    meuPedido: null,
    carregando: false,
    erro: null
  }),

  actions: {
    async carregarTodos(page = 1, limit = 50, comPedido = false) {
      const auth = useAuthStore();
      this.carregando = true;
      try {
        const query = new URLSearchParams({ page, limit, com_pedido: comPedido });
        const res = await fetch(`/api/servidores?${query.toString()}`, {
          headers: auth.authHeaders()
        });
        if (!res.ok) throw new Error('Erro ao carregar servidores');
        const resultado = await res.json();
        this.lista = resultado.data;
        this.paginacao = resultado.paginacao;
      } catch (err) {
        this.erro = err.message;
      } finally {
        this.carregando = false;
      }
    },

    async carregarMeuPedido() {
      const auth = useAuthStore();
      this.carregando = true;
      try {
        const res = await fetch('/api/servidores/meu-pedido', {
          headers: auth.authHeaders()
        });
        if (!res.ok) throw new Error('Erro ao carregar pedido');
        this.meuPedido = await res.json();
      } catch (err) {
        this.erro = err.message;
      } finally {
        this.carregando = false;
      }
    },

    async salvarPedido(opcao1, opcao2, opcao3, prioridade) {
      const auth = useAuthStore();
      const res = await fetch('/api/servidores/pedido', {
        method: 'POST',
        headers: auth.authHeaders(),
        body: JSON.stringify({
          opcao1_cidade_id: opcao1,
          opcao2_cidade_id: opcao2 || null,
          opcao3_cidade_id: opcao3 || null,
          motivo_prioridade: prioridade || 'nenhum'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.errors?.[0]?.msg || 'Erro');
      this.meuPedido = data;
      return data;
    },

    async cancelarPedido() {
      const auth = useAuthStore();
      const res = await fetch('/api/servidores/pedido', {
        method: 'DELETE',
        headers: auth.authHeaders()
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro');
      }
      this.meuPedido = null;
    },

    async carregarHistorico() {
      this.carregando = true;
      const auth = useAuthStore();
      try {
        const res = await fetch('/api/processamento/historico/ultima', {
          headers: auth.authHeaders()
        });
        if (!res.ok) {
          return [];
        }
        const data = await res.json();
        return data.historico || [];
      } catch (err) {
        console.error('Erro ao buscar histórico:', err);
        return [];
      } finally {
        this.carregando = false;
      }
    }
  }
});
