use poise::serenity_prelude as serenity;
use songbird::SerenityInit;
use lavalink_rs::prelude::*;
use std::env;

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
        println!("[STEP 2] Attempting to join voice channel...");
        let manager = songbird::get(ctx.serenity_context()).await.unwrap().clone();
        manager.join(guild_id, channel).await.unwrap();
        println!("[STEP 3] Connected to Discord voice channel.");

        println!("[STEP 4] Formatting query for Lavalink...");
        let search_query = if query.starts_with("http") {
            query.clone()
        } else {
            format!("ytsearch:{}", query)
        };
        
        println!("[STEP 5] Sending search request to Lavalink node...");
        let lava = &ctx.data().lavalink;
        
        let response = lava.load_tracks(guild_id.get(), &search_query).await.unwrap();

        println!("[STEP 6] Processing Lavalink response...");
        
        let track = match response.data {
            Some(TrackLoadData::Track(t)) => Some(t),
            Some(TrackLoadData::Search(mut s)) => s.pop(),
            Some(TrackLoadData::Playlist(mut p)) => p.tracks.pop(),
            _ => None,
        };

        if let Some(t) = track {
            println!("[STEP 7] Track found! Commanding Lavalink to play audio...");
            let player = lava.get_player_context(guild_id.get()).unwrap();
            player.play(&t).await.unwrap();
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
    
    let lava = &ctx.data().lavalink;
    let _ = lava.delete_player(guild_id.get()).await;

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
                
                println!("[BOOT] Connecting to Lavalink node...");
                
                // Directly initialize the Node struct
                let node = lavalink_rs::node::Node {
                    hostname: lava_host,
                    port: lava_port,
                    is_ssl: lava_secure,
                    password: lava_password,
                    user_id: lavalink_rs::model::UserId(ready.user.id.get()),
                    session_id: None,
                };

                // Use the correct `sharded()` load balancing strategy
                let lavalink_client = LavalinkClient::new(
                    lavalink_rs::model::events::Events::default(),
                    vec![node],
                    NodeDistributionStrategy::sharded()
                ).await;

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
