// worker/shared.js - Common utilities and classes for both Layer 4 and Layer 7 attacks
const fs = require('fs');
const net = require('net');
const dns = require('dns');
const crypto = require('crypto');
const os = require('os');
const { performance } = require('perf_hooks');
const url = require('url');
const { promisify } = require('util');
const EventEmitter = require('events');

// Console colors
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
    constructor(module = 'COMMON') {
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
        this.logger = new Logger('PROXY');
    }

    loadProxies(proxyList) {
        this.proxies = proxyList.map(proxy => this.parseProxy(proxy));
        this.workingProxies.clear();
        this.failedProxies.clear();
        this.proxyPerformance.clear();
        
        this.logger.info(`Loaded ${this.proxies.length} proxies`);
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
        
        this.logger.info(`Proxy validation complete: ${working} working, ${failed} failed`);
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
            this.logger.info(`Proxy rotation strategy set to: ${strategy}`);
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
        this.logger = new Logger('THREAD');
    }

    async initializeWorkerPool(poolSize = this.maxWorkers) {
        if (!this.useWorkerThreads) return;
        
        this.logger.info(`Initializing worker thread pool with ${poolSize} workers`);
        
        for (let i = 0; i < poolSize; i++) {
            await this.createWorker();
        }
        
        this.logger.success(`Worker pool initialized with ${this.workerPool.length} workers`);
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
        this.logger.info('Shutting down threading manager...');
        
        // Wait for active tasks to complete
        while (this.workerPool.some(w => !w.isAvailable)) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        this.workerPool = [];
        this.taskQueue = [];
        this.workerStats.clear();
        
        this.logger.success('Threading manager shutdown complete');
    }
}

// Advanced Utilities
class AdvancedUtils {
    static async resolveTargets(targets) {
        const dnsLookup = promisify(dns.lookup);
        const results = new Map();
        const logger = new Logger('UTILS');
        
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
        const defaultUserAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1',
            'Mozilla/5.0 (iPad; CPU OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1'
        ];
        
        if (!userAgents || userAgents.length === 0) {
            userAgents = defaultUserAgents;
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

// Export shared utilities
module.exports = {
    Colors,
    GlobalResourceManager,
    Logger,
    ProxyManager,
    ThreadingManager,
    AdvancedUtils
};