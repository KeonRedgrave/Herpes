# 🎵 Discord音楽ボット

**🌐 Language: [English](README.md) | [Indonesia](README_ID.md) | [日本語](README_jp.md)**

---

Lavalinkを搭載した高品質な音声ストリーミング対応の機能豊富なDiscord音楽ボット。美しいインタラクティブプレイヤーパネルを備えたBoogieボットにインスパイアされています！

## ✨ 特徴

### 🎶 コア音楽機能
- 🎵 YouTubeから音楽再生（検索または直接URL）
- 📋 シャッフル機能付きキューシステム
- 🔁 ループモード（トラック/キュー/オフ）
- 🔊 音量コントロール（0-100%）
- ⏯️ 一時停止、再開、スキップ、停止
- 📊 リアルタイムプログレスバー付きNow Playing
- 🎧 ボイスチャンネルに滞在（自動退出なし）

### 🎛️ インタラクティブプレイヤーパネル（Boogieスタイル）
- **リアルタイムプログレスバー** - 10秒ごとに現在の位置を表示して更新
- **ライブキューカウント** - 曲が追加されると即座に更新
- **コントロールボタン:**
  - ⏮️ トラックを再開
  - ⏸️/▶️ 一時停止/再開（動的アイコン）
  - ⏭️ スキップ
  - ⏹️ 停止
  - 🔀 シャッフル
  - 🔉/🔊 音量下げ/上げ
  - 🔁 ループ（アクティブ時に色変更）
  - 📋 キューを表示

### 📀 ドロップダウンメニュー
- **キュートラックを表示** - キュー内の最大25トラックを閲覧
- **その他の機能:**
  - 🎵 詳細なNow Playing情報
  - 🗑️ キューをクリア
  - 🔄 トラックを再開
  - 📊 プレイヤー統計

### 🧹 クリーンなチャット体験
- すべてのボットメッセージは5秒後に自動削除
- プレイヤーパネルは永続的に維持（インプレース編集）
- チャットの散乱なし！

## 📋 スラッシュコマンド

| コマンド | 説明 |
|---------|-------------|
| `/play <query>` | YouTubeから曲を再生 |
| `/skip` | 現在の曲をスキップ |
| `/stop` | 再生を停止しキューをクリア |
| `/pause` | 曲を一時停止 |
| `/resume` | 曲を再開 |
| `/queue` | 曲のキューを表示 |
| `/nowplaying` | 現在再生中の曲の情報を表示 |
| `/volume <0-100>` | 音量を設定 |
| `/shuffle` | キューをシャッフル |
| `/loop <mode>` | ループ: off / track / queue |
| `/join` | ボイスチャンネルに参加して滞在 |
| `/leave` | ボイスチャンネルから退出 |

## 🎮 プレイヤーパネルプレビュー

```
🎧 Music Player
─────────────────────────────────
Song Title

Author: Artist Name
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

## 🚀 Railwayへのデプロイ

### ステップ1: Lavalinkサーバーをデプロイ

1. [Railway Lavalink Template](https://railway.com/template/lavalink)を開く
2. **Deploy Now**をクリック
3. 環境変数を設定:
   - `PASSWORD`: 認証用パスワード（例: `mysecretpassword`）
4. デプロイ完了を待つ
5. Lavalinkサービスの**内部ホスト名**を控える（形式: `lavalink.railway.internal`）

### ステップ2: Discordボットをデプロイ

1. このリポジトリをフォークまたはGitHubにプッシュ
2. Railwayで**New Project** → **Deploy from GitHub repo**を作成
3. このリポジトリを選択
4. 環境変数を設定:

```
DISCORD_TOKEN=your_discord_bot_token
LAVALINK_HOST=lavalink.railway.internal:8080
LAVALINK_PASSWORD=mysecretpassword
LAVALINK_SECURE=false
```

> **注**: `lavalink.railway.internal`をLavalinkサービスの内部ホスト名に置き換え、Lavalink起動ログに表示される実際の内部ポートを使用してください。Railwayでは `8080` になることが多いです。

5. デプロイ！

### ステップ3: YouTubeプラグインを設定（重要！）

公式の **[youtube-source](https://github.com/lavalink-devs/youtube-source)** プラグインを使用してください（Lavalink標準のYouTubeソースではありません）。**`youtube-plugin` 1.18.0 以降**では、クライアント一覧の**先頭に `TVHTML5_SIMPLY`** を置くことを推奨します。非推奨の TV 埋め込みクライアントの後継で、「all clients failed」等の改善が報告されています（[1.18.0 リリースノート](https://github.com/lavalink-devs/youtube-source/releases/tag/1.18.0)）。

**Lavalink** サービスに次の環境変数を追加:

**YouTube再生に必須（推奨クライアント順）:**
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

**推奨 - OAuth設定:**
```
PLUGINS_YOUTUBE_OAUTH_ENABLED=true
# 最初のデバイスログイン成功後に追加:
# PLUGINS_YOUTUBE_OAUTH_REFRESHTOKEN=1//...
```

`TV` は OAuth 利用時の最終フォールバック向けです（再生にサインインが必要な場合があります）。OAuth を使わない場合は `TV` を省略しても構いません。

イメージにプラグインが**同梱済み**の場合は `LAVALINK_SERVER_SOURCES_YOUTUBE=false` と `PLUGINS_YOUTUBE_*` だけで足りることがあり、`LAVALINK_PLUGINS_*` の重複は避けてください。

値に引用符は付けないでください（ホストが求める場合を除く）。通常の `youtube.com` / `ytsearch` では **`MUSIC` は `ytmsearch:` 向け**です。

リフレッシュトークンなしでOAuthを初めて有効にする場合:
1. Lavalinkログでデバイスコードを確認（例: `XXX-XXX-XXX`）
2. https://www.google.com/device にアクセス
3. コードを入力し**使い捨てGoogleアカウント**でログイン（メインアカウントは使用不可！）
4. ログからリフレッシュトークンをコピー
5. これを追加: `PLUGINS_YOUTUBE_OAUTH_REFRESHTOKEN=1//...`

