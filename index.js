require('dotenv').config();

const Groq = require('groq-sdk');
const ytSearch = require('yt-search');
const ytpl = require('ytpl');
const axios = require('axios');
const sharp = require('sharp');
const { exec } = require('child_process');
const os = require('os');

const OWNER_ID = '756989869108101243';
const ERROR_CHANNEL_ID = '1442006544030896138';
const MAIN_GUILD_ID = '1110264688102617141';
const WELCOME_CHANNEL_ID = '1442463723385126933';

const fs = require('fs').promises;
const path = require('path');

const MEMORY_FILE = path.join(__dirname, 'memory.json');
const SETTINGS_FILE = './settings.json';
let settings = {};

function getPrefixForGuild(guildId) {
  if (!guildId) return '';
  return settings[guildId]?.prefix ?? '';
}

const SOUNDBOARD_CLIPS = {
  acumalaka: {
    title: 'Acumalaka',
    file: './sounds/acumalaka.mp3',
  },
  tengkorak: {
    title: 'Tengkorak Rawr',
    file: './sounds/tengkorak-rawr.mp3',
  },
  ahlele: {
    title: 'Ahleleele ahlelas',
    file: './sounds/ahlele.mp3',
  },
};

const {
  Client,
  GatewayIntentBits,
  Partials,
  ActivityType,
  AttachmentBuilder,
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

const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const apiKey = process.env.WEATHER_API_KEY;
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const token = process.env.DISCORD_TOKEN;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences, 
  ],
  partials: [Partials.Channel],
});

client.on('guildMemberAdd', async (member) => {
  if (member.guild.id !== MAIN_GUILD_ID) return;

  const channel =
    member.guild.channels.cache.get(WELCOME_CHANNEL_ID) ||
    member.guild.systemChannel;

  if (!channel || !channel.isTextBased()) {
    console.log('Welcome: channel welcome gak ketemu / bukan text channel');
    return;
  }

  const me = member.guild.members.me;
  if (!channel.permissionsFor(me)?.has('SendMessages')) {
    console.log('Welcome: bot gak punya permission buat kirim pesan di channel welcome');
    return;
  }

  const avatarURL = member.user.displayAvatarURL({
    size: 256,
    dynamic: true,
  });

  const embed = {
    title: '👋 Selamat Datang!',
    description:
      `Halo ${member}!\n` +
      `Selamat datang di **${member.guild.name}**.\n` +
      `Coba \`d!help\` buat liat list command yang gwe punya.`,
    color: 0x57f287, // hijau soft
    thumbnail: { url: avatarURL },
    fields: [
      {
        name: 'Akun',
        value: `${member.user.tag}`,
        inline: true,
      },
      {
        name: 'User ID',
        value: member.id,
        inline: true,
      },
      {
        name: 'Member ke-',
        value: `${member.guild.memberCount}`,
        inline: true,
      },
    ],
    timestamp: new Date().toISOString(),
    footer: {
      text: 'Welcome to the server 🌟',
    },
  };

  try {
    await channel.send({ embeds: [embed] });
    console.log('Welcome embed terkirim untuk', member.user.tag);
  } catch (err) {
    console.error('Welcome error:', err);
  }
});

