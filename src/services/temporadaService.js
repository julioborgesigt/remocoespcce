const { PedidoRemocao, Servidor, HistoricoRemocao, Cidade, Configuracao, sequelize } = require('../models');

async function fecharTemporadaBase() {
    const t = await sequelize.transaction();
    try {
        // 1. Buscar todos os pedidos
        const pedidos = await PedidoRemocao.findAll({
            include: [{ model: Servidor, as: 'servidor' }],
            transaction: t
        });

        if (pedidos.length === 0) {
            await t.rollback();
            throw new Error('Nenhum pedido para fechar a temporada.');
        }

        const agora = new Date();
        const historicos = [];
        const removidosIds = [];

        // 2. Processar pedidos Atendidos
        for (const p of pedidos) {
            const isAtendido = p.status === 'atendido';

            // Criar registro no histórico para TODOS os pedidos
            historicos.push({
                temporada_data: agora,
                servidor_id: p.servidor_id,
                matricula: p.servidor.matricula,
                nome: p.servidor.nome,
                cidade_origem_id: p.servidor.cidade_lotacao_id,
                cidade_destino_id: isAtendido ? p.cidade_destino_final_id : null,
                status: p.status,
                observacao: p.observacao,
                detalhes_json: JSON.stringify({
                    opcao1: p.opcao1_cidade_id,
                    opcao2: p.opcao2_cidade_id,
                    opcao3: p.opcao3_cidade_id,
                    motivo: p.motivo_prioridade
                })
            });

            if (isAtendido) {
                // Atualizar lotação do servidor
                await Servidor.update(
                    {
                        cidade_lotacao_id: p.cidade_destino_final_id,
                        data_lotacao_atual: agora // Atualiza data de lotação para hoje
                    },
                    {
                        where: { id: p.servidor_id },
                        transaction: t
                    }
                );
                removidosIds.push(p.id);
            }
        }

        // 3. Salvar Histórico em Batch
        await HistoricoRemocao.bulkCreate(historicos, { transaction: t });

        // 4. Limpar/Resetar Pedidos
        if (removidosIds.length > 0) {
            await PedidoRemocao.destroy({
                where: { id: removidosIds },
                transaction: t
            });
        }

        await PedidoRemocao.update(
            { status: 'pendente', observacao: null, cidade_destino_final_id: null },
            { where: { status: ['nao_atendido', 'pendente'] }, transaction: t }
        );

        // 5. Atualizar Cidades e Salvar Snapshot
        const snapshotVagas = {};
        const cidadesAtuais = await Cidade.findAll({ transaction: t });
        for (const c of cidadesAtuais) {
            snapshotVagas[c.id] = c.vagas_iniciais;
        }

        const configNovosAtual = await Configuracao.findOne({ where: { chave: 'total_novos_servidores' }, transaction: t });
        const snapshotNovos = configNovosAtual ? configNovosAtual.valor_texto : '0';

        const configBackup = await Configuracao.findOne({ where: { chave: 'backup_ultima_temporada' }, transaction: t });
        if (configBackup) {
            configBackup.tipo = 'json';
            configBackup.descricao = JSON.stringify({ vagas: snapshotVagas, novos: snapshotNovos });
            configBackup.valor_data = agora;
            await configBackup.save({ transaction: t });
        } else {
            await Configuracao.create({
                chave: 'backup_ultima_temporada',
                descricao: JSON.stringify({ vagas: snapshotVagas, novos: snapshotNovos }),
                valor_data: agora
            }, { transaction: t });
        }

        const deltaMap = new Map();
        cidadesAtuais.forEach(c => deltaMap.set(c.id, 0));

        for (const h of historicos) {
            if (h.status === 'atendido') {
                if (h.cidade_origem_id) deltaMap.set(h.cidade_origem_id, (deltaMap.get(h.cidade_origem_id) || 0) - 1);
                if (h.cidade_destino_id) deltaMap.set(h.cidade_destino_id, (deltaMap.get(h.cidade_destino_id) || 0) + 1);
            }
        }

        for (const c of cidadesAtuais) {
            let novoEfetivo;
            if (c.efetivo_pos !== null && c.efetivo_pos !== undefined) {
                novoEfetivo = c.efetivo_pos;
            } else {
                const delta = deltaMap.get(c.id) || 0;
                const atual = Number(c.efetivo_atual) || 0;
                novoEfetivo = Math.max(0, atual + delta);
            }

            await c.update({
                efetivo_atual: novoEfetivo,
                vagas_iniciais: 0,
                efetivo_pos: null
            }, { transaction: t });
        }

        // 6. Resetar Configuração de Novos Servidores
        await Configuracao.update(
            { valor_texto: '0' },
            { where: { chave: 'total_novos_servidores' }, transaction: t }
        );

        await t.commit();
        return { sucess: true, message: 'Temporada fechada com sucesso! Servidores removidos e histórico salvo.' };
    } catch (error) {
        await t.rollback();
        throw error;
    }
}

module.exports = {
    fecharTemporadaBase
};
