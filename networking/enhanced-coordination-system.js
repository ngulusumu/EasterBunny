//networking/enhanced-coordination-system.js
const crypto = require('crypto');
const os = require('os');
const path = require('path');

// Import your existing system info modules
const WindowsSystemInfo = require('../systeminfo/systeminfo_win');
const LinuxSystemInfo = require('../systeminfo/systeminfo_linux'); 
const MacSystemInfo = require('../systeminfo/systeminfo_mac');

class EnhancedMachineStatusManager {
    constructor(keyManager) {
        this.keyManager = keyManager;
        this.onlineMachines = new Map();
        this.lastHeartbeat = new Map();
        this.statusCache = new Map();
        this.heartbeatInterval = 30000;
        this.timeoutThreshold = 90000;
        
        // Initialize platform-specific system info
        this.systemInfo = this.initializeSystemInfo();
        this.cachedSystemInfo = null;
        this.cacheTimestamp = null;
        this.cacheTimeout = 60000; // Cache for 1 minute
        
        this.startHeartbeatMonitoring();
    }

    initializeSystemInfo() {
        const platform = os.platform();
        
        switch (platform) {
            case 'win32':
                return new WindowsSystemInfo();
            case 'linux':
                return new LinuxSystemInfo();
            case 'darwin':
                return new MacSystemInfo();
            default:
                console.warn(`Unsupported platform: ${platform}, using basic info`);
                return null;
        }
    }

    async getDetailedSystemInfo() {
        // Check if we have cached info that's still valid
        const now = Date.now();
        if (this.cachedSystemInfo && this.cacheTimestamp && 
            (now - this.cacheTimestamp) < this.cacheTimeout) {
            return this.cachedSystemInfo;
        }

        try {
            let systemData;
            
            if (this.systemInfo) {
                // Use your detailed system info modules
                systemData = await this.systemInfo.getAllSystemInfo();
            } else {
                // Fallback to basic Node.js os module
                systemData = this.getBasicSystemInfo();
            }

            // Cache the result
            this.cachedSystemInfo = systemData;
            this.cacheTimestamp = now;
            
            return systemData;
            
        } catch (error) {
            console.error('Error getting detailed system info:', error);
            // Fallback to basic info on error
            return this.getBasicSystemInfo();
        }
    }

