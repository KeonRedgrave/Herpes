const { Client, Events, GatewayIntentBits } = require('discord.js');
const { createActions } = require('./actions');
const { commands } = require('./commands');
const { loadConfig } = require('./config');
const { bindInteractions } = require('./interactions');
const { MusicRuntime } = require('./music/runtime');

const config = loadConfig();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages
    ]
});

const runtime = new MusicRuntime(client, config);
const actions = createActions(runtime);

client.on(Events.ClientReady, async () => {
    console.log(`Logged in as ${client.user.tag}`);
    try {
        await client.application.commands.set(commands);
        console.log('Slash commands registered.');
    } catch (error) {
        console.error('Failed to register slash commands:', error);
    }

    runtime.armReadyTimer();
    runtime.attemptReconnect().catch(error => {
        console.error('[Startup reconnect]', error);
    });
});

bindInteractions(client, runtime, actions);

client.login(config.discordToken);
