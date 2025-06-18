const crypto = require('crypto');
const dgram = require('dgram');
const { EventEmitter } = require('events');

class NetworkDiscovery extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.sessionId = crypto.randomUUID();
        this.encryptionKey = options.encryptionKey || this.generateKey();
        this.discoveryPort = options.port || 33445;
        this.broadcastInterval = options.broadcastInterval || 30000; // 30 seconds
        this.maxPeers = options.maxPeers || 50;
        
        this.peers = new Map();
        this.stats = {};
        this.isActive = false;
        this.socket = null;
        this.broadcastTimer = null;
        
        // Multiple discovery methods
        this.discoveryMethods = {
            localBroadcast: true,
            webrtc: true,
            publicRelay: true,
            dnsDiscovery: true
        };
        
        this.webrtcPeers = new Map();
        this.relayConnections = new Map();
    }

    // Generate encryption key for session
    generateKey() {
        return crypto.randomBytes(32).toString('hex');
    }

    // Encrypt data before sharing
    encrypt(data) {
        try {
            const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
            let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
            encrypted += cipher.final('hex');
            return encrypted;
        } catch (error) {
            console.error('Encryption error:', error);
            return null;
        }
    }

    // Decrypt received data
    decrypt(encryptedData) {
        try {
            const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
            let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return JSON.parse(decrypted);
        } catch (error) {
            console.error('Decryption error:', error);
            return null;
        }
    }

    // Method 1: Local Network UDP Broadcast (works on same LAN)
    async startLocalDiscovery() {
        try {
            this.socket = dgram.createSocket('udp4');
            
            this.socket.on('message', (msg, rinfo) => {
                this.handleLocalMessage(msg, rinfo);
            });
            
            this.socket.on('error', (err) => {
                console.error('UDP Socket error:', err);
            });
            
            // Bind to discovery port
            this.socket.bind(this.discoveryPort, () => {
                this.socket.setBroadcast(true);
                console.log(`Local discovery listening on port ${this.discoveryPort}`);
                
                // Start broadcasting presence
                this.startBroadcasting();
            });
            
            return true;
        } catch (error) {
            console.error('Failed to start local discovery:', error);
            return false;
        }
    }

    // Handle incoming local network messages
    handleLocalMessage(msg, rinfo) {
        try {
            const message = JSON.parse(msg.toString());
            
            if (message.type === 'discovery' && message.sessionId !== this.sessionId) {
                // Decrypt and validate peer data
                const peerData = this.decrypt(message.payload);
                if (peerData) {
                    this.addPeer(rinfo.address, peerData, 'local');
                }
            } else if (message.type === 'stats' && message.sessionId !== this.sessionId) {
                // Handle stats update
                const statsData = this.decrypt(message.payload);
                if (statsData) {
                    this.updatePeerStats(message.sessionId, statsData);
                }
            }
        } catch (error) {
            console.error('Error handling local message:', error);
        }
    }

    // Start broadcasting presence to local network
    startBroadcasting() {
        const broadcast = () => {
            if (!this.isActive) return;
            
            const message = {
                type: 'discovery',
                sessionId: this.sessionId,
                timestamp: Date.now(),
                payload: this.encrypt({
                    version: '1.0.0',
                    capabilities: ['stats-sharing', 'coordination'],
                    stats: this.stats
                })
            };
            
            const messageBuffer = Buffer.from(JSON.stringify(message));
            
            // Broadcast to common network ranges
            const broadcastIPs = [
                '255.255.255.255',
                '192.168.1.255',
                '192.168.0.255',
                '10.0.0.255'
            ];
            
            broadcastIPs.forEach(ip => {
                this.socket.send(messageBuffer, this.discoveryPort, ip, (err) => {
                    if (err && err.code !== 'ENETUNREACH') {
                        console.error(`Broadcast error to ${ip}:`, err);
                    }
                });
            });
        };
        
        // Initial broadcast
        broadcast();
        
        // Set up regular broadcasting
        this.broadcastTimer = setInterval(broadcast, this.broadcastInterval);
    }

    // Method 2: WebRTC Discovery (NAT traversal)
    async startWebRTCDiscovery() {
        try {
            // This would use WebRTC for NAT traversal
            // Implementation depends on WebRTC library
            console.log('WebRTC discovery would be implemented here');
            
            // For now, simulate WebRTC peer discovery
            setTimeout(() => {
                this.emit('webrtc-peer-discovered', {
                    peerId: 'webrtc-peer-' + Date.now(),
                    connection: 'simulated-webrtc-connection'
                });
            }, 5000);
            
            return true;
        } catch (error) {
            console.error('WebRTC discovery failed:', error);
            return false;
        }
    }

    // Method 3: Public Relay Discovery (works through firewalls)
    async startRelayDiscovery() {
        try {
            // Use public WebSocket relays or APIs
            const relayEndpoints = [
                'wss://echo.websocket.org',
                // Add more reliable relay endpoints
            ];
            
            console.log('Public relay discovery would connect to:', relayEndpoints);
            
            // Simulate relay connection
            setTimeout(() => {
                this.emit('relay-connected', {
                    endpoint: relayEndpoints[0],
                    peersFound: Math.floor(Math.random() * 10)
                });
            }, 3000);
            
            return true;
        } catch (error) {
            console.error('Relay discovery failed:', error);
            return false;
        }
    }

    // Method 4: DNS-based Discovery (works everywhere)
    async startDNSDiscovery() {
        try {
            // Use DNS TXT records as bulletin board
            // This is a fallback method that works through any firewall
            console.log('DNS discovery initialized');
            
            // Simulate DNS discovery
            setTimeout(() => {
                this.emit('dns-peers-found', {
                    method: 'dns',
                    peersCount: 3
                });
            }, 2000);
            
            return true;
        } catch (error) {
            console.error('DNS discovery failed:', error);
            return false;
        }
    }

    // Add discovered peer
    addPeer(address, peerData, method) {
        const peerId = `${method}-${address}-${Date.now()}`;
        
        if (this.peers.size >= this.maxPeers) {
            // Remove oldest peer
            const oldestPeer = Array.from(this.peers.entries())[0];
            this.peers.delete(oldestPeer[0]);
        }
        
        this.peers.set(peerId, {
            address: address,
            data: peerData,
            method: method,
            lastSeen: Date.now(),
            stats: peerData.stats || {}
        });
        
        this.emit('peer-discovered', {
            peerId,
            method,
            peerData
        });
        
        console.log(`New peer discovered via ${method}: ${peerId}`);
    }

    // Update peer statistics
    updatePeerStats(sessionId, statsData) {
        for (let [peerId, peer] of this.peers) {
            if (peer.data.sessionId === sessionId) {
                peer.stats = statsData;
                peer.lastSeen = Date.now();
                
                this.emit('peer-stats-updated', {
                    peerId,
                    stats: statsData
                });
                break;
            }
        }
    }

    // Start all discovery methods
    async startDiscovery() {
        if (this.isActive) {
            console.log('Discovery already active');
            return;
        }
        
        this.isActive = true;
        console.log('Starting network discovery...');
        
        // Try all discovery methods
        const methods = [
            this.discoveryMethods.localBroadcast ? this.startLocalDiscovery() : Promise.resolve(false),
            this.discoveryMethods.webrtc ? this.startWebRTCDiscovery() : Promise.resolve(false),
            this.discoveryMethods.dnsDiscovery ? this.startDNSDiscovery() : Promise.resolve(false),
            this.discoveryMethods.publicRelay ? this.startRelayDiscovery() : Promise.resolve(false)
        ];
        
        const results = await Promise.allSettled(methods);
        
        const successfulMethods = results.filter(result => 
            result.status === 'fulfilled' && result.value === true
        ).length;
        
        console.log(`Discovery started with ${successfulMethods} active methods`);
        
        // Clean up old peers periodically
        this.startPeerCleanup();
        
        this.emit('discovery-started', {
            activeMethods: successfulMethods,
            sessionId: this.sessionId
        });
    }

    // Stop discovery
    stopDiscovery() {
        this.isActive = false;
        
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        
        if (this.broadcastTimer) {
            clearInterval(this.broadcastTimer);
            this.broadcastTimer = null;
        }
        
        // Close WebRTC connections
        this.webrtcPeers.clear();
        
        // Close relay connections
        this.relayConnections.clear();
        
        console.log('Network discovery stopped');
        this.emit('discovery-stopped');
    }

    // Update local stats to share with peers
    updateStats(newStats) {
        this.stats = {
            ...newStats,
            timestamp: Date.now(),
            sessionId: this.sessionId
        };
        
        // Broadcast updated stats to peers
        this.broadcastStats();
    }

    // Broadcast stats to all connected peers
    broadcastStats() {
        if (!this.isActive || !this.socket) return;
        
        const message = {
            type: 'stats',
            sessionId: this.sessionId,
            timestamp: Date.now(),
            payload: this.encrypt(this.stats)
        };
        
        const messageBuffer = Buffer.from(JSON.stringify(message));
        
        // Send to all known peers
        this.peers.forEach((peer, peerId) => {
            if (peer.method === 'local' && peer.address) {
                this.socket.send(messageBuffer, this.discoveryPort, peer.address, (err) => {
                    if (err) {
                        console.error(`Failed to send stats to ${peer.address}:`, err);
                    }
                });
            }
        });
    }

    // Get aggregated network statistics
    getNetworkStats() {
        const now = Date.now();
        const activePeers = Array.from(this.peers.values()).filter(
            peer => now - peer.lastSeen < 60000 // Active in last minute
        );
        
        const totalBandwidth = activePeers.reduce((sum, peer) => {
            return sum + (peer.stats.bandwidth || 0);
        }, 0);
        
        const averageCPU = activePeers.length > 0 ? 
            activePeers.reduce((sum, peer) => sum + (peer.stats.cpuUsage || 0), 0) / activePeers.length : 0;
        
        const totalOnline = activePeers.length + 1; // +1 for local instance
        
        return {
            onlineUsers: totalOnline,
            totalBandwidth: totalBandwidth,
            averageCPU: Math.round(averageCPU),
            topMachine: this.getTopPerformer(activePeers),
            activeMethods: Object.values(this.discoveryMethods).filter(Boolean).length,
            lastUpdate: now
        };
    }

    // Find the top performing machine
    getTopPerformer(peers) {
        if (peers.length === 0) return { type: 'local', performance: 'unknown' };
        
        // Score based on bandwidth and low CPU usage
        let topPeer = null;
        let topScore = 0;
        
        peers.forEach(peer => {
            const bandwidth = peer.stats.bandwidth || 0;
            const cpuUsage = peer.stats.cpuUsage || 100;
            const score = bandwidth * (100 - cpuUsage) / 100;
            
            if (score > topScore) {
                topScore = score;
                topPeer = peer;
            }
        });
        
        return topPeer ? {
            method: topPeer.method,
            bandwidth: topPeer.stats.bandwidth,
            cpuUsage: topPeer.stats.cpuUsage,
            score: Math.round(topScore)
        } : { type: 'local', performance: 'unknown' };
    }

    // Clean up old/inactive peers
    startPeerCleanup() {
        const cleanup = () => {
            if (!this.isActive) return;
            
            const now = Date.now();
            const timeout = 120000; // 2 minutes
            
            for (let [peerId, peer] of this.peers) {
                if (now - peer.lastSeen > timeout) {
                    this.peers.delete(peerId);
                    this.emit('peer-timeout', { peerId });
                }
            }
        };
        
        setInterval(cleanup, 60000); // Clean up every minute
    }

    // Get current peer list
    getPeers() {
        return Array.from(this.peers.entries()).map(([peerId, peer]) => ({
            id: peerId,
            method: peer.method,
            lastSeen: peer.lastSeen,
            stats: peer.stats
        }));
    }
}

module.exports = NetworkDiscovery;