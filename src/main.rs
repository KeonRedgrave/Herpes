use poise::serenity_prelude as serenity;
use songbird::SerenityInit;
use lavalink_rs::prelude::*;
use lavalink_rs::model::events::Events;
use lavalink_rs::model::track::TrackData;
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

        println!("[STEP 6] Processing Lavalink JSON response...");
        // Bulletproof parsing: Convert the Lavalink polymorphic response into a standard JSON Value
        let data = serde_json::to_value(&response.data).unwrap_or(serde_json::Value::Null);
        
        // Safely extract the TrackData regardless of if it's an Array, a Track, or a Playlist Object
        let track: Option<TrackData> = if data.is_array() {
            serde_json::from_value(data.as_array().unwrap()[0].clone()).ok()
        } else if data.is_object() {
            if let Some(tracks) = data.get("tracks") {
                if tracks.is_array() && !tracks.as_array().unwrap().is_empty() {
                    serde_json::from_value(tracks.as_array().unwrap()[0].clone()).ok()
                } else {
                    serde_json::from_value(data).ok()
                }
            } else {
                serde_json::from_value(data).ok()
            }
        } else {
            None
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
                
                // 0.11+ Paradigm: Build the node securely via the Builder pattern
                let mut node_builder = lavalink_rs::node::NodeBuilder::default();
                node_builder.hostname(format!("{}:{}", lava_host, lava_port));
                node_builder.is_ssl(lava_secure);
                node_builder.password(lava_password);
                node_builder.user_id(lavalink_rs::model::UserId(ready.user.id.get()));

                // Initialize the client with the sharded distribution strategy
                let lavalink_client = LavalinkClient::new(
                    Events::default(),
                    vec![node_builder],
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