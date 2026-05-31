const commands = [
    {
        name: 'play',
        description: 'Play a song from YouTube',
        options: [
            {
                name: 'query',
                description: 'Song name or YouTube URL',
                type: 3,
                required: true
            }
        ]
    },
    { name: 'skip', description: 'Skip the current song' },
    { name: 'stop', description: 'Stop playing and clear the queue' },
    { name: 'pause', description: 'Pause the current song' },
    { name: 'resume', description: 'Resume the paused song' },
    { name: 'queue', description: 'Show the current queue' },
    { name: 'nowplaying', description: 'Show the currently playing song' },
    {
        name: 'volume',
        description: 'Set the volume',
        options: [
            {
                name: 'level',
                description: 'Volume level (0-100)',
                type: 4,
                required: true,
                min_value: 0,
                max_value: 100
            }
        ]
    },
    { name: 'shuffle', description: 'Shuffle the queue' },
    {
        name: 'loop',
        description: 'Toggle loop mode',
        options: [
            {
                name: 'mode',
                description: 'Loop mode',
                type: 3,
                required: true,
                choices: [
                    { name: 'Off', value: 'none' },
                    { name: 'Track', value: 'track' },
                    { name: 'Queue', value: 'queue' }
                ]
            }
        ]
    },
    { name: 'join', description: 'Join your voice channel and stay there' },
    { name: 'leave', description: 'Leave the voice channel' }
];

module.exports = {
    commands
};
