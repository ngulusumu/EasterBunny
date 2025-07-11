//systeminfo/optimized-systeminfo.js
const os = require('os');
const path = require('path');
const EventEmitter = require('events');
const { ResourceOptimizationManager } = require('../networking/resource-optimization-manager');

class OptimizedSystemInfoManager extends EventEmitter {
    constructor() {
        super();
        this.platform = os.platform();
        this.systemInfo = null;
        this.resourceManager = ResourceOptimizationManager.getInstance();
        
        // Optimized caching with different TTLs
        this.cacheConfig = {
            basic: { ttl: 30000, key: 'basic_info' },           // 30 seconds
            cpu: { ttl: 5000, key: 'cpu_info' },               // 5 seconds
            memory: { ttl: 2000, key: 'memory_info' },         // 2 seconds  
            disk: { ttl: 60000, key: 'disk_info' },            // 1 minute
            network: { ttl: 30000, key: 'network_info' },      // 30 seconds
            processes: { ttl: 10000, key: 'processes_info' },  // 10 seconds
            performance: { ttl: 3000, key: 'performance_info' } // 3 seconds
        };
        
        // Monitoring state
        this.isMonitoring = false;
        this.monitoringOptions = null;
        this.lastFullSystemScan = 0;
        this.fullSystemScanInterval = 300000; // 5 minutes
        
        // Performance tracking
        this.callCounts = new Map();
        this.executionTimes = new Map();
        
        this.initializeSystemInfo();
        this.setupOptimizedCaching();
    }

    initializeSystemInfo() {
        try {
            switch (this.platform) {
                case 'win32':
                    const WindowsSystemInfo = require('./systeminfo_win.js');
                    this.systemInfo = new WindowsSystemInfo();
                    break;
                case 'linux':
                    const LinuxSystemInfo = require('./systeminfo_linux.js');
                    this.systemInfo = new LinuxSystemInfo();
                    break;
                case 'darwin':
                    const MacSystemInfo = require('./systeminfo_mac.js');
                    this.systemInfo = new MacSystemInfo();
                    break;
                default:
                    console.warn(`Platform ${this.platform} not fully supported, using basic fallback`);
                    this.systemInfo = new OptimizedBasicSystemInfo();
            }
        } catch (error) {
            console.error('Error initializing system info:', error);
            this.systemInfo = new OptimizedBasicSystemInfo();
        }
    }

    setupOptimizedCaching() {
        // Clean up caches periodically
        this.resourceManager.createInterval(() => {
            this.cleanupOldCaches();
        }, 60000, 'systeminfo_cache_cleanup');
    }

    cleanupOldCaches() {
        // This is handled by the resource manager, but we can add specific logic
        const stats = this.getPerformanceStats();
        if (stats.cacheHitRate < 0.5) { // Low hit rate, clear caches
            this.clearAllCaches();
        }
    }

    // ===============================
    // OPTIMIZED DATA RETRIEVAL
    // ===============================

    async getBasicInfo() {
        return this.getCachedOrFetch('basic', async () => {
            if (this.systemInfo && typeof this.systemInfo.getBasicSystemInfo === 'function') {
                return await this.systemInfo.getBasicSystemInfo();
            } else {
                return this.getFallbackBasicInfo();
            }
        });
    }

    async getCPUInfo() {
        return this.getCachedOrFetch('cpu', async () => {
            if (this.systemInfo && typeof this.systemInfo.getCPUInfo === 'function') {
                const platformCpuInfo = await this.systemInfo.getCPUInfo();
                
                return {
                    cpuCores: platformCpuInfo.cpuCores || os.cpus(),
                    cpuCount: platformCpuInfo.cpuCount || platformCpuInfo.cpuCores?.length || os.cpus().length,
                    cores: platformCpuInfo.cpuCount || platformCpuInfo.cpuCores?.length || os.cpus().length,
                    cpuModel: platformCpuInfo.cpuModel || os.cpus()[0]?.model || 'Unknown',
                    model: platformCpuInfo.cpuModel || os.cpus()[0]?.model || 'Unknown',
                    loadAverage: os.loadavg(),
                    cpuUsage: platformCpuInfo.cpuUsage || 0,
                    usage: platformCpuInfo.cpuUsage || 0
                };
            } else {
                const cpus = os.cpus();
                return {
                    cpuCores: cpus,
                    cpuCount: cpus.length,
                    cores: cpus.length,
                    cpuModel: cpus[0]?.model || 'Unknown',
                    model: cpus[0]?.model || 'Unknown',
                    loadAverage: os.loadavg(),
                    cpuUsage: 0,
                    usage: 0
                };
            }
        });
    }

