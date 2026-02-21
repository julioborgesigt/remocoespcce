require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const cookieParser = require('cookie-parser');
const { sequelize } = require('./src/models');
const { doubleCsrfProtection, generateToken } = require('./src/middleware/csrf');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Segurança ──────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://*.kaspersky-labs.com"],
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
        "data:",
        "https:",
        "https://cdn.jsdelivr.net",
        "https://fonts.gstatic.com",
        "https://fonts.bunny.net"
      ],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: [
        "'self'",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com",
        "ws://localhost:3000", // For development hot reload if needed
        "https://*.kaspersky-labs.com",
        "wss://*.kaspersky-labs.com"
      ]
    }
  }
}));

const corsOptions = {
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : (process.env.NODE_ENV === 'production' ? false : true),
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
const csrfSecret = process.env.CSRF_SECRET || 'secret-csrf-key-default';
app.use(cookieParser(csrfSecret));

// Fallback preventivo caso o cliente não envie nenhum cookie e o parser não crie os objetos
app.use((req, res, next) => {
  req.cookies = req.cookies || {};
  req.signedCookies = req.signedCookies || {};
  next();
});

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
app.use(express.static(path.join(__dirname, 'public', 'dist')));
app.use(express.static(path.join(__dirname, 'public')));

// ── Health check ─────────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', message: 'Banco de dados indisponível.' });
  }
});

// ── Rota para obtenção do Token CSRF ───────────────────────
app.get('/api/csrf-token', (req, res) => {
  const token = generateToken(req, res);
  res.json({ csrfToken: token });
});

// ── Rotas da API (Protegidas contra CSRF) ──────────────────
app.use('/api/', (req, res, next) => {
  // Ignora rotas GET que não requerem proteção e a própria rota de obtenção do token
  if (req.method === 'GET' || req.path === '/csrf-token' || req.path === '/health') {
    return next();
  }
  doubleCsrfProtection(req, res, next);
});

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/cidades', require('./src/routes/cidades'));
app.use('/api/servidores', require('./src/routes/servidores'));
app.use('/api/processamento', require('./src/routes/processamento'));
app.use('/api/config', require('./src/routes/config'));
app.use('/api/testes', require('./src/routes/testes'));
app.use('/api/ranking', require('./src/routes/ranking'));

// ── SPA fallback ───────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dist', 'index.html'));
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

    // A partir daqui, as alterações de schema devem ser feitas por Migrations
    // sequelize.sync() desabilitado em favor do sequelize-cli
    console.log('✅ Validação do banco concluída. As tabelas devem estar criadas via migrações.');

    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Falha ao iniciar:', err.message);
    process.exit(1);
  }
}

start();
