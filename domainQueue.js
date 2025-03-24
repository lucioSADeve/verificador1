const axios = require('axios');
const config = require('./config');

class DomainQueue {
    constructor() {
        this.queue = [];
        this.results = {
            available: [],
            processing: false,
            total: 0,
            processed: 0,
            errors: 0,
            currentDomain: null
        };
        this.concurrentChecks = config.CONCURRENCY.MAX_PARALLEL;
        this.batchSize = config.CONCURRENCY.BATCH_SIZE;
        this.cache = new Map();
    }

    addDomains(domains) {
        try {
            console.log('Adicionando domínios:', domains.length);
            this.queue = [...this.queue, ...domains];
            this.results.total += domains.length;
            
            if (!this.results.processing) {
                console.log('Iniciando processamento da fila');
                this.processQueue();
            }
        } catch (error) {
            console.error('Erro ao adicionar domínios:', error);
            this.results.errors++;
        }
    }

    async checkDomain(item, retryCount = 0) {
        if (this.cache.has(item.domain)) {
            return this.cache.get(item.domain);
        }

        try {
            this.results.currentDomain = item.domain;
            console.log(`Verificando domínio: ${item.domain}`);

            const response = await axios.get(`https://registro.br/v2/ajax/avail/raw/${item.domain}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Referer': 'https://registro.br/',
                    'Origin': 'https://registro.br'
                },
                timeout: config.TIMEOUT.REGISTRO_BR
            });

            const isAvailable = response.data && 
                (response.data.status === '0' || response.data.status === 0 || response.data.available === true);

            this.cache.set(item.domain, isAvailable);
            return isAvailable;
        } catch (error) {
            if (retryCount < config.RETRY.MAX_ATTEMPTS) {
                console.log(`Tentativa ${retryCount + 1} de ${config.RETRY.MAX_ATTEMPTS} para ${item.domain}`);
                await new Promise(resolve => setTimeout(resolve, config.RETRY.DELAY * Math.pow(config.RETRY.BACKOFF, retryCount)));
                return this.checkDomain(item, retryCount + 1);
            }
            console.error(`Erro ao verificar ${item.domain}:`, error.message);
            this.results.errors++;
            return false;
        }
    }

    async processQueue() {
        try {
            if (this.queue.length === 0) {
                console.log('Fila vazia, finalizando processamento');
                this.results.processing = false;
                this.results.currentDomain = null;
                return;
            }

            this.results.processing = true;

            // Processa em lotes
            for (let i = 0; i < this.queue.length; i += this.batchSize) {
                const batch = this.queue.splice(0, this.batchSize);
                console.log(`Processando lote de ${batch.length} domínios`);

                const batchPromises = batch.map((item, index) => 
                    new Promise(resolve => 
                        setTimeout(() => 
                            resolve(this.checkDomain(item)), 
                            index * 200
                        )
                    )
                );

                const results = await Promise.all(batchPromises);
                
                // Atualiza resultados
                results.forEach((isAvailable, index) => {
                    if (isAvailable) {
                        this.results.available.push(batch[index]);
                    }
                    this.results.processed++;
                });

                // Pausa entre lotes
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            this.results.processing = false;
            this.results.currentDomain = null;
            this.cache.clear();
        } catch (error) {
            console.error('Erro no processamento da fila:', error);
            this.results.processing = false;
            this.results.currentDomain = null;
        }
    }

    getResults() {
        return {
            ...this.results,
            queueLength: this.queue.length,
            cacheSize: this.cache.size
        };
    }

    clearResults() {
        this.queue = [];
        this.results = {
            available: [],
            processing: false,
            total: 0,
            processed: 0,
            errors: 0,
            currentDomain: null
        };
        this.cache.clear();
        console.log('DomainQueue: Cache e resultados limpos');
    }
}

module.exports = new DomainQueue();