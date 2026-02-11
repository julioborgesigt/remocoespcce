/**
 * Cenario de Teste Efetivo
 * 
 * Este cenário foca em testar a robustez do algoritmo com:
 * 1. Ciclos complexos (triangulares, quadrangulares)
 * 2. Cadeias de dependência (A move -> B move -> C move)
 * 3. Competição por vagas (Antiguidade decidindo)
 * 4. Garantia de NÃO haver pedidos para a própria cidade (origem == destino)
 * 
 * Uso: node src/seeders/cenario_teste_efetivo.js
 */

require('dotenv').config();
const { sequelize, Cidade, Servidor, PedidoRemocao } = require('../models');
const bcrypt = require('bcryptjs');

async function criarCenarioEfetivo() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado ao banco.');

    // Limpar banco e recriar tabelas
    await sequelize.sync({ force: true });
    console.log('✅ Base de dados resetada.');

    // ── 1. Cidades ──────────────────────────────────────────
    // Criamos cidades com vagas variadas para testar escassez e abundância
    const cidadesData = [
      { nome: 'Fortaleza', vagas_iniciais: 0 },      // Capital muito disputada, sem vagas iniciais
      { nome: 'Sobral', vagas_iniciais: 1 },         // Polo regional, 1 vaga
      { nome: 'Juazeiro', vagas_iniciais: 0 },       // Polo regional, sem vagas
      { nome: 'Crato', vagas_iniciais: 0 },          // Interior, sem vagas
      { nome: 'Iguatu', vagas_iniciais: 0 },         // Interior, sem vagas
      { nome: 'Quixadá', vagas_iniciais: 2 },        // Interior com sobra de vagas
      { nome: 'Russas', vagas_iniciais: 0 }          // Cidade isolada para teste de "sem saída"
    ];

    const cidades = await Cidade.bulkCreate(cidadesData);
    const [fortaleza, sobral, juazeiro, crato, iguatu, quixada, russas] = cidades;

    console.log('✅ Cidades criadas.');

    // ── 0. Admin ──────────────────────────────────────────── (NOVO)
    const adminMatricula = process.env.ADMIN_MATRICULA || 'admin';
    const adminSenha = await bcrypt.hash(process.env.ADMIN_SENHA || '12312312', 10);
    const senhaHash = await bcrypt.hash('123456', 10);

    // Criar cidade administrativa (fictícia) para o admin
    const cidadeAdmin = await Cidade.create({ nome: 'Administração Central', vagas_iniciais: 0 });

    await Servidor.create({
      matricula: adminMatricula,
      nome: 'Administrador do Sistema',
      senha_hash: adminSenha,
      cidade_lotacao_id: cidadeAdmin.id,
      data_ingresso: '2000-01-01',
      perfil: 'admin'
    });
    console.log(`✅ Admin criado: Usuário [${adminMatricula}] / Senha [${process.env.ADMIN_SENHA || '12312312'}]`);


    // ── 2. Servidores ───────────────────────────────────────

    // Helper para criar servidor
    const criarServidor = (matricula, nome, cidade, anoIngresso) => ({
      matricula,
      nome,
      senha_hash: senhaHash,
      cidade_lotacao_id: cidade.id,
      data_ingresso: `${anoIngresso}-01-01`, // Data simplificada para facilitar entendimento de antiguidade
      perfil: 'usuario'
    });

    const servidoresData = [
      // GRUPO A: Ciclo Triangular (Fortaleza -> Sobral -> Juazeiro -> Fortaleza)
      criarServidor('SRV001', 'Alice (Fortaleza)', fortaleza, 2010), // Quer ir para Sobral
      criarServidor('SRV002', 'Bruno (Sobral)', sobral, 2012),       // Quer ir para Juazeiro
      criarServidor('SRV003', 'Carla (Juazeiro)', juazeiro, 2015),   // Quer ir para Fortaleza

      // GRUPO B: Competição por Vaga (Dois querem a vaga de Quixadá)
      // Daniel é mais antigo (2018) que Eduardo (2020)
      criarServidor('SRV004', 'Daniel (Crato)', crato, 2018),
      criarServidor('SRV005', 'Eduardo (Iguatu)', iguatu, 2020),

      // GRUPO C: Cadeia de Dependência (Depende do Grupo A ou B liberarem vaga?)
      // Na verdade, vamos fazer uma troca direta simples aqui
      criarServidor('SRV006', 'Fabio (Russas)', russas, 2019),
      criarServidor('SRV007', 'Gabriela (Quixadá)', quixada, 2021) // Quixadá tem vagas, mas ela quer sair
    ];

    const servidores = await Servidor.bulkCreate(servidoresData);
    console.log('✅ Servidores criados.');

    // ── 3. Pedidos de Remoção ──────────────────────────────
    // IMPORTANTE: Garantir que origem != destino em todas as opções

    const pedidosData = [
      // 1. Alice: Fortaleza -> Sobral (Faz parte do Ciclo A)
      {
        servidor_id: servidores[0].id,
        opcao1_cidade_id: sobral.id,
        opcao2_cidade_id: null, // Sem outras opções
        status: 'pendente'
      },
      // 2. Bruno: Sobral -> Juazeiro (Faz parte do Ciclo A)
      {
        servidor_id: servidores[1].id,
        opcao1_cidade_id: juazeiro.id,
        opcao2_cidade_id: null,
        status: 'pendente'
      },
      // 3. Carla: Juazeiro -> Fortaleza (Fecha Ciclo A)
      {
        servidor_id: servidores[2].id,
        opcao1_cidade_id: fortaleza.id,
        opcao2_cidade_id: null,
        status: 'pendente'
      },

      // 4. Daniel: Crato -> Quixadá (Quixadá tem 2 vagas iniciais)
      // Ele deve conseguir por ALOCAÇÃO DIRETA (Fase 1) pois é vaga aberta
      {
        servidor_id: servidores[3].id,
        opcao1_cidade_id: quixada.id,
        opcao2_cidade_id: null,
        status: 'pendente'
      },

      // 5. Eduardo: Iguatu -> Quixadá (Mesma vaga que Daniel pegou, mas tem 2 vagas ao todo)
      // Também deve conseguir por ALOCAÇÃO DIRETA
      {
        servidor_id: servidores[4].id,
        opcao1_cidade_id: quixada.id,
        opcao2_cidade_id: null,
        status: 'pendente'
      },

      // 6. Fabio: Russas -> Sobral (Só consegue se Sobral liberar vaga)
      // Sobral tem 1 vaga inicial. 
      // MAS, Bruno (de Sobral) vai sair no Ciclo A. 
      // Porém, no Ciclo A, a vaga de Sobral é preenchida por Alice.
      // Então a vaga inicial de Sobral (1) está livre? 
      // Sim, Sobral começa com 1 vaga. 
      // Se Bruno sai, Sobral fica com 1 (livre) + 1 (de Bruno) = 2? 
      // Não, Bruno ocupa uma vaga "ocupada". Se ele sai, abre a dele.
      // A vaga inicial é "vaga pura".
      // Vamos ver:
      // Sobral Vagas Iniciais: 1.
      // Alice quer ir pra Sobral.
      // Fabio quer ir pra Sobral.
      // Alice (2010), Fabio (2019). Alice tem prioridade.
      // Alice pega a vaga de Sobral (Alocação Direta)?
      // Se Alice pegar a vaga DIRETA de Sobral, ela sai de Fortaleza.
      // Fortaleza abre 1 vaga.
      // Carla quer Fortaleza. Carla entra em Fortaleza (Alocação Direta).
      // Carla sai de Juazeiro. Juazeiro abre 1 vaga.
      // Bruno quer Juazeiro. Bruno entra em Juazeiro.
      // Bruno sai de Sobral. Sobral abre +1 vaga.
      // Agora tem +1 vaga em Sobral.
      // Fabio quer Sobral. Fabio entra.
      // TODOS FELIZES! Sem ciclo necessário, apenas fluxo de vagas.

      // Vamos MUDAR para forçar ciclo.
      // Tira a vaga inicial de Sobral.
      {
        servidor_id: servidores[5].id, // Fabio
        opcao1_cidade_id: sobral.id,
        opcao2_cidade_id: null,
        status: 'pendente'
      },

      // 7. Gabriela: Quixadá -> Russas
      // Russas tem 0 vagas. Fabio quer sair de Russas.
      // Se Fabio conseguir sair (ver acima), abre vaga em Russas.
      // Gabriela entra em Russas.
      {
        servidor_id: servidores[6].id, // Gabriela
        opcao1_cidade_id: russas.id,
        opcao2_cidade_id: null,
        status: 'pendente'
      }
    ];

    // Ajuste de Vagas para ficar mais interessante (Forçar Ciclo)
    // Se Sobral tiver 0 vagas, Alice só entra se Bruno sair.
    // Bruno só sai se tiver vaga em Juazeiro.
    // Juazeiro tem 0. Só tem vaga se Carla sair.
    // Carla só sai se tiver vaga em Fortaleza.
    // Fortaleza tem 0. Só tem vaga se Alice sair.
    // ISSO É UM CICLO PERFEITO!
    // Então vou alterar a vaga de Sobral para 0 no update abaixo pra garantir o teste de ciclo.
    await sobral.update({ vagas_iniciais: 0 });
    console.log('ℹ️ Ajustado Sobral para 0 vagas para forçar detecção de ciclo.');

    await PedidoRemocao.bulkCreate(pedidosData);
    console.log('✅ Pedidos criados.');

    console.log('\n═ RESUMO DO CENÁRIO ════════════════════════════════════════');
    console.log('1. Ciclo Triangular (Sem vagas iniciais nas cidades envolvidas):');
    console.log('   Alice (Fortaleza) -> Sobral');
    console.log('   Bruno (Sobral)    -> Juazeiro');
    console.log('   Carla (Juazeiro)  -> Fortaleza');
    console.log('   -> Resultado esperado: PERMUTA CIRCULAR entre os 3.');

    console.log('\n2. Alocação Direta (Quixadá tem 2 vagas):');
    console.log('   Daniel (Crato)    -> Quixadá');
    console.log('   Eduardo (Iguatu)  -> Quixadá');
    console.log('   -> Resultado esperado: Ambos aprovados por alocação direta.');

    console.log('\n3. Cadeia de Dependência (Efeito Dominó):');
    console.log('   Fabio (Russas)    -> Sobral');
    console.log('   Gabriela (Quixadá)-> Russas');
    console.log('   -> Análise: ');
    console.log('      Sobral terá vaga? Sim, Alice ocupou a vaga DE BRUNO? Não, Alice permutou Com Bruno?');
    console.log('      Na permuta circular: Alice ocupa vaga de Bruno em Sobral.');
    console.log('      Bruno ocupa vaga de Carla em Juazeiro.');
    console.log('      Carla ocupa vaga de Alice em Fortaleza.');
    console.log('      Sobral continua com 0 vagas livres "extras".');
    console.log('      ENTRETANTO, Fabio quer Sobral.');
    console.log('      Se não houver vaga sobrando em Sobral, Fabio fica pendente.');
    console.log('      Se Fabio não sai de Russas, Gabriela não entra em Russas.');
    console.log('   -> Resultado esperado: Fabio e Gabriela NÃO ATENDIDOS (pois o ciclo acima é fechado e não gera vagas extras).');

    console.log('\n════════════════════════════════════════════════════════════');

    process.exit(0);

  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

criarCenarioEfetivo();