    async getMemoryInfo() {
        return this.getCachedOrFetch('memory', async () => {
            if (this.systemInfo && typeof this.systemInfo.getMemoryInfo === 'function') {
                const platformMemInfo = await this.systemInfo.getMemoryInfo();
                
                const total = platformMemInfo.totalPhysical || platformMemInfo.total || os.totalmem();
                const free = platformMemInfo.freePhysical || platformMemInfo.free || os.freemem();
                const available = platformMemInfo.available || free;
                const used = total - free;
                
                return {
                    totalPhysical: total,
                    total: total,
                    freePhysical: free,
                    free: free,
                    available: available,
                    usedPhysical: used,
                    used: used,
                    memoryUsagePercent: ((used / total) * 100).toFixed(2),
                    usage: parseFloat(((used / total) * 100).toFixed(2)),
                    processMemory: process.memoryUsage(),
                    buffers: platformMemInfo.buffers || 0,
                    cached: platformMemInfo.cached || 0
                };
            } else {
                const total = os.totalmem();
                const free = os.freemem();
                const used = total - free;
                
                return {
                    totalPhysical: total,
                    total: total,
                    freePhysical: free,
                    free: free,
                    available: free,
                    usedPhysical: used,
                    used: used,
                    memoryUsagePercent: ((used / total) * 100).toFixed(2),
                    usage: parseFloat(((used / total) * 100).toFixed(2)),
                    processMemory: process.memoryUsage(),
                    buffers: 0,
                    cached: 0
                };
            }
        });
    }

    // Lightweight memory info for frequent polling
    async getQuickMemoryInfo() {
        const total = os.totalmem();
        const free = os.freemem();
        const used = total - free;
        
        return {
            total,
            free,
            used,
            usage: parseFloat(((used / total) * 100).toFixed(2)),
            processMemory: process.memoryUsage()
        };
    }

    async getDiskInfo() {
        return this.getCachedOrFetch('disk', async () => {
            if (this.systemInfo && typeof this.systemInfo.getDiskInfo === 'function') {
                return await this.systemInfo.getDiskInfo();
            } else {
                return { message: 'Disk info not available for this platform' };
            }
        });
    }

    async getNetworkInfo() {
        return this.getCachedOrFetch('network', async () => {
            if (this.systemInfo && typeof this.systemInfo.getNetworkInfo === 'function') {
                return await this.systemInfo.getNetworkInfo();
            } else {
                return {
                    networkInterfaces: os.networkInterfaces(),
                    message: 'Detailed network info not available for this platform'
                };
            }
        });
    }

    async getRunningProcesses() {
        return this.getCachedOrFetch('processes', async () => {
            if (this.systemInfo && typeof this.systemInfo.getRunningProcesses === 'function') {
                return await this.systemInfo.getRunningProcesses();
            } else {
                return { message: 'Process info not available for this platform' };
            }
        });
    }

