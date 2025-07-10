#!/usr/bin/env node
const { SimplePool, generateSecretKey, getPublicKey, nip04, finalizeEvent, verifyEvent } = require('nostr-tools');
const WebSocket = require('ws');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const readline = require('readline');
const crypto = require('crypto');

// Set up WebSocket globally for nostr-tools
if (typeof globalThis.WebSocket === 'undefined') {
    globalThis.WebSocket = WebSocket;
}

class SecureNostrGroupChat {
    constructor(machineName, machineId = 'default', groupName = 'mkenya-group') {
        this.machineName = machineName;
        this.keysPath = path.join(os.tmpdir(), `nostr-group-keys-${machineId}.json`);
        this.privateKey = null;
        this.publicKey = null;
        this.groupKey = this.deriveGroupKey(groupName); // Deterministic group key
        this.relays = [
            'wss://relay.damus.io',
            'wss://nos.lol',
            'wss://relay.nostr.band',
            'wss://nostr-pub.wellorder.net',
            'wss://relay.primal.net'
        ];
        // Try multiple approaches to initialize SimplePool
        try {
            this.pool = new SimplePool();
        } catch (e1) {
            try {
                this.pool = new SimplePool({ WebSocket: WebSocket });
            } catch (e2) {
                try {
                    this.pool = new SimplePool({ WebSocket });
                } catch (e3) {
                    console.error('Failed to initialize SimplePool with all approaches');
                    throw new Error('Cannot initialize SimplePool - WebSocket configuration issue');
                }
            }
        }
        this.allowlist = new Set(); // Public keys of authorized machines
        this.connectedMachines = new Map(); // Track connected machines
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        this.groupTag = `secure-group-${crypto.createHash('sha256').update(groupName).digest('hex').substring(0, 8)}`;
        this.eventKinds = {
            ANNOUNCEMENT: 20001,
            GROUP_MESSAGE: 1059 // NIP-59 gift-wrapped event
        };
    }

    deriveGroupKey(groupName) {
        // Deterministically derive group key from group name
        return crypto.createHash('sha256').update(groupName).digest('hex').substring(0, 64);
    }

    async initialize() {
        // Load or generate keys
        await this.loadOrGenerateKeys();
        console.log(`🔑 Public Key: ${this.publicKey.substring(0, 16)}...`);
        console.log(`🔒 Group Key: ${this.groupKey.substring(0, 16)}...`);

        // Initialize allowlist with own pubkey (strangers auto-added on announcement)
        this.allowlist.add(this.publicKey);
        console.log(`✅ Allowlist initialized with ${this.allowlist.size} machine(s)`);

        // Connect to relays
        await this.connectToRelays();
        console.log(`📡 Connected to ${this.relays.length} relays`);

        // Setup subscriptions
        this.subscribeToEvents();

        // Announce presence
        await this.sendAnnouncement();

        // Start chat interface
        this.startChat();

        console.log(`\n🚀 ${this.machineName} initialized successfully!`);
        console.log(`💡 Listening for other machines in secure group...\n`);
    }

    async loadOrGenerateKeys() {
        try {
            const data = await fs.readFile(this.keysPath, 'utf8');
            const keys = JSON.parse(data);
            if (keys.privateKey && keys.publicKey && keys.publicKey.length === 64) {
                this.privateKey = keys.privateKey;
                this.publicKey = keys.publicKey;
                console.log('🔑 Loaded existing keypair');
                return;
            }
        } catch (error) {
            console.log('Generating new keys...');
        }

        this.privateKey = Buffer.from(generateSecretKey()).toString('hex');
        this.publicKey = getPublicKey(this.privateKey);
        await fs.writeFile(this.keysPath, JSON.stringify({
            privateKey: this.privateKey,
            publicKey: this.publicKey,
            createdAt: new Date().toISOString()
        }, null, 2), { mode: 0o600 });
        console.log('🔑 Generated new keypair');
    }

    async connectToRelays() {
        console.log('🔌 Attempting to connect to relays...');
        console.log('WebSocket available:', typeof WebSocket !== 'undefined');
        console.log('globalThis.WebSocket available:', typeof globalThis.WebSocket !== 'undefined');
        
        const connections = this.relays.map(async (url) => {
            try {
                console.log(`🔄 Connecting to ${url}...`);
                const relay = await this.pool.ensureRelay(url);
                console.log(`✅ Connected to ${url}`);
                return true;
            } catch (error) {
                console.error(`❌ Failed to connect to ${url}: ${error.message}`);
                console.error(`   Error details:`, error.stack);
                return false;
            }
        });
        const results = await Promise.all(connections);
        const successCount = results.filter(result => result).length;
        
        if (successCount === 0) {
            throw new Error('Failed to connect to any relays');
        }
        
        console.log(`📡 Successfully connected to ${successCount}/${this.relays.length} relays`);
    }