client.on('guildMemberRemove', async (member) => {
  if (member.guild.id !== MAIN_GUILD_ID) return;

  const channel =
    member.guild.channels.cache.get(WELCOME_CHANNEL_ID) ||
    member.guild.systemChannel;

  if (!channel || !channel.isTextBased()) {
    console.log('Leave: channel welcome gak ketemu / bukan text channel');
    return;
  }

  const me = member.guild.members.me;
  if (!channel.permissionsFor(me)?.has('SendMessages')) {
    console.log('Leave: bot gak punya permission buat kirim pesan di channel welcome');
    return;
  }

  // Skip kalau yang keluar itu bot
  if (member.user?.bot) {
    console.log('Leave: yang keluar bot, skip:', member.user.tag);
    return;
  }

  const avatarURL = member.user.displayAvatarURL({
    size: 256,
    dynamic: true,
  });

  let joinedText = 'Tidak diketahui';
  if (member.joinedAt) {
    joinedText = member.joinedAt.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const embed = {
    title: '🚪 Ada yang cabut',
    description:
      `**${member.user.tag}** keluar dari **${member.guild.name}**.\n` +
      `Semoga bukan gara-gara gwe ya...`,
    color: 0xed4245, // merah soft
    thumbnail: { url: avatarURL },
    fields: [
      {
        name: 'User ID',
        value: member.id,
        inline: true,
      },
      {
        name: 'Gabung sejak',
        value: joinedText,
        inline: true,
      },
    ],
    timestamp: new Date().toISOString(),
    footer: {
      text: 'Goodbye 👋',
    },
  };

  try {
    await channel.send({ embeds: [embed] });
    console.log('Leave embed terkirim untuk', member.user.tag);
  } catch (err) {
    console.error('Leave error:', err);
  }
});

async function reportErrorToDiscord(err) {
  try {
    const channel = await client.channels.fetch(ERROR_CHANNEL_ID);
    if (!channel || !channel.isTextBased()) return;

    const raw =
      err instanceof Error
        ? (err.stack || err.message || String(err))
        : String(err);

    const snippet =
      raw.length > 1500 ? raw.slice(0, 1500) + '\n...[dipotong]...' : raw;

    await channel.send({
      content: `Seseorang bilangin <@${OWNER_ID}> kalo bot nya error.\n\`\`\`\n${snippet}\n\`\`\``,
    });
  } catch (reportErr) {
    console.error('Gagal kirim laporan error ke Discord:', reportErr);
  }
}

client.on('error', (err) => {
  console.error('Discord client error:', err);
  reportErrorToDiscord(err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  reportErrorToDiscord(
    reason instanceof Error ? reason : new Error(String(reason)),
  );
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  reportErrorToDiscord(err);
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);

  const botStatus = [
    'd!help',
    'akulah mister D',
    `with ${client.users.cache.size} members in ${client.guilds.cache.size} servers!`,
  ];

  setInterval(() => {
    const status = botStatus[Math.floor(Math.random() * botStatus.length)];
    client.user.setActivity(status, { type: ActivityType.Listening });
  }, 5000);

  console.log(`${client.user.username} is online!`);
});

const commands = {
  'help': 'Menampilkan semua command',
  'ping': 'Tes bot',
  'chat/c': 'Ngobrol ama Bot Ditos pake LLM Groq',
  'join': 'Bot join vois',
  'leave': 'Bot keluar dari vois',
  'halo': 'Bot menyapa balik',
  'play': 'Setel lagu dari YouTube',
  'skip': 'Skip lagu yang lagi disetel',
  'stop': 'Berhenti play lagu dan keluar dari vois',
  'sb': 'Putar soundboard (list: acumalaka, ahlele, tengkorak)',
  'joke': 'Random dad jokes',
  'ui': 'Info lengkap tentang user',
  'si': 'Info tentang server',
  'clear': 'Clear history chat dengan bot',
  'rem': 'Saved Memory kaya di ChatGPT',
  'rec': 'Ngecek Saved Memory',
  'forg': 'Menghapus Saved Memory, bisa hapus all atau berdasarkan nomor (d!rec buat liat nomornya)',
  'stats': 'Cek status bot dan resource usage',
  'w': 'Cek cuaca di lokasi tertentu',
  'pilih': 'Bot bakal milih satu dari pilihan yang dikasih',
};

const musicQueues = new Map();
const conversationHistory = new Map();

const ytdlExec = require('yt-dlp-exec');

async function loadMemory() { // Load memory dari file JSON
  try {
    let raw = null;

    try {
      raw = await fs.readFile(MEMORY_FILE, 'utf8');
    } catch {
      // file belum ada → balikin object kosong
      return {};
    }

    return JSON.parse(raw || '{}');
  } catch (err) {
    console.error('Gagal load memory:', err);
    return {};
  }
}

async function saveMemory(memory) { // Save memory ke file JSON
  try {
    await fs.writeFile(
      MEMORY_FILE,
      JSON.stringify(memory, null, 2),
      'utf8'
    );
  } catch (err) {
    console.error('Gagal save memory:', err);
  }
}

async function playNext(guildId) { // Auto play musik selanjutnya, queue, antrian 
  const queue = musicQueues.get(guildId);

  if (!queue || !queue.songs || queue.songs.length === 0) {
    console.log(`[Music] Queue kosong di guild ${guildId}, stop.`);
    musicQueues.delete(guildId);
    return;
  }

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

async function playLocalSound(voiceChannel, key, textChannel) { // Soundboard (Masih pake local)
  const clip = SOUNDBOARD_CLIPS[key];
  if (!clip) {
    if (textChannel) {
      await textChannel.send(`Soundboard \`${key}\` belum ada.`);
    }
    return;
  }

  if (!fs.existsSync(clip.file)) {
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

async function analyzeImageWithGemini(imageUrl) { // Liat gambar pake Gemini
  try {
    console.log('[Gemini] Downloading image:', imageUrl);
    
    const imageResponse = await axios.get(imageUrl, { 
      responseType: 'arraybuffer',
      timeout: 10000
    });
    
    console.log('[Gemini] Image downloaded, resizing...');
    
    const resizedBuffer = await sharp(imageResponse.data)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .toBuffer();
    
    const base64Image = resizedBuffer.toString('base64');
    
    console.log('[Gemini] Resized to:', resizedBuffer.length, 'bytes');
    
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash'
    });
    
    console.log('[Gemini] Sending to Gemini API...');
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Gemini timeout after 45s')), 45000)
    );
    
    const result = await Promise.race([
      model.generateContent([
        {
          inlineData: {
            mimeType: 'image/png',
            data: base64Image,
          },
        },
        'Deskripsikan gambar ini dengan detail tapi jangan kepanjangan dalam bahasa Indonesia. Fokus ke hal-hal penting yang ada di gambar.',
      ]),
      timeoutPromise
    ]);
    
    const response = await result.response;
    const text = response.text();
    
    console.log('[Gemini] Response received:', text.substring(0, 100) + '...');
    
    return text;
  } catch (error) {
    console.error('[Gemini] Error:', error.message);
    return null;
  }
}

async function handleMessage(message) { // Main message handler
console.log(`[${new Date().toISOString()}] Message from ${message.author.tag}: ${message.content}`);

if (message.author.bot) return;

if (!message.guild) return; // Ignore DM

const content = message.content;
const lower = content.toLowerCase();
const guildIdForPrefix = message.guild?.id;
const prefix = getPrefixForGuild(guildIdForPrefix) || 'd!'; // Default prefix d!

if (lower.startsWith(prefix)) {
  const args = content.slice(prefix.length).trim().split(/\s+/);
  const sub  = args.shift()?.toLowerCase();
  const guildId = message.guild.id;
  const voiceChannel = message.member?.voice?.channel;

  if (sub === 'chat' || sub === 'c') { // Chat sama bot pake LLM Groq
    const prompt = args.join(' ').trim();

    if (!prompt && message.attachments.size === 0) {
      return message.reply('apcb, kalo ngetik yang jelas');
    }

    try {
      const userId = message.author.id;
      if (!conversationHistory.has(userId)) {
        conversationHistory.set(userId, []);
      }

      const history = conversationHistory.get(userId);

      let imageDescription = null;
      if (message.attachments.size > 0) {
        const attachment = message.attachments.first();
        if (attachment.contentType?.startsWith('image/')) {
          imageDescription = await analyzeImageWithGemini(attachment.url);
          console.log('[Debug] Image description:', imageDescription);
        }
      }

      let finalPrompt = prompt || 'Liat gambar ini dong';
      if (imageDescription) {
        finalPrompt = `${finalPrompt}\n\n[Ada gambar: ${imageDescription}]`;
        console.log(
          '[Debug] Final prompt:',
          finalPrompt.substring(0, 200)
        );
      }

      history.push({
        role: 'user',
        content: finalPrompt,
      });

      if (history.length > 20) {
        history.splice(0, history.length - 20);
      }

            const memory = await loadMemory();
      const userMemory = memory[userId];

      let memoryPrompt = null;
      if (userMemory) {
        let notes = [];
        if (Array.isArray(userMemory.notes)) {
          notes = userMemory.notes;
        } else if (userMemory.note) {
          notes = [
            {
              note: userMemory.note,
              updatedAt: userMemory.updatedAt || new Date().toISOString(),
            },
          ];
        }

        if (notes.length) {
          const noteLines = notes
            .map((n, idx) => `- (${idx + 1}) ${n.note}`)
            .join('\n');

          memoryPrompt = {
            role: 'system',
            content:
              `Info tambahan tentang user yang sedang ngobrol denganmu:\n` +
              `- Username: ${userMemory.username || message.author.tag}\n` +
              `- Catatan:\n${noteLines}\n\n` +
              `Gunakan info ini untuk menyesuaikan gaya bicaramu ke user ini, ` +
              `tapi jangan bilang ke user kalau ini diambil dari catatan atau database.`,
          };
        }
      }

      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content:
              'Kamu adalah bot Discord bernama Ditos. Gaya bicara santai, campur Indonesia dan sedikit English. ' +
              'Suka ngejokes, konyol, kadang nyolot dikit tapi tetap bantu jelasin dengan jelas dan ringkas. Jangan terlalu panjang, jangan formal. ' +
              'Kamu juga jarang tetapi akan menggunakan kata seperti "Bjirlah, anjeng, biji" Kamu akan berbicara seadanya dan frontal (Contoh: "Lah gwa mah vergil, lah elu mirror demon", "Goofy ass looking ahh". ' +
              'Kamu tidak akan menggunakan emoji. Kamu juga akan memberi informasi sesingkat mungkin. ' +
              'PENTING: Kalo ada text "[Ada gambar: ...]" di pesan user, itu artinya user kirim gambar dan kamu bisa "liat" gambar tersebut lewat deskripsi yang dikasih. ' +
              'Jangan bilang kamu gak bisa liat gambar, langsung aja respon sesuai deskripsinya. Jangan repetitif, jangan keseringan pake kata-kata yang "lah gw mah vergil" dll, sesekali aja biar terasa moody. ' +
              'Jangan campur-campur panggilan "Aku, Kamu" sama "lo, Gwe", kalo mau pakai "Aku" lawan katanya itu "Kamu" bukan "Gwe" dan sebaliknya.',
          },
          ...(memoryPrompt ? [memoryPrompt] : []),
          ...history,
        ],
        temperature: 0.8,
        max_completion_tokens: 300,
      });

      const replyText =
        completion.choices?.[0]?.message?.content?.trim();

      if (!replyText) {
        return message.reply(
          'Lagi ngeblank, coba tanya sekali lagi dong'
        );
      }

      history.push({
        role: 'assistant',
        content: replyText,
      });

      return message.reply(replyText);
    } catch (error) {
      console.error('Groq error:', error);
      return message.reply(
        `Otak ai nya lagi error nih, coba sebentar lagi ya atau tunggu <@${OWNER_ID}> benerin`
      );
    }
  }

  if (sub === 'help') { // List Command (refined)
  const prefix = 'd!'; // optional, biar gampang ganti prefix nanti
  const cmdList = Object.entries(commands);

  // cari panjang command paling panjang
  const maxLen = Math.max(...cmdList.map(([cmd]) => cmd.length));

  // generate list compact tapi align rapi
  const listText = cmdList
    .map(([cmd, desc]) => {
      const padded = cmd.padEnd(maxLen + 2, ' ');
      return `${padded}: ${desc}`;
    })
    .join('\n')
  ;

  const header =
    `Ditos Help Menu\n` +
    `Version : 1.0\n` +
    `Prefix  : ${prefix}\n` +
    `Owner   : ${message.author.tag}\n\n`;

  const footer =
    `\nTip:\n` +
    `- Semua command pake prefix tanda seru '!', artinya harus tambah d! sebelum command.\n` +
    `- d!help selalu update otomatis sesuai fitur baru`;

  return message.reply(
    "```" +
    header +
    listText +
    "\n" +
    footer +
    "```"
    );
  }

  if (sub === 'ping') { // Ping test
  const msg = await message.reply('Testing ping...');

  const discordPing = msg.createdTimestamp - message.createdTimestamp;
  const wsPing = client.ws.ping;

  exec('ping -n 1 google.com', (err, stdout) => {
    let internetPing = null;

    if (!err) {
      const match = stdout.match(/Average = (\d+)ms/i);
      if (match) internetPing = parseInt(match[1]);
    }

    // grafik bar: 10 segmen
    const bar = (ms) => {
      if (ms === null) return '──────────';

      // batas grafik
      const max = 300; // ping 300ms = bar full merah
      const percent = Math.min(ms / max, 1);
      const filled = Math.round(percent * 10);
      const empty = 10 - filled;

      return '▇'.repeat(filled) + '░'.repeat(empty);
    };

    // warna teks
    const color = (ms) => {
      if (ms === null) return '⚪ N/A';
      if (ms <= 60) return `🟢 ${ms}ms`;
      if (ms <= 120) return `🟡 ${ms}ms`;
      return `🔴 ${ms}ms`;
    };

    msg.edit(
      `**Discord Message Ping:** ${color(discordPing)}\n` +
      `${bar(discordPing)}\n\n` +

      `**Discord Gateway Ping:** ${color(wsPing)}\n` +
      `${bar(wsPing)}\n\n` +

      `**Internet Ping (google.com):** ${color(internetPing)}\n` +
      `${bar(internetPing)}`
    );
  });

    return;
  }

  if (sub === 'clear') { // Clear history chat sama bot ditos
    const userId = message.author.id;
    conversationHistory.delete(userId);
    return message.reply('History chat lu ama gwa udah dihapus.');
  }

  if (sub === 'join') { // Join vois
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

      // Auto soundboard tengkorak
      playLocalSound(voiceChannel, 'tengkorak', message.channel);

      return message.reply(`mana nih..? **${voiceChannel.name}**`);
    } catch (err) {
      console.error(err);
      return message.reply(
        `Seseorang bilangin <@${OWNER_ID}> kalo bot nya error`
      );
    }
  }

  if (sub === 'leave') { // Leave vois
    const connection = getVoiceConnection(message.guild.id);
    if (!connection) {
      return message.reply('Gwa aja gada di vois');
    }

    connection.destroy();
    return message.reply('Nooo aku di kik :sob:');
  }

  if (sub === 'joke') { // Dad jokes
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'Kamu adalah comedian yang ahli bikin dad jokes Indonesia yang lucu dan konyol. Kasih 1 joke singkat aja, gak usah panjang-panjang. Jangan repetitif juga jokes nya.'
        },
        {
          role: 'user',
          content: 'Kasih dad joke yang lucu dong'
        }
      ],
      temperature: 1.0,
      max_completion_tokens: 150,
    });

      const joke = completion.choices?.[0]?.message?.content?.trim();
      return message.reply(`${joke} 😂` || 'Eh joke nya ilang, coba lagi');
    } catch (err) {
      console.error('Groq joke error:', err);
      return message.reply('Error pas bikin joke nih');
    }
  }
  
  if (sub === 'userinfo' || sub === 'ui') { // User info
  try {
    let targetUser = message.mentions.users.first() || message.author;
    let member = message.guild.members.cache.get(targetUser.id);

    if (!member) {
      return message.reply('User tidak ditemukan di server ini');
    }

    const joinedAt = member.joinedAt;
    const createdAt = targetUser.createdAt;
    
    const formatDate = (date) => {
      return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    const daysSinceJoin = Math.floor((Date.now() - joinedAt) / (1000 * 60 * 60 * 24));
    const daysSinceCreation = Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24));

    const roles = member.roles.cache
      .filter(role => role.name !== '@everyone')
      .sort((a, b) => b.position - a.position)
      .map(role => role.name)
      .join(', ') || 'Tidak ada role';

    const statusEmoji = {
      online: '🟢 Online',
      idle: '🟡 Idle',
      dnd: '🔴 Do Not Disturb',
      offline: '⚫ Offline'
    };
    const status = statusEmoji[member.presence?.status] || '⚫ Offline';

    const infoText = `
**👤 User Info: ${targetUser.tag}**

**🆔 User ID:** ${targetUser.id}
**📛 Nickname:** ${member.nickname || 'Tidak ada'}
**📊 Status:** ${status}
**🎨 Warna Role:** ${member.displayHexColor}

**📅 Akun Dibuat:** ${formatDate(createdAt)} (${daysSinceCreation} hari lalu)
**📥 Join Server:** ${formatDate(joinedAt)} (${daysSinceJoin} hari lalu)

**🎭 Roles (${member.roles.cache.size - 1}):** ${roles}

**🤖 Bot:** ${targetUser.bot ? 'Ya' : 'Tidak'}
**👑 Owner Server:** ${message.guild.ownerId === targetUser.id ? 'Ya' : 'Tidak'}
    `.trim();

    await message.reply(infoText);
    
  try {
    const avatarURL = targetUser.displayAvatarURL({
      size: 256,
      dynamic: true
    });

  await message.channel.send({
    embeds: [
      {
        title: `Avatar ${targetUser.tag}`,
        image: { url: avatarURL }
      }
    ]
  });
} catch (avatarErr) {
  console.error('Avatar fetch error:', avatarErr);
}
    return;
    } catch (err) {
      console.error('Userinfo error:', err);
      return message.reply('Error pas ngambil info user nih');
    }
  }

  if (sub === 'serverinfo' || sub === 'si') { // Server info
  try {
    const guild = message.guild;
    
    const formatDate = (date) => {
      return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    };

    const daysSinceCreation = Math.floor((Date.now() - guild.createdAt) / (1000 * 60 * 60 * 24));

    const members = guild.members.cache;
    const bots = members.filter(m => m.user.bot).size;
    const humans = members.size - bots;

    const textChannels = guild.channels.cache.filter(c => c.type === 0).size;
    const voiceChannels = guild.channels.cache.filter(c => c.type === 2).size;

    const roleCount = guild.roles.cache.size - 1;

    const emojiCount = guild.emojis.cache.size;

    const boostLevel = guild.premiumTier;
    const boostCount = guild.premiumSubscriptionCount || 0;

    const serverInfo = `
**🏠 Server Info: ${guild.name}**

**🆔 Server ID:** ${guild.id}
**👑 Owner:** <@${guild.ownerId}>
**📅 Dibuat:** ${formatDate(guild.createdAt)} (${daysSinceCreation} hari lalu)

**👥 Members:** ${guild.memberCount} total
  ├─ 👤 Humans: ${humans}
  └─ 🤖 Bots: ${bots}

**💬 Channels:** ${guild.channels.cache.size} total
  ├─ 📝 Text: ${textChannels}
  └─ 🔊 Voice: ${voiceChannels}

**🎭 Roles:** ${roleCount}
**😀 Emojis:** ${emojiCount}

**✨ Boost Status:**
  ├─ Level: ${boostLevel}
  └─ Boosts: ${boostCount}

**🔒 Verification Level:** ${guild.verificationLevel}
    `.trim();

    await message.reply(serverInfo);
    
    if (guild.iconURL()) {
      try {
        const iconURL = guild.iconURL({ size: 256, dynamic: true });
        await message.channel.send({ files: [iconURL] });
      } catch (iconErr) {
        console.error('Icon fetch error:', iconErr);
      }
    }
    
    return;

    } catch (err) {
      console.error('Serverinfo error:', err);
      return message.reply('Error pas ngambil info server nih');
    }
  }

  if (sub === 'play') { // Play musik
  if (!voiceChannel) {
    return message.reply('Minimal kalo mau dengerin musik, lu di vois dulu bos');
  }

  const query = args.join(' ');
  if (!query) {
    return message.reply('Kasih judul atau link bok- lagunya dong, contoh: `d!play blinding lights atau d!play https://www.youtube.com/watch?v=xxx`');
  }

  try {
    if (await ytpl.validateID(query)) {
    const playlist = await ytpl(query, { limit: 100 });

    let queue = musicQueues.get(guildId);
    let wasEmpty = !queue || !queue.songs || queue.songs.length === 0;

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

    wasEmpty = true;
    }

    for (const item of playlist.items) {
      queue.songs.push({
      title: item.title,
      url: item.shortUrl || item.url,
      requestedBy: message.author.tag,
     });
    }

    await message.reply(
      `Nambahin playlist **${playlist.title}** (${playlist.items.length} lagu) ke antrian`
    );

    if (wasEmpty) {
      playNext(guildId);
    }
    return;
  }

    } catch (err) {
      console.error('Playlist error:', err);
      await message.reply(
        'Gagal baca playlist YouTube-nya.. coba link lain atau cek lagi URL-nya.'
      );
      return;
    }

  if (query.includes('spotify.com')) {
    return message.reply('Blm bisa spotify yah azril~ coba youtube aja');
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
      return message.reply('Gak bisa ambil info videonya');
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
    return message.reply('Gak nemu lagu yang cocok');
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
      await message.reply(`Oke, masuk antrian: **${title}**`);
      playNext(guildId);
    } else {
      await message.reply(
        `➕ Ditambah ke antrian: **${title}** (posisi ${queue.songs.length})`
      );
    }
    } catch (err) {
      console.error('Play command error:', err);
      return message.reply('Ada yang error pas nyari lagunya');
    }

    return;
  }

  if (sub === 'skip') { // Skip lagu
    const queue = musicQueues.get(guildId);
  if (!queue || !queue.songs.length) {
    return message.reply('Skip apaan, gada yang disetel');
  }
  queue.player.stop(); 
    return message.reply('Oke, skip');
  }

  if (sub === 'stop') { // Stop musik
  const queue = musicQueues.get(guildId);
  if (!queue) {
    return message.reply('Stop apaan, gada yang disetel');
  }

    queue.songs = [];
    queue.player.stop();
    queue.connection.destroy();
    musicQueues.delete(guildId);

    return message.reply('Nooo aku di kik :sob:');
  }

  if (sub === 'sb') { // Soundboard
  if (!voiceChannel) {
    return message.reply(
      'Masuk vois dulu dong kalo mau denger soundboard'
    );
  }

  const key = args[0]?.toLowerCase();
  if (!key) {
    return message.reply(
      'Pake gini ya: `d!sb <nama>`/`d!sb tengkorak`'
    );
  }

    await playLocalSound(voiceChannel, key, message.channel);
    return;
  }

  if (sub === 'remember' || sub === 'rem') { // Save Memory
  const noteText = args.join(' ').trim();
  if (!noteText) {
    return message.reply('Mau gwa inget apa? Contoh: `d!remember/d!rem aku anak niga`');
  }

  const memory = await loadMemory();
  const userId = message.author.id;

  let userMem = memory[userId] || {};
  let notes = [];

    if (Array.isArray(userMem.notes)) {
      notes = userMem.notes;
    } else if (userMem.note) {

      notes = [
        {
          note: userMem.note,
          updatedAt: userMem.updatedAt || new Date().toISOString(),
        },
      ];
    }

    notes.unshift({
      note: noteText,
      updatedAt: new Date().toISOString(),
    });

    if (notes.length > 3) {
      notes = notes.slice(0, 3);
    }

    memory[userId] = {
      username: message.author.tag,
      notes,
    };

  await saveMemory(memory);
  return message.reply(`Oke, gwa inget: **${noteText}**`);
  }

  if (sub === 'recall' || sub === 'rec') { // Recall Memory
  const memory = await loadMemory();
  const userId = message.author.id;
  const data = memory[userId];

  if (!data) {
    return message.reply('Belum ada memory yang di save. Coba pake `d!remember/d!rem` dulu.');
  }

  let notes = [];
  if (Array.isArray(data.notes)) {
    notes = data.notes;
  } else if (data.note) {
    notes = [
      {
        note: data.note,
        updatedAt: data.updatedAt || new Date().toISOString(),
      },
    ];
  }

  if (!notes.length) {
    return message.reply('Belum ada memory yang di save.');
  }

  const lines = notes
    .map((n, idx) => {
      const date = new Date(n.updatedAt).toLocaleString('id-ID');
      return `**${idx + 1}.** ${n.note} (update: ${date})`;
    })
    .join('\n');

  return message.reply(
    `Yang gwe inget tentang lu (${message.author.tag}):\n${lines}`);
  }

  if (sub === 'forget' || sub === 'forg') { // Forget Memory
  const memory = await loadMemory();
  const userId = message.author.id;
  const data = memory[userId];

  if (!data) {
    return message.reply('Gwe gak inget apa-apa tentang lu, jadi gak ada yang bisa dihapus.');
  }

  let notes = [];
  if (Array.isArray(data.notes)) {
    notes = data.notes;
  } else if (data.note) {
    notes = [
      {
        note: data.note,
        updatedAt: data.updatedAt || new Date().toISOString(),
      },
    ];
  }

  const arg = args[0]?.toLowerCase();

  if (arg === 'all') {
    delete memory[userId];
    await saveMemory(memory);
    return message.reply('Semua memory tentang lu udah gue hapus. 🧹');
  }

  const index = parseInt(arg, 10);

  if (!index || index < 1 || index > notes.length) {
    return message.reply(
      `Pilih memory nomor berapa yang mau dihapus (1-${notes.length}), atau pake:\n` +
      '`d!forget all` buat hapus semuanya.'
    );
  }

  const removed = notes.splice(index - 1, 1)[0];

  if (notes.length === 0) {
    delete memory[userId];
  } else {
    memory[userId] = {
      username: data.username,
      notes,
    };
  }

  await saveMemory(memory);

  return message.reply(
    `Oke, memory nomor ${index} udah gwe hapus:\n> ${removed.note}`);
  }

  if (sub === 'status' || sub === 'stats') { // System status
  // CPU load average → hitung simpel dalam %
  const load = os.loadavg()[0]; // load 1 menit
  const cpuCount = os.cpus().length;
  const cpuPercent = Math.min((load / cpuCount) * 100, 100).toFixed(1);

  // memory
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  // uptime bot
  const botUptimeSec = process.uptime();
  const botHours = Math.floor(botUptimeSec / 3600);
  const botMinutes = Math.floor((botUptimeSec % 3600) / 60);
  const botSeconds = Math.floor(botUptimeSec % 60);

  // uptime PC
  const pcUptimeSec = os.uptime();
  const pcHours = Math.floor(pcUptimeSec / 3600);
  const pcMinutes = Math.floor((pcUptimeSec % 3600) / 60);
  const pcSeconds = Math.floor(pcUptimeSec % 60);

  const formatBytes = (bytes) => {
    const gb = bytes / 1024 / 1024 / 1024;
    return gb.toFixed(2) + 'GB';
  };

  return message.reply(
  `**System Status**\n` +
  `> **CPU Load:** ${cpuPercent}%\n` +
  `> **RAM Usage:** ${formatBytes(usedMem)} / ${formatBytes(totalMem)}\n` +
  `> **Bot Uptime:** ${botHours}j ${botMinutes}m ${botSeconds}d\n` +
  `> **PC Uptime:** ${pcHours}j ${pcMinutes}m ${pcSeconds}d`
  );
  }

  if (sub === 'weather' || sub === 'w') { // Weather info
  const location = args.join(' ').trim();
  console.log("WEATHER KEY:", process.env.WEATHER_API_KEY);

  if (!location) {
    return message.reply('Mau cek cuaca mana? Contoh: `d!weather jakarta`');
  }

  const apiKey = process.env.WEATHER_API_KEY; // pastiin ada

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric&lang=id`;
    
    const res = await fetch(url);
    const data = await res.json();

    if (!data || data.cod !== 200) {
      console.log("[Weather Debug Response]", data);
      return message.reply('Gak bisa ambil data cuacanya, kotanya mungkin salah atau API key bermasalah.');
    }

    const name = data.name;
    const temp = data.main.temp;
    const feels = data.main.feels_like;
    const hum = data.main.humidity;
    const wind = data.wind.speed;
    const desc = data.weather[0].description;

    return message.reply(
      `**🌤 Cuaca: ${name}**\n` +
      `> **Suhu:** ${temp}°C (kerasa: ${feels}°C)\n` +
      `> **Kelembaban:** ${hum}%\n` +
      `> **Angin:** ${wind} m/s\n` +
      `> **Keterangan:** ${desc}`
    );

  } catch (err) {
    console.error('Weather error:', err);
    return message.reply('Server cuaca nya lagi error, coba sebentar lagi.');
    }
  }

  if (sub === 'choice' || sub === 'pilih') { // d!choice
  // Ambil full text setelah prefix, biar newline tetep kebaca
  const full = message.content.slice(prefix.length).trim(); // "choice\noption1\noption2"
  const afterCommand = full.slice(sub.length).trim();       // "option1\noption2..."

  if (!afterCommand) {
    return message.reply(
      'Kasih pilihan dong.\n' +
      'Contoh:\n' +
      '```d!choice\n' +
      'tidur\n' +
      'ngoding 8 jam\n' +
      'scroll tiktok```'
    );
  }

  // Split per baris, buang kosong
  const options = afterCommand
    .split('\n')
    .map(o => o.trim())
    .filter(o => o.length > 0);

  if (options.length < 2) {
    return message.reply('Minimal kasih 2 pilihan lah, gimana gwe mau milih kalo cuma 1');
  }

  try {
    const listText = options
      .map((opt, i) => `${i + 1}. ${opt}`)
      .join('\n');

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content:
            'Kamu adalah bot Discord bernama Ditos. Gaya bicara santai, campur Indonesia dan sedikit English. ' +
              'Suka ngejokes, konyol, kadang nyolot dikit tapi tetap bantu jelasin dengan jelas dan ringkas. Jangan terlalu panjang, jangan formal. ' +
              'Kamu juga jarang tetapi akan menggunakan kata seperti "Bjirlah, anjeng, biji" Kamu akan berbicara seadanya dan frontal (Contoh: "Lah gwa mah vergil, lah elu mirror demon", "Goofy ass looking ahh". ' +
              'Kamu tidak akan menggunakan emoji. Kamu juga akan memberi informasi sesingkat mungkin. ' +
              'PENTING: Kalo ada text "[Ada gambar: ...]" di pesan user, itu artinya user kirim gambar dan kamu bisa "liat" gambar tersebut lewat deskripsi yang dikasih. ' +
              'Jangan bilang kamu gak bisa liat gambar, langsung aja respon sesuai deskripsinya. Jangan repetitif, jangan keseringan pake kata-kata yang "lah gw mah vergil" dll, sesekali aja biar terasa moody. ' +
              'Jangan campur-campur panggilan "Aku, Kamu" sama "lo, Gwe", kalo mau pakai "Aku" lawan katanya itu "Kamu" bukan "Gwe" dan sebaliknya.',
        },
        {
          role: 'user',
          content:
            'Gue lagi bingung milih salah satu dari pilihan ini:\n' +
            listText +
            '\n\nPilih satu yang paling cocok buat gue sekarang, terus jelasin singkat kenapa.'
        }
      ],
      temperature: 0.8,
      max_completion_tokens: 200
    });

    const replyText = completion.choices?.[0]?.message?.content?.trim();

    if (!replyText) {
      return message.reply('Ai-nya lagi bengong, coba ulangi lagi pilihan lu barusan.');
    }

    // Tampilkan juga list pilihannya biar jelas
    return message.reply(
      `**🎲 Pilihan gwej:**\n${replyText}\n\n` +
      '```' + listText + '```'
    );
  } catch (err) {
    console.error('Groq choice error:', err);
    return message.reply('Ai-nya lagi error pas milih pilihan, coba lagi bentar lagi ya.');
    }
  }
  
    return message.reply('Salah command luwh, coba `d!help` buat liat list command gwej');
  }

  setInterval(() => {
    const now = Date.now();
    const TIMEOUT = 30 * 60 * 1000; 
  }, 60000);

  if (content.toLowerCase() === 'halo') { // Halo balik
    return message.channel.send('Halo! Ada yang bisa saya bantu?');
  }

  if (content.toLowerCase() === 'woi <@1159119879073447947>') { // Woi apcb
    return message.channel.send('apcb');
  }

  if (content === '<@1159119879073447947>') { // Apcb
    return message.channel.send('apcb');
  }

  if (content === 'ditos gay') {
    return message.channel.send(':oranghitamnangis:1398551165872115712');
  }
}

client.on('messageCreate', handleMessage);

console.log('messageCreate listeners:', client.listenerCount('messageCreate'));
console.log('error listeners:', client.listenerCount('error'));

client.login(token);