    async getPerformanceMetrics() {
        return this.getCachedOrFetch('performance', async () => {
            try {
                const [cpuInfo, memoryInfo, diskInfo] = await Promise.all([
                    this.getCPUInfo(),
                    this.getQuickMemoryInfo(), // Use quick version
                    this.getCachedValue('disk') || { message: 'Using cached disk info' } // Don't fetch if not cached
                ]);

                return {
                    timestamp: new Date().toISOString(),
                    performance: {
                        cpu: {
                            usage: cpuInfo.cpuUsage || cpuInfo.usage || 0,
                            cores: cpuInfo.cpuCores?.length || cpuInfo.cpuCount || cpuInfo.cores || os.cpus().length,
                            loadAverage: cpuInfo.loadAverage || os.loadavg(),
                            model: cpuInfo.cpuModel || cpuInfo.model || 'Unknown'
                        },
                        memory: {
                            usage: memoryInfo.usage || 0,
                            total: memoryInfo.total || os.totalmem(),
                            free: memoryInfo.free || os.freemem(),
                            available: memoryInfo.available || memoryInfo.free || os.freemem(),
                            processUsage: memoryInfo.processMemory || process.memoryUsage()
                        },
                        disk: Array.isArray(diskInfo) ? diskInfo.map(disk => ({
                            drive: disk.drive || disk.filesystem,
                            usage: parseFloat(disk.usagePercent || 0),
                            free: disk.freeSpace || disk.available,
                            total: disk.totalSize || disk.total
                        })) : [],
                        uptime: os.uptime(),
                        platform: this.getPlatformName()
                    }
                };
            } catch (error) {
                console.error('Error getting performance metrics:', error);
                return this.getFallbackPerformanceMetrics();
            }
        });
    }

    getFallbackPerformanceMetrics() {
        return {
            timestamp: new Date().toISOString(),
            performance: {
                cpu: { usage: 0, cores: os.cpus().length, loadAverage: os.loadavg(), model: 'Unknown' },
                memory: { usage: 0, total: os.totalmem(), free: os.freemem(), available: os.freemem(), processUsage: process.memoryUsage() },
                disk: [],
                uptime: os.uptime(),
                platform: this.getPlatformName()
            }
        };
    }

    // ===============================
    // OPTIMIZED FULL SYSTEM INFO
    // ===============================

    async getAllSystemInfo() {
        const now = Date.now();
        
        // Check if we need a full system scan
        if (now - this.lastFullSystemScan < this.fullSystemScanInterval) {
            // Return cached/optimized version
            return await this.getOptimizedSystemInfo();
        }
        
        // Perform full system scan
        this.lastFullSystemScan = now;
        return await this.getFullSystemInfo();
    }

    async getOptimizedSystemInfo() {
        try {
            const platformInfo = this.getPlatformInfo();
            
            // Get critical info only
            const [basicInfo, cpuInfo, memoryInfo] = await Promise.all([
                this.getBasicInfo(),
                this.getCPUInfo(),
                this.getQuickMemoryInfo()
            ]);

            return {
                timestamp: new Date().toISOString(),
                platform: platformInfo,
                basic: basicInfo,
                cpu: cpuInfo,
                memory: memoryInfo,
                performance: {
                    cpuUsage: cpuInfo.cpuUsage || 0,
                    memoryUsage: parseFloat(memoryInfo.usage || 0),
                    uptime: os.uptime()
                },
                optimized: true,
                message: 'Optimized system info (partial data)'
            };
        } catch (error) {
            console.error('Error getting optimized system info:', error);
            throw error;
        }
    }

    async getFullSystemInfo() {
        try {
            const platformInfo = this.getPlatformInfo();
            
            if (this.systemInfo && typeof this.systemInfo.getAllSystemInfo === 'function') {
                const detailedInfo = await this.systemInfo.getAllSystemInfo();
                return {
                    ...detailedInfo,
                    platform: platformInfo,
                    fullScan: true
                };
            } else {
                const basicInfo = await this.getBasicInfo();
                return {
                    timestamp: new Date().toISOString(),
                    platform: platformInfo,
                    basic: basicInfo,
                    message: `Detailed system info not available for ${this.getPlatformName()}`,
                    fullScan: false
                };
            }
        } catch (error) {
            console.error('Error getting full system info:', error);
            throw error;
        }
    }

    // ===============================
    // OPTIMIZED MONITORING
    // ===============================

