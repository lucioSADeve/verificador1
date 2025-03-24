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
const domainQueue = require('./domainQueue');

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

// Rota para verificar progresso
app.get('/api/progress', (req, res) => {
    const results = domainQueue.getResults();
    res.json(results);
});

// Rota para limpar cache
app.post('/api/clear-cache', (req, res) => {
    domainQueue.clearResults();
    res.json({ message: 'Cache limpo com sucesso' });
});

// Rota para download dos resultados
app.get('/api/download-results', (req, res) => {
    const results = domainQueue.getResults();
    const availableDomains = results.available.map(item => item.domain).join('\n');
    
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename=dominios_disponiveis.txt');
    res.send(availableDomains);
});

// Rota para upload de arquivo Excel
app.post('/api/upload', upload.single('file'), async (req, res) => {
    console.log('Iniciando processamento de upload...');
    
    if (!req.file) {
        console.error('Nenhum arquivo recebido');
        return res.status(400).json({ error: 'Nenhum arquivo foi enviado' });
    }

    console.log('Arquivo recebido:', {
        nome: req.file.originalname,
        tipo: req.file.mimetype,
        tamanho: req.file.size
    });

    try {
        // Verifica o tipo do arquivo
        if (!req.file.mimetype.includes('spreadsheet') && !req.file.mimetype.includes('excel')) {
            console.error('Tipo de arquivo inválido:', req.file.mimetype);
            return res.status(400).json({ 
                error: 'Arquivo inválido. Por favor, envie um arquivo Excel (.xlsx ou .xls)',
                tipo: req.file.mimetype 
            });
        }

        // Verifica o tamanho do arquivo (máximo 10MB)
        if (req.file.size > 10 * 1024 * 1024) {
            console.error('Arquivo muito grande:', req.file.size);
            return res.status(400).json({ 
                error: 'Arquivo muito grande. O tamanho máximo permitido é 10MB.',
                tamanho: req.file.size
            });
        }

        // Lê o arquivo Excel
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        
        if (!workbook.SheetNames.length) {
            console.error('Arquivo Excel vazio');
            return res.status(400).json({ error: 'O arquivo Excel está vazio' });
        }

        console.log('Planilhas encontradas:', workbook.SheetNames);
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        
        try {
            console.log('Convertendo dados da planilha...');
            const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 'A' });
            console.log('Total de linhas encontradas:', rows.length);
            
            // Extrai os domínios da coluna B, mantendo os dados da coluna A
            const domainsData = rows.map(row => ({
                originalData: row.A || '',
                domain: (row.B || '').toString().trim().toLowerCase()
            })).filter(item => {
                // Validação mais rigorosa do domínio
                const domain = item.domain;
                const isValid = domain && 
                       domain.length > 0 && 
                       domain.length <= 253 && 
                       /^[a-z0-9][a-z0-9-]{0,61}[a-z0-9](?:\.[a-z]{2,})+$/.test(domain);
                
                if (!isValid && domain) {
                    console.log('Domínio inválido encontrado:', domain);
                }
                return isValid;
            });

            console.log('Total de domínios válidos encontrados:', domainsData.length);

            if (domainsData.length === 0) {
                return res.status(400).json({ 
                    error: 'Nenhum domínio válido encontrado na coluna B. Verifique o formato dos domínios.',
                    totalLinhas: rows.length
                });
            }

            // Adiciona os domínios à fila de processamento
            domainQueue.addDomains(domainsData);

            // Retorna imediatamente com o ID da verificação
            return res.json({ 
                message: `${domainsData.length} domínios únicos adicionados à fila`,
                totalDomains: domainsData.length
            });

        } catch (error) {
            console.error('Erro ao processar dados da planilha:', error);
            return res.status(500).json({ 
                error: 'Erro ao processar dados da planilha',
                detalhes: error.message
            });
        }

    } catch (error) {
        console.error('Erro geral no upload:', error);
        return res.status(500).json({ 
            error: 'Erro no processamento do arquivo',
            detalhes: error.message
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