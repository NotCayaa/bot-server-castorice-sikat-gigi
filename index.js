require('dotenv').config();

const Groq = require('groq-sdk');
const ytSearch = require('yt-search');

const {
  Client,
  GatewayIntentBits,
  Partials,
  ActivityType,
} = require('discord.js');

const {
  joinVoiceChannel,
  getVoiceConnection,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
} = require('@discordjs/voice');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const token = process.env.DISCORD_TOKEN;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent, 
  ],
  partials: [Partials.Channel],
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);

  const botStatus = [
    'akulah mister D',
    `${client.users.cache.size} users!`,
    `${client.guilds.cache.size} servers!`,
  ];

  setInterval(() => {
    const status = botStatus[Math.floor(Math.random() * botStatus.length)];
    client.user.setActivity(status, { type: ActivityType.Listening });
  }, 5000);

  console.log(`${client.user.username} is online!`);
});

const commands = {
  '!ditoshelp': 'Menampilkan semua command',
  '!ditosping': 'Tes bot (bot reply !pong)',
  '!ditos <pesan>': 'Chat dengan LLM Groq',
  '!sinijoin': 'Bot join voice channel',
  '!sanaleave': 'Bot keluar dari voice channel',
  'halo': 'Bot menyapa balik',
  'ditos play <judul atau link>': 'Memutar musik dari YouTube',
  'ditos skip': 'Melewati lagu yang sedang diputar',
  'ditos stop': 'Menghentikan pemutaran musik dan keluar dari voice channel',
};

const musicQueues = new Map(); 

const ytdlExec = require('yt-dlp-exec');

async function playNext(guildId) {
  const queue = musicQueues.get(guildId);
  if (!queue) return;

  const song = queue.songs[0];
  if (!song) {
    queue.player.stop();
    queue.connection.destroy();
    musicQueues.delete(guildId);
    return;
  }

  try {
    const subprocess = ytdlExec.exec(song.url, {
      output: '-',
      format: 'bestaudio[ext=m4a]/bestaudio',
    });

    subprocess.stderr.on('data', (data) => {
      console.log('[yt-dlp]', data.toString());
    });

    const resource = createAudioResource(subprocess.stdout, {
      inputType: StreamType.Arbitrary,
    });

    queue.player.play(resource);
    await queue.textChannel.send(`Playing: **${song.title}**`);
  } catch (err) {
    console.error('yt-dlp error:', err);
    queue.songs.shift();
    playNext(guildId);
  }
}

