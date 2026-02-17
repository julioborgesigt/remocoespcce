const { Sequelize } = require('sequelize');

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  dialect: process.env.DB_DIALECT || 'mysql',
  storage: process.env.DB_STORAGE || undefined, // Para SQLite
  logging: process.env.DB_LOGGING === 'true' ? console.log : (process.env.NODE_ENV === 'development' ? console.log : false),
  define: {
    timestamps: true,
    underscored: true,
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci'
  },
  pool: {
    max: 10,
    min: 2,
    acquire: 30000,
    idle: 10000
  }
};

// SQLite não suporta timezone customizado
if (config.dialect !== 'sqlite') {
  config.timezone = '-03:00';
}

const sequelize = new Sequelize(
  process.env.DB_NAME || 'remocao_servidores',
  process.env.DB_USER || 'root',
  process.env.DB_PASS || '',
  config
);

module.exports = sequelize;
