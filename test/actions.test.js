const test = require('node:test');
const assert = require('node:assert/strict');

const { createActions } = require('../src/actions');

function createRuntimeStub(gate = { ok: true }) {
    return {
        getPlaybackGate: () => gate,
        safePlayerAction: async (_player, _actionName, fn) => {
            await fn();
            return { ok: true };
        },
        updatePlayerMessage: async () => {},
        setGuildStatus: () => {},
        clearPlayerInterval: () => {},
        startPlayerInterval: () => {},
        setPlayerPaused: async (player, paused) => player.pause(paused),
        stopPlayerTrack: async player => player.skip(),
        seekPlayer: async (player, position) => player.seek(position),
        setPlayerVolume: async (player, level) => player.setVolume(level),
        invalidateSnapshot: () => {},
        markSuppressEmptyNotice: () => {},
        clearPlayerMessage: () => {},
        stopPlaybackKeepVoice: async () => {},
        safeDestroyPlayer: async () => ({ ok: true }),
        getLivePlayer: () => null,
        createPlayerWithRecovery: async () => null,
        kazagumo: {
            search: async () => ({ tracks: [], type: 'TRACK' })
        }
    };
}

function createPlayer() {
    return {
        guildId: 'guild-1',
        volume: 30,
        loop: 'none',
        queue: {
            length: 2,
            cleared: false,
            shuffled: false,
            clear() {
                this.cleared = true;
                this.length = 0;
            },
            shuffle() {
                this.shuffled = true;
            }
        },
        pauseCalls: [],
        skipCalls: 0,
        seekCalls: [],
        setVolumeCalls: [],
        setLoopCalls: [],
        pause(value) {
            this.pauseCalls.push(value);
        },
        skip() {
            this.skipCalls += 1;
        },
        seek(value) {
            this.seekCalls.push(value);
        },
        setVolume(value) {
            this.setVolumeCalls.push(value);
            this.volume = value;
        },
        setLoop(value) {
            this.setLoopCalls.push(value);
            this.loop = value;
        }
    };
}

test('playback mutations are blocked while recovery gate is closed', async () => {
    const gate = { ok: false, code: 'guild-recovering', message: 'Playback is recovering for this guild.' };
    const runtime = createRuntimeStub(gate);
    let safePlayerActionCalls = 0;
    let updateMessageCalls = 0;
    runtime.safePlayerAction = async () => {
        safePlayerActionCalls += 1;
        return { ok: true };
    };
    runtime.updatePlayerMessage = async () => {
        updateMessageCalls += 1;
    };

    const actions = createActions(runtime);
    const player = createPlayer();

    const results = await Promise.all([
        actions.pause(player),
        actions.resume(player),
        actions.skip(player),
        actions.restart(player),
        actions.setVolume(player, 55),
        actions.changeVolume(player, 10),
        actions.shuffle(player),
        actions.setLoop(player, 'track'),
        actions.cycleLoop(player),
        actions.clearQueue(player)
    ]);

    for (const result of results) {
        assert.equal(result.ok, false);
        assert.equal(result.code, 'guild-recovering');
        assert.equal(result.message, gate.message);
    }

    assert.equal(safePlayerActionCalls, 0);
    assert.equal(updateMessageCalls, 0);
    assert.deepEqual(player.pauseCalls, []);
    assert.equal(player.skipCalls, 0);
    assert.deepEqual(player.seekCalls, []);
    assert.deepEqual(player.setVolumeCalls, []);
    assert.deepEqual(player.setLoopCalls, []);
    assert.equal(player.queue.shuffled, false);
    assert.equal(player.queue.cleared, false);
});

test('stop and leave remain available for cleanup during recovery', async () => {
    const gate = { ok: false, code: 'guild-recovering', message: 'Playback is recovering for this guild.' };
    const runtime = createRuntimeStub(gate);
    let stopCalls = 0;
    let destroyCalls = 0;
    runtime.stopPlaybackKeepVoice = async () => {
        stopCalls += 1;
    };
    runtime.safeDestroyPlayer = async () => {
        destroyCalls += 1;
        return { ok: true };
    };

    const actions = createActions(runtime);
    const player = createPlayer();

    const stopResult = await actions.stop(player);
    const leaveResult = await actions.leaveVoice({ guildId: player.guildId, player });

    assert.equal(stopResult.ok, true);
    assert.equal(leaveResult.ok, true);
    assert.equal(stopCalls, 1);
    assert.equal(destroyCalls, 1);
});

test('setVolume and setLoop use safePlayerAction when mutations are allowed', async () => {
    const runtime = createRuntimeStub();
    const actionNames = [];
    runtime.safePlayerAction = async (_player, actionName, fn) => {
        actionNames.push(actionName);
        await fn();
        return { ok: true };
    };

    const actions = createActions(runtime);
    const player = createPlayer();

    const volumeResult = await actions.setVolume(player, 60);
    const loopResult = await actions.setLoop(player, 'queue');

    assert.equal(volumeResult.ok, true);
    assert.equal(loopResult.ok, true);
    assert.deepEqual(actionNames, ['setVolume', 'setLoop']);
    assert.deepEqual(player.setVolumeCalls, [60]);
    assert.deepEqual(player.setLoopCalls, ['queue']);
});

test('async player mutations are awaited through runtime wrappers', async () => {
    const runtime = createRuntimeStub();
    const events = [];
    runtime.safePlayerAction = async (_player, actionName, fn) => {
        events.push(`${actionName}:start`);
        await fn();
        events.push(`${actionName}:done`);
        return { ok: true };
    };
    runtime.setPlayerPaused = async (player, paused) => {
        await Promise.resolve();
        player.pause(paused);
        events.push(`paused:${paused}`);
    };
    runtime.stopPlayerTrack = async player => {
        await Promise.resolve();
        player.skip();
        events.push('stopped');
    };
    runtime.seekPlayer = async (player, position) => {
        await Promise.resolve();
        player.seek(position);
        events.push(`seek:${position}`);
    };
    runtime.setPlayerVolume = async (player, level) => {
        await Promise.resolve();
        player.setVolume(level);
        events.push(`volume:${level}`);
    };

    const actions = createActions(runtime);
    const player = createPlayer();

    await actions.pause(player);
    await actions.resume(player);
    await actions.skip(player);
    await actions.restart(player);
    await actions.setVolume(player, 65);

    assert.deepEqual(events, [
        'pause:start',
        'paused:true',
        'pause:done',
        'resume:start',
        'paused:false',
        'resume:done',
        'skip:start',
        'stopped',
        'skip:done',
        'restart:start',
        'seek:0',
        'restart:done',
        'setVolume:start',
        'volume:65',
        'setVolume:done'
    ]);
});
