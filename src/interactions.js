const { EmbedBuilder, Events } = require('discord.js');
const { buildNowPlayingEmbed, buildQueueEmbed, buildStatsEmbed, buildTrackDetailsEmbed } = require('./ui/playerView');

function successEmbed(description, color = 0x00FF00) {
    return new EmbedBuilder().setColor(color).setDescription(description);
}

function errorEmbed(description) {
    return new EmbedBuilder().setColor(0xFF0000).setDescription(description);
}

function warningEmbed(description) {
    return new EmbedBuilder().setColor(0xFFFF00).setDescription(description);
}

async function sendAutoDeleteReply(interaction, embed, options = {}) {
    const payload = { embeds: [embed], ...options };
    const deleteAfterMs = options.deleteAfterMs || 5000;

    if (interaction.deferred || interaction.replied) {
        await interaction.editReply(payload);
        setTimeout(() => interaction.deleteReply().catch(() => { }), deleteAfterMs);
        return;
    }

    await interaction.reply(payload);
    setTimeout(() => interaction.deleteReply().catch(() => { }), deleteAfterMs);
}

function requireVoice(interaction) {
    if (!interaction.member?.voice?.channel) {
        return errorEmbed('❌ You need to be in a voice channel!');
    }
    return null;
}

function getPlayer(runtime, guildId) {
    return runtime.getLivePlayer(guildId) || runtime.kazagumo.players.get(guildId) || null;
}

function bindInteractions(client, runtime, actions) {
    client.on(Events.InteractionCreate, async interaction => {
        try {
            if (interaction.isChatInputCommand()) {
                await handleSlash(interaction, runtime, actions);
                return;
            }

            if (interaction.isButton()) {
                await handleButton(interaction, runtime, actions);
                return;
            }

            if (interaction.isStringSelectMenu()) {
                await handleSelect(interaction, runtime, actions);
            }
        } catch (error) {
            console.error('[Interaction]', error);
            try {
                await sendAutoDeleteReply(interaction, errorEmbed(`❌ Error: ${error.message || error}`));
            } catch {
                // Ignore reply failures after interaction expiry.
            }
        }
    });
}

