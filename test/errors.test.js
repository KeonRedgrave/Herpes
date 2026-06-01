const test = require('node:test');
const assert = require('node:assert/strict');

const {
    isAlreadyDestroyedError,
    isPlayerUpdateBadRequest,
    isSessionError
} = require('../src/music/errors');

test('error classifiers recognize reconnect-safe failures', () => {
    assert.equal(isSessionError({ status: 404, path: '/sessions/123/players/abc' }), true);
    assert.equal(isAlreadyDestroyedError({ message: 'player already destroyed' }), true);
    assert.equal(isPlayerUpdateBadRequest({ status: 400, path: '/v4/sessions/123/players/abc' }), true);
});
