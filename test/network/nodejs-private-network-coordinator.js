// Node.js compatible version of private-network-coordinator.js
const crypto = require('crypto');
const { DecentralizedCoordinator } = require('./nodejs-coordination-system');

class PrivateNetworkCoordinator extends DecentralizedCoordinator {
    constructor(appConfig = {}) {
        // Pass machineId to parent constructor for unique keys
        super(appConfig.machineId || 'default');
        
        // Private network configuration
        this.appIdentifier = appConfig.appIdentifier || 'mkenyatool-network';
        this.appVersion = appConfig.appVersion || '1.0.0';
        this.networkSecret = appConfig.networkSecret || this.deriveNetworkSecret();
        this.minRequiredVersion = appConfig.minRequiredVersion || '1.0.0';
        this.machineId = appConfig.machineId || 'default'; // Unique machine identifier
        
        // Network state
        this.verifiedPeers = new Map();
        this.pendingVerifications = new Map();
        this.isolatedMode = false;
        this.lastPeerContact = null;
        this.isolationTimeout = 300000; // 5 minutes
        
        // Enhanced event kinds for private network
        this.privateEventKinds = {
            APP_VERIFICATION: 31000,
            PRIVATE_STATUS: 31001,
            PRIVATE_OFFLINE: 31002,
            PRIVATE_CHAT: 31003,
            NETWORK_PING: 31004,
            PEER_CHALLENGE: 31005
        };
        
        this.startIsolationMonitoring();
    }

    deriveNetworkSecret() {
        // Generate a deterministic secret based on app identifier
        // In production, this should be a pre-shared secret or derived from app signing
        const appData = `${this.appIdentifier}-network-key-v1`;
        return crypto.createHash('sha256').update(appData).digest('hex');
    }

    async initialize() {
        await super.initialize();
        
        // Override parent subscriptions with private network filters
        this.setupPrivateSubscriptions();
        
        // Start app verification process
        this.startAppVerification();
        
        console.log(`Private network initialized for ${this.appIdentifier}`);
        console.log(`Network ID: ${this.getNetworkId()}`);
    }

    getNetworkId() {
        // Create a unique network identifier
        const networkData = `${this.appIdentifier}-${this.appVersion}`;
        return crypto.createHash('sha256').update(networkData).digest('hex').substring(0, 16);
    }

    setupPrivateSubscriptions() {
        // Clear existing subscriptions
        this.relays.forEach(relay => {
            this.subscriptions.forEach((subId, relayUrl) => {
                if (relayUrl === relay.url) {
                    relay.unsubscribe(subId);
                }
            });
        });
        this.subscriptions.clear();

        // Subscribe only to private network events
        const privateFilters = [
            {
                kinds: [
                    this.privateEventKinds.APP_VERIFICATION,
                    this.privateEventKinds.PRIVATE_STATUS,
                    this.privateEventKinds.PRIVATE_OFFLINE,
                    this.privateEventKinds.NETWORK_PING,
                    this.privateEventKinds.PEER_CHALLENGE
                ],
                since: Math.floor(Date.now() / 1000) - 300,
                '#n': [this.getNetworkId()] // Network-specific tag
            },
            {
                kinds: [this.privateEventKinds.PRIVATE_CHAT],
                since: Math.floor(Date.now() / 1000) - 3600,
                '#n': [this.getNetworkId()]
            }
        ];

        this.relays.forEach(relay => {
            try {
                const subscriptionId = relay.subscribe(privateFilters, (event) => {
                    this.handlePrivateNetworkEvent(event);
                });
                this.subscriptions.set(relay.url, subscriptionId);
            } catch (error) {
                console.error(`Failed to subscribe to private network on relay ${relay.url}:`, error);
            }
        });
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
        
        const verificationData = {
            appIdentifier: this.appIdentifier,
            appVersion: this.appVersion,
            challenge: challenge,
            timestamp: timestamp,
            capabilities: this.statusManager.getMachineCapabilities(),
            networkInfo: this.statusManager.getNetworkInfo()
        };

        // Create proof of app authenticity
        const proof = this.createAppProof(verificationData);
        verificationData.proof = proof;

        const event = this.createPrivateEvent(
            this.privateEventKinds.APP_VERIFICATION,
            JSON.stringify(verificationData)
        );

        await this.publishToRelays(event);
        
        // Store our own challenge for response verification
        this.pendingVerifications.set(challenge, {
            timestamp: timestamp,
            ourChallenge: true
        });
    }

