# 🎵 Discord Music Bot

**🌐 Bahasa: [English](README.md) | [Indonesia](README_ID.md) | [日本語](README_jp.md)**

---

Bot musik Discord dengan fitur lengkap, didukung oleh Lavalink untuk streaming audio berkualitas tinggi. Terinspirasi dari bot Boogie dengan panel player interaktif yang cantik!

## ✨ Fitur

### 🎶 Fitur Musik Utama
- 🎵 Play musik dari YouTube (search atau URL langsung)
- 📋 Sistem queue dengan shuffle
- 🔁 Mode loop (track / queue / off)
- 🔊 Kontrol volume (0-100%)
- ⏯️ Pause, Resume, Skip, Stop
- 📊 Now Playing dengan progress bar real-time
- 🎧 Tetap di voice channel (tidak auto-leave)

### 🎛️ Panel Player Interaktif (Gaya Boogie)
- **Progress Bar Real-time** - Update setiap 10 detik menampilkan posisi saat ini
- **Hitungan Queue Live** - Update langsung saat lagu ditambahkan
- **Tombol Kontrol:**
  - ⏮️ Restart Track
  - ⏸️/▶️ Pause/Resume (ikon dinamis)
  - ⏭️ Skip
  - ⏹️ Stop
  - 🔀 Shuffle
  - 🔉/🔊 Volume Turun/Naik
  - 🔁 Loop (berubah warna saat aktif)
  - 📋 Lihat Queue

### 📀 Menu Dropdown
- **Lihat Track Queue** - Jelajahi hingga 25 track dalam queue
- **Fitur Lainnya:**
  - 🎵 Info Now Playing detail
  - 🗑️ Clear Queue
  - 🔄 Restart Track
  - 📊 Statistik Player

### 🧹 Pengalaman Chat Bersih
- Semua pesan bot otomatis terhapus setelah 5 detik
- Panel player tetap ada (edit di tempat)
- Tidak ada spam chat!

## 📋 Slash Commands

| Command | Deskripsi |
|---------|-----------|
| `/play <query>` | Play lagu dari YouTube |
| `/skip` | Skip lagu saat ini |
| `/stop` | Stop dan hapus queue |
| `/pause` | Pause lagu |
| `/resume` | Resume lagu |
| `/queue` | Lihat antrian lagu |
| `/nowplaying` | Info lagu yang sedang diputar |
| `/volume <0-100>` | Atur volume |
| `/shuffle` | Acak queue |
| `/loop <mode>` | Loop: off / track / queue |
| `/join` | Masuk voice channel dan tetap di sana |
| `/leave` | Keluar dari voice channel |

## 🎮 Preview Panel Player

```
🎧 Music Player
─────────────────────────────────
Judul Lagu

Author: Nama Artis
Requested by: Username

▬▬▬▬▬🔘▬▬▬▬▬▬
`1:45` / `4:31`

🎶 Queue: 3 tracks remaining • Volume: 80% • ▶️ Playing
─────────────────────────────────
[⏮️] [⏸️] [⏭️] [⏹️] [🔀]
[🔉] [🔊] [🔁] [📋]
[📀 View Queue Tracks (3)      ▼]
[⚡ More Features...           ▼]
```

## 🚀 Deployment ke Railway

### Langkah 1: Deploy Lavalink Server

