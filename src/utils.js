function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function formatDuration(ms) {
    const safeMs = Number.isFinite(ms) && ms > 0 ? ms : 0;
    const seconds = Math.floor((safeMs / 1000) % 60);
    const minutes = Math.floor((safeMs / (1000 * 60)) % 60);
    const hours = Math.floor(safeMs / (1000 * 60 * 60));

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function createProgressBar(current, total, length = 14) {
    const barLen = Math.max(4, length);
    if (!Number.isFinite(total) || total <= 0) {
        return '░'.repeat(barLen);
    }

    const clampedCurrent = Math.max(0, Math.min(current, total));
    const filledCount = Math.round((clampedCurrent / total) * barLen);
    const safeFilled = Math.min(Math.max(filledCount, 0), barLen);
    return `${'█'.repeat(safeFilled)}${'░'.repeat(barLen - safeFilled)}`;
}

/** Keeps Discord markdown link labels intact: [] break [label](url). */
function sanitizeLinkLabel(text, maxLength = 200) {
    if (text == null || text === '') return 'Unknown';
    const cleaned = String(text)
        .replace(/\r?\n/g, ' ')
        .replace(/[\[\]]/g, '')
        .slice(0, maxLength)
        .trim();
    return cleaned || 'Unknown';
}

function normalizeVoiceEndpoint(endpoint) {
    if (typeof endpoint !== 'string') return endpoint;

    return endpoint
        .trim()
        .replace(/^wss?:\/\//i, '')
        .replace(/^https?:\/\//i, '')
        .replace(/\/+$/, '');
}

module.exports = {
    wait,
    formatDuration,
    createProgressBar,
    sanitizeLinkLabel,
    normalizeVoiceEndpoint
};
