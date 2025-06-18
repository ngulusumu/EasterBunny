const { exec } = require('child_process');
const os = require('os');
const fs = require('fs').promises;
const util = require('util');

const execAsync = util.promisify(exec);

class LinuxSystemInfo {
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
            // Get CPU info from /proc/cpuinfo
            const cpuInfoRaw = await fs.readFile('/proc/cpuinfo', 'utf8');
            const cpuLines = cpuInfoRaw.split('\n');
            
            let cpuDetails = {
                model: '',
                cores: 0,
                physicalCores: 0,
                threads: 0,
                frequency: 0,
                cacheSize: '',
                vendor: ''
            };

            // Parse CPU info
            cpuLines.forEach(line => {
                const [key, value] = line.split(':').map(s => s.trim());
                if (key === 'model name' && !cpuDetails.model) {
                    cpuDetails.model = value;
                } else if (key === 'vendor_id' && !cpuDetails.vendor) {
                    cpuDetails.vendor = value;
                } else if (key === 'cpu MHz' && !cpuDetails.frequency) {
                    cpuDetails.frequency = parseFloat(value);
                } else if (key === 'cache size' && !cpuDetails.cacheSize) {
                    cpuDetails.cacheSize = value;
                } else if (key === 'processor') {
                    cpuDetails.threads++;
                }
            });

            // Get physical cores and logical processors
            try {
                const { stdout: coreCount } = await execAsync("grep -c ^processor /proc/cpuinfo");
                cpuDetails.threads = parseInt(coreCount.trim());
                
                const { stdout: physicalCores } = await execAsync("grep 'cpu cores' /proc/cpuinfo | uniq | awk '{print $4}'");
                cpuDetails.physicalCores = parseInt(physicalCores.trim()) || cpuDetails.threads;
            } catch (e) {
                cpuDetails.physicalCores = os.cpus().length;
            }

            // Get current CPU usage
            const cpuUsage = await this.getCPUUsage();

