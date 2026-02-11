require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { sequelize } = require('./src/models');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Segurança ──────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        "https://unpkg.com",
        "https://cdn.jsdelivr.net"
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://unpkg.com",
        "https://cdn.jsdelivr.net",
        "https://fonts.googleapis.com",
        "https://fonts.bunny.net"
      ],
      fontSrc: [
        "'self'",
        "https://cdn.jsdelivr.net",
        "https://fonts.gstatic.com",
        "https://fonts.bunny.net"
      ],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://cdn.jsdelivr.net"]
    }
  }
}));

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting global
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' }
});
app.use('/api/', limiter);

// Rate limiting mais restrito para auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: 'Muitas tentativas de login. Aguarde 15 minutos.' }
});
app.use('/api/auth/login', authLimiter);

// ── Arquivos estáticos ─────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Rotas da API ───────────────────────────────────────────
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/cidades', require('./src/routes/cidades'));
app.use('/api/servidores', require('./src/routes/servidores'));
app.use('/api/processamento', require('./src/routes/processamento'));

// ── SPA fallback ───────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Error handler global ───────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[ERRO]', err.message);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Erro interno do servidor'
      : err.message
  });
});

// ── Inicialização ──────────────────────────────────────────
async function start() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexão com MySQL estabelecida.');

    // Sincroniza tabelas (alter em dev, nada em prod)
    const syncOptions = process.env.NODE_ENV === 'production'
      ? {}
      : { alter: true };
    await sequelize.sync(syncOptions);
    console.log('✅ Tabelas sincronizadas.');

    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Falha ao iniciar:', err.message);
    process.exit(1);
  }
}

start();
