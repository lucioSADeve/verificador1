require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');
const axios = require('axios');
const { Worker } = require('worker_threads');
const path = require('path');
const WebSocket = require('ws');
const config = require('./config');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const port = process.env.PORT || 3000;

// Configurações básicas
app.use(cors({
    origin: [
        'https://verificador1.vercel.app',
        'http://localhost:3000',
        'https://verificador1-ks959qzxd-lucio-dev-s-projects.vercel.app',
        'https://verificador1-git-main-lucio-dev-s-projects.vercel.app'
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true
}));

// Middleware para logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    console.log('Headers:', req.headers);
    next();
});

// Middleware para tratamento de erros
app.use((err, req, res, next) => {
    console.error('Erro:', err);
    console.error('Stack:', err.stack);
    res.status(500).json({ 
        error: 'Erro interno do servidor',
        message: err.message
    });
});

// Middleware para verificar origem da requisição
app.use((req, res, next) => {
    const origin = req.headers.origin;
    console.log('Origem da requisição:', origin);
    next();
});

app.use(express.json());
app.use(express.static('public'));

// Armazena as conexões WebSocket ativas
const clients = new Set();

// Função para verificar DA do domínio
async function checkDomain(domain) {
    try {
        const accessId = 'mozscape-L4CG6PRKJ0';
        const secretKey = 'tvrA6SPh3bACf8US6xIF9tlGVy6GZNrY';
        const auth = Buffer.from(`${accessId}:${secretKey}`).toString('base64');

        const response = await axios({
            method: 'post',
            url: 'https://lsapi.seomoz.com/v2/url_metrics',
            headers: { 
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            },
            data: {
                targets: [domain]
            }
        });

        return response.data.results[0]?.domain_authority || 0;
    } catch (error) {
        console.error(`Erro ao verificar ${domain}:`, error.message);
        return 0;
    }
}

// Função para enviar atualizações para todos os clientes
function broadcastToClients(data) {
    for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    }
}

// Rota principal para verificação de domínios
app.post('/api/check', async (req, res) => {
    const { domains } = req.body;
    
    if (!Array.isArray(domains) || domains.length === 0) {
        return res.status(400).json({ error: 'Lista de domínios inválida' });
    }

    // Cria um ID único para esta verificação
    const checkId = Date.now().toString();

    try {
        // Cria um novo worker para processar os domínios
        const worker = new Worker('./domainWorker.js');

        // Configura os listeners do worker
        worker.on('message', (message) => {
            switch (message.type) {
                case 'progress':
                    // Envia atualização de progresso via WebSocket
                    broadcastToClients({
                        type: 'progress',
                        checkId,
                        ...message
                    });
                    break;

                case 'complete':
                    // Envia resultados finais via WebSocket
                    broadcastToClients({
                        type: 'complete',
                        checkId,
                        results: message.results
                    });
                    worker.terminate();
                    break;

                case 'error':
                    // Envia erro via WebSocket
                    broadcastToClients({
                        type: 'error',
                        checkId,
                        error: message.error
                    });
                    worker.terminate();
                    break;
            }
        });

        // Inicia o processamento
        worker.postMessage({ domains });

        // Retorna imediatamente com o ID da verificação
        res.json({ 
            checkId,
            message: 'Verificação iniciada'
        });
    } catch (error) {
        console.error('Erro ao iniciar verificação:', error);
        res.status(500).json({ 
            error: 'Erro interno ao processar domínios'
        });
    }
});

// Rota para upload de arquivo Excel
app.post('/api/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo foi enviado' });
    }

    try {
        // Lê o arquivo Excel
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        
        // Converte para JSON
        const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 'A' });
        
        // Extrai os domínios da coluna B, mantendo os dados da coluna A
        const domainsData = rows.map(row => ({
            originalData: row.A || '',  // Dados da coluna A
            domain: row.B || ''        // Domínio da coluna B
        })).filter(item => item.domain); // Remove linhas sem domínio

        if (domainsData.length === 0) {
            return res.status(400).json({ error: 'Nenhum domínio encontrado na coluna B' });
        }

        // Cria um ID único para esta verificação
        const checkId = Date.now().toString();

        try {
            // Cria um novo worker para processar os domínios
            const worker = new Worker('./domainWorker.js');

            // Configura os listeners do worker
            worker.on('message', (message) => {
                switch (message.type) {
                    case 'progress':
                        // Adiciona os dados originais ao progresso
                        const progressData = {
                            ...message,
                            originalData: domainsData[message.currentIndex]?.originalData
                        };
                        broadcastToClients({
                            type: 'progress',
                            checkId,
                            ...progressData
                        });
                        break;

                    case 'complete':
                        // Adiciona os dados originais aos resultados
                        const resultsWithOriginalData = message.results.map((result, index) => ({
                            ...result,
                            originalData: domainsData[index]?.originalData
                        }));
                        broadcastToClients({
                            type: 'complete',
                            checkId,
                            results: resultsWithOriginalData
                        });
                        worker.terminate();
                        break;

                    case 'error':
                        broadcastToClients({
                            type: 'error',
                            checkId,
                            error: message.error
                        });
                        worker.terminate();
                        break;
                }
            });

            // Inicia o processamento apenas com os domínios
            worker.postMessage({ 
                domains: domainsData.map(item => item.domain)
            });

            // Retorna imediatamente com o ID da verificação
            res.json({ 
                checkId,
                message: 'Verificação iniciada',
                totalDomains: domainsData.length
            });

        } catch (error) {
            console.error('Erro ao iniciar verificação:', error);
            res.status(500).json({ 
                error: 'Erro interno ao processar domínios'
            });
        }

    } catch (error) {
        console.error('Erro ao processar arquivo Excel:', error);
        res.status(500).json({ 
            error: 'Erro ao processar arquivo Excel'
        });
    }
});

// Rota para servir a página principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Inicia o servidor HTTP
const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor rodando na porta ${port}`);
});

// Configura o WebSocket Server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    // Adiciona nova conexão ao conjunto de clientes
    clients.add(ws);
    console.log('Nova conexão WebSocket estabelecida');

    // Remove conexão quando fechada
    ws.on('close', () => {
        clients.delete(ws);
        console.log('Conexão WebSocket fechada');
    });

    // Tratamento de erros da conexão
    ws.on('error', (error) => {
        console.error('Erro na conexão WebSocket:', error);
        clients.delete(ws);
    });
});

module.exports = app;