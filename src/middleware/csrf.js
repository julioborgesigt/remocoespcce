const { doubleCsrf } = require('csrf-csrf');

const doubleCsrfOptions = {
    getSecret: () => process.env.CSRF_SECRET || 'secret-csrf-key-default',
    getSessionIdentifier: () => 'mock-session-id', // csrf-csrf requires this string as part of its integrity check
    cookieName: 'x-csrf-token',
    cookieOptions: {
        sameSite: 'lax', // Relaxed sameSite for better local testing compatibility
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        signed: false
    },
    size: 64,
    ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
    getTokenFromRequest: (req) => req.headers['x-csrf-token'],
};

const {
    doubleCsrfProtection,
    generateCsrfToken: generateToken // Destructure generateCsrfToken as generateToken
} = doubleCsrf(doubleCsrfOptions);

module.exports = {
    doubleCsrfProtection,
    generateToken
};
