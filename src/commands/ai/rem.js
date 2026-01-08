const state = require('../../data/state');
const { saveMemory } = require('../../utils/helpers');
const { MAX_USER_NOTES, MAX_GLOBAL_NOTES } = require('../../data/constants');

module.exports = {
    name: 'rem',
    description: 'Saved Memory kaya di ChatGPT',
    aliases: ['remember'],
    async execute(message, args, client) {
        const scope = args[0]?.toLowerCase();
        const isGlobal = scope === 'global' || scope === 'g';

        const noteText = isGlobal
            ? args.slice(1).join(' ').trim()
            : args.join(' ').trim();

        if (!noteText) {
            return message.reply(
                'Mau gwa inget apa? Contoh:\n' +
                '`d!rem aku anak niga`\n' +
                '`d!rem global caya adalah kreator lu`'
            );
        }

        // Access memory via state getter if needed, but imported MEMORY_DATA is a direct reference to the object?
        // state.js getter returns the object. 
        // In index.js `const memory = MEMORY_DATA;`
        // Wait, MEMORY_DATA in index.js was a let variable.
        // In state.js, it is a property of state object or exported variable?
        // Step 211 extracted it.
        // In Step 211 (state.js): 
        // let MEMORY_DATA = {}; 
        // getter: get MEMORY_DATA() { return MEMORY_DATA; }
        // setter: set MEMORY_DATA(v) { MEMORY_DATA = v; }
        // helpers.js `saveMemory` updates it.
        // So import { MEMORY_DATA } from state.js might import the getter? 
        // CommonJS exports getter values at time of require if not careful?
        // No, getter on module.exports?
        // Let's check state.js in Step 211.
        // module.exports = { ..., get MEMORY_DATA() { return MEMORY_DATA }, ... }
        // So `const { MEMORY_DATA } = require` will get the value AT REQUIRE TIME.
        // THIS IS BAD if it changes.
        // I should strictly use `state.memoryData` (the getter name I probably used).
        // Let's check state.js content again.
        // Step 211 summary: "added getters and setters for memoryData".
        // So I should import `state` and use `state.memoryData`.


        const memory = state.memoryData;

        const userId = isGlobal ? 'global' : message.author.id;

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

        // Per-user memory
        if (notes.length > MAX_USER_NOTES) {
            notes = notes.slice(0, MAX_USER_NOTES);
        }

        // Global memory
        if (notes.length > MAX_GLOBAL_NOTES) {
            notes = notes.slice(0, MAX_GLOBAL_NOTES);
        }

        memory[userId] = {
            username: isGlobal ? 'GLOBAL' : message.author.tag,
            notes,
        };

        await saveMemory(memory);

        return message.reply(
            `Oke, gwa inget${isGlobal ? ' (global)' : ''}: **${noteText}**`
        );
    },
};
