const os = require('os');
const path = require('path');

class SystemInfoManager {
    constructor() {
        this.platform = os.platform();
        this.systemInfo = null;
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
                    // TODO: Implement Linux system info
                    const LinuxSystemInfo = require('./systeminfo_linux.js');
                    this.systemInfo = new LinuxSystemInfo();
                    break;
                case 'darwin':
                    // TODO: Implement macOS system info
                    const MacSystemInfo = require('./systeminfo_mac.js');
                    this.systemInfo = new MacSystemInfo();
                    break;
                default:
                    throw new Error(`Unsupported platform: ${this.platform}`);
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

    // Get comprehensive system information
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

    // Get CPU information
    async getCPUInfo() {
        try {
            if (this.systemInfo && typeof this.systemInfo.getCPUInfo === 'function') {
                return await this.systemInfo.getCPUInfo();
            } else {
                return {
                    cpuCores: os.cpus(),
                    cpuCount: os.cpus().length,
                    cpuModel: os.cpus()[0]?.model || 'Unknown',
                    loadAverage: os.loadavg()
                };
            }
        } catch (error) {
            console.error('Error getting CPU info:', error);
            return { error: error.message };
        }
    }

    // Get memory information
    async getMemoryInfo() {
        try {
            if (this.systemInfo && typeof this.systemInfo.getMemoryInfo === 'function') {
                return await this.systemInfo.getMemoryInfo();
            } else {
                const total = os.totalmem();
                const free = os.freemem();
                const used = total - free;
                return {
                    totalPhysical: total,
                    freePhysical: free,
                    usedPhysical: used,
                    memoryUsagePercent: ((used / total) * 100).toFixed(2),
                    processMemory: process.memoryUsage()
                };
            }
        } catch (error) {
            console.error('Error getting memory info:', error);
            return { error: error.message };
        }
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

    // Get running processes
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

    // Start real-time monitoring
    async startMonitoring(callback, interval = 5000) {
        try {
            if (this.systemInfo && typeof this.systemInfo.startRealTimeMonitoring === 'function') {
                return await this.systemInfo.startRealTimeMonitoring(callback, interval);
            } else {
                // Fallback monitoring using basic Node.js info
                const monitor = () => {
                    const data = {
                        timestamp: new Date().toISOString(),
                        cpu: os.loadavg(),
                        memory: {
                            total: os.totalmem(),
                            free: os.freemem(),
                            used: os.totalmem() - os.freemem(),
                            usage: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2)
                        },
                        uptime: os.uptime()
                    };
                    callback(data);
                };

                monitor(); // Initial call
                const intervalId = setInterval(monitor, interval);
                
                return {
                    stop: () => clearInterval(intervalId)
                };
            }
        } catch (error) {
            console.error('Error starting monitoring:', error);
            throw error;
        }
    }

    // Get performance metrics for optimization
    async getPerformanceMetrics() {
        try {
            const [cpuInfo, memoryInfo, diskInfo] = await Promise.all([
                this.getCPUInfo(),
                this.getMemoryInfo(),
                this.getDiskInfo()
            ]);

            return {
                timestamp: new Date().toISOString(),
                performance: {
                    cpu: {
                        usage: cpuInfo.cpuUsage || 0,
                        cores: cpuInfo.cpuCores?.length || os.cpus().length,
                        loadAverage: os.loadavg()
                    },
                    memory: {
                        usage: parseFloat(memoryInfo.memoryUsagePercent || 0),
                        total: memoryInfo.totalPhysical || os.totalmem(),
                        free: memoryInfo.freePhysical || os.freemem(),
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
                recommendations: this.generateOptimizationRecommendations(cpuInfo, memoryInfo, diskInfo)
            };
        } catch (error) {
            console.error('Error getting performance metrics:', error);
            return { error: error.message };
        }
    }

    // Generate optimization recommendations
    generateOptimizationRecommendations(cpuInfo, memoryInfo, diskInfo) {
        const recommendations = [];

        // CPU recommendations
        if (cpuInfo.cpuUsage > 80) {
            recommendations.push({
                type: 'CPU',
                level: 'high',
                message: 'High CPU usage detected. Consider reducing attack intensity or concurrent processes.'
            });
        }

        // Memory recommendations
        const memUsage = parseFloat(memoryInfo.memoryUsagePercent || 0);
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

        // General recommendations
        if (recommendations.length === 0) {
            recommendations.push({
                type: 'System',
                level: 'good',
                message: 'System performance is optimal for stress testing operations.'
            });
        }

        return recommendations;
    }
}

// Basic fallback system info class
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
            cpuModel: os.cpus()[0]?.model || 'Unknown'
        };
    }
}

module.exports = SystemInfoManager;