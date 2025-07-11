//networking/index.js
/**
 * MKenya Tool - Enhanced Networking Module
 * Main entry point for all networking functionality
 */

const { EnhancedPrivateNetworkCoordinator } = require('./enhanced-private-network-coordinator');
const EnhancedMachineCoordinationApp = require('./enhanced-coordination-integration');
const { DataTransferManager } = require('./data-transfer-manager');
const { DistributedStorageManager } = require('./distributed-storage-manager');
const { NetworkFileSystem } = require('./network-file-system');
const { ResourceOptimizationManager } = require('./resource-optimization-manager');

/**
 * Main Networking Class - Easy interface for all networking features
 */
class MKenyaNetworking {
    constructor(appConfig = {}) {
        this.appConfig = {
            appIdentifier: 'mkenyatool-enhanced-coordination-network',
            appVersion: '1.0.0',
            networkSecret: 'mkenyatool-enhanced-private-secure-network-2025-coordination-key-v2-do-not-share',
            minRequiredVersion: '1.0.0',
            machineId: 'default',
            ...appConfig
        };

        // Core networking components
        this.coordinator = null;
        this.app = null;
        this.dataTransfer = null;
        this.distributedStorage = null;
        this.networkFS = null;
        
        // Resource optimization
        this.resourceManager = ResourceOptimizationManager.getInstance();
        
        // State
        this.isInitialized = false;
        this.isElectronMode = false;
        
        // Setup cleanup on process exit
        this.setupCleanupHandlers();
    }