    createAppProof(data) {
        // Create proof that this is a legitimate app instance
        const proofData = {
            networkSecret: this.networkSecret,
            timestamp: data.timestamp,
            appId: data.appIdentifier,
            publicKey: this.keyManager.publicKey
        };
        
        const proofString = JSON.stringify(proofData);
        const proofHash = crypto.createHash('sha256').update(proofString).digest('hex');
        
        // Sign the proof with our private key
        const signature = this.keyManager.signMessage(proofHash);
        
        return {
            hash: proofHash,
            signature: signature
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

            // Verify signature
            const signatureValid = this.keyManager.verifySignature(
                expectedHash, 
                proof.signature, 
                peerPublicKey
            );
            
            if (!signatureValid) {
                return { valid: false, reason: 'invalid_signature' };
            }

            return { valid: true };
            
        } catch (error) {
            console.error('Error verifying app proof:', error);
            return { valid: false, reason: 'verification_error' };
        }
    }

    handlePrivateNetworkEvent(event) {
        // First verify this event is from our private network
        if (!this.isPrivateNetworkEvent(event)) {
            return;
        }

        switch (event.kind) {
            case this.privateEventKinds.APP_VERIFICATION:
                this.handleAppVerification(event);
                break;
            case this.privateEventKinds.PRIVATE_STATUS:
                this.handlePrivateStatus(event);
                break;
            case this.privateEventKinds.PRIVATE_OFFLINE:
                this.handlePrivateOffline(event);
                break;
            case this.privateEventKinds.PRIVATE_CHAT:
                this.handlePrivateChat(event);
                break;
            case this.privateEventKinds.NETWORK_PING:
                this.handleNetworkPing(event);
                break;
        }
    }

    isPrivateNetworkEvent(event) {
        // Check if event has our network tag
        const networkTag = event.tags.find(tag => tag[0] === 'n' && tag[1] === this.getNetworkId());
        return !!networkTag;
    }

