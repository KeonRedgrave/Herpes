# AGENT.md

## Project
Discord music bot using:
- `discord.js`
- `kazagumo`
- `shoukaku`
- Lavalink

Main purpose:
- Join a Discord voice channel
- Search/play tracks
- Manage queue, volume, shuffle, loop
- Show an interactive player panel
- Recover from Lavalink disconnects without requiring a full bot restart

## Current Entry Points
- `index.js`
  Thin bootstrap. Loads `./src`.
- `src/index.js`
  Creates the Discord client, loads config, constructs runtime/actions, binds interactions, registers slash commands, and starts initial reconnect logic.

## Current Architecture
- `src/config.js`
  Environment loading and validation.
- `src/commands.js`
  Slash command manifest.
- `src/utils.js`
  Shared helpers like delay, duration formatting, progress bar, endpoint normalization.
- `src/music/errors.js`
  Error classifiers for session expiry, destroyed players, and bad player updates.
- `src/music/compat.js`
  Shoukaku compatibility patch layer.
  Important: this normalizes voice endpoints and patches `sendServerUpdate()`.
- `src/music/runtime.js`
  Core runtime and the most important file.
  Owns:
  - Lavalink/Kazagumo setup
  - node lifecycle
  - reconnect scheduling
  - per-guild snapshots
  - resume flow
  - player message lifecycle
  - player safety wrappers
- `src/actions.js`
  Shared playback mutations.
  Slash commands and component interactions should route through here instead of duplicating business logic.
- `src/interactions.js`
  Discord interaction routing for slash commands, buttons, and select menus.
- `src/ui/playerView.js`
  Player embed/components and queue/nowplaying/stats view builders.

## Latest Refactor Summary
This project originally had almost everything in one large `index.js`.

Latest changes made:
- Replaced the monolithic entrypoint with a modular `src/` runtime.
- Moved reconnect/resume ownership into `src/music/runtime.js`.
- Centralized playback mutations in `src/actions.js`.
- Centralized Discord routing in `src/interactions.js`.
- Isolated player UI rendering in `src/ui/playerView.js`.
- Added tests in `test/`.

## Reliability Changes Already Implemented
These were the main reasons for the refactor and should be preserved:

1. `/play` is gated while node/guild recovery is in progress.
   Goal:
   prevent new queue/player mutations from entering a half-broken Lavalink session.

2. Resume retries are tracked per guild instead of globally.
   Goal:
   one broken guild should not block or consume retries for others.

3. Recovery snapshots are replaceable.
   Goal:
   avoid replaying stale queue/current-track state forever.

4. Reconnect is event-driven.
   Goal:
   avoid the old mixed polling + event reconnect flow that caused loops and race conditions.

5. A ready-timeout watchdog exists.
   Goal:
   if Lavalink never becomes fully healthy after node add/startup, recovery is retried instead of hanging indefinitely.

## Important Behavior Constraints
Future changes should preserve these unless intentionally redesigning them:
- Keep slash commands:
  - `/play`
  - `/skip`
  - `/stop`
  - `/pause`
  - `/resume`
  - `/queue`
  - `/nowplaying`
  - `/volume`
  - `/shuffle`
  - `/loop`
  - `/join`
  - `/leave`
- Keep the player panel interactive.
- Keep the bot in voice after queue empty unless explicitly redesigning that behavior.
- Do not reintroduce fake controls.
  Placeholder favorites and fake seek UI were intentionally removed.
- Do not reintroduce a global reconnect polling loop unless there is a very strong reason and proper proof.

## Known Sensitive Areas
- `src/music/runtime.js`
  Any change here can affect reconnect loops, stale players, resume behavior, or command safety.
- `src/music/compat.js`
  This depends on library internals. Re-check after upgrading `shoukaku` or `kazagumo`.
- Any code that directly mutates:
  - `kazagumo.players`
  - `kazagumo.shoukaku.players`
  - `kazagumo.shoukaku.connections`
  Direct cleanup is sometimes necessary, but should remain a controlled fallback, not casual flow.

## Before Editing
If changing reconnect, resume, or `/play` behavior:
- read `src/music/runtime.js`
- read `src/actions.js`
- verify that recovery gating still blocks unsafe mutations
- verify snapshots are invalidated/replaced correctly

If changing UI/components:
- read `src/ui/playerView.js`
- read `src/interactions.js`
- keep button/select IDs aligned with handlers

## Lavalink (hosted)
- Self-hosted Lavalink should use the official **[youtube-source](https://github.com/lavalink-devs/youtube-source)** plugin with built-in `sources.youtube: false`.
- Recommended client order for **`youtube-plugin` 1.18+**: start with **`TVHTML5_SIMPLY`**, then fall back to `WEB`, `WEBEMBEDDED`, `ANDROID_VR`, and optionally `TV` last when OAuth is enabled. See [README.md](README.md) § Railway / YouTube plugin.

## Run / Verify
- Install: `npm install`
- Start: `npm start`
- Dev: `npm run dev`
- Test: `npm test`

Recommended verification after runtime changes:
- bot startup with Lavalink available
- `/play`
- `/pause` and `/resume`
- `/skip`, `/stop`, `/leave`
- Lavalink drop during playback
- automatic reconnect
- automatic resume
- `/play` during recovery should be rejected cleanly, not partially accepted

## Notes For Future Agents
- Prefer editing existing modular files rather than collapsing logic back into one file.
- Prefer one authoritative action path for playback mutations.
- Prefer explicit lifecycle state over loose boolean flags.
- If upgrading Lavalink or Shoukaku behavior, verify session semantics and voice update requirements carefully.
