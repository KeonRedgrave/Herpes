const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder } = require('discord.js');
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
const commands = [];

// Register slash commands
const playCommand = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Play a song')
  .addStringOption(option =>
    option.setName('query')
      .setDescription('Song name or YouTube URL')
      .setRequired(true)
  );

const skipCommand = new SlashCommandBuilder()
  .setName('skip')
  .setDescription('Skip the current track');

const stopCommand = new SlashCommandBuilder()
  .setName('stop')
  .setDescription('Stop music and clear the queue');

const queueCommand = new SlashCommandBuilder()
  .setName('queue')
  .setDescription('Show the current queue');

const pingCommand = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Check bot latency');

commands.push(playCommand, skipCommand, stopCommand, queueCommand, pingCommand);

client.on('ready', async () => {
  console.log(`✓ Bot logged in as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: '/play - Music Bot' }],
    status: 'online'
  });

  // Register slash commands
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    console.log('Registering slash commands...');
    
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands.map(cmd => cmd.toJSON()) }
    );
    
    console.log('✓ Slash commands registered successfully');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === 'play') {
      if (!interaction.member.voice.channel) {
        return interaction.reply({ content: '❌ You must be in a voice channel to play music!', ephemeral: true });
      }

      await interaction.deferReply();
      const query = interaction.options.getString('query');

      const { track } = await player.play(interaction.member.voice.channel, query, {
        nodeOptions: {
          metadata: interaction
        }
      });

      const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('🎵 Now Playing')
        .setDescription(`**${track.title}**`)
        .addFields(
          { name: 'Artist', value: track.author || 'Unknown', inline: true },
          { name: 'Duration', value: track.duration || '0:00', inline: true }
        );

      interaction.editReply({ embeds: [embed] });
    }

    if (interaction.commandName === 'skip') {
      const queue = player.queues.cache.get(interaction.guildId);
      if (!queue) {
        return interaction.reply({ content: '❌ No music is playing!', ephemeral: true });
      }

      const current = queue.currentTrack;
      queue.node.skip();
      interaction.reply(`⏭️ Skipped **${current?.title}**`);
    }

    if (interaction.commandName === 'stop') {
      const queue = player.queues.cache.get(interaction.guildId);
      if (!queue) {
        return interaction.reply({ content: '❌ No music is playing!', ephemeral: true });
      }

      queue.delete();
      interaction.reply('⏹️ Music stopped.');
    }

    if (interaction.commandName === 'queue') {
      const queue = player.queues.cache.get(interaction.guildId);
      if (!queue || queue.tracks.length === 0) {
        return interaction.reply({ content: '❌ Queue is empty!', ephemeral: true });
      }

      const tracks = queue.tracks.slice(0, 10);
      const display = tracks.map((t, i) => `${i + 1}. **${t.title}** by ${t.author}`).join('\n');
      
      const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('📋 Queue')
        .setDescription(display)
        .setFooter({ text: `Total: ${queue.tracks.length} tracks` });

      interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'ping') {
      interaction.reply(`🏓 Pong! ${client.ws.ping}ms`);
    }
  } catch (error) {
    console.error('Interaction error:', error);
    if (interaction.deferred) {
      interaction.editReply({ content: '❌ An error occurred.' });
    } else {
      interaction.reply({ content: '❌ An error occurred.', ephemeral: true });
    }
  }
});

player.events.on('error', (queue, error) => {
  console.error('Player error:', error);
});

player.events.on('playerError', (queue, error) => {
  console.error('Player error:', error);
});

client.login(process.env.DISCORD_TOKEN);
