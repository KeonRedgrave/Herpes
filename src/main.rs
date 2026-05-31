use poise::serenity_prelude as serenity;
use songbird::SerenityInit;
use std::env;

struct Data {}
// ⚠️ IMPORTANT: Make sure this exact line is copied fully with the <...> brackets!
type Error = Box<dyn std::error::Error + Send + Sync>;
type Context<'a> = poise::Context<'a, Data, Error>;

#[poise::command(slash_command, prefix_command)]
async fn join(ctx: Context<'_>) -> Result<(), Error> {
    let guild = ctx.guild().unwrap();
    let channel_id = guild.voice_states.get(&ctx.author().id)
        .and_then(|voice_state| voice_state.channel_id);

    let connect_to = match channel_id {
        Some(channel) => channel,
        None => {
            ctx.say("You need to join a voice channel first!").await?;
            return Ok(());
        }
    };

    let manager = songbird::get(ctx.serenity_context()).await
        .expect("Songbird Client placed in at initialisation.").clone();

    let _handler = manager.join(guild.id, connect_to).await;
    ctx.say("Joined your channel!").await?;
    Ok(())
}

#[poise::command(slash_command, prefix_command)]
async fn play(ctx: Context<'_>, #[description = "URL of the song"] url: String) -> Result<(), Error> {
    ctx.defer().await?;
    
    let guild_id = ctx.guild_id().unwrap();
    let manager = songbird::get(ctx.serenity_context()).await.unwrap().clone();

    if let Some(handler_lock) = manager.get(guild_id) {
        let mut handler = handler_lock.lock().await;

        match songbird::input::ytdl(&url).await {
            Ok(source) => {
                handler.play_source(source);
                ctx.say(format!("Now playing: {}", url)).await?;
            }
            Err(e) => {
                ctx.say(format!("Failed to stream audio: {:?}", e)).await?;
            }
        }
    } else {
        ctx.say("I am not in a voice channel. Run `/join` or `!join` first!").await?;
    }

    Ok(())
}

#[poise::command(slash_command, prefix_command)]
async fn leave(ctx: Context<'_>) -> Result<(), Error> {
    let guild_id = ctx.guild_id().unwrap();
    let manager = songbird::get(ctx.serenity_context()).await.unwrap().clone();
    
    if manager.get(guild_id).is_some() {
        manager.remove(guild_id).await?;
        ctx.say("Left the channel.").await?;
    } else {
        ctx.say("I'm not in a voice channel.").await?;
    }
    
    Ok(())
}

#[tokio::main]
async fn main() {
    let token = env::var("DISCORD_TOKEN").expect("Expected a DISCORD_TOKEN");
    
    // Explicitly request the Message Content intent so `!play` works
    let intents = serenity::GatewayIntents::non_privileged() | serenity::GatewayIntents::MESSAGE_CONTENT;

    // Define framework options (commands and prefixes)
    let options = poise::FrameworkOptions {
        commands: vec![join(), play(), leave()],
        prefix_options: poise::PrefixFrameworkOptions {
            prefix: Some("!".into()),
            ..Default::default()
        },
        ..Default::default()
    };

    // Correct initialization format for Poise 0.5
    let framework = poise::Framework::builder()
        .options(options)
        .token(token)
        .intents(intents)
        .client_settings(|builder| builder.register_songbird()) // Injects the audio engine
        .setup(|ctx, _ready, framework| {
            Box::pin(async move {
                poise::builtins::register_globally(ctx, &framework.options().commands).await?;
                println!("Music bot is running!");
                Ok(Data {})
            })
        });

    // Start the bot
    if let Err(why) = framework.run().await {
        println!("Client error: {:?}", why);
    }
}