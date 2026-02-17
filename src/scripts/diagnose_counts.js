require('dotenv').config();
const { Cidade, Servidor, sequelize } = require('../models');

async function diagnose() {
    try {
        await sequelize.authenticate();
        console.log('--- DIAGNÓSTICO DE EFETIVO ---');

        const cidades = await Cidade.findAll({ order: [['id', 'ASC']] });

        console.log(String('ID').padEnd(4), String('Cidade').padEnd(30), String('DB_Col').padEnd(10), String('Total').padEnd(10), String('Users').padEnd(10), String('Admins').padEnd(10));
        console.log('-'.repeat(80));

        for (const c of cidades) {
            const total = await Servidor.count({ where: { cidade_lotacao_id: c.id } });
            const users = await Servidor.count({ where: { cidade_lotacao_id: c.id, perfil: 'usuario' } });
            const admins = await Servidor.count({ where: { cidade_lotacao_id: c.id, perfil: 'admin' } });

            console.log(
                String(c.id).padEnd(4),
                String(c.nome).substring(0, 29).padEnd(30),
                String(c.efetivo_atual).padEnd(10),
                String(total).padEnd(10),
                String(users).padEnd(10),
                String(admins).padEnd(10)
            );
        }
        console.log('------------------------------');
        process.exit(0);
    } catch (error) {
        console.error('Erro no diagnóstico:', error);
        process.exit(1);
    }
}

diagnose();
