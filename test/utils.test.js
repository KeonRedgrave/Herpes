const test = require('node:test');
const assert = require('node:assert/strict');

const { createProgressBar, formatDuration, normalizeVoiceEndpoint } = require('../src/utils');

test('formatDuration handles zero and hours', () => {
    assert.equal(formatDuration(0), '0:00');
    assert.equal(formatDuration(65000), '1:05');
    assert.equal(formatDuration(3661000), '1:01:01');
});

test('createProgressBar clamps values and normalizeVoiceEndpoint strips protocol', () => {
    assert.equal(createProgressBar(0, 0, 5), '░░░░░');
    assert.equal(createProgressBar(500, 1000, 5), '███░░');
    assert.equal(normalizeVoiceEndpoint('wss://example.discord.media/'), 'example.discord.media');
});
