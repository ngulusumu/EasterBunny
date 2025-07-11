//networking/enhanced-private-network-coordinator.js
const { SimplePool, generateSecretKey, getPublicKey, nip04, finalizeEvent, verifyEvent } = require('nostr-tools');
const WebSocket = require('ws');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { app } = require('electron');

// Import your existing system info modules
const WindowsSystemInfo = require('../systeminfo/systeminfo_win');
const LinuxSystemInfo = require('../systeminfo/systeminfo_linux'); 
const MacSystemInfo = require('../systeminfo/systeminfo_mac');

// Set up WebSocket globally for nostr-tools
if (typeof globalThis.WebSocket === 'undefined') {
    globalThis.WebSocket = WebSocket;
}

class EnhancedPrivateNetworkCoordinator {
    constructor(appConfig = {}) {
        // App configuration
        this.appIdentifier = appConfig.appIdentifier || 'mkenyatool-network';
        this.appVersion = appConfig.appVersion || '1.0.0';
        this.networkSecret = appConfig.networkSecret || this.deriveNetworkSecret();
        this.minRequiredVersion = appConfig.minRequiredVersion || '1.0.0';
        this.machineId = appConfig.machineId || 'default';
        
        // Key management
        this.keysPath = path.join(app.getPath('userData'), `nostr-coordination-keys-${this.machineId}.json`);
        this.privateKey = null;
        this.publicKey = null;
        
        // Network state
        this.verifiedPeers = new Map();
        this.pendingVerifications = new Map();
        this.isolatedMode = false;
        this.lastPeerContact = null;
        this.isolationTimeout = 300000; // 5 minutes
        
        // Relay configuration
        this.relays = [
            'wss://relay.damus.io',
            'wss://nos.lol',
            'wss://relay.nostr.band',
            'wss://nostr-pub.wellorder.net',
            'wss://relay.primal.net'
        ];
        
        // Initialize SimplePool with error handling
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
        
        // System info management
        this.systemInfo = this.initializeSystemInfo();
        this.cachedSystemInfo = null;
        this.cacheTimestamp = null;
        this.cacheTimeout = 60000; // Cache for 1 minute
        
        // Event kinds for private network
        this.eventKinds = {
            APP_VERIFICATION: 31000,
            PRIVATE_STATUS: 31001,
            PRIVATE_OFFLINE: 31002,
            PRIVATE_CHAT: 31003,
            NETWORK_PING: 31004,
            MACHINE_ANNOUNCEMENT: 31005
        };
        
        // Event handlers
        this.onPeerVerified = null;
        this.onInvalidPeerDetected = null;
        this.onVerifiedPeerStatusUpdate = null;
        this.onPeerDisconnected = null;
        this.onNetworkIsolated = null;
        this.onNetworkReconnected = null;
        this.onGroupChatMessage = null;
        
        this.subscriptions = new Map();
        this.connectedMachines = new Map();
        this.isInitialized = false;
        
        this.startIsolationMonitoring();
    }

    initializeSystemInfo() {
        const platform = os.platform();
        
        switch (platform) {
            case 'win32':
                return new WindowsSystemInfo();
            case 'linux':
                return new LinuxSystemInfo();
            case 'darwin':
                return new MacSystemInfo();
            default:
                console.warn(`Unsupported platform: ${platform}, using basic info`);
                return null;
        }
    }

    deriveNetworkSecret() {
        const appData = `${this.appIdentifier}-secure-network-key-v1`;
        return crypto.createHash('sha256').update(appData).digest('hex');
    }

    getNetworkId() {
        const networkData = `${this.appIdentifier}-${this.appVersion}`;
        return crypto.createHash('sha256').update(networkData).digest('hex').substring(0, 16);
    }

