const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { EmbedBuilder } = require('discord.js');
const { Kazagumo, Plugins } = require('kazagumo');
const { Connectors, Player } = require('shoukaku');
const { buildPlayerComponents, buildPlayerEmbed } = require('../ui/playerView');
const { normalizeVoiceEndpoint, wait } = require('../utils');
const {
    isAlreadyDestroyedError,
    isLoginRequiredPlaybackError,
    isPlayerUpdateBadRequest,
    isSessionError,
    toErrorMessage
} = require('./errors');
const { applyShoukakuCompat } = require('./compat');

function readDependencyVersion(packageName) {
    try {
        let currentPath = require.resolve(packageName);
        while (currentPath && currentPath !== path.dirname(currentPath)) {
            const packageJsonPath = path.join(currentPath, 'package.json');
            if (fs.existsSync(packageJsonPath)) {
                return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')).version || 'unknown';
            }
            currentPath = path.dirname(currentPath);
        }
    } catch {
        // Keep runtime startup resilient if package metadata is unavailable.
    }
    return 'unknown';
}

class MusicRuntime {
    constructor(client, config) {
        this.client = client;
        this.config = config;
        this.kazagumo = new Kazagumo({
            defaultSearchEngine: 'youtube',
            plugins: [new Plugins.PlayerMoved(client)],
            send: (guildId, payload) => {
                const guild = client.guilds.cache.get(guildId);
                if (guild) guild.shard.send(payload);
            }
        }, new Connectors.DiscordJS(client), [config.lavalink], {
            reconnectTries: 0,
            reconnectInterval: 5000,
            restTimeout: 30000,
            moveOnDisconnect: false,
            resume: false,
            resumeTimeout: 0,
            resumeByLibrary: false
        });

        applyShoukakuCompat({
            kazagumo: this.kazagumo,
            PlayerClass: Player,
            normalizeVoiceEndpoint,
            isPlayerUpdateBadRequest
        });
        this.logRuntimeHealth();

        this.nodeStatus = 'starting';
        this.isStartingUp = true;
        this.reconnectAttempts = 0;
        this.reconnectBackoffMs = 3000;
        this.maxReconnectBackoffMs = 30000;
        this.reconnectTimer = null;
        this.readyTimer = null;
        this.reconnectInFlight = false;
        this.intentionalClose = false;
        this.recoveryEpoch = 0;

        this.guildStates = new Map();
        this.snapshots = new Map();
        this.searchFallbacks = new Map();
        this.playerMessages = new Map();
        this.playerIntervals = new Map();
        this.emptyQueueNotifiedAt = new Map();
        this.suppressEmptyNoticeUntil = new Map();

        this.EMPTY_NOTICE_COOLDOWN_MS = 30000;
        this.SUPPRESS_EMPTY_NOTICE_MS = 15000;

        this.healthServer = this.startHealthServer();
        this.bindProcessHandlers();
        this.bindNodeEvents();
        this.bindPlayerEvents();
        this.armReadyTimer();
    }

    startHealthServer() {
        if (!Number.isFinite(this.config.port) || this.config.port <= 0) {
            return null;
        }

        const server = http.createServer((req, res) => {
            if (req.url === '/' || req.url === '/health') {
                res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('ok');
                return;
            }

            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Not Found');
        });

        server.on('error', error => {
            console.error(`[Health] ${error.message}`);
        });

        server.listen(this.config.port, '0.0.0.0', () => {
            console.log(`[Health] Listening on 0.0.0.0:${this.config.port}`);
        });

        return server;
    }

    logRuntimeHealth() {
        console.log(
            `[Runtime] Versions: node=${process.version}, discord.js=${readDependencyVersion('discord.js')}, ` +
            `kazagumo=${readDependencyVersion('kazagumo')}, shoukaku=${readDependencyVersion('shoukaku')}`
        );
        console.log(
            `[Runtime] Lavalink target: name=${this.config.lavalink.name}, ` +
            `url=${this.config.lavalink.url}, secure=${this.config.lavalink.secure === true}`
        );
    }

