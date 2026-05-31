require('dotenv/config');
const { Client, GatewayIntentBits, Events, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { Manager } = require('erela.js');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;
const LAVALINK_HOST = process.env.LAVALINK_HOST || '127.0.0.1';
const LAVALINK_PORT = parseInt(process.env.LAVALINK_PORT, 10) || 2333;
const LAVALINK_PASSWORD = process.env.LAVALINK_PASSWORD || 'youshallnotpass';
const LAVALINK_SECURE = LAVALINK_HOST.endsWith('.railway.internal')
  ? false
  : process.env.LAVALINK_SECURE === 'true';

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID) {
  console.error('Missing required environment variables: DISCORD_TOKEN and DISCORD_CLIENT_ID.');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

const manager = new Manager({
  nodes: [
    {
      identifier: 'local',
      host: LAVALINK_HOST,
      port: LAVALINK_PORT,
      password: LAVALINK_PASSWORD,
      secure: LAVALINK_SECURE,
      retryAmount: 5,
      retryDelay: 3000,
    },
  ],
  send(id, payload) {
    const guild = client.guilds.cache.get(id);
    if (guild) guild.shard.send(payload);
  },
});

function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName('play')
      .setDescription('Play a song or playlist')
      .addStringOption(option => option
        .setName('query')
        .setDescription('Song name or URL')
        .setRequired(true)),
    new SlashCommandBuilder()
      .setName('skip')
      .setDescription('Skip the current track'),
    new SlashCommandBuilder()
      .setName('stop')
      .setDescription('Stop playback and disconnect'),
  ].map(command => command.toJSON());

  if (!DISCORD_GUILD_ID) {
    console.warn('DISCORD_GUILD_ID not set. Registering global commands may take up to an hour.');
  }

  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  const route = DISCORD_GUILD_ID
    ? Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID)
    : Routes.applicationCommands(DISCORD_CLIENT_ID);

  rest.put(route, { body: commands })
    .then(() => console.log('Slash commands registered.'))
    .catch(console.error);
}

function createPlayer(interaction) {
  const voiceChannel = interaction.member.voice.channel;
  if (!voiceChannel) {
    throw new Error('You must be in a voice channel to play music.');
  }

  const player = manager.create({
    guild: interaction.guild.id,
    voiceChannel: voiceChannel.id,
    textChannel: interaction.channel.id,
    selfDeaf: true,
  });

  if (!player.connected) player.connect();
  return player;
}

async function handlePlay(interaction) {
  const query = interaction.options.getString('query', true);
  const member = interaction.member;
  if (!member.voice.channel) {
    return interaction.reply({ content: 'You need to join a voice channel first.', ephemeral: true });
  }

  let player = manager.players.get(interaction.guild.id);
  if (!player) player = createPlayer(interaction);
  player.set('interaction', interaction);

  const search = await manager.search(query, interaction.user);
  if (search.loadType === 'NO_MATCHES' || search.loadType === 'LOAD_FAILED') {
    return interaction.reply({ content: 'No results found for that query.', ephemeral: true });
  }

  if (search.playlist) {
    player.queue.add(search.tracks);
  } else {
    player.queue.add(search.tracks[0]);
  }

  if (!player.playing && !player.paused && player.queue.totalSize > 0) {
    player.play();
  }

  const nextTrack = search.tracks[0];
  return interaction.reply({ content: `Queued: **${nextTrack.title}**` });
}

async function handleSkip(interaction) {
  const player = manager.players.get(interaction.guild.id);
  if (!player || !player.queue.current) {
    return interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
  }

  player.stop();
  return interaction.reply({ content: 'Skipped the current track.' });
}

async function handleStop(interaction) {
  const player = manager.players.get(interaction.guild.id);
  if (!player) {
    return interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
  }

  player.destroy();
  return interaction.reply({ content: 'Stopped playback and disconnected.' });
}

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  registerCommands();
  manager.init(client.user.id);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === 'play') {
      await handlePlay(interaction);
    } else if (interaction.commandName === 'skip') {
      await handleSkip(interaction);
    } else if (interaction.commandName === 'stop') {
      await handleStop(interaction);
    }
  } catch (error) {
    console.error('Command error:', error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: 'An error occurred while processing your command.', ephemeral: true });
    } else {
      await interaction.reply({ content: 'An error occurred while processing your command.', ephemeral: true });
    }
  }
});

manager.on('nodeConnect', node => {
  console.log(`Lavalink node connected: ${node.options.identifier}`);
});

manager.on('nodeError', (node, error) => {
  console.error(`Lavalink node error: ${error.message}`);
});

manager.on('trackStart', (player, track) => {
  const channel = client.channels.cache.get(player.textChannel);
  if (channel) channel.send(`:notes: Now playing: **${track.title}**`);
});

manager.on('queueEnd', player => {
  const channel = client.channels.cache.get(player.textChannel);
  if (channel) channel.send('Queue ended. Goodbye!');
  player.destroy();
});

client.login(DISCORD_TOKEN);
