// preload.js - Enhanced with Multi-Target Attacks & Networking
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  startDDosAttack: async (target, layer, method, duration, options = {}) => {
    return await ipcRenderer.invoke('start-ddos-attack', {
      target,
      layer,
      method,
      duration,
      options
    });
  },

  startMultiTargetAttack: async (config) => {
    return await ipcRenderer.invoke('start-multi-target-attack', config);
  },

  startEnhancedAttack: async (config) => {
    return await ipcRenderer.invoke('start-enhanced-attack', config);
  },

  stopAttack: async (attackId) => {
    return await ipcRenderer.invoke('stop-attack', attackId);
  },

  stopAllAttacks: async () => {
    return await ipcRenderer.invoke('stop-all-attacks');
  },

  getActiveAttacks: async () => {
    return await ipcRenderer.invoke('get-active-attacks');
  },

  getAttackStats: async (attackId) => {
    return await ipcRenderer.invoke('get-attack-stats', attackId);
  },

  getAttackHistory: async () => {
    return await ipcRenderer.invoke('get-attack-history');
  },

  getGlobalAttackStats: async () => {
    return await ipcRenderer.invoke('get-global-attack-stats');
  },

  validateAttackConfig: async (config) => {
    return await ipcRenderer.invoke('validate-attack-config', config);
  },

  validateProxies: async (proxyList) => {
    return await ipcRenderer.invoke('validate-proxies', proxyList);
  },

  startNetworking: async () => {
    return await ipcRenderer.invoke('start-networking');
  },

  stopNetworking: async () => {
    return await ipcRenderer.invoke('stop-networking');
  },

  getNetworkStats: async () => {
    return await ipcRenderer.invoke('get-network-stats');
  },

  updateAttackStats: async (stats) => {
    return await ipcRenderer.invoke('update-attack-stats', stats);
  },

  getPeerDetails: async () => {
    return await ipcRenderer.invoke('get-peer-details');
  },

  testConnectivity: async () => {
    return await ipcRenderer.invoke('test-connectivity');
  },

  discoverPeers: async () => {
    return await ipcRenderer.invoke('discover-peers');
  },

  getNetworkOptimizations: async () => {
    return await ipcRenderer.invoke('get-network-optimizations');
  },

  exportNetworkData: async () => {
    return await ipcRenderer.invoke('export-network-data');
  },

  onAttackProgress: (callback) => {
    ipcRenderer.on('attack-progress', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('attack-progress');
  },

  onAttackCompleted: (callback) => {
    ipcRenderer.on('attack-completed', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('attack-completed');
  },

  onResourceUpdate: (callback) => {
    ipcRenderer.on('resource-update', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('resource-update');
  },

  onLogMessage: (callback) => {
    ipcRenderer.on('log-message', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('log-message');
  },

  onNetworkingStarted: (callback) => {
    ipcRenderer.on('networking-started', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('networking-started');
  },

  onPeerDiscovered: (callback) => {
    ipcRenderer.on('peer-discovered', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('peer-discovered');
  },

  onNetworkStatsUpdated: (callback) => {
    ipcRenderer.on('network-stats-updated', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('network-stats-updated');
  },

  onRelayConnected: (callback) => {
    ipcRenderer.on('relay-connected', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('relay-connected');
  },

  onMonitoringData: (callback) => {
    ipcRenderer.on('monitoring-data', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('monitoring-data');
  },

  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('attack-progress');
    ipcRenderer.removeAllListeners('attack-completed');
    ipcRenderer.removeAllListeners('resource-update');
    ipcRenderer.removeAllListeners('log-message');
    ipcRenderer.removeAllListeners('networking-started');
    ipcRenderer.removeAllListeners('peer-discovered');
    ipcRenderer.removeAllListeners('network-stats-updated');
    ipcRenderer.removeAllListeners('relay-connected');
    ipcRenderer.removeAllListeners('monitoring-data');
  },

  getSystemInfo: async () => {
    return await ipcRenderer.invoke('get-system-info');
  },

  getBasicInfo: async () => {
    return await ipcRenderer.invoke('get-basic-info');
  },

  getCPUInfo: async () => {
    return await ipcRenderer.invoke('get-cpu-info');
  },

  getMemoryInfo: async () => {
    return await ipcRenderer.invoke('get-memory-info');
  },

  getDiskInfo: async () => {
    return await ipcRenderer.invoke('get-disk-info');
  },

  getNetworkInfo: async () => {
    return await ipcRenderer.invoke('get-network-info');
  },

  getProcesses: async () => {
    return await ipcRenderer.invoke('get-processes');
  },

  getSystemLogs: async (logType = 'system', maxEvents = 50) => {
    return await ipcRenderer.invoke('get-system-logs', { logType, maxEvents });
  },

  getPerformanceMetrics: async () => {
    return await ipcRenderer.invoke('get-performance-metrics');
  },

  getPlatformInfo: async () => {
    return await ipcRenderer.invoke('get-platform-info');
  },

  getOptimizationRecommendations: async () => {
    return await ipcRenderer.invoke('get-optimization-recommendations');
  },

  startMonitoring: async (interval = 5000) => {
    return await ipcRenderer.invoke('start-monitoring', { interval });
  },

  stopMonitoring: async () => {
    return await ipcRenderer.invoke('stop-monitoring');
  },

  exportSystemInfo: async (format = 'json') => {
    return await ipcRenderer.invoke('export-system-info', { format });
  },

  navigateToMain: async () => {
    return await ipcRenderer.invoke('navigate-to-main');
  },

  createSingleTargetConfig: (target, layer, method, duration, options = {}) => ({
    targets: [target],
    layer,
    method,
    duration,
    threadsPerTarget: options.threads || 50,
    useProxies: options.useProxies || false,
    proxyList: options.proxyList || [],
    ...options
  }),

  createMultiTargetConfig: (targets, layer, method, duration, options = {}) => ({
    targets: Array.isArray(targets) ? targets : [targets],
    layer,
    method,
    duration,
    threadsPerTarget: options.threadsPerTarget || 50,
    maxConcurrentTargets: options.maxConcurrentTargets || 10,
    coordinateTargets: options.coordinateTargets !== false,
    useProxies: options.useProxies || false,
    proxyList: options.proxyList || [],
    rampUpTime: options.rampUpTime || 0,
    adaptiveScaling: options.adaptiveScaling !== false,
    resourceSharing: options.resourceSharing !== false,
    ...options
  }),

  createTargetConfig: (target, priority = 1, weight = 1, customConfig = {}) => ({
    target,
    priority,
    weight,
    customConfig
  }),

  createProxyConfig: (proxyList, rotationStrategy = 'round-robin') => ({
    useProxies: true,
    proxyList,
    rotationStrategy // 'round-robin', 'random', 'performance-based'
  }),

  formatAttackStats: (stats) => ({
    duration: stats.duration ? `${stats.duration}s` : '0s',
    requestsPerSecond: stats.requestsPerSecond || 0,
    successRate: `${stats.successRate || 0}%`,
    bandwidth: formatBytes(stats.currentBandwidth || 0) + '/s',
    totalData: formatBytes(stats.totalBytes || 0),
    targets: stats.targets?.length || 1,
    errors: stats.totalErrors || 0
  }),

  // Network statistics formatting
  formatNetworkStats: (stats) => ({
    totalUsers: stats.totalOnlineUsers || 1,
    totalBandwidth: formatBytes(stats.totalBandwidth || 0) + '/s',
    topMachine: stats.topMachine ? `${formatBytes(stats.topMachine.bandwidth || 0)}/s` : 'You',
    yourContribution: stats.yourBandwidth ? `${formatBytes(stats.yourBandwidth)}/s` : '0 B/s',
    connectionMethods: stats.activeMethods || 0,
    peers: stats.totalPeers || 0
  }),

  getAppVersion: () => {
    return process.env.npm_package_version || '1.0.0';
  },

  getPlatform: () => {
    return process.platform;
  },

  // Enhanced bytes formatting
  formatBytes: (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  },

  // Enhanced uptime formatting
  formatUptime: (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  },

  // Duration formatting for attacks
  formatDuration: (milliseconds) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  },

  // Status color helper
  getStatusColor: (percentage) => {
    if (percentage < 50) return 'green';
    if (percentage < 75) return 'orange';
    return 'red';
  },

  // Recommendation level color
  getRecommendationColor: (level) => {
    switch (level) {
      case 'good': return 'green';
      case 'medium': return 'orange';
      case 'high': return 'red';
      case 'critical': return 'darkred';
      default: return 'blue';
    }
  },

  // Attack priority color
  getAttackPriorityColor: (priority) => {
    if (priority >= 3) return 'red';
    if (priority >= 2) return 'orange';
    return 'green';
  },

  // Network connection quality indicator
  getNetworkQualityColor: (quality) => {
    switch (quality) {
      case 'excellent': return 'green';
      case 'good': return 'lightgreen';
      case 'fair': return 'orange';
      case 'poor': return 'red';
      default: return 'gray';
    }
  },

  validateTarget: (target) => {
    if (!target || typeof target !== 'string') {
      return { valid: false, error: 'Target must be a non-empty string' };
    }
    
    // Basic URL/IP validation
    const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?(\:\d+)?$/;
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}(\:\d+)?$/;
    const localhostPattern = /^localhost(\:\d+)?$/;
    
    if (urlPattern.test(target) || ipPattern.test(target) || localhostPattern.test(target)) {
      return { valid: true };
    }
    
    return { valid: false, error: 'Invalid target format. Use URL, IP address, or localhost' };
  },

  // Validate proxy format
  validateProxy: (proxy) => {
    if (!proxy || typeof proxy !== 'string') {
      return { valid: false, error: 'Proxy must be a non-empty string' };
    }
    
    const parts = proxy.split(':');
    if (parts.length < 2 || parts.length > 4) {
      return { valid: false, error: 'Proxy format: ip:port or ip:port:user:pass' };
    }
    
    const [ip, port] = parts;
    const portNum = parseInt(port);
    
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      return { valid: false, error: 'Invalid port number' };
    }
    
    return { valid: true };
  },

  // Validate attack configuration
  validateAttackConfigLocal: (config) => {
    const errors = [];
    
    if (!config.targets || config.targets.length === 0) {
      errors.push('At least one target is required');
    }
    
    if (!config.layer || !['LAYER4', 'LAYER7'].includes(config.layer.toUpperCase())) {
      errors.push('Layer must be LAYER4 or LAYER7');
    }
    
    if (!config.method) {
      errors.push('Attack method is required');
    }
    
    if (!config.duration || config.duration <= 0) {
      errors.push('Duration must be a positive number');
    }
    
    if (config.threadsPerTarget && (config.threadsPerTarget <= 0 || config.threadsPerTarget > 1000)) {
      errors.push('Threads per target must be between 1 and 1000');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  },
  saveUIState: (key, data) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Failed to save UI state:', error);
      return false;
    }
  },

  loadUIState: (key, defaultValue = null) => {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (error) {
      console.error('Failed to load UI state:', error);
      return defaultValue;
    }
  },

  clearUIState: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Failed to clear UI state:', error);
      return false;
    }
  },

  calculateOptimalThreads: (targets = 1, systemInfo = null) => {
    const cpuCores = systemInfo?.cpus?.length || 4;
    const baseThreads = Math.max(cpuCores * 2, 10);
    const maxThreadsPerTarget = Math.min(200, baseThreads);
    
    // Adjust based on number of targets
    if (targets > 1) {
      return Math.max(10, Math.floor(maxThreadsPerTarget / Math.sqrt(targets)));
    }
    
    return maxThreadsPerTarget;
  },

  // Resource usage recommendations
  getResourceRecommendations: (stats) => {
    const recommendations = [];
    
    if (stats.memoryUsage > 80) {
      recommendations.push({
        type: 'memory',
        level: 'high',
        message: 'High memory usage detected. Consider reducing threads or targets.'
      });
    }
    
    if (stats.cpuUsage > 85) {
      recommendations.push({
        type: 'cpu',
        level: 'high',
        message: 'High CPU usage detected. Consider reducing attack intensity.'
      });
    }
    
    if (stats.totalConnections > 800) {
      recommendations.push({
        type: 'connections',
        level: 'medium',
        message: 'Many active connections. Monitor system stability.'
      });
    }
    
    return recommendations;
  },

  debugLog: (message, level = 'info', data = null) => {
    if (process.env.NODE_ENV === 'development') {
      const timestamp = new Date().toISOString();
      const prefix = `[${level.toUpperCase()}] ${timestamp}`;
      
      switch (level) {
        case 'error':
          console.error(prefix, message, data);
          break;
        case 'warn':
          console.warn(prefix, message, data);
          break;
        case 'debug':
          console.debug(prefix, message, data);
          break;
        default:
          console.log(prefix, message, data);
      }
    }
  },

  // Performance timing helper
  performanceTimer: () => {
    const start = performance.now();
    return {
      end: () => {
        const duration = performance.now() - start;
        return Math.round(duration * 100) / 100; // Round to 2 decimal places
      }
    };
  }
});

// Helper function (available globally in renderer)
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Optional: Handle any global events
window.addEventListener('DOMContentLoaded', () => {
  console.log('MKenya Tool Enhanced - Multi-Target & Networking Ready');
  
  // Initialize debug mode if in development
  if (process.env.NODE_ENV === 'development') {
    window.electronAPI.debugLog('Enhanced MKenya Tool loaded successfully', 'info', {
      platform: window.electronAPI.getPlatform(),
      version: window.electronAPI.getAppVersion()
    });
  }
});