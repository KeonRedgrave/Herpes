# Herpes Discord Music Bot

A Discord music bot built with `discord.js` and `Lavalink`. The repository is configured for Railway deployment using the Railway CLI.

## Features
- Slash commands: `/play`, `/skip`, `/stop`
- Lavalink audio backend
- Local Lavalink download during install
- Railway-compatible startup via `Procfile`

## Required environment variables
- `DISCORD_TOKEN` - Discord bot token
- `DISCORD_CLIENT_ID` - Bot application client ID
- `DISCORD_GUILD_ID` - (recommended) Guild ID for fast slash command registration
- `LAVALINK_PASSWORD` - Lavalink password (defaults to `youshallnotpass`)
- `LAVALINK_PORT` - Lavalink port (defaults to `2333`)

## Local setup
1. Install dependencies:
   `npm install`
2. Create a `.env` file with the required variables.
3. Start locally:
   `npm run start:lavalink`

If you are using an external Lavalink host in production (for Railway or other hosted services), use:
   `npm start`

## Railway deployment
1. Install Railway CLI: `npm install -g @railway/cli`
2. Login: `railway login`
3. Initialize project: `railway init`
4. Set required environment variables in Railway:
   - `DISCORD_TOKEN`
   - `DISCORD_CLIENT_ID`
   - `DISCORD_GUILD_ID`
   - `LAVALINK_PASSWORD`
5. Deploy:
   `railway up`

If Railway is not using the `Procfile`, set the start command to:
`npm run start:lavalink`
