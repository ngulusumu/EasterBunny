//networking/resource-optimization-manager.js
const EventEmitter = require('events');

class ResourceOptimizationManager extends EventEmitter {
    constructor() {
        super();
        
        // Resource tracking
        this.intervals = new Set();
        this.timeouts = new Set();
        this.eventListeners = new Map();
        this.caches = new Map();
        this.maxCacheSize = 100;
        this.maxCacheAge = 300000; // 5 minutes
        
        // Rate limiting
        this.rateLimits = new Map();
        this.maxEventsPerSecond = 10;
        
        // Memory monitoring
        this.memoryThreshold = 100 * 1024 * 1024; // 100MB
        this.lastMemoryCheck = 0;
        this.memoryCheckInterval = 30000; // 30 seconds
        
        // Performance tracking
        this.performanceMetrics = {
            memoryUsage: [],
            cpuUsage: [],
            eventCounts: new Map(),
            networkActivity: { sent: 0, received: 0 }
        };
        
        this.startResourceMonitoring();
    }

    // ===============================
    // INTERVAL AND TIMEOUT MANAGEMENT
    // ===============================

    createInterval(callback, interval, name = 'anonymous') {
        const intervalId = setInterval(() => {
            try {
                if (this.isRateLimited(`interval_${name}`)) {
                    console.warn(`Rate limited interval: ${name}`);
                    return;
                }
                callback();
            } catch (error) {
                console.error(`Error in interval ${name}:`, error);
            }
        }, interval);
        
        this.intervals.add({ id: intervalId, name, created: Date.now() });
        return intervalId;
    }

    createTimeout(callback, delay, name = 'anonymous') {
        const timeoutId = setTimeout(() => {
            try {
                this.timeouts.delete(timeoutId);
                callback();
            } catch (error) {
                console.error(`Error in timeout ${name}:`, error);
            }
        }, delay);
        
        this.timeouts.add({ id: timeoutId, name, created: Date.now() });
        return timeoutId;
    }

    clearManagedInterval(intervalId) {
        clearInterval(intervalId);
        this.intervals.forEach(interval => {
            if (interval.id === intervalId) {
                this.intervals.delete(interval);
            }
        });
    }

    clearManagedTimeout(timeoutId) {
        clearTimeout(timeoutId);
        this.timeouts.forEach(timeout => {
            if (timeout.id === timeoutId) {
                this.timeouts.delete(timeout);
            }
        });
    }

    clearAllIntervals() {
        this.intervals.forEach(interval => {
            clearInterval(interval.id);
        });
        this.intervals.clear();
        console.log('🧹 Cleared all managed intervals');
    }

    clearAllTimeouts() {
        this.timeouts.forEach(timeout => {
            clearTimeout(timeout.id);
        });
        this.timeouts.clear();
        console.log('🧹 Cleared all managed timeouts');
    }

    // ===============================
    // CACHE MANAGEMENT
    // ===============================

    setCache(key, value, ttl = this.maxCacheAge) {
        // Check cache size limit
        if (this.caches.size >= this.maxCacheSize) {
            this.evictOldestCache();
        }

        this.caches.set(key, {
            value,
            timestamp: Date.now(),
            ttl,
            hits: 0
        });
    }

    getCache(key) {
        const cached = this.caches.get(key);
        if (!cached) return null;

        // Check if expired
        if (Date.now() - cached.timestamp > cached.ttl) {
            this.caches.delete(key);
            return null;
        }

        cached.hits++;
        return cached.value;
    }