    async initialize() {
        if (this.isInitialized) {
            return;
        }

        console.log('🚀 Initializing Enhanced Private Network Coordinator...');
        
        // Load or generate keys
        await this.loadOrGenerateKeys();
        console.log(`🔑 Public Key: ${this.publicKey.substring(0, 16)}...`);
        console.log(`🔒 Network ID: ${this.getNetworkId()}`);

        // Connect to relays
        await this.connectToRelays();
        console.log(`📡 Connected to relays`);

        // Setup subscriptions
        this.setupPrivateSubscriptions();

        // Start verification and status broadcasting
        this.startAppVerification();
        this.startStatusBroadcasting();

        // Announce presence
        await this.sendAnnouncement();

        this.isInitialized = true;
        console.log(`✅ Enhanced Private Network Coordinator initialized successfully!`);
        console.log(`📊 Network ID: ${this.getNetworkId()}`);
        console.log(`🔑 Public Key: ${this.publicKey.substring(0, 16)}...`);
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
            console.log('Generating new coordination keys...');
        }

        this.privateKey = Buffer.from(generateSecretKey()).toString('hex');
        this.publicKey = getPublicKey(this.privateKey);
        await fs.writeFile(this.keysPath, JSON.stringify({
            privateKey: this.privateKey,
            publicKey: this.publicKey,
            appIdentifier: this.appIdentifier,
            createdAt: new Date().toISOString()
        }, null, 2), { mode: 0o600 });
        console.log('🔑 Generated new coordination keypair');
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

    setupPrivateSubscriptions() {
        console.log('🔔 Setting up private network subscriptions...');
        
        const privateFilters = [
            {
                kinds: [
                    this.eventKinds.APP_VERIFICATION,
                    this.eventKinds.PRIVATE_STATUS,
                    this.eventKinds.PRIVATE_OFFLINE,
                    this.eventKinds.NETWORK_PING,
                    this.eventKinds.MACHINE_ANNOUNCEMENT
                ],
                since: Math.floor(Date.now() / 1000) - 300,
                '#n': [this.getNetworkId()]
            },
            {
                kinds: [this.eventKinds.PRIVATE_CHAT],
                since: Math.floor(Date.now() / 1000) - 3600,
                '#n': [this.getNetworkId()]
            }
        ];

        try {
            const sub = this.pool.subscribeMany(
                this.relays,
                privateFilters,
                {
                    onevent: async (event) => {
                        console.log(`📨 Received private event ${event.id.substring(0, 8)}... from ${event.pubkey.substring(0, 8)}...`);
                        
                        if (!verifyEvent(event)) {
                            console.warn(`⚠️ Invalid event signature: ${event.id.substring(0, 8)}...`);
                            return;
                        }
                        
                        // Skip events from self
                        if (event.pubkey === this.publicKey) {
                            console.log(`↩️ Skipping own event: ${event.id.substring(0, 8)}...`);
                            return;
                        }
                        
                        await this.handlePrivateNetworkEvent(event);
                    },
                    onclose: (reason) => {
                        console.log(`🔌 Private network subscription closed: ${reason}`);
                    },
                    oneose: () => {
                        console.log('📭 End of stored private events received');
                    }
                }
            );
            
            console.log('✅ Private network subscriptions active');
            return sub;
        } catch (error) {
            console.error('❌ Failed to set up private subscriptions:', error);
            throw error;
        }
    }

    async handlePrivateNetworkEvent(event) {
        // Verify this event is from our private network
        if (!this.isPrivateNetworkEvent(event)) {
            return;
        }

        switch (event.kind) {
            case this.eventKinds.APP_VERIFICATION:
                await this.handleAppVerification(event);
                break;
            case this.eventKinds.PRIVATE_STATUS:
                await this.handlePrivateStatus(event);
                break;
            case this.eventKinds.PRIVATE_OFFLINE:
                await this.handlePrivateOffline(event);
                break;
            case this.eventKinds.PRIVATE_CHAT:
                await this.handlePrivateChat(event);
                break;
            case this.eventKinds.NETWORK_PING:
                await this.handleNetworkPing(event);
                break;
            case this.eventKinds.MACHINE_ANNOUNCEMENT:
                await this.handleMachineAnnouncement(event);
                break;
        }
    }

