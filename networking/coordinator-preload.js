//networking/coordinator-preload.js
const { contextBridge, ipcRenderer } = require('electron');

// Expose coordinator API to renderer process
contextBridge.exposeInMainWorld('coordinatorAPI', {
    // Network status and information
    getNetworkStatus: () => ipcRenderer.invoke('coordinator:get-network-status'),
    getMyInfo: () => ipcRenderer.invoke('coordinator:get-my-info'),
    getConnectionStats: () => ipcRenderer.invoke('coordinator:get-connection-stats'),
    getNetworkStatistics: () => ipcRenderer.invoke('coordinator:get-network-statistics'),
    getMachineList: () => ipcRenderer.invoke('coordinator:get-machine-list'),
    
    // Communication
    sendGroupMessage: (content) => ipcRenderer.invoke('coordinator:send-group-message', content),
    
    // Network management
    refreshNetwork: () => ipcRenderer.invoke('coordinator:refresh-network'),
    reportMachineOffline: (machineId) => ipcRenderer.invoke('coordinator:report-machine-offline', machineId),
    
    // Event listeners for real-time updates
    onInitialized: (callback) => ipcRenderer.on('coordinator:initialized', callback),
    onPeerVerified: (callback) => ipcRenderer.on('coordinator:peer-verified', callback),
    onPeerStatusUpdate: (callback) => ipcRenderer.on('coordinator:peer-status-update', callback),
    onPeerDisconnected: (callback) => ipcRenderer.on('coordinator:peer-disconnected', callback),
    onNetworkIsolated: (callback) => ipcRenderer.on('coordinator:network-isolated', callback),
    onNetworkReconnected: (callback) => ipcRenderer.on('coordinator:network-reconnected', callback),
    onGroupMessage: (callback) => ipcRenderer.on('coordinator:group-message', callback),
    onNetworkStatsUpdate: (callback) => ipcRenderer.on('coordinator:network-stats-update', callback),
    onInvalidPeer: (callback) => ipcRenderer.on('coordinator:invalid-peer', callback),
    onError: (callback) => ipcRenderer.on('coordinator:error', callback),
    
    // Show specific views
    showNetworkStats: () => ipcRenderer.send('coordinator:show-network-stats'),
    
    // Remove event listeners
    removeListener: (channel, callback) => ipcRenderer.removeListener(channel, callback),
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});

// Expose window controls API
contextBridge.exposeInMainWorld('windowAPI', {
    minimize: () => ipcRenderer.send('window-action', 'minimize'),
    maximize: () => ipcRenderer.send('window-action', 'maximize'),
    close: () => ipcRenderer.send('window-action', 'close')
});

// Expose app information API
contextBridge.exposeInMainWorld('appAPI', {
    getVersion: () => process.env.npm_package_version || '1.0.0',
    getPlatform: () => process.platform,
    getArch: () => process.arch
});

// Enhanced logging for debugging
contextBridge.exposeInMainWorld('debugAPI', {
    log: (...args) => console.log('[Renderer]', ...args),
    warn: (...args) => console.warn('[Renderer]', ...args),
    error: (...args) => console.error('[Renderer]', ...args)
});

// Performance monitoring
contextBridge.exposeInMainWorld('performanceAPI', {
    now: () => performance.now(),
    mark: (name) => performance.mark(name),
    measure: (name, start, end) => performance.measure(name, start, end),
    getEntries: () => performance.getEntries()
});

console.log('✅ Enhanced Coordinator preload script loaded successfully');
console.log('📡 Available APIs: coordinatorAPI, windowAPI, appAPI, debugAPI, performanceAPI');