    async handleAppVerification(event) {
        try {
            const verificationData = JSON.parse(event.content);
            const peerPublicKey = event.pubkey;
            
            // Don't verify our own messages
            if (peerPublicKey === this.keyManager.publicKey) {
                return;
            }

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
                    this.onNetworkReconnected();
                }

                this.onPeerVerified(peerPublicKey, verificationData);
                
                // Respond with our own verification if this was a challenge
                await this.respondToVerificationChallenge(verificationData);
                
            } else {
                console.warn(`Failed to verify peer ${peerPublicKey}: ${verification.reason}`);
                this.onInvalidPeerDetected(peerPublicKey, verification.reason);
            }
            
        } catch (error) {
            console.error('Error handling app verification:', error);
        }
    }

    async respondToVerificationChallenge(challengeData) {
        // Send our verification in response
        await this.broadcastAppVerification();
    }

    async handlePrivateStatus(event) {
        const peerPublicKey = event.pubkey;
        
        // Only process status from verified peers
        if (!this.verifiedPeers.has(peerPublicKey)) {
            console.warn(`Ignoring status from unverified peer: ${peerPublicKey}`);
            return;
        }

        try {
            const statusData = JSON.parse(event.content);
            
            // Update peer info
            const peer = this.verifiedPeers.get(peerPublicKey);
            peer.lastSeen = Date.now();
            peer.statusData = statusData;
            
            this.lastPeerContact = Date.now();
            
            this.onVerifiedPeerStatusUpdate(peerPublicKey, statusData);
            
        } catch (error) {
            console.error('Error handling private status:', error);
        }
    }

    async handlePrivateOffline(event) {
        try {
            const offlineData = JSON.parse(event.content);
            const reportingMachine = event.pubkey;
            
            if (this.keyManager.verifySignature(event.content, {
                r: event.sig.slice(0, 64),
                s: event.sig.slice(64)
            }, reportingMachine)) {
                this.verifiedPeers.delete(offlineData.machineId);
                this.onPeerDisconnected(offlineData.machineId);
            }
        } catch (error) {
            console.error('Error handling machine offline event:', error);
        }
    }

    async handlePrivateChat(event) {
        this.onGroupChatMessage({
            id: event.id,
            author: event.pubkey,
            content: event.content,
            timestamp: event.created_at * 1000,
            tags: event.tags
        });
    }

    async handleNetworkPing(event) {
        const peerPublicKey = event.pubkey;
        
        // Only process pings from verified peers
        if (!this.verifiedPeers.has(peerPublicKey)) {
            return;
        }

        try {
            const pingData = JSON.parse(event.content);
            
            // Update peer info
            const peer = this.verifiedPeers.get(peerPublicKey);
            peer.lastSeen = Date.now();
            
            this.lastPeerContact = Date.now();
            
        } catch (error) {
            console.error('Error handling network ping:', error);
        }
    }

    async pingKnownPeers() {
        if (this.verifiedPeers.size === 0) {
            return;
        }

        const pingData = {
            timestamp: Date.now(),
            peerCount: this.verifiedPeers.size
        };

        const event = this.createPrivateEvent(
            this.privateEventKinds.NETWORK_PING,
            JSON.stringify(pingData)
        );

        await this.publishToRelays(event);
    }

    createPrivateEvent(kind, content, extraTags = []) {
        const tags = [
            ['n', this.getNetworkId()], // Network identifier tag
            ['app', this.appIdentifier],
            ['v', this.appVersion],
            ...extraTags
        ];

        const event = {
            id: null,
            pubkey: this.keyManager.publicKey,
            created_at: Math.floor(Date.now() / 1000),
            kind: kind,
            tags: tags,
            content: content,
            sig: null
        };

        // Generate ID and sign
        const serialized = JSON.stringify([
            0,
            event.pubkey,
            event.created_at,
            event.kind,
            event.tags,
            event.content
        ]);

        event.id = crypto.createHash('sha256').update(serialized).digest('hex');
        const signature = this.keyManager.signMessage(event.id);
        event.sig = signature.r + signature.s;

        return event;
    }

    startIsolationMonitoring() {
        // Monitor for network isolation
        setInterval(() => {
            const now = Date.now();
            
            // Check if we haven't heard from any peers recently
            if (this.lastPeerContact && (now - this.lastPeerContact) > this.isolationTimeout) {
                if (!this.isolatedMode) {
                    this.isolatedMode = true;
                    this.onNetworkIsolated();
                }
            }
            
            // Clean up old peer entries
            this.cleanupStalePeers();
            
        }, 30000); // Check every 30 seconds
    }

    cleanupStalePeers() {
        const now = Date.now();
        const staleTimeout = 180000; // 3 minutes
        
        for (const [peerId, peer] of this.verifiedPeers.entries()) {
            if (now - peer.lastSeen > staleTimeout) {
                this.verifiedPeers.delete(peerId);
                this.onPeerDisconnected(peerId);
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

    async sendPrivateMessage(content, targetPeerId = null) {
        const messageData = {
            content: content,
            timestamp: Date.now(),
            target: targetPeerId
        };

        const extraTags = targetPeerId ? [['p', targetPeerId]] : [];

        const event = this.createPrivateEvent(
            this.privateEventKinds.PRIVATE_CHAT,
            JSON.stringify(messageData),
            extraTags
        );

        return await this.publishToRelays(event);
    }

    async reportMachineOffline(machineId) {
        const offlineData = {
            machineId: machineId,
            reportedBy: this.keyManager.publicKey,
            timestamp: Date.now(),
            reason: 'heartbeat_timeout'
        };

        const event = this.createPrivateEvent(
            this.privateEventKinds.PRIVATE_OFFLINE,
            JSON.stringify(offlineData)
        );

        await this.publishToRelays(event);
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
            myPublicKey: this.keyManager.publicKey,
            peerList: Array.from(this.verifiedPeers.keys()).map(peerId => ({
                id: peerId,
                shortId: peerId.substring(0, 8),
                lastSeen: this.verifiedPeers.get(peerId).lastSeen,
                status: this.verifiedPeers.get(peerId).statusData?.status || 'unknown'
            }))
        };
    }

    // Event handlers for app to override
    onPeerVerified(peerId, verificationData) {
        console.log(`Verified new peer: ${peerId.substring(0, 8)}...`);
    }

    onInvalidPeerDetected(peerId, reason) {
        console.warn(`Invalid peer detected: ${peerId.substring(0, 8)}... (${reason})`);
    }

    onVerifiedPeerStatusUpdate(peerId, statusData) {
        console.log(`Status update from verified peer: ${peerId.substring(0, 8)}...`);
    }

    onPeerDisconnected(peerId) {
        console.log(`Peer disconnected: ${peerId.substring(0, 8)}...`);
    }

    onNetworkIsolated() {
        console.warn('Network isolation detected - no verified peers found');
        console.log('Operating in isolated mode - waiting for peer discovery...');
    }

    onNetworkReconnected() {
        console.log('Network reconnected - verified peers found');
    }

    onGroupChatMessage(message) {
        console.log(`Group chat message from ${message.author}: ${message.content}`);
    }
}

module.exports = { PrivateNetworkCoordinator };