    getBasicSystemInfo() {
        // Fallback basic system info using Node.js os module
        return {
            timestamp: new Date().toISOString(),
            basic: {
                hostname: os.hostname(),
                platform: os.platform(),
                architecture: os.arch(),
                release: os.release(),
                uptime: os.uptime(),
                nodeVersion: process.version,
                totalMemory: os.totalmem(),
                freeMemory: os.freemem(),
                cpuCount: os.cpus().length,
                cpuModel: os.cpus()[0]?.model || 'Unknown'
            },
            performance: {
                cpuUsage: 0,
                memoryUsage: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2),
                diskUsage: 0
            }
        };
    }

    async createStatusMessage(status) {
        const systemInfo = await this.getDetailedSystemInfo();
        
        // Extract key information for coordination
        const coordinationData = this.extractCoordinationInfo(systemInfo);
        
        const statusData = {
            machineId: this.keyManager.publicKey,
            status: status,
            timestamp: Date.now(),
            capabilities: coordinationData.capabilities,
            performance: coordinationData.performance,
            networkInfo: coordinationData.networkInfo,
            systemSummary: coordinationData.systemSummary
        };

        const message = JSON.stringify(statusData);
        const signature = this.keyManager.signMessage(message);

        return {
            data: statusData,
            signature: signature,
            publicKey: this.keyManager.publicKey
        };
    }

    extractCoordinationInfo(systemInfo) {
        // Extract only relevant info for machine coordination
        const basic = systemInfo.basic || {};
        const cpu = systemInfo.cpu || {};
        const memory = systemInfo.memory || {};
        const performance = systemInfo.performance || {};
        const network = systemInfo.network || [];
        const disks = systemInfo.disks || [];

        return {
            capabilities: {
                platform: basic.platform || os.platform(),
                architecture: basic.architecture || os.arch(),
                cpuModel: cpu.cpuDetails?.[0]?.name || basic.cpuModel || 'Unknown',
                cpuCores: cpu.cpuDetails?.[0]?.cores || basic.cpuCount || os.cpus().length,
                logicalProcessors: cpu.cpuDetails?.[0]?.logicalProcessors || basic.cpuCount || os.cpus().length,
                totalMemory: memory.totalPhysical || basic.totalMemory || os.totalmem(),
                maxClockSpeed: cpu.cpuDetails?.[0]?.maxClockSpeed || 0,
                totalDiskSpace: disks.reduce((total, disk) => total + (disk.totalSize || 0), 0),
                nodeVersion: basic.nodeVersion || process.version,
                systemUptime: basic.uptime || os.uptime()
            },
            performance: {
                cpuUsage: performance.cpuUsage || cpu.cpuUsage || 0,
                memoryUsage: performance.memoryUsage || memory.memoryUsagePercent || 0,
                memoryUsed: memory.usedPhysical || (basic.totalMemory - basic.freeMemory) || 0,
                memoryFree: memory.freePhysical || basic.freeMemory || os.freemem(),
                diskUsage: performance.diskUsage || (disks.length > 0 ? disks[0].usagePercent : 0),
                loadAverage: basic.loadAverage || [0, 0, 0]
            },
            networkInfo: {
                hostname: basic.hostname || os.hostname(),
                adapters: network.map(adapter => ({
                    description: adapter.description || 'Unknown',
                    ipAddress: adapter.ipAddress || 'N/A',
                    macAddress: adapter.macAddress || 'N/A',
                    dhcpEnabled: adapter.dhcpEnabled || false
                })).slice(0, 3), // Limit to 3 adapters
                activeConnections: network.filter(n => n.ipAddress && n.ipAddress !== 'N/A').length
            },
            systemSummary: {
                osVersion: systemInfo.windowsVersion?.caption || `${basic.platform} ${basic.release}`,
                totalProcesses: systemInfo.processes?.length || 0,
                runningServices: systemInfo.services?.filter(s => s.state === 'Running').length || 0,
                totalDisks: disks.length || 0,
                networkAdapters: network.length || 0
            }
        };
    }

    async getSystemHealthScore() {
        try {
            const systemInfo = await this.getDetailedSystemInfo();
            const performance = systemInfo.performance || {};
            
            // Calculate health score based on system metrics
            let healthScore = 100;
            
            // CPU usage impact (0-40% impact)
            const cpuUsage = performance.cpuUsage || 0;
            if (cpuUsage > 80) healthScore -= 40;
            else if (cpuUsage > 60) healthScore -= 25;
            else if (cpuUsage > 40) healthScore -= 10;
            
            // Memory usage impact (0-35% impact)
            const memoryUsage = performance.memoryUsage || 0;
            if (memoryUsage > 90) healthScore -= 35;
            else if (memoryUsage > 80) healthScore -= 20;
            else if (memoryUsage > 70) healthScore -= 10;
            
            // Disk usage impact (0-25% impact)
            const diskUsage = performance.diskUsage || 0;
            if (diskUsage > 95) healthScore -= 25;
            else if (diskUsage > 85) healthScore -= 15;
            else if (diskUsage > 75) healthScore -= 5;
            
            return Math.max(0, Math.min(100, healthScore));
            
        } catch (error) {
            console.error('Error calculating health score:', error);
            return 50; // Default moderate health score
        }
    }

    async getMachineCapabilityScore() {
        try {
            const systemInfo = await this.getDetailedSystemInfo();
            const capabilities = this.extractCoordinationInfo(systemInfo).capabilities;
            
            let score = 0;
            
            // CPU scoring (0-40 points)
            const cpuCores = capabilities.cpuCores || 1;
            score += Math.min(40, cpuCores * 5);
            
            // Memory scoring (0-30 points)
            const memoryGB = (capabilities.totalMemory || 0) / (1024 * 1024 * 1024);
            score += Math.min(30, memoryGB * 2);
            
            // Disk scoring (0-20 points)
            const diskTB = (capabilities.totalDiskSpace || 0) / (1024 * 1024 * 1024 * 1024);
            score += Math.min(20, diskTB * 10);
            
            // Platform scoring (0-10 points)
            const platform = capabilities.platform;
            if (platform === 'win32') score += 8;
            else if (platform === 'linux') score += 10;
            else if (platform === 'darwin') score += 7;
            
            return Math.min(100, score);
            
        } catch (error) {
            console.error('Error calculating capability score:', error);
            return 50;
        }
    }

    async isCapableForTask(taskRequirements) {
        try {
            const systemInfo = await this.getDetailedSystemInfo();
            const capabilities = this.extractCoordinationInfo(systemInfo).capabilities;
            const performance = this.extractCoordinationInfo(systemInfo).performance;
            
            // Check minimum requirements
            const checks = {
                cpuCores: (capabilities.cpuCores || 0) >= (taskRequirements.minCpuCores || 1),
                memory: (capabilities.totalMemory || 0) >= (taskRequirements.minMemory || 0),
                freeMemory: (performance.memoryFree || 0) >= (taskRequirements.minFreeMemory || 0),
                cpuUsage: (performance.cpuUsage || 100) <= (taskRequirements.maxCpuUsage || 100),
                diskSpace: (capabilities.totalDiskSpace || 0) >= (taskRequirements.minDiskSpace || 0),
                platform: !taskRequirements.platform || capabilities.platform === taskRequirements.platform
            };
            
            // All checks must pass
            const capable = Object.values(checks).every(check => check === true);
            
            return {
                capable: capable,
                checks: checks,
                score: capable ? await this.getMachineCapabilityScore() : 0
            };
            
        } catch (error) {
            console.error('Error checking task capability:', error);
            return { capable: false, checks: {}, score: 0 };
        }
    }

    verifyStatusMessage(statusMessage) {
        const { data, signature, publicKey } = statusMessage;
        const message = JSON.stringify(data);
        
        return this.keyManager.verifySignature(message, signature, publicKey);
    }

    updateMachineStatus(machineId, statusMessage) {
        if (!this.verifyStatusMessage(statusMessage)) {
            console.warn(`Invalid status message from machine: ${machineId}`);
            return false;
        }

        const now = Date.now();
        this.onlineMachines.set(machineId, statusMessage.data);
        this.lastHeartbeat.set(machineId, now);
        this.statusCache.set(machineId, statusMessage);

        return true;
    }

    markMachineOffline(machineId) {
        this.onlineMachines.delete(machineId);
        this.lastHeartbeat.delete(machineId);
        this.statusCache.delete(machineId);
    }

    getOnlineMachines() {
        return Array.from(this.onlineMachines.keys());
    }

    getMachineCount() {
        return this.onlineMachines.size;
    }

    getMachinesWithCapability(requirement) {
        const capableMachines = [];
        
        for (const [machineId, statusData] of this.onlineMachines.entries()) {
            const capabilities = statusData.capabilities || {};
            
            let meetsRequirement = true;
            
            if (requirement.minCpuCores && capabilities.cpuCores < requirement.minCpuCores) {
                meetsRequirement = false;
            }
            if (requirement.minMemory && capabilities.totalMemory < requirement.minMemory) {
                meetsRequirement = false;
            }
            if (requirement.platform && capabilities.platform !== requirement.platform) {
                meetsRequirement = false;
            }
            
            if (meetsRequirement) {
                capableMachines.push({
                    machineId: machineId,
                    capabilities: capabilities,
                    performance: statusData.performance || {}
                });
            }
        }
        
        return capableMachines;
    }

    getNetworkStatistics() {
        const machines = Array.from(this.onlineMachines.values());
        
        if (machines.length === 0) {
            return {
                totalMachines: 0,
                totalCpuCores: 0,
                totalMemory: 0,
                totalDiskSpace: 0,
                averageCpuUsage: 0,
                averageMemoryUsage: 0,
                platformDistribution: {},
                healthScore: 0
            };
        }
        
        const stats = machines.reduce((acc, machine) => {
            const caps = machine.capabilities || {};
            const perf = machine.performance || {};
            
            acc.totalCpuCores += caps.cpuCores || 0;
            acc.totalMemory += caps.totalMemory || 0;
            acc.totalDiskSpace += caps.totalDiskSpace || 0;
            acc.cpuUsageSum += perf.cpuUsage || 0;
            acc.memoryUsageSum += perf.memoryUsage || 0;
            
            const platform = caps.platform || 'unknown';
            acc.platformCounts[platform] = (acc.platformCounts[platform] || 0) + 1;
            
            return acc;
        }, {
            totalCpuCores: 0,
            totalMemory: 0,
            totalDiskSpace: 0,
            cpuUsageSum: 0,
            memoryUsageSum: 0,
            platformCounts: {}
        });
        
        return {
            totalMachines: machines.length,
            totalCpuCores: stats.totalCpuCores,
            totalMemory: stats.totalMemory,
            totalDiskSpace: stats.totalDiskSpace,
            averageCpuUsage: (stats.cpuUsageSum / machines.length).toFixed(2),
            averageMemoryUsage: (stats.memoryUsageSum / machines.length).toFixed(2),
            platformDistribution: stats.platformCounts,
            healthScore: Math.max(0, 100 - stats.cpuUsageSum / machines.length - stats.memoryUsageSum / machines.length)
        };
    }

    startHeartbeatMonitoring() {
        setInterval(() => {
            const now = Date.now();
            const offlineMachines = [];

            this.lastHeartbeat.forEach((lastSeen, machineId) => {
                if (now - lastSeen > this.timeoutThreshold) {
                    offlineMachines.push(machineId);
                }
            });

            offlineMachines.forEach(machineId => {
                this.markMachineOffline(machineId);
                this.onMachineOffline(machineId);
            });
        }, 10000);
    }

    onMachineOffline(machineId) {
        console.log(`Machine ${machineId.substring(0, 8)}... detected as offline`);
    }
}

module.exports = { EnhancedMachineStatusManager };