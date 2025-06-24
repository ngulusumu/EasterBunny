const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ===== INITIALIZATION EVENTS =====
  onInitializationComplete: (callback) => {
    ipcRenderer.on('initialization-complete', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('initialization-complete');
  },

  onInitializationError: (callback) => {
    ipcRenderer.on('initialization-error', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('initialization-error');
  },

  onInitializationStage: (callback) => {
    ipcRenderer.on('initialization-stage', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('initialization-stage');
  },

  checkInitializationStatus: async () => {
    return await ipcRenderer.invoke('check-initialization-status');
  },

  // ===== EXISTING ATTACK FUNCTIONS =====
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

  // ===== PRIVATE COORDINATION FUNCTIONS =====
  getCoordinationStatus: async () => {
    return await ipcRenderer.invoke('get-coordination-status');
  },

  sendCoordinationMessage: async (message) => {
    return await ipcRenderer.invoke('send-coordination-message', message);
  },

  getMachineList: async () => {
    return await ipcRenderer.invoke('get-machine-list');
  },

  getMyMachineInfo: async () => {
    return await ipcRenderer.invoke('get-my-machine-info');
  },

  refreshCoordinationNetwork: async () => {
    return await ipcRenderer.invoke('refresh-coordination-network');
  },

  // ===== COORDINATION EVENT LISTENERS =====
  onCoordinatorInitialized: (callback) => {
    ipcRenderer.on('coordinator:initialized', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('coordinator:initialized');
  },

  onPeerVerified: (callback) => {
    ipcRenderer.on('coordinator:peer-verified', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('coordinator:peer-verified');
  },

  onInvalidPeer: (callback) => {
    ipcRenderer.on('coordinator:invalid-peer', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('coordinator:invalid-peer');
  },

  onPeerStatusUpdate: (callback) => {
    ipcRenderer.on('coordinator:peer-status-update', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('coordinator:peer-status-update');
  },

  onPeerDisconnected: (callback) => {
    ipcRenderer.on('coordinator:peer-disconnected', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('coordinator:peer-disconnected');
  },

  onNetworkIsolated: (callback) => {
    ipcRenderer.on('coordinator:network-isolated', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('coordinator:network-isolated');
  },

  onNetworkReconnected: (callback) => {
    ipcRenderer.on('coordinator:network-reconnected', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('coordinator:network-reconnected');
  },

  onNetworkStatsUpdate: (callback) => {
    ipcRenderer.on('coordinator:network-stats-update', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('coordinator:network-stats-update');
  },

  onCoordinatorError: (callback) => {
    ipcRenderer.on('coordinator:error', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('coordinator:error');
  },

  validateAttackResources: (threadCount, targetCount = 1) => 
    ipcRenderer.invoke('validate-attack-resources', threadCount, targetCount),

  getThreadLimits: () => 
    ipcRenderer.invoke('get-thread-limits'),

  calculateThreadLimits: () => 
    ipcRenderer.invoke('calculate-thread-limits'),

  getResourceRecommendations: (threadCount, limits) => 
    ipcRenderer.invoke('get-resource-recommendations', threadCount, limits),

  // ===== ATTACK EVENT LISTENERS =====
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

  onMonitoringData: (callback) => {
    ipcRenderer.on('monitoring-data', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('monitoring-data');
  },

  // ===== SYSTEM INFO FUNCTIONS =====
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

  // ===== NAVIGATION =====
  navigateToMain: async () => {
    return await ipcRenderer.invoke('navigate-to-main');
  },

  // ===== HELPER FUNCTIONS =====
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
    rotationStrategy
  }),

  // ===== FORMATTING FUNCTIONS =====
  formatAttackStats: (stats) => ({
    duration: stats.duration ? `${stats.duration}s` : '0s',
    requestsPerSecond: stats.requestsPerSecond || 0,
    successRate: `${stats.successRate || 0}%`,
    bandwidth: formatBytes(stats.currentBandwidth || 0) + '/s',
    totalData: formatBytes(stats.totalBytes || 0),
    targets: stats.targets?.length || 1,
    errors: stats.totalErrors || 0
  }),

  formatCoordinationStats: (stats) => ({
    verifiedPeers: stats.verifiedPeers || 0,
    connectedRelays: stats.connectedRelays || 0,
    networkId: stats.networkId || 'Unknown',
    isolatedMode: stats.isolatedMode ? 'Isolated' : 'Connected',
    lastPeerContact: stats.lastPeerContact ? new Date(stats.lastPeerContact).toLocaleTimeString() : 'Never',
    status: stats.isolatedMode ? 'Standalone' : 'Networked'
  }),

  formatMachineInfo: (info) => ({
    shortId: info.publicKey ? info.publicKey.substring(0, 8) : 'Unknown',
    platform: info.capabilities?.platform || 'Unknown',
    cpuCores: info.capabilities?.cpuCores || 0,
    totalMemory: formatBytes(info.capabilities?.totalMemory || 0),
    cpuUsage: `${info.performance?.cpuUsage || 0}%`,
    memoryUsage: `${info.performance?.memoryUsage || 0}%`,
    healthScore: info.healthScore || 0,
    capabilityScore: info.capabilityScore || 0
  }),

  formatBytes: (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  },

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

  // ===== VALIDATION FUNCTIONS =====
  validateTarget: (target) => {
    if (!target || typeof target !== 'string') {
      return { valid: false, error: 'Target must be a non-empty string' };
    }
    
    const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?(\:\d+)?$/;
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}(\:\d+)?$/;
    const localhostPattern = /^localhost(\:\d+)?$/;
    
    if (urlPattern.test(target) || ipPattern.test(target) || localhostPattern.test(target)) {
      return { valid: true };
    }
    
    return { valid: false, error: 'Invalid target format. Use URL, IP address, or localhost' };
  },

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

  // ===== STATUS HELPERS =====
  getStatusColor: (percentage) => {
    if (percentage < 50) return 'green';
    if (percentage < 75) return 'orange';
    return 'red';
  },

  getHealthStatusColor: (healthScore) => {
    if (healthScore >= 80) return 'green';
    if (healthScore >= 60) return 'orange';
    if (healthScore >= 40) return 'red';
    return 'darkred';
  },

  getCapabilityStatusColor: (capabilityScore) => {
    if (capabilityScore >= 75) return 'blue';
    if (capabilityScore >= 50) return 'green';
    if (capabilityScore >= 25) return 'orange';
    return 'red';
  },

  getNetworkStatusColor: (isolatedMode) => {
    return isolatedMode ? 'orange' : 'green';
  },

  // ===== UTILITY FUNCTIONS =====
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('attack-progress');
    ipcRenderer.removeAllListeners('attack-completed');
    ipcRenderer.removeAllListeners('resource-update');
    ipcRenderer.removeAllListeners('log-message');
    ipcRenderer.removeAllListeners('monitoring-data');
    ipcRenderer.removeAllListeners('coordinator:initialized');
    ipcRenderer.removeAllListeners('coordinator:peer-verified');
    ipcRenderer.removeAllListeners('coordinator:invalid-peer');
    ipcRenderer.removeAllListeners('coordinator:peer-status-update');
    ipcRenderer.removeAllListeners('coordinator:peer-disconnected');
    ipcRenderer.removeAllListeners('coordinator:network-isolated');
    ipcRenderer.removeAllListeners('coordinator:network-reconnected');
    ipcRenderer.removeAllListeners('coordinator:network-stats-update');
    ipcRenderer.removeAllListeners('coordinator:error');
    ipcRenderer.removeAllListeners('initialization-complete');
    ipcRenderer.removeAllListeners('initialization-error');
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

  // ===== OPTIMIZATION HELPERS =====
  calculateOptimalThreads: (targets = 1, systemInfo = null) => {
    const cpuCores = systemInfo?.cpus?.length || 4;
    const baseThreads = Math.max(cpuCores * 2, 10);
    const maxThreadsPerTarget = Math.min(200, baseThreads);
    
    if (targets > 1) {
      return Math.max(10, Math.floor(maxThreadsPerTarget / Math.sqrt(targets)));
    }
    
    return maxThreadsPerTarget;
  },

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

  // ===== DEBUGGING =====
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

  performanceTimer: () => {
    const start = performance.now();
    return {
      end: () => {
        const duration = performance.now() - start;
        return Math.round(duration * 100) / 100;
      }
    };
  },

  // ===== PLATFORM INFO =====
  getAppVersion: () => {
    return process.env.npm_package_version || '2.0.0';
  },

  getPlatform: () => {
    return process.platform;
  }
});

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

window.addEventListener('DOMContentLoaded', () => {
  console.log('MKenya Tool Enhanced - Private Network Coordination Ready');
  
  if (process.env.NODE_ENV === 'development') {
    window.electronAPI.debugLog('Enhanced MKenya Tool with Private Coordination loaded successfully', 'info', {
      platform: window.electronAPI.getPlatform(),
      version: window.electronAPI.getAppVersion()
    });
  }
});