1. Buka [Railway Lavalink Template](https://railway.com/template/lavalink)
2. Klik **Deploy Now**
3. Set environment variable:
   - `PASSWORD`: Password untuk autentikasi (contoh: `mysecretpassword`)
4. Tunggu deployment selesai
5. Catat **internal hostname** dari service Lavalink (format: `lavalink.railway.internal`)

### Langkah 2: Deploy Discord Bot

1. Fork atau push repository ini ke GitHub
2. Di Railway, buat **New Project** → **Deploy from GitHub repo**
3. Pilih repository ini
4. Set environment variables:

```
DISCORD_TOKEN=your_discord_bot_token
LAVALINK_HOST=lavalink.railway.internal:8080
LAVALINK_PASSWORD=mysecretpassword
LAVALINK_SECURE=false
```

> **Note**: Ganti `lavalink.railway.internal` dengan hostname internal dari Lavalink service Anda, dan gunakan port internal aktual yang terlihat di log startup Lavalink. Di Railway biasanya `8080`.

5. Deploy!

### Langkah 3: Konfigurasi YouTube Plugin (Penting!)

Pakai plugin resmi **[youtube-source](https://github.com/lavalink-devs/youtube-source)** (bukan sumber YouTube bawaan Lavalink). Dengan **`youtube-plugin` 1.18.0+**, taruh **`TVHTML5_SIMPLY` di urutan pertama** — client ini menggantikan client TV embedded yang sudah usang dan sering memperbaiki error “all clients failed” / playback tidak stabil. Lihat [catatan rilis 1.18.0](https://github.com/lavalink-devs/youtube-source/releases/tag/1.18.0).

Tambahkan environment variables berikut ke service **Lavalink**:

**Wajib untuk YouTube playback (urutan client yang direkomendasikan):**
```
PLUGINS_YOUTUBE_ENABLED=true
PLUGINS_YOUTUBE_ALLOWSEARCH=true
PLUGINS_YOUTUBE_ALLOWDIRECTVIDEOIDS=true
PLUGINS_YOUTUBE_ALLOWDIRECTPLAYLISTIDS=true
PLUGINS_YOUTUBE_REMOTECIPHER_ENABLED=true
PLUGINS_YOUTUBE_REMOTECIPHER_URL=https://cipher.kikkia.dev/
LAVALINK_PLUGINS_0_DEPENDENCY=dev.lavalink.youtube:youtube-plugin:1.18.0
LAVALINK_PLUGINS_0_SNAPSHOT=false
LAVALINK_DEFAULT_PLUGIN_REPOSITORY=https://maven.lavalink.dev/releases
LAVALINK_SERVER_SOURCES_YOUTUBE=false
PLUGINS_YOUTUBE_CLIENTS_0=TVHTML5_SIMPLY
PLUGINS_YOUTUBE_CLIENTS_1=WEB
PLUGINS_YOUTUBE_CLIENTS_2=WEBEMBEDDED
PLUGINS_YOUTUBE_CLIENTS_3=ANDROID_VR
PLUGINS_YOUTUBE_CLIENTS_4=TV
```

**Opsional tapi direkomendasikan - Setup OAuth:**
```
PLUGINS_YOUTUBE_OAUTH_ENABLED=true
# Tambahkan setelah login device pertama berhasil:
# PLUGINS_YOUTUBE_OAUTH_REFRESHTOKEN=1//...
```

`TV` di akhir dipakai sebagai fallback jika OAuth aktif (playback client ini sering butuh sign-in). Buang `TV` jika tidak pakai OAuth dan Lavalink tidak mengeluh soal client OAuth.

Jika deployment Lavalink **sudah menyertakan** plugin YouTube di image, Anda bisa cukup `LAVALINK_SERVER_SOURCES_YOUTUBE=false` + baris `PLUGINS_YOUTUBE_*` (hindari menduplikasi `LAVALINK_PLUGINS_*` jika image sudah mengaturnya).

Gunakan nilai mentah di panel hosting kecuali platform Anda memang meminta tanda kutip. Hindari `MUSIC` untuk playback `youtube.com` / `ytsearch` biasa karena lebih cocok untuk **`ytmsearch:`**.

Saat pertama kali mengaktifkan OAuth tanpa refresh token:
1. Cek log Lavalink untuk device code (seperti `XXX-XXX-XXX`)
2. Buka https://www.google.com/device
3. Masukkan kode dan login dengan **AKUN GOOGLE BURNER** (jangan akun utama!)
4. Copy refresh token dari log
5. Tambahkan ke: `PLUGINS_YOUTUBE_OAUTH_REFRESHTOKEN=1//...`

> ⚠️ **PERINGATAN:** Jangan pernah gunakan akun Google utama untuk OAuth. Buat akun baru/burner!

### Langkah 4: Setup Discord Bot

1. Buka [Discord Developer Portal](https://discord.com/developers/applications)
2. Buat aplikasi baru atau gunakan yang sudah ada
3. Di bagian **Bot**, copy token dan paste ke `DISCORD_TOKEN`
4. Enable intents:
   - ✅ SERVER MEMBERS INTENT
   - ✅ MESSAGE CONTENT INTENT
5. Di bagian **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Permissions: `Connect`, `Speak`, `Send Messages`, `Embed Links`, `Manage Messages`
6. Copy URL dan invite bot ke server Anda

## 🖥️ Local Development

### Prerequisites
- Node.js 18+
- Java 17+ (untuk Lavalink)
- Lavalink server berjalan

### Setup

1. Clone repository
```bash
git clone <your-repo-url>
cd Discord-Music
```

2. Install dependencies
```bash
npm install
```

3. Copy `.env.example` ke `.env` dan isi nilai-nilainya
```bash
cp .env.example .env
```

4. Jalankan Lavalink server (di terminal terpisah)
```bash
java -jar Lavalink.jar
```

5. Jalankan bot
```bash
npm start
```

## 📁 Struktur Proyek

```
Discord-Music/
├── index.js                 # Bootstrap tipis yang memuat ./src
├── src/
│   ├── index.js             # Setup client, config, command, interaction
│   ├── actions.js           # Mutasi playback bersama
│   ├── interactions.js      # Routing slash command dan komponen
│   ├── music/
│   │   ├── runtime.js       # Lifecycle Lavalink/Kazagumo dan recovery
│   │   └── compat.js        # Kompatibilitas voice Shoukaku/Lavalink
│   └── ui/playerView.js     # Embed dan komponen player
├── test/                    # Test suite Node
├── package.json             # Dependencies
└── discord-music-env.txt    # Contoh environment hosting Lavalink
```

## ⚙️ Konfigurasi Lavalink (Opsional)

Jika Anda menjalankan Lavalink server sendiri, buat file `application.yml`:

```yaml
server:
  port: 2333
  address: 0.0.0.0

lavalink:
  plugins:
    - dependency: "dev.lavalink.youtube:youtube-plugin:1.18.0"
      snapshot: false
  server:
    password: "youshallnotpass"
    sources:
      youtube: false
      bandcamp: true
      soundcloud: true
      twitch: true
      vimeo: true
      http: true
      local: false

plugins:
  youtube:
    enabled: true
    allowSearch: true
    allowDirectVideoIds: true
    allowDirectPlaylistIds: true
    clients:
      - TVHTML5_SIMPLY
      - WEB
      - WEBEMBEDDED
      - ANDROID_VR
      - TV
    oauth:
      enabled: true
      # refreshToken: "paste your refresh token here"
    remoteCipher:
      url: "https://cipher.kikkia.dev/"

logging:
  level:
    root: INFO
    lavalink: INFO
    dev.lavalink.youtube.http.YoutubeOauth2Handler: INFO
```

## 🔧 Troubleshooting

### Bot tidak bisa connect ke Lavalink
- Pastikan Lavalink server berjalan
- Cek `LAVALINK_HOST` dan `LAVALINK_PASSWORD` sudah benar
- Di Railway, gunakan **internal URL** bukan public URL
- Jika log Lavalink menampilkan `Authentication failed`, berarti `LAVALINK_PASSWORD` di bot tidak sama dengan `LAVALINK_SERVER_PASSWORD` di service Lavalink

### Lagu tidak bisa diputar / Error "Please sign in"
- Ini masalah umum karena YouTube memblokir akses otomatis
- **Solusi 1:** Aktifkan remote cipher: `PLUGINS_YOUTUBE_REMOTECIPHER_URL=https://cipher.kikkia.dev/`
- **Solusi 2:** Setup OAuth dengan akun Google burner (lihat Langkah 3 di atas)
- **Solusi 3:** Pakai **`youtube-plugin` 1.18.0+** dan taruh **`TVHTML5_SIMPLY` pertama** di `clients`, lalu `WEB`, `WEBEMBEDDED`, `ANDROID_VR`, dan opsional `TV` terakhir jika pakai OAuth ([rilis youtube-source](https://github.com/lavalink-devs/youtube-source/releases))
- Hindari `TV` sebagai **client pertama** kecuali Anda mengandalkan OAuth; client ini sering butuh sign-in untuk playback
- Jika OAuth tetap aktif dan Lavalink memberi warning bahwa tidak ada client OAuth-compatible, tambahkan `TV` hanya sebagai client terakhir
- Hindari `MUSIC` untuk playback normal karena lebih cocok untuk `ytmsearch`
- Cek logs Lavalink untuk error detail

### "All clients failed" / "This video requires payment to watch"
- **Video berbayar/sewa/Premium:** tidak bisa diakali hanya dengan konfig Lavalink; coba lagu lain atau sumber lain (mis. SoundCloud).
- **Kegagalan lain:** update `dev.lavalink.youtube:youtube-plugin` ke [rilis terbaru](https://github.com/lavalink-devs/youtube-source/releases), perbarui refresh token OAuth jika kedaluwarsa, pastikan remote cipher cocok dengan versi plugin.

### Lavalink 4.2.x `Bad Request`: `channelId` wajib ada
- Gejala di log Lavalink: `Field 'channelId' is required ... missing at path: $.voice`
- Penyebab: payload update voice player tidak mengirim `voice.channelId`
- Repository ini menjaga kompatibilitas voice Shoukaku di [`src/music/compat.js`](src/music/compat.js)
- Jika Anda memakai fork/client custom, pastikan payload voice berisi:
- `voice.token`
- `voice.endpoint`
- `voice.sessionId`
- `voice.channelId`
- Setelah perbaikan, restart Lavalink dan proses bot

### Commands tidak muncul
- Tunggu beberapa menit, Discord caching slash commands
- Pastikan bot memiliki permission `applications.commands`

### Pesan tidak otomatis terhapus
- Pastikan bot memiliki permission `Manage Messages`

### "The music service is temporarily unavailable" setiap `/play`
- Periksa `isNodeStateConnected()` di [`src/music/runtime.js`](src/music/runtime.js). Shoukaku 4.x melaporkan node tersambung sebagai `CONNECTED=1`.
- Jika Anda upgrade Shoukaku, verifikasi semantik state node sebelum mengubah recovery gating.

### Bot stuck reconnecting / tidak pernah pulih setelah Lavalink drop
- Disebabkan oleh flag `isReconnecting` yang diset oleh event `close`, yang juga memblokir `attemptReconnect()`. Sekarang sudah diperbaiki dengan mutex `reconnectAttemptInProgress` yang terpisah.

### `/play` menampilkan "masih starting up" padahal bot sudah berjalan
- Flag `isStartingUp` hanya dikosongkan saat `ready` terpicu. Jika `ready` tidak pernah terpicu (misal Lavalink tidak bisa diakses), flag tetap `true`. Periksa `LAVALINK_HOST`, `LAVALINK_PASSWORD`, dan `LAVALINK_SECURE`.

### Railway: penggunaan public URL vs internal URL
- **Internal URL** (`*.railway.internal`): gunakan port internal aktual dari log startup Lavalink, biasanya `8080`, dan set `LAVALINK_SECURE=false`
- **Public URL** (`*.up.railway.app`): gunakan port `443`, set `LAVALINK_SECURE=true`

### Panel player tidak update
- Player update setiap 10 detik saat bermain
- Update berhenti saat musik di-pause

## 🆕 Yang Baru

### v2.2 - Perbaikan Reconneksi Lavalink (Februari 2026)

- 🔧 **Fix kritis: state enum Shoukaku 4.x** — Shoukaku 4.x menggunakan `CONNECTED=1`, bukan `2`. Bot memeriksa nilai yang salah, sehingga `isNodeOperational()` selalu mengembalikan `false` meskipun sudah terhubung. Ini menyebabkan `/play` selalu menampilkan "temporarily unavailable".
- 🔧 **Fix mutex reconnect** — Memisahkan `isReconnecting` menjadi dua flag: `isReconnecting` (status user-facing) dan `reconnectAttemptInProgress` (function mutex). Sebelumnya, event `close` mengeset `isReconnecting=true` sehingga `attemptReconnect()` langsung return — bot tidak bisa pulih sendiri dari Lavalink yang drop.
- 🔧 **Fix timeout mutex** — Timeout mutex 10 detik memblokir percobaan reconnect ulang setelah gagal (misal 502 saat Lavalink startup). Mutex sekarang dirilis langsung setelah `addNode()`.
- ✨ **Pesan status `/play` yang lebih informatif** — Bot sekarang menampilkan pesan sesuai konteks: "masih starting up" saat boot pertama, "kehilangan koneksi dan sedang reconnect" saat drop di tengah sesi, atau "sementara tidak tersedia" untuk kasus lainnya.
- ✨ **Flag `isStartingUp`** — Membedakan boot pertama dari reconnect mid-session agar pengguna mendapat pesan status yang akurat.

> **Catatan untuk maintainer:** Jika Anda upgrade Shoukaku atau Kazagumo, verifikasi semantik state node dan payload voice update sebelum mengubah [`src/music/runtime.js`](src/music/runtime.js) atau [`src/music/compat.js`](src/music/compat.js).

### v2.1 - YouTube OAuth & Remote Cipher (Desember 2025)
- 🔐 Dukungan OAuth untuk autentikasi YouTube (mengurangi sebagian error "Please sign in", tapi bukan bypass yang dijamin)
- 🔧 Integrasi remote cipher server (fix masalah signature extraction)
- 📝 Dokumentasi diperbarui dengan panduan setup detail
- 🎵 Playback YouTube lebih reliable

### v2.0 - Panel Player Interaktif
- ✨ Panel player interaktif gaya Boogie dengan tombol-tombol
- 📊 Progress bar real-time (update setiap 10 detik)
- 🔘 Tombol kontrol untuk semua fungsi playback
- 📀 Menu dropdown untuk queue dan fitur tambahan
- 🧹 Pesan otomatis terhapus setelah 5 detik
- 🔄 Player edit di tempat (tidak ada pesan "message deleted")
- 📋 Update hitungan queue secara live

## 📄 License

ISC

## 🤝 Contributing

Pull requests welcome! Untuk perubahan besar, buka issue terlebih dahulu.

---

Dibuat dengan ❤️ untuk pecinta musik Discord
