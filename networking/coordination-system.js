//networking/coordination-system.js
// file: networking/coordination-system.js
const { app } = require('electron');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const WebSocket = require('ws');

class NostrKeyManager {
    constructor() {
        this.keysPath = path.join(app.getPath('userData'), 'nostr-keys.json');
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
        const EC = require('elliptic').ec;
        const ec = new EC('secp256k1');
        const keyPair = ec.keyFromPrivate(privateKeyBytes);
        return Buffer.from(keyPair.getPublic().encode('array', true));
    }

    async saveKeys() {
        const keyData = {
            publicKey: this.publicKey,
            privateKey: this.privateKey,
            createdAt: new Date().toISOString()
        };

        await fs.writeFile(this.keysPath, JSON.stringify(keyData), {
            mode: 0o600,
            flag: 'w'
        });
    }

    async loadKeys() {
        const data = await fs.readFile(this.keysPath, 'utf8');
        return JSON.parse(data);
    }

    signMessage(message) {
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
    }

    verifySignature(message, signature, publicKey) {
        try {
            const EC = require('elliptic').ec;
            const ec = new EC('secp256k1');
            const keyPair = ec.keyFromPublic(publicKey, 'hex');
            
            const messageHash = crypto.createHash('sha256').update(message).digest();
            return keyPair.verify(messageHash, signature);
        } catch (error) {
            return false;
        }
    }
}

class NostrEvent {
    constructor(kind, content, tags = []) {
        this.id = null;
        this.pubkey = null;
        this.created_at = Math.floor(Date.now() / 1000);
        this.kind = kind;
        this.tags = tags;
        this.content = content;
        this.sig = null;
    }

    serialize() {
        return JSON.stringify([
            0,
            this.pubkey,
            this.created_at,
            this.kind,
            this.tags,
            this.content
        ]);
    }

    generateId() {
        const serialized = this.serialize();
        this.id = crypto.createHash('sha256').update(serialized).digest('hex');
        return this.id;
    }

    sign(keyManager) {
        this.pubkey = keyManager.publicKey;
        this.generateId();
        
        const signature = keyManager.signMessage(this.id);
        this.sig = signature.r + signature.s;
        
        return this;
    }
}

class MachineStatusManager {
    constructor(keyManager) {
        this.keyManager = keyManager;
        this.onlineMachines = new Map();
        this.lastHeartbeat = new Map();
        this.statusCache = new Map();
        this.heartbeatInterval = 30000;
        this.timeoutThreshold = 90000;
        
        this.startHeartbeatMonitoring();
    }

