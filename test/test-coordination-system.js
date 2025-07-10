// test/test-coordination-system.js
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const WebSocket = require('ws');

// Test-compatible NostrKeyManager that doesn't rely on Electron
class TestNostrKeyManager {
    constructor() {
        // Use a test directory instead of Electron's userData path
        this.keysPath = path.join(os.tmpdir(), 'test-nostr-keys.json');
        this.publicKey = null;
        this.privateKey = null;
    }

    async initialize() {
        try {
            const existingKeys = await this.loadKeys();
            if (existingKeys) {
                this.publicKey = existingKeys.publicKey;
                this.privateKey = existingKeys.privateKey;
                return;
            }
        } catch (error) {
            console.log('No existing keys found, generating new ones');
        }

        await this.generateNewKeys();
    }

    async generateNewKeys() {
        const privateKeyBytes = crypto.randomBytes(32);
        this.privateKey = privateKeyBytes.toString('hex');
        
        const publicKeyBytes = this.getPublicKeyFromPrivate(privateKeyBytes);
        this.publicKey = publicKeyBytes.toString('hex');

        await this.saveKeys();
    }

    getPublicKeyFromPrivate(privateKeyBytes) {
        try {
            const EC = require('elliptic').ec;
            const ec = new EC('secp256k1');
            const keyPair = ec.keyFromPrivate(privateKeyBytes);
            return Buffer.from(keyPair.getPublic().encode('array', true));
        } catch (error) {
            // Fallback if elliptic is not available
            console.warn('Elliptic not available, using crypto fallback');
            return crypto.createHash('sha256').update(privateKeyBytes).digest();
        }
    }

    async saveKeys() {
        const keyData = {
            publicKey: this.publicKey,
            privateKey: this.privateKey,
            createdAt: new Date().toISOString()
        };

        try {
            await fs.writeFile(this.keysPath, JSON.stringify(keyData), {
                mode: 0o600,
                flag: 'w'
            });
        } catch (error) {
            console.warn('Could not save keys to file:', error.message);
        }
    }

    async loadKeys() {
        try {
            const data = await fs.readFile(this.keysPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return null;
        }
    }

    signMessage(message) {
        try {
            const EC = require('elliptic').ec;
            const ec = new EC('secp256k1');
            const keyPair = ec.keyFromPrivate(this.privateKey, 'hex');
            
            const messageHash = crypto.createHash('sha256').update(message).digest();
            const signature = keyPair.sign(messageHash);
            
            return {
                r: signature.r.toString('hex'),
                s: signature.s.toString('hex'),
                recovery: signature.recoveryParam
            };
        } catch (error) {
            // Fallback signature using HMAC
            const signature = crypto.createHmac('sha256', this.privateKey).update(message).digest('hex');
            return {
                r: signature.substring(0, 64),
                s: signature.substring(64),
                recovery: 0
            };
        }
    }

    verifySignature(message, signature, publicKey) {
        try {
            const EC = require('elliptic').ec;
            const ec = new EC('secp256k1');
            const keyPair = ec.keyFromPublic(publicKey, 'hex');
            
            const messageHash = crypto.createHash('sha256').update(message).digest();
            return keyPair.verify(messageHash, signature);
        } catch (error) {
            // Fallback verification
            const expectedSig = this.signMessage(message);
            return expectedSig.r === signature.r && expectedSig.s === signature.s;
        }
    }
}

// Test-compatible Machine Status Manager
class TestMachineStatusManager {
    constructor(keyManager) {
        this.keyManager = keyManager;
        this.onlineMachines = new Map();
        this.lastHeartbeat = new Map();
        this.statusCache = new Map();
        this.heartbeatInterval = 30000;
        this.timeoutThreshold = 90000;
    }

    async createStatusMessage(status) {
        const statusData = {
            machineId: this.keyManager.publicKey,
            status: status,
            timestamp: Date.now(),
            capabilities: this.getMachineCapabilities(),
            networkInfo: this.getNetworkInfo()
        };

        const message = JSON.stringify(statusData);
        const signature = this.keyManager.signMessage(message);

        return {
            data: statusData,
            signature: signature,
            publicKey: this.keyManager.publicKey
        };
    }