            return {
                cpuDetails: cpuDetails,
                cpuUsage: cpuUsage,
                cpuCores: os.cpus(),
                loadAverage: os.loadavg()
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
            const { stdout } = await execAsync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | awk -F'%' '{print $1}'");
            return parseFloat(stdout.trim()) || 0;
        } catch (error) {
            try {
                // Alternative method using vmstat
                const { stdout } = await execAsync("vmstat 1 2 | tail -1 | awk '{print 100-$15}'");
                return parseFloat(stdout.trim()) || 0;
            } catch (e) {
                return 0;
            }
        }
    }

    // Get detailed memory information
    async getMemoryInfo() {
        try {
            const memInfoRaw = await fs.readFile('/proc/meminfo', 'utf8');
            const memLines = memInfoRaw.split('\n');
            
            let memInfo = {};
            memLines.forEach(line => {
                const [key, value] = line.split(':').map(s => s.trim());
                if (value) {
                    const numValue = parseInt(value.replace(/\s*kB$/, '')) * 1024; // Convert to bytes
                    memInfo[key] = numValue;
                }
            });

            const total = memInfo.MemTotal || 0;
            const free = memInfo.MemFree || 0;
            const available = memInfo.MemAvailable || free;
            const buffers = memInfo.Buffers || 0;
            const cached = memInfo.Cached || 0;
            const used = total - available;

            return {
                totalPhysical: total,
                freePhysical: free,
                availablePhysical: available,
                usedPhysical: used,
                buffers: buffers,
                cached: cached,
                totalSwap: memInfo.SwapTotal || 0,
                freeSwap: memInfo.SwapFree || 0,
                usedSwap: (memInfo.SwapTotal || 0) - (memInfo.SwapFree || 0),
                memoryUsagePercent: total > 0 ? ((used / total) * 100).toFixed(2) : 0
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

    // Get disk information
    async getDiskInfo() {
        try {
            const { stdout } = await execAsync("df -h --output=source,fstype,size,used,avail,pcent,target | grep -v tmpfs | grep -v udev");
            const diskLines = stdout.split('\n').filter(line => line.trim() && !line.startsWith('Filesystem'));
            
            const disks = diskLines.map(line => {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 7) {
                    return {
                        filesystem: parts[0],
                        type: parts[1],
                        total: parts[2],
                        used: parts[3],
                        available: parts[4],
                        usagePercent: parts[5].replace('%', ''),
                        mountPoint: parts[6]
                    };
                }
                return null;
            }).filter(Boolean);

            // Get detailed disk info with numeric values
            const detailedDisks = await Promise.all(disks.map(async (disk) => {
                try {
                    const { stdout: blockInfo } = await execAsync(`lsblk -b -o NAME,SIZE,TYPE,MOUNTPOINT | grep "${disk.mountPoint}"`);
                    const blockParts = blockInfo.trim().split(/\s+/);
                    const sizeBytes = parseInt(blockParts[1]) || 0;
                    
                    return {
                        ...disk,
                        totalBytes: sizeBytes,
                        usedBytes: Math.round(sizeBytes * (parseFloat(disk.usagePercent) / 100)),
                        freeBytes: sizeBytes - Math.round(sizeBytes * (parseFloat(disk.usagePercent) / 100))
                    };
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
            const { stdout } = await execAsync("ip -o addr show | grep -v lo");
            const networkLines = stdout.split('\n').filter(line => line.trim());
            
            const adapters = networkLines.map(line => {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 4) {
                    const interfaceName = parts[1];
                    const ipInfo = parts.find(part => part.includes('/'));
                    const ip = ipInfo ? ipInfo.split('/')[0] : 'N/A';
                    
                    return {
                        interface: interfaceName,
                        ipAddress: ip,
                        family: parts[2] === 'inet' ? 'IPv4' : 'IPv6'
                    };
                }
                return null;
            }).filter(Boolean);

            // Get MAC addresses
            const adaptersWithMac = await Promise.all(adapters.map(async (adapter) => {
                try {
                    const { stdout: macInfo } = await execAsync(`cat /sys/class/net/${adapter.interface}/address`);
                    return {
                        ...adapter,
                        macAddress: macInfo.trim()
                    };
                } catch (e) {
                    return { ...adapter, macAddress: 'N/A' };
                }
            }));

            return adaptersWithMac;
        } catch (error) {
            console.error('Error getting network info:', error);
            return Object.entries(os.networkInterfaces()).map(([name, addresses]) => ({
                interface: name,
                addresses: addresses,
                ipAddress: addresses.find(addr => addr.family === 'IPv4')?.address || 'N/A'
            }));
        }
    }

    // Get running processes
    async getRunningProcesses() {
        try {
            const { stdout } = await execAsync("ps aux --sort=-%mem | head -21");
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

    // Get system services
    async getSystemServices() {
        try {
            const { stdout } = await execAsync("systemctl list-units --type=service --all --no-pager");
            const serviceLines = stdout.split('\n').filter(line => line.includes('.service'));
            
            const services = serviceLines.map(line => {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 4) {
                    return {
                        name: parts[0],
                        load: parts[1],
                        active: parts[2],
                        sub: parts[3],
                        description: parts.slice(4).join(' ')
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
                    command = `journalctl -n ${maxEvents} --no-pager -o short`;
                    break;
                case 'kernel':
                    command = `dmesg | tail -${maxEvents}`;
                    break;
                case 'auth':
                    command = `journalctl -u ssh -n ${maxEvents} --no-pager -o short`;
                    break;
                default:
                    command = `journalctl -n ${maxEvents} --no-pager -o short`;
            }

            const { stdout } = await execAsync(command);
            const logLines = stdout.split('\n').filter(line => line.trim());
            
            const logs = logLines.map(line => {
                // Parse journalctl format: timestamp hostname service[pid]: message
                const match = line.match(/^(\w+\s+\d+\s+[\d:]+)\s+(\w+)\s+(.+?):\s*(.+)$/);
                if (match) {
                    return {
                        timestamp: match[1],
                        hostname: match[2],
                        service: match[3],
                        message: match[4],
                        level: this.getLogLevel(match[4])
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
            return [];
        }
    }

    // Determine log level from message content
    getLogLevel(message) {
        const lowerMessage = message.toLowerCase();
        if (lowerMessage.includes('error') || lowerMessage.includes('failed')) return 'error';
        if (lowerMessage.includes('warning') || lowerMessage.includes('warn')) return 'warning';
        if (lowerMessage.includes('critical') || lowerMessage.includes('fatal')) return 'critical';
        return 'info';
    }

    // Get Linux distribution information
    async getDistributionInfo() {
        try {
            const { stdout } = await execAsync("lsb_release -a 2>/dev/null || cat /etc/os-release");
            const lines = stdout.split('\n');
            let distInfo = {};

            lines.forEach(line => {
                if (line.includes('=')) {
                    const [key, value] = line.split('=');
                    distInfo[key.trim()] = value.replace(/"/g, '').trim();
                } else if (line.includes(':')) {
                    const [key, value] = line.split(':');
                    distInfo[key.trim()] = value.trim();
                }
            });

            return distInfo;
        } catch (error) {
            console.error('Error getting distribution info:', error);
            return { distribution: 'Unknown Linux' };
        }
    }

    // Get all system information
    async getAllSystemInfo() {
        try {
            console.log('Gathering comprehensive Linux system information...');

            const [
                basicInfo,
                cpuInfo,
                memoryInfo,
                diskInfo,
                networkInfo,
                processes,
                services,
                distInfo,
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
                this.getDistributionInfo(),
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
                distribution: distInfo,
                logs: {
                    system: systemLogs,
                    kernel: kernelLogs
                },
                performance: {
                    cpuUsage: cpuInfo?.cpuUsage || 0,
                    memoryUsage: parseFloat(memoryInfo?.memoryUsagePercent || 0),
                    diskUsage: diskInfo.length > 0 ? parseFloat(diskInfo[0].usagePercent) : 0,
                    loadAverage: os.loadavg()
                }
            };
        } catch (error) {
            console.error('Error gathering all Linux system info:', error);
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
                    loadAverage: os.loadavg()
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

module.exports = LinuxSystemInfo;