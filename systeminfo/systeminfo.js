const os = require('os');
const path = require('path');
const EventEmitter = require('events');

class SystemInfoManager extends EventEmitter {
    constructor() {
        super();
        this.platform = os.platform();
        this.systemInfo = null;
        this.monitoringSession = null;
        this.memoryCache = null;
        this.memoryCacheTime = 0;
        this.lastMonitoringData = null;
        this.CACHE_DURATION = 2000; // 2 seconds cache for memory info
        this.initializeSystemInfo();
    }

    // Initialize the appropriate system info class based on platform
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
                    this.systemInfo = new BasicSystemInfo();
            }
        } catch (error) {
            console.error('Error initializing system info:', error);
            // Fallback to basic system info
            this.systemInfo = new BasicSystemInfo();
        }
    }

    // Get platform information
    getPlatformInfo() {
        return {
            platform: this.platform,
            platformName: this.getPlatformName(),
            arch: os.arch(),
            release: os.release(),
            hostname: os.hostname(),
            nodeVersion: process.version,
            electronVersion: process.versions.electron || 'Not running in Electron'
        };
    }

    // Get human-readable platform name
    getPlatformName() {
        const platformNames = {
            'win32': 'Windows',
            'linux': 'Linux',
            'darwin': 'macOS',
            'freebsd': 'FreeBSD',
            'openbsd': 'OpenBSD',
            'sunos': 'SunOS'
        };
        return platformNames[this.platform] || 'Unknown';
    }

    // Get basic system information (works on all platforms)
    async getBasicInfo() {
        try {
            if (this.systemInfo && typeof this.systemInfo.getBasicSystemInfo === 'function') {
                return await this.systemInfo.getBasicSystemInfo();
            } else {
                return this.getFallbackBasicInfo();
            }
        } catch (error) {
            console.error('Error getting basic info:', error);
            return this.getFallbackBasicInfo();
        }
    }

    // Fallback basic info using Node.js os module
    getFallbackBasicInfo() {
        return {
            hostname: os.hostname(),
            platform: os.platform(),
            architecture: os.arch(),
            release: os.release(),
            uptime: os.uptime(),
            userInfo: os.userInfo(),
            homeDirectory: os.homedir(),
            tempDirectory: os.tmpdir(),
            totalMemory: os.totalmem(),
            freeMemory: os.freemem(),
            cpuCount: os.cpus().length,
            cpuModel: os.cpus()[0]?.model || 'Unknown',
            loadAverage: os.loadavg(),
            memoryUsage: process.memoryUsage(),
            nodeVersion: process.version
        };
    }

    // Get comprehensive system information - FIXED
    async getAllSystemInfo() {
        try {
            const platformInfo = this.getPlatformInfo();
            
            if (this.systemInfo && typeof this.systemInfo.getAllSystemInfo === 'function') {
                const detailedInfo = await this.systemInfo.getAllSystemInfo();
                return {
                    ...detailedInfo,
                    platform: platformInfo
                };
            } else {
                // Fallback to basic info
                const basicInfo = await this.getBasicInfo();
                return {
                    timestamp: new Date().toISOString(),
                    platform: platformInfo,
                    basic: basicInfo,
                    message: `Detailed system info not available for ${this.getPlatformName()}`
                };
            }
        } catch (error) {
            console.error('Error getting all system info:', error);
            throw error;
        }
    }

    // Alias for compatibility
    async getSystemInfo() {
        return await this.getAllSystemInfo();
    }

    // Get CPU information - IMPROVED
    async getCPUInfo() {
        try {
            if (this.systemInfo && typeof this.systemInfo.getCPUInfo === 'function') {
                const platformCpuInfo = await this.systemInfo.getCPUInfo();
                
                // Ensure we always return consistent format
                return {
                    cpuCores: platformCpuInfo.cpuCores || os.cpus(),
                    cpuCount: platformCpuInfo.cpuCount || platformCpuInfo.cpuCores?.length || os.cpus().length,
                    cores: platformCpuInfo.cpuCount || platformCpuInfo.cpuCores?.length || os.cpus().length, // For compatibility
                    cpuModel: platformCpuInfo.cpuModel || os.cpus()[0]?.model || 'Unknown',
                    model: platformCpuInfo.cpuModel || os.cpus()[0]?.model || 'Unknown', // For compatibility
                    loadAverage: os.loadavg(),
                    cpuUsage: platformCpuInfo.cpuUsage || 0,
                    usage: platformCpuInfo.cpuUsage || 0 // For compatibility
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
                    cpuUsage: 0, // Can't calculate without platform-specific tools
                    usage: 0
                };
            }
        } catch (error) {
            console.error('Error getting CPU info:', error);
            // Return safe fallback
            const cpus = os.cpus();
            return {
                cpuCores: cpus,
                cpuCount: cpus.length,
                cores: cpus.length,
                cpuModel: 'Unknown',
                model: 'Unknown',
                loadAverage: [0, 0, 0],
                cpuUsage: 0,
                usage: 0,
                error: error.message
            };
        }
    }

    // Get memory information - IMPROVED with caching
    async getMemoryInfo() {
        try {
            if (this.systemInfo && typeof this.systemInfo.getMemoryInfo === 'function') {
                const platformMemInfo = await this.systemInfo.getMemoryInfo();
                
                // Ensure consistent format
                const total = platformMemInfo.totalPhysical || platformMemInfo.total || os.totalmem();
                const free = platformMemInfo.freePhysical || platformMemInfo.free || os.freemem();
                const available = platformMemInfo.available || free; // Available memory (includes cache/buffers on Linux)
                const used = total - free;
                
                return {
                    totalPhysical: total,
                    total: total,
                    freePhysical: free,
                    free: free,
                    available: available, // This is key for accurate resource calculation
                    usedPhysical: used,
                    used: used,
                    memoryUsagePercent: ((used / total) * 100).toFixed(2),
                    usage: parseFloat(((used / total) * 100).toFixed(2)), // For compatibility
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
                    available: free, // Fallback: assume free = available
                    usedPhysical: used,
                    used: used,
                    memoryUsagePercent: ((used / total) * 100).toFixed(2),
                    usage: parseFloat(((used / total) * 100).toFixed(2)),
                    processMemory: process.memoryUsage(),
                    buffers: 0,
                    cached: 0
                };
            }
        } catch (error) {
            console.error('Error getting memory info:', error);
            
            // Safe fallback
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
                error: error.message
            };
        }
    }

    // Get cached memory info to prevent rapid API calls
    async getCachedMemoryInfo() {
        const now = Date.now();
        
        // Return cached memory info if still valid
        if (this.memoryCache && (now - this.memoryCacheTime) < this.CACHE_DURATION) {
            return this.memoryCache;
        }
        
        // Get fresh memory info
        try {
            const memoryInfo = await this.getMemoryInfo();
            this.memoryCache = memoryInfo;
            this.memoryCacheTime = now;
            return memoryInfo;
        } catch (error) {
            console.error('Failed to get cached memory info:', error);
            // Return default values
            const total = os.totalmem();
            const free = os.freemem();
            return {
                total: total,
                free: free,
                available: free,
                usage: ((total - free) / total) * 100
            };
        }
    }

    // Clear memory cache when needed
    clearMemoryCache() {
        this.memoryCache = null;
        this.memoryCacheTime = 0;
    }

    // Get disk information
    async getDiskInfo() {
        try {
            if (this.systemInfo && typeof this.systemInfo.getDiskInfo === 'function') {
                return await this.systemInfo.getDiskInfo();
            } else {
                return { message: 'Disk info not available for this platform' };
            }
        } catch (error) {
            console.error('Error getting disk info:', error);
            return { error: error.message };
        }
    }

    // Get network information
    async getNetworkInfo() {
        try {
            if (this.systemInfo && typeof this.systemInfo.getNetworkInfo === 'function') {
                return await this.systemInfo.getNetworkInfo();
            } else {
                return {
                    networkInterfaces: os.networkInterfaces(),
                    message: 'Detailed network info not available for this platform'
                };
            }
        } catch (error) {
            console.error('Error getting network info:', error);
            return { error: error.message };
        }
    }

    // Get running processes - FIXED method name
    async getRunningProcesses() {
        try {
            if (this.systemInfo && typeof this.systemInfo.getRunningProcesses === 'function') {
                return await this.systemInfo.getRunningProcesses();
            } else {
                return { message: 'Process info not available for this platform' };
            }
        } catch (error) {
            console.error('Error getting processes:', error);
            return { error: error.message };
        }
    }

    // Alias for compatibility with main.js
    async getProcesses() {
        return await this.getRunningProcesses();
    }

    // Get system logs
    async getSystemLogs(logType = 'system', maxEvents = 50) {
        try {
            if (this.systemInfo && typeof this.systemInfo.getSystemLogs === 'function') {
                return await this.systemInfo.getSystemLogs(logType, maxEvents);
            } else {
                return { message: 'System logs not available for this platform' };
            }
        } catch (error) {
            console.error('Error getting system logs:', error);
            return { error: error.message };
        }
    }

    // Start real-time monitoring - FIXED VERSION
    async startMonitoring(interval = 5000) {
        try {
            // Stop any existing monitoring
            if (this.monitoringSession) {
                this.stopMonitoring();
            }

            console.log(`Starting monitoring with interval: ${interval}ms`);

            if (this.systemInfo && typeof this.systemInfo.startRealTimeMonitoring === 'function') {
                // Create a callback function that emits events
                const monitoringCallback = (data) => {
                    try {
                        // Emit the data using EventEmitter
                        this.emit('data', data);
                        // Also store for direct access
                        this.lastMonitoringData = data;
                    } catch (error) {
                        console.error('Error in monitoring callback:', error);
                    }
                };

                // Start platform-specific monitoring with correct parameter order
                this.monitoringSession = await this.systemInfo.startRealTimeMonitoring(
                    monitoringCallback,  // callback function first
                    interval            // interval second
                );
            } else {
                // Fallback monitoring using basic Node.js info
                const monitor = async () => {
                    try {
                        const memInfo = await this.getCachedMemoryInfo();
                        const cpuInfo = await this.getCPUInfo();
                        
                        const data = {
                            timestamp: new Date().toISOString(),
                            cpu: {
                                usage: cpuInfo.cpuUsage || 0,
                                cores: cpuInfo.cpuCount || os.cpus().length,
                                loadAverage: os.loadavg()
                            },
                            memory: {
                                total: memInfo.total,
                                free: memInfo.free,
                                available: memInfo.available,
                                used: memInfo.used,
                                usage: memInfo.usage,
                                usagePercent: memInfo.memoryUsagePercent
                            },
                            uptime: os.uptime(),
                            platform: this.getPlatformName()
                        };
                        
                        this.emit('data', data);
                        this.lastMonitoringData = data;
                    } catch (error) {
                        console.error('Error in fallback monitoring:', error);
                    }
                };

                await monitor(); // Initial call
                const intervalId = setInterval(monitor, interval);
                
                this.monitoringSession = {
                    stop: () => clearInterval(intervalId)
                };
            }

            console.log('Monitoring started successfully');
            return this.monitoringSession;
        } catch (error) {
            console.error('Error starting monitoring:', error);
            throw error;
        }
    }

    // Stop monitoring
    stopMonitoring() {
        try {
            if (this.monitoringSession && typeof this.monitoringSession.stop === 'function') {
                this.monitoringSession.stop();
                console.log('Monitoring session stopped');
            }

            if (this.systemInfo && typeof this.systemInfo.stopMonitoring === 'function') {
                this.systemInfo.stopMonitoring();
                console.log('Platform monitoring stopped');
            }

            this.monitoringSession = null;
            this.emit('stopped');
        } catch (error) {
            console.error('Error stopping monitoring:', error);
        }
    }

    // Get performance metrics for optimization - IMPROVED
    async getPerformanceMetrics() {
        try {
            const [cpuInfo, memoryInfo, diskInfo] = await Promise.all([
                this.getCPUInfo(),
                this.getCachedMemoryInfo(), // Use cached version for better performance
                this.getDiskInfo()
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
                        usage: parseFloat(memoryInfo.memoryUsagePercent || memoryInfo.usage || 0),
                        total: memoryInfo.totalPhysical || memoryInfo.total || os.totalmem(),
                        free: memoryInfo.freePhysical || memoryInfo.free || os.freemem(),
                        available: memoryInfo.available || memoryInfo.free || os.freemem(),
                        processUsage: process.memoryUsage()
                    },
                    disk: Array.isArray(diskInfo) ? diskInfo.map(disk => ({
                        drive: disk.drive,
                        usage: parseFloat(disk.usagePercent || 0),
                        free: disk.freeSpace,
                        total: disk.totalSize
                    })) : [],
                    uptime: os.uptime(),
                    platform: this.getPlatformName()
                },
                recommendations: await this.generateOptimizationRecommendations(cpuInfo, memoryInfo, diskInfo)
            };
        } catch (error) {
            console.error('Error getting performance metrics:', error);
            return { 
                error: error.message,
                timestamp: new Date().toISOString(),
                performance: {
                    cpu: { usage: 0, cores: os.cpus().length, loadAverage: [0, 0, 0] },
                    memory: { usage: 0, total: os.totalmem(), free: os.freemem(), available: os.freemem() },
                    disk: [],
                    uptime: os.uptime(),
                    platform: this.getPlatformName()
                }
            };
        }
    }

    // Generate optimization recommendations - IMPROVED
    async generateOptimizationRecommendations(cpuInfo, memoryInfo, diskInfo) {
        const recommendations = [];

        try {
            // CPU recommendations
            const cpuUsage = cpuInfo.cpuUsage || cpuInfo.usage || 0;
            if (cpuUsage > 80) {
                recommendations.push({
                    type: 'CPU',
                    level: 'high',
                    message: 'High CPU usage detected. Consider reducing attack intensity or concurrent processes.'
                });
            }

            // Memory recommendations
            const memUsage = parseFloat(memoryInfo.memoryUsagePercent || memoryInfo.usage || 0);
            if (memUsage > 85) {
                recommendations.push({
                    type: 'Memory',
                    level: 'high',
                    message: 'High memory usage detected. Consider closing unnecessary applications or reducing attack parameters.'
                });
            } else if (memUsage > 70) {
                recommendations.push({
                    type: 'Memory',
                    level: 'medium',
                    message: 'Moderate memory usage. Monitor for potential performance issues.'
                });
            }

            // Disk recommendations
            if (Array.isArray(diskInfo)) {
                diskInfo.forEach(disk => {
                    const usage = parseFloat(disk.usagePercent || 0);
                    if (usage > 90) {
                        recommendations.push({
                            type: 'Disk',
                            level: 'high',
                            message: `Disk ${disk.drive} is almost full (${usage}%). Consider freeing up space.`
                        });
                    }
                });
            }

            // Thread optimization recommendations
            const cores = cpuInfo.cpuCores?.length || cpuInfo.cpuCount || cpuInfo.cores || os.cpus().length;
            recommendations.push({
                type: 'Optimization',
                level: 'info',
                message: `For optimal performance with ${cores} CPU cores, use 8-16 threads per core (${cores * 8}-${cores * 16} total threads).`
            });

            // General recommendations
            if (recommendations.filter(r => r.level === 'high').length === 0) {
                recommendations.push({
                    type: 'System',
                    level: 'good',
                    message: 'System performance is optimal for stress testing operations.'
                });
            }

            return recommendations;
        } catch (error) {
            console.error('Error generating recommendations:', error);
            return [{
                type: 'Error',
                level: 'warning',
                message: 'Unable to generate performance recommendations: ' + error.message
            }];
        }
    }

    // =================== RESOURCE VALIDATION METHODS ===================

    // Calculate safe thread limits based on available resources - IMPROVED
    async calculateOptimalThreadLimits() {
        try {
            const memoryInfo = await this.getCachedMemoryInfo();
            const cpuInfo = await this.getCPUInfo();
            
            // Use available memory (includes cache/buffers) for more accurate calculation
            const availableMemory = memoryInfo.available || memoryInfo.free || os.freemem();
            const totalMemory = memoryInfo.total || os.totalmem();
            const cpuCores = cpuInfo.cores || cpuInfo.cpuCount || os.cpus().length;
            
            // Memory calculations
            const memoryPerThread = 2 * 1024 * 1024; // 2MB per thread (conservative)
            const baseSystemMemory = 500 * 1024 * 1024; // Reserve 500MB for system
            const usableMemory = Math.max(0, availableMemory - baseSystemMemory);
            
            // Calculate thread limits
            const maxThreadsByMemory = Math.floor(usableMemory / memoryPerThread);
            const maxThreadsByCPU = cpuCores * 20; // Allow up to 20 threads per core
            const recommendedThreadsByCPU = cpuCores * 8; // Optimal: 8 threads per core
            
            // Use the most restrictive limit for safety
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
            // Fallback to conservative limits
            const cpuCores = os.cpus().length;
            return {
                maxSafeThreads: cpuCores * 4,
                recommendedThreads: cpuCores * 2,
                memoryBased: {
                    availableMemory: os.freemem(),
                    usableMemory: os.freemem() * 0.7,
                    memoryPerThread: 2 * 1024 * 1024,
                    maxThreads: Math.floor((os.freemem() * 0.7) / (2 * 1024 * 1024))
                },
                cpuBased: {
                    cores: cpuCores,
                    maxThreads: cpuCores * 16,
                    recommendedThreads: cpuCores * 8
                },
                currentMemoryUsage: 'Unknown',
                platform: this.getPlatformName(),
                calculatedAt: new Date().toISOString(),
                limitingFactor: 'fallback'
            };
        }
    }

    // Validate if attack parameters are feasible - MAIN VALIDATION METHOD
    async validateAttackResources(threadCount, targetCount = 1) {
        try {
            const limits = await this.calculateOptimalThreadLimits();
            const totalThreads = threadCount * targetCount;
            const requiredMemory = totalThreads * limits.memoryBased.memoryPerThread;
            
            // Validation logic
            const isValid = totalThreads <= limits.maxSafeThreads;
            const isRecommended = totalThreads <= limits.recommendedThreads;
            
            // Generate specific recommendations
            const recommendations = [];
            
            if (!isValid) {
                if (limits.limitingFactor === 'memory') {
                    recommendations.push({
                        type: 'memory',
                        level: 'critical',
                        message: `Insufficient resources: memory. Requested ${totalThreads} threads requires ${this.formatBytes(requiredMemory)} but only ${this.formatBytes(limits.memoryBased.usableMemory)} available.`
                    });
                } else {
                    recommendations.push({
                        type: 'cpu',
                        level: 'critical',  
                        message: `Insufficient resources: CPU cores. ${totalThreads} threads exceeds safe limit for ${limits.cpuBased.cores} cores.`
                    });
                }
                
                recommendations.push({
                    type: 'suggestion',
                    level: 'info',
                    message: `Reduce threads to ${limits.recommendedThreads} or fewer for stable operation.`
                });
            } else if (!isRecommended) {
                recommendations.push({
                    type: 'performance',
                    level: 'warning',
                    message: `${totalThreads} threads may impact performance. Recommended: ${limits.recommendedThreads} threads for optimal results.`
                });
            }
            
            return {
                isValid,
                isRecommended,
                totalThreadsRequested: totalThreads,
                maxSafeThreads: limits.maxSafeThreads,
                recommendedThreads: limits.recommendedThreads,
                requiredMemory,
                availableMemory: limits.memoryBased.availableMemory,
                memoryUsagePercent: (requiredMemory / limits.memoryBased.availableMemory * 100).toFixed(1),
                systemInfo: {
                    cpuCores: limits.cpuBased.cores,
                    currentMemoryUsage: limits.currentMemoryUsage,
                    platform: limits.platform,
                    limitingFactor: limits.limitingFactor
                },
                recommendations,
                limits,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error validating attack resources:', error);
            return {
                isValid: false,
                isRecommended: false,
                error: error.message,
                recommendations: [{ 
                    type: 'error', 
                    level: 'critical',
                    message: 'Unable to validate system resources: ' + error.message 
                }],
                timestamp: new Date().toISOString()
            };
        }
    }

    // Get dynamic thread limits for UI components
    async getDynamicThreadLimits() {
        try {
            const limits = await this.calculateOptimalThreadLimits();
            
            return {
                // For single attacks
                single: {
                    min: 1,
                    max: limits.maxSafeThreads,
                    recommended: Math.min(limits.recommendedThreads, 100), // Cap at 100 for UI
                    default: Math.min(Math.floor(limits.recommendedThreads / 2), 50)
                },
                // For multi-target attacks (per target)
                multi: {
                    min: 1,
                    max: Math.floor(limits.maxSafeThreads / 4), // Assume average 4 targets
                    recommended: Math.min(Math.floor(limits.recommendedThreads / 4), 50),
                    default: Math.min(Math.floor(limits.recommendedThreads / 8), 20)
                },
                systemInfo: {
                    cpuCores: limits.cpuBased.cores,
                    availableMemoryGB: (limits.memoryBased.availableMemory / (1024 * 1024 * 1024)).toFixed(1),
                    platform: limits.platform,
                    limitingFactor: limits.limitingFactor
                },
                calculated: limits.calculatedAt
            };
        } catch (error) {
            console.error('Error getting dynamic thread limits:', error);
            // Return safe fallback values
            const cpuCores = os.cpus().length;
            return {
                single: { min: 1, max: cpuCores * 4, recommended: cpuCores * 2, default: cpuCores },
                multi: { min: 1, max: cpuCores, recommended: Math.max(1, cpuCores / 2), default: Math.max(1, cpuCores / 4) },
                systemInfo: { 
                    cpuCores: cpuCores, 
                    availableMemoryGB: (os.freemem() / (1024 * 1024 * 1024)).toFixed(1),
                    platform: this.getPlatformName(),
                    limitingFactor: 'fallback'
                },
                calculated: new Date().toISOString()
            };
        }
    }

    // Format bytes for human readability
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    // =================== EXPORT AND UTILITY METHODS ===================

    // Export system information
    async exportSystemInfo(format = 'json') {
        try {
            const systemInfo = await this.getAllSystemInfo();
            
            switch (format.toLowerCase()) {
                case 'json':
                    return JSON.stringify(systemInfo, null, 2);
                
                case 'txt':
                    return this.formatSystemInfoAsText(systemInfo);
                
                default:
                    throw new Error(`Unsupported export format: ${format}`);
            }
        } catch (error) {
            console.error('Error exporting system info:', error);
            throw error;
        }
    }

    // Format system info as readable text
    formatSystemInfoAsText(systemInfo) {
        let text = 'SYSTEM INFORMATION REPORT\n';
        text += '='.repeat(50) + '\n\n';
        
        text += `Generated: ${systemInfo.timestamp}\n`;
        text += `Platform: ${systemInfo.platform?.platformName || 'Unknown'}\n\n`;

        // Basic Info
        if (systemInfo.basic) {
            text += 'BASIC INFORMATION\n';
            text += '-'.repeat(20) + '\n';
            text += `Hostname: ${systemInfo.basic.hostname}\n`;
            text += `Architecture: ${systemInfo.basic.architecture}\n`;
            text += `Uptime: ${Math.floor(systemInfo.basic.uptime / 3600)} hours\n\n`;
        }

        return text;
    }

    // Clean up resources and caches
    cleanup() {
        try {
            // Stop monitoring if running
            this.stopMonitoring();
            
            // Clear caches
            this.clearMemoryCache();
            this.lastMonitoringData = null;
            
            // Remove all listeners
            this.removeAllListeners();
            
            console.log('SystemInfoManager cleanup completed');
        } catch (error) {
            console.error('Error during SystemInfoManager cleanup:', error);
        }
    }

    // Check if system is ready for attacks
    async isSystemReady() {
        try {
            const limits = await this.calculateOptimalThreadLimits();
            const memoryInfo = await this.getCachedMemoryInfo();
            
            return {
                ready: limits.maxSafeThreads > 0 && memoryInfo.usage < 90,
                maxThreads: limits.maxSafeThreads,
                recommendedThreads: limits.recommendedThreads,
                memoryUsage: memoryInfo.usage,
                warnings: []
            };
        } catch (error) {
            return {
                ready: false,
                error: error.message,
                warnings: ['System health check failed']
            };
        }
    }

    // Get real-time system status
    getCurrentSystemStatus() {
        return {
            lastUpdate: this.lastMonitoringData?.timestamp || 'Never',
            monitoring: !!this.monitoringSession,
            cacheStatus: {
                memoryCache: !!this.memoryCache,
                memoryCacheAge: this.memoryCache ? Date.now() - this.memoryCacheTime : 0
            },
            platform: this.getPlatformName()
        };
    }
}

