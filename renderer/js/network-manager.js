// Network Manager - Handles networking, peer management, and coordination
class NetworkManager {
    constructor() {
        this.networkStatus = {
            isOnline: false,
            totalPeers: 0,
            activeMethods: 0,
            totalBandwidth: 0,
            connectionQuality: 'unknown',
            lastUpdate: null
        };
        this.peers = new Map();
        this.connectionTests = [];
        this.networkOptimizations = [];
        this.isNetworking = false;
        this.reconnectInterval = null;
        this.statsUpdateInterval = null;
        
        this.init();
    }

    async init() {
        this.setupNetworkEventListeners();
        this.startNetworkMonitoring();
        await this.initializeNetworkStatus();
    }

    setupNetworkEventListeners() {
        // Network status events
        const networkStartedUnsubscribe = window.electronAPI.onNetworkingStarted((data) => {
            this.handleNetworkingStarted(data);
        });

        // Peer discovery events
        const peerDiscoveredUnsubscribe = window.electronAPI.onPeerDiscovered((data) => {
            this.handlePeerDiscovered(data);
        });

        // Network stats updates
        const networkStatsUnsubscribe = window.electronAPI.onNetworkStatsUpdated((data) => {
            this.handleNetworkStatsUpdate(data);
        });

        // Relay connection events
        const relayConnectedUnsubscribe = window.electronAPI.onRelayConnected((data) => {
            this.handleRelayConnected(data);
        });

        // Store unsubscribe functions for cleanup
        this.unsubscribeFunctions = [
            networkStartedUnsubscribe,
            peerDiscoveredUnsubscribe,
            networkStatsUnsubscribe,
            relayConnectedUnsubscribe
        ];

        // Browser network status
        window.addEventListener('online', () => {
            this.handleBrowserNetworkChange(true);
        });

        window.addEventListener('offline', () => {
            this.handleBrowserNetworkChange(false);
        });
    }

    async initializeNetworkStatus() {
        try {
            const response = await window.electronAPI.getNetworkStats();
            if (response.success) {
                this.updateNetworkStatus(response.data);
            }
        } catch (error) {
            console.warn('Failed to initialize network status:', error);
        }
    }

    startNetworkMonitoring() {
        // Update network stats every 3 seconds
        this.statsUpdateInterval = setInterval(async () => {
            await this.updateNetworkStats();
        }, 3000);

        // Check connection quality every 10 seconds
        setInterval(async () => {
            await this.checkConnectionQuality();
        }, 10000);
    }

