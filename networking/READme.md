# MKenya Tool - Networking & System Information

A comprehensive distributed machine coordination system with real-time system monitoring, secure peer-to-peer communication, and intelligent resource management.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    MKenya Tool Application                   │
├─────────────────────────────────────────────────────────────┤
│  🖥️ System Information Layer                               │
│  ├── Windows System Info (WMI/PowerShell)                  │
│  ├── Linux System Info (/proc, systemctl)                 │
│  ├── macOS System Info (system_profiler)                  │
│  └── Resource Optimization Manager                         │
├─────────────────────────────────────────────────────────────┤
│  🌐 Networking Layer                                       │
│  ├── Enhanced Private Network Coordinator                  │
│  ├── Data Transfer Manager                                 │
│  ├── Distributed Storage Manager                           │
│  └── Network File System                                   │
├─────────────────────────────────────────────────────────────┤
│  ⚡ Nostr Protocol Infrastructure                          │
│  ├── Multiple Relay Connections                            │
│  ├── Cryptographic Verification                            │
│  ├── Event-driven Communication                            │
│  └── Private Network Filtering                             │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
mkenyatool/
├── networking/                          # Networking & Communication
│   ├── index.js                        # Main networking entry point
│   ├── enhanced-private-network-coordinator.js  # Core coordination
│   ├── enhanced-coordination-integration.js     # Electron integration
│   ├── coordinator-preload.js          # Renderer process bridge
│   ├── data-transfer-manager.js         # File & data transfers
│   ├── distributed-storage-manager.js   # Network storage
│   ├── network-file-system.js          # Folder synchronization
│   └── resource-optimization-manager.js # Performance optimization
├── systeminfo/                         # System Information
│   ├── systeminfo.js                   # Platform manager
│   ├── optimized-systeminfo.js         # Optimized version
│   ├── systeminfo_win.js               # Windows implementation
│   ├── systeminfo_linux.js             # Linux implementation
│   └── systeminfo_mac.js               # macOS implementation
└── main.js                             # Application entry point
```

## 🚀 Quick Start

### Basic Usage

```javascript
const { MKenyaNetworking } = require('./networking');

// Initialize networking
const networking = new MKenyaNetworking({
    appIdentifier: 'my-app',
    appVersion: '1.0.0'
});

// For Electron apps
await networking.initializeElectronApp();

// For Node.js apps
await networking.initializeStandalone();

// Send a message to all machines
await networking.sendMessage('Hello network!');

// Send a file to specific machine
await networking.sendFile('./document.pdf', 'target-machine-id');

// Sync a folder across network
await networking.syncFolder('./local-folder', 'shared-docs');
```

### System Information

```javascript
const OptimizedSystemInfoManager = require('./systeminfo/optimized-systeminfo');

const systemInfo = new OptimizedSystemInfoManager();

// Get basic system info
const basicInfo = await systemInfo.getBasicInfo();

// Start lightweight monitoring
await systemInfo.startMonitoring(5000, {
    lightweight: true,
    includeProcesses: false
});

