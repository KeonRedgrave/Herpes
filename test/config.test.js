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