// Basic fallback system info class for unsupported platforms
class BasicSystemInfo {
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
            message: 'Basic system information only (platform-specific details unavailable)'
        };
    }

    async getCPUInfo() {
        const cpus = os.cpus();
        return {
            cpuCores: cpus,
            cpuCount: cpus.length,
            cpuModel: cpus[0]?.model || 'Unknown',
            loadAverage: os.loadavg(),
            cpuUsage: 0 // Cannot determine without platform-specific tools
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
            available: free, // Assume free = available for basic implementation
            memoryUsagePercent: ((used / total) * 100).toFixed(2),
            processMemory: process.memoryUsage()
        };
    }

    async getNetworkInfo() {
        return {
            networkInterfaces: os.networkInterfaces(),
            message: 'Basic network interface information only'
        };
    }

    async getRunningProcesses() {
        return {
            message: 'Process enumeration not available in basic mode',
            currentProcess: {
                pid: process.pid,
                memory: process.memoryUsage(),
                uptime: process.uptime()
            }
        };
    }

    async getDiskInfo() {
        return {
            message: 'Disk information not available in basic mode'
        };
    }

    async getSystemLogs() {
        return {
            message: 'System logs not available in basic mode'
        };
    }

    async startRealTimeMonitoring(callback, interval = 5000) {
        const monitor = async () => {
            try {
                const cpuInfo = await this.getCPUInfo();
                const memInfo = await this.getMemoryInfo();
                
                const data = {
                    timestamp: new Date().toISOString(),
                    cpu: {
                        usage: 0, // Cannot determine without platform tools
                        cores: cpuInfo.cpuCount,
                        loadAverage: cpuInfo.loadAverage
                    },
                    memory: {
                        total: memInfo.totalPhysical,
                        free: memInfo.freePhysical,
                        used: memInfo.usedPhysical,
                        usage: parseFloat(memInfo.memoryUsagePercent)
                    },
                    uptime: os.uptime(),
                    platform: 'Basic'
                };
                
                if (callback && typeof callback === 'function') {
                    callback(data);
                }
            } catch (error) {
                console.error('Error in basic monitoring:', error);
            }
        };

        // Initial call
        await monitor();
        
        // Set up interval
        const intervalId = setInterval(monitor, interval);
        
        return {
            stop: () => {
                clearInterval(intervalId);
                console.log('Basic monitoring stopped');
            }
        };
    }

    stopMonitoring() {
        // Nothing to stop in basic implementation
        console.log('Basic monitoring stop called');
    }
}

module.exports = SystemInfoManager;