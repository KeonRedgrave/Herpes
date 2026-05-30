# Discord Music Bot

A feature-rich Discord music bot built with discord.js and discord-player.

## Features

- 🎵 Play music from YouTube and other sources
- ⏭️ Skip tracks
- ⏹️ Stop playback
- 📋 View queue
- 🔊 High-quality audio streaming

## Setup

### Prerequisites

- Discord bot token (create one at [Discord Developer Portal](https://discord.com/developers/applications))
- Node.js 20+

### Local Setup

1. Clone the repository:
```bash
git clone https://github.com/KeonRedgrave/Herpes.git
cd Herpes
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file:
```bash
cp .env.example .env
```

4. Add your Discord bot token to `.env`:
```
DISCORD_TOKEN=your_bot_token_here
```

5. Run the bot:
```bash
npm start
```

### Railway Deployment

The bot is automatically deployed to Railway. Set the `DISCORD_TOKEN` environment variable in your Railway service:

1. Go to your Railway project dashboard
2. Select the Herpes service
3. Navigate to Variables
4. Add `DISCORD_TOKEN` with your bot token
5. The service will automatically redeploy

## Commands

| Command | Description |
|---------|-------------|
| `!play <query>` | Play a song (YouTube search) |
| `!skip` | Skip to the next track |
| `!stop` | Stop music and clear queue |
| `!queue` | Show current queue |
| `!help` | Show all commands |
| `!ping` | Check bot latency |

## Usage Examples

```
!play Never Gonna Give You Up
!skip
!queue
!stop
```

## Creating a Discord Bot

1. Visit [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Go to "Bot" tab → "Add Bot"
4. Copy the token (this is your `DISCORD_TOKEN`)
5. Enable these Intents:
   - Message Content Intent
   - Server Members Intent
6. Go to "OAuth2" → "URL Generator"
7. Select scopes: `bot`
8. Select permissions: `Send Messages`, `Connect`, `Speak`
9. Use the generated URL to invite the bot to your server

## Troubleshooting

**Bot won't start:**
- Verify `DISCORD_TOKEN` is set correctly
- Check that the token is valid (hasn't been regenerated)

**Music won't play:**
- Ensure bot has permission to connect and speak in voice channels
- Try a different search query
- Check bot logs on Railway dashboard

**Bot not responding:**
- Make sure Message Content Intent is enabled in Developer Portal
- Verify bot has permission to send messages

## Support

For issues, please check the [Discord.js documentation](https://discord.js.org/) and [discord-player documentation](https://discord-player.js.org/).