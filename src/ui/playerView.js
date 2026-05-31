const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} = require('discord.js');
const { createProgressBar, formatDuration, sanitizeLinkLabel } = require('../utils');

const ACCENT = 0x5865f2;

function formatLoopMode(loop) {
    switch (loop || 'none') {
        case 'none':
            return 'Off';
        case 'track':
            return 'One track';
        case 'queue':
            return 'Whole queue';
        default:
            return String(loop);
    }
}

function buildPlayerEmbed(player, track = player.queue.current) {
    if (!track) return null;

    const progressBar = createProgressBar(player.position, track.length, 14);
    const status = player.paused ? 'Paused' : 'Playing';
    const queueCount = player.queue.length;
    const titleSafe = sanitizeLinkLabel(track.title, 180);
    const artist = (track.author || 'Unknown').slice(0, 256);
    const requester = track.requester?.tag || 'Unknown';

    return new EmbedBuilder()
        .setColor(ACCENT)
        .setTitle('Music player')
        .setDescription(
            `**[${titleSafe}](${track.uri})**\n\n` +
                `${progressBar}\n` +
                `\`${formatDuration(player.position)}\` / \`${formatDuration(track.length)}\``
        )
        .addFields(
            { name: 'Artist', value: artist, inline: true },
            { name: 'Requested by', value: requester, inline: true },
            { name: 'Loop', value: formatLoopMode(player.loop), inline: true }
        )
        .setFooter({
            text: `${queueCount} in queue · ${player.volume}% volume · ${status}`
        })
        .setThumbnail(track.thumbnail || null);
}

function buildPlayerComponents(player) {
    const loopMode = player.loop || 'none';
    const queueSize = player.queue.length;
    const pauseEmoji = player.paused ? '▶️' : '⏸️';

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('player_previous').setEmoji('⏮️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('player_pause').setEmoji(pauseEmoji).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('player_skip').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('player_stop').setEmoji('⏹️').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('player_shuffle').setEmoji('🔀').setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('player_voldown').setEmoji('🔉').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('player_volup').setEmoji('🔊').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('player_loop')
            .setEmoji('🔁')
            .setStyle(loopMode === 'none' ? ButtonStyle.Secondary : ButtonStyle.Success),
        new ButtonBuilder().setCustomId('player_queue').setEmoji('📋').setStyle(ButtonStyle.Secondary)
    );

    const trackOptions = player.queue.slice(0, 25).map((t, index) => {
        const label = `${index + 1}. ${sanitizeLinkLabel(t.title, 80)}`.slice(0, 100);
        const desc = `${formatDuration(t.length)} · ${sanitizeLinkLabel(t.author || 'Unknown', 40)}`.slice(0, 100);
        return new StringSelectMenuOptionBuilder().setLabel(label).setDescription(desc).setValue(`track_${index}`);
    });

    if (trackOptions.length === 0) {
        trackOptions.push(
            new StringSelectMenuOptionBuilder()
                .setLabel('Queue is empty')
                .setDescription('Use /play to add tracks.')
                .setValue('no_tracks')
        );
    }

    const row3 = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('player_tracks')
            .setPlaceholder(`Queue · ${queueSize} track(s)`)
            .addOptions(trackOptions)
    );

    const row4 = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('player_features')
            .setPlaceholder('More…')
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel('Now playing (detailed)')
                    .setDescription('Progress, volume, and loop.')
                    .setValue('feature_nowplaying'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Clear queue')
                    .setDescription('Remove all upcoming tracks.')
                    .setValue('feature_clear'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Restart track')
                    .setDescription('Seek to the start.')
                    .setValue('feature_restart'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Statistics')
                    .setDescription('Queue length, duration, voice channel.')
                    .setValue('feature_stats')
            )
    );

    return [row1, row2, row3, row4];
}

function buildQueueEmbed(player, limit = 10) {
    const current = player.queue.current;
    const tracks = player.queue.slice(0, limit);
    let description = '';

    if (current) {
        const t = sanitizeLinkLabel(current.title, 180);
        description += `**Now playing**\n[${t}](${current.uri}) · ${formatDuration(current.length)}\n\n`;
    }

    if (tracks.length > 0) {
        description += '**Up next**\n';
        tracks.forEach((track, index) => {
            const t = sanitizeLinkLabel(track.title, 120);
            description += `${index + 1}. [${t}](${track.uri}) · ${formatDuration(track.length)}\n`;
        });
    }

    if (player.queue.length > limit) {
        description += `\n*+${player.queue.length - limit} more*`;
    }

    const totalTracks = (current ? 1 : 0) + player.queue.length;

    return new EmbedBuilder()
        .setColor(ACCENT)
        .setTitle('Queue')
        .setDescription(description || 'Nothing in the queue.')
        .setFooter({ text: `${totalTracks} track(s) total` });
}

function buildNowPlayingEmbed(player) {
    const track = player.queue.current;
    const progressBar = createProgressBar(player.position, track.length, 14);
    const titleSafe = sanitizeLinkLabel(track.title, 180);

    return new EmbedBuilder()
        .setColor(ACCENT)
        .setTitle('Now playing')
        .setDescription(
            `**[${titleSafe}](${track.uri})**\n\n` +
                `${progressBar}\n` +
                `\`${formatDuration(player.position)}\` / \`${formatDuration(track.length)}\``
        )
        .setThumbnail(track.thumbnail || null)
        .addFields(
            { name: 'Artist', value: (track.author || 'Unknown').slice(0, 1024), inline: true },
            { name: 'Requested by', value: track.requester?.tag || 'Unknown', inline: true },
            { name: 'Volume', value: `${player.volume}%`, inline: true },
            { name: 'Loop', value: formatLoopMode(player.loop), inline: true },
            { name: 'Status', value: player.paused ? 'Paused' : 'Playing', inline: true }
        );
}

function buildTrackDetailsEmbed(track, index) {
    const titleSafe = sanitizeLinkLabel(track.title, 180);

    return new EmbedBuilder()
        .setColor(ACCENT)
        .setTitle(`Track ${index + 1}`)
        .setDescription(`**[${titleSafe}](${track.uri})**`)
        .addFields(
            { name: 'Artist', value: (track.author || 'Unknown').slice(0, 1024), inline: true },
            { name: 'Duration', value: formatDuration(track.length), inline: true },
            { name: 'Requested by', value: track.requester?.tag || 'Unknown', inline: true }
        )
        .setThumbnail(track.thumbnail || null);
}

function buildStatsEmbed(player) {
    const current = player.queue.current;
    const totalQueueDuration = player.queue.reduce((sum, t) => sum + t.length, 0);
    const currentTitle = current?.title ? sanitizeLinkLabel(current.title, 1024) : 'None';

    return new EmbedBuilder()
        .setColor(ACCENT)
        .setTitle('Player stats')
        .addFields(
            { name: 'Current track', value: currentTitle, inline: false },
            { name: 'Volume', value: `${player.volume}%`, inline: true },
            { name: 'Loop', value: formatLoopMode(player.loop), inline: true },
            { name: 'Status', value: player.paused ? 'Paused' : 'Playing', inline: true },
            { name: 'Upcoming', value: `${player.queue.length} track(s)`, inline: true },
            { name: 'Queue duration', value: formatDuration(totalQueueDuration), inline: true },
            { name: 'Voice', value: `<#${player.voiceId}>`, inline: true }
        );
}

module.exports = {
    buildPlayerEmbed,
    buildPlayerComponents,
    buildQueueEmbed,
    buildNowPlayingEmbed,
    buildTrackDetailsEmbed,
    buildStatsEmbed
};