    getMachineCapabilities() {
        return {
            platform: os.platform(),
            arch: os.arch(),
            cpus: os.cpus().length,
            memory: os.totalmem(),
            version: '2.0.0-test'
        };
    }

    getNetworkInfo() {
        const interfaces = os.networkInterfaces();
        const activeInterfaces = [];

        Object.keys(interfaces).forEach(name => {
            interfaces[name].forEach(iface => {
                if (!iface.internal && iface.family === 'IPv4') {
                    activeInterfaces.push({
                        name: name,
                        address: iface.address,
                        netmask: iface.netmask
                    });
                }
            });
        });

        return {
            hostname: os.hostname(),
            interfaces: activeInterfaces
        };
    }

    verifyStatusMessage(statusMessage) {
        const { data, signature, publicKey } = statusMessage;
        const message = JSON.stringify(data);
        
        return this.keyManager.verifySignature(message, signature, publicKey);
    }

    updateMachineStatus(machineId, statusMessage) {
        if (!this.verifyStatusMessage(statusMessage)) {
            console.warn(`Invalid status message from machine: ${machineId}`);
            return false;
        }

        const now = Date.now();
        this.onlineMachines.set(machineId, statusMessage.data);
        this.lastHeartbeat.set(machineId, now);
        this.statusCache.set(machineId, statusMessage);

        return true;
    }

    getOnlineMachines() {
        return Array.from(this.onlineMachines.keys());
    }

    getMachineCount() {
        return this.onlineMachines.size;
    }
}

// Test-compatible Nostr Relay
class TestNostrRelay {
    constructor(url) {
        this.url = url;
        this.ws = null;
        this.connected = false;
        this.subscriptions = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3; // Reduced for testing
        this.reconnectDelay = 1000;
        this.eventHandlers = new Map();
    }

    async connect() {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.url);
                
                const timeout = setTimeout(() => {
                    if (this.ws.readyState === WebSocket.CONNECTING) {
                        this.ws.close();
                        reject(new Error('Connection timeout'));
                    }
                }, 10000);

                this.ws.on('open', () => {
                    clearTimeout(timeout);
                    this.connected = true;
                    this.reconnectAttempts = 0;
                    console.log(`Connected to relay: ${this.url}`);
                    resolve();
                });

                this.ws.on('message', (data) => {
                    this.handleMessage(data);
                });

                this.ws.on('close', () => {
                    clearTimeout(timeout);
                    this.connected = false;
                    console.log(`Disconnected from relay: ${this.url}`);
                });

