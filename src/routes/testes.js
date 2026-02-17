const router = require('express').Router();
const { autenticar, apenasAdmin } = require('../middleware/auth');
const { spawn } = require('child_process');
const path = require('path');

// POST /api/testes/setup
// Executa o teste em um processo isolado para garantir segurança do banco principal
router.post('/setup', autenticar, apenasAdmin, async (req, res) => {
    const { cenario, setupOnly } = req.body;

    if (!cenario) {
        return res.status(400).json({ error: 'Cenário não informado.' });
    }

    const scriptPath = path.join(__dirname, '../scripts/testRunner.js');
    const args = [scriptPath, cenario];
    if (setupOnly) args.push('--setup-only');

    // Executar como filho, forçando as variáveis de ambiente corretas
    const runner = spawn('node', args, {
        env: {
            ...process.env,
            DB_NAME: 'remocoespcce_teste',
            DB_DIALECT: 'mysql',
            NODE_ENV: 'test',
            DB_LOGGING: 'true'
        }
    });

    let stdoutData = '';
    let stderrData = '';

    runner.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(`[Runner STDOUT]: ${output}`);
        stdoutData += output;
    });

    runner.stderr.on('data', (data) => {
        const output = data.toString();
        console.error(`[Runner STDERR]: ${output}`);
        stderrData += output;
    });

    runner.on('close', (code) => {
        if (code !== 0) {
            console.error(`Runner falhou com código ${code}`);
            return res.status(500).json({
                error: 'Falha na execução do teste isolado.',
                detalhes: stderrData
            });
        }

        try {
            // Tenta encontrar o JSON no meio do output (pode haver logs antes)
            // O runner imprime JSON no final. Vamos pegar a última linha válida?
            // Melhor: O runner deve garantir que o JSON é a única coisa no stdout ou usamos um marcador?
            // Como habilitamos logs de SQL no stdout, o JSON está misturado.
            // Vamos tentar achar a última linha que parece JSON.
            const lines = stdoutData.trim().split('\n');
            let response = null;

            // Procura de trás pra frente por um JSON válido
            for (let i = lines.length - 1; i >= 0; i--) {
                try {
                    const line = lines[i].trim();
                    if (line.startsWith('{') && line.endsWith('}')) {
                        response = JSON.parse(line);
                        if (response.sucesso !== undefined) break; // Achamos nosso JSON
                    }
                } catch (e) {
                    // Ignore
                }
            }

            if (!response) {
                throw new Error('JSON de resposta não encontrado no output do runner.');
            }

            res.json({
                success: true,
                mensagem: response.mensagemSetup,
                resultadoExecucao: response.resultado,
                dadosIniciais: response.dadosIniciais // Passa o estado inicial para o front
            });

        } catch (e) {
            console.error('Erro ao processar resposta do runner:', e);
            res.status(500).json({ error: 'Erro ao processar resposta do teste.', rawOutput: stdoutData });
        }
    });
});

module.exports = router;
