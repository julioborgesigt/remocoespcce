require('dotenv').config();
const { sequelize } = require('../models');

async function updateDb() {
    try {
        await sequelize.authenticate();
        console.log('Authenticating...');

        // Use alter: true to add new columns
        await sequelize.sync({ alter: true });

        console.log('✅ Database schema updated successfully.');
    } catch (err) {
        console.error('❌ Error updating database:', err);
    } finally {
        await sequelize.close();
    }
}

updateDb();