    // Network control methods
    async startNetworking() {
        try {
            const response = await window.electronAPI.startNetworking();
            
            if (response.success) {
                this.isNetworking = true;
                this.updateNetworkStatus(response.data);
                this.showNetworkNotification('Networking started successfully', 'success');
                return response.data;
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            this.showNetworkNotification(`Failed to start networking: ${error.message}`, 'error');
            throw error;
        }
    }

    async stopNetworking() {
        try {
            const response = await window.electronAPI.stopNetworking();
            
            if (response.success) {
                this.isNetworking = false;
                this.networkStatus.isOnline = false;
                this.peers.clear();
                this.updateNetworkDisplay();
                this.showNetworkNotification('Networking stopped', 'info');
                return true;
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            this.showNetworkNotification(`Failed to stop networking: ${error.message}`, 'error');
            throw error;
        }
    }

    async discoverPeers() {
        try {
            this.showNetworkNotification('Discovering peers...', 'info');
            const response = await window.electronAPI.discoverPeers();
            
            if (response.success) {
                const peers = response.data;
                this.showNetworkNotification(`Discovered ${peers.length} peers`, 'success');
                
                // Update peer list
                peers.forEach(peer => {
                    this.addOrUpdatePeer(peer);
                });
                
                return peers;
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            this.showNetworkNotification(`Peer discovery failed: ${error.message}`, 'error');
            throw error;
        }
    }

    async testConnectivity() {
        try {
            this.showNetworkNotification('Testing connectivity...', 'info');
            const response = await window.electronAPI.testConnectivity();
            
            if (response.success) {
                this.connectionTests = response.data;
                this.analyzeConnectivityResults(response.data);
                this.showNetworkNotification('Connectivity test completed', 'success');
                return response.data;
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            this.showNetworkNotification(`Connectivity test failed: ${error.message}`, 'error');
            throw error;
        }
    }

    async getNetworkOptimizations() {
        try {
            const response = await window.electronAPI.getNetworkOptimizations();
            
            if (response.success) {
                this.networkOptimizations = response.data;
                return response.data;
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.warn('Failed to get network optimizations:', error);
            return [];
        }
    }

    // Event handlers
    handleNetworkingStarted(data) {
        this.isNetworking = true;
        this.updateNetworkStatus(data);
        this.showNetworkNotification('Network coordination started', 'success');
        
        // Start auto-discovery
        setTimeout(() => {
            this.discoverPeers().catch(console.warn);
        }, 2000);
    }

    handlePeerDiscovered(data) {
        this.addOrUpdatePeer(data);
        this.showNetworkNotification(`New peer discovered: ${data.id || 'Unknown'}`, 'info');
    }

    handleNetworkStatsUpdate(data) {
        this.updateNetworkStatus(data);
    }

    handleRelayConnected(data) {
        this.showNetworkNotification(`Connected to relay: ${data.relay}`, 'success');
    }

    handleBrowserNetworkChange(isOnline) {
        if (!isOnline) {
            this.networkStatus.isOnline = false;
            this.networkStatus.connectionQuality = 'offline';
            this.updateNetworkDisplay();
            this.showNetworkNotification('Internet connection lost', 'warning');
            
            // Try to reconnect when back online
            this.scheduleReconnect();
        } else {
            this.showNetworkNotification('Internet connection restored', 'success');
            this.cancelReconnect();
            
            // Restart networking if it was active
            if (this.isNetworking) {
                setTimeout(() => {
                    this.startNetworking().catch(console.warn);
                }, 1000);
            }
        }
    }

    // Peer management
    addOrUpdatePeer(peerData) {
        const peer = {
            id: peerData.id,
            address: peerData.address,
            capabilities: peerData.capabilities || [],
            bandwidth: peerData.bandwidth || 0,
            latency: peerData.latency || 0,
            status: peerData.status || 'unknown',
            lastSeen: Date.now(),
            ...peerData
        };

        this.peers.set(peer.id, peer);
        this.updateNetworkStats();
        this.updatePeerDisplay();
    }

    removePeer(peerId) {
        if (this.peers.has(peerId)) {
            this.peers.delete(peerId);
            this.updateNetworkStats();
            this.updatePeerDisplay();
        }
    }

    getPeerById(peerId) {
        return this.peers.get(peerId);
    }

    getActivePeers() {
        const now = Date.now();
        const timeout = 30000; // 30 seconds
        
        return Array.from(this.peers.values()).filter(peer => 
            (now - peer.lastSeen) < timeout && peer.status === 'active'
        );
    }

    getBestPeers(count = 5) {
        return this.getActivePeers()
            .sort((a, b) => {
                // Sort by bandwidth (descending) then latency (ascending)
                const bandwidthDiff = (b.bandwidth || 0) - (a.bandwidth || 0);
                if (bandwidthDiff !== 0) return bandwidthDiff;
                return (a.latency || 999) - (b.latency || 999);
            })
            .slice(0, count);
    }

    // Network statistics and monitoring
    async updateNetworkStats() {
        try {
            const response = await window.electronAPI.getNetworkStats();
            if (response.success) {
                this.updateNetworkStatus(response.data);
            }
        } catch (error) {
            console.warn('Failed to update network stats:', error);
        }
    }

    updateNetworkStatus(data) {
        this.networkStatus = {
            ...this.networkStatus,
            ...data,
            lastUpdate: Date.now()
        };

        this.updateNetworkDisplay();
    }

    updateNetworkDisplay() {
        // Update main network indicators
        const networkIndicator = document.getElementById('network-indicator');
        const networkText = document.getElementById('network-text');
        
        if (networkIndicator && networkText) {
            const isOnline = this.networkStatus.isOnline && navigator.onLine;
            
            networkIndicator.className = 'w-2 h-2 rounded-full';
            
            if (isOnline) {
                networkIndicator.classList.add('bg-green-500', 'animate-pulse');
                networkText.textContent = 'Online';
                networkText.className = 'text-green-400';
            } else {
                networkIndicator.classList.add('bg-red-500');
                networkText.textContent = 'Offline';
                networkText.className = 'text-red-400';
            }
        }

        // Update quick stats
        this.updateQuickStat('network-peers', this.networkStatus.totalPeers || this.peers.size);
        this.updateQuickStat('net-status', this.networkStatus.isOnline ? 'Online' : 'Offline');
        this.updateQuickStat('net-peers', this.peers.size);
        this.updateQuickStat('net-methods', this.networkStatus.activeMethods || 0);

        // Update network activity tab
        this.updateNetworkActivityDisplay();
    }

    updateNetworkActivityDisplay() {
        const networkActivity = document.getElementById('network-activity');
        if (!networkActivity) return;

        const peers = this.getActivePeers();
        
        if (peers.length === 0) {
            networkActivity.innerHTML = `
                <div class="text-center text-gray-400 py-8">
                    <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"/>
                    </svg>
                    <p>No network activity</p>
                    <p class="text-sm">Start networking to see peer connections</p>
                </div>
            `;
            return;
        }

        networkActivity.innerHTML = peers.map(peer => this.createPeerCard(peer)).join('');
    }

    createPeerCard(peer) {
        const statusColor = this.getPeerStatusColor(peer.status);
        const bandwidth = this.formatBytes(peer.bandwidth || 0);
        const latency = peer.latency ? `${peer.latency}ms` : 'Unknown';
        
        return `
            <div class="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h4 class="font-medium text-white">${peer.id || 'Unknown Peer'}</h4>
                        <p class="text-sm text-gray-400">${peer.address || 'Unknown Address'}</p>
                    </div>
                    <span class="px-2 py-1 rounded-full text-xs ${statusColor}">${peer.status || 'unknown'}</span>
                </div>
                
                <div class="grid grid-cols-2 gap-2 text-sm">
                    <div>
                        <span class="text-gray-400">Bandwidth:</span>
                        <span class="text-white ml-1">${bandwidth}/s</span>
                    </div>
                    <div>
                        <span class="text-gray-400">Latency:</span>
                        <span class="text-white ml-1">${latency}</span>
                    </div>
                </div>
                
                ${peer.capabilities && peer.capabilities.length > 0 ? `
                    <div class="mt-2">
                        <span class="text-gray-400 text-xs">Capabilities:</span>
                        <div class="flex flex-wrap gap-1 mt-1">
                            ${peer.capabilities.map(cap => `
                                <span class="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">${cap}</span>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    getPeerStatusColor(status) {
        switch (status) {
            case 'active':
                return 'bg-green-500/20 text-green-400';
            case 'connecting':
                return 'bg-yellow-500/20 text-yellow-400';
            case 'disconnected':
                return 'bg-red-500/20 text-red-400';
            default:
                return 'bg-gray-500/20 text-gray-400';
        }
    }

    // Connection quality monitoring
    async checkConnectionQuality() {
        if (!this.networkStatus.isOnline || !navigator.onLine) {
            this.networkStatus.connectionQuality = 'offline';
            return;
        }

        try {
            const startTime = performance.now();
            const response = await fetch('https://1.1.1.1/cdn-cgi/trace', {
                method: 'GET',
                cache: 'no-cache'
            });
            const endTime = performance.now();
            const latency = endTime - startTime;

            if (response.ok) {
                if (latency < 100) {
                    this.networkStatus.connectionQuality = 'excellent';
                } else if (latency < 300) {
                    this.networkStatus.connectionQuality = 'good';
                } else if (latency < 1000) {
                    this.networkStatus.connectionQuality = 'fair';
                } else {
                    this.networkStatus.connectionQuality = 'poor';
                }
            } else {
                this.networkStatus.connectionQuality = 'poor';
            }
        } catch (error) {
            this.networkStatus.connectionQuality = 'poor';
        }

        this.updateNetworkDisplay();
    }

    // Connectivity analysis
    analyzeConnectivityResults(tests) {
        const results = {
            totalTests: tests.length,
            passedTests: 0,
            failedTests: 0,
            averageLatency: 0,
            recommendations: []
        };

        let totalLatency = 0;
        let latencyCount = 0;

        tests.forEach(test => {
            if (test.success) {
                results.passedTests++;
                if (test.latency) {
                    totalLatency += test.latency;
                    latencyCount++;
                }
            } else {
                results.failedTests++;
            }
        });

        if (latencyCount > 0) {
            results.averageLatency = Math.round(totalLatency / latencyCount);
        }

        // Generate recommendations
        if (results.failedTests > results.passedTests) {
            results.recommendations.push('Poor connectivity detected. Check your internet connection.');
        }

        if (results.averageLatency > 500) {
            results.recommendations.push('High latency detected. Consider using a VPN or different network.');
        }

        if (results.passedTests === results.totalTests) {
            results.recommendations.push('Excellent connectivity! All tests passed.');
        }

        // Show results in UI
        this.showConnectivityResults(results);
    }

    showConnectivityResults(results) {
        if (window.uiController) {
            const content = `
                <div class="space-y-4">
                    <div class="grid grid-cols-3 gap-4">
                        <div class="bg-gray-800/50 rounded-lg p-3 text-center">
                            <div class="text-lg font-bold text-white">${results.totalTests}</div>
                            <div class="text-sm text-gray-400">Total Tests</div>
                        </div>
                        <div class="bg-green-500/20 rounded-lg p-3 text-center">
                            <div class="text-lg font-bold text-green-400">${results.passedTests}</div>
                            <div class="text-sm text-gray-400">Passed</div>
                        </div>
                        <div class="bg-red-500/20 rounded-lg p-3 text-center">
                            <div class="text-lg font-bold text-red-400">${results.failedTests}</div>
                            <div class="text-sm text-gray-400">Failed</div>
                        </div>
                    </div>
                    
                    <div class="bg-gray-800/50 rounded-lg p-3">
                        <div class="text-center">
                            <div class="text-lg font-bold text-white">${results.averageLatency}ms</div>
                            <div class="text-sm text-gray-400">Average Latency</div>
                        </div>
                    </div>
                    
                    ${results.recommendations.length > 0 ? `
                        <div>
                            <h4 class="font-semibold text-white mb-2">Recommendations</h4>
                            <div class="space-y-2">
                                ${results.recommendations.map(rec => `
                                    <div class="bg-blue-500/20 rounded-lg p-3 text-blue-400 text-sm">${rec}</div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;

            window.uiController.showModal('Connectivity Test Results', content);
        }
    }

    // Auto-reconnection
    scheduleReconnect() {
        this.cancelReconnect();
        
        this.reconnectInterval = setInterval(async () => {
            if (navigator.onLine && this.isNetworking) {
                try {
                    await this.startNetworking();
                    this.cancelReconnect();
                } catch (error) {
                    console.warn('Reconnection attempt failed:', error);
                }
            }
        }, 10000); // Try every 10 seconds
    }

    cancelReconnect() {
        if (this.reconnectInterval) {
            clearInterval(this.reconnectInterval);
            this.reconnectInterval = null;
        }
    }

    // Data export
    async exportNetworkData() {
        try {
            const response = await window.electronAPI.exportNetworkData();
            return response;
        } catch (error) {
            throw error;
        }
    }

    getNetworkData() {
        return {
            networkStatus: this.networkStatus,
            peers: Array.from(this.peers.values()),
            connectionTests: this.connectionTests,
            optimizations: this.networkOptimizations,
            exportedAt: new Date().toISOString()
        };
    }

    // Utility methods
    updateQuickStat(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    showNetworkNotification(message, type) {
        if (window.uiController) {
            window.uiController.showNotification(message, type);
        }
    }

    // Cleanup
    cleanup() {
        // Stop networking
        this.stopNetworking().catch(console.warn);
        
        // Clear intervals
        if (this.statsUpdateInterval) {
            clearInterval(this.statsUpdateInterval);
        }
        
        this.cancelReconnect();
        
        // Remove event listeners
        if (this.unsubscribeFunctions) {
            this.unsubscribeFunctions.forEach(unsubscribe => {
                if (typeof unsubscribe === 'function') {
                    unsubscribe();
                }
            });
        }
        
        console.log('Network manager cleaned up');
    }
}

// Initialize network manager
let networkManager;

document.addEventListener('DOMContentLoaded', () => {
    networkManager = new NetworkManager();
    
    // Make it globally accessible
    window.networkManager = networkManager;
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (networkManager) {
        networkManager.cleanup();
    }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NetworkManager;
}