    isPrivateNetworkEvent(event) {
        const networkTag = event.tags.find(tag => tag[0] === 'n' && tag[1] === this.getNetworkId());
        const appTag = event.tags.find(tag => tag[0] === 'app' && tag[1] === this.appIdentifier);
        return !!(networkTag && appTag);
    }

    startAppVerification() {
        // Broadcast app verification challenge
        this.broadcastAppVerification();
        
        // Periodically re-verify and ping network
        setInterval(() => {
            this.broadcastAppVerification();
            this.pingKnownPeers();
            this.cleanupStaleVerifications();
        }, 60000); // Every minute
    }

    async broadcastAppVerification() {
        const challenge = crypto.randomBytes(32).toString('hex');
        const timestamp = Date.now();
        
        const systemInfo = await this.getDetailedSystemInfo();
        const coordinationInfo = this.extractCoordinationInfo(systemInfo);
        
        const verificationData = {
            appIdentifier: this.appIdentifier,
            appVersion: this.appVersion,
            challenge: challenge,
            timestamp: timestamp,
            capabilities: coordinationInfo.capabilities,
            performance: coordinationInfo.performance,
            networkInfo: coordinationInfo.networkInfo,
            systemSummary: coordinationInfo.systemSummary
        };

        // Create proof of app authenticity
        const proof = this.createAppProof(verificationData);
        verificationData.proof = proof;

        const event = finalizeEvent({
            kind: this.eventKinds.APP_VERIFICATION,
            pubkey: this.publicKey,
            created_at: Math.floor(Date.now() / 1000),
            tags: [
                ['n', this.getNetworkId()],
                ['app', this.appIdentifier],
                ['v', this.appVersion]
            ],
            content: JSON.stringify(verificationData)
        }, this.privateKey);

        await this.publishEvent(event);
        
        // Store our own challenge for response verification
        this.pendingVerifications.set(challenge, {
            timestamp: timestamp,
            ourChallenge: true
        });
    }

    createAppProof(data) {
        const proofData = {
            networkSecret: this.networkSecret,
            timestamp: data.timestamp,
            appId: data.appIdentifier,
            publicKey: this.publicKey
        };
        
        const proofString = JSON.stringify(proofData);
        const proofHash = crypto.createHash('sha256').update(proofString).digest('hex');
        
        return {
            hash: proofHash,
            data: proofData
        };
    }

    verifyAppProof(verificationData, peerPublicKey) {
        try {
            const { proof, appIdentifier, timestamp } = verificationData;
            
            // Check if it's our app
            if (appIdentifier !== this.appIdentifier) {
                return { valid: false, reason: 'wrong_app' };
            }

            // Check timestamp (not too old)
            if (Date.now() - timestamp > 300000) { // 5 minutes
                return { valid: false, reason: 'expired' };
            }

            // Recreate expected proof
            const expectedProofData = {
                networkSecret: this.networkSecret,
                timestamp: timestamp,
                appId: appIdentifier,
                publicKey: peerPublicKey
            };
            
            const expectedProofString = JSON.stringify(expectedProofData);
            const expectedHash = crypto.createHash('sha256').update(expectedProofString).digest('hex');
            
            // Verify proof hash matches
            if (proof.hash !== expectedHash) {
                return { valid: false, reason: 'invalid_proof' };
            }

            return { valid: true };
            
        } catch (error) {
            console.error('Error verifying app proof:', error);
            return { valid: false, reason: 'verification_error' };
        }
    }