async function handleSlash(interaction, runtime, actions) {
    const { commandName, guild, channel } = interaction;
    const voiceChannel = interaction.member?.voice?.channel;

    if (['play', 'skip', 'stop', 'pause', 'resume', 'shuffle', 'join', 'leave'].includes(commandName)) {
        const voiceError = requireVoice(interaction);
        if (voiceError) {
            await sendAutoDeleteReply(interaction, voiceError);
            return;
        }
    }

    const player = getPlayer(runtime, guild.id);

    switch (commandName) {
        case 'play': {
            await interaction.deferReply();
            const result = await actions.playQuery({
                guild,
                channel,
                voiceChannel,
                query: interaction.options.getString('query'),
                requester: interaction.user
            });

            if (!result.ok) {
                await sendAutoDeleteReply(interaction, warningEmbed(result.message));
                return;
            }

            const embed = result.data.type === 'PLAYLIST'
                ? successEmbed(`📋 Added **${result.data.playlistCount}** tracks from playlist: **${result.data.playlistName}**`)
                : successEmbed(
                    result.data.alreadyPlaying
                        ? `✅ Added to queue: **[${result.data.track.title}](${result.data.track.uri})**`
                        : '🎵 Starting playback...'
                );

            await sendAutoDeleteReply(interaction, embed);
            return;
        }

        case 'skip': {
            if (!player?.playing) {
                await sendAutoDeleteReply(interaction, errorEmbed('❌ Nothing is playing!'));
                return;
            }
            const result = await actions.skip(player);
            await sendAutoDeleteReply(interaction, result.ok ? successEmbed('⏭️ Skipped!') : errorEmbed(result.message));
            return;
        }

        case 'stop': {
            if (!player) {
                await sendAutoDeleteReply(interaction, errorEmbed('❌ Nothing is playing!'));
                return;
            }
            await actions.stop(player);
            await sendAutoDeleteReply(interaction, successEmbed('⏹️ Stopped and cleared the queue!'));
            return;
        }

        case 'pause': {
            if (!player?.playing) {
                await sendAutoDeleteReply(interaction, errorEmbed('❌ Nothing is playing!'));
                return;
            }
            const result = await actions.pause(player);
            await sendAutoDeleteReply(interaction, result.ok ? warningEmbed('⏸️ Paused!') : errorEmbed(result.message));
            return;
        }

        case 'resume': {
            if (!player?.paused) {
                await sendAutoDeleteReply(interaction, errorEmbed('❌ Nothing is paused!'));
                return;
            }
            const result = await actions.resume(player);
            await sendAutoDeleteReply(interaction, result.ok ? successEmbed('▶️ Resumed!') : errorEmbed(result.message));
            return;
        }

        case 'queue': {
            if (!player || (!player.queue.current && player.queue.length === 0)) {
                await sendAutoDeleteReply(interaction, warningEmbed('📭 Queue is empty!'));
                return;
            }
            await sendAutoDeleteReply(interaction, buildQueueEmbed(player));
            return;
        }

        case 'nowplaying': {
            if (!player?.queue.current) {
                await sendAutoDeleteReply(interaction, errorEmbed('❌ Nothing is playing!'));
                return;
            }
            await sendAutoDeleteReply(interaction, buildNowPlayingEmbed(player));
            return;
        }

        case 'volume': {
            if (!player) {
                await sendAutoDeleteReply(interaction, errorEmbed('❌ Nothing is playing!'));
                return;
            }
            const result = await actions.setVolume(player, interaction.options.getInteger('level'));
            await sendAutoDeleteReply(interaction, result.ok ? successEmbed(`🔊 Volume set to **${result.data.level}%**`) : errorEmbed(result.message));
            return;
        }

        case 'shuffle': {
            if (!player || player.queue.length < 2) {
                await sendAutoDeleteReply(interaction, errorEmbed('❌ Need at least 2 songs in queue to shuffle!'));
                return;
            }
            await actions.shuffle(player);
            await sendAutoDeleteReply(interaction, successEmbed('🔀 Queue shuffled!'));
            return;
        }

        case 'loop': {
            if (!player) {
                await sendAutoDeleteReply(interaction, errorEmbed('❌ Nothing is playing!'));
                return;
            }
            const mode = interaction.options.getString('mode');
            const result = await actions.setLoop(player, mode);
            const modeText = mode === 'none' ? 'Off' : mode === 'track' ? 'Track' : 'Queue';
            await sendAutoDeleteReply(interaction, result.ok ? successEmbed(`🔁 Loop mode: **${modeText}**`) : errorEmbed(result.message));
            return;
        }

        case 'join': {
            const result = await actions.joinVoice({ guild, channel, voiceChannel });
            await sendAutoDeleteReply(
                interaction,
                result.ok
                    ? successEmbed(`✅ Joined <#${voiceChannel.id}>! I will stay here until you use \`/leave\`.`)
                    : warningEmbed(result.message)
            );
            return;
        }

        case 'leave': {
            if (!player) {
                await sendAutoDeleteReply(interaction, errorEmbed('❌ Not in a voice channel!'));
                return;
            }
            await actions.leaveVoice({ guildId: guild.id, player });
            await sendAutoDeleteReply(interaction, successEmbed('👋 Left the voice channel!'));
            return;
        }

        default:
            return;
    }
}