    async startMonitoring(interval = 10000, options = {}) {
        if (this.isMonitoring) {
            await this.stopMonitoring();
        }

        const {
            includeProcesses = false,
            includeDisk = false,
            includeNetwork = false,
            lightweight = true
        } = options;

        this.isMonitoring = true;
        this.monitoringOptions = { interval, includeProcesses, includeDisk, includeNetwork, lightweight };

        console.log(`🔍 Starting optimized monitoring (interval: ${interval}ms, lightweight: ${lightweight})`);

        const monitoringCallback = this.resourceManager.createThrottledFunction(async () => {
            if (!this.isMonitoring) return;

            try {
                let data;
                
                if (lightweight) {
                    // Lightweight monitoring - essential metrics only
                    const [cpuInfo, memoryInfo] = await Promise.all([
                        this.getCPUInfo(),
                        this.getQuickMemoryInfo()
                    ]);
                    
                    data = {
                        timestamp: new Date().toISOString(),
                        cpu: {
                            usage: cpuInfo.cpuUsage || 0,
                            cores: cpuInfo.cores || os.cpus().length,
                            loadAverage: os.loadavg()
                        },
                        memory: {
                            total: memoryInfo.total,
                            free: memoryInfo.free,
                            used: memoryInfo.used,
                            usage: memoryInfo.usage,
                            processMemory: memoryInfo.processMemory
                        },
                        uptime: os.uptime(),
                        platform: this.getPlatformName(),
                        lightweight: true
                    };
                } else {
                    // Full monitoring
                    const promises = [this.getCPUInfo(), this.getMemoryInfo()];
                    
                    if (includeDisk) promises.push(this.getDiskInfo());
                    if (includeNetwork) promises.push(this.getNetworkInfo());
                    if (includeProcesses) promises.push(this.getRunningProcesses());
                    
                    const results = await Promise.all(promises);
                    
                    data = {
                        timestamp: new Date().toISOString(),
                        cpu: results[0],
                        memory: results[1],
                        uptime: os.uptime(),
                        platform: this.getPlatformName(),
                        lightweight: false
                    };
                    
                    let resultIndex = 2;
                    if (includeDisk) data.disk = results[resultIndex++];
                    if (includeNetwork) data.network = results[resultIndex++];
                    if (includeProcesses) data.processes = results[resultIndex++];
                }
                
                this.emit('data', data);
                this.trackCall('monitoring');
                
            } catch (error) {
                console.error('Error in optimized monitoring:', error);
                this.emit('error', error);
            }
        }, Math.max(1000, interval / 2), 'system_monitoring'); // Throttle to prevent spam

        // Use resource manager for interval
        this.monitoringIntervalId = this.resourceManager.createInterval(
            monitoringCallback,
            interval,
            'system_monitoring'
        );

        // Initial call
        monitoringCallback();

        return {
            stop: () => this.stopMonitoring()
        };
    }

    async stopMonitoring() {
        if (!this.isMonitoring) return;

        this.isMonitoring = false;
        
        if (this.monitoringIntervalId) {
            this.resourceManager.clearManagedInterval(this.monitoringIntervalId);
            this.monitoringIntervalId = null;
        }

        this.emit('stopped');
        console.log('🛑 Optimized monitoring stopped');
    }

    // ===============================
    // CACHING UTILITIES
    // ===============================

    async getCachedOrFetch(type, fetchFunction) {
        const config = this.cacheConfig[type];
        if (!config) {
            console.warn(`No cache config for type: ${type}`);
            return await fetchFunction();
        }

        // Check cache first
        const cached = this.resourceManager.getCache(config.key);
        if (cached) {
            this.trackCall(`${type}_cache_hit`);
            return cached;
        }

        // Cache miss - fetch and cache
        this.trackCall(`${type}_cache_miss`);
        const startTime = Date.now();
        
        try {
            const result = await fetchFunction();
            const executionTime = Date.now() - startTime;
            
            this.resourceManager.setCache(config.key, result, config.ttl);
            this.trackExecutionTime(type, executionTime);
            
            return result;
        } catch (error) {
            this.trackCall(`${type}_error`);
            throw error;
        }
    }

    getCachedValue(type) {
        const config = this.cacheConfig[type];
        return config ? this.resourceManager.getCache(config.key) : null;
    }

    clearCache(type) {
        const config = this.cacheConfig[type];
        if (config) {
            this.resourceManager.caches.delete(config.key);
        }
    }

    clearAllCaches() {
        Object.values(this.cacheConfig).forEach(config => {
            this.resourceManager.caches.delete(config.key);
        });
        console.log('🧹 Cleared all system info caches');
    }

