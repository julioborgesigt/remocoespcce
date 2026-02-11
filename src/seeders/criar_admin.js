/**
 * Criar Admin
 * 
 * Uso: node src/seeders/criar_admin.js
 */

require('dotenv').config();
const { sequelize, Cidade, Servidor } = require('../models');
const bcrypt = require('bcryptjs');

async function criarAdmin() {
    try {
        await sequelize.authenticate();
        console.log('✅ Conectado ao banco.');

        // Sincroniza sem force para não apagar dados
        await sequelize.sync();

        const adminMatricula = process.env.ADMIN_MATRICULA || 'admin';
        const adminSenhaVal = process.env.ADMIN_SENHA || '12312312';

        // Verificar se já existe
        const adminExistente = await Servidor.findOne({ where: { matricula: adminMatricula } });
        if (adminExistente) {
            console.log(`⚠️ Admin [${adminMatricula}] já existe. Atualizando senha...`);
            const novaSenha = await bcrypt.hash(adminSenhaVal, 10);
            adminExistente.senha_hash = novaSenha;
            await adminExistente.save();
            console.log('✅ Senha atualizada.');
            process.exit(0);
        }

        // Criar cidade administrativa (se não existir)
        let cidadeAdmin = await Cidade.findOne({ where: { nome: 'Sede Administrativa' } });
        if (!cidadeAdmin) {
            cidadeAdmin = await Cidade.create({ nome: 'Sede Administrativa', vagas_iniciais: 0 });
        }

        const senhaHash = await bcrypt.hash(adminSenhaVal, 10);

        await Servidor.create({
            matricula: adminMatricula,
            nome: 'Administrador do Sistema',
            senha_hash: senhaHash,
            cidade_lotacao_id: cidadeAdmin.id,
            data_ingresso: '2000-01-01',
            perfil: 'admin'
        });

        console.log(`✅ Admin criado com sucesso: [${adminMatricula}] / [${adminSenhaVal}]`);
        process.exit(0);

    } catch (err) {
        console.error('❌ Erro:', err);
        process.exit(1);
    }
}

criarAdmin();
