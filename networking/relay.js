const crypto = require('crypto');
const { EventEmitter } = require('events');

class FirewallFriendlyRelay extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.sessionId = crypto.randomUUID();
        this.encryptionKey = options.encryptionKey || this.generateKey();
        this.isActive = false;
        
        // Multiple relay strategies for maximum compatibility
        this.relayStrategies = {
            websocket: true,      // WebSocket connections (port 80/443)
            http: true,           // HTTP polling (works everywhere)
            dns: true,            // DNS-based messaging
            publicApi: true       // Public APIs as bulletin boards
        };
        
        this.connections = new Map();
        this.messageQueue = [];
        this.stats = {};
        this.networkStats = {
            onlineUsers: 1,
            totalBandwidth: 0,
            peers: new Map()
        };
        
        // Fallback public endpoints (these work through any firewall)
        this.publicEndpoints = [
            {
                type: 'websocket',
                url: 'wss://echo.websocket.org',
                description: 'WebSocket Echo Service'
            },
            {
                type: 'http',
                url: 'https://httpbin.org/post',
                description: 'HTTP Testing Service'
            },
            {
                type: 'dns',
                url: '8.8.8.8',
                description: 'DNS TXT Record Polling'
            }
        ];
    }

    generateKey() {
        return crypto.randomBytes(32).toString('hex');
    }

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

    // Strategy 1: WebSocket Relay (works through most firewalls)
    async startWebSocketRelay() {
        try {
            // Use existing public WebSocket services as relays
            const WebSocket = require('ws');
            
            this.publicEndpoints.filter(ep => ep.type === 'websocket').forEach(endpoint => {
                try {
                    const ws = new WebSocket(endpoint.url);
                    
                    ws.on('open', () => {
                        console.log(`Connected to WebSocket relay: ${endpoint.description}`);
                        
                        // Announce presence
                        const announcement = {
                            type: 'announce',
                            sessionId: this.sessionId,
                            timestamp: Date.now(),
                            data: this.encrypt({
                                version: '1.0.0',
                                stats: this.stats
                            })
                        };
                        
                        ws.send(JSON.stringify(announcement));
                        
                        this.connections.set(`ws-${endpoint.url}`, ws);
                        this.emit('relay-connected', { type: 'websocket', endpoint: endpoint.url });
                    });
                    
                    ws.on('message', (data) => {
                        this.handleRelayMessage(data.toString(), 'websocket');
                    });
                    
                    ws.on('error', (error) => {
                        console.error(`WebSocket relay error (${endpoint.url}):`, error);
                    });
                    
                    ws.on('close', () => {
                        console.log(`WebSocket relay disconnected: ${endpoint.url}`);
                        this.connections.delete(`ws-${endpoint.url}`);
                    });
                    
                } catch (error) {
                    console.error(`Failed to connect to WebSocket relay ${endpoint.url}:`, error);
                }
            });
            
            return true;
        } catch (error) {
            console.error('WebSocket relay initialization failed:', error);
            return false;
        }
    }

    // Strategy 2: HTTP Polling Relay (works everywhere)
    async startHTTPRelay() {
        try {
            const https = require('https');
            const http = require('http');
            
            // Use HTTP polling for maximum compatibility
            const pollInterval = setInterval(async () => {
                if (!this.isActive) {
                    clearInterval(pollInterval);
                    return;
                }
                
                // Poll each HTTP endpoint
                this.publicEndpoints.filter(ep => ep.type === 'http').forEach(async (endpoint) => {
                    try {
                        await this.httpPoll(endpoint.url);
                    } catch (error) {
                        console.error(`HTTP polling error (${endpoint.url}):`, error);
                    }
                });
                
            }, 30000); // Poll every 30 seconds
            
            this.connections.set('http-poller', pollInterval);
            console.log('HTTP polling relay started');
            
            return true;
        } catch (error) {
            console.error('HTTP relay initialization failed:', error);
            return false;
        }
    }

    // HTTP polling implementation
    async httpPoll(url) {
        return new Promise((resolve, reject) => {
            const https = require('https');
            
            const postData = JSON.stringify({
                type: 'poll',
                sessionId: this.sessionId,
                timestamp: Date.now(),
                data: this.encrypt(this.stats)
            });
            
            const options = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData),
                    'User-Agent': 'MKenyaTool/1.0'
                }
            };
            
            const req = https.request(url, options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        // Check if response contains peer data
                        if (data.includes('mkenya') || data.includes(this.sessionId)) {
                            this.handleRelayMessage(data, 'http');
                        }
                        resolve(data);
                    } catch (error) {
                        reject(error);
                    }
                });
            });
            
            req.on('error', reject);
            req.write(postData);
            req.end();
        });
    }

    // Strategy 3: DNS-based Messaging (ultimate fallback)
    async startDNSRelay() {
        try {
            const dns = require('dns');
            
            // Use DNS TXT records as a bulletin board
            // This works through ANY network configuration
            const dnsInterval = setInterval(() => {
                if (!this.isActive) {
                    clearInterval(dnsInterval);
                    return;
                }
                
                // Query specific domains for TXT records containing peer data
                const domains = [
                    '_mkenya.example.com',  // You'd register these domains
                    '_peer.mkenyatool.net'
                ];
                
                domains.forEach(domain => {
                    dns.resolveTxt(domain, (err, records) => {
                        if (!err && records) {
                            records.forEach(record => {
                                const text = record.join('');
                                if (text.startsWith('mkenya:')) {
                                    this.handleRelayMessage(text.substring(7), 'dns');
                                }
                            });
                        }
                    });
                });
                
            }, 60000); // Check DNS every minute
            
            this.connections.set('dns-poller', dnsInterval);
            console.log('DNS relay started');
            
            return true;
        } catch (error) {
            console.error('DNS relay initialization failed:', error);
            return false;
        }
    }

    // Strategy 4: Public API Bulletin Board (GitHub Gists, Pastebin, etc.)
    async startPublicAPIRelay() {
        try {
            // Use public APIs as encrypted bulletin boards
            // This is the most firewall-friendly approach
            
            const apiInterval = setInterval(async () => {
                if (!this.isActive) {
                    clearInterval(apiInterval);
                    return;
                }
                
                // Post encrypted data to public APIs
                await this.postToBulletinBoard();
                
                // Read from bulletin boards
                await this.readFromBulletinBoard();
                
            }, 45000); // Update every 45 seconds
            
            this.connections.set('api-poller', apiInterval);
            console.log('Public API relay started');
            
            return true;
        } catch (error) {
            console.error('Public API relay initialization failed:', error);
            return false;
        }
    }

    // Post to bulletin board (simulation - you'd implement real APIs)
    async postToBulletinBoard() {
        try {
            const payload = {
                id: this.sessionId,
                timestamp: Date.now(),
                data: this.encrypt(this.stats),
                ttl: Date.now() + 300000 // 5 minute TTL
            };
            
            // In real implementation, post to:
            // - GitHub Gists (anonymous)
            // - Pastebin
            // - Any public storage API
            
            console.log('Posted to bulletin board:', payload.id);
            
            this.emit('bulletin-posted', { sessionId: this.sessionId, timestamp: payload.timestamp });
            
        } catch (error) {
            console.error('Failed to post to bulletin board:', error);
        }
    }

    // Read from bulletin board
    async readFromBulletinBoard() {
        try {
            // In real implementation, read from public APIs
            // Parse encrypted payloads
            // Update peer information
            
            // Simulate finding peer data
            const simulatedPeerData = {
                sessionId: 'peer-' + Date.now(),
                stats: {
                    bandwidth: Math.floor(Math.random() * 1000),
                    cpuUsage: Math.floor(Math.random() * 100),
                    onlineUsers: Math.floor(Math.random() * 10)
                }
            };
            
            this.updateNetworkStats(simulatedPeerData);
            
        } catch (error) {
            console.error('Failed to read from bulletin board:', error);
        }
    }

    // Handle messages from any relay
    handleRelayMessage(message, relayType) {
        try {
            let data;
            
            if (typeof message === 'string') {
                try {
                    data = JSON.parse(message);
                } catch {
                    // Try to decrypt directly
                    data = this.decrypt(message);
                }
            } else {
                data = message;
            }
            
            if (data && data.sessionId && data.sessionId !== this.sessionId) {
                const peerStats = data.data || data.stats;
                if (peerStats) {
                    this.updateNetworkStats({
                        sessionId: data.sessionId,
                        stats: peerStats,
                        relayType: relayType,
                        lastSeen: Date.now()
                    });
                }
            }
            
        } catch (error) {
            console.error('Error handling relay message:', error);
        }
    }

    // Update network statistics
    updateNetworkStats(peerData) {
        this.networkStats.peers.set(peerData.sessionId, {
            ...peerData,
            lastSeen: Date.now()
        });
        
        // Clean old peers (older than 5 minutes)
        const now = Date.now();
        for (let [sessionId, peer] of this.networkStats.peers) {
            if (now - peer.lastSeen > 300000) {
                this.networkStats.peers.delete(sessionId);
            }
        }
        
        // Calculate aggregate stats
        const activePeers = Array.from(this.networkStats.peers.values());
        this.networkStats.onlineUsers = activePeers.length + 1; // +1 for local
        this.networkStats.totalBandwidth = activePeers.reduce((sum, peer) => {
            return sum + (peer.stats?.bandwidth || 0);
        }, this.stats.bandwidth || 0);
        
        this.emit('network-stats-updated', this.networkStats);
    }

    // Start all relay strategies
    async startRelay() {
        if (this.isActive) {
            console.log('Relay already active');
            return;
        }
        
        this.isActive = true;
        console.log('Starting firewall-friendly relay...');
        
        // Try all relay strategies simultaneously
        const strategies = [];
        
        if (this.relayStrategies.websocket) {
            strategies.push(this.startWebSocketRelay());
        }
        if (this.relayStrategies.http) {
            strategies.push(this.startHTTPRelay());
        }
        if (this.relayStrategies.dns) {
            strategies.push(this.startDNSRelay());
        }
        if (this.relayStrategies.publicApi) {
            strategies.push(this.startPublicAPIRelay());
        }
        
        const results = await Promise.allSettled(strategies);
        const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
        
        console.log(`Relay started with ${successful}/${strategies.length} active strategies`);
        
        this.emit('relay-started', {
            activeStrategies: successful,
            totalStrategies: strategies.length,
            sessionId: this.sessionId
        });
    }

    // Stop relay
    stopRelay() {
        this.isActive = false;
        
        // Close all connections
        this.connections.forEach((connection, key) => {
            if (typeof connection === 'object' && connection.close) {
                connection.close();
            } else if (typeof connection === 'object' && connection.constructor.name === 'Timeout') {
                clearInterval(connection);
            }
        });
        
        this.connections.clear();
        console.log('Firewall-friendly relay stopped');
        
        this.emit('relay-stopped');
    }

    // Update local stats
    updateStats(newStats) {
        this.stats = {
            ...newStats,
            timestamp: Date.now(),
            sessionId: this.sessionId
        };
        
        // Broadcast to all active relays
        this.broadcastStats();
    }

    // Broadcast stats through all active relays
    broadcastStats() {
        if (!this.isActive) return;
        
        const message = {
            type: 'stats-update',
            sessionId: this.sessionId,
            timestamp: Date.now(),
            data: this.encrypt(this.stats)
        };
        
        // Send through WebSocket connections
        this.connections.forEach((connection, key) => {
            if (key.startsWith('ws-') && connection.readyState === 1) {
                connection.send(JSON.stringify(message));
            }
        });
        
        // Note: HTTP and DNS broadcasting happens on their respective intervals
    }

    // Get current network statistics
    getNetworkStats() {
        const activePeers = Array.from(this.networkStats.peers.values());
        
        // Find top performer
        let topMachine = { type: 'local', performance: 'unknown' };
        if (activePeers.length > 0) {
            topMachine = activePeers.reduce((best, peer) => {
                const peerScore = (peer.stats?.bandwidth || 0) * (100 - (peer.stats?.cpuUsage || 100)) / 100;
                const bestScore = (best.stats?.bandwidth || 0) * (100 - (best.stats?.cpuUsage || 100)) / 100;
                return peerScore > bestScore ? peer : best;
            });
            
            topMachine = {
                relayType: topMachine.relayType,
                bandwidth: topMachine.stats?.bandwidth || 0,
                cpuUsage: topMachine.stats?.cpuUsage || 0,
                score: Math.round((topMachine.stats?.bandwidth || 0) * (100 - (topMachine.stats?.cpuUsage || 100)) / 100)
            };
        }
        
        return {
            onlineUsers: this.networkStats.onlineUsers,
            totalBandwidth: this.networkStats.totalBandwidth,
            averageCPU: activePeers.length > 0 ? 
                Math.round(activePeers.reduce((sum, peer) => sum + (peer.stats?.cpuUsage || 0), 0) / activePeers.length) : 0,
            topMachine: topMachine,
            activeConnections: this.connections.size,
            relayMethods: Array.from(this.connections.keys()).map(key => key.split('-')[0]),
            lastUpdate: Date.now()
        };
    }

    // Get connection status
    getConnectionStatus() {
        const status = {
            isActive: this.isActive,
            totalConnections: this.connections.size,
            strategies: {
                websocket: 0,
                http: 0,
                dns: 0,
                api: 0
            },
            peers: this.networkStats.peers.size,
            lastActivity: Date.now()
        };
        
        // Count connections by type
        this.connections.forEach((connection, key) => {
            const type = key.split('-')[0];
            if (status.strategies.hasOwnProperty(type)) {
                status.strategies[type]++;
            }
        });
        
        return status;
    }

    // Test connectivity through different strategies
    async testConnectivity() {
        const tests = {
            websocket: false,
            http: false,
            dns: false,
            api: false
        };
        
        // Test WebSocket
        try {
            const WebSocket = require('ws');
            const testWs = new WebSocket('wss://echo.websocket.org');
            tests.websocket = await new Promise((resolve) => {
                const timeout = setTimeout(() => resolve(false), 5000);
                testWs.on('open', () => {
                    clearTimeout(timeout);
                    testWs.close();
                    resolve(true);
                });
                testWs.on('error', () => {
                    clearTimeout(timeout);
                    resolve(false);
                });
            });
        } catch (error) {
            tests.websocket = false;
        }
        
        // Test HTTP
        try {
            const https = require('https');
            tests.http = await new Promise((resolve) => {
                const req = https.get('https://httpbin.org/get', { timeout: 5000 }, (res) => {
                    resolve(res.statusCode === 200);
                });
                req.on('error', () => resolve(false));
                req.on('timeout', () => resolve(false));
            });
        } catch (error) {
            tests.http = false;
        }
        
        // Test DNS
        try {
            const dns = require('dns');
            tests.dns = await new Promise((resolve) => {
                dns.resolve('google.com', (err) => {
                    resolve(!err);
                });
            });
        } catch (error) {
            tests.dns = false;
        }
        
        // API test (always true for simulation)
        tests.api = true;
        
        return tests;
    }

    // Emergency fallback mode (works in most restrictive environments)
    async enableEmergencyMode() {
        console.log('Enabling emergency fallback mode...');
        
        // Disable resource-intensive strategies
        this.relayStrategies.websocket = false;
        this.relayStrategies.http = true;  // Keep HTTP polling
        this.relayStrategies.dns = true;   // Keep DNS
        this.relayStrategies.publicApi = true; // Keep API
        
        // Reduce update frequencies
        const emergencyConnections = new Map();
        
        // HTTP polling every 2 minutes
        const httpInterval = setInterval(async () => {
            if (!this.isActive) {
                clearInterval(httpInterval);
                return;
            }
            await this.httpPoll('https://httpbin.org/post');
        }, 120000);
        
        emergencyConnections.set('emergency-http', httpInterval);
        
        // DNS polling every 5 minutes
        const dnsInterval = setInterval(() => {
            if (!this.isActive) {
                clearInterval(dnsInterval);
                return;
            }
            // Simplified DNS check
            console.log('Emergency DNS check...');
        }, 300000);
        
        emergencyConnections.set('emergency-dns', dnsInterval);
        
        this.connections = emergencyConnections;
        
        this.emit('emergency-mode-enabled', {
            activeStrategies: ['http', 'dns'],
            updateInterval: 120000
        });
        
        console.log('Emergency mode enabled - reduced functionality for maximum compatibility');
    }

    // Get peer list
    getPeerList() {
        return Array.from(this.networkStats.peers.entries()).map(([sessionId, peer]) => ({
            sessionId,
            relayType: peer.relayType,
            stats: peer.stats,
            lastSeen: peer.lastSeen,
            isActive: Date.now() - peer.lastSeen < 120000 // Active in last 2 minutes
        }));
    }

    // Manual peer discovery (for testing)
    async discoverPeersManually() {
        console.log('Starting manual peer discovery...');
        
        // Simulate finding peers through various methods
        const simulatedPeers = [
            {
                sessionId: 'manual-peer-1',
                relayType: 'websocket',
                stats: {
                    bandwidth: 500,
                    cpuUsage: 25,
                    attackType: 'Layer7-GET',
                    target: 'test-target'
                }
            },
            {
                sessionId: 'manual-peer-2',
                relayType: 'http',
                stats: {
                    bandwidth: 750,
                    cpuUsage: 45,
                    attackType: 'Layer4-TCP',
                    target: 'test-target'
                }
            }
        ];
        
        simulatedPeers.forEach(peer => {
            this.updateNetworkStats(peer);
        });
        
        this.emit('manual-discovery-complete', {
            peersFound: simulatedPeers.length,
            totalPeers: this.networkStats.peers.size
        });
        
        return simulatedPeers;
    }
}

module.exports = FirewallFriendlyRelay;