    evictOldestCache() {
        let oldestKey = null;
        let oldestTime = Date.now();

        for (const [key, cache] of this.caches.entries()) {
            if (cache.timestamp < oldestTime) {
                oldestTime = cache.timestamp;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.caches.delete(oldestKey);
        }
    }

    clearExpiredCaches() {
        const now = Date.now();
        for (const [key, cache] of this.caches.entries()) {
            if (now - cache.timestamp > cache.ttl) {
                this.caches.delete(key);
            }
        }
    }

    // ===============================
    // RATE LIMITING
    // ===============================

    isRateLimited(operation) {
        const now = Date.now();
        const limit = this.rateLimits.get(operation) || { count: 0, window: now };
        
        // Reset window if more than 1 second has passed
        if (now - limit.window > 1000) {
            limit.count = 0;
            limit.window = now;
        }
        
        if (limit.count >= this.maxEventsPerSecond) {
            return true;
        }
        
        limit.count++;
        this.rateLimits.set(operation, limit);
        return false;
    }

    // ===============================
    // MEMORY MANAGEMENT
    // ===============================

    async checkMemoryUsage() {
        try {
            const memUsage = process.memoryUsage();
            const totalMemory = memUsage.heapUsed + memUsage.external;
            
            this.performanceMetrics.memoryUsage.push({
                timestamp: Date.now(),
                heapUsed: memUsage.heapUsed,
                heapTotal: memUsage.heapTotal,
                external: memUsage.external,
                rss: memUsage.rss
            });

            // Keep only last 100 measurements
            if (this.performanceMetrics.memoryUsage.length > 100) {
                this.performanceMetrics.memoryUsage = this.performanceMetrics.memoryUsage.slice(-50);
            }

            // Check if memory usage is high
            if (totalMemory > this.memoryThreshold) {
                console.warn(`⚠️ High memory usage detected: ${this.formatBytes(totalMemory)}`);
                await this.performMemoryCleanup();
                this.emit('high-memory-usage', { usage: totalMemory, threshold: this.memoryThreshold });
            }

            return memUsage;
        } catch (error) {
            console.error('Error checking memory usage:', error);
            return null;
        }
    }

    async performMemoryCleanup() {
        console.log('🧹 Performing memory cleanup...');
        
        // Clear expired caches
        this.clearExpiredCaches();
        
        // Limit performance metrics arrays
        this.performanceMetrics.memoryUsage = this.performanceMetrics.memoryUsage.slice(-20);
        this.performanceMetrics.cpuUsage = this.performanceMetrics.cpuUsage.slice(-20);
        
        // Clear old rate limit entries
        const now = Date.now();
        for (const [key, limit] of this.rateLimits.entries()) {
            if (now - limit.window > 5000) { // 5 seconds old
                this.rateLimits.delete(key);
            }
        }
        
        // Force garbage collection if available
        if (global.gc) {
            global.gc();
        }
        
        console.log('✅ Memory cleanup completed');
    }

    // ===============================
    // EVENT LISTENER MANAGEMENT
    // ===============================

    addManagedEventListener(emitter, event, listener, name = 'anonymous') {
        const listenerKey = `${name}_${event}`;
        
        // Remove existing listener if present
        if (this.eventListeners.has(listenerKey)) {
            const { emitter: oldEmitter, listener: oldListener } = this.eventListeners.get(listenerKey);
            oldEmitter.removeListener(event, oldListener);
        }
        
        emitter.addListener(event, listener);
        this.eventListeners.set(listenerKey, { emitter, event, listener, name, created: Date.now() });
        
        return listenerKey;
    }

    removeManagedEventListener(listenerKey) {
        const listenerInfo = this.eventListeners.get(listenerKey);
        if (listenerInfo) {
            listenerInfo.emitter.removeListener(listenerInfo.event, listenerInfo.listener);
            this.eventListeners.delete(listenerKey);
        }
    }

    removeAllManagedEventListeners() {
        for (const [key, { emitter, event, listener }] of this.eventListeners.entries()) {
            try {
                emitter.removeListener(event, listener);
            } catch (error) {
                console.error(`Error removing listener ${key}:`, error);
            }
        }
        this.eventListeners.clear();
        console.log('🧹 Removed all managed event listeners');
    }

    // ===============================
    // RESOURCE MONITORING
    // ===============================

    startResourceMonitoring() {
        // Memory check interval
        this.createInterval(async () => {
            await this.checkMemoryUsage();
        }, this.memoryCheckInterval, 'memory_monitor');

        // Cache cleanup interval
        this.createInterval(() => {
            this.clearExpiredCaches();
        }, 60000, 'cache_cleanup'); // Every minute

        // Performance metrics cleanup
        this.createInterval(() => {
            this.cleanupPerformanceMetrics();
        }, 300000, 'metrics_cleanup'); // Every 5 minutes
    }

    cleanupPerformanceMetrics() {
        // Keep only recent performance data
        const cutoff = Date.now() - 600000; // 10 minutes
        
        this.performanceMetrics.memoryUsage = this.performanceMetrics.memoryUsage
            .filter(metric => metric.timestamp > cutoff);
            
        this.performanceMetrics.cpuUsage = this.performanceMetrics.cpuUsage
            .filter(metric => metric.timestamp > cutoff);
            
        // Reset network counters if they get too large
        if (this.performanceMetrics.networkActivity.sent > 1000000) {
            this.performanceMetrics.networkActivity.sent = 0;
        }
        if (this.performanceMetrics.networkActivity.received > 1000000) {
            this.performanceMetrics.networkActivity.received = 0;
        }
    }

    // ===============================
    // PERFORMANCE OPTIMIZATION
    // ===============================

    createThrottledFunction(func, delay, name = 'anonymous') {
        let timeoutId = null;
        let lastExecution = 0;
        
        return (...args) => {
            const now = Date.now();
            
            if (now - lastExecution >= delay) {
                // Execute immediately if enough time has passed
                lastExecution = now;
                return func.apply(this, args);
            } else {
                // Throttle execution
                if (timeoutId) {
                    this.clearManagedTimeout(timeoutId);
                }
                
                timeoutId = this.createTimeout(() => {
                    lastExecution = Date.now();
                    func.apply(this, args);
                }, delay - (now - lastExecution), `throttled_${name}`);
            }
        };
    }

    createDebouncedFunction(func, delay, name = 'anonymous') {
        let timeoutId = null;
        
        return (...args) => {
            if (timeoutId) {
                this.clearManagedTimeout(timeoutId);
            }
            
            timeoutId = this.createTimeout(() => {
                func.apply(this, args);
            }, delay, `debounced_${name}`);
        };
    }

    // ===============================
    // UTILITY METHODS
    // ===============================

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    getResourceStats() {
        const memUsage = process.memoryUsage();
        
        return {
            memory: {
                heapUsed: this.formatBytes(memUsage.heapUsed),
                heapTotal: this.formatBytes(memUsage.heapTotal),
                external: this.formatBytes(memUsage.external),
                rss: this.formatBytes(memUsage.rss)
            },
            resources: {
                intervals: this.intervals.size,
                timeouts: this.timeouts.size,
                eventListeners: this.eventListeners.size,
                caches: this.caches.size,
                rateLimits: this.rateLimits.size
            },
            performance: {
                memoryHistory: this.performanceMetrics.memoryUsage.length,
                cpuHistory: this.performanceMetrics.cpuUsage.length,
                networkActivity: this.performanceMetrics.networkActivity
            },
            uptime: process.uptime()
        };
    }

    // ===============================
    // CLEANUP METHODS
    // ===============================

    async shutdown() {
        console.log('🧹 Starting resource optimization manager shutdown...');
        
        try {
            // Clear all managed resources
            this.clearAllIntervals();
            this.clearAllTimeouts();
            this.removeAllManagedEventListeners();
            
            // Clear all caches
            this.caches.clear();
            this.rateLimits.clear();
            
            // Clear performance metrics
            this.performanceMetrics.memoryUsage = [];
            this.performanceMetrics.cpuUsage = [];
            this.performanceMetrics.eventCounts.clear();
            this.performanceMetrics.networkActivity = { sent: 0, received: 0 };
            
            // Remove all event listeners from this instance
            this.removeAllListeners();
            
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }
            
            console.log('✅ Resource optimization manager shutdown complete');
            
        } catch (error) {
            console.error('❌ Error during resource manager shutdown:', error);
        }
    }

    // ===============================
    // FACTORY METHODS
    // ===============================

    static createOptimizedInterval(callback, interval, name) {
        const manager = ResourceOptimizationManager.getInstance();
        return manager.createInterval(callback, interval, name);
    }

    static createOptimizedTimeout(callback, delay, name) {
        const manager = ResourceOptimizationManager.getInstance();
        return manager.createTimeout(callback, delay, name);
    }

    static getInstance() {
        if (!ResourceOptimizationManager.instance) {
            ResourceOptimizationManager.instance = new ResourceOptimizationManager();
        }
        return ResourceOptimizationManager.instance;
    }
}

module.exports = { ResourceOptimizationManager };