# 🎵 Rust Music Bot

A lightweight, blazing-fast Discord music bot written in Rust. Designed to consume minimal RAM and CPU, making it perfect for free or cheap hosting on platforms like Railway.

## ✨ Features
- Plays audio directly from YouTube URLs.
- Supports modern Discord `/play` slash commands.
- Supports classic `!play` prefix commands.
- Extremely low resource footprint.

## 🚀 Usage Commands
- `!join` or `/join` : Brings the bot into your current voice channel.
- `!play <URL>` or `/play <URL>` : Plays the audio from the provided YouTube link.
- `!leave` or `/leave` : Stops the music and kicks the bot from the channel.

## 🛠️ Setup & Deployment
1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and grab your Bot Token.
2. Enable the **Message Content Intent** in the Discord portal (required for `!` commands to function).
3. Clone this repository and push it to your own GitHub account.
4. Go to [Railway](https://railway.app/), create a New Project, and select **Deploy from GitHub repo**.
5. Once created, immediately go to the **Variables** tab in Railway.
6. Add a new variable named `DISCORD_TOKEN` and paste your bot token.
7. Railway will install FFmpeg, compile the Rust code, and start your bot automatically!