    bindProcessHandlers() {
        process.on('unhandledRejection', error => {
            if (isSessionError(error) || isAlreadyDestroyedError(error)) {
                console.warn(`[Runtime] Suppressed transient rejection: ${toErrorMessage(error)}`);
                return;
            }
            console.error('Unhandled Rejection:', error);
        });

        process.on('uncaughtException', error => {
            console.error('Uncaught Exception:', error);
        });

        const shutdown = signal => {
            console.log(`[Runtime] Received ${signal}, shutting down.`);
            this.dispose();
            process.exit(0);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }

    bindNodeEvents() {
        this.kazagumo.shoukaku.on('error', (name, error) => {
            console.error(`Lavalink node "${name}" error:`, error);

            const message = String(error?.message || '');
            const configuredHost = this.config.lavalink.url || 'localhost:2333';
            const configuredSecure = this.config.lavalink.secure === true;

            if (message.includes('401')) {
                console.error(
                    `[Lavalink] Authentication failed. Check that bot LAVALINK_PASSWORD matches Lavalink LAVALINK_SERVER_PASSWORD exactly. Current bot config: host=${configuredHost}, secure=${configuredSecure}`
                );
            } else if (message.includes('502')) {
                console.error(
                    `[Lavalink] Gateway error while connecting. On Railway this usually means Lavalink is still starting or LAVALINK_HOST/LAVALINK_SECURE points to the wrong endpoint. Current bot config: host=${configuredHost}, secure=${configuredSecure}`
                );
            }
        });

        this.kazagumo.shoukaku.on('disconnect', (name, players, moved) => {
            if (moved) {
                console.log(`Lavalink node "${name}" moved players.`);
                return;
            }
            console.warn(`Lavalink node "${name}" disconnected.`);
        });

        this.kazagumo.shoukaku.on('ready', name => {
            this.nodeStatus = 'ready';
            this.isStartingUp = false;
            this.reconnectInFlight = false;
            this.reconnectAttempts = 0;
            this.reconnectBackoffMs = 3000;
            this.clearReconnectTimer();
            this.clearReadyTimer();
            const node = this.getMainNode();
            console.log(
                `Lavalink node "${name}" connected. state=${node?.state ?? 'unknown'}, session=${this.getNodeSessionId(node) || 'missing'}`
            );

            for (const [guildId, snapshot] of this.snapshots) {
                const state = this.getGuildState(guildId);
                state.resumeAttempts = 0;
                this.scheduleGuildResume(guildId, snapshot.version, 1500);
            }
        });

        this.kazagumo.shoukaku.on('close', (name, code, reason) => {
            console.warn(`Lavalink node "${name}" closed: ${code} - ${reason}`);

            if (this.intentionalClose || code === 1000) {
                console.log('[Runtime] Intentional node close ignored.');
                return;
            }

            this.nodeStatus = 'reconnecting';
            this.recoveryEpoch += 1;
            this.clearReconnectTimer();
            this.clearReadyTimer();
            this.captureActiveSnapshots();

            for (const [guildId, state] of this.guildStates) {
                state.status = 'reconnecting';
                state.resumeInFlight = false;
                if (state.resumeTimer) {
                    clearTimeout(state.resumeTimer);
                    state.resumeTimer = null;
                }
                this.clearPlayerInterval(guildId);
            }

            this.scheduleReconnect(this.reconnectBackoffMs);
            this.reconnectBackoffMs = Math.min(this.reconnectBackoffMs * 2, this.maxReconnectBackoffMs);
        });
    }

    bindPlayerEvents() {
        this.kazagumo.on('playerStart', async (player, track) => {
            if (!track) {
                console.warn(`playerStart received null track for guild ${player.guildId}`);
                return;
            }

            this.invalidateSnapshot(player.guildId);
            this.setGuildStatus(player.guildId, player.paused ? 'paused' : 'playing');
            this.emptyQueueNotifiedAt.delete(player.guildId);
            this.suppressEmptyNoticeUntil.delete(player.guildId);
            this.clearPlayerInterval(player.guildId);

            const channel = this.client.channels.cache.get(player.textId);
            if (channel) {
                const notification = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('🎵 Now Playing')
                    .setDescription(`**[${track.title}](${track.uri})**`)
                    .setThumbnail(track.thumbnail || null);

                channel.send({ embeds: [notification] })
                    .then(message => setTimeout(() => message.delete().catch(() => { }), 5000))
                    .catch(() => { });
            }

            await this.updatePlayerMessage(player);
            this.startPlayerInterval(player);
        });

        this.kazagumo.on('playerEnd', player => {
            this.clearPlayerInterval(player.guildId);
        });

        this.kazagumo.on('playerEmpty', player => {
            if (this.getGuildState(player.guildId).status === 'reconnecting') {
                return;
            }

            this.setGuildStatus(player.guildId, 'idle');
            this.clearPlayerInterval(player.guildId);
            this.clearPlayerMessage(player.guildId);

            if (!this.canSendEmptyNotice(player.guildId)) {
                return;
            }

            const channel = this.client.channels.cache.get(player.textId);
            if (channel) {
                const embed = new EmbedBuilder()
                    .setColor(0xFFFF00)
                    .setDescription('📭 Queue is empty! Add more songs to continue listening.');

                channel.send({ embeds: [embed] })
                    .then(message => setTimeout(() => message.delete().catch(() => { }), 5000))
                    .catch(() => { });
            }
        });

        this.kazagumo.on('playerDestroy', player => {
            this.clearPlayerInterval(player.guildId);
            this.clearPlayerMessage(player.guildId);
            if (this.getGuildState(player.guildId).status !== 'reconnecting') {
                this.setGuildStatus(player.guildId, 'idle');
            }
            this.emptyQueueNotifiedAt.delete(player.guildId);
        });

        this.kazagumo.on('playerError', (player, error) => {
            console.error(`Player error in guild ${player.guildId}:`, error);
            const channel = this.client.channels.cache.get(player.textId);
            if (channel) {
                channel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF0000)
                            .setDescription(`❌ An error occurred: ${toErrorMessage(error)}`)
                    ]
                }).catch(() => { });
            }
        });

        this.kazagumo.on('playerException', async (player, data) => {
            const exceptionMessage = data?.exception?.message || 'Unknown playback exception';
            const currentTrack = player?.queue?.current;

            console.error(`Player exception in guild ${player.guildId}:`, exceptionMessage);

            if (currentTrack && isLoginRequiredPlaybackError(exceptionMessage)) {
                const fallback = this.consumeSearchFallback(currentTrack);
                if (fallback?.nextTrack) {
                    console.warn(
                        `[PlayFallback] Current YouTube result is login-blocked in guild ${player.guildId}. Retrying with another search result for "${fallback.query}". Remaining fallbacks: ${fallback.remainingCount}`
                    );

                    const playResult = await this.safePlayerAction(
                        player,
                        'play-fallback',
                        () => player.play(fallback.nextTrack, { replaceCurrent: true }),
                        { throwOnError: false }
                    );

                    if (playResult.ok) {
                        const channel = this.client.channels.cache.get(player.textId);
                        if (channel) {
                            channel.send({
                                embeds: [
                                    new EmbedBuilder()
                                        .setColor(0xF1C40F)
                                        .setDescription('⚠️ The first YouTube result was blocked by login requirements. Trying another search result...')
                                ]
                            }).catch(() => { });
                        }
                        return;
                    }
                }
            }

            const channel = this.client.channels.cache.get(player.textId);
            if (channel) {
                const description = isLoginRequiredPlaybackError(exceptionMessage)
                    ? '❌ YouTube blocked this video and requires login. Try another result or another query.'
                    : `❌ Playback failed: ${exceptionMessage}`;

                channel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF0000)
                            .setDescription(description)
                    ]
                }).catch(() => { });
            }
        });
    }

    dispose() {
        this.clearReconnectTimer();
        for (const [guildId, state] of this.guildStates) {
            if (state.resumeTimer) {
                clearTimeout(state.resumeTimer);
                state.resumeTimer = null;
            }
            this.clearPlayerInterval(guildId);
        }
        if (this.healthServer) {
            this.healthServer.close();
        }
        this.clearReadyTimer();
    }

    getGuildState(guildId) {
        if (!this.guildStates.has(guildId)) {
            this.guildStates.set(guildId, {
                status: 'idle',
                snapshotVersion: 0,
                resumeAttempts: 0,
                resumeTimer: null,
                resumeInFlight: false,
                lastError: null
            });
        }
        return this.guildStates.get(guildId);
    }

    setGuildStatus(guildId, status, lastError = null) {
        const state = this.getGuildState(guildId);
        state.status = status;
        state.lastError = lastError;
    }

    getMainNode() {
        return this.kazagumo.shoukaku.nodes.get(this.config.lavalink.name);
    }

    getNodeSessionId(node) {
        if (!node) return null;
        if (node.sessionId !== undefined) return node.sessionId;
        if (node.sessionID !== undefined) return node.sessionID;
        return node.session?.id ?? null;
    }

    isNodeStateConnected(node) {
        const state = node?.state;
        return state === 1 || state === '1' || state === 'CONNECTED' || state === 'connected';
    }

    isNodeStateConnecting(node) {
        const state = node?.state;
        return state === 0 || state === '0' || state === 'CONNECTING' || state === 'connecting';
    }

    isNodeOperational() {
        const node = this.getMainNode();
        if (!node || !this.isNodeStateConnected(node)) return false;
        const sessionId = this.getNodeSessionId(node);
        return typeof sessionId === 'string' && sessionId.length > 0 && sessionId !== 'null';
    }

    getServiceStatusMessage() {
        if (this.isStartingUp) {
            return 'The music service is still starting up. Please try again in a few seconds.';
        }
        if (this.nodeStatus === 'reconnecting') {
            return 'The music service lost connection and is recovering. Please try again in a few seconds.';
        }
        return 'The music service is temporarily unavailable. Please try again shortly.';
    }

    getPlaybackGate(guildId) {
        if (!this.isNodeOperational()) {
            return { ok: false, code: 'service-unavailable', message: this.getServiceStatusMessage() };
        }

        const state = this.getGuildState(guildId);
        if (state.status === 'reconnecting' || state.status === 'resuming' || state.status === 'resume_scheduled') {
            return {
                ok: false,
                code: 'guild-recovering',
                message: 'Playback is recovering for this guild. Please try again in a few seconds.'
            };
        }

        return { ok: true };
    }

    markSuppressEmptyNotice(guildId) {
        this.suppressEmptyNoticeUntil.set(guildId, Date.now() + this.SUPPRESS_EMPTY_NOTICE_MS);
    }

    canSendEmptyNotice(guildId) {
        const now = Date.now();
        const suppressUntil = this.suppressEmptyNoticeUntil.get(guildId) || 0;
        if (now < suppressUntil) return false;
        if (suppressUntil > 0) this.suppressEmptyNoticeUntil.delete(guildId);

        const lastNotified = this.emptyQueueNotifiedAt.get(guildId) || 0;
        if (now - lastNotified < this.EMPTY_NOTICE_COOLDOWN_MS) return false;

        this.emptyQueueNotifiedAt.set(guildId, now);
        return true;
    }

    clearReconnectTimer() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    clearReadyTimer() {
        if (this.readyTimer) {
            clearTimeout(this.readyTimer);
            this.readyTimer = null;
        }
    }

    armReadyTimer() {
        this.clearReadyTimer();
        this.readyTimer = setTimeout(() => {
            this.readyTimer = null;
            if (this.isNodeOperational()) return;
            this.nodeStatus = this.isStartingUp ? 'starting' : 'reconnecting';
            this.scheduleReconnect(0);
        }, this.config.readyTimeoutMs);
    }

    scheduleReconnect(delayMs) {
        this.clearReconnectTimer();
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.attemptReconnect().catch(error => {
                console.error(`[Reconnect] ${toErrorMessage(error)}`);
            });
        }, delayMs);
    }

    async attemptReconnect() {
        if (this.reconnectInFlight || !this.client.user?.id) return;
        if (this.isNodeOperational()) return;

        const node = this.getMainNode();
        if (node && this.isNodeStateConnecting(node)) return;

        this.reconnectInFlight = true;
        this.nodeStatus = 'reconnecting';
        this.reconnectAttempts += 1;

        try {
            if (node) {
                this.intentionalClose = true;
                try {
                    this.kazagumo.shoukaku.removeNode(this.config.lavalink.name);
                } catch {
                    // Ignore stale-node removal errors.
                }
                await wait(1500);
                this.intentionalClose = false;
            }

            const staleGuildIds = new Set([
                ...this.kazagumo.players.keys(),
                ...this.kazagumo.shoukaku.players.keys(),
                ...this.kazagumo.shoukaku.connections.keys()
            ]);

            for (const guildId of staleGuildIds) {
                this.clearPlayerInterval(guildId);
                this.hardCleanupGuildVoiceState(guildId, { disconnectVoice: true });
            }

            this.kazagumo.shoukaku.addNode(this.config.lavalink);
            this.armReadyTimer();
        } finally {
            this.reconnectInFlight = false;
        }
    }

    captureSnapshot(player) {
        if (!player?.guildId || !player.voiceId) return null;

        const current = player.queue.current;
        const queue = [...player.queue];
        if (!current && queue.length === 0) return null;

        const state = this.getGuildState(player.guildId);
        state.snapshotVersion += 1;

        const snapshot = {
            version: state.snapshotVersion,
            epoch: this.recoveryEpoch,
            guildId: player.guildId,
            voiceId: player.voiceId,
            textId: player.textId,
            current,
            queue,
            position: player.position,
            volume: player.volume,
            loop: player.loop || 'none',
            updatedAt: Date.now()
        };

        this.snapshots.set(player.guildId, snapshot);
        return snapshot;
    }

    captureActiveSnapshots() {
        for (const player of this.kazagumo.players.values()) {
            this.captureSnapshot(player);
        }
    }

    invalidateSnapshot(guildId) {
        const state = this.getGuildState(guildId);
        if (state.resumeTimer) {
            clearTimeout(state.resumeTimer);
            state.resumeTimer = null;
        }
        state.resumeAttempts = 0;
        this.snapshots.delete(guildId);
    }

    getTrackFallbackKey(track) {
        if (!track) return null;
        return track.track || `${track.identifier || ''}:${track.title || ''}`;
    }

    registerSearchFallbacks(primaryTrack, alternativeTracks, query) {
        const key = this.getTrackFallbackKey(primaryTrack);
        if (!key || !Array.isArray(alternativeTracks) || alternativeTracks.length === 0) return;

        this.searchFallbacks.set(key, {
            query,
            remainingTracks: [...alternativeTracks]
        });
    }

    consumeSearchFallback(track) {
        const key = this.getTrackFallbackKey(track);
        if (!key) return null;

        const fallbackState = this.searchFallbacks.get(key);
        this.searchFallbacks.delete(key);

        if (!fallbackState || fallbackState.remainingTracks.length === 0) {
            return null;
        }

        const [nextTrack, ...remainingTracks] = fallbackState.remainingTracks;

        if (nextTrack && remainingTracks.length > 0) {
            this.registerSearchFallbacks(nextTrack, remainingTracks, fallbackState.query);
        }

        return {
            nextTrack,
            query: fallbackState.query,
            remainingCount: remainingTracks.length
        };
    }

    scheduleGuildResume(guildId, version, delayMs) {
        const state = this.getGuildState(guildId);
        if (state.resumeTimer) clearTimeout(state.resumeTimer);
        state.status = 'resume_scheduled';
        state.resumeTimer = setTimeout(() => {
            state.resumeTimer = null;
            this.resumeGuild(guildId, version).catch(error => {
                console.error(`[Resume:${guildId}] ${toErrorMessage(error)}`);
            });
        }, delayMs);
    }

    async resumeGuild(guildId, expectedVersion) {
        const snapshot = this.snapshots.get(guildId);
        if (!snapshot || snapshot.version !== expectedVersion) return;

        const state = this.getGuildState(guildId);
        if (state.resumeInFlight) return;

        if (!this.isNodeOperational()) {
            this.scheduleGuildResume(guildId, expectedVersion, 3000);
            return;
        }

        if (state.resumeAttempts >= this.config.maxResumeAttempts) {
            state.status = 'failed';
            this.snapshots.delete(guildId);
            return;
        }

        state.resumeInFlight = true;
        state.status = 'resuming';

        try {
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) {
                state.status = 'abandoned';
                this.snapshots.delete(guildId);
                return;
            }

            const voiceChannel = guild.channels.cache.get(snapshot.voiceId);
            if (!voiceChannel) {
                state.status = 'abandoned';
                this.snapshots.delete(guildId);
                return;
            }

            const existingPlayer = this.getLivePlayer(guildId);
            if (existingPlayer) {
                await this.safeDestroyPlayer(guildId, existingPlayer, { allowForce: true });
            }

            const player = await this.createPlayerWithRecovery({
                guildId,
                textId: snapshot.textId,
                voiceId: snapshot.voiceId,
                volume: snapshot.volume || 30,
                deaf: true
            }, 'Resume');

            const playlist = [];
            if (snapshot.current) playlist.push(snapshot.current);
            playlist.push(...snapshot.queue);

            for (const track of playlist) {
                player.queue.add(track);
            }

            if (playlist.length > 0) {
                const playResult = await this.safePlayerAction(player, 'resume-play', () => player.play(), { throwOnError: false });
                if (!playResult.ok) {
                    throw new Error(`Playback resume failed (${playResult.reason})`);
                }
            }

            if (snapshot.loop && snapshot.loop !== 'none') {
                player.setLoop(snapshot.loop);
            }

            if (snapshot.position > 5000) {
                setTimeout(async () => {
                    const currentSnapshot = this.snapshots.get(guildId);
                    if (currentSnapshot && currentSnapshot.version !== expectedVersion) return;
                    const activePlayer = this.kazagumo.players.get(guildId);
                    if (!activePlayer?.queue.current) return;
                    await this.safePlayerAction(activePlayer, 'resume-seek', () => this.seekPlayer(activePlayer, snapshot.position), { throwOnError: false });
                }, 3000);
            }

            this.invalidateSnapshot(guildId);
            state.status = 'healthy';

            const textChannel = this.client.channels.cache.get(snapshot.textId);
            if (textChannel) {
                const embed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setDescription('🔄 Reconnected! Music resumed automatically.');
                textChannel.send({ embeds: [embed] })
                    .then(message => setTimeout(() => message.delete().catch(() => { }), this.config.statusDeleteMs))
                    .catch(() => { });
            }
        } catch (error) {
            state.resumeAttempts += 1;
            state.lastError = toErrorMessage(error);
            state.status = 'failed';

            if (state.resumeAttempts < this.config.maxResumeAttempts && this.snapshots.get(guildId)?.version === expectedVersion) {
                this.scheduleGuildResume(guildId, expectedVersion, 2000 * state.resumeAttempts);
            } else {
                this.snapshots.delete(guildId);
            }
        } finally {
            state.resumeInFlight = false;
        }
    }

    getLivePlayer(guildId) {
        const player = this.kazagumo.players.get(guildId);
        if (!player) return null;

        if (!this.kazagumo.shoukaku.players.has(guildId) || !this.kazagumo.shoukaku.connections.has(guildId)) {
            this.hardCleanupGuildVoiceState(guildId, { disconnectVoice: true });
            return null;
        }

        return player;
    }

    hardCleanupGuildVoiceState(guildId, options = {}) {
        const { disconnectVoice = false } = options;

        const connection = this.kazagumo.shoukaku.connections.get(guildId);
        if (connection) {
            if (disconnectVoice) {
                try {
                    connection.disconnect();
                } catch {
                    // Ignore disconnect cleanup failures.
                }
            }
            this.kazagumo.shoukaku.connections.delete(guildId);
        }

        const shoukakuPlayer = this.kazagumo.shoukaku.players.get(guildId);
        if (shoukakuPlayer) {
            try {
                if (typeof shoukakuPlayer.clean === 'function') {
                    shoukakuPlayer.clean();
                }
            } catch {
                // Ignore stale player cleanup failures.
            }
            this.kazagumo.shoukaku.players.delete(guildId);
        }

        this.kazagumo.players.delete(guildId);
        this.clearPlayerInterval(guildId);
    }

    async createPlayerWithRecovery(options, context = 'Player') {
        let lastError;
        const requestedVolume = Number.isFinite(options.volume) ? options.volume : null;
        const createOptions = { ...options };
        if (requestedVolume !== null && requestedVolume !== 100) {
            createOptions.volume = 100;
        }

        for (let attempt = 1; attempt <= 3; attempt += 1) {
            try {
                const player = await this.kazagumo.createPlayer(createOptions);
                if (requestedVolume !== null && requestedVolume !== 100) {
                    await this.setPlayerVolume(player, requestedVolume);
                }
                return player;
            } catch (error) {
                lastError = error;
                const message = String(error?.message || '').toLowerCase();
                const recoverable =
                    isSessionError(error) ||
                    message.includes('missing session id') ||
                    message.includes('missing connection endpoint') ||
                    message.includes('voice connection is not established');

                if (isPlayerUpdateBadRequest(error) || !recoverable || attempt === 3) {
                    throw error;
                }

                console.warn(`[${context}] createPlayer attempt ${attempt} failed: ${toErrorMessage(error)}`);
                this.hardCleanupGuildVoiceState(options.guildId, { disconnectVoice: true });
                await wait(1200 * attempt);
            }
        }

        throw lastError;
    }

    async safePlayerAction(player, actionName, fn, options = {}) {
        const { throwOnError = true } = options;
        if (!player) return { ok: false, reason: 'missing-player' };

        if (!this.isNodeOperational()) {
            this.clearPlayerInterval(player.guildId);
            return { ok: false, reason: 'node-not-ready' };
        }

        try {
            const value = await fn();
            return { ok: true, value };
        } catch (error) {
            if (isSessionError(error) || isAlreadyDestroyedError(error)) {
                this.hardCleanupGuildVoiceState(player.guildId, { disconnectVoice: true });
                this.clearPlayerMessage(player.guildId);
                this.setGuildStatus(player.guildId, 'reconnecting', toErrorMessage(error));
                return {
                    ok: false,
                    reason: isSessionError(error) ? 'session-expired' : 'already-destroyed',
                    error
                };
            }

            if (throwOnError) throw error;
            console.error(`[Player] ${actionName} failed in guild ${player.guildId}: ${toErrorMessage(error)}`);
            return { ok: false, reason: 'error', error };
        }
    }

    async setPlayerPaused(player, paused) {
        if (player.paused === paused || !player.queue?.totalSize) {
            return player;
        }

        if (typeof player.shoukaku?.setPaused === 'function') {
            await player.shoukaku.setPaused(paused);
            player.paused = paused;
            player.playing = !paused;
            return player;
        }

        return player.pause(paused);
    }

    async stopPlayerTrack(player) {
        if (typeof player.shoukaku?.stopTrack === 'function') {
            await player.shoukaku.stopTrack();
            return player;
        }

        return player.skip();
    }

    async seekPlayer(player, position) {
        return player.seek(position);
    }

    async setPlayerVolume(player, level) {
        return player.setVolume(level);
    }

    async safeDestroyPlayer(guildId, player, options = {}) {
        const { allowForce = false } = options;
        if (!player) return { ok: false, reason: 'missing-player' };

        try {
            await player.destroy();
            this.clearPlayerInterval(guildId);
            this.clearPlayerMessage(guildId);
            return { ok: true };
        } catch (error) {
            if (allowForce || isSessionError(error) || isAlreadyDestroyedError(error)) {
                this.hardCleanupGuildVoiceState(guildId, { disconnectVoice: true });
                this.clearPlayerMessage(guildId);
                return { ok: false, reason: 'forced-cleanup', error };
            }
            throw error;
        }
    }

    async stopPlaybackKeepVoice(player) {
        if (!player) return;
        player.queue.clear();

        if (typeof player.stop === 'function') {
            await this.safePlayerAction(player, 'stop', () => player.stop(), { throwOnError: false });
            return;
        }

        if (player.playing || player.queue.current) {
            await this.safePlayerAction(player, 'skip', () => this.stopPlayerTrack(player), { throwOnError: false });
        }
    }

    clearPlayerInterval(guildId) {
        const interval = this.playerIntervals.get(guildId);
        if (interval) {
            clearInterval(interval);
            this.playerIntervals.delete(guildId);
        }
    }

    startPlayerInterval(player) {
        this.clearPlayerInterval(player.guildId);

        const interval = setInterval(() => {
            const state = this.getGuildState(player.guildId);
            if (!this.isNodeOperational() || state.status === 'reconnecting' || state.status === 'resuming') {
                this.clearPlayerInterval(player.guildId);
                return;
            }

            const activePlayer = this.kazagumo.players.get(player.guildId);
            if (!activePlayer?.queue.current || activePlayer.paused) return;
            this.updatePlayerMessage(activePlayer).catch(() => { });
        }, this.config.playerUpdateMs);

        this.playerIntervals.set(player.guildId, interval);
    }

    clearPlayerMessage(guildId) {
        const playerMessage = this.playerMessages.get(guildId);
        if (playerMessage) {
            playerMessage.delete().catch(() => { });
            this.playerMessages.delete(guildId);
        }
    }

    async updatePlayerMessage(player) {
        const track = player.queue.current;
        if (!track) {
            this.clearPlayerMessage(player.guildId);
            return;
        }

        const channel = this.client.channels.cache.get(player.textId);
        if (!channel) return;

        const embed = buildPlayerEmbed(player, track);
        const components = buildPlayerComponents(player);
        const existing = this.playerMessages.get(player.guildId);

        try {
            if (existing) {
                const refreshed = await existing.edit({ embeds: [embed], components });
                this.playerMessages.set(player.guildId, refreshed);
                return;
            }
        } catch {
            this.playerMessages.delete(player.guildId);
        }

        const message = await channel.send({ embeds: [embed], components });
        this.playerMessages.set(player.guildId, message);
    }
}

module.exports = {
    MusicRuntime,
    readDependencyVersion
};
