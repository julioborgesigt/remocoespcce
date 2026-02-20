const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const path = require('path');

const indexHtmlPath = path.join(__dirname, 'public', 'index.html');
let htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');

const regex = /<script\s+src="([^"]+)"/g;
const cssRegex = /<link\s+href="([^"]+)"\s+rel="stylesheet"/g;

let match;
const urls = [];

// Encontra URLs de scripts
while ((match = regex.exec(htmlContent)) !== null) {
    if (match[1].startsWith('http')) {
        urls.push({ url: match[1], type: 'script' });
    }
}

// Encontra URLs de links css
while ((match = cssRegex.exec(htmlContent)) !== null) {
    if (match[1].startsWith('http') && !match[1].includes('fonts.bunny.net')) {
        urls.push({ url: match[1], type: 'css' });
    }
}

async function generateSRI(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                return reject(new Error(`Failed to fetch ${url}: ${res.statusCode}`));
            }
            const hash = crypto.createHash('sha384');
            res.on('data', chunk => hash.update(chunk));
            res.on('end', () => resolve(`sha384-${hash.digest('base64')}`));
            res.on('error', reject);
        }).on('error', reject);
    });
}

async function main() {
    for (const item of urls) {
        try {
            console.log('Gerando SRI para:', item.url);
            const sri = await generateSRI(item.url);

            // Substituir na string HTML
            if (item.type === 'script') {
                const target = `<script src="${item.url}"></script>`;
                const replace = `<script src="${item.url}" integrity="${sri}" crossorigin="anonymous"></script>`;
                htmlContent = htmlContent.replace(target, replace);
            } else if (item.type === 'css') {
                const target = `<link href="${item.url}" rel="stylesheet" />`;
                const replace = `<link href="${item.url}" rel="stylesheet" integrity="${sri}" crossorigin="anonymous" />`;
                htmlContent = htmlContent.replace(target, replace);
            }
        } catch (e) {
            console.error(e.message);
        }
    }

    fs.writeFileSync(indexHtmlPath, htmlContent, 'utf8');
    console.log('SRI aplicado com sucesso no index.html!');
}

main();