async function handleButton(interaction, runtime, actions) {
    const { customId, guild } = interaction;
    if (!customId.startsWith('player_')) return;

    const voiceError = requireVoice(interaction);
    if (voiceError) {
        await sendAutoDeleteReply(interaction, voiceError);
        return;
    }

    const player = getPlayer(runtime, guild.id);
    if (!player) {
        await sendAutoDeleteReply(interaction, errorEmbed('❌ No music is playing!'));
        return;
    }

    switch (customId) {
        case 'player_previous': {
            if (!player.queue.current) return;
            const result = await actions.restart(player);
            await sendAutoDeleteReply(interaction, result.ok ? successEmbed('⏮️ Restarted current track!') : errorEmbed(result.message));
            return;
        }

        case 'player_pause': {
            const wasPaused = player.paused;
            const result = wasPaused ? await actions.resume(player) : await actions.pause(player);
            await sendAutoDeleteReply(
                interaction,
                result.ok ? (wasPaused ? successEmbed('▶️ Resumed!') : warningEmbed('⏸️ Paused!')) : errorEmbed(result.message)
            );
            return;
        }

        case 'player_skip': {
            const result = await actions.skip(player);
            await sendAutoDeleteReply(interaction, result.ok ? successEmbed('⏭️ Skipped!') : errorEmbed(result.message));
            return;
        }

        case 'player_stop':
            await actions.stop(player);
            await sendAutoDeleteReply(interaction, successEmbed('⏹️ Stopped and cleared the queue!'));
            return;

        case 'player_shuffle': {
            if (player.queue.length < 2) {
                await sendAutoDeleteReply(interaction, errorEmbed('❌ Need at least 2 songs to shuffle!'));
                return;
            }
            await actions.shuffle(player);
            await sendAutoDeleteReply(interaction, successEmbed('🔀 Queue shuffled!'));
            return;
        }

        case 'player_voldown': {
            const result = await actions.changeVolume(player, -10);
            await sendAutoDeleteReply(interaction, result.ok ? successEmbed(`🔉 Volume: **${result.data.level}%**`) : errorEmbed(result.message));
            return;
        }

        case 'player_volup': {
            const result = await actions.changeVolume(player, 10);
            await sendAutoDeleteReply(interaction, result.ok ? successEmbed(`🔊 Volume: **${result.data.level}%**`) : errorEmbed(result.message));
            return;
        }

        case 'player_loop': {
            const result = await actions.cycleLoop(player);
            if (!result.ok) {
                await sendAutoDeleteReply(interaction, errorEmbed(result.message));
                return;
            }
            const mode = result.data.mode;
            const modeText = mode === 'none' ? '➡️ Off' : mode === 'track' ? '🔂 Track' : '🔁 Queue';
            await sendAutoDeleteReply(interaction, successEmbed(`Loop: **${modeText}**`));
            return;
        }

        case 'player_queue': {
            if (!player.queue.current && player.queue.length === 0) {
                await sendAutoDeleteReply(interaction, warningEmbed('📭 Queue is empty!'));
                return;
            }
            await sendAutoDeleteReply(interaction, buildQueueEmbed(player, 5));
            return;
        }

        default:
            return;
    }
}

async function handleSelect(interaction, runtime, actions) {
    const { customId, guild, values } = interaction;
    const player = getPlayer(runtime, guild.id);
    if (!player) {
        await sendAutoDeleteReply(interaction, errorEmbed('❌ No music is playing!'));
        return;
    }

    const selectedValue = values[0];

    if (customId === 'player_tracks') {
        if (selectedValue === 'no_tracks') {
            await sendAutoDeleteReply(interaction, warningEmbed('📭 No tracks in queue! Use `/play` to add songs.'));
            return;
        }

        const trackIndex = Number.parseInt(selectedValue.replace('track_', ''), 10);
        const track = player.queue[trackIndex];
        if (!track) {
            await sendAutoDeleteReply(interaction, errorEmbed('❌ Track not found.'));
            return;
        }

        await sendAutoDeleteReply(interaction, buildTrackDetailsEmbed(track, trackIndex));
        return;
    }

    if (customId !== 'player_features') return;

    switch (selectedValue) {
        case 'feature_nowplaying':
            if (!player.queue.current) {
                await sendAutoDeleteReply(interaction, errorEmbed('❌ Nothing is playing!'));
                return;
            }
            await sendAutoDeleteReply(interaction, buildNowPlayingEmbed(player));
            return;

        case 'feature_clear': {
            const result = await actions.clearQueue(player);
            await sendAutoDeleteReply(interaction, successEmbed(`🗑️ Cleared **${result.data.queueLength}** tracks from the queue!`, 0xFF0000));
            return;
        }

        case 'feature_restart': {
            const result = await actions.restart(player);
            await sendAutoDeleteReply(interaction, result.ok ? successEmbed('🔄 Restarted the current track!') : errorEmbed(result.message));
            return;
        }

        case 'feature_stats':
            await sendAutoDeleteReply(interaction, buildStatsEmbed(player));
            return;

        default:
            return;
    }
}

module.exports = {
    bindInteractions
};
