const { compararPedidos } = require('../services/algoritmoRemocao');

describe('Algoritmo de Remoção - compararPedidos', () => {

    const criarMockPedido = (matricula, dataIngresso, motivoPrioridade = 'nenhum') => ({
        servidor: {
            matricula,
            data_ingresso: dataIngresso,
        },
        motivo_prioridade: motivoPrioridade
    });

    const criarMockPedidoCompleto = (matricula, dataIngresso, dataPosse, dataLotacao, tempoTotal, motivo) => ({
        servidor: {
            matricula,
            data_ingresso: dataIngresso,
            data_posse_cargo: dataPosse,
            data_lotacao_atual: dataLotacao,
            tempo_servico_total_dias: tempoTotal
        },
        motivo_prioridade: motivo
    });

    describe('Regra: Antiguidade (Padrão)', () => {
        it('Deve priorizar o servidor com data de ingresso mais antiga', () => {
            const p1 = criarMockPedido('111', '2010-01-01');
            const p2 = criarMockPedido('222', '2005-01-01');

            const resultado = compararPedidos(p1, p2, 'antiguidade');
            expect(resultado).toBeGreaterThan(0); // p2 é menor/mais prioritário (retorna positivo)
        });

        it('Deve desempatar pela matrícula se a data for igual', () => {
            const p1 = criarMockPedido('222', '2010-01-01');
            const p2 = criarMockPedido('111', '2010-01-01');

            const resultado = compararPedidos(p1, p2, 'antiguidade');
            expect(resultado).toBeGreaterThan(0); // p1 "perde" para p2 (matricula menor)
        });
    });

    describe('Regra: Aprimorada', () => {
        it('Deve priorizar pelo motivo_prioridade legal (Segurança > Saúde > Unidade Familiar > Nenhum)', () => {
            const p1 = criarMockPedidoCompleto('111', '2010-01-01', null, null, 0, 'nenhum');
            const p2 = criarMockPedidoCompleto('222', '2020-01-01', null, null, 0, 'seguranca');

            const resultado = compararPedidos(p1, p2, 'aprimorada');
            expect(resultado).toBeGreaterThan(0); // p2 ganha de p1, mesmo p1 sendo mais antigo (Segurança peso 3)
        });

        it('Deve priorizar tempo no cargo atual se motivos forem iguais', () => {
            const p1 = criarMockPedidoCompleto('111', '2010-01-01', '2012-01-01', null, 0, 'nenhum');
            const p2 = criarMockPedidoCompleto('222', '2010-01-01', '2005-01-01', null, 0, 'nenhum');

            const resultado = compararPedidos(p1, p2, 'aprimorada');
            expect(resultado).toBeGreaterThan(0); // p2 ganha pois tomou posse antes (2005 vs 2012)
        });
    });

});
