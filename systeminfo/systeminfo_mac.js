const { exec } = require('child_process');
const os = require('os');
const fs = require('fs').promises;
const util = require('util');

const execAsync = util.promisify(exec);

class MacSystemInfo {
    constructor() {
        this.systemData = {};
    }

    // Get basic system information
    async getBasicSystemInfo() {
        try {
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
                nodeVersion: process.version
            };
        } catch (error) {
            console.error('Error getting basic system info:', error);
            return null;
        }
    }

    // Get detailed CPU information
    async getCPUInfo() {
        try {
            // Get CPU info using system_profiler
            const { stdout: cpuInfo } = await execAsync("system_profiler SPHardwareDataType");
            
            let cpuDetails = {
                model: '',
                cores: 0,
                threads: 0,
                frequency: '',
                cacheSize: '',
                vendor: 'Apple'
            };

            // Parse CPU info
            const lines = cpuInfo.split('\n');
            lines.forEach(line => {
                const trimmedLine = line.trim();
                if (trimmedLine.includes('Processor Name:')) {
                    cpuDetails.model = trimmedLine.split(':')[1].trim();
                } else if (trimmedLine.includes('Processor Speed:')) {
                    cpuDetails.frequency = trimmedLine.split(':')[1].trim();
                } else if (trimmedLine.includes('Number of Processors:')) {
                    cpuDetails.cores = parseInt(trimmedLine.split(':')[1].trim()) || 0;
                } else if (trimmedLine.includes('Total Number of Cores:')) {
                    cpuDetails.threads = parseInt(trimmedLine.split(':')[1].trim()) || 0;
                } else if (trimmedLine.includes('L2 Cache') || trimmedLine.includes('L3 Cache')) {
                    cpuDetails.cacheSize = trimmedLine.split(':')[1].trim();
                }
            });

            // Get current CPU usage
            const cpuUsage = await this.getCPUUsage();

            return {
                cpuDetails: cpuDetails,
                cpuUsage: cpuUsage,
                cpuCores: os.cpus(),
                loadAverage: os.loadavg(),
                thermalState: await this.getThermalState()
            };
        } catch (error) {
            console.error('Error getting CPU info:', error);
            return {
                cpuDetails: { model: 'Unknown', cores: os.cpus().length },
                cpuUsage: 0,
                cpuCores: os.cpus(),
                loadAverage: os.loadavg()
            };
        }
    }

    // Get CPU usage percentage
    async getCPUUsage() {
        try {
            const { stdout } = await execAsync("top -l 1 -n 0 | grep 'CPU usage'");
            const match = stdout.match(/(\d+\.\d+)% user/);
            return match ? parseFloat(match[1]) : 0;
        } catch (error) {
            try {
                // Alternative method using iostat
                const { stdout } = await execAsync("iostat -c 1 | tail -1 | awk '{print 100-$6}'");
                return parseFloat(stdout.trim()) || 0;
            } catch (e) {
                return 0;
            }
        }
    }

    // Get thermal state (macOS specific)
    async getThermalState() {
        try {
            const { stdout } = await execAsync("pmset -g thermlog | head -1");
            return stdout.trim();
        } catch (error) {
            return 'Unknown';
        }
    }

    // Get detailed memory information
    async getMemoryInfo() {
        try {
            // Get memory info using vm_stat
            const { stdout: vmStat } = await execAsync("vm_stat");
            const { stdout: memInfo } = await execAsync("system_profiler SPHardwareDataType | grep Memory");
            
            let memData = {
                pageSize: 4096, // Default page size
                pages: {}
            };

            // Parse vm_stat output
            const vmLines = vmStat.split('\n');
            vmLines.forEach(line => {
                if (line.includes('page size of')) {
                    const match = line.match(/(\d+) bytes/);
                    if (match) memData.pageSize = parseInt(match[1]);
                } else if (line.includes('Pages free:')) {
                    memData.pages.free = parseInt(line.split(':')[1].replace('.', '').trim());
                } else if (line.includes('Pages active:')) {
                    memData.pages.active = parseInt(line.split(':')[1].replace('.', '').trim());
                } else if (line.includes('Pages inactive:')) {
                    memData.pages.inactive = parseInt(line.split(':')[1].replace('.', '').trim());
                } else if (line.includes('Pages wired down:')) {
                    memData.pages.wired = parseInt(line.split(':')[1].replace('.', '').trim());
                } else if (line.includes('Pages purgeable:')) {
                    memData.pages.purgeable = parseInt(line.split(':')[1].replace('.', '').trim());
                }
            });

            // Calculate memory usage
            const pageSize = memData.pageSize;
            const totalPages = memData.pages.free + memData.pages.active + memData.pages.inactive + memData.pages.wired;
            const usedPages = memData.pages.active + memData.pages.inactive + memData.pages.wired;
            
            const totalMemory = totalPages * pageSize;
            const usedMemory = usedPages * pageSize;
            const freeMemory = memData.pages.free * pageSize;

            // Get physical memory from system_profiler
            const memoryMatch = memInfo.match(/(\d+\s*GB)/);
            const physicalMemory = memoryMatch ? memoryMatch[1] : 'Unknown';

            return {
                totalPhysical: totalMemory,
                freePhysical: freeMemory,
                usedPhysical: usedMemory,
                activeMemory: memData.pages.active * pageSize,
                inactiveMemory: memData.pages.inactive * pageSize,
                wiredMemory: memData.pages.wired * pageSize,
                purgeableMemory: memData.pages.purgeable * pageSize,
                physicalMemoryInstalled: physicalMemory,
                memoryUsagePercent: totalMemory > 0 ? ((usedMemory / totalMemory) * 100).toFixed(2) : 0,
                memoryPressure: await this.getMemoryPressure()
            };
        } catch (error) {
            console.error('Error getting memory info:', error);
            const total = os.totalmem();
            const free = os.freemem();
            return {
                totalPhysical: total,
                freePhysical: free,
                usedPhysical: total - free,
                memoryUsagePercent: ((total - free) / total * 100).toFixed(2)
            };
        }
    }

    // Get memory pressure (macOS specific)
    async getMemoryPressure() {
        try {
            const { stdout } = await execAsync("memory_pressure");
            return stdout.trim();
        } catch (error) {
            return 'Unknown';
        }
    }

    // Get disk information
    async getDiskInfo() {
        try {
            const { stdout } = await execAsync("df -h | grep -v tmpfs | grep -v devfs");
            const diskLines = stdout.split('\n').filter(line => line.trim() && !line.startsWith('Filesystem'));
            
            const disks = diskLines.map(line => {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 6) {
                    return {
                        filesystem: parts[0],
                        total: parts[1],
                        used: parts[2],
                        available: parts[3],
                        usagePercent: parts[4].replace('%', ''),
                        mountPoint: parts[5]
                    };
                }
                return null;
            }).filter(Boolean);

            // Get detailed disk info using diskutil
            const detailedDisks = await Promise.all(disks.map(async (disk) => {
                try {
                    const { stdout: diskInfo } = await execAsync(`diskutil info "${disk.mountPoint}"`);
                    const lines = diskInfo.split('\n');
                    let additionalInfo = {};

                    lines.forEach(line => {
                        const trimmedLine = line.trim();
                        if (trimmedLine.includes('File System Personality:')) {
                            additionalInfo.fileSystem = trimmedLine.split(':')[1].trim();
                        } else if (trimmedLine.includes('Disk Size:')) {
                            additionalInfo.diskSize = trimmedLine.split(':')[1].trim();
                        } else if (trimmedLine.includes('Device Node:')) {
                            additionalInfo.deviceNode = trimmedLine.split(':')[1].trim();
                        }
                    });

                    return { ...disk, ...additionalInfo };
                } catch (e) {
                    return disk;
                }
            }));

            return detailedDisks;
        } catch (error) {
            console.error('Error getting disk info:', error);
            return [];
        }
    }

    // Get network information
    async getNetworkInfo() {
        try {
            const { stdout } = await execAsync("ifconfig | grep -E '^[a-z]|inet '");
            const lines = stdout.split('\n');
            
            let adapters = [];
            let currentAdapter = null;

            lines.forEach(line => {
                const trimmedLine = line.trim();
                if (!trimmedLine.startsWith('inet') && trimmedLine.includes(':')) {
                    // New interface
                    if (currentAdapter) {
                        adapters.push(currentAdapter);
                    }
                    currentAdapter = {
                        interface: trimmedLine.split(':')[0],
                        addresses: []
                    };
                } else if (trimmedLine.startsWith('inet') && currentAdapter) {
                    // IP address for current interface
                    const parts = trimmedLine.split(' ');
                    if (parts.length >= 2) {
                        currentAdapter.addresses.push({
                            address: parts[1],
                            type: parts[0] === 'inet' ? 'IPv4' : 'IPv6'
                        });
                    }
                }
            });

            if (currentAdapter) {
                adapters.push(currentAdapter);
            }

            // Get additional network info
            const enhancedAdapters = await Promise.all(adapters.map(async (adapter) => {
                try {
                    const { stdout: macInfo } = await execAsync(`ifconfig ${adapter.interface} | grep ether`);
                    const macMatch = macInfo.match(/ether\s+([a-f0-9:]{17})/);
                    
                    return {
                        ...adapter,
                        macAddress: macMatch ? macMatch[1] : 'N/A',
                        primaryIP: adapter.addresses.find(addr => addr.type === 'IPv4')?.address || 'N/A'
                    };
                } catch (e) {
                    return { ...adapter, macAddress: 'N/A' };
                }
            }));

            return enhancedAdapters.filter(adapter => adapter.interface !== 'lo0'); // Filter out loopback
        } catch (error) {
            console.error('Error getting network info:', error);
            return Object.entries(os.networkInterfaces()).map(([name, addresses]) => ({
                interface: name,
                addresses: addresses,
                primaryIP: addresses.find(addr => addr.family === 'IPv4')?.address || 'N/A'
            }));
        }
    }

    // Get running processes
    async getRunningProcesses() {
        try {
            const { stdout } = await execAsync("ps aux | sort -k4 -nr | head -21");
            const processLines = stdout.split('\n').slice(1).filter(line => line.trim());
            
            const processes = processLines.map(line => {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 11) {
                    return {
                        user: parts[0],
                        pid: parseInt(parts[1]),
                        cpuPercent: parseFloat(parts[2]),
                        memPercent: parseFloat(parts[3]),
                        vsz: parseInt(parts[4]), // Virtual memory size
                        rss: parseInt(parts[5]), // Resident set size
                        tty: parts[6],
                        stat: parts[7],
                        start: parts[8],
                        time: parts[9],
                        command: parts.slice(10).join(' ')
                    };
                }
                return null;
            }).filter(Boolean);

            return processes.slice(0, 20); // Top 20 processes
        } catch (error) {
            console.error('Error getting processes:', error);
            return [];
        }
    }

    // Get system services (launchd services on macOS)
    async getSystemServices() {
        try {
            const { stdout } = await execAsync("launchctl list");
            const serviceLines = stdout.split('\n').slice(1).filter(line => line.trim());
            
            const services = serviceLines.map(line => {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 3) {
                    return {
                        pid: parts[0] === '-' ? null : parseInt(parts[0]),
                        status: parts[1],
                        label: parts[2],
                        type: parts[2].includes('com.apple') ? 'System' : 'User'
                    };
                }
                return null;
            }).filter(Boolean);

            return services.slice(0, 50); // Limit to 50 services
        } catch (error) {
            console.error('Error getting services:', error);
            return [];
        }
    }

    // Get system logs
    async getSystemLogs(logType = 'system', maxEvents = 50) {
        try {
            let command;
            switch (logType.toLowerCase()) {
                case 'system':
                    command = `log show --last 1h --max ${maxEvents} --style compact`;
                    break;
                case 'kernel':
                    command = `log show --last 1h --max ${maxEvents} --predicate 'subsystem == "com.apple.kernel"' --style compact`;
                    break;
                case 'application':
                    command = `log show --last 1h --max ${maxEvents} --predicate 'category == "application"' --style compact`;
                    break;
                case 'security':
                    command = `log show --last 1h --max ${maxEvents} --predicate 'subsystem == "com.apple.security"' --style compact`;
                    break;
                default:
                    command = `log show --last 1h --max ${maxEvents} --style compact`;
            }

            const { stdout } = await execAsync(command);
            const logLines = stdout.split('\n').filter(line => line.trim());
            
            const logs = logLines.map(line => {
                // Parse macOS log format: timestamp thread type subsystem category message
                const match = line.match(/^(\d{4}-\d{2}-\d{2}\s+[\d:\.]+)\s+(\w+)\s+(\w+)\s+(\w+)\s+(.+?):\s*(.+)$/);
                if (match) {
                    return {
                        timestamp: match[1],
                        thread: match[2],
                        type: match[3],
                        subsystem: match[4],
                        category: match[5],
                        message: match[6],
                        level: this.getLogLevel(match[3])
                    };
                } else {
                    return {
                        timestamp: new Date().toISOString(),
                        message: line,
                        level: 'info'
                    };
                }
            });

            return logs.slice(0, maxEvents);
        } catch (error) {
            console.error('Error getting system logs:', error);
            // Fallback to console logs
            try {
                const { stdout } = await execAsync(`tail -${maxEvents} /var/log/system.log`);
                const fallbackLogs = stdout.split('\n').filter(line => line.trim()).map(line => ({
                    timestamp: new Date().toISOString(),
                    message: line,
                    level: 'info'
                }));
                return fallbackLogs;
            } catch (e) {
                return [];
            }
        }
    }

    // Determine log level from type
    getLogLevel(type) {
        const lowerType = type.toLowerCase();
        if (lowerType.includes('error') || lowerType.includes('fault')) return 'error';
        if (lowerType.includes('warning') || lowerType.includes('warn')) return 'warning';
        if (lowerType.includes('critical') || lowerType.includes('fatal')) return 'critical';
        if (lowerType.includes('debug')) return 'debug';
        return 'info';
    }

    // Get macOS version and build information
    async getMacOSVersion() {
        try {
            const { stdout: swVers } = await execAsync("sw_vers");
            const { stdout: systemInfo } = await execAsync("system_profiler SPSoftwareDataType");
            
            let versionInfo = {};
            
            // Parse sw_vers output
            const swLines = swVers.split('\n');
            swLines.forEach(line => {
                if (line.includes('ProductName:')) {
                    versionInfo.productName = line.split(':')[1].trim();
                } else if (line.includes('ProductVersion:')) {
                    versionInfo.productVersion = line.split(':')[1].trim();
                } else if (line.includes('BuildVersion:')) {
                    versionInfo.buildVersion = line.split(':')[1].trim();
                }
            });

            // Parse system_profiler output for additional info
            const systemLines = systemInfo.split('\n');
            systemLines.forEach(line => {
                const trimmedLine = line.trim();
                if (trimmedLine.includes('System Version:')) {
                    versionInfo.systemVersion = trimmedLine.split(':')[1].trim();
                } else if (trimmedLine.includes('Kernel Version:')) {
                    versionInfo.kernelVersion = trimmedLine.split(':')[1].trim();
                } else if (trimmedLine.includes('Boot Volume:')) {
                    versionInfo.bootVolume = trimmedLine.split(':')[1].trim();
                } else if (trimmedLine.includes('Boot Mode:')) {
                    versionInfo.bootMode = trimmedLine.split(':')[1].trim();
                }
            });

            return versionInfo;
        } catch (error) {
            console.error('Error getting macOS version:', error);
            return { 
                productName: 'macOS', 
                productVersion: 'Unknown', 
                buildVersion: 'Unknown' 
            };
        }
    }

    // Get hardware information
    async getHardwareInfo() {
        try {
            const { stdout } = await execAsync("system_profiler SPHardwareDataType");
            const lines = stdout.split('\n');
            let hardwareInfo = {};

            lines.forEach(line => {
                const trimmedLine = line.trim();
                if (trimmedLine.includes('Model Name:')) {
                    hardwareInfo.modelName = trimmedLine.split(':')[1].trim();
                } else if (trimmedLine.includes('Model Identifier:')) {
                    hardwareInfo.modelIdentifier = trimmedLine.split(':')[1].trim();
                } else if (trimmedLine.includes('Chip:')) {
                    hardwareInfo.chip = trimmedLine.split(':')[1].trim();
                } else if (trimmedLine.includes('Serial Number:')) {
                    hardwareInfo.serialNumber = trimmedLine.split(':')[1].trim();
                } else if (trimmedLine.includes('Hardware UUID:')) {
                    hardwareInfo.hardwareUUID = trimmedLine.split(':')[1].trim();
                } else if (trimmedLine.includes('Provisioning UDID:')) {
                    hardwareInfo.provisioningUDID = trimmedLine.split(':')[1].trim();
                }
            });

            return hardwareInfo;
        } catch (error) {
            console.error('Error getting hardware info:', error);
            return { modelName: 'Unknown Mac' };
        }
    }

    // Get battery information (for laptops)
    async getBatteryInfo() {
        try {
            const { stdout } = await execAsync("pmset -g batt");
            const lines = stdout.split('\n');
            let batteryInfo = {};

            lines.forEach(line => {
                if (line.includes('InternalBattery')) {
                    const match = line.match(/(\d+)%.*?(\w+);/);
                    if (match) {
                        batteryInfo.percentage = parseInt(match[1]);
                        batteryInfo.status = match[2];
                    }
                } else if (line.includes('remaining')) {
                    const timeMatch = line.match(/([\d:]+)\s+remaining/);
                    if (timeMatch) {
                        batteryInfo.timeRemaining = timeMatch[1];
                    }
                }
            });

            // Get detailed battery info
            try {
                const { stdout: batteryDetail } = await execAsync("system_profiler SPPowerDataType");
                const detailLines = batteryDetail.split('\n');
                detailLines.forEach(line => {
                    const trimmedLine = line.trim();
                    if (trimmedLine.includes('Cycle Count:')) {
                        batteryInfo.cycleCount = parseInt(trimmedLine.split(':')[1].trim());
                    } else if (trimmedLine.includes('Condition:')) {
                        batteryInfo.condition = trimmedLine.split(':')[1].trim();
                    }
                });
            } catch (e) {
                // Battery details not available
            }

            return Object.keys(batteryInfo).length > 0 ? batteryInfo : { message: 'No battery detected' };
        } catch (error) {
            return { message: 'Battery information not available' };
        }
    }

    // Get all system information
    async getAllSystemInfo() {
        try {
            console.log('Gathering comprehensive macOS system information...');

            const [
                basicInfo,
                cpuInfo,
                memoryInfo,
                diskInfo,
                networkInfo,
                processes,
                services,
                macOSVersion,
                hardwareInfo,
                batteryInfo,
                systemLogs,
                kernelLogs
            ] = await Promise.all([
                this.getBasicSystemInfo(),
                this.getCPUInfo(),
                this.getMemoryInfo(),
                this.getDiskInfo(),
                this.getNetworkInfo(),
                this.getRunningProcesses(),
                this.getSystemServices(),
                this.getMacOSVersion(),
                this.getHardwareInfo(),
                this.getBatteryInfo(),
                this.getSystemLogs('system', 25),
                this.getSystemLogs('kernel', 25)
            ]);

            return {
                timestamp: new Date().toISOString(),
                basic: basicInfo,
                cpu: cpuInfo,
                memory: memoryInfo,
                disks: diskInfo,
                network: networkInfo,
                processes: processes,
                services: services,
                macOSVersion: macOSVersion,
                hardware: hardwareInfo,
                battery: batteryInfo,
                logs: {
                    system: systemLogs,
                    kernel: kernelLogs
                },
                performance: {
                    cpuUsage: cpuInfo?.cpuUsage || 0,
                    memoryUsage: parseFloat(memoryInfo?.memoryUsagePercent || 0),
                    diskUsage: diskInfo.length > 0 ? parseFloat(diskInfo[0].usagePercent) : 0,
                    loadAverage: os.loadavg(),
                    thermalState: cpuInfo?.thermalState || 'Unknown'
                }
            };
        } catch (error) {
            console.error('Error gathering all macOS system info:', error);
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
                    uptime: os.uptime(),
                    loadAverage: os.loadavg(),
                    thermalState: await this.getThermalState()
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

    // Get security information
    async getSecurityInfo() {
        try {
            const { stdout: firewall } = await execAsync("sudo pfctl -s info 2>/dev/null || echo 'Firewall info not available'");
            const { stdout: gatekeeper } = await execAsync("spctl --status");
            
            return {
                firewall: firewall.trim(),
                gatekeeper: gatekeeper.trim(),
                sip: await this.getSIPStatus()
            };
        } catch (error) {
            return { message: 'Security information not available' };
        }
    }

    // Get System Integrity Protection status
    async getSIPStatus() {
        try {
            const { stdout } = await execAsync("csrutil status");
            return stdout.trim();
        } catch (error) {
            return 'SIP status unknown';
        }
    }

    // Get Xcode and development tools info
    async getDeveloperInfo() {
        try {
            const { stdout: xcodeSelect } = await execAsync("xcode-select --print-path 2>/dev/null || echo 'Xcode not installed'");
            const { stdout: xcodeVersion } = await execAsync("xcodebuild -version 2>/dev/null || echo 'Xcode not available'");
            const { stdout: brewInfo } = await execAsync("brew --version 2>/dev/null || echo 'Homebrew not installed'");
            
            return {
                xcodePath: xcodeSelect.trim(),
                xcodeVersion: xcodeVersion.trim(),
                homebrew: brewInfo.split('\n')[0] || 'Not installed'
            };
        } catch (error) {
            return { message: 'Developer tools information not available' };
        }
    }
}

module.exports = MacSystemInfo;