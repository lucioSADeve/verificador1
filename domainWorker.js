const axios = require('axios');
const config = require('./config');
const pLimit = require('p-limit');

class DomainWorker {
    constructor() {
        this.queue = [];
        this.results = {
            available: [],
            unavailable: [],
            errors: [],
            processed: 0,
            total: 0
        };
        this.cache = new Map();
        this.limit = pLimit(config.CONCURRENCY.MAX_PARALLEL);
        this.isProcessing = false;
    }

    addDomains(domains) {
        // Filtra domínios duplicados e inválidos
        const uniqueDomains = [...new Set(domains.map(d => d.domain))];
        this.queue = uniqueDomains.map(domain => ({
            domain,
            originalData: domains.find(d => d.domain === domain)?.originalData || domain
        }));
        this.results.total = this.queue.length;
        this.results.processed = 0;
        this.results.available = [];
        this.results.unavailable = [];
        this.results.errors = [];
        this.startProcessing();
    }

    async checkDomain(domainData) {
        const { domain, originalData } = domainData;

        // Verifica cache primeiro
        if (this.cache.has(domain)) {
            const cachedResult = this.cache.get(domain);
            if (Date.now() - cachedResult.timestamp < config.CACHE.TTL * 1000) {
                return cachedResult.result;
            }
        }

        try {
            // Faz requisição para o registro.br
            const response = await axios.get(`${config.URLS.WHOIS_API}${domain}`, {
                timeout: config.TIMEOUT.WHOIS,
                validateStatus: status => status === 200
            });

            const isAvailable = response.data.includes('Status: free');

            // Atualiza cache
            this.cache.set(domain, {
                result: isAvailable,
                timestamp: Date.now()
            });

            return isAvailable;
        } catch (error) {
            console.error(`Erro ao verificar domínio ${domain}:`, error.message);
            throw error;
        }
    }

    async processQueue() {
        if (this.isProcessing || this.queue.length === 0) return;

        this.isProcessing = true;
        const batchSize = config.CONCURRENCY.BATCH_SIZE;

        while (this.queue.length > 0) {
            const batch = this.queue.splice(0, batchSize);
            const promises = batch.map(domainData => 
                this.limit(async () => {
                    try {
                        const isAvailable = await this.checkDomain(domainData);
                        if (isAvailable) {
                            this.results.available.push(domainData);
                        } else {
                            this.results.unavailable.push(domainData);
                        }
                    } catch (error) {
                        this.results.errors.push({
                            domain: domainData.domain,
                            message: error.message
                        });
                    } finally {
                        this.results.processed++;
                    }
                })
            );

            await Promise.all(promises);
        }

        this.isProcessing = false;
    }

    startProcessing() {
        if (!this.isProcessing) {
            this.processQueue();
        }
    }

    getResults() {
        return {
            ...this.results,
            cache: {
                size: this.cache.size,
                maxSize: config.CACHE.MAX_SIZE
            }
        };
    }

    clearResults() {
        this.queue = [];
        this.results = {
            available: [],
            unavailable: [],
            errors: [],
            processed: 0,
            total: 0
        };
        this.cache.clear();
        this.isProcessing = false;
    }
}

module.exports = new DomainWorker(); 