    async handleAppVerification(event) {
        try {
            const verificationData = JSON.parse(event.content);
            const peerPublicKey = event.pubkey;
            
            const verification = this.verifyAppProof(verificationData, peerPublicKey);
            
            if (verification.valid) {
                // Peer is verified as legitimate app instance
                this.verifiedPeers.set(peerPublicKey, {
                    verificationData: verificationData,
                    verifiedAt: Date.now(),
                    lastSeen: Date.now(),
                    status: 'verified'
                });

                this.lastPeerContact = Date.now();
                
                if (this.isolatedMode) {
                    this.isolatedMode = false;
                    if (this.onNetworkReconnected) {
                        this.onNetworkReconnected();
                    }
                }

                if (this.onPeerVerified) {
                    this.onPeerVerified(peerPublicKey, verificationData);
                }
                
                // Respond with our own verification if this was a challenge
                await this.respondToVerificationChallenge(verificationData);
                
            } else {
                console.warn(`Failed to verify peer ${peerPublicKey.substring(0, 8)}...: ${verification.reason}`);
                if (this.onInvalidPeerDetected) {
                    this.onInvalidPeerDetected(peerPublicKey, verification.reason);
                }
            }
            
        } catch (error) {
            console.error('Error handling app verification:', error);
        }
    }

    async handleMachineAnnouncement(event) {
        try {
            const data = JSON.parse(event.content);
            const peerId = event.pubkey;
            const shortId = peerId.substring(0, 8);

            // Only process announcements from verified peers
            if (!this.verifiedPeers.has(peerId)) {
                console.warn(`Ignoring announcement from unverified peer: ${shortId}...`);
                return;
            }

            if (!this.connectedMachines.has(peerId)) {
                console.log(`\n🎉 NEW VERIFIED MACHINE DETECTED!`);
                console.log(`   Name: ${data.machine_name}`);
                console.log(`   ID: ${shortId}...`);
                console.log(`   Platform: ${data.platform}/${data.arch}`);
                console.log(`   CPUs: ${data.cpus}, Memory: ${data.memory_gb}GB`);
                console.log(`   Hostname: ${data.hostname}`);

                this.connectedMachines.set(peerId, {
                    name: data.machine_name,
                    shortId: shortId,
                    lastSeen: Date.now(),
                    announcementData: data
                });
            } else {
                this.connectedMachines.get(peerId).lastSeen = Date.now();
            }

            this.lastPeerContact = Date.now();
        } catch (error) {
            console.error('Error handling machine announcement:', error);
        }
    }

    async respondToVerificationChallenge(challengeData) {
        // Send our verification in response with a small delay to avoid spam
        setTimeout(() => {
            this.broadcastAppVerification();
        }, Math.random() * 5000); // Random delay 0-5 seconds
    }

    async handlePrivateStatus(event) {
        const peerPublicKey = event.pubkey;
        
        // Only process status from verified peers
        if (!this.verifiedPeers.has(peerPublicKey)) {
            console.warn(`Ignoring status from unverified peer: ${peerPublicKey.substring(0, 8)}...`);
            return;
        }

        try {
            const statusData = JSON.parse(event.content);
            
            // Update peer info
            const peer = this.verifiedPeers.get(peerPublicKey);
            peer.lastSeen = Date.now();
            peer.statusData = statusData;
            
            this.lastPeerContact = Date.now();
            
            if (this.onVerifiedPeerStatusUpdate) {
                this.onVerifiedPeerStatusUpdate(peerPublicKey, statusData);
            }
            
        } catch (error) {
            console.error('Error handling private status:', error);
        }
    }

    async handlePrivateChat(event) {
        try {
            const messageData = JSON.parse(event.content);
            const peerPublicKey = event.pubkey;
            
            // Only process chat from verified peers
            if (!this.verifiedPeers.has(peerPublicKey)) {
                console.warn(`Ignoring chat from unverified peer: ${peerPublicKey.substring(0, 8)}...`);
                return;
            }

            const sender = this.connectedMachines.get(peerPublicKey)?.name || peerPublicKey.substring(0, 8);
            console.log(`\n💬 ${sender}: ${messageData.content}`);
            console.log(`   Received at: ${new Date(messageData.timestamp).toLocaleTimeString()}`);
            
            if (this.onGroupChatMessage) {
                this.onGroupChatMessage({
                    id: event.id,
                    author: peerPublicKey,
                    authorName: sender,
                    content: messageData.content,
                    timestamp: messageData.timestamp,
                    tags: event.tags
                });
            }
        } catch (error) {
            console.error('Error handling private chat:', error);
        }
    }

