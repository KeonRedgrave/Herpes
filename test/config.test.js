const test = require('node:test');
const assert = require('node:assert/strict');

const { loadConfig } = require('../src/config');

test('loadConfig validates required environment values', () => {
    assert.throws(() => loadConfig({}), /DISCORD_TOKEN is required/);
});

test('loadConfig parses booleans and numbers', () => {
    const config = loadConfig({
        DISCORD_TOKEN: 'token',
        LAVALINK_HOST: 'localhost:2333',
        LAVALINK_PASSWORD: 'secret',
        LAVALINK_SECURE: 'true',
        PORT: '3000'
    });

    assert.equal(config.discordToken, 'token');
    assert.equal(config.lavalink.secure, true);
    assert.equal(config.port, 3000);
    assert.equal(config.readyTimeoutMs, 15000);
});

test('loadConfig combines LAVALINK_HOST and LAVALINK_PORT when provided separately', () => {
    const config = loadConfig({
        DISCORD_TOKEN: 'token',
        LAVALINK_HOST: 'lavalinkv4.serenetia.com',
        LAVALINK_PORT: '443',
        LAVALINK_PASSWORD: 'secret',
        LAVALINK_SECURE: 'true'
    });

    assert.equal(config.lavalink.url, 'lavalinkv4.serenetia.com:443');
    assert.equal(config.lavalink.secure, true);
});