                this.ws.on('error', (error) => {
                    clearTimeout(timeout);
                    console.error(`Relay error (${this.url}):`, error.message);
                    reject(error);
                });

            } catch (error) {
                reject(error);
            }
        });
    }

    handleMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            const [type, ...args] = message;

            switch (type) {
                case 'EVENT':
                    this.handleEvent(args[0], args[1]);
                    break;
                case 'OK':
                    this.handleOK(args[0], args[1], args[2]);
                    break;
                case 'EOSE':
                    this.handleEOSE(args[0]);
                    break;
                case 'NOTICE':
                    this.handleNotice(args[0]);
                    break;
            }
        } catch (error) {
            console.error('Error parsing relay message:', error);
        }
    }

    handleEvent(subscriptionId, event) {
        const handler = this.eventHandlers.get(subscriptionId);
        if (handler) {
            handler(event);
        }
    }

    handleOK(eventId, success, message) {
        if (!success) {
            console.error(`Event ${eventId} rejected: ${message}`);
        }
    }

    handleEOSE(subscriptionId) {
        console.log(`End of stored events for subscription: ${subscriptionId}`);
    }

    handleNotice(message) {
        console.log(`Relay notice: ${message}`);
    }

    publishEvent(event) {
        if (!this.connected) {
            throw new Error('Not connected to relay');
        }

        const message = JSON.stringify(['EVENT', event]);
        this.ws.send(message);
    }

    subscribe(filters, handler) {
        const subscriptionId = crypto.randomBytes(8).toString('hex');
        
        if (!this.connected) {
            throw new Error('Not connected to relay');
        }

        const message = JSON.stringify(['REQ', subscriptionId, ...filters]);
        this.ws.send(message);

        this.subscriptions.set(subscriptionId, filters);
        this.eventHandlers.set(subscriptionId, handler);

        return subscriptionId;
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

// Test-compatible Private Network Coordinator
class TestPrivateNetworkCoordinator {
    constructor(appConfig = {}) {
        this.appIdentifier = appConfig.appIdentifier || 'test-network';
        this.appVersion = appConfig.appVersion || '1.0.0';
        this.networkSecret = appConfig.networkSecret || 'test-secret';
        
        this.keyManager = null;
        this.statusManager = null;
        this.relays = [];
        this.isInitialized = false;
        this.subscriptions = new Map();
        this.verifiedPeers = new Map();
        this.isolatedMode = false;
        this.lastPeerContact = null;
        
        this.defaultRelays = [
            'wss://relay.damus.io',
            'wss://nos.lol',
            'wss://relay.nostr.band'
        ];
    }

    async initialize() {
        if (this.isInitialized) {
            return;
        }

        this.keyManager = new TestNostrKeyManager();
        await this.keyManager.initialize();
        
        this.statusManager = new TestMachineStatusManager(this.keyManager);

        await this.connectToRelays();
        
        this.isInitialized = true;
        console.log(`Test coordinator initialized with public key: ${this.keyManager.publicKey.substring(0, 16)}...`);
    }

    async connectToRelays() {
        // Connect to fewer relays for testing
        const testRelays = this.defaultRelays.slice(0, 2);
        
        for (const relayUrl of testRelays) {
            try {
                const relay = new TestNostrRelay(relayUrl);
                await relay.connect();
                this.relays.push(relay);
            } catch (error) {
                console.warn(`Failed to connect to relay ${relayUrl}:`, error.message);
            }
        }
        
        if (this.relays.length === 0) {
            throw new Error('Failed to connect to any relays');
        }

        console.log(`Connected to ${this.relays.length} relays for testing`);
    }

    getNetworkId() {
        const networkData = `${this.appIdentifier}-${this.appVersion}`;
        return crypto.createHash('sha256').update(networkData).digest('hex').substring(0, 16);
    }

    getPrivateNetworkStatus() {
        return {
            networkId: this.getNetworkId(),
            appIdentifier: this.appIdentifier,
            appVersion: this.appVersion,
            verifiedPeers: this.verifiedPeers.size,
            isolatedMode: this.isolatedMode,
            lastPeerContact: this.lastPeerContact,
            connectedRelays: this.relays.filter(r => r.connected).length,
            myPublicKey: this.keyManager ? this.keyManager.publicKey : 'not-initialized',
            peerList: Array.from(this.verifiedPeers.keys()).map(peerId => ({
                id: peerId,
                shortId: peerId.substring(0, 8),
                lastSeen: this.verifiedPeers.get(peerId).lastSeen || Date.now(),
                status: 'online'
            }))
        };
    }

    async shutdown() {
        this.relays.forEach(relay => {
            try {
                relay.disconnect();
            } catch (error) {
                console.warn('Error disconnecting relay:', error.message);
            }
        });
        
        this.relays = [];
        this.subscriptions.clear();
        this.isInitialized = false;
        
        // Cleanup test key file
        try {
            await fs.unlink(this.keyManager.keysPath);
        } catch (error) {
            // Ignore cleanup errors
        }
    }
}

module.exports = {
    TestPrivateNetworkCoordinator,
    TestNostrKeyManager,
    TestMachineStatusManager,
    TestNostrRelay
};