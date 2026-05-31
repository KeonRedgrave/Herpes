const { wait } = require('../utils');

function getConnection(player, connection) {
    return connection || player.node?.manager?.connections?.get?.(player.guildId) || null;
}

function buildVoicePayload(player, connection, normalizeVoiceEndpoint) {
    const conn = getConnection(player, connection);
    return {
        token: conn?.serverUpdate?.token ?? null,
        endpoint: normalizeVoiceEndpoint(conn?.serverUpdate?.endpoint ?? null),
        sessionId: conn?.sessionId ?? null,
        channelId: conn?.channelId ?? conn?.lastChannelId ?? null
    };
}

function getMissingVoiceFields(voicePayload) {
    return Object.entries(voicePayload)
        .filter(([, value]) => !value)
        .map(([key]) => key);
}

function isUpstreamSafeVoicePayload(connection, voicePayload) {
    return (
        connection?.serverUpdate?.token &&
        connection?.serverUpdate?.endpoint === voicePayload.endpoint &&
        connection?.sessionId &&
        connection?.channelId
    );
}

function applyShoukakuCompat({ kazagumo, PlayerClass, normalizeVoiceEndpoint, isPlayerUpdateBadRequest }) {
    const connector = kazagumo.shoukaku.connector;
    if (connector?.raw) {
        const originalRaw = connector.raw.bind(connector);
        connector.raw = packet => {
            if (packet?.t === 'VOICE_SERVER_UPDATE' && typeof packet?.d?.endpoint === 'string') {
                packet.d.endpoint = normalizeVoiceEndpoint(packet.d.endpoint);
            }
            return originalRaw(packet);
        };
    }

    if (PlayerClass.prototype.__discordMusicCompatPatched) {
        return;
    }

    const upstreamSendServerUpdate = PlayerClass.prototype.sendServerUpdate;

    PlayerClass.prototype.__discordMusicCompatPatched = true;
    PlayerClass.prototype.sendServerUpdate = async function sendServerUpdate(connection) {
        const conn = getConnection(this, connection);
        const voicePayload = buildVoicePayload(this, conn, normalizeVoiceEndpoint);
        const missing = getMissingVoiceFields(voicePayload);

        if (missing.length === 0 && typeof upstreamSendServerUpdate === 'function' && isUpstreamSafeVoicePayload(conn, voicePayload)) {
            try {
                return await upstreamSendServerUpdate.call(this, conn);
            } catch (error) {
                if (!isPlayerUpdateBadRequest(error)) throw error;
                await wait(700);
            }
        }

        if (missing.length > 0) {
            throw new Error(`[Voice] Incomplete voice state for guild ${this.guildId}. Missing: ${missing.join(', ')}`);
        }

        const payload = {
            guildId: this.guildId,
            playerOptions: {
                voice: voicePayload
            }
        };

        try {
            return await this.node.rest.updatePlayer(payload);
        } catch (error) {
            if (!isPlayerUpdateBadRequest(error)) throw error;
            await wait(700);
            return this.node.rest.updatePlayer(payload);
        }
    };
}

module.exports = {
    applyShoukakuCompat,
    buildVoicePayload,
    getMissingVoiceFields,
    isUpstreamSafeVoicePayload
};
