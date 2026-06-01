function isSessionError(error) {
    if (!error) return false;

    const message = String(error.message || '').toLowerCase();
    const path = String(error.path || '').toLowerCase();

    return (
        (error.status === 404 && path.includes('/sessions/')) ||
        path.includes('/sessions/null/') ||
        message.includes('session not found') ||
        message.includes('session expired')
    );
}

function isAlreadyDestroyedError(error) {
    if (!error) return false;
    return String(error.message || '').toLowerCase().includes('already destroyed');
}

function isPlayerUpdateBadRequest(error) {
    if (!error) return false;
    const path = String(error.path || '').toLowerCase();
    return error.status === 400 && path.includes('/players/');
}

function isLoginRequiredPlaybackError(message) {
    const text = String(message || '').toLowerCase();
    return (
        text.includes('requires login') ||
        text.includes('please sign in') ||
        text.includes('sign in to confirm') ||
        text.includes("confirm you're not a bot")
    );
}

function toErrorMessage(error) {
    if (!error) return 'Unknown error';
    return error.message || String(error);
}

module.exports = {
    isSessionError,
    isAlreadyDestroyedError,
    isPlayerUpdateBadRequest,
    isLoginRequiredPlaybackError,
    toErrorMessage
};