    async publishEvent(event) {
        let successCount = 0;
        
        // Use the pool's publish method directly to all connected relays
        try {
            const results = await this.pool.publish(this.relays, event);
            
            // Count successful publishes
            for (const [url, result] of Object.entries(results)) {
                try {
                    await result;
                    successCount++;
                    console.log(`📤 Published event ${event.id.substring(0, 8)}... to ${url}`);
                } catch (error) {
                    console.error(`❌ Failed to publish to ${url}: ${error.message}`);
                }
            }
        } catch (error) {
            console.error(`❌ Publishing error: ${error.message}`);
            
            // Fallback: try publishing to each relay individually
            const promises = this.relays.map(async (url) => {
                try {
                    const relay = await this.pool.ensureRelay(url);
                    if (relay && relay.connected) {
                        await relay.publish(event);
                        successCount++;
                        console.log(`📤 Published event ${event.id.substring(0, 8)}... to ${url} (fallback)`);
                    }
                } catch (error) {
                    console.error(`❌ Failed to publish to ${url} (fallback): ${error.message}`);
                }
            });
            await Promise.all(promises);
        }
        
        if (successCount === 0) {
            console.warn('⚠️ Failed to publish to any relay');
        } else {
            console.log(`✅ Successfully published to ${successCount} relay(s)`);
        }
    }

    subscribeToEvents() {
        console.log('🔔 Setting up event subscriptions...');
        
        const filters = [
            {
                kinds: [this.eventKinds.ANNOUNCEMENT, this.eventKinds.GROUP_MESSAGE],
                '#t': [this.groupTag],
                since: Math.floor(Date.now() / 1000)
            }
        ];

        try {
            const sub = this.pool.subscribeMany(
                this.relays,
                filters,
                {
                    onevent: async (event) => {
                        console.log(`📨 Received event ${event.id.substring(0, 8)}... from ${event.pubkey.substring(0, 8)}...`);
                        
                        if (!verifyEvent(event)) {
                            console.warn(`⚠️ Invalid event signature: ${event.id.substring(0, 8)}...`);
                            return;
                        }
                        
                        // Skip events from self
                        if (event.pubkey === this.publicKey) {
                            console.log(`↩️ Skipping own event: ${event.id.substring(0, 8)}...`);
                            return;
                        }
                        
                        // Auto-add new machines to allowlist for demo purposes
                        if (!this.allowlist.has(event.pubkey)) {
                            console.log(`🆕 Auto-adding new machine to allowlist: ${event.pubkey.substring(0, 8)}...`);
                            this.allowlist.add(event.pubkey);
                        }

                        if (event.kind === this.eventKinds.ANNOUNCEMENT) {
                            await this.handleAnnouncement(event);
                        } else if (event.kind === this.eventKinds.GROUP_MESSAGE) {
                            await this.handleGroupMessage(event);
                        }
                    },
                    onclose: (reason) => {
                        console.log(`🔌 Subscription closed: ${reason}`);
                    },
                    oneose: () => {
                        console.log('📭 End of stored events received');
                    }
                }
            );
            
            console.log('✅ Event subscriptions active');
            return sub;
        } catch (error) {
            console.error('❌ Failed to set up subscriptions:', error.message);
            throw error;
        }
    }

    async sendAnnouncement() {
        const announcementData = {
            machine_name: this.machineName,
            platform: os.platform(),
            arch: os.arch(),
            cpus: os.cpus().length,
            memory_gb: Math.round(os.totalmem() / (1024 * 1024 * 1024)),
            hostname: os.hostname(),
            timestamp: Date.now()
        };

        const event = finalizeEvent({
            kind: this.eventKinds.ANNOUNCEMENT,
            pubkey: this.publicKey,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['t', this.groupTag]],
            content: JSON.stringify(announcementData)
        }, this.privateKey);

        await this.publishEvent(event);
        console.log(`📢 Announced presence: ${this.machineName}`);

