const { musicQueues } = require('../../data/state');

module.exports = {
    name: 'stop',
    aliases: ['leave', 'dc', 'disconnect'], // 'leave' dan 'dc' logicnya sama di index.js (line 3231)
    description: 'Stop musik & disconnect bot',
    async execute(message, args, client) {
        const { guildId } = message;
        const queue = musicQueues.get(guildId);

        if (!queue) {
            return message.reply('Stop apaan, gada yang disetel');
        }

        queue.songs = [];
        queue.player.stop();
        queue.connection.destroy();
        musicQueues.delete(guildId);

        const embed = generateMusicEmbed(guildId);
        if (embed) {
            return message.channel.send({ embeds: [embed], components: [getMusicButtons(guildId)] });
        }
        return message.reply('Nooo aku di kik :sob:');
    },
};