    async handleNetworkPing(event) {
        const peerPublicKey = event.pubkey;
        
        if (this.verifiedPeers.has(peerPublicKey)) {
            const peer = this.verifiedPeers.get(peerPublicKey);
            peer.lastSeen = Date.now();
            this.lastPeerContact = Date.now();
        }
    }

    async sendAnnouncement() {
        const systemInfo = await this.getDetailedSystemInfo();
        const coordinationInfo = this.extractCoordinationInfo(systemInfo);
        
        const announcementData = {
            machine_name: `${this.appIdentifier}-${os.hostname()}`,
            platform: coordinationInfo.capabilities.platform,
            arch: coordinationInfo.capabilities.architecture,
            cpus: coordinationInfo.capabilities.cpuCores,
            memory_gb: Math.round(coordinationInfo.capabilities.totalMemory / (1024 * 1024 * 1024)),
            hostname: coordinationInfo.networkInfo.hostname,
            timestamp: Date.now(),
            appVersion: this.appVersion,
            capabilities: coordinationInfo.capabilities,
            performance: coordinationInfo.performance
        };

        const event = finalizeEvent({
            kind: this.eventKinds.MACHINE_ANNOUNCEMENT,
            pubkey: this.publicKey,
            created_at: Math.floor(Date.now() / 1000),
            tags: [
                ['n', this.getNetworkId()],
                ['app', this.appIdentifier],
                ['v', this.appVersion]
            ],
            content: JSON.stringify(announcementData)
        }, this.privateKey);

        await this.publishEvent(event);
        console.log(`📢 Announced presence: ${announcementData.machine_name}`);
    }

    startStatusBroadcasting() {
        this.broadcastStatus();
        
        setInterval(() => {
            this.broadcastStatus();
        }, 30000); // Every 30 seconds
    }