        // Send "hey" message
        await this.sendGroupMessage(`Hey! ${this.machineName} just joined the secure group! 👋`);
    }

    async sendGroupMessage(message) {
        try {
            // Encrypt message with group key
            const encryptedContent = await nip04.encrypt(this.groupKey, this.publicKey, JSON.stringify({
                sender: this.machineName,
                message: message,
                timestamp: Date.now()
            }));

            // Create gift-wrapped event (NIP-59)
            const innerEvent = {
                kind: 14, // NIP-59 sealed DM
                pubkey: this.publicKey,
                created_at: Math.floor(Date.now() / 1000),
                tags: [['t', this.groupTag]],
                content: encryptedContent
            };

            const signedInnerEvent = finalizeEvent(innerEvent, this.privateKey);

            const giftWrapEvent = finalizeEvent({
                kind: this.eventKinds.GROUP_MESSAGE,
                pubkey: this.publicKey,
                created_at: Math.floor(Date.now() / 1000),
                tags: [['t', this.groupTag]],
                content: JSON.stringify(signedInnerEvent)
            }, this.privateKey);

            await this.publishEvent(giftWrapEvent);
            console.log(`💬 Sent message: "${message}"`);
        } catch (error) {
            console.error('❌ Failed to send message:', error.message);
        }
    }

    async handleAnnouncement(event) {
        try {
            const data = JSON.parse(event.content);
            const peerId = event.pubkey;
            const shortId = peerId.substring(0, 8);

            if (!this.connectedMachines.has(peerId)) {
                console.log(`\n🎉 NEW MACHINE DETECTED!`);
                console.log(`   Name: ${data.machine_name}`);
                console.log(`   ID: ${shortId}...`);
                console.log(`   Platform: ${data.platform}/${data.arch}`);
                console.log(`   CPUs: ${data.cpus}, Memory: ${data.memory_gb}GB`);
                console.log(`   Hostname: ${data.hostname}`);

                this.connectedMachines.set(peerId, {
                    name: data.machine_name,
                    shortId: shortId,
                    lastSeen: Date.now()
                });

                // Auto-add strangers to allowlist (for demo; restrict in production)
                this.allowlist.add(peerId);
                console.log(`✅ Added ${data.machine_name} to allowlist`);
            } else {
                this.connectedMachines.get(peerId).lastSeen = Date.now();
            }

            this.showNetworkStatus();
        } catch (error) {
            console.error('Error handling announcement:', error.message);
        }
    }

    async handleGroupMessage(event) {
        try {
            // Unwrap gift-wrapped event
            const innerEvent = JSON.parse(event.content);
            if (innerEvent.kind !== 14 || !this.allowlist.has(innerEvent.pubkey)) {
                console.warn(`⚠️ Invalid or unauthorized inner event`);
                return;
            }

            // Decrypt inner content
            const decryptedContent = await nip04.decrypt(this.groupKey, innerEvent.pubkey, innerEvent.content);
            const messageData = JSON.parse(decryptedContent);

            const sender = this.connectedMachines.get(innerEvent.pubkey)?.name || innerEvent.pubkey.substring(0, 8);
            console.log(`\n💬 ${sender}: ${messageData.message}`);
            console.log(`   Received at: ${new Date(messageData.timestamp).toLocaleTimeString()}`);
            console.log(''); // Add blank line for better readability
        } catch (error) {
            console.error('Error handling group message:', error.message);
        }
    }

    showNetworkStatus() {
        console.log(`\n📊 NETWORK STATUS FOR ${this.machineName.toUpperCase()}`);
        console.log(`═══════════════════════════════════════════════`);
        
        // Count connected relays - use a simpler approach since getRelay might not be available
        let connectedRelayCount = 0;
        try {
            // Try to count connected relays by attempting to access them
            for (const url of this.relays) {
                try {
                    // This is a simplified check - if ensureRelay works, consider it connected
                    this.pool.ensureRelay(url).then(() => connectedRelayCount++).catch(() => {});
                } catch (e) {
                    // Ignore errors for counting
                }
            }
        } catch (e) {
            // If we can't count, just show the total
            connectedRelayCount = this.relays.length;
        }
        
        console.log(`🔗 Connected Relays: ${connectedRelayCount}/${this.relays.length}`);
        console.log(`👥 Online Machines: ${this.connectedMachines.size + 1} (including me)`);
        console.log(`   - ${this.machineName} (me) ✨`);

        if (this.connectedMachines.size === 0) {
            console.log(`   - Waiting for other machines...`);
        } else {
            for (const [peerId, peer] of this.connectedMachines.entries()) {
                const timeSince = Math.floor((Date.now() - peer.lastSeen) / 1000);
                console.log(`   - ${peer.name} (${peer.shortId}...) - seen ${timeSince}s ago`);
            }
        }
        console.log(`═══════════════════════════════════════════════\n`);
    }

    startChat() {
        console.log(`💬 Secure group chat started for ${this.machineName}`);
        console.log('Type your message and press Enter to send. Ctrl+C to exit.\n');

        this.rl.on('line', async (input) => {
            const message = input.trim();
            if (message) {
                await this.sendGroupMessage(message);
            }
        });
    }

    async shutdown() {
        console.log('\n🧹 Shutting down...');
        await this.sendGroupMessage(`${this.machineName} is going offline. Goodbye! 👋`);
        this.rl.close();
        await this.pool.close(this.relays);
        console.log('✅ Shutdown complete');
    }
}

async function main() {
    const machineName = process.argv[2] || `Machine-${os.hostname()}`;
    console.log(`\n🌍 Secure Nostr Group Chat`);
    console.log(`════════════════════════════════════`);
    console.log(`Machine Name: ${machineName}`);
    console.log(`Platform: ${os.platform()}/${os.arch()}`);
    console.log(`Node Version: ${process.version}`);
    console.log(`Time: ${new Date().toLocaleString()}`);
    console.log(`════════════════════════════════════`);

    const chat = new SecureNostrGroupChat(machineName);

    process.on('SIGINT', async () => {
        await chat.shutdown();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        await chat.shutdown();
        process.exit(0);
    });

    try {
        await chat.initialize();
    } catch (error) {
        console.error('❌ Failed to initialize:', error);
        process.exit(1);
    }
}

main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});