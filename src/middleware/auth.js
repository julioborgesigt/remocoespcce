const jwt = require('jsonwebtoken');
const { Servidor } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET não definido. Defina a variável de ambiente JWT_SECRET.');
  process.exit(1);
}

/**
 * Middleware: exige token JWT válido
 */
function autenticar(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido.' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.usuario = payload; // { id, matricula, perfil }
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}

/**
 * Middleware: exige perfil administrador
 */
function apenasAdmin(req, res, next) {
  if (req.usuario?.perfil !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }
  next();
}

/**
 * Gera token JWT para um servidor
 */
function gerarToken(servidor) {
  return jwt.sign(
    {
      id: servidor.id,
      matricula: servidor.matricula,
      perfil: servidor.perfil
    },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

module.exports = { autenticar, apenasAdmin, gerarToken };
