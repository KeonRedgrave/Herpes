const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const { useMainPlayer } = require('discord-player');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const player = useMainPlayer();

client.on('ready', () => {
  console.log(`✓ Bot logged in as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: '/play - Music Bot' }],
    status: 'online'
  });
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content === '!ping') {
    return message.reply(`Pong! ${client.ws.ping}ms`);
  }

  if (message.content.startsWith('!play ')) {
    if (!message.member.voice.channel) {
      return message.reply('❌ You must be in a voice channel to play music!');
    }

    const query = message.content.slice(6);
    try {
      const { track } = await player.play(message.member.voice.channel, query, {
        nodeOptions: {
          metadata: message
        }
      });

      message.reply(`🎵 Now playing: **${track.title}** by ${track.author}`);
    } catch (error) {
      console.error('Play error:', error);
      message.reply('❌ Error playing music. Please try again.');
    }
  }

  if (message.content === '!stop') {
    const queue = player.queues.cache.get(message.guildId);
    if (!queue) {
      return message.reply('❌ No music is playing!');
    }
    queue.delete();
    message.reply('⏹️ Music stopped.');
  }

  if (message.content === '!skip') {
    const queue = player.queues.cache.get(message.guildId);
    if (!queue) {
      return message.reply('❌ No music is playing!');
    }
    const current = queue.currentTrack;
    queue.node.skip();
    message.reply(`⏭️ Skipped **${current?.title}**`);
  }

  if (message.content === '!queue') {
    const queue = player.queues.cache.get(message.guildId);
    if (!queue || queue.tracks.length === 0) {
      return message.reply('❌ Queue is empty!');
    }

    const tracks = queue.tracks.slice(0, 10);
    const display = tracks.map((t, i) => `${i + 1}. **${t.title}** by ${t.author}`).join('\n');
    message.reply(`📋 **Queue** (${queue.tracks.length} tracks):\n${display}`);
  }

  if (message.content === '!help') {
    const help = `
🎵 **Music Bot Commands:**
\`!play <query>\` - Play a song
\`!skip\` - Skip current track
\`!stop\` - Stop music
\`!queue\` - Show queue
\`!ping\` - Bot latency
    `.trim();
    message.reply(help);
  }
});

player.events.on('error', (queue, error) => {
  console.error('Player error:', error);
});

player.events.on('playerError', (queue, error) => {
  console.error('Player error:', error);
});

client.login(process.env.DISCORD_TOKEN);
