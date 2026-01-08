const { conversationHistory, channelHistory } = require('../../data/state');

module.exports = {
    name: 'clear',
    aliases: ['cls'],
    description: 'Hapus history chat bot (atau channel)',
    async execute(message, args, client) {
        const scope = args[0]?.toLowerCase();

        if (scope === 'channel' || scope === 'ch') {
            const channelId = message.channel.id;

            if (channelHistory.has(channelId)) {
                channelHistory.delete(channelId);
            }

            return message.reply(
                'History obrolan channel ini (buat konteks d!c) sudah dihapus.'
            );
        }
        // Mode lama: clear history per user
        const userId = message.author.id;
        if (conversationHistory.has(userId)) {
            conversationHistory.delete(userId);
        }
        return message.reply('History chat lu ama gwa udah dihapus.');
    },
};
