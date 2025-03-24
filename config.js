module.exports = {
    // Configurações de URL
    URLS: {
        API_BASE: process.env.API_BASE || 'https://verificador1-git-main-lucio-dev-s-projects.vercel.app',
        WS_BASE: process.env.WS_BASE || 'wss://verificador1-git-main-lucio-dev-s-projects.vercel.app'
    },

    // Configurações de timeout
    TIMEOUT: {
        REGISTRO_BR: 3000,    // 3 segundos para registro.br
        WHOIS: 5000,         // 5 segundos para whois
        DNS: 2000            // 2 segundos para DNS
    },

    // Configurações de retry
    RETRY: {
        MAX_ATTEMPTS: 3,     // Número máximo de tentativas
        DELAY: 1000,        // Delay entre tentativas (1 segundo)
        BACKOFF: 1.5        // Fator de multiplicação do delay a cada retry
    },

    // Configurações de cache
    CACHE: {
        TTL: 300000,        // Tempo de vida do cache (5 minutos)
        MAX_SIZE: 1000      // Máximo de itens no cache
    },

    // Configurações de concorrência
    CONCURRENCY: {
        MAX_PARALLEL: 10,   // Máximo de verificações simultâneas
        BATCH_SIZE: 5       // Tamanho do lote de processamento
    },

    // Servidores DNS para verificação
    DNS_SERVERS: [
        '8.8.8.8',         // Google
        '1.1.1.1',         // Cloudflare
        '208.67.222.222'   // OpenDNS
    ],

    // Configurações de confiança
    CONFIDENCE: {
        MIN_SOURCES: 2,     // Mínimo de fontes que precisam concordar
        WEIGHT: {
            REGISTRO_BR: 0.5,
            WHOIS: 0.3,
            DNS: 0.2
        }
    }
};