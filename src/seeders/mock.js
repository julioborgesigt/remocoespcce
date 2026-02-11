/**
 * Seeder — Dados iniciais e cenários de teste
 *
 * Uso:
 *   npm run seed       → Cria admin + cidades básicas
 *   npm run seed:test  → Cria cenário completo de teste com travamento
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, Cidade, Servidor, PedidoRemocao } = require('../models');

const isTest = process.argv.includes('--test');

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado ao banco.');

    // Sincroniza (force recria tabelas)
    await sequelize.sync({ force: true });
    console.log('✅ Tabelas recriadas.');

    // ── Admin padrão ──────────────────────────────────────
    const adminMatricula = process.env.ADMIN_MATRICULA || 'ADMIN001';
    const adminSenhaVal = process.env.ADMIN_SENHA || 'admin123';
    const senhaAdmin = await bcrypt.hash(adminSenhaVal, 12);

    // Criar cidade para o admin
    const cidadeAdmin = await Cidade.create({ nome: 'Sede Administrativa', vagas_iniciais: 0 });

    await Servidor.create({
      matricula: adminMatricula,
      nome: 'Administrador do Sistema',
      senha_hash: senhaAdmin,
      data_ingresso: '2000-01-01',
      cidade_lotacao_id: cidadeAdmin.id,
      perfil: 'admin'
    });
    console.log(`✅ Admin criado: Usuário [${adminMatricula}] / Senha [${adminSenhaVal}]`);

    if (!isTest) {
      console.log('\n🏁 Seed básico concluído. Use --test para cenário completo.');
      process.exit(0);
    }

    // ══════════════════════════════════════════════════════
    // CENÁRIO DE TESTE COMPLETO
    // ══════════════════════════════════════════════════════

    console.log('\n📋 Criando cenário de teste...\n');

    // ── Cidades ──────────────────────────────────────────
    const cidades = await Cidade.bulkCreate([
      { nome: 'Fortaleza', vagas_iniciais: 2 },
      { nome: 'Iguatu', vagas_iniciais: 0 },
      { nome: 'Juazeiro do Norte', vagas_iniciais: 1 },
      { nome: 'Sobral', vagas_iniciais: 0 },
      { nome: 'Crato', vagas_iniciais: 0 },
      { nome: 'Quixadá', vagas_iniciais: 1 }
    ]);

    const [fortaleza, iguatu, juazeiro, sobral, crato, quixada] = cidades;
    console.log('  ✅ 6 cidades criadas');

    // ── Servidores ───────────────────────────────────────
    const senhaPadrao = await bcrypt.hash('123456', 12);

    const servidores = await Servidor.bulkCreate([
      // Caso 1: Permuta simples (Iguatu ↔ Sobral, 0 vagas cada)
      {
        matricula: 'SRV001', nome: 'João da Silva',
        senha_hash: senhaPadrao, data_ingresso: '2005-03-15',
        cidade_lotacao_id: iguatu.id, perfil: 'usuario'
      },
      {
        matricula: 'SRV002', nome: 'Maria Oliveira',
        senha_hash: senhaPadrao, data_ingresso: '2008-07-22',
        cidade_lotacao_id: sobral.id, perfil: 'usuario'
      },

      // Caso 2: Alocação direta (Fortaleza tem 2 vagas)
      {
        matricula: 'SRV003', nome: 'Carlos Santos',
        senha_hash: senhaPadrao, data_ingresso: '2010-01-10',
        cidade_lotacao_id: juazeiro.id, perfil: 'usuario'
      },

      // Caso 3: Cadeia circular de 3 (Crato → Iguatu → Quixadá → Crato)
      {
        matricula: 'SRV004', nome: 'Ana Pereira',
        senha_hash: senhaPadrao, data_ingresso: '2003-11-01',
        cidade_lotacao_id: crato.id, perfil: 'usuario'
      },
      {
        matricula: 'SRV005', nome: 'Pedro Almeida',
        senha_hash: senhaPadrao, data_ingresso: '2012-05-20',
        cidade_lotacao_id: iguatu.id, perfil: 'usuario'
      },
      {
        matricula: 'SRV006', nome: 'Lucia Ferreira',
        senha_hash: senhaPadrao, data_ingresso: '2015-09-30',
        cidade_lotacao_id: quixada.id, perfil: 'usuario'
      },

      // Caso 4: Servidor que não conseguirá vaga
      {
        matricula: 'SRV007', nome: 'Roberto Lima',
        senha_hash: senhaPadrao, data_ingresso: '2020-02-14',
        cidade_lotacao_id: fortaleza.id, perfil: 'usuario'
      },

      // Caso 5: Vaga cascata — depende da saída de Carlos
      {
        matricula: 'SRV008', nome: 'Fernanda Costa',
        senha_hash: senhaPadrao, data_ingresso: '2007-04-18',
        cidade_lotacao_id: sobral.id, perfil: 'usuario'
      }
    ]);

    console.log('  ✅ 8 servidores criados (senha: 123456)');

    // ── Pedidos de Remoção ───────────────────────────────
    await PedidoRemocao.bulkCreate([
      // João (Iguatu) → quer Sobral (permuta com Maria)
      {
        servidor_id: servidores[0].id,
        opcao1_cidade_id: sobral.id,
        opcao2_cidade_id: fortaleza.id,
        opcao3_cidade_id: null
      },
      // Maria (Sobral) → quer Iguatu (permuta com João)
      {
        servidor_id: servidores[1].id,
        opcao1_cidade_id: iguatu.id,
        opcao2_cidade_id: null,
        opcao3_cidade_id: null
      },
      // Carlos (Juazeiro) → quer Fortaleza (alocação direta, Fortaleza tem 2 vagas)
      {
        servidor_id: servidores[2].id,
        opcao1_cidade_id: fortaleza.id,
        opcao2_cidade_id: null,
        opcao3_cidade_id: null
      },
      // Ana (Crato) → quer Iguatu (cadeia circular)
      {
        servidor_id: servidores[3].id,
        opcao1_cidade_id: iguatu.id,
        opcao2_cidade_id: fortaleza.id,
        opcao3_cidade_id: null
      },
      // Pedro (Iguatu) → quer Quixadá (cadeia circular)
      {
        servidor_id: servidores[4].id,
        opcao1_cidade_id: quixada.id,
        opcao2_cidade_id: null,
        opcao3_cidade_id: null
      },
      // Lucia (Quixadá) → quer Crato (cadeia circular)
      {
        servidor_id: servidores[5].id,
        opcao1_cidade_id: crato.id,
        opcao2_cidade_id: null,
        opcao3_cidade_id: null
      },
      // Roberto (Fortaleza) → quer Crato (sem vaga, não forma ciclo)
      {
        servidor_id: servidores[6].id,
        opcao1_cidade_id: crato.id,
        opcao2_cidade_id: sobral.id,
        opcao3_cidade_id: null
      },
      // Fernanda (Sobral) → quer Juazeiro (vaga cascata: abre quando Carlos sair)
      {
        servidor_id: servidores[7].id,
        opcao1_cidade_id: juazeiro.id,
        opcao2_cidade_id: fortaleza.id,
        opcao3_cidade_id: null
      }
    ]);

    console.log('  ✅ 8 pedidos de remoção criados\n');

    // ── Resumo do cenário ────────────────────────────────
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║                   CENÁRIO DE TESTE                      ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log('║                                                          ║');
    console.log('║  CIDADES (vagas iniciais):                               ║');
    console.log('║    Fortaleza: 2 | Iguatu: 0 | Juazeiro: 1               ║');
    console.log('║    Sobral: 0    | Crato: 0  | Quixadá: 1                ║');
    console.log('║                                                          ║');
    console.log('║  CASO 1 — Permuta Simples (0 vagas ↔ 0 vagas):          ║');
    console.log('║    João (Iguatu) ↔ Maria (Sobral)                        ║');
    console.log('║    ✓ Ambos devem trocar de lugar                         ║');
    console.log('║                                                          ║');
    console.log('║  CASO 2 — Alocação Direta:                              ║');
    console.log('║    Carlos (Juazeiro) → Fortaleza (2 vagas)               ║');
    console.log('║    ✓ Deve ir direto, abrindo 1 vaga em Juazeiro          ║');
    console.log('║                                                          ║');
    console.log('║  CASO 3 — Cadeia Circular de 3:                          ║');
    console.log('║    Ana (Crato) → Iguatu                                  ║');
    console.log('║    Pedro (Iguatu) → Quixadá                              ║');
    console.log('║    Lucia (Quixadá) → Crato                               ║');
    console.log('║    ✓ Os 3 devem rotacionar simultaneamente               ║');
    console.log('║                                                          ║');
    console.log('║  CASO 4 — Não Atendido:                                  ║');
    console.log('║    Roberto (Fortaleza) → Crato (0 vagas, sem ciclo)      ║');
    console.log('║    ✗ Não deve ser atendido                               ║');
    console.log('║                                                          ║');
    console.log('║  CASO 5 — Vaga Cascata:                                  ║');
    console.log('║    Fernanda (Sobral) → Juazeiro                          ║');
    console.log('║    ✓ Vaga abre quando Carlos sai de Juazeiro             ║');
    console.log('║                                                          ║');
    console.log('║  RESULTADO ESPERADO: 7 atendidos, 1 não atendido         ║');
    console.log('╚══════════════════════════════════════════════════════════╝');

    console.log('\n✅ Seed de teste concluído!');
    console.log('   Login admin: ADMIN001 / admin123');
    console.log('   Login servidor: SRV001..SRV008 / 123456\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Erro no seed:', err);
    process.exit(1);
  }
}

seed();
