const test = require('node:test');
const assert = require('node:assert/strict');

const {
    applyShoukakuCompat,
    buildVoicePayload,
    getMissingVoiceFields,
    isUpstreamSafeVoicePayload
} = require('../src/music/compat');
const { normalizeVoiceEndpoint } = require('../src/utils');

function createPlayerClass(upstreamCalls) {
    return class TestPlayer {
        constructor(guildId, rest, manager) {
            this.guildId = guildId;
            this.node = { rest, manager };
        }

        async sendServerUpdate(connection) {
            upstreamCalls.push(connection);
            await this.node.rest.updatePlayer({
                guildId: this.guildId,
                playerOptions: {
                    voice: {
                        token: connection.serverUpdate.token,
                        endpoint: connection.serverUpdate.endpoint,
                        sessionId: connection.sessionId,
                        channelId: connection.channelId
                    }
                }
            });
        }
    };
}

function applyCompat(PlayerClass, rawCalls = []) {
    const kazagumo = {
        shoukaku: {
            connector: {
                raw(packet) {
                    rawCalls.push(packet);
                }
            }
        }
    };

    applyShoukakuCompat({
        kazagumo,
        PlayerClass,
        normalizeVoiceEndpoint,
        isPlayerUpdateBadRequest: error => error?.status === 400
    });

    return kazagumo;
}

test('buildVoicePayload includes channelId and normalizes endpoint', () => {
    const connection = {
        serverUpdate: { token: 'token-1', endpoint: 'wss://voice.example/' },
        sessionId: 'session-1',
        channelId: 'voice-1'
    };

    const payload = buildVoicePayload({ guildId: 'guild-1' }, connection, normalizeVoiceEndpoint);

    assert.deepEqual(payload, {
        token: 'token-1',
        endpoint: 'voice.example',
        sessionId: 'session-1',
        channelId: 'voice-1'
    });
    assert.deepEqual(getMissingVoiceFields(payload), []);
    assert.equal(isUpstreamSafeVoicePayload(connection, payload), false);
});

test('compat prefers upstream sendServerUpdate when voice payload is already safe', async () => {
    const upstreamCalls = [];
    const updates = [];
    const PlayerClass = createPlayerClass(upstreamCalls);
    applyCompat(PlayerClass);

    const connection = {
        serverUpdate: { token: 'token-1', endpoint: 'voice.example' },
        sessionId: 'session-1',
        channelId: 'voice-1'
    };
    const player = new PlayerClass('guild-1', {
        updatePlayer: async payload => updates.push(payload)
    }, { connections: new Map([['guild-1', connection]]) });

    await player.sendServerUpdate(connection);

    assert.equal(upstreamCalls.length, 1);
    assert.deepEqual(updates[0].playerOptions.voice, {
        token: 'token-1',
        endpoint: 'voice.example',
        sessionId: 'session-1',
        channelId: 'voice-1'
    });
});

test('compat fallback uses lastChannelId for missing upstream channelId', async () => {
    const upstreamCalls = [];
    const updates = [];
    const PlayerClass = createPlayerClass(upstreamCalls);
    applyCompat(PlayerClass);

    const connection = {
        serverUpdate: { token: 'token-1', endpoint: 'voice.example' },
        sessionId: 'session-1',
        channelId: null,
        lastChannelId: 'voice-previous'
    };
    const player = new PlayerClass('guild-1', {
        updatePlayer: async payload => updates.push(payload)
    }, { connections: new Map([['guild-1', connection]]) });

    await player.sendServerUpdate(connection);

    assert.equal(upstreamCalls.length, 0);
    assert.deepEqual(updates[0].playerOptions.voice, {
        token: 'token-1',
        endpoint: 'voice.example',
        sessionId: 'session-1',
        channelId: 'voice-previous'
    });
});

test('compat reports incomplete voice state before sending fallback update', async () => {
    const upstreamCalls = [];
    const updates = [];
    const PlayerClass = createPlayerClass(upstreamCalls);
    applyCompat(PlayerClass);

    const connection = {
        serverUpdate: { token: 'token-1', endpoint: 'voice.example' },
        sessionId: null,
        channelId: 'voice-1'
    };
    const player = new PlayerClass('guild-1', {
        updatePlayer: async payload => updates.push(payload)
    }, { connections: new Map([['guild-1', connection]]) });

    await assert.rejects(
        () => player.sendServerUpdate(connection),
        /Missing: sessionId/
    );
    assert.equal(upstreamCalls.length, 0);
    assert.equal(updates.length, 0);
});

test('compat normalizes VOICE_SERVER_UPDATE endpoint before Shoukaku receives raw packet', () => {
    const upstreamCalls = [];
    const rawCalls = [];
    const PlayerClass = createPlayerClass(upstreamCalls);
    const kazagumo = applyCompat(PlayerClass, rawCalls);

    const packet = {
        t: 'VOICE_SERVER_UPDATE',
        d: { endpoint: 'https://voice.example/' }
    };

    kazagumo.shoukaku.connector.raw(packet);

    assert.equal(rawCalls[0].d.endpoint, 'voice.example');
});
