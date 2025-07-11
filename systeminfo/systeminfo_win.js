//file systeminfo/systeminfo_win.js
const { exec, spawn } = require('child_process');
const os = require('os');
const fs = require('fs').promises;
const path = require('path');
const util = require('util');

const execAsync = util.promisify(exec);

class WindowsSystemInfo {
    constructor() {
        this.systemData = {};
    }

    // Get basic system information
    async getBasicSystemInfo() {
        try {
            const systemInfo = {
                hostname: os.hostname(),
                platform: os.platform(),
                architecture: os.arch(),
                release: os.release(),
                uptime: os.uptime(),
                userInfo: os.userInfo(),
                homeDirectory: os.homedir(),
                tempDirectory: os.tmpdir(),
                endianness: os.endianness(),
                nodeVersion: process.version,
                totalMemory: os.totalmem(),
                freeMemory: os.freemem(),
                cpuCount: os.cpus().length,
                cpuModel: os.cpus()[0]?.model || 'Unknown',
                loadAverage: os.loadavg()
            };

            return systemInfo;
        } catch (error) {
            console.error('Error getting basic system info:', error);
            return null;
        }
    }

    // Get detailed CPU information
    async getCPUInfo() {
        try {
            const cpuCommand = `wmic cpu get Name,NumberOfCores,NumberOfLogicalProcessors,MaxClockSpeed,CurrentClockSpeed,L2CacheSize,L3CacheSize,Manufacturer /format:csv`;
            const { stdout } = await execAsync(cpuCommand);
            
            const cpuLines = stdout.split('\n').filter(line => line.trim() && !line.startsWith('Node'));
            const cpuData = [];

            cpuLines.forEach(line => {
                const parts = line.split(',');
                if (parts.length > 1) {
                    cpuData.push({
                        name: parts[1]?.trim(),
                        manufacturer: parts[2]?.trim(),
                        cores: parseInt(parts[3]) || 0,
                        logicalProcessors: parseInt(parts[4]) || 0,
                        maxClockSpeed: parseInt(parts[5]) || 0,
                        currentClockSpeed: parseInt(parts[6]) || 0,
                        l2Cache: parseInt(parts[7]) || 0,
                        l3Cache: parseInt(parts[8]) || 0
                    });
                }
            });

            // Get CPU usage
            const cpuUsage = await this.getCPUUsage();
            
            return {
                cpuDetails: cpuData,
                cpuUsage: cpuUsage,
                cpuCores: os.cpus()
            };
        } catch (error) {
            console.error('Error getting CPU info:', error);
            return { cpuDetails: [], cpuUsage: 0, cpuCores: os.cpus() };
        }
    }

    // Get CPU usage percentage
    async getCPUUsage() {
        try {
            const { stdout } = await execAsync(`wmic cpu get loadpercentage /value`);
            const match = stdout.match(/LoadPercentage=(\d+)/);
            return match ? parseInt(match[1]) : 0;
        } catch (error) {
            return 0;
        }
    }