    createStatusMessage(status) {
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

    markMachineOffline(machineId) {
        this.onlineMachines.delete(machineId);
        this.lastHeartbeat.delete(machineId);
        this.statusCache.delete(machineId);
    }

    getOnlineMachines() {
        return Array.from(this.onlineMachines.keys());
    }

    getMachineCount() {
        return this.onlineMachines.size;
    }

    getMachineCapabilities() {
        const os = require('os');
        return {
            platform: os.platform(),
            arch: os.arch(),
            cpus: os.cpus().length,
            memory: os.totalmem(),
            version: app.getVersion()
        };
    }

    getNetworkInfo() {
        const os = require('os');
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

    startHeartbeatMonitoring() {
        setInterval(() => {
            const now = Date.now();
            const offlineMachines = [];

            this.lastHeartbeat.forEach((lastSeen, machineId) => {
                if (now - lastSeen > this.timeoutThreshold) {
                    offlineMachines.push(machineId);
                }
            });

            offlineMachines.forEach(machineId => {
                this.markMachineOffline(machineId);
                this.onMachineOffline(machineId);
            });
        }, 10000);
    }

    onMachineOffline(machineId) {
        console.log(`Machine ${machineId} detected as offline`);
    }
}

class NostrRelay {
    constructor(url) {
        this.url = url;
        this.ws = null;
        this.connected = false;
        this.subscriptions = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.eventHandlers = new Map();
    }

    async connect() {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.url);

                this.ws.on('open', () => {
                    this.connected = true;
                    this.reconnectAttempts = 0;
                    console.log(`Connected to relay: ${this.url}`);
                    resolve();
                });

                this.ws.on('message', (data) => {
                    this.handleMessage(data);
                });

                this.ws.on('close', () => {
                    this.connected = false;
                    console.log(`Disconnected from relay: ${this.url}`);
                    this.attemptReconnect();
                });

                this.ws.on('error', (error) => {
                    console.error(`Relay error (${this.url}):`, error);
                    reject(error);
                });

            } catch (error) {
                reject(error);
            }
        });
    }

    async attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error(`Max reconnection attempts reached for ${this.url}`);
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        
        console.log(`Attempting to reconnect to ${this.url} in ${delay}ms (attempt ${this.reconnectAttempts})`);
        
        setTimeout(() => {
            this.connect().catch(() => {
                console.error(`Reconnection attempt ${this.reconnectAttempts} failed for ${this.url}`);
            });
        }, delay);
    }

    handleMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            const [type, ...args] = message;

            switch (type) {
                case 'EVENT':
                    this.handleEvent(args[1], args[2]);
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
        const subscriptionId = crypto.randomBytes(16).toString('hex');
        
        if (!this.connected) {
            throw new Error('Not connected to relay');
        }

        const message = JSON.stringify(['REQ', subscriptionId, ...filters]);
        this.ws.send(message);

        this.subscriptions.set(subscriptionId, filters);
        this.eventHandlers.set(subscriptionId, handler);

        return subscriptionId;
    }

    unsubscribe(subscriptionId) {
        if (!this.connected) {
            return;
        }

        const message = JSON.stringify(['CLOSE', subscriptionId]);
        this.ws.send(message);

        this.subscriptions.delete(subscriptionId);
        this.eventHandlers.delete(subscriptionId);
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

class DecentralizedCoordinator {
    constructor() {
        this.keyManager = new NostrKeyManager();
        this.statusManager = null;
        this.relays = [];
        this.isInitialized = false;
        this.subscriptions = new Map();
        
        this.defaultRelays = [
            'wss://relay.damus.io',
            'wss://nos.lol',
            'wss://relay.nostr.band',
            'wss://nostr-pub.wellorder.net',
            'wss://relay.current.fyi'
        ];

        this.eventKinds = {
            MACHINE_STATUS: 30000,
            MACHINE_OFFLINE: 30001,
            GROUP_CHAT: 40,
            COORDINATION_MESSAGE: 30002
        };
    }

    async initialize() {
        if (this.isInitialized) {
            return;
        }

        await this.keyManager.initialize();
        this.statusManager = new MachineStatusManager(this.keyManager);

        await this.connectToRelays();
        this.setupSubscriptions();
        this.startStatusBroadcasting();

        this.isInitialized = true;
        console.log(`Machine coordinator initialized with public key: ${this.keyManager.publicKey}`);
    }

    async connectToRelays() {
        const connectionPromises = this.defaultRelays.map(async (relayUrl) => {
            try {
                const relay = new NostrRelay(relayUrl);
                await relay.connect();
                this.relays.push(relay);
                return relay;
            } catch (error) {
                console.error(`Failed to connect to relay ${relayUrl}:`, error);
                return null;
            }
        });

        await Promise.allSettled(connectionPromises);
        
        if (this.relays.length === 0) {
            throw new Error('Failed to connect to any relays');
        }

        console.log(`Connected to ${this.relays.length} relays`);
    }

    setupSubscriptions() {
        const filters = [
            {
                kinds: [this.eventKinds.MACHINE_STATUS, this.eventKinds.MACHINE_OFFLINE],
                since: Math.floor(Date.now() / 1000) - 300
            },
            {
                kinds: [this.eventKinds.GROUP_CHAT],
                since: Math.floor(Date.now() / 1000) - 3600
            }
        ];

        this.relays.forEach(relay => {
            try {
                const subscriptionId = relay.subscribe(filters, (event) => {
                    this.handleIncomingEvent(event);
                });
                this.subscriptions.set(relay.url, subscriptionId);
            } catch (error) {
                console.error(`Failed to subscribe to relay ${relay.url}:`, error);
            }
        });
    }

    handleIncomingEvent(event) {
        switch (event.kind) {
            case this.eventKinds.MACHINE_STATUS:
                this.handleMachineStatusEvent(event);
                break;
            case this.eventKinds.MACHINE_OFFLINE:
                this.handleMachineOfflineEvent(event);
                break;
            case this.eventKinds.GROUP_CHAT:
                this.handleGroupChatEvent(event);
                break;
        }
    }

    handleMachineStatusEvent(event) {
        try {
            const statusMessage = JSON.parse(event.content);
            const machineId = event.pubkey;
            
            if (this.statusManager.updateMachineStatus(machineId, statusMessage)) {
                this.onMachineStatusUpdate(machineId, statusMessage.data);
            }
        } catch (error) {
            console.error('Error handling machine status event:', error);
        }
    }

    handleMachineOfflineEvent(event) {
        try {
            const offlineData = JSON.parse(event.content);
            const reportingMachine = event.pubkey;
            
            if (this.keyManager.verifySignature(event.content, {
                r: event.sig.slice(0, 64),
                s: event.sig.slice(64)
            }, reportingMachine)) {
                this.statusManager.markMachineOffline(offlineData.machineId);
                this.onMachineOfflineReport(offlineData.machineId, reportingMachine);
            }
        } catch (error) {
            console.error('Error handling machine offline event:', error);
        }
    }

    handleGroupChatEvent(event) {
        this.onGroupChatMessage({
            id: event.id,
            author: event.pubkey,
            content: event.content,
            timestamp: event.created_at * 1000,
            tags: event.tags
        });
    }

    startStatusBroadcasting() {
        this.broadcastStatus();
        
        setInterval(() => {
            this.broadcastStatus();
        }, this.statusManager.heartbeatInterval);
    }

    async broadcastStatus() {
        const statusMessage = this.statusManager.createStatusMessage('online');
        const event = new NostrEvent(
            this.eventKinds.MACHINE_STATUS,
            JSON.stringify(statusMessage)
        ).sign(this.keyManager);

        await this.publishToRelays(event);
    }

    async reportMachineOffline(machineId) {
        const offlineData = {
            machineId: machineId,
            reportedBy: this.keyManager.publicKey,
            timestamp: Date.now(),
            reason: 'heartbeat_timeout'
        };

        const event = new NostrEvent(
            this.eventKinds.MACHINE_OFFLINE,
            JSON.stringify(offlineData)
        ).sign(this.keyManager);

        await this.publishToRelays(event);
    }

    async sendGroupChatMessage(content) {
        const event = new NostrEvent(
            this.eventKinds.GROUP_CHAT,
            content
        ).sign(this.keyManager);

        await this.publishToRelays(event);
    }

    async publishToRelays(event) {
        const publishPromises = this.relays.map(async (relay) => {
            try {
                if (relay.connected) {
                    relay.publishEvent(event);
                    return true;
                }
                return false;
            } catch (error) {
                console.error(`Failed to publish to relay ${relay.url}:`, error);
                return false;
            }
        });

        const results = await Promise.allSettled(publishPromises);
        const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
        
        if (successCount === 0) {
            throw new Error('Failed to publish event to any relay');
        }

        return successCount;
    }

    getNetworkStatus() {
        return {
            totalMachines: this.statusManager.getMachineCount(),
            onlineMachines: this.statusManager.getOnlineMachines(),
            connectedRelays: this.relays.filter(r => r.connected).length,
            totalRelays: this.relays.length,
            myPublicKey: this.keyManager.publicKey
        };
    }

    onMachineStatusUpdate(machineId, statusData) {
        console.log(`Machine ${machineId} status updated:`, statusData.status);
    }

    onMachineOfflineReport(machineId, reportedBy) {
        console.log(`Machine ${machineId} reported offline by ${reportedBy}`);
    }

    onGroupChatMessage(message) {
        console.log(`Group chat message from ${message.author}: ${message.content}`);
    }

    async shutdown() {
        this.relays.forEach(relay => {
            relay.disconnect();
        });
        
        this.relays = [];
        this.subscriptions.clear();
        this.isInitialized = false;
    }
}

module.exports = {
    DecentralizedCoordinator,
    NostrKeyManager,
    MachineStatusManager,
    NostrRelay
};