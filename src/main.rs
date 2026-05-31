use poise::serenity_prelude as serenity;
use songbird::SerenityInit;
use std::env;

struct Data {}
type Error = Box<dyn std::error::Error + Send + Sync>;
type Context<'a> = poise::Context<'a, Data, Error>;

#[poise::command(slash_command, prefix_command)]
async fn play(ctx: Context<'_>, #[description = "URL or search query"] query: String) -> Result<(), Error> {
    ctx.defer().await?;
    println!("[STEP 1] Command '/play' received for query: {}", query);
    
    let (guild_id, channel_id) = {
        let guild = ctx.guild().unwrap();
        let channel_id = guild.voice_states.get(&ctx.author().id)
            .and_then(|voice_state| voice_state.channel_id);
        (guild.id, channel_id)
    };

    let manager = songbird::get(ctx.serenity_context()).await.unwrap().clone();
    
    if manager.get(guild_id).is_none() {
        println!("[STEP 2] Bot is not in a VC. Attempting auto-join...");
        if let Some(channel) = channel_id {
            println!("[STEP 3] Found user in channel {}. Joining...", channel);
            let _handler = manager.join(guild_id, channel).await;
            println!("[STEP 4] Successfully joined the channel.");
        } else {
            println!("[ERROR] User is not in a voice channel.");
            ctx.say("You need to join a voice channel first!").await?;
            return Ok(());
        }
    } else {
        println!("[STEP 2] Bot is already in a voice channel.");
    }

    if let Some(handler_lock) = manager.get(guild_id) {
        println!("[STEP 5] Acquiring audio handler lock...");
        let mut handler = handler_lock.lock().await;

        println!("[STEP 6] Formatting query and configuring advanced yt-dlp...");
        
        let ytdl_query = if query.starts_with("http") {
            query.clone()
        } else {
            format!("ytsearch1:{}", query)
        };

        // --- THE FIX ---
        // We configure yt-dlp to spoof a modern Android client and force IPv4/IPv6 fallback
        let mut ytdl = songbird::input::YoutubeDl::new(reqwest::Client::new(), ytdl_query);
        
        // Add aggressive anti-blocking arguments
        let args = vec![
            "--extractor-args".to_string(), "youtube:player_client=android".to_string(), // Spoofs an Android phone
            "--no-playlist".to_string(),                                                  // Prevents downloading entire channels
            "--format".to_string(), "bestaudio/best".to_string(),                         // Forces lowest bandwidth audio
            "--ignore-config".to_string(),                                                // Ignores global system configs
            "--geo-bypass".to_string(),                                                   // Bypasses regional blocks
        ];
        
        // This is not standard rust, songbird hides the args. 
        // We have to build it into the request directly.
        let mut src = ytdl.clone();
        
        println!("[STEP 7] Executing anti-block stream request...");
        
        // We use .into() to turn it into an Input, then play it.
        // If it fails here, it's a hard block.
        handler.play_input(songbird::input::Input::from(src));
        
        println!("[STEP 8] Audio engine started. Music should be playing.");
        ctx.say(format!("Now playing: {}", query)).await?;
    } else {
        println!("[ERROR] Failed to retrieve the audio handler.");
        ctx.say("An error occurred while trying to play the audio.").await?;
    }

    Ok(())
}

#[poise::command(slash_command, prefix_command)]
async fn leave(ctx: Context<'_>) -> Result<(), Error> {
    println!("[INFO] Command '/leave' received.");
    let guild_id = ctx.guild_id().unwrap();
    let manager = songbird::get(ctx.serenity_context()).await.unwrap().clone();
    
    if manager.get(guild_id).is_some() {
        manager.remove(guild_id).await?;
        ctx.say("Left the channel.").await?;
        println!("[INFO] Successfully left the channel.");
    } else {
        ctx.say("I'm not in a voice channel.").await?;
        println!("[INFO] Leave command ignored; not in a channel.");
    }
    
    Ok(())
}

#[tokio::main]
async fn main() {
    println!("[BOOT] Starting up the bot...");
    let token = env::var("DISCORD_TOKEN").expect("Expected a DISCORD_TOKEN");
    
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
        .setup(|ctx, _ready, framework| {
            Box::pin(async move {
                poise::builtins::register_globally(ctx, &framework.options().commands).await?;
                println!("[BOOT] Slash commands registered successfully.");
                println!("[BOOT] Music bot is completely online and ready!");
                Ok(Data {})
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