> ⚠️ **警告:** OAuthにメインのGoogleアカウントを絶対に使用しないでください。新しい/使い捨てアカウントを作成してください！

### ステップ4: Discordボットを設定

1. [Discord Developer Portal](https://discord.com/developers/applications)を開く
2. 新しいアプリケーションを作成または既存のものを使用
3. **Bot**セクションでトークンをコピーし`DISCORD_TOKEN`に貼り付け
4. インテントを有効化:
   - ✅ SERVER MEMBERS INTENT
   - ✅ MESSAGE CONTENT INTENT
5. **OAuth2 → URL Generator**で:
   - スコープ: `bot`, `applications.commands`
   - 権限: `Connect`, `Speak`, `Send Messages`, `Embed Links`, `Manage Messages`
6. URLをコピーしボットをサーバーに招待

## 🖥️ ローカル開発

### 前提条件
- Node.js 18+
- Java 17+ （Lavalink用）
- Lavalinkサーバー稼働中

### セットアップ

1. リポジトリをクローン
```bash
git clone <your-repo-url>
cd Discord-Music
```

2. 依存関係をインストール
```bash
npm install
```

3. `.env.example`を`.env`にコピーし値を入力
```bash
cp .env.example .env
```

4. Lavalinkサーバーを実行（別ターミナルで）
```bash
java -jar Lavalink.jar
```

5. ボットを実行
```bash
npm start
```

## 📁 プロジェクト構造

```
Discord-Music/
├── index.js                 # ./src を読み込む薄いブートストラップ
├── src/
│   ├── index.js             # Client、config、command、interaction の設定
│   ├── actions.js           # 共通 playback mutation
│   ├── interactions.js      # Slash command と component routing
│   ├── music/
│   │   ├── runtime.js       # Lavalink/Kazagumo lifecycle と recovery
│   │   └── compat.js        # Shoukaku/Lavalink voice 互換処理
│   └── ui/playerView.js     # Player embed と component
├── test/                    # Node test suite
├── package.json             # 依存関係
└── discord-music-env.txt    # Lavalink hosting environment 例
```

## ⚙️ Lavalink設定（オプション）

独自のLavalinkサーバーを実行する場合、`application.yml`ファイルを作成:

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

## 🔧 トラブルシューティング

### ボットがLavalinkに接続できない
- Lavalinkサーバーが実行中であることを確認
- `LAVALINK_HOST`と`LAVALINK_PASSWORD`が正しいことを確認
- Railwayでは公開URLではなく**内部URL**を使用
- Lavalinkログに`Authentication failed`が出る場合、ボット側の`LAVALINK_PASSWORD`とLavalink側の`LAVALINK_SERVER_PASSWORD`が一致していません

### 曲が再生されない / 「サインインしてください」エラー
- これはYouTubeによる自動化アクセスブロックの一般的な問題
- **解決策1:** リモート暗号を有効化: `PLUGINS_YOUTUBE_REMOTECIPHER_URL=https://cipher.kikkia.dev/`
- **解決策2:** 使い捨てGoogleアカウントでOAuthを設定（上記ステップ3参照）
- **解決策3:** **`youtube-plugin` 1.18.0+** を使い、`clients` の先頭を **`TVHTML5_SIMPLY`**、続けて `WEB`, `WEBEMBEDDED`, `ANDROID_VR`、OAuth 利用時は最後に `TV`（[youtube-source releases](https://github.com/lavalink-devs/youtube-source/releases)）
- `TV` を**先頭**に置くのは非推奨（OAuth 前提のことが多い）
- OAuthを有効にしたまま「OAuth互換クライアントが無い」という警告が出る場合は、`TV` を最後のクライアントとしてのみ追加してください
- `MUSIC` は通常再生より `ytmsearch` 向け

### 「All clients failed」/「This video requires payment to watch」
- **有料・レンタル・Premium限定など:** Lavalink の設定では回避できません。別の動画や SoundCloud などを試してください。
- **その他:** [最新の youtube-plugin](https://github.com/lavalink-devs/youtube-source/releases) に更新し、OAuth のリフレッシュトークンを確認し、リモート cipher がプラグイン版と合っているか確認してください。
- 詳細なエラーについてはLavalinkログを確認

### コマンドが表示されない
- 数分待ってください、Discordはスラッシュコマンドをキャッシュします
- ボットが`applications.commands`権限を持っていることを確認

### メッセージが自動削除されない
- ボットが`Manage Messages`権限を持っていることを確認

### `/play`のたびに「The music service is temporarily unavailable」
- [`src/music/runtime.js`](src/music/runtime.js) の `isNodeStateConnected()` を確認してください。Shoukaku 4.x は接続済み node を `CONNECTED=1` として報告します。
- Shoukaku をアップグレードする場合は、recovery gating を変更する前に node state semantics を確認してください。

### ボットが再接続でスタック / Lavalinkドロップ後に回復しない
- `close`イベントが`isReconnecting=true`を設定し、`attemptReconnect()`もブロックしていたことが原因です。現在は別の`reconnectAttemptInProgress` mutexで修正されています。

### ボットが起動中でも`/play`が「still starting up」を表示する
- `isStartingUp`フラグは`ready`が発火した時のみクリアされます。`ready`が発火しない場合（例: Lavalinkに到達できない）、フラグは`true`のままになります。`LAVALINK_HOST`、`LAVALINK_PASSWORD`、`LAVALINK_SECURE`を確認してください。

### Railway: パブリックURLと内部URLの使い分け
- **内部URL** (`*.railway.internal`): Lavalink起動ログの実際の内部ポートを使用します。Railwayでは `8080` が一般的で、`LAVALINK_SECURE=false` を設定します
- **パブリックURL** (`*.up.railway.app`): ポート`443`を使用、`LAVALINK_SECURE=true`を設定

### プレイヤーパネルが更新されない
- プレイヤーは再生中10秒ごとに更新
- 音楽が一時停止されると更新も一時停止

## 🆕 新着情報

### v2.2 - Lavalink再接続修正（2026年2月）

- 🔧 **重大な修正: Shoukaku 4.xのstate enum** — Shoukaku 4.xは`CONNECTED=1`を使用しており、`2`ではありません。ボットが誤った値を確認していたため、接続済みの場合でも`isNodeOperational()`が常に`false`を返していました。これにより`/play`が常に「temporarily unavailable」を表示していました。
- 🔧 **再接続mutexの修正** — `isReconnecting`を2つのフラグに分離: `isReconnecting`（ユーザー向け状態）と`reconnectAttemptInProgress`（関数mutex）。以前は`close`イベントが`isReconnecting=true`を設定し、`attemptReconnect()`が即座にreturnするため、ボットがLavalinkのドロップから自己回復できませんでした。
- 🔧 **mutexタイムアウトの修正** — 10秒のmutexタイムアウトが失敗した再接続後の正当な再試行をブロックしていました（例: Lavalink起動中の502）。mutexは`addNode()`後すぐに解放されるようになりました。
- ✨ **よりスマートな`/play`ステータスメッセージ** — ボットはコンテキストに応じたメッセージを表示: 初回起動時は「still starting up」、セッション中のドロップ時は「lost connection and is reconnecting」、その他の場合は「temporarily unavailable」。
- ✨ **`isStartingUp`フラグ** — 初回起動とセッション中の再接続を区別し、ユーザーに正確なステータスメッセージを提供します。

> **メンテナー向けメモ:** Shoukaku または Kazagumo をアップグレードする場合は、[`src/music/runtime.js`](src/music/runtime.js) または [`src/music/compat.js`](src/music/compat.js) を変更する前に node state semantics と voice update payload を確認してください。

### v2.1 - YouTube OAuthとリモート暗号（2025年12月）
- 🔐 YouTube認証のOAuthサポート（「サインインしてください」エラーの一部を減らしますが、確実な回避策ではありません）
- 🔧 リモート暗号サーバー統合（署名抽出問題を修正）
- 📝 詳細なセットアップ手順でドキュメントを更新
- 🎵 より信頼性の高いYouTube再生

### v2.0 - インタラクティブプレイヤーパネル
- ✨ ボタン付きBoogieスタイルインタラクティブプレイヤー
- 📊 リアルタイムプログレスバー（10秒ごとに更新）
- 🔘 すべての再生機能用コントロールボタン
- 📀 キューと追加機能用ドロップダウンメニュー
- 🧹 5秒後のメッセージ自動削除
- 🔄 インプレースプレイヤー編集（「メッセージ削除」通知なし）
- 📋 ライブキューカウント更新

## 📄 ライセンス

ISC

## 🤝 貢献

プルリクエスト歓迎！大きな変更については、まずissueを開いてください。

---

Discord音楽愛好家のために❤️で作られました
