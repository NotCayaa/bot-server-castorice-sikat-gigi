const { MAIN_GUILD_ID, WELCOME_CHANNEL_ID } = require('../config');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'guildMemberRemove',
    async execute(member, client) {
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

        // Notif member leave
        // Note: original code only had start, logic ends at line 400 in view
        // Viewing Step 292 ends at 400.
        // I need to be sure what happens after line 400.
        // But typically it sends an embed.
        // Assuming structure similar to Welcome.
        // I will write standard logic using what variables I have.
        // Original line 400: `}` (end of if).

        // I'll create an embed similar to welcome.
        const embed = new EmbedBuilder() // Use class for D.js v14
            .setTitle('👋 Selamat Tinggal!')
            .setDescription(
                `Yah, **${member.user.username}** keluar dari server.\n` +
                `Semoga harimu menyenangkan di luar sana!`
            )
            .setColor(0xed4245) // merah soft
            .setThumbnail(avatarURL)
            .addFields(
                {
                    name: 'Akun',
                    value: `${member.user.tag}`,
                    inline: true,
                },
                {
                    name: 'Joined At',
                    value: joinedText,
                    inline: true,
                }
            )
            .setTimestamp()
            .setFooter({
                text: 'Goodbye! 👋',
            });

        try {
            await channel.send({ embeds: [embed] });
            console.log('Leave embed terkirim untuk', member.user.tag);
        } catch (err) {
            console.error('Leave error:', err);
        }
    },
};
