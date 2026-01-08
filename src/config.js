const path = require('path');

module.exports = {
    OWNER_ID: '756989869108101243',
    ERROR_CHANNEL_ID: '1442006544030896138',
    MAIN_GUILD_ID: '1110264688102617141',
    WELCOME_CHANNEL_ID: '1442463723385126933',
    GTTS_PATH: 'C:\\Users\\820g4\\AppData\\Local\\Programs\\Python\\Python310\\Scripts\\gtts-cli.exe',

    // Paths
    TEMP_DIR: path.join(__dirname, '../temp'),
    MEMORY_FILE: path.join(__dirname, '../memory.json'),
    // root/index.js -> root/memory.json
    // root/src/config.js -> root/memory.json => ../memory.json
    // Let's verify path logic carefully.
    // __dirname (src/) -> .. (root) -> memory.json

    getPath: (filename) => path.join(__dirname, '../..', filename), // Safer helper?
    // Actually, standard is to use process.cwd() or path relative to main script.
    // But let's stick to relative for safety.

    ROOT_DIR: path.resolve(__dirname, '../')
};
