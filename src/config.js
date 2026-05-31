const path = require('node:path');

require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

function readBoolean(value, defaultValue = false) {
    if (value === undefined || value === null || value === '') return defaultValue;
    return String(value).toLowerCase() === 'true';
}

function normalizeLavalinkHost(rawHost) {
    if (!rawHost) return { host: '', secureFromUrl: false };

    let host = String(rawHost).trim();
    let secureFromUrl = false;

    if (/^https?:\/\//i.test(host)) {
        try {
            const parsed = new URL(host);
            host = parsed.host;
            secureFromUrl = parsed.protocol === 'https:';
        } catch {
            host = host.replace(/^https?:\/\//i, '');
        }
    }

    host = host.replace(/\/+$/, '');
    return { host, secureFromUrl };
}

function loadConfig(env = process.env) {
    const { host: rawHost, secureFromUrl } = normalizeLavalinkHost(env.LAVALINK_HOST || 'localhost');
    const explicitPort = env.LAVALINK_PORT ? Number(env.LAVALINK_PORT) : null;
    const portSuffix = explicitPort && Number.isFinite(explicitPort) ? `:${explicitPort}` : '';
    const normalizedHost = rawHost.includes(':') ? rawHost : `${rawHost}${portSuffix}`;

    const config = {
        discordToken: env.DISCORD_TOKEN,
        lavalink: {
            name: 'Lavalink',
            url: normalizedHost || 'localhost:2333',
            auth: env.LAVALINK_PASSWORD || 'youshallnotpass',
            secure: env.LAVALINK_SECURE !== undefined
                ? readBoolean(env.LAVALINK_SECURE, false)
                : secureFromUrl
        },
        port: env.PORT ? Number(env.PORT) : null,
        interactionDeleteMs: 5000,
        statusDeleteMs: 10000,
        playerUpdateMs: 10000,
        readyTimeoutMs: 15000,
        maxResumeAttempts: 3
    };

    const errors = [];

    if (!config.discordToken) errors.push('DISCORD_TOKEN is required.');
    if (!config.lavalink.url) errors.push('LAVALINK_HOST is required.');
    if (!config.lavalink.auth) errors.push('LAVALINK_PASSWORD is required.');
    if (config.port !== null && (!Number.isFinite(config.port) || config.port <= 0)) {
        errors.push('PORT must be a positive number when provided.');
    }

    if (errors.length > 0) {
        const error = new Error(`Invalid environment configuration:\n- ${errors.join('\n- ')}`);
        error.name = 'ConfigError';
        throw error;
    }

    return config;
}

module.exports = {
    loadConfig
};