    // Get detailed memory information
    async getMemoryInfo() {
        try {
            const memoryCommand = `wmic computersystem get TotalPhysicalMemory /value`;
            const { stdout: totalMem } = await execAsync(memoryCommand);
            
            const availableMemCommand = `wmic OS get TotalVirtualMemorySize,TotalVisibleMemorySize,FreePhysicalMemory,FreeVirtualMemory /format:csv`;
            const { stdout: memDetails } = await execAsync(availableMemCommand);

            const totalMatch = totalMem.match(/TotalPhysicalMemory=(\d+)/);
            const totalPhysical = totalMatch ? parseInt(totalMatch[1]) : 0;

            const memLines = memDetails.split('\n').filter(line => line.trim() && !line.startsWith('Node'));
            let memoryDetails = {};

            memLines.forEach(line => {
                const parts = line.split(',');
                if (parts.length > 1) {
                    memoryDetails = {
                        freePhysical: parseInt(parts[1]) * 1024 || 0, // Convert from KB to bytes
                        freeVirtual: parseInt(parts[2]) * 1024 || 0,
                        totalVirtual: parseInt(parts[3]) * 1024 || 0,
                        totalVisible: parseInt(parts[4]) * 1024 || 0
                    };
                }
            });

            return {
                totalPhysical: totalPhysical,
                freePhysical: memoryDetails.freePhysical,
                usedPhysical: totalPhysical - memoryDetails.freePhysical,
                totalVirtual: memoryDetails.totalVirtual,
                freeVirtual: memoryDetails.freeVirtual,
                usedVirtual: memoryDetails.totalVirtual - memoryDetails.freeVirtual,
                memoryUsagePercent: ((totalPhysical - memoryDetails.freePhysical) / totalPhysical * 100).toFixed(2)
            };
        } catch (error) {
            console.error('Error getting memory info:', error);
            return {
                totalPhysical: os.totalmem(),
                freePhysical: os.freemem(),
                usedPhysical: os.totalmem() - os.freemem(),
                memoryUsagePercent: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2)
            };
        }
    }

    // Get disk information
    async getDiskInfo() {
        try {
            const diskCommand = `wmic logicaldisk get Size,FreeSpace,Caption,DriveType,FileSystem /format:csv`;
            const { stdout } = await execAsync(diskCommand);
            
            const diskLines = stdout.split('\n').filter(line => line.trim() && !line.startsWith('Node'));
            const disks = [];

            diskLines.forEach(line => {
                const parts = line.split(',');
                if (parts.length > 1 && parts[1]) {
                    const size = parseInt(parts[4]) || 0;
                    const free = parseInt(parts[2]) || 0;
                    const used = size - free;

                    disks.push({
                        drive: parts[1].trim(),
                        driveType: this.getDriveTypeString(parseInt(parts[3])),
                        fileSystem: parts[5]?.trim() || 'Unknown',
                        totalSize: size,
                        freeSpace: free,
                        usedSpace: used,
                        usagePercent: size > 0 ? ((used / size) * 100).toFixed(2) : 0
                    });
                }
            });

            return disks;
        } catch (error) {
            console.error('Error getting disk info:', error);
            return [];
        }
    }

    // Convert drive type number to string
    getDriveTypeString(driveType) {
        const types = {
            0: 'Unknown',
            1: 'No Root Directory',
            2: 'Removable Disk',
            3: 'Local Disk',
            4: 'Network Drive',
            5: 'Compact Disc',
            6: 'RAM Disk'
        };
        return types[driveType] || 'Unknown';
    }

    // Get network information
    async getNetworkInfo() {
        try {
            const networkCommand = `wmic path win32_networkadapterconfiguration where IPEnabled=true get IPAddress,MACAddress,DefaultIPGateway,DHCPEnabled,DNSServerSearchOrder,Description /format:csv`;
            const { stdout } = await execAsync(networkCommand);
            
            const networkLines = stdout.split('\n').filter(line => line.trim() && !line.startsWith('Node'));
            const adapters = [];

            networkLines.forEach(line => {
                const parts = line.split(',');
                if (parts.length > 1 && parts[2]) {
                    adapters.push({
                        description: parts[1]?.trim() || 'Unknown',
                        dhcpEnabled: parts[3]?.trim() === 'TRUE',
                        dnsServers: parts[4]?.trim() || 'N/A',
                        gateway: parts[5]?.trim() || 'N/A',
                        ipAddress: parts[6]?.trim() || 'N/A',
                        macAddress: parts[7]?.trim() || 'N/A'
                    });
                }
            });

            return adapters;
        } catch (error) {
            console.error('Error getting network info:', error);
            return [];
        }
    }

    // Get running processes
    async getRunningProcesses() {
        try {
            const processCommand = `wmic process get Name,ProcessId,PageFileUsage,WorkingSetSize /format:csv`;
            const { stdout } = await execAsync(processCommand);
            
            const processLines = stdout.split('\n').filter(line => line.trim() && !line.startsWith('Node'));
            const processes = [];

            processLines.forEach(line => {
                const parts = line.split(',');
                if (parts.length > 1 && parts[1]) {
                    processes.push({
                        name: parts[1].trim(),
                        pid: parseInt(parts[3]) || 0,
                        memoryUsage: parseInt(parts[2]) || 0,
                        workingSet: parseInt(parts[4]) || 0
                    });
                }
            });

            // Sort by memory usage (descending) and take top 20
            return processes
                .sort((a, b) => b.memoryUsage - a.memoryUsage)
                .slice(0, 20);
        } catch (error) {
            console.error('Error getting processes:', error);
            return [];
        }
    }

    // Get system services
    async getSystemServices() {
        try {
            const serviceCommand = `wmic service get Name,State,Status,StartMode /format:csv`;
            const { stdout } = await execAsync(serviceCommand);
            
            const serviceLines = stdout.split('\n').filter(line => line.trim() && !line.startsWith('Node'));
            const services = [];

            serviceLines.forEach(line => {
                const parts = line.split(',');
                if (parts.length > 1 && parts[1]) {
                    services.push({
                        name: parts[1].trim(),
                        startMode: parts[2]?.trim() || 'Unknown',
                        state: parts[3]?.trim() || 'Unknown',
                        status: parts[4]?.trim() || 'Unknown'
                    });
                }
            });

            return services;
        } catch (error) {
            console.error('Error getting services:', error);
            return [];
        }
    }

    // Get system logs (Event Viewer)
    async getSystemLogs(logType = 'System', maxEvents = 50) {
        try {
            const logCommand = `wevtutil qe ${logType} /c:${maxEvents} /rd:true /f:text`;
            const { stdout } = await execAsync(logCommand);
            
            // Parse the log entries
            const logEntries = this.parseWindowsLogs(stdout);
            return logEntries;
        } catch (error) {
            console.error('Error getting system logs:', error);
            return [];
        }
    }

    // Parse Windows Event Logs
    parseWindowsLogs(logData) {
        const entries = [];
        const logBlocks = logData.split('\n\n').filter(block => block.trim());

        logBlocks.forEach(block => {
            const lines = block.split('\n');
            const entry = {};

            lines.forEach(line => {
                if (line.includes('Event ID:')) {
                    entry.eventId = line.split(':')[1]?.trim();
                } else if (line.includes('Level:')) {
                    entry.level = line.split(':')[1]?.trim();
                } else if (line.includes('Date and Time:')) {
                    entry.timestamp = line.split('Date and Time:')[1]?.trim();
                } else if (line.includes('Source:')) {
                    entry.source = line.split(':')[1]?.trim();
                } else if (line.includes('Description:')) {
                    entry.description = line.split('Description:')[1]?.trim();
                }
            });

            if (entry.eventId) {
                entries.push(entry);
            }
        });

        return entries.slice(0, 50); // Limit to 50 entries
    }

    // Get Windows version and build info
    async getWindowsVersion() {
        try {
            const versionCommand = `wmic os get Caption,Version,BuildNumber,OSArchitecture /format:csv`;
            const { stdout } = await execAsync(versionCommand);
            
            const versionLines = stdout.split('\n').filter(line => line.trim() && !line.startsWith('Node'));
            let versionInfo = {};

            versionLines.forEach(line => {
                const parts = line.split(',');
                if (parts.length > 1) {
                    versionInfo = {
                        caption: parts[2]?.trim() || 'Unknown',
                        version: parts[4]?.trim() || 'Unknown',
                        buildNumber: parts[1]?.trim() || 'Unknown',
                        architecture: parts[3]?.trim() || 'Unknown'
                    };
                }
            });

            return versionInfo;
        } catch (error) {
            console.error('Error getting Windows version:', error);
            return { caption: 'Unknown', version: 'Unknown', buildNumber: 'Unknown', architecture: 'Unknown' };
        }
    }

    // Get all system information
    async getAllSystemInfo() {
        try {
            console.log('Gathering comprehensive system information...');

            const [
                basicInfo,
                cpuInfo,
                memoryInfo,
                diskInfo,
                networkInfo,
                processes,
                services,
                windowsVersion,
                systemLogs,
                applicationLogs
            ] = await Promise.all([
                this.getBasicSystemInfo(),
                this.getCPUInfo(),
                this.getMemoryInfo(),
                this.getDiskInfo(),
                this.getNetworkInfo(),
                this.getRunningProcesses(),
                this.getSystemServices(),
                this.getWindowsVersion(),
                this.getSystemLogs('System', 25),
                this.getSystemLogs('Application', 25)
            ]);

            return {
                timestamp: new Date().toISOString(),
                basic: basicInfo,
                cpu: cpuInfo,
                memory: memoryInfo,
                disks: diskInfo,
                network: networkInfo,
                processes: processes,
                services: services.slice(0, 50), // Limit services
                windowsVersion: windowsVersion,
                logs: {
                    system: systemLogs,
                    application: applicationLogs
                },
                performance: {
                    cpuUsage: cpuInfo?.cpuUsage || 0,
                    memoryUsage: parseFloat(memoryInfo?.memoryUsagePercent || 0),
                    diskUsage: diskInfo.length > 0 ? parseFloat(diskInfo[0].usagePercent) : 0
                }
            };
        } catch (error) {
            console.error('Error gathering all system info:', error);
            throw error;
        }
    }

    // Real-time monitoring method
    async startRealTimeMonitoring(callback, interval = 5000) {
        const monitor = async () => {
            try {
                const quickInfo = {
                    timestamp: new Date().toISOString(),
                    cpu: await this.getCPUUsage(),
                    memory: await this.getMemoryInfo(),
                    uptime: os.uptime()
                };
                callback(quickInfo);
            } catch (error) {
                console.error('Error in real-time monitoring:', error);
            }
        };

        // Initial call
        await monitor();

        // Set up interval
        const intervalId = setInterval(monitor, interval);
        
        return {
            stop: () => clearInterval(intervalId)
        };
    }
}

module.exports = WindowsSystemInfo;