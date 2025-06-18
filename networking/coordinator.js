const NetworkDiscovery = require('./discovery.js');
const FirewallFriendlyRelay = require('./relay.js');
const crypto = require('crypto');
const { EventEmitter } = require('events');

class NetworkCoordinator extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.sessionId = crypto.randomUUID();
        this.encryptionKey = options.encryptionKey || this.generateSharedKey();
        
        // Initialize discovery and relay systems
        this.localDiscovery = new NetworkDiscovery({ 
            encryptionKey: this.encryptionKey,
            port: options.discoveryPort || 33445
        });
        
        this.firewallRelay = new FirewallFriendlyRelay({
            encryptionKey: this.encryptionKey
        });
        
        this.isActive = false;
        this.stats = {
            bandwidth: 0,
            cpuUsage: 0,
            memoryUsage: 0,
            attackType: 'none',
            targetHash: '',
            onlineUsers: 1,
            performance: 'unknown'
        };
        
        this.networkStats = {
            totalOnlineUsers: 1,
            totalBandwidth: 0,
            averageCPU: 0,
            topMachine: { type: 'local' },
            activeMethods: 0,
            lastUpdate: Date.now()
        };
        
        this.setupEventHandlers();
    }

    generateSharedKey() {
        // Generate a shared key based on app signature
        // This allows all MKenya Tool instances to communicate
        const appSignature = 'mkenyatool-network-v1.0';
        return crypto.createHash('sha256').update(appSignature).digest('hex');
    }

    setupEventHandlers() {
        // Local Discovery Events
        this.localDiscovery.on('peer-discovered', (data) => {
            console.log(`Local peer discovered: ${data.peerId} via ${data.method}`);
            this.emit('peer-discovered', { ...data, source: 'local' });
            this.updateNetworkStats();
        });

        this.localDiscovery.on('peer-stats-updated', (data) => {
            this.emit('peer-stats-updated', { ...data, source: 'local' });
            this.updateNetworkStats();
        });

        this.localDiscovery.on('discovery-started', (data) => {
            console.log('Local discovery started');
            this.emit('local-discovery-ready', data);
        });

        // Firewall Relay Events
        this.firewallRelay.on('relay-connected', (data) => {
            console.log(`Firewall relay connected: ${data.type} - ${data.endpoint}`);
            this.emit('relay-connected', data);
        });

        this.firewallRelay.on('network-stats-updated', (data) => {
            this.emit('network-stats-updated', { ...data, source: 'relay' });
            this.updateNetworkStats();
        });

        this.firewallRelay.on('relay-started', (data) => {
            console.log('Firewall relay started');
            this.emit('relay-ready', data);
        });

        this.firewallRelay.on('emergency-mode-enabled', (data) => {
            console.log('Emergency mode enabled for maximum compatibility');
            this.emit('emergency-mode', data);
        });
    }

    // Start complete networking system
    async startNetworking(options = {}) {
        if (this.isActive) {
            console.log('Networking already active');
            return this.getNetworkStatus();
        }

        this.isActive = true;
        console.log('Starting MKenya Tool networking...');

        const results = {
            localDiscovery: false,
            firewallRelay: false,
            emergencyMode: false
        };

        try {
            // Start local discovery first (fastest)
            if (options.enableLocalDiscovery !== false) {
                try {
                    await this.localDiscovery.startDiscovery();
                    results.localDiscovery = true;
                    console.log('✅ Local discovery active');
                } catch (error) {
                    console.error('❌ Local discovery failed:', error.message);
                }
            }

            // Start firewall-friendly relay system
            if (options.enableRelay !== false) {
                try {
                    await this.firewallRelay.startRelay();
                    results.firewallRelay = true;
                    console.log('✅ Firewall relay active');
                } catch (error) {
                    console.error('❌ Firewall relay failed:', error.message);
                }
            }

            // If both fail, enable emergency mode
            if (!results.localDiscovery && !results.firewallRelay) {
                console.log('⚠️ Enabling emergency mode...');
                await this.firewallRelay.enableEmergencyMode();
                results.emergencyMode = true;
            }

            // Start stats broadcasting
            this.startStatsBroadcast();

            const status = this.getNetworkStatus();
            this.emit('networking-started', { ...status, results });

            console.log(`🚀 Networking started with ${Object.values(results).filter(Boolean).length}/3 methods active`);
            return status;

        } catch (error) {
            console.error('Failed to start networking:', error);
            this.isActive = false;
            throw error;
        }
    }

    // Stop networking
    async stopNetworking() {
        if (!this.isActive) return;

        this.isActive = false;
        console.log('Stopping MKenya Tool networking...');

        try {
            await this.localDiscovery.stopDiscovery();
            await this.firewallRelay.stopRelay();
            
            this.emit('networking-stopped');
            console.log('🛑 Networking stopped');
        } catch (error) {
            console.error('Error stopping networking:', error);
        }
    }

    // Update local statistics
    updateLocalStats(newStats) {
        this.stats = {
            ...this.stats,
            ...newStats,
            timestamp: Date.now(),
            sessionId: this.sessionId
        };

        // Broadcast to both discovery systems
        if (this.isActive) {
            this.localDiscovery.updateStats(this.stats);
            this.firewallRelay.updateStats(this.stats);
        }

        this.updateNetworkStats();
        this.emit('local-stats-updated', this.stats);
    }

    // Update aggregated network statistics
    updateNetworkStats() {
        try {
            const localStats = this.localDiscovery.getNetworkStats();
            const relayStats = this.firewallRelay.getNetworkStats();

            // Combine stats from both sources
            this.networkStats = {
                totalOnlineUsers: Math.max(localStats.onlineUsers, relayStats.onlineUsers),
                totalBandwidth: localStats.totalBandwidth + relayStats.totalBandwidth,
                averageCPU: Math.round((localStats.averageCPU + relayStats.averageCPU) / 2),
                topMachine: this.selectTopMachine(localStats.topMachine, relayStats.topMachine),
                activeMethods: localStats.activeMethods + relayStats.activeConnections,
                lastUpdate: Date.now(),
                sources: {
                    local: localStats,
                    relay: relayStats
                }
            };

            this.emit('aggregated-stats-updated', this.networkStats);
        } catch (error) {
            console.error('Error updating network stats:', error);
        }
    }

    // Select the best performing machine
    selectTopMachine(localTop, relayTop) {
        const localScore = this.calculateMachineScore(localTop);
        const relayScore = this.calculateMachineScore(relayTop);

        return localScore >= relayScore ? localTop : relayTop;
    }

    // Calculate machine performance score
    calculateMachineScore(machine) {
        if (!machine || machine.type === 'local') return 0;
        
        const bandwidth = machine.bandwidth || 0;
        const cpuUsage = machine.cpuUsage || 100;
        return bandwidth * (100 - cpuUsage) / 100;
    }

    // Start broadcasting stats periodically
    startStatsBroadcast() {
        const broadcastInterval = setInterval(() => {
            if (!this.isActive) {
                clearInterval(broadcastInterval);
                return;
            }

            // Update stats with current performance
            this.broadcastCurrentStats();
        }, 30000); // Broadcast every 30 seconds

        this.broadcastInterval = broadcastInterval;
    }

    // Broadcast current statistics
    broadcastCurrentStats() {
        const currentStats = {
            ...this.stats,
            timestamp: Date.now(),
            version: '1.0.0'
        };

        this.updateLocalStats(currentStats);
    }

    // Get comprehensive network status
    getNetworkStatus() {
        const localPeers = this.localDiscovery.getPeers();
        const relayPeers = this.firewallRelay.getPeerList();
        const relayStatus = this.firewallRelay.getConnectionStatus();

        return {
            isActive: this.isActive,
            sessionId: this.sessionId,
            stats: this.networkStats,
            connections: {
                local: {
                    active: localPeers.length > 0,
                    peers: localPeers.length,
                    methods: localPeers.map(p => p.method)
                },
                relay: {
                    active: relayStatus.isActive,
                    connections: relayStatus.totalConnections,
                    peers: relayPeers.length,
                    strategies: relayStatus.strategies
                }
            },
            totalPeers: localPeers.length + relayPeers.length,
            lastUpdate: Date.now()
        };
    }

    // Get detailed peer information
    getPeerDetails() {
        const localPeers = this.localDiscovery.getPeers().map(peer => ({
            ...peer,
            source: 'local',
            connection: 'direct'
        }));

        const relayPeers = this.firewallRelay.getPeerList().map(peer => ({
            ...peer,
            source: 'relay',
            connection: 'relay'
        }));

        return {
            local: localPeers,
            relay: relayPeers,
            total: localPeers.length + relayPeers.length,
            active: [...localPeers, ...relayPeers].filter(p => p.isActive !== false).length
        };
    }

    // Test network connectivity
    async testConnectivity() {
        console.log('Testing network connectivity...');

        const tests = {
            local: false,
            relay: false,
            connectivity: await this.firewallRelay.testConnectivity()
        };

        // Test local discovery
        try {
            const localStatus = this.localDiscovery.getNetworkStats();
            tests.local = localStatus.onlineUsers > 1; // Found other peers
        } catch (error) {
            tests.local = false;
        }

        // Test relay system
        try {
            const relayStatus = this.firewallRelay.getConnectionStatus();
            tests.relay = relayStatus.totalConnections > 0;
        } catch (error) {
            tests.relay = false;
        }

        this.emit('connectivity-tested', tests);
        return tests;
    }

    // Manual peer discovery
    async discoverPeers() {
        console.log('Starting manual peer discovery...');

        const results = {
            local: [],
            relay: []
        };

        try {
            // Trigger manual discovery on both systems
            results.relay = await this.firewallRelay.discoverPeersManually();
            
            this.emit('manual-discovery-complete', {
                totalFound: results.local.length + results.relay.length,
                sources: results
            });

            return results;
        } catch (error) {
            console.error('Manual discovery failed:', error);
            return results;
        }
    }

    // Export network data
    exportNetworkData() {
        return {
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId,
            networkStats: this.networkStats,
            localStats: this.stats,
            peers: this.getPeerDetails(),
            status: this.getNetworkStatus(),
            connectivity: this.isActive
        };
    }

    // Get recommendations for network optimization
    getNetworkOptimizations() {
        const status = this.getNetworkStatus();
        const recommendations = [];

        if (status.totalPeers === 0) {
            recommendations.push({
                type: 'connectivity',
                level: 'high',
                message: 'No peers found. Try enabling emergency mode or check firewall settings.'
            });
        }

        if (this.networkStats.totalBandwidth < 100) {
            recommendations.push({
                type: 'performance',
                level: 'medium',
                message: 'Low total bandwidth detected. Consider coordinating with more peers.'
            });
        }

        if (this.networkStats.averageCPU > 80) {
            recommendations.push({
                type: 'performance',
                level: 'high',
                message: 'High average CPU usage across network. Consider reducing attack intensity.'
            });
        }

        if (!status.connections.local.active && !status.connections.relay.active) {
            recommendations.push({
                type: 'connectivity',
                level: 'critical',
                message: 'No active connections. Network coordination is not available.'
            });
        }

        if (recommendations.length === 0) {
            recommendations.push({
                type: 'status',
                level: 'good',
                message: 'Network coordination is working optimally.'
            });
        }

        return recommendations;
    }

    // Clean up resources
    cleanup() {
        if (this.broadcastInterval) {
            clearInterval(this.broadcastInterval);
        }
        
        this.stopNetworking();
        this.removeAllListeners();
    }
}

module.exports = NetworkCoordinator;