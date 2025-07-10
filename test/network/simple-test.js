#!/usr/bin/env node
const os = require('os');
const crypto = require('crypto');
const WebSocket = require('ws');

const machineName = process.argv[2] || `Machine-${os.hostname()}`;

console.log(`🚀 Starting ${machineName}...`);

class SimpleCoordinator {
    constructor(name) {
        this.name = name;
        this.relays = [
            'wss://relay.damus.io',
            'wss://nos.lol',
            'wss://relay.nostr.band'
        ];
        this.connections = [];
        this.peers = new Map();
        
        // Generate unique identity
        this.privateKey = crypto.randomBytes(32).toString('hex');
        this.publicKey = this.generatePublicKey();
        
        console.log(`🔑 Public Key: ${this.publicKey.substring(0, 16)}...`);
    }
    
    generatePublicKey() {
        const EC = require('elliptic').ec;
        const ec = new EC('secp256k1');
        const keyPair = ec.keyFromPrivate(this.privateKey, 'hex');
        return keyPair.getPublic().encode('hex');
    }
    
    async connect() {
        console.log(`📡 Connecting to relays...`);
        
        for (const relayUrl of this.relays) {
            try {
                const ws = new WebSocket(relayUrl);
                
                ws.on('open', () => {
                    console.log(`✅ Connected to ${relayUrl}`);
                    this.connections.push(ws);
                    
                    // Subscribe to messages
                    const subscription = JSON.stringify([
                        'REQ',
                        'test-sub',
                        {
                            kinds: [1],
                            '#t': ['mkenyatool-test'],
                            since: Math.floor(Date.now() / 1000) - 60
                        }
                    ]);
                    ws.send(subscription);
                    
                    // Send announcement
                    this.sendAnnouncement(ws);
                });
                
                ws.on('message', (data) => {
                    this.handleMessage(data);
                });
                
                ws.on('error', (error) => {
                    console.log(`❌ Relay error ${relayUrl}: ${error.message}`);
                });
                
            } catch (error) {
                console.log(`❌ Failed to connect to ${relayUrl}: ${error.message}`);
            }
        }
        
        // Keep announcing every 10 seconds
        setInterval(() => {
            this.connections.forEach(ws => {
                if (ws.readyState === WebSocket.OPEN) {
                    this.sendAnnouncement(ws);
                }
            });
        }, 10000);
        
        // Show status every 15 seconds
        setInterval(() => {
            this.showStatus();
        }, 15000);
        
        setTimeout(() => {
            this.showStatus();
        }, 3000);
    }
    
    sendAnnouncement(ws) {
        const announcement = {
            id: crypto.randomBytes(32).toString('hex'),
            pubkey: this.publicKey,
            created_at: Math.floor(Date.now() / 1000),
            kind: 1,
            tags: [['t', 'mkenyatool-test']],
            content: JSON.stringify({
                name: this.name,
                timestamp: Date.now(),
                platform: os.platform(),
                arch: os.arch(),
                cpus: os.cpus().length
            }),
            sig: crypto.randomBytes(64).toString('hex') // Simple sig for testing
        };
        
        const message = JSON.stringify(['EVENT', announcement]);
        ws.send(message);
        console.log(`📤 Sent announcement from ${this.name}`);
    }
    
    handleMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            const [type, ...args] = message;
            
            if (type === 'EVENT') {
                const event = args[2];
                if (event && event.content && event.pubkey !== this.publicKey) {
                    try {
                        const peerData = JSON.parse(event.content);
                        if (peerData.name && peerData.name !== this.name) {
                            const peerId = event.pubkey.substring(0, 8);
                            
                            if (!this.peers.has(peerId)) {
                                console.log(`\n🎉 DISCOVERED NEW MACHINE!`);
                                console.log(`   Name: ${peerData.name}`);
                                console.log(`   ID: ${peerId}...`);
                                console.log(`   Platform: ${peerData.platform}`);
                                console.log(`   CPUs: ${peerData.cpus}`);
                                
                                this.peers.set(peerId, {
                                    name: peerData.name,
                                    platform: peerData.platform,
                                    cpus: peerData.cpus,
                                    lastSeen: Date.now()
                                });
                                
                                this.showStatus();
                            } else {
                                // Update last seen
                                this.peers.get(peerId).lastSeen = Date.now();
                            }
                        }
                    } catch (e) {
                        // Ignore non-JSON content
                    }
                }
            }
        } catch (error) {
            // Ignore parsing errors
        }
    }
    
    showStatus() {
        console.log(`\n📊 NETWORK STATUS FOR ${this.name.toUpperCase()}`);
        console.log(`═══════════════════════════════════════════════`);
        console.log(`🔗 Connected Relays: ${this.connections.filter(ws => ws.readyState === WebSocket.OPEN).length}/${this.relays.length}`);
        console.log(`👥 Online Machines: ${this.peers.size + 1} (including me)`);
        console.log(`   - ${this.name} (me) ✨`);
        
        if (this.peers.size === 0) {
            console.log(`   - Waiting for other machines...`);
        } else {
            for (const [peerId, peer] of this.peers.entries()) {
                const timeSince = Math.floor((Date.now() - peer.lastSeen) / 1000);
                console.log(`   - ${peer.name} (${peerId}...) - seen ${timeSince}s ago`);
            }
        }
        console.log(`═══════════════════════════════════════════════\n`);
        
        if (this.peers.size > 0) {
            console.log(`💬 Type a message and press Enter to send to all machines:`);
        }
    }
    
    sendMessage(content) {
        if (this.peers.size === 0) {
            console.log(`📵 No other machines to send to`);
            return;
        }
        
        const messageEvent = {
            id: crypto.randomBytes(32).toString('hex'),
            pubkey: this.publicKey,
            created_at: Math.floor(Date.now() / 1000),
            kind: 1,
            tags: [['t', 'mkenyatool-chat']],
            content: `${this.name}: ${content}`,
            sig: crypto.randomBytes(64).toString('hex')
        };
        
        this.connections.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                const message = JSON.stringify(['EVENT', messageEvent]);
                ws.send(message);
            }
        });
        
        console.log(`📤 Sent: "${content}"`);
    }
}

// Create and start coordinator
const coordinator = new SimpleCoordinator(machineName);
coordinator.connect();

// Handle user input for messaging
const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.on('line', (input) => {
    const message = input.trim();
    if (message) {
        coordinator.sendMessage(message);
    }
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log(`\n🛑 Shutting down ${machineName}...`);
    coordinator.connections.forEach(ws => ws.close());
    process.exit(0);
});
console.log(`💡 ${machineName} is starting up...`);
console.log(`💡 Press Ctrl+C to exit`);