    async broadcastStatus() {
        try {
            const systemInfo = await this.getDetailedSystemInfo();
            const coordinationInfo = this.extractCoordinationInfo(systemInfo);
            
            const statusData = {
                machineId: this.publicKey,
                status: 'online',
                timestamp: Date.now(),
                capabilities: coordinationInfo.capabilities,
                performance: coordinationInfo.performance,
                networkInfo: coordinationInfo.networkInfo,
                systemSummary: coordinationInfo.systemSummary,
                healthScore: await this.getSystemHealthScore(),
                capabilityScore: await this.getMachineCapabilityScore()
            };

            const event = finalizeEvent({
                kind: this.eventKinds.PRIVATE_STATUS,
                pubkey: this.publicKey,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ['n', this.getNetworkId()],
                    ['app', this.appIdentifier],
                    ['v', this.appVersion]
                ],
                content: JSON.stringify(statusData)
            }, this.privateKey);

            await this.publishEvent(event);
        } catch (error) {
            console.error('Error broadcasting status:', error);
        }
    }

    async sendPrivateMessage(content, targetPeerId = null) {
        const messageData = {
            content: content,
            timestamp: Date.now(),
            target: targetPeerId,
            sender: this.publicKey
        };

        const tags = [
            ['n', this.getNetworkId()],
            ['app', this.appIdentifier],
            ['v', this.appVersion]
        ];
        
        if (targetPeerId) {
            tags.push(['p', targetPeerId]);
        }

        const event = finalizeEvent({
            kind: this.eventKinds.PRIVATE_CHAT,
            pubkey: this.publicKey,
            created_at: Math.floor(Date.now() / 1000),
            tags: tags,
            content: JSON.stringify(messageData)
        }, this.privateKey);

        return await this.publishEvent(event);
    }

    async pingKnownPeers() {
        if (this.verifiedPeers.size === 0) {
            return;
        }

        const pingData = {
            timestamp: Date.now(),
            peerCount: this.verifiedPeers.size,
            machineCount: this.connectedMachines.size
        };

        const event = finalizeEvent({
            kind: this.eventKinds.NETWORK_PING,
            pubkey: this.publicKey,
            created_at: Math.floor(Date.now() / 1000),
            tags: [
                ['n', this.getNetworkId()],
                ['app', this.appIdentifier],
                ['v', this.appVersion]
            ],
            content: JSON.stringify(pingData)
        }, this.privateKey);

        await this.publishEvent(event);
    }

    async publishEvent(event) {
        let successCount = 0;
        
        try {
            const results = await this.pool.publish(this.relays, event);
            
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
        }
        
        if (successCount === 0) {
            console.warn('⚠️ Failed to publish to any relay');
        } else {
            console.log(`✅ Successfully published to ${successCount} relay(s)`);
        }
        
        return successCount;
    }

    // System Info Methods
    async getDetailedSystemInfo() {
        const now = Date.now();
        if (this.cachedSystemInfo && this.cacheTimestamp && 
            (now - this.cacheTimestamp) < this.cacheTimeout) {
            return this.cachedSystemInfo;
        }

        try {
            let systemData;
            
            if (this.systemInfo) {
                systemData = await this.systemInfo.getAllSystemInfo();
            } else {
                systemData = this.getBasicSystemInfo();
            }

            this.cachedSystemInfo = systemData;
            this.cacheTimestamp = now;
            
            return systemData;
            
        } catch (error) {
            console.error('Error getting detailed system info:', error);
            return this.getBasicSystemInfo();
        }
    }

    getBasicSystemInfo() {
        return {
            timestamp: new Date().toISOString(),
            basic: {
                hostname: os.hostname(),
                platform: os.platform(),
                architecture: os.arch(),
                release: os.release(),
                uptime: os.uptime(),
                nodeVersion: process.version,
                totalMemory: os.totalmem(),
                freeMemory: os.freemem(),
                cpuCount: os.cpus().length,
                cpuModel: os.cpus()[0]?.model || 'Unknown'
            },
            performance: {
                cpuUsage: 0,
                memoryUsage: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2),
                diskUsage: 0
            }
        };
    }

    extractCoordinationInfo(systemInfo) {
        const basic = systemInfo.basic || {};
        const cpu = systemInfo.cpu || {};
        const memory = systemInfo.memory || {};
        const performance = systemInfo.performance || {};
        const network = systemInfo.network || [];
        const disks = systemInfo.disks || [];

        return {
            capabilities: {
                platform: basic.platform || os.platform(),
                architecture: basic.architecture || os.arch(),
                cpuModel: cpu.cpuDetails?.[0]?.name || basic.cpuModel || 'Unknown',
                cpuCores: cpu.cpuDetails?.[0]?.cores || basic.cpuCount || os.cpus().length,
                logicalProcessors: cpu.cpuDetails?.[0]?.logicalProcessors || basic.cpuCount || os.cpus().length,
                totalMemory: memory.totalPhysical || basic.totalMemory || os.totalmem(),
                maxClockSpeed: cpu.cpuDetails?.[0]?.maxClockSpeed || 0,
                totalDiskSpace: disks.reduce((total, disk) => total + (disk.totalSize || 0), 0),
                nodeVersion: basic.nodeVersion || process.version,
                systemUptime: basic.uptime || os.uptime()
            },
            performance: {
                cpuUsage: performance.cpuUsage || cpu.cpuUsage || 0,
                memoryUsage: performance.memoryUsage || memory.memoryUsagePercent || 0,
                memoryUsed: memory.usedPhysical || (basic.totalMemory - basic.freeMemory) || 0,
                memoryFree: memory.freePhysical || basic.freeMemory || os.freemem(),
                diskUsage: performance.diskUsage || (disks.length > 0 ? disks[0].usagePercent : 0),
                loadAverage: basic.loadAverage || [0, 0, 0]
            },
            networkInfo: {
                hostname: basic.hostname || os.hostname(),
                adapters: network.map(adapter => ({
                    description: adapter.description || 'Unknown',
                    ipAddress: adapter.ipAddress || 'N/A',
                    macAddress: adapter.macAddress || 'N/A',
                    dhcpEnabled: adapter.dhcpEnabled || false
                })).slice(0, 3),
                activeConnections: network.filter(n => n.ipAddress && n.ipAddress !== 'N/A').length
            },
            systemSummary: {
                osVersion: systemInfo.windowsVersion?.caption || `${basic.platform} ${basic.release}`,
                totalProcesses: systemInfo.processes?.length || 0,
                runningServices: systemInfo.services?.filter(s => s.state === 'Running').length || 0,
                totalDisks: disks.length || 0,
                networkAdapters: network.length || 0
            }
        };
    }

    async getSystemHealthScore() {
        try {
            const systemInfo = await this.getDetailedSystemInfo();
            const performance = systemInfo.performance || {};
            
            let healthScore = 100;
            
            const cpuUsage = performance.cpuUsage || 0;
            if (cpuUsage > 80) healthScore -= 40;
            else if (cpuUsage > 60) healthScore -= 25;
            else if (cpuUsage > 40) healthScore -= 10;
            
            const memoryUsage = performance.memoryUsage || 0;
            if (memoryUsage > 90) healthScore -= 35;
            else if (memoryUsage > 80) healthScore -= 20;
            else if (memoryUsage > 70) healthScore -= 10;
            
            const diskUsage = performance.diskUsage || 0;
            if (diskUsage > 95) healthScore -= 25;
            else if (diskUsage > 85) healthScore -= 15;
            else if (diskUsage > 75) healthScore -= 5;
            
            return Math.max(0, Math.min(100, healthScore));
            
        } catch (error) {
            console.error('Error calculating health score:', error);
            return 50;
        }
    }

    async getMachineCapabilityScore() {
        try {
            const systemInfo = await this.getDetailedSystemInfo();
            const capabilities = this.extractCoordinationInfo(systemInfo).capabilities;
            
            let score = 0;
            
            const cpuCores = capabilities.cpuCores || 1;
            score += Math.min(40, cpuCores * 5);
            
            const memoryGB = (capabilities.totalMemory || 0) / (1024 * 1024 * 1024);
            score += Math.min(30, memoryGB * 2);
            
            const diskTB = (capabilities.totalDiskSpace || 0) / (1024 * 1024 * 1024 * 1024);
            score += Math.min(20, diskTB * 10);
            
            const platform = capabilities.platform;
            if (platform === 'win32') score += 8;
            else if (platform === 'linux') score += 10;
            else if (platform === 'darwin') score += 7;
            
            return Math.min(100, score);
            
        } catch (error) {
            console.error('Error calculating capability score:', error);
            return 50;
        }
    }

    async reportMachineOffline(machineId) {
        const offlineData = {
            machineId: machineId,
            reportedBy: this.publicKey,
            timestamp: Date.now(),
            reason: 'manual_report'
        };

        const event = finalizeEvent({
            kind: this.eventKinds.PRIVATE_OFFLINE,
            pubkey: this.publicKey,
            created_at: Math.floor(Date.now() / 1000),
            tags: [
                ['n', this.getNetworkId()],
                ['app', this.appIdentifier],
                ['v', this.appVersion],
                ['p', machineId]
            ],
            content: JSON.stringify(offlineData)
        }, this.privateKey);

        await this.publishEvent(event);
    }

    // Monitoring and cleanup methods
    startIsolationMonitoring() {
        setInterval(() => {
            const now = Date.now();
            
            if (this.lastPeerContact && (now - this.lastPeerContact) > this.isolationTimeout) {
                if (!this.isolatedMode) {
                    this.isolatedMode = true;
                    if (this.onNetworkIsolated) {
                        this.onNetworkIsolated();
                    }
                }
            }
            
            this.cleanupStalePeers();
            
        }, 30000);
    }

    cleanupStalePeers() {
        const now = Date.now();
        const staleTimeout = 180000; // 3 minutes
        
        for (const [peerId, peer] of this.verifiedPeers.entries()) {
            if (now - peer.lastSeen > staleTimeout) {
                this.verifiedPeers.delete(peerId);
                this.connectedMachines.delete(peerId);
                if (this.onPeerDisconnected) {
                    this.onPeerDisconnected(peerId);
                }
            }
        }
    }

    cleanupStaleVerifications() {
        const now = Date.now();
        const verificationTimeout = 300000; // 5 minutes
        
        for (const [challenge, verification] of this.pendingVerifications.entries()) {
            if (now - verification.timestamp > verificationTimeout) {
                this.pendingVerifications.delete(challenge);
            }
        }
    }

    // Status and information methods
    getPrivateNetworkStatus() {
        return {
            networkId: this.getNetworkId(),
            appIdentifier: this.appIdentifier,
            appVersion: this.appVersion,
            verifiedPeers: this.verifiedPeers.size,
            connectedMachines: this.connectedMachines.size,
            isolatedMode: this.isolatedMode,
            lastPeerContact: this.lastPeerContact,
            connectedRelays: this.relays.length, // Simplified for now
            myPublicKey: this.publicKey,
            peerList: Array.from(this.verifiedPeers.keys()).map(peerId => ({
                id: peerId,
                shortId: peerId.substring(0, 8),
                lastSeen: this.verifiedPeers.get(peerId).lastSeen,
                status: this.verifiedPeers.get(peerId).statusData?.status || 'unknown',
                machineName: this.connectedMachines.get(peerId)?.name || 'Unknown'
            }))
        };
    }

    getNetworkStatistics() {
        const machines = Array.from(this.verifiedPeers.values()).map(peer => peer.statusData).filter(Boolean);
        
        if (machines.length === 0) {
            return {
                totalMachines: 0,
                totalCpuCores: 0,
                totalMemory: 0,
                totalDiskSpace: 0,
                averageCpuUsage: 0,
                averageMemoryUsage: 0,
                platformDistribution: {},
                healthScore: 0
            };
        }
        
        const stats = machines.reduce((acc, machine) => {
            const caps = machine.capabilities || {};
            const perf = machine.performance || {};
            
            acc.totalCpuCores += caps.cpuCores || 0;
            acc.totalMemory += caps.totalMemory || 0;
            acc.totalDiskSpace += caps.totalDiskSpace || 0;
            acc.cpuUsageSum += perf.cpuUsage || 0;
            acc.memoryUsageSum += perf.memoryUsage || 0;
            
            const platform = caps.platform || 'unknown';
            acc.platformCounts[platform] = (acc.platformCounts[platform] || 0) + 1;
            
            return acc;
        }, {
            totalCpuCores: 0,
            totalMemory: 0,
            totalDiskSpace: 0,
            cpuUsageSum: 0,
            memoryUsageSum: 0,
            platformCounts: {}
        });
        
        return {
            totalMachines: machines.length,
            totalCpuCores: stats.totalCpuCores,
            totalMemory: stats.totalMemory,
            totalDiskSpace: stats.totalDiskSpace,
            averageCpuUsage: (stats.cpuUsageSum / machines.length).toFixed(2),
            averageMemoryUsage: (stats.memoryUsageSum / machines.length).toFixed(2),
            platformDistribution: stats.platformCounts,
            healthScore: Math.max(0, 100 - stats.cpuUsageSum / machines.length - stats.memoryUsageSum / machines.length)
        };
    }

    async shutdown() {
        console.log('🧹 Shutting down Enhanced Private Network Coordinator...');
        
        try {
            // Broadcast offline status
            await this.reportMachineOffline(this.publicKey);
            
            // Close pool connections
            await this.pool.close(this.relays);
            
            // Clear maps and state
            this.verifiedPeers.clear();
            this.connectedMachines.clear();
            this.pendingVerifications.clear();
            this.subscriptions.clear();
            
            this.isInitialized = false;
            console.log('✅ Enhanced Private Network Coordinator shutdown complete');
            
        } catch (error) {
            console.error('❌ Error during coordinator shutdown:', error);
        }
    }
}

module.exports = { EnhancedPrivateNetworkCoordinator };