// Listen for updates
systemInfo.on('data', (data) => {
    console.log('CPU Usage:', data.cpu.usage);
    console.log('Memory Usage:', data.memory.usage);
});
```

## 🔧 Core Components

### 1. Enhanced Private Network Coordinator

**Purpose**: Secure peer discovery and verification
**Key Features**:
- Cryptographic peer verification
- Private network isolation
- Real-time status broadcasting
- Automatic reconnection

```javascript
// Data structure for peer verification
{
    appIdentifier: 'mkenyatool-network',
    appVersion: '1.0.0',
    capabilities: {
        platform: 'win32',
        cpuCores: 8,
        totalMemory: 16777216000,
        cpuModel: 'Intel Core i7-9700K'
    },
    performance: {
        cpuUsage: 25.5,
        memoryUsage: 45.2,
        healthScore: 85
    },
    proof: {
        hash: 'sha256_hash_of_verification_data',
        signature: 'cryptographic_signature'
    }
}
```

### 2. Data Transfer Manager

**Purpose**: Reliable file and data transmission
**Key Features**:
- Chunked file transfers with resume capability
- Progress tracking and error recovery
- Compression and encryption support
- Concurrent transfer management

```javascript
// File transfer metadata
{
    transferId: 'unique_transfer_id',
    fileName: 'document.pdf',
    fileSize: 2048576,
    compressedSize: 1234567,
    compression: true,
    totalChunks: 64,
    sentChunks: 32,
    status: 'sending',
    startTime: 1625097600000
}
```

### 3. Distributed Storage Manager

**Purpose**: Network-wide data storage with replication
**Key Features**:
- Multi-machine data replication
- Automatic failover and recovery
- TTL-based data expiration
- Storage capacity management

```javascript
// Storage metadata
{
    storageId: 'unique_storage_id',
    key: 'user_preferences',
    dataHash: 'sha256_data_hash',
    replicas: 3,
    replicatedMachines: ['machine1', 'machine2', 'machine3'],
    ttl: 3600000,
    timestamp: 1625097600000
}
```

### 4. Network File System

**Purpose**: Real-time folder synchronization
**Key Features**:
- Bidirectional sync
- Conflict resolution
- File change detection
- Exclude pattern support

```javascript
// Sync configuration
{
    localPath: './documents',
    networkPath: 'shared-documents',
    autoSync: true,
    bidirectional: true,
    excludePatterns: ['*.tmp', '.DS_Store'],
    lastSync: 1625097600000,
    fileIndex: Map<string, FileInfo>
}
```

## 📊 System Information Data Structures

### Basic System Info
```javascript
{
    hostname: 'DESKTOP-ABC123',
    platform: 'win32',
    architecture: 'x64',
    uptime: 86400,
    totalMemory: 16777216000,
    freeMemory: 8388608000,
    cpuCount: 8,
    cpuModel: 'Intel(R) Core(TM) i7-9700K CPU @ 3.60GHz',
    nodeVersion: 'v16.14.0'
}
```

### CPU Information
```javascript
{
    cpuDetails: {
        name: 'Intel Core i7-9700K',
        cores: 8,
        logicalProcessors: 8,
        maxClockSpeed: 3600,
        currentClockSpeed: 3600,
        l2Cache: 256,
        l3Cache: 12288
    },
    cpuUsage: 25.5,
    loadAverage: [0.5, 0.7, 0.8]
}
```

### Memory Information
```javascript
{
    totalPhysical: 16777216000,
    freePhysical: 8388608000,
    usedPhysical: 8388608000,
    available: 10737418240,
    memoryUsagePercent: 50.0,
    buffers: 134217728,
    cached: 2147483648,
    processMemory: {
        rss: 67108864,
        heapTotal: 33554432,
        heapUsed: 25165824,
        external: 8388608
    }
}
```

### Performance Metrics
```javascript
{
    timestamp: '2025-01-15T10:30:00.000Z',
    performance: {
        cpu: {
            usage: 25.5,
            cores: 8,
            loadAverage: [0.5, 0.7, 0.8],
            model: 'Intel Core i7-9700K'
        },
        memory: {
            usage: 50.0,
            total: 16777216000,
            free: 8388608000,
            available: 10737418240
        },
        disk: [{
            drive: 'C:',
            usage: 65.5,
            free: 536870912000,
            total: 1099511627776
        }],
        uptime: 86400
    },
    recommendations: [{
        type: 'System',
        level: 'good',
        message: 'System performance is optimal'
    }]
}
```

## 🔄 How Components Work Together

### 1. Initialization Flow
```
1. Resource Optimization Manager starts
2. System Info Manager initializes platform-specific modules
3. Network Coordinator establishes relay connections
4. Peer discovery and verification begins
5. Data transfer, storage, and file sync services start
6. Real-time monitoring begins
```

### 2. Peer Discovery Process
```
Machine A                 Nostr Relays              Machine B
    |                          |                        |
    |-- APP_VERIFICATION ----->|                        |
    |                          |<--- APP_VERIFICATION --|
    |<-- Broadcast to peers ---|                        |
    |                          |-- Forward to Machine B->|
    |                          |                        |
    |<-- VERIFICATION_RESPONSE |<-- VERIFICATION_RESPONSE|
    |                          |                        |
    |-- Peer added to verified list                     |
    |                          |                        |
    |<-- Regular status updates and communication ----->|
```

### 3. Data Flow Architecture
```
Application Layer
       ↓
MKenyaNetworking API
       ↓
┌─────────────────┬─────────────────┬─────────────────┐
│ Data Transfer   │ Distributed     │ Network File    │
│ Manager         │ Storage         │ System          │
└─────────────────┴─────────────────┴─────────────────┘
       ↓                    ↓                    ↓
Enhanced Private Network Coordinator
       ↓
Nostr Protocol Layer
       ↓
Multiple Relay Connections
       ↓
Network (Internet/LAN)
```

## 🛡️ Security Model

### Cryptographic Verification
- **Peer Authentication**: Each machine proves identity using cryptographic signatures
- **Network Isolation**: Only verified app instances can join the private network
- **Message Integrity**: All messages are signed and verified
- **Replay Protection**: Timestamps prevent replay attacks

### Network Security
```javascript
// Verification process
const proof = {
    networkSecret: 'shared_secret_key',
    timestamp: Date.now(),
    appId: 'mkenyatool-network',
    publicKey: 'machine_public_key'
};

const proofHash = sha256(JSON.stringify(proof));
const signature = sign(proofHash, privateKey);
```

## 📈 Performance Optimization

### Resource Management
- **Smart Caching**: Different TTL for different data types
- **Rate Limiting**: Prevents system overload
- **Memory Monitoring**: Automatic cleanup when usage is high
- **Throttled Operations**: Prevents excessive API calls

### Optimization Features
```javascript
// Cache configuration
const cacheConfig = {
    basic: { ttl: 30000 },    // 30 seconds
    cpu: { ttl: 5000 },       // 5 seconds
    memory: { ttl: 2000 },    // 2 seconds
    disk: { ttl: 60000 },     // 1 minute
    network: { ttl: 30000 }   // 30 seconds
};

