use poise::serenity_prelude as serenity;
use songbird::SerenityInit; // Fixes the register_songbird error
use lavalink_rs::prelude::*; // Fixes the missing Lavalink imports
use std::env;

// We store the Lavalink connection in our bot's shared data
struct Data {
    lavalink: LavalinkClient,
}
type Error = Box<dyn std::error::Error + Send + Sync>;
type Context<'a> = poise::Context<'a, Data, Error>;

#[poise::command(slash_command, prefix_command)]
async fn play(ctx: Context<'_>, #[description = "Song name or URL"] query: String) -> Result<(), Error> {
    ctx.defer().await?;
    println!("[STEP 1] Command '/play' received for query: {}", query);
    
    let (guild_id, channel_id) = {
        let guild = ctx.guild().unwrap();
        let channel_id = guild.voice_states.get(&ctx.author().id)
            .and_then(|voice_state| voice_state.channel_id);
        (guild.id, channel_id)
    };

    if let Some(channel) = channel_id {
        // 1. Tell Discord we are joining the channel
        println!("[STEP 2] Attempting to join voice channel...");
        let manager = songbird::get(ctx.serenity_context()).await.unwrap().clone();
        manager.join(guild_id, channel).await.unwrap();
        println!("[STEP 3] Connected to Discord voice channel.");

        // 2. Tell Lavalink to search for the track
        println!("[STEP 4] Formatting query for Lavalink...");
        let search_query = if query.starts_with("http") {
            query.clone()
        } else {
            format!("ytsearch:{}", query)
        };
        
        println!("[STEP 5] Sending search request to Lavalink node...");
        let lava = &ctx.data().lavalink;
        let tracks = lava.load_tracks(guild_id, &search_query).await.unwrap();

        // 3. Tell Lavalink to stream the first result to the channel
        println!("[STEP 6] Processing Lavalink response...");
        if let Some(track) = tracks.tracks.first() {
            println!("[STEP 7] Track found! Commanding Lavalink to play audio...");
            let player = lava.get_player_context(guild_id).unwrap();
            player.play(track).await.unwrap();
            println!("[STEP 8] Lavalink is now streaming the audio.");
            ctx.say(format!("🎶 Now playing via Lavalink: **{}**", query)).await?;
        } else {
            println!("[ERROR] Lavalink could not find the track.");
            ctx.say("❌ Could not find that track on YouTube.").await?;
        }

    } else {
        println!("[ERROR] User is not in a voice channel.");
        ctx.say("❌ You need to join a voice channel first!").await?;
    }

    Ok(())
}

#[poise::command(slash_command, prefix_command)]
async fn leave(ctx: Context<'_>) -> Result<(), Error> {
    println!("[INFO] Command '/leave' received.");
    let guild_id = ctx.guild_id().unwrap();
    
    // Disconnect Lavalink
    let lava = &ctx.data().lavalink;
    let _ = lava.destroy_player(guild_id).await;

    // Disconnect Discord
    let manager = songbird::get(ctx.serenity_context()).await.unwrap().clone();
    let _ = manager.remove(guild_id).await;
    
    ctx.say("👋 Left the channel and destroyed the Lavalink player.").await?;
    println!("[INFO] Successfully left the channel.");
    Ok(())
}

#[tokio::main]
async fn main() {
    println!("[BOOT] Starting up the bot...");
    let token = env::var("DISCORD_TOKEN").expect("Expected DISCORD_TOKEN");
    let lava_host = env::var("LAVA_HOST").expect("Expected LAVA_HOST");
    let lava_port: u16 = env::var("LAVA_PORT").unwrap_or_else(|_| "443".to_string()).parse().unwrap();
    let lava_password = env::var("LAVA_PASSWORD").expect("Expected LAVA_PASSWORD");
    let lava_secure: bool = env::var("LAVA_SECURE").unwrap_or_else(|_| "true".to_string()).parse().unwrap();

    let intents = serenity::GatewayIntents::non_privileged() | serenity::GatewayIntents::MESSAGE_CONTENT;

    let framework = poise::Framework::builder()
        .options(poise::FrameworkOptions {
            commands: vec![play(), leave()],
            prefix_options: poise::PrefixFrameworkOptions {
                prefix: Some("!".into()),
                ..Default::default()
            },
            ..Default::default()
        })
        .setup(move |ctx, ready, framework| {
            Box::pin(async move {
                poise::builtins::register_globally(ctx, &framework.options().commands).await?;
                println!("[BOOT] Slash commands registered successfully.");
                
                // Initialize the Lavalink Node Connection
                println!("[BOOT] Connecting to Lavalink node...");
                let node = NodeBuilder::new(&lava_host)
                    .port(lava_port)
                    .is_ssl(lava_secure)
                    .password(&lava_password)
                    .build();

                let lavalink_client = LavalinkClientBuilder::new(ready.user.id)
                    .add_node(node)
                    .build()
                    .await
                    .expect("Failed to build Lavalink client");

                println!("✅ Bot connected to Discord & Lavalink Node!");
                Ok(Data { lavalink: lavalink_client })
            })
        })
        .build();

    let mut client = serenity::ClientBuilder::new(token, intents)
        .framework(framework)
        .register_songbird()
        .await
        .expect("Error creating client");

    if let Err(why) = client.start().await {
        println!("[FATAL] Client error: {:?}", why);
    }
}