async function handleMessage(message) {
  if (message.author.bot) return; 

  console.log(`Message from ${message.author.tag}: ${message.content}`);

  const content = message.content;
  const lower = content.toLowerCase();

  if (lower.startsWith('ditos ')) {
    const args = content.slice('ditos '.length).trim().split(/\s+/);
    const sub = args.shift()?.toLowerCase();

    const guildId = message.guild.id;

    const voiceChannel = message.member?.voice?.channel;

  if (sub === 'play') {
  if (!voiceChannel) {
    return message.reply('Minimal kalo mau dengerin musik, lu di vois dulu bos');
  }

  const query = args.join(' ');
  if (!query) {
    return message.reply('kasih judul atau link bok- lagunya dong, contoh: `ditos play funky town`');
  }

  if (query.includes('spotify.com')) {
    return message.reply('blm bisa spotify yah azril~ coba youtube aja');
  }

  try {
    let url;
    let title;

  const isYTUrl =
  query.includes('youtube.com/watch') ||
  query.includes('youtu.be/');

if (isYTUrl) {
  let videoId = null;

  if (query.includes('watch?v=')) {
    videoId = query.split('v=')[1].split('&')[0];
  } else if (query.includes('youtu.be/')) {
    videoId = query.split('youtu.be/')[1].split('?')[0];
  }

  if (videoId) {
    const info = await ytSearch({ videoId });
    if (!info || !info.title) {
      return message.reply('gak bisa ambil info videonya');
    }
    url = `https://www.youtube.com/watch?v=${videoId}`;
    title = info.title;
  } else {
    url = query;
    title = query;
  }
} else {
  const res = await ytSearch(query);
  const video = res.videos && res.videos.length ? res.videos[0] : null;

  if (!video) {
    return message.reply('gak nemu lagu yang cocok');
  }

  url = video.url;
  title = video.title;
}

    let queue = musicQueues.get(guildId);

    if (!queue) {
      const connection = joinVoiceChannel({
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

      connection.subscribe(player);

      queue = {
        voiceChannel,
        textChannel: message.channel,
        connection,
        player,
        songs: [],
      };

      musicQueues.set(guildId, queue);

      player.on(AudioPlayerStatus.Idle, () => {
        queue.songs.shift();
        playNext(guildId);
      });

      player.on('error', (err) => {
        console.error('Player error:', err);
        queue.songs.shift();
        playNext(guildId);
      });
    }

    queue.songs.push({ title, url });

    if (queue.songs.length === 1) {
      await message.reply(`oke, masuk antrian: **${title}**`);
      playNext(guildId);
    } else {
      await message.reply(
        `➕ Ditambah ke antrian: **${title}** (posisi ${queue.songs.length})`
      );
    }
  } catch (err) {
    console.error('Play command error:', err);
    return message.reply('ada yang error pas nyari lagunya');
  }

  return;
}

    if (sub === 'skip') {
      const queue = musicQueues.get(guildId);
      if (!queue || !queue.songs.length) {
        return message.reply('skip apaan, gada yang disetel');
      }

      queue.player.stop(); 
      return message.reply('oke, skip');
    }

    if (sub === 'stop') {
      const queue = musicQueues.get(guildId);
      if (!queue) {
        return message.reply('stop apaan, gada yang disetel');
      }

      queue.songs = [];
      queue.player.stop();
      queue.connection.destroy();
      musicQueues.delete(guildId);

      return message.reply('nooo aku di kik :sob:');
    }

    return message.reply('aku cuma ngerti `ditos play`, `ditos skip`, sama `ditos stop` buat musik~');
  }

  if (content === '!ditoshelp') {
    let helpText = `@${message.author.username}, **Daftar Command Ditos:**\n\n`;

    for (const [cmd, desc] of Object.entries(commands)) {
      helpText += `**${cmd}** — ${desc}\n`;
    }

    return message.reply(helpText);
  }

  if (content.startsWith('!ditos')) {
    const prompt = content.slice('!ditos'.length).trim();
    if (!prompt) {
      return message.reply(
        'apcb, kalo ngetik yang jelas'
      );
    }

    try {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content:
              'Kamu adalah bot Discord bernama Ditos. Gaya bicara santai, campur Indonesia dan sedikit English. Suka ngejokes, konyol, kadang nyolot dikit tapi tetap bantu jelasin dengan jelas dan ringkas. Jangan terlalu panjang, jangan formal.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.8,
        max_completion_tokens: 300,
      });

      const replyText = completion.choices?.[0]?.message?.content?.trim();

      if (!replyText) {
        return message.reply(
          'Ditos lagi ngeblank, coba tanya sekali lagi dong 😵‍💫'
        );
      }

      return message.reply(replyText);
    } catch (error) {
      console.error('Groq error:', error);
      return message.reply(
        'otak Groq-nya lagi error nih, coba sebentar lagi ya 😭'
      );
    }
  }

  if (content === '!ditosping') {
    return message.reply('!pong');
  }

  if (content.toLowerCase() === 'halo') {
    return message.channel.send('Halo! Ada yang bisa saya bantu?');
  }

  if (content.toLowerCase() === 'woi <@1159119879073447947>') {
    return message.channel.send('apcb');
  }

  if (content === '<@1159119879073447947>') {
    return message.channel.send('apcb');
  }

  if (content === 'ditos gay') {
    return message.channel.send(':oranghitamnangis:');
  }

  if (content === '!sinijoin') {
    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      return message.reply(
        'Minimal kalo mau command ini lu di vois dulu bos'
      );
    }

    try {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: false,
      });

      console.log('Joined voice:', voiceChannel.name);
      return message.reply(`mana nih..? **${voiceChannel.name}**`);
    } catch (err) {
      console.error(err);
      return message.reply(
        'Seseorang bilangin <@756989869108101243> kalo bot nya error'
      );
    }
  }

  if (content === '!sanaleave') {
    const connection = getVoiceConnection(message.guild.id);
    if (!connection) {
      return message.reply('vois aja kagak gw');
    }

    connection.destroy();
    return message.reply('nooo aku di kik :sob:');
  }
}

client.on('messageCreate', handleMessage);

client.on('error', (err) => {
  console.error('Discord client error:', err);
});

client.login(token);