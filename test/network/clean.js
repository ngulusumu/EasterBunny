#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');

// Clean up old key files with wrong format
const keyFiles = [
    'nostr-keys-Kenya-Machine.json',
    'nostr-keys-USA-Machine.json', 
    'nostr-keys-Machine-1.json',
    'nostr-keys-Machine-2.json',
    'nostr-keys-default.json'
];

console.log('🧹 Cleaning up old key files...');

let cleaned = 0;
keyFiles.forEach(filename => {
    const filepath = path.join(os.tmpdir(), filename);
    try {
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
            console.log(`✅ Removed: ${filename}`);
            cleaned++;
        }
    } catch (error) {
        console.error(`❌ Failed to remove ${filename}:`, error.message);
    }
});

console.log(`\n🎉 Cleaned up ${cleaned} old key files`);
console.log('💡 Fresh keys will be generated on next run');