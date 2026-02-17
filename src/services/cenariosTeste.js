const { sequelize, Cidade, Servidor, PedidoRemocao } = require('../models');
const bcrypt = require('bcryptjs');

// Helper para limpar o banco e recriar Admin
async function limparBanco() {
    await sequelize.sync({ force: true });

    const adminSenha = await bcrypt.hash(process.env.ADMIN_SENHA || '12312312', 10);
    const cidadeAdmin = await Cidade.create({ nome: 'Administração Central', vagas_iniciais: 0 });

    await Servidor.create({
        matricula: process.env.ADMIN_MATRICULA || 'admin',
        nome: 'Administrador do Sistema',
        senha_hash: adminSenha,
        cidade_lotacao_id: cidadeAdmin.id,
        data_ingresso: '2000-01-01',
        perfil: 'admin'
    });
}

// Helper para criar servidor padrão
const criarServidor = async (matricula, nome, cidade, anoIngresso) => {
    return await Servidor.create({
        matricula,
        nome,
        senha_hash: '$2a$10$X.s.c/.s.c/.s.c/.s.c/.s.c/.s.c/.s.c/.s.c/.s.c/.s.c/.s.c/', // Dummy hash
        cidade_lotacao_id: cidade.id,
        data_ingresso: `${anoIngresso}-01-01`,
        perfil: 'usuario'
    });
};

