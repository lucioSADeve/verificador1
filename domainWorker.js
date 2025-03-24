const { parentPort } = require('worker_threads');
const pLimit = require('p-limit');
const fetch = require('node-fetch');

// Configurações otimizadas
const CONCURRENT_LIMIT = 3; // Reduzido para 3 verificações simultâneas
const BATCH_SIZE = 2;       // Reduzido para 2 domínios por lote
const FETCH_TIMEOUT = 10000; // Aumentado para 10 segundos
const RETRY_DELAY = 3000;   // 3 segundos entre tentativas
const MAX_RETRIES = 3;      // Máximo de 3 tentativas

// Cache otimizado
const resultsCache = new Map();

// Função otimizada para verificar domínio com retry
async function checkDomain(domain, retryCount = 0) {
    if (resultsCache.has(domain)) {
        return resultsCache.get(domain);
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

        const response = await fetch(`https://registro.br/v2/ajax/whois/${domain}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            signal: controller.signal,
            timeout: FETCH_TIMEOUT
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Erro HTTP! status: ${response.status}`);
        }

        const data = await response.json();
        const isAvailable = data.status === 'AVAILABLE';
        resultsCache.set(domain, isAvailable);
        return isAvailable;
    } catch (error) {
        if (retryCount < MAX_RETRIES) {
            console.log(`Tentativa ${retryCount + 1} de ${MAX_RETRIES} para ${domain}`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            return checkDomain(domain, retryCount + 1);
        }
        console.error(`Erro ao verificar ${domain}:`, error.message);
        return false;
    }
}

// Processamento otimizado em lotes
async function processDomainsParallel(domains) {
    const limit = pLimit(CONCURRENT_LIMIT);
    const results = [];
    let processed = 0;
    let available = 0;
    let errors = 0;
    
    // Processa em lotes pequenos
    for (let i = 0; i < domains.length; i += BATCH_SIZE) {
        const batch = domains.slice(i, i + BATCH_SIZE);
        
        const batchPromises = batch.map(domain => 
            limit(async () => {
                try {
                    const isAvailable = await checkDomain(domain);
                    processed++;
                    if (isAvailable) available++;
                    
                    // Reporta progresso para cada domínio
                    parentPort.postMessage({
                        type: 'progress',
                        currentIndex: i + batch.indexOf(domain),
                        processed,
                        total: domains.length,
                        available,
                        errors,
                        currentDomain: domain
                    });

                    return {
                        domain,
                        available: isAvailable,
                        error: false
                    };
                } catch (error) {
                    processed++;
                    errors++;
                    return {
                        domain,
                        available: false,
                        error: true,
                        errorMessage: error.message
                    };
                }
            })
        );

        // Processa lote atual
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Pausa maior entre lotes para evitar sobrecarga
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return results;
}

// Listener de mensagens
parentPort.on('message', async ({ domains }) => {
    try {
        console.time('processamento');
        const results = await processDomainsParallel(domains);
        console.timeEnd('processamento');
        
        resultsCache.clear();
        
        parentPort.postMessage({ 
            type: 'complete', 
            results,
            summary: {
                total: domains.length,
                processed: results.length,
                available: results.filter(r => r.available).length,
                errors: results.filter(r => r.error).length,
                time: console.timeEnd('processamento')
            }
        });
    } catch (error) {
        console.error('Erro fatal:', error);
        parentPort.postMessage({ 
            type: 'error', 
            error: error.message || 'Erro no processamento'
        });
    }
});

// Tratamento de erros global
process.on('unhandledRejection', (error) => {
    console.error('Erro não tratado:', error);
    parentPort.postMessage({ 
        type: 'error', 
        error: 'Erro interno no processamento'
    });
}); 