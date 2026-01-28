const {
    createAudioResource,
    StreamType,
    getVoiceConnection,
    joinVoiceChannel,
    createAudioPlayer,
    NoSubscriberBehavior,
    AudioPlayerStatus
} = require('@discordjs/voice');
const ytdlExec = require('yt-dlp-exec');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { musicQueues } = require('../data/state');
const { SOUNDBOARD_CLIPS } = require('../data/constants');
const { GTTS_PATH, TEMP_DIR } = require('../config');
const { generateMusicEmbed, getMusicButtons } = require('./uiHelpers');

async function playNext(guildId) { // Auto play musik selanjutnya
    const queue = musicQueues.get(guildId);

    if (!queue || !queue.songs || queue.songs.length === 0) {
        console.log(`[Music] Queue kosong di guild ${guildId}, stop.`);
        musicQueues.delete(guildId);
        return;
    }

    const song = queue.songs[0];
    queue.nowPlaying = song;

    try {
        // [VALIDATION] Ensure videoId exists
        if (!song.videoId && song.url) {
            if (song.url.includes('v=')) song.videoId = song.url.split('v=')[1].split('&')[0];
            else if (song.url.includes('youtu.be/')) song.videoId = song.url.split('youtu.be/')[1].split('?')[0];
        }

        if (!song.videoId) throw new Error("Could not extract Video ID");

        console.log(`[Music] Streaming: ${song.title}`);
        const streamUrl = await musicService.getStreamUrl(song.videoId);
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Referer': 'https://www.youtube.com/',
            'Origin': 'https://www.youtube.com'
        };

        const response = await fetch(streamUrl, { headers });

        if (!response.ok) {
            if (response.status === 403) {
                console.warn("[Music] 403 Forbidden on Cached URL. Invalidating and Retrying...");
                musicCache.streamCache.delete(song.videoId); // Manually clear
                throw new Error("Stream 403 Forbidden");
            }
            throw new Error(`Stream fetch failed: ${response.status}`);
        }

        const { Readable } = require('stream');
        let inputStream = Readable.fromWeb(response.body);

        // FFmpeg Logic: Decode input -> Encode Opus -> Output Ogg
        const child = spawn(ffmpegPath, [
            '-i', 'pipe:0',
            '-analyzeduration', '0',
            '-loglevel', 'warning',
            '-c:a', 'libopus',   // Encode to Opus
            '-f', 'opus',        // Ogg Opus container
            '-ar', '48000',
            '-ac', '2',
            'pipe:1'
        ], { stdio: ['pipe', 'pipe', 'pipe'] });

        inputStream.pipe(child.stdin);

        // [FIX] Prevent EPIPE crash if FFmpeg exits early
        child.stdin.on('error', (err) => {
            if (err.code === 'EPIPE') return;
            console.error('[FFmpeg Stdin] Error:', err);
        });

        inputStream.on('error', err => {
            try { child.kill(); } catch (e) { }
        });

        const resource = createAudioResource(subprocess.stdout, {
            inputType: StreamType.Arbitrary,
            inlineVolume: true,
        });

        queue.player.play(resource);

        resource.volume.setVolume(queue.volume || 1);
        const embed = generateMusicEmbed(guildId); // Kirim embed now playing
        if (embed && queue.textChannel) {
            queue.textChannel.send({
                embeds: [embed],
                components: getMusicButtons(guildId)
            }).catch(err => console.error("Gagal kirim embed music:", err));
        }
    } catch (err) {
        console.error('yt-dlp error:', err);
        queue.songs.shift(); // remove failed song
        playNext(guildId);
    }
}

async function playLocalSound(voiceChannel, key, textChannel) { // Soundboard (Masih pake local)
    const clip = SOUNDBOARD_CLIPS[key];
    if (!clip) {
        if (textChannel) {
            await textChannel.send(`Soundboard \`${key}\` belum ada.`);
        }
        return;
    }

    if (!fs.existsSync(clip.file)) {
        // Try resolving relative to root? 
        // index.js assumes ./sounds/... relative to CWD.
        // If running from same CWD, it should fine.
        if (textChannel) {
            await textChannel.send(
                `File soundboard untuk \`${key}\` nggak ketemu di ${clip.file}`
            );
        }
        return;
    }

    let connection =
        getVoiceConnection(voiceChannel.guild.id) ||
        joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            selfDeaf: false,
        });

    const player = createAudioPlayer({
        behaviors: {
            noSubscriber: NoSubscriberBehavior.Play,
        },
    });

    const stream = fs.createReadStream(clip.file);
    const resource = createAudioResource(stream, {
        inputType: StreamType.Arbitrary,
    });

    connection.subscribe(player);
    player.play(resource);

    player.once(AudioPlayerStatus.Playing, () => {
        console.log(`🔊 Soundboard: ${clip.title}`);
        if (textChannel) {
            textChannel.send(`🗣️ 🔊 Soundboard: **${clip.title}**`);
        }
    });

    player.once(AudioPlayerStatus.Idle, () => {
        player.stop();
    });

    player.on('error', (err) => {
        console.error('Soundboard player error:', err);
        if (textChannel) {
            textChannel.send('Soundboard error, coba lagi ya.');
        }
    });
}

async function ttsGoogle(text, outputFileName) { // TTS pake gTTS CLI
    return new Promise((resolve, reject) => {
        const safe = text.replace(/"/g, '\\"');
        const outPath = path.join(TEMP_DIR, outputFileName);

        const cmd = `"${GTTS_PATH}" "${safe}" --lang id --output "${outPath}"`;

        exec(cmd, (err) => {
            if (err) return reject(err);
            resolve(outPath);
        });
    });
}

module.exports = { playNext, playLocalSound, ttsGoogle };