const Cenarios = {
    // 1. Ciclo Simples (2 pontas)
    async cicloSimples() {
        await limparBanco();
        const cA = await Cidade.create({ nome: 'Cidade A', vagas_iniciais: 0 });
        const cB = await Cidade.create({ nome: 'Cidade B', vagas_iniciais: 0 });

        const s1 = await criarServidor('SRV01', 'João (A)', cA, 2010);
        const s2 = await criarServidor('SRV02', 'Maria (B)', cB, 2012);

        await PedidoRemocao.create({ servidor_id: s1.id, opcao1_cidade_id: cB.id, status: 'pendente' });
        await PedidoRemocao.create({ servidor_id: s2.id, opcao1_cidade_id: cA.id, status: 'pendente' });

        return {
            mensagem: "Ciclo Simples criado: João (A->B) e Maria (B->A).",
            resultadoEsperado: "João deve ir para Cidade B. Maria deve ir para Cidade A. Ambos atendidos por permuta."
        };
    },

    // 2. Ciclo Triangular (3 pontas)
    async cicloTriangular() {
        await limparBanco();
        const cA = await Cidade.create({ nome: 'Cidade A', vagas_iniciais: 0 });
        const cB = await Cidade.create({ nome: 'Cidade B', vagas_iniciais: 0 });
        const cC = await Cidade.create({ nome: 'Cidade C', vagas_iniciais: 0 });

        const s1 = await criarServidor('SRV01', 'Alice (A)', cA, 2015);
        const s2 = await criarServidor('SRV02', 'Bob (B)', cB, 2016);
        const s3 = await criarServidor('SRV03', 'Carol (C)', cC, 2017);

        await PedidoRemocao.create({ servidor_id: s1.id, opcao1_cidade_id: cB.id, status: 'pendente' }); // A -> B
        await PedidoRemocao.create({ servidor_id: s2.id, opcao1_cidade_id: cC.id, status: 'pendente' }); // B -> C
        await PedidoRemocao.create({ servidor_id: s3.id, opcao1_cidade_id: cA.id, status: 'pendente' }); // C -> A

        return {
            mensagem: "Ciclo Triangular criado: A->B->C->A.",
            resultadoEsperado: "Alice -> B, Bob -> C, Carol -> A. Todos atendidos formando um ciclo fechado."
        };
    },

    // 3. Bloqueio por Antiguidade (Antigo bloqueia novo) - O BUG CORRIGIDO
    async bloqueioAntiguidade() {
        await limparBanco();
        const cA = await Cidade.create({ nome: 'Cidade A', vagas_iniciais: 0 });
        const cB = await Cidade.create({ nome: 'Cidade B', vagas_iniciais: 0 });
        const cX = await Cidade.create({ nome: 'Cidade X', vagas_iniciais: 0 }); // Beco sem saída

        // Antigo em A quer ir para X (impossível)
        const antigo = await criarServidor('ANTIGO', 'Sr. Antigo (A)', cA, 2000);
        // Novo em A quer ir para B (possível se permutar)
        const novo = await criarServidor('NOVO', 'Jovem Novo (A)', cA, 2020);
        // Servidor em B quer ir para A
        const parceiro = await criarServidor('PARCEIRO', 'Parceiro (B)', cB, 2010);

        await PedidoRemocao.create({ servidor_id: antigo.id, opcao1_cidade_id: cX.id, status: 'pendente' });
        await PedidoRemocao.create({ servidor_id: novo.id, opcao1_cidade_id: cB.id, status: 'pendente' });
        await PedidoRemocao.create({ servidor_id: parceiro.id, opcao1_cidade_id: cA.id, status: 'pendente' });

        return {
            mensagem: "Cenário de Bloqueio criado: Antigo (A->X), Novo (A->B), Parceiro (B->A).",
            resultadoEsperado: "Sr. Antigo NÃO atendido (sem vaga em X). Jovem Novo -> B e Parceiro -> A (permuta bem-sucedida). O bloqueio do antigo não deve impedir a permuta dos outros."
        };
    },

    // 4. Disputa de Vaga (2 pessoas para 1 vaga)
    async disputaVaga() {
        await limparBanco();
        const cA = await Cidade.create({ nome: 'Origem A', vagas_iniciais: 0 });
        const cB = await Cidade.create({ nome: 'Origem B', vagas_iniciais: 0 });
        const cDest = await Cidade.create({ nome: 'Destino Dourado', vagas_iniciais: 1 });

        const s1 = await criarServidor('SRV01', 'Candidato 1 (2015)', cA, 2015);
        const s2 = await criarServidor('SRV02', 'Candidato 2 (2010)', cB, 2010); // Mais antigo

        await PedidoRemocao.create({ servidor_id: s1.id, opcao1_cidade_id: cDest.id, status: 'pendente' });
        await PedidoRemocao.create({ servidor_id: s2.id, opcao1_cidade_id: cDest.id, status: 'pendente' });

        return {
            mensagem: "Disputa de Vaga criada: 2 candidatos para 1 vaga.",
            resultadoEsperado: "Candidato 2 (2010) deve vencer por ser mais antigo. Candidato 1 permanece na origem."
        };
    },

    // 5. Cenário Efetivo Completo
    async cenarioCompleto() {
        // ... (existing code for cenarioCompleto) ...
        // Reutiliza a lógica do cenario_teste_efetivo.js
        // Como o código original era um script solto, vou reimplementar simplificado aqui para manter tudo num lugar só
        await limparBanco();

        const fortaleza = await Cidade.create({ nome: 'Fortaleza', vagas_iniciais: 0 });
        const sobral = await Cidade.create({ nome: 'Sobral', vagas_iniciais: 0 }); // Forçando 0 para ciclo
        const juazeiro = await Cidade.create({ nome: 'Juazeiro', vagas_iniciais: 0 });
        const crato = await Cidade.create({ nome: 'Crato', vagas_iniciais: 0 });
        const quixada = await Cidade.create({ nome: 'Quixadá', vagas_iniciais: 2 });

        // Ciclo
        const alice = await criarServidor('SRV001', 'Alice (Fort)', fortaleza, 2010);
        const bruno = await criarServidor('SRV002', 'Bruno (Sob)', sobral, 2012);
        const carla = await criarServidor('SRV003', 'Carla (Jua)', juazeiro, 2015);

        await PedidoRemocao.create({ servidor_id: alice.id, opcao1_cidade_id: sobral.id, status: 'pendente' });
        await PedidoRemocao.create({ servidor_id: bruno.id, opcao1_cidade_id: juazeiro.id, status: 'pendente' });
        await PedidoRemocao.create({ servidor_id: carla.id, opcao1_cidade_id: fortaleza.id, status: 'pendente' });

        // Vaga direta
        const daniel = await criarServidor('SRV004', 'Daniel (Crato)', crato, 2018);
        await PedidoRemocao.create({ servidor_id: daniel.id, opcao1_cidade_id: quixada.id, status: 'pendente' });

        return {
            mensagem: "Cenário Completo criado: Ciclo Triangular + Alocações Diretas.",
            resultadoEsperado: "Alice->Sobral, Bruno->Juazeiro, Carla->Fortaleza (Ciclo). Daniel->Quixadá (Vaga Direta)."
        };
    },

    // 6. Cenário Complexo (10 Servidores)
    async complexo10Servidores() {
        await limparBanco();

        // Criar 10 cidades
        const cidades = [];
        for (let i = 1; i <= 10; i++) {
            cidades.push(await Cidade.create({ nome: `Cidade ${i}`, vagas_iniciais: i % 5 === 0 ? 1 : 0 })); // Cidade 5 e 10 têm 1 vaga
        }

        // Criar 10 servidores em cidades diferentes (ou repetidas)
        // Vamos espalhar: Servidores 1-10 nas cidades 1-10
        const servidores = [];
        for (let i = 1; i <= 10; i++) {
            servidores.push(await criarServidor(
                `SRV${i.toString().padStart(3, '0')}`,
                `Servidor ${i}`,
                cidades[i - 1],
                2010 + i // Antiguidade variável: Servidor 1 (2011) é mais novo que Servidor 10 (2020)? Não, aqui estou somando ano. S1=2014, S10=2023. Antigo prioriza.
            ));
        }

        // Criar Pedidos Complexos
        // Cada um quer 3 opções. Vamos gerar ciclos e cadeias.

        // S1 (C1) quer C2, C3, C4
        await PedidoRemocao.create({ servidor_id: servidores[0].id, opcao1_cidade_id: cidades[1].id, opcao2_cidade_id: cidades[2].id, opcao3_cidade_id: cidades[3].id });
        // S2 (C2) quer C3, C1, C5
        await PedidoRemocao.create({ servidor_id: servidores[1].id, opcao1_cidade_id: cidades[2].id, opcao2_cidade_id: cidades[0].id, opcao3_cidade_id: cidades[4].id });
        // S3 (C3) quer C1, C2, C4
        await PedidoRemocao.create({ servidor_id: servidores[2].id, opcao1_cidade_id: cidades[0].id, opcao2_cidade_id: cidades[1].id, opcao3_cidade_id: cidades[3].id });

        // S4 (C4) quer C5, C6, C7
        await PedidoRemocao.create({ servidor_id: servidores[3].id, opcao1_cidade_id: cidades[4].id, opcao2_cidade_id: cidades[5].id, opcao3_cidade_id: cidades[6].id });
        // S5 (C5 - Vaga) quer C6, C7, C8
        await PedidoRemocao.create({ servidor_id: servidores[4].id, opcao1_cidade_id: cidades[5].id, opcao2_cidade_id: cidades[6].id, opcao3_cidade_id: cidades[7].id });

        // S6 (C6) quer C7, C8, C9
        await PedidoRemocao.create({ servidor_id: servidores[5].id, opcao1_cidade_id: cidades[6].id, opcao2_cidade_id: cidades[7].id, opcao3_cidade_id: cidades[8].id });
        // S7 (C7) quer C8, C9, C10
        await PedidoRemocao.create({ servidor_id: servidores[6].id, opcao1_cidade_id: cidades[7].id, opcao2_cidade_id: cidades[8].id, opcao3_cidade_id: cidades[9].id });

        // S8 (C8) quer C9, C10, C1
        await PedidoRemocao.create({ servidor_id: servidores[7].id, opcao1_cidade_id: cidades[8].id, opcao2_cidade_id: cidades[9].id, opcao3_cidade_id: cidades[0].id });

        // S9 (C9) quer C10, C1, C2
        await PedidoRemocao.create({ servidor_id: servidores[8].id, opcao1_cidade_id: cidades[9].id, opcao2_cidade_id: cidades[0].id, opcao3_cidade_id: cidades[1].id });

        // S10 (C10 - Vaga) quer C1, C2, C3
        await PedidoRemocao.create({ servidor_id: servidores[9].id, opcao1_cidade_id: cidades[0].id, opcao2_cidade_id: cidades[1].id, opcao3_cidade_id: cidades[2].id });

        return {
            mensagem: "Cenário Complexo 10 Servidores criado: Múltiplos ciclos e cadeias interligadas, com 2 vagas reais (C5, C10).",
            resultadoEsperado: "Complexo: Verificar se as cadeias se resolvem otimizando o número de atendimentos."
        };
    }
};

module.exports = Cenarios;