// Resource limits
const threadLimits = {
    maxSafeThreads: cpuCores * 4,
    recommendedThreads: cpuCores * 2,
    memoryPerThread: 2 * 1024 * 1024 // 2MB
};
```

## 🔧 Configuration Options

### Network Configuration
```javascript
const config = {
    appIdentifier: 'my-app-name',
    appVersion: '1.0.0',
    networkSecret: 'your-secure-network-key',
    minRequiredVersion: '1.0.0',
    machineId: 'unique-machine-identifier',
    
    // Relay configuration
    relays: [
        'wss://relay.damus.io',
        'wss://nos.lol',
        'wss://relay.nostr.band'
    ],
    
    // Performance settings
    maxChunkSize: 32768,        // 32KB
    maxConcurrentTransfers: 5,
    transferTimeout: 300000,    // 5 minutes
    heartbeatInterval: 30000,   // 30 seconds
    isolationTimeout: 300000    // 5 minutes
};
```

### System Monitoring Configuration
```javascript
const monitoringOptions = {
    interval: 5000,             // Update frequency
    lightweight: true,          // Essential metrics only
    includeProcesses: false,    // Skip process enumeration
    includeDisk: false,         // Skip disk info
    includeNetwork: false,      // Skip network details
    
    // Cache settings
    maxCacheSize: 100,
    maxCacheAge: 300000,        // 5 minutes
    
    // Resource thresholds
    memoryThreshold: 100 * 1024 * 1024,  // 100MB
    cpuThreshold: 80,           // 80% CPU usage
    diskThreshold: 90           // 90% disk usage
};
```

## 📋 Event System

### Network Events
```javascript
networking.onPeerConnected((peerId, data) => {
    console.log(`New machine: ${data.capabilities.hostname}`);
});

networking.onMessageReceived((message) => {
    console.log(`Message from ${message.authorName}: ${message.content}`);
});

networking.onFileReceived((fileInfo) => {
    console.log(`File received: ${fileInfo.fileName} (${fileInfo.fileSize} bytes)`);
});
```

### System Events
```javascript
systemInfo.on('data', (data) => {
    console.log(`CPU: ${data.cpu.usage}%, Memory: ${data.memory.usage}%`);
});

systemInfo.on('high-memory-usage', (data) => {
    console.warn(`High memory usage: ${data.usage} bytes`);
});
```

## 🚨 Error Handling

### Network Errors
- **Connection Failures**: Automatic retry with exponential backoff
- **Verification Failures**: Peer rejection with detailed logging
- **Transfer Errors**: Resume capability and error reporting
- **Relay Disconnections**: Multi-relay redundancy

### System Errors
- **Platform Detection**: Graceful fallback to basic info
- **Permission Errors**: Safe error handling with user feedback
- **Resource Exhaustion**: Automatic cleanup and optimization

## 📚 API Reference

### Core Networking API
```javascript
// Initialization
await networking.initializeElectronApp();
await networking.initializeStandalone();

// Communication
await networking.sendMessage(content, targetMachineId);
await networking.sendFile(filePath, targetMachineId, options);
await networking.sendData(dataObject, targetMachineId, options);

// Storage
await networking.storeDistributed(key, data, options);
const data = await networking.retrieveDistributed(key, options);

// File System
await networking.syncFolder(localPath, networkPath, options);

// Information
const machines = networking.getMachines();
const stats = networking.getNetworkStats();
const myInfo = await networking.getMyInfo();

// Management
await networking.refreshNetwork();
await networking.shutdown();
```

### System Information API
```javascript
// Basic Information
const basicInfo = await systemInfo.getBasicInfo();
const cpuInfo = await systemInfo.getCPUInfo();
const memoryInfo = await systemInfo.getMemoryInfo();
const diskInfo = await systemInfo.getDiskInfo();

// Performance
const performance = await systemInfo.getPerformanceMetrics();
const limits = await systemInfo.calculateOptimalThreadLimits();
const validation = await systemInfo.validateAttackResources(threadCount);

// Monitoring
await systemInfo.startMonitoring(interval, options);
await systemInfo.stopMonitoring();

// Resource Management
const stats = systemInfo.getPerformanceStats();
await systemInfo.performMemoryCleanup();
```

## 🔮 Future Enhancements

### Planned Features
- **Load Balancing**: Intelligent task distribution based on machine capabilities
- **Fault Tolerance**: Advanced error recovery and redundancy
- **Metrics Dashboard**: Real-time visualization of network and system metrics
- **Plugin System**: Extensible architecture for custom modules
- **Mobile Support**: React Native integration for mobile coordination

### Scalability Improvements
- **Clustering**: Support for machine groups and hierarchical networks
- **Bandwidth Optimization**: Adaptive compression and prioritization
- **Edge Computing**: Distributed processing capabilities
- **Cloud Integration**: Hybrid cloud-local coordination

---

## 📄 License

This project is part of the MKenya Tool suite. All rights reserved.

---

## 🤝 Contributing

For development and contributions:
1. Follow the established architecture patterns
2. Maintain backward compatibility
3. Add comprehensive tests for new features
4. Update documentation for API changes
5. Ensure resource optimization compliance