const useConfigStore = Pinia.defineStore('config', {
    state: () => ({
        dataLimite: null,
        ultimoProcessamento: null,
        totalNovosServidores: 0,
        loading: false,
        error: null
    }),

    actions: {
        async fetchConfig() {
            this.loading = true;
            this.error = null;
            try {
                const response = await fetch('/api/config');
                if (!response.ok) throw new Error('Falha ao carregar configurações');

                const data = await response.json();
                this.dataLimite = data.dataLimite;
                this.ultimoProcessamento = data.ultimoProcessamento;
                this.totalNovosServidores = data.totalNovosServidores || 0;
            } catch (err) {
                this.error = err.message;
                console.error(err);
            } finally {
                this.loading = false;
            }
        },

        async updateDataLimite(novaData) {
            return this.updateConfig({ dataLimite: novaData });
        },

        async updateTotalNovosServidores(total) {
            const success = await this.updateConfig({ totalNovosServidores: total });
            if (success) this.totalNovosServidores = total;
            return success;
        },

        async updateConfig(payload) {
            this.loading = true;
            this.error = null;
            try {
                const response = await fetch('/api/config', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Erro ao atualizar configuração');
                }

                await this.fetchConfig(); // Recarregar estado
                return true;
            } catch (err) {
                this.error = err.message;
                throw err;
            } finally {
                this.loading = false;
            }
        }
    },

    getters: {
        prazoEncerrado: (state) => {
            if (!state.dataLimite) return false;
            return new Date() > new Date(state.dataLimite);
        },
        dataFormatada: (state) => {
            if (!state.dataLimite) return 'Indefinido';
            return new Date(state.dataLimite).toLocaleString('pt-BR');
        },
        ultimoProcessamentoFormatado: (state) => {
            if (!state.ultimoProcessamento) return 'Nunca';
            return new Date(state.ultimoProcessamento).toLocaleString('pt-BR');
        }
    }
});