    setupCleanupHandlers() {
        const cleanup = async () => {
            await this.shutdown();
            process.exit(0);
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
        process.on('beforeExit', cleanup);
    }

    /**
     * Initialize networking in Electron app mode
     */
    async initializeElectronApp() {
        try {
            console.log('🚀 Initializing MKenya Networking in Electron App mode...');
            
            this.isElectronMode = true;
            this.app = new EnhancedMachineCoordinationApp();
            
            // Wait for app to be ready
            await this.waitForAppReady();
            
            // Get coordinator reference from app
            this.coordinator = this.app.coordinator;
            
            // Initialize data handling components
            await this.initializeDataComponents();
            
            this.isInitialized = true;
            console.log('✅ MKenya Networking Electron App initialized successfully');
            
            return this.app;
            
        } catch (error) {
            console.error('❌ Failed to initialize MKenya Networking Electron App:', error);
            throw error;
        }
    }

    /**
     * Initialize networking in standalone mode (Node.js only)
     */
    async initializeStandalone() {
        try {
            console.log('🚀 Initializing MKenya Networking in Standalone mode...');
            
            this.isElectronMode = false;
            this.coordinator = new EnhancedPrivateNetworkCoordinator(this.appConfig);
            
            // Initialize coordinator
            await this.coordinator.initialize();
            
            // Initialize data handling components
            await this.initializeDataComponents();
            
            this.isInitialized = true;
            console.log('✅ MKenya Networking Standalone initialized successfully');
            
            return this.coordinator;
            
        } catch (error) {
            console.error('❌ Failed to initialize MKenya Networking Standalone:', error);
            throw error;
        }
    }

    /**
     * Initialize data handling components
     */
    async initializeDataComponents() {
        if (!this.coordinator) {
            throw new Error('Coordinator must be initialized first');
        }

        try {
            // Initialize data transfer manager
            this.dataTransfer = new DataTransferManager(this.coordinator);
            await this.dataTransfer.initialize();

            // Initialize distributed storage
            this.distributedStorage = new DistributedStorageManager(this.coordinator);
            await this.distributedStorage.initialize();

            // Initialize network file system
            this.networkFS = new NetworkFileSystem(this.coordinator, this.dataTransfer);
            await this.networkFS.initialize();

            console.log('✅ Data handling components initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize data components:', error);
            throw error;
        }
    }

    /**
     * Wait for Electron app to be ready
     */
    async waitForAppReady() {
        return new Promise((resolve) => {
            const checkReady = () => {
                if (this.app && this.app.coordinator && this.app.coordinator.isInitialized) {
                    resolve();
                } else {
                    setTimeout(checkReady, 100);
                }
            };
            checkReady();
        });
    }

    // ===============================
    // EASY-TO-USE PUBLIC API
    // ===============================

    /**
     * Send a message to all machines or specific machine
     */
    async sendMessage(content, targetMachineId = null) {
        this.ensureInitialized();
        return await this.coordinator.sendPrivateMessage(content, targetMachineId);
    }

    /**
     * Send a file to another machine
     */
    async sendFile(filePath, targetMachineId, options = {}) {
        this.ensureInitialized();
        return await this.dataTransfer.sendFile(filePath, targetMachineId, options);
    }

    /**
     * Send data object to another machine
     */
    async sendData(data, targetMachineId, options = {}) {
        this.ensureInitialized();
        return await this.dataTransfer.sendData(data, targetMachineId, options);
    }

    /**
     * Store data in distributed storage across network
     */
    async storeDistributed(key, data, options = {}) {
        this.ensureInitialized();
        return await this.distributedStorage.store(key, data, options);
    }

    /**
     * Retrieve data from distributed storage
     */
    async retrieveDistributed(key, options = {}) {
        this.ensureInitialized();
        return await this.distributedStorage.retrieve(key, options);
    }

    /**
     * Sync a folder across the network
     */
    async syncFolder(localPath, networkPath, options = {}) {
        this.ensureInitialized();
        return await this.networkFS.syncFolder(localPath, networkPath, options);
    }

    /**
     * Get list of connected machines
     */
    getMachines() {
        this.ensureInitialized();
        return this.coordinator.getPrivateNetworkStatus().peerList;
    }

    /**
     * Get network statistics
     */
    getNetworkStats() {
        this.ensureInitialized();
        return this.coordinator.getNetworkStatistics();
    }

    /**
     * Get my machine info
     */
    async getMyInfo() {
        this.ensureInitialized();
        const systemInfo = await this.coordinator.getDetailedSystemInfo();
        const coordinationInfo = this.coordinator.extractCoordinationInfo(systemInfo);
        
        return {
            publicKey: this.coordinator.publicKey,
            shortId: this.coordinator.publicKey.substring(0, 8),
            networkId: this.coordinator.getNetworkId(),
            capabilities: coordinationInfo.capabilities,
            performance: coordinationInfo.performance,
            healthScore: await this.coordinator.getSystemHealthScore(),
            capabilityScore: await this.coordinator.getMachineCapabilityScore()
        };
    }

    /**
     * Find machines with specific capabilities
     */
    findCapableMachines(requirements) {
        this.ensureInitialized();
        const machines = this.getMachines();
        
        return machines.filter(machine => {
            if (!machine.capabilities) return false;
            
            const caps = machine.capabilities;
            
            // Check requirements
            if (requirements.minCpuCores && caps.cpuCores < requirements.minCpuCores) return false;
            if (requirements.minMemory && caps.totalMemory < requirements.minMemory) return false;
            if (requirements.platform && caps.platform !== requirements.platform) return false;
            if (requirements.minDiskSpace && caps.totalDiskSpace < requirements.minDiskSpace) return false;
            
            return true;
        });
    }

    /**
     * Set event handlers
     */
    onPeerConnected(callback) {
        this.ensureInitialized();
        this.coordinator.onPeerVerified = callback;
    }

    onPeerDisconnected(callback) {
        this.ensureInitialized();
        this.coordinator.onPeerDisconnected = callback;
    }

    onMessageReceived(callback) {
        this.ensureInitialized();
        this.coordinator.onGroupChatMessage = callback;
    }

    onFileReceived(callback) {
        this.ensureInitialized();
        if (this.dataTransfer) {
            this.dataTransfer.onFileReceived = callback;
        }
    }

    onDataReceived(callback) {
        this.ensureInitialized();
        if (this.dataTransfer) {
            this.dataTransfer.onDataReceived = callback;
        }
    }

    /**
     * Refresh network and discover peers
     */
    async refreshNetwork() {
        this.ensureInitialized();
        await this.coordinator.broadcastAppVerification();
        await this.coordinator.pingKnownPeers();
        await this.coordinator.sendAnnouncement();
    }

    /**
     * Shutdown networking
     */
    async shutdown() {
        console.log('🧹 Shutting down MKenya Networking...');
        
        if (!this.isInitialized) return;

        try {
            // Shutdown data components
            if (this.networkFS) await this.networkFS.shutdown();
            if (this.distributedStorage) await this.distributedStorage.shutdown();
            if (this.dataTransfer) await this.dataTransfer.shutdown();
            
            // Shutdown coordinator or app
            if (this.isElectronMode && this.app) {
                await this.app.cleanup();
            } else if (this.coordinator) {
                await this.coordinator.shutdown();
            }
            
            // Shutdown resource manager last
            await this.resourceManager.shutdown();
            
            this.isInitialized = false;
            console.log('✅ MKenya Networking shutdown complete');
            
        } catch (error) {
            console.error('❌ Error during networking shutdown:', error);
        }
    }

    // ===============================
    // RESOURCE MONITORING
    // ===============================

    getResourceStats() {
        return this.resourceManager.getResourceStats();
    }

    async performMemoryCleanup() {
        await this.resourceManager.performMemoryCleanup();
    }

    // ===============================
    // OPTIMIZED METHODS
    // ===============================

    // Throttled refresh to prevent spam
    refreshNetwork = this.resourceManager?.createThrottledFunction(async () => {
        this.ensureInitialized();
        await this.coordinator.broadcastAppVerification();
        await this.coordinator.pingKnownPeers();
        await this.coordinator.sendAnnouncement();
    }, 5000, 'refresh_network') || this.refreshNetworkFallback;

    async refreshNetworkFallback() {
        this.ensureInitialized();
        await this.coordinator.broadcastAppVerification();
        await this.coordinator.pingKnownPeers();
        await this.coordinator.sendAnnouncement();
    }

    // ===============================
    // UTILITY METHODS
    // ===============================

    ensureInitialized() {
        if (!this.isInitialized) {
            throw new Error('MKenya Networking not initialized. Call initializeElectronApp() or initializeStandalone() first.');
        }
    }

    /**
     * Check if networking is ready
     */
    isReady() {
        return this.isInitialized && this.coordinator && this.coordinator.isInitialized;
    }

    /**
     * Get network status
     */
    getStatus() {
        if (!this.isInitialized) {
            return { status: 'not_initialized' };
        }
        
        return {
            status: 'ready',
            mode: this.isElectronMode ? 'electron' : 'standalone',
            networkId: this.coordinator.getNetworkId(),
            connectedPeers: this.coordinator.verifiedPeers.size,
            isolatedMode: this.coordinator.isolatedMode
        };
    }
}

// Export everything for flexibility
module.exports = {
    // Main easy-to-use class
    MKenyaNetworking,
    
    // Individual components for advanced usage
    EnhancedPrivateNetworkCoordinator,
    EnhancedMachineCoordinationApp,
    DataTransferManager,
    DistributedStorageManager,
    NetworkFileSystem,
    ResourceOptimizationManager,
    
    // Helper functions
    createStandaloneNetworking: (config) => {
        const networking = new MKenyaNetworking(config);
        return networking.initializeStandalone().then(() => networking);
    },
    
    createElectronNetworking: (config) => {
        const networking = new MKenyaNetworking(config);
        return networking.initializeElectronApp().then(() => networking);
    }
};

// For backward compatibility and simple usage
module.exports.default = MKenyaNetworking;