    // ===============================
    // PERFORMANCE TRACKING
    // ===============================

    trackCall(operation) {
        const count = this.callCounts.get(operation) || 0;
        this.callCounts.set(operation, count + 1);
    }

    trackExecutionTime(operation, time) {
        const times = this.executionTimes.get(operation) || [];
        times.push(time);
        
        // Keep only last 100 measurements
        if (times.length > 100) {
            times.splice(0, times.length - 50);
        }
        
        this.executionTimes.set(operation, times);
    }

    getPerformanceStats() {
        const stats = {
            callCounts: Object.fromEntries(this.callCounts),
            averageExecutionTimes: {},
            cacheStats: {
                size: this.resourceManager.caches.size,
                hitRate: 0
            },
            memoryUsage: process.memoryUsage()
        };

        // Calculate average execution times
        for (const [operation, times] of this.executionTimes.entries()) {
            if (times.length > 0) {
                stats.averageExecutionTimes[operation] = 
                    times.reduce((a, b) => a + b, 0) / times.length;
            }
        }

        // Calculate cache hit rate
        const hits = this.callCounts.get('cache_hit') || 0;
        const misses = this.callCounts.get('cache_miss') || 0;
        const total = hits + misses;
        stats.cacheStats.hitRate = total > 0 ? hits / total : 0;

        return stats;
    }

    // ===============================
    // RESOURCE MANAGEMENT
    // ===============================

    async calculateOptimalThreadLimits() {
        try {
            const memoryInfo = await this.getQuickMemoryInfo(); // Use quick version
            const cpuInfo = await this.getCPUInfo();
            
            const availableMemory = memoryInfo.available || memoryInfo.free || os.freemem();
            const totalMemory = memoryInfo.total || os.totalmem();
            const cpuCores = cpuInfo.cores || cpuInfo.cpuCount || os.cpus().length;
            
            const memoryPerThread = 2 * 1024 * 1024;
            const baseSystemMemory = 200 * 1024 * 1024; // Reduced from 500MB
            const usableMemory = Math.max(0, availableMemory - baseSystemMemory);
            
            const maxThreadsByMemory = Math.floor(usableMemory / memoryPerThread);
            const maxThreadsByCPU = cpuCores * 16; // Reduced from 20
            const recommendedThreadsByCPU = cpuCores * 6; // Reduced from 8
            
            const maxSafeThreads = Math.max(1, Math.min(maxThreadsByMemory, maxThreadsByCPU));
            const recommendedThreads = Math.max(1, Math.min(recommendedThreadsByCPU, maxSafeThreads));
            
            return {
                maxSafeThreads,
                recommendedThreads,
                memoryBased: {
                    availableMemory,
                    usableMemory,
                    memoryPerThread,
                    maxThreads: maxThreadsByMemory
                },
                cpuBased: {
                    cores: cpuCores,
                    maxThreads: maxThreadsByCPU,
                    recommendedThreads: recommendedThreadsByCPU
                },
                currentMemoryUsage: memoryInfo.usage || 0,
                platform: this.getPlatformName(),
                calculatedAt: new Date().toISOString(),
                limitingFactor: maxThreadsByMemory < maxThreadsByCPU ? 'memory' : 'cpu'
            };
        } catch (error) {
            console.error('Error calculating thread limits:', error);
            const cpuCores = os.cpus().length;
            return {
                maxSafeThreads: cpuCores * 2, // More conservative fallback
                recommendedThreads: cpuCores,
                error: error.message
            };
        }
    }

    // ===============================
    // UTILITY METHODS
    // ===============================

    getPlatformInfo() {
        return {
            platform: this.platform,
            platformName: this.getPlatformName(),
            arch: os.arch(),
            release: os.release(),
            hostname: os.hostname(),
            nodeVersion: process.version
        };
    }

    getPlatformName() {
        const platformNames = {
            'win32': 'Windows',
            'linux': 'Linux',
            'darwin': 'macOS',
            'freebsd': 'FreeBSD'
        };
        return platformNames[this.platform] || 'Unknown';
    }

    getFallbackBasicInfo() {
        return {
            hostname: os.hostname(),
            platform: os.platform(),
            architecture: os.arch(),
            release: os.release(),
            uptime: os.uptime(),
            totalMemory: os.totalmem(),
            freeMemory: os.freemem(),
            cpuCount: os.cpus().length,
            cpuModel: os.cpus()[0]?.model || 'Unknown',
            loadAverage: os.loadavg(),
            nodeVersion: process.version
        };
    }

    // ===============================
    // CLEANUP
    // ===============================

    cleanup() {
        try {
            console.log('🧹 Starting optimized system info cleanup...');
            
            // Stop monitoring
            this.stopMonitoring();
            
            // Clear all caches
            this.clearAllCaches();
            
            // Clear performance tracking
            this.callCounts.clear();
            this.executionTimes.clear();
            
            // Remove all listeners
            this.removeAllListeners();
            
            console.log('✅ Optimized system info cleanup completed');
        } catch (error) {
            console.error('❌ Error during optimized system info cleanup:', error);
        }
    }
}

// Optimized basic system info for fallback
class OptimizedBasicSystemInfo {
    async getBasicSystemInfo() {
        return {
            hostname: os.hostname(),
            platform: os.platform(),
            architecture: os.arch(),
            release: os.release(),
            uptime: os.uptime(),
            totalMemory: os.totalmem(),
            freeMemory: os.freemem(),
            cpuCount: os.cpus().length,
            cpuModel: os.cpus()[0]?.model || 'Unknown',
            loadAverage: os.loadavg(),
            nodeVersion: process.version
        };
    }

    async getAllSystemInfo() {
        const basicInfo = await this.getBasicSystemInfo();
        return {
            timestamp: new Date().toISOString(),
            basic: basicInfo,
            cpu: {
                cpuCores: os.cpus(),
                cpuCount: os.cpus().length,
                cpuModel: os.cpus()[0]?.model || 'Unknown',
                loadAverage: os.loadavg()
            },
            memory: {
                totalPhysical: os.totalmem(),
                freePhysical: os.freemem(),
                usedPhysical: os.totalmem() - os.freemem(),
                memoryUsagePercent: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2)
            },
            platform: {
                platform: os.platform(),
                arch: os.arch(),
                release: os.release(),
                hostname: os.hostname()
            },
            message: 'Optimized basic system information only'
        };
    }

    async getCPUInfo() {
        const cpus = os.cpus();
        return {
            cpuCores: cpus,
            cpuCount: cpus.length,
            cpuModel: cpus[0]?.model || 'Unknown',
            loadAverage: os.loadavg(),
            cpuUsage: 0
        };
    }

    async getMemoryInfo() {
        const total = os.totalmem();
        const free = os.freemem();
        const used = total - free;
        
        return {
            totalPhysical: total,
            freePhysical: free,
            usedPhysical: used,
            available: free,
            memoryUsagePercent: ((used / total) * 100).toFixed(2),
            processMemory: process.memoryUsage()
        };
    }

    async startRealTimeMonitoring(callback, interval = 5000) {
        const monitor = async () => {
            try {
                const memInfo = await this.getMemoryInfo();
                
                const data = {
                    timestamp: new Date().toISOString(),
                    cpu: {
                        usage: 0,
                        cores: os.cpus().length,
                        loadAverage: os.loadavg()
                    },
                    memory: {
                        total: memInfo.totalPhysical,
                        free: memInfo.freePhysical,
                        used: memInfo.usedPhysical,
                        usage: parseFloat(memInfo.memoryUsagePercent)
                    },
                    uptime: os.uptime(),
                    platform: 'Optimized Basic'
                };
                
                if (callback && typeof callback === 'function') {
                    callback(data);
                }
            } catch (error) {
                console.error('Error in optimized basic monitoring:', error);
            }
        };

        await monitor();
        const intervalId = setInterval(monitor, interval);
        
        return {
            stop: () => {
                clearInterval(intervalId);
                console.log('Optimized basic monitoring stopped');
            }
        };
    }
}

module.exports = OptimizedSystemInfoManager;