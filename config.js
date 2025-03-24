module.exports = {
    // URLs base para as APIs
    URLS: {
        API_BASE: 'https://registro.br/tecnologia/ferramentas/consulta-whois/',
        WHOIS_API: 'https://registro.br/tecnologia/ferramentas/consulta-whois/',
        DNS_API: 'https://dns.google/resolve'
    },

    // Timeouts para diferentes serviços
    TIMEOUT: {
        REGISTRO_BR: 3000,  // 3 segundos para registro.br
        WHOIS: 5000,        // 5 segundos para whois
        DNS: 2000           // 2 segundos para DNS
    },

    // Configurações de retry
    RETRY: {
        MAX_ATTEMPTS: 3,    // Número máximo de tentativas
        DELAY: 1000,        // Delay entre tentativas (1 segundo)
        BACKOFF_FACTOR: 2   // Fator de backoff exponencial
    },

    // Configurações de cache
    CACHE: {
        TTL: 3600,          // Tempo de vida do cache (1 hora)
        MAX_SIZE: 1000      // Tamanho máximo do cache (1000 itens)
    },

    // Configurações de concorrência
    CONCURRENCY: {
        MAX_PARALLEL: 10,   // Número máximo de verificações paralelas
        BATCH_SIZE: 50      // Tamanho do lote para processamento
    },

    // Servidores DNS para verificação
    DNS_SERVERS: [
        '8.8.8.8',         // Google DNS
        '1.1.1.1',         // Cloudflare DNS
        '208.67.222.222'   // OpenDNS
    ],

    // Configurações de confiança
    CONFIDENCE: {
        MIN_SOURCES: 2,     // Número mínimo de fontes para confiança
        WEIGHTS: {
            REGISTRO_BR: 1.0,
            WHOIS: 0.8,
            DNS: 0.6
        }
    }
};