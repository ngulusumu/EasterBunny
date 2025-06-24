const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
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
// NOTE: MachineCoordinationApp is loaded conditionally in initializeCoordinationSystem()

let mainWindow;
let systemInfoManager;
let coordinationApp;
let monitoringSession = null;
let attackProgressUnsubscribe = null;
let attackCompletedUnsubscribe = null;
let resourceUpdateUnsubscribe = null;
let isInitialized = false;

// =================== REAL-TIME ATTACK TRACKING ===================
const activeAttacksMap = new Map();
const EventEmitter = require('events');
const attackEventEmitter = new EventEmitter();

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

   // Block navigation until initialization is complete
   mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
     if (!isInitialized) {
       console.log('Navigation blocked - system not initialized yet');
       event.preventDefault();
       return false;
     }
   });

   // Block new window creation until initialization is complete
   mainWindow.webContents.setWindowOpenHandler(({ url }) => {
     if (!isInitialized) {
       console.log('New window blocked - system not initialized yet');
       return { action: 'deny' };
     }
     return { action: 'allow' };
   });

   mainWindow.loadFile('renderer/loading.html');
   
   mainWindow.once('ready-to-show', () => {
     mainWindow.show();
     
     // Wait a bit for the loading page to fully render before starting initialization
     setTimeout(() => {
       startInitializationSequence();
     }, 1000);
   });

   setupApplicationMenu();
   setupAttackEventEmitter();
}

// =================== ATTACK EVENT SYSTEM ===================
function setupAttackEventEmitter() {
    // Forward events to renderer
    attackEventEmitter.on('attack-started', (data) => {
        if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
            try {
                mainWindow.webContents.send('attack-started', data);
            } catch (error) {
                console.error('Failed to send attack-started event:', error.message);
            }
        }
    });
    
    attackEventEmitter.on('attack-progress', (data) => {
        if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
            try {
                mainWindow.webContents.send('attack-progress', data);
            } catch (error) {
                console.error('Failed to send attack-progress event:', error.message);
            }
        }
    });
    
    attackEventEmitter.on('attack-completed', (data) => {
        if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
            try {
                mainWindow.webContents.send('attack-completed', data);
            } catch (error) {
                console.error('Failed to send attack-completed event:', error.message);
            }
        }
    });
    
    attackEventEmitter.on('attack-failed', (data) => {
        if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
            try {
                mainWindow.webContents.send('attack-failed', data);
            } catch (error) {
                console.error('Failed to send attack-failed event:', error.message);
            }
        }
    });
    
    console.log('Attack event emitter setup completed');
}

// =================== ATTACK PROGRESS TRACKING ===================
function trackAttackProgress(attackId, progressData) {
    if (activeAttacksMap.has(attackId)) {
        const attack = activeAttacksMap.get(attackId);
        
        // Update attack data
        Object.assign(attack, {
            progress: progressData.progress || attack.progress,
            currentBandwidth: progressData.bandwidth || progressData.currentBandwidth || attack.currentBandwidth,
            successRate: progressData.successRate || attack.successRate,
            totalRequests: progressData.totalRequests || attack.totalRequests,
            errors: progressData.errors || attack.errors,
            status: progressData.status || attack.status,
            lastUpdate: Date.now()
        });
        
        // Emit progress event
        attackEventEmitter.emit('attack-progress', {
            attackId: attackId,
            ...progressData
        });
    }
}

// =================== ATTACK SIMULATION ===================
function simulateAttackProgress(attackData) {
    const attackId = attackData.id;
    const duration = attackData.duration * 1000; // Convert to milliseconds
    const startTime = Date.now();
    
    const progressInterval = setInterval(() => {
        if (!activeAttacksMap.has(attackId)) {
            clearInterval(progressInterval);
            return;
        }
        
        const attack = activeAttacksMap.get(attackId);
        
        if (attack.status !== 'running') {
            clearInterval(progressInterval);
            return;
        }
        
        const elapsed = Date.now() - startTime;
        const progress = Math.min(100, (elapsed / duration) * 100);
        
        // Simulate realistic data with more variation
        const baseSpeed = 300000 + Math.random() * 800000; // 0.3-1.1 MB/s
        const timeVariance = Math.sin(elapsed / 2000) * 150000; // Slower sine wave
        const randomSpike = Math.random() > 0.9 ? Math.random() * 500000 : 0; // Occasional spikes
        const currentBandwidth = Math.max(50000, baseSpeed + timeVariance + randomSpike);
        
        const requestsPerSecond = Math.floor(currentBandwidth / 1000);
        const newRequests = requestsPerSecond;
        const totalRequests = attack.totalRequests + newRequests;
        
        // Simulate success rate that may degrade over time
        const timeFactorDegradation = Math.min(10, elapsed / 10000); // Up to 10% degradation over time
        const randomDegradation = Math.random() * 5; // Random 0-5% variation
        const successRate = Math.max(75, 100 - timeFactorDegradation - randomDegradation);
        
        const errorRate = (100 - successRate) / 100;
        const errors = Math.floor(totalRequests * errorRate);
        
        // Update attack data
        const progressData = {
            progress: progress,
            currentBandwidth: currentBandwidth,
            bandwidth: currentBandwidth, // Alias
            successRate: successRate,
            totalRequests: totalRequests,
            errors: errors,
            status: progress >= 100 ? 'completed' : 'running'
        };
        
        trackAttackProgress(attackId, progressData);
        
        // Complete attack if finished
        if (progress >= 100) {
            clearInterval(progressInterval);
            attack.status = 'completed';
            attack.progress = 100;
            
            attackEventEmitter.emit('attack-completed', {
                attackId: attackId,
                target: attack.target,
                success: true,
                finalStats: {
                    totalRequests: totalRequests,
                    successRate: successRate,
                    errors: errors,
                    duration: elapsed / 1000,
                    averageBandwidth: attack.averageBandwidth || currentBandwidth
                }
            });
            
            // Clear memory cache after attack completion
            if (systemInfoManager) {
                systemInfoManager.clearMemoryCache();
            }
            
            // Remove from active attacks after 30 seconds
            setTimeout(() => {
                activeAttacksMap.delete(attackId);
            }, 30000);
        }
    }, 1000); // Update every second
}

// =================== UTILITY FUNCTIONS ===================
function generateAttackId() {
    return 'attack_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function cleanupAttacks() {
    activeAttacksMap.clear();
    if (attackEventEmitter) {
        attackEventEmitter.removeAllListeners();
    }
}

// =================== INITIALIZATION ===================
async function startInitializationSequence() {
  if (isInitialized) return;
  
  try {
    console.log('Starting initialization sequence...');
    
    // Send status updates to loading page with proper error checking
    const sendStageUpdate = (stage, message) => {
      if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
        try {
          mainWindow.webContents.send('initialization-stage', { stage, message });
        } catch (error) {
          console.error('Failed to send stage update:', error.message);
        }
      }
    };
    
    sendStageUpdate(1, 'Initializing system manager...');
    await initializeSystemManager();
    
    sendStageUpdate(2, 'Starting private network coordination...');
    await initializeCoordinationSystem();
    
    sendStageUpdate(3, 'Setting up attack monitoring...');
    await setupAttackMonitoring();
    
    sendStageUpdate(4, 'Configuring logging system...');
    await setupLogging();
    
    sendStageUpdate(5, 'Running final checks...');
    
    // Final delay to ensure everything is properly initialized
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    isInitialized = true;
    
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
      try {
        mainWindow.webContents.send('initialization-complete', {
          success: true,
          message: 'All systems initialized successfully'
        });
      } catch (error) {
        console.error('Failed to send initialization complete:', error.message);
      }
    }
    
    console.log('Initialization sequence completed successfully');
    
  } catch (error) {
    console.error('Initialization failed:', error);
    
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
      try {
        mainWindow.webContents.send('initialization-error', {
          success: false,
          error: error.message,
          stage: 'initialization'
        });
      } catch (sendError) {
        console.error('Failed to send initialization error:', sendError.message);
      }
    }
  }
}

async function initializeSystemManager() {
  console.log('Initializing system manager...');
  try {
    systemInfoManager = new SystemInfoManager();
    await new Promise(resolve => setTimeout(resolve, 800));
    console.log('System manager initialized successfully');
  } catch (error) {
    console.error('System manager initialization failed:', error);
    throw error;
  }
}

async function initializeCoordinationSystem() {
  console.log('Initializing private network coordination...');
  try {
    // Check if the coordination system needs a tray icon
    const iconPath = path.join(__dirname, 'icons', 'tray-icon.png');
    const iconExists = await fs.access(iconPath).then(() => true).catch(() => false);
    
    if (!iconExists) {
      console.warn('Tray icon not found, creating minimal coordination system...');
      // Create a mock coordination system that doesn't require external resources
      coordinationApp = { 
        coordinator: {
          getPrivateNetworkStatus: () => ({ isolatedMode: true, verifiedPeers: 0, connectedRelays: 0, networkId: 'standalone' }),
          sendPrivateMessage: () => Promise.resolve({ success: false, message: 'Coordination disabled' }),
          broadcastAppVerification: () => Promise.resolve(),
          statusManager: {
            getDetailedSystemInfo: () => Promise.resolve({}),
            extractCoordinationInfo: () => ({}),
            getSystemHealthScore: () => Promise.resolve(0),
            getMachineCapabilityScore: () => Promise.resolve(0)
          },
          keyManager: { publicKey: 'standalone-mode' },
          getNetworkId: () => 'standalone'
        },
        cleanup: () => Promise.resolve()
      };
    } else {
      // Only instantiate the real coordination system if the icon exists
      const MachineCoordinationApp = require('./networking/coordinator-integration');
      coordinationApp = new MachineCoordinationApp();
    }
    
    await new Promise(resolve => setTimeout(resolve, 1200));
    console.log('Coordination system initialized successfully');
  } catch (error) {
    console.warn('Coordination system initialization failed:', error.message);
    // Create minimal fallback
    coordinationApp = { 
      coordinator: null,
      cleanup: () => Promise.resolve()
    };
  }
}

function setupApplicationMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Export Attack Data',
          click: async () => {
            try {
              const history = getAttackHistory();
              const result = await dialog.showSaveDialog(mainWindow, {
                title: 'Export Attack Data',
                defaultPath: `attack-data-${new Date().toISOString().split('T')[0]}.json`,
                filters: [{ name: 'JSON Files', extensions: ['json'] }]
              });

              if (!result.canceled && result.filePath) {
                await fs.writeFile(result.filePath, JSON.stringify(history, null, 2));
              }
            } catch (error) {
              console.error('Export failed:', error);
            }
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Network',
      submenu: [
        {
          label: 'Network Status',
          click: async () => {
            try {
              if (coordinationApp && coordinationApp.coordinator) {
                const status = coordinationApp.coordinator.getPrivateNetworkStatus();
                dialog.showMessageBox(mainWindow, {
                  type: 'info',
                  title: 'Private Network Status',
                  message: `Status: ${status.isolatedMode ? 'Isolated' : 'Connected'}\nVerified Peers: ${status.verifiedPeers}\nConnected Relays: ${status.connectedRelays}\nNetwork ID: ${status.networkId}`
                });
              } else {
                dialog.showMessageBox(mainWindow, {
                  type: 'warning',
                  title: 'Network Status',
                  message: 'Coordination system not initialized'
                });
              }
            } catch (error) {
              console.error('Failed to get network status:', error);
            }
          }
        },
        {
          label: 'Refresh Network',
          click: async () => {
            try {
              if (coordinationApp && coordinationApp.coordinator) {
                await coordinationApp.coordinator.broadcastAppVerification();
                console.log('Network refresh initiated');
              }
            } catch (error) {
              console.error('Failed to refresh network:', error);
            }
          }
        }
      ]
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'System Information',
          click: () => {
            mainWindow.webContents.send('show-system-info');
          }
        },
        {
          label: 'Attack Statistics',
          click: () => {
            mainWindow.webContents.send('show-attack-stats');
          }
        },
        { type: 'separator' },
        {
          label: 'Developer Tools',
          accelerator: 'F12',
          click: () => {
            mainWindow.webContents.toggleDevTools();
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About MkenyaTool',
              message: 'MkenyaTool v2.0\nAdvanced Network Testing Tool with Private Coordination'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

async function setupAttackMonitoring() {
    console.log('Setting up attack monitoring...');
    try {
      attackProgressUnsubscribe = onAttackProgress((data) => {
          if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
            try {
              mainWindow.webContents.send('attack-progress', data);
            } catch (error) {
              console.error('Failed to send attack progress:', error.message);
            }
          }
      });
      
      attackCompletedUnsubscribe = onAttackCompleted((data) => {
          if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
            try {
              mainWindow.webContents.send('attack-completed', data);
            } catch (error) {
              console.error('Failed to send attack completed:', error.message);
            }
          }
      });
      
      resourceUpdateUnsubscribe = onResourceUpdate((stats) => {
          if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
            try {
              mainWindow.webContents.send('resource-update', stats);
            } catch (error) {
              console.error('Failed to send resource update:', error.message);
            }
          }
      });
      
      await new Promise(resolve => setTimeout(resolve, 600));
      console.log('Attack monitoring setup completed');
    } catch (error) {
      console.error('Attack monitoring setup failed:', error);
      throw error;
    }
}

async function setupLogging() {
  console.log('Setting up logging system...');
  try {
    const logLevel = process.env.NODE_ENV === 'development' ? 'debug' : 'info';
    
    const logDir = path.join(app.getPath('userData'), 'logs');
    await fs.mkdir(logDir, { recursive: true });
    
    const logPath = path.join(logDir, `mkenya-${new Date().toISOString().split('T')[0]}.log`);
    
    setLogLevel(logLevel);
    setLogFile(logPath);
    
    if (logger && logger.on) {
      logger.on('log', (logEntry) => {
        // Check if mainWindow exists and is not destroyed before sending
        if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
          try {
            mainWindow.webContents.send('log-message', logEntry);
          } catch (error) {
            console.error('Failed to send log message to renderer:', error.message);
          }
        }
      });
    }
    
    await new Promise(resolve => setTimeout(resolve, 400));
    
    console.log(`Log level set to ${logLevel}`);
    console.log(`Logging to file: ${logPath}`);
    console.log('Logging system setup completed');
    
  } catch (error) {
    console.error('Failed to setup logging:', error);
    setLogLevel(process.env.NODE_ENV === 'development' ? 'debug' : 'info');
    throw error;
  }
}

// =================== APP INITIALIZATION ===================
app.whenReady().then(() => {
  createWindow();

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Promise Rejection at:', promise, 'reason:', reason);
    // Log the error but don't crash the app
    if (reason && reason.message && reason.message.includes('tray-icon.png')) {
      console.warn('Tray icon missing - coordination system will run without tray functionality');
    }
  });

  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Log the error but don't crash unless it's critical
    if (error.message && error.message.includes('Object has been destroyed')) {
      console.warn('Window destroyed - this is normal during app shutdown');
      return;
    }
    // For other critical errors, you might want to restart or show error dialog
  });

  // =================== SYSTEM VALIDATION IPC HANDLERS ===================
  ipcMain.handle('validate-attack-resources', async (event, threadCount, targetCount = 1) => {
    if (!isInitialized || !systemInfoManager) {
      return { success: false, error: 'System manager not initialized' };
    }
    
    try {
      const validation = await systemInfoManager.validateAttackResources(threadCount, targetCount);
      return { success: true, data: validation };
    } catch (error) {
      console.error('Error validating attack resources:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-thread-limits', async (event) => {
    if (!isInitialized || !systemInfoManager) {
      return { success: false, error: 'System manager not initialized' };
    }
    
    try {
      const limits = await systemInfoManager.getDynamicThreadLimits();
      return { success: true, data: limits };
    } catch (error) {
      console.error('Error getting thread limits:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('calculate-thread-limits', async (event) => {
    if (!isInitialized || !systemInfoManager) {
      return { success: false, error: 'System manager not initialized' };
    }
    
    try {
      const limits = await systemInfoManager.calculateOptimalThreadLimits();
      return { success: true, data: limits };
    } catch (error) {
      console.error('Error calculating thread limits:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-resource-recommendations', async (event, threadCount, limits) => {
    if (!isInitialized || !systemInfoManager) {
      return { success: false, error: 'System manager not initialized' };
    }
    
    try {
      const recommendations = await systemInfoManager.getResourceRecommendations(threadCount, limits);
      return { success: true, data: recommendations };
    } catch (error) {
      console.error('Error getting resource recommendations:', error);
      return { success: false, error: error.message };
    }
  });

  // =================== REAL-TIME ATTACK IPC HANDLERS ===================
  ipcMain.handle('get-active-attacks', async () => {
    try {
      const attacks = Array.from(activeAttacksMap.values()).map(attack => ({
        id: attack.id,
        target: attack.target,
        targets: attack.targets,
        method: attack.method,
        layer: attack.layer,
        status: attack.status,
        startTime: attack.startTime,
        duration: attack.duration,
        threads: attack.threads,
        progress: attack.progress || 0,
        currentBandwidth: attack.currentBandwidth || 0,
        bandwidth: attack.currentBandwidth || 0, // Alias for compatibility
        successRate: attack.successRate || 100,
        totalRequests: attack.totalRequests || 0,
        errors: attack.errors || 0,
        lastUpdate: attack.lastUpdate || Date.now()
      }));
      
      return { success: true, data: attacks };
    } catch (error) {
      console.error('Error getting active attacks:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('pause-attack', async (event, attackId) => {
    try {
      if (activeAttacksMap.has(attackId)) {
        const attack = activeAttacksMap.get(attackId);
        attack.status = 'paused';
        attack.lastUpdate = Date.now();
        
        // If using attack manager, pause it there too
        if (attackManager && attackManager.pauseAttack) {
          await attackManager.pauseAttack(attackId);
        }
        
        attackEventEmitter.emit('attack-progress', {
          attackId: attackId,
          status: 'paused',
          ...attack
        });
        
        return { success: true, message: 'Attack paused successfully' };
      } else {
        return { success: false, error: 'Attack not found' };
      }
    } catch (error) {
      console.error('Error pausing attack:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('resume-attack', async (event, attackId) => {
    try {
      if (activeAttacksMap.has(attackId)) {
        const attack = activeAttacksMap.get(attackId);
        attack.status = 'running';
        attack.lastUpdate = Date.now();
        
        // If using attack manager, resume it there too
        if (attackManager && attackManager.resumeAttack) {
          await attackManager.resumeAttack(attackId);
        }
        
        attackEventEmitter.emit('attack-progress', {
          attackId: attackId,
          status: 'running',
          ...attack
        });
        
        return { success: true, message: 'Attack resumed successfully' };
      } else {
        return { success: false, error: 'Attack not found' };
      }
    } catch (error) {
      console.error('Error resuming attack:', error);
      return { success: false, error: error.message };
    }
  });

  // =================== ENHANCED ATTACK HANDLERS ===================
  ipcMain.handle('start-ddos-attack', async (event, target, layer, method, duration, options = {}) => {
    if (!isInitialized) {
      return { success: false, error: 'System not fully initialized' };
    }
    
    try {
      const threadCount = options.threads || 10;
      
      // ✅ Validate resources before starting attack
      const validation = await systemInfoManager.validateAttackResources(threadCount, 1);
      
      if (!validation.isValid) {
        return { 
          success: false, 
          error: `Insufficient resources: ${validation.recommendations[0]?.message || 'Memory limit exceeded'}`,
          validation: validation,
          resourceError: true // Flag to identify resource errors
        };
      }
      
      // If not optimal but still valid, log a warning
      if (!validation.isRecommended) {
        console.warn(`Attack using ${threadCount} threads exceeds recommended limits but is still safe`);
      }
      
      // Generate attack ID
      const attackId = generateAttackId();
      
      // Create attack data
      const attackData = {
        id: attackId,
        target: target,
        targets: [target],
        method: method,
        layer: layer,
        duration: duration,
        threads: threadCount,
        status: 'running',
        startTime: Date.now(),
        progress: 0,
        currentBandwidth: 0,
        successRate: 100,
        totalRequests: 0,
        errors: 0,
        options: options
      };
      
      // Add to active attacks
      activeAttacksMap.set(attackId, attackData);
      
      // Emit attack started event
      attackEventEmitter.emit('attack-started', {
        attackId: attackId,
        target: target,
        method: method,
        layer: layer,
        duration: duration,
        threads: threadCount
      });
      
      const preAttackPerformance = await systemInfoManager.getPerformanceMetrics();
      
      const crypto = require('crypto');
      const targetHash = crypto.createHash('sha256').update(target).digest('hex').substring(0, 16);
      
      if (coordinationApp && coordinationApp.coordinator) {
        try {
          const myInfo = await coordinationApp.coordinator.statusManager.getDetailedSystemInfo();
          const coordInfo = coordinationApp.coordinator.statusManager.extractCoordinationInfo(myInfo);
          
          await coordinationApp.coordinator.sendPrivateMessage(
            `Attack started: ${targetHash} (${layer}-${method}) - Duration: ${duration}s - Threads: ${threadCount}`
          );
        } catch (coordError) {
          console.warn('Failed to coordinate attack start:', coordError.message);
        }
      }

      // Start the actual attack (you can integrate with your existing attack system here)
      // For now, we'll use simulation
      simulateAttackProgress(attackData);

      return {
        success: true,
        data: {
          id: attackId,
          target: target,
          status: 'running',
          startTime: Date.now(),
          systemPerformance: {
            preAttack: preAttackPerformance
          },
          resourceValidation: validation // Include validation info in response
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('start-multi-target-attack', async (event, config) => {
    if (!isInitialized) {
      return { success: false, error: 'System not fully initialized' };
    }
    
    try {
      const validation = validateConfig(config);
      if (!validation.valid) {
        throw new Error(`Invalid configuration: ${validation.error}`);
      }
      
      const threadCount = config.threadsPerTarget || 10;
      const targetCount = config.targets?.length || 1;
      
      // ✅ Validate resources for multi-target attack
      const resourceValidation = await systemInfoManager.validateAttackResources(threadCount, targetCount);
      
      if (!resourceValidation.isValid) {
        return { 
          success: false, 
          error: `Insufficient resources: Total threads (${resourceValidation.totalThreadsRequested}) would exceed system capacity (${resourceValidation.maxSafeThreads})`,
          validation: resourceValidation,
          resourceError: true,
          suggestion: `Try reducing threads per target to ${Math.floor(resourceValidation.recommendedThreads / targetCount)} or fewer targets`
        };
      }
      
      // Warn if not optimal
      if (!resourceValidation.isRecommended) {
        console.warn(`Multi-target attack using ${resourceValidation.totalThreadsRequested} total threads exceeds recommended limits`);
      }
      
      // Generate attack ID
      const attackId = generateAttackId();
      
      // Create attack data
      const attackData = {
        id: attackId,
        target: `Multi-target (${config.targets.length})`,
        targets: config.targets,
        method: config.method,
        layer: config.layer,
        duration: config.duration,
        threads: resourceValidation.totalThreadsRequested,
        threadsPerTarget: threadCount,
        status: 'running',
        startTime: Date.now(),
        progress: 0,
        currentBandwidth: 0,
        successRate: 100,
        totalRequests: 0,
        errors: 0,
        config: config
      };
      
      // Add to active attacks
      activeAttacksMap.set(attackId, attackData);
      
      // Emit attack started event
      attackEventEmitter.emit('attack-started', {
        attackId: attackId,
        targets: config.targets,
        method: config.method,
        layer: config.layer,
        duration: config.duration,
        threads: resourceValidation.totalThreadsRequested
      });
      
      const preAttackPerformance = await systemInfoManager.getPerformanceMetrics();
      
      if (coordinationApp && coordinationApp.coordinator) {
        try {
          await coordinationApp.coordinator.sendPrivateMessage(
            `Multi-target attack starting: ${config.targets.length} targets (${config.layer}-${config.method}) - Total threads: ${resourceValidation.totalThreadsRequested}`
          );
        } catch (coordError) {
          console.warn('Failed to coordinate multi-attack start:', coordError.message);
        }
      }
      
      // Start the actual multi-target attack
      simulateAttackProgress(attackData);

      return {
        success: true,
        data: {
          id: attackId,
          targets: config.targets,
          status: 'running',
          startTime: Date.now(),
          systemPerformance: {
            preAttack: preAttackPerformance
          },
          resourceValidation: resourceValidation // Include validation info in response
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
    if (!isInitialized) {
      return { success: false, error: 'System not fully initialized' };
    }
    
    try {
      const result = await startEnhancedAttack(config);
      return {
        success: true,
        data: result
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
      if (activeAttacksMap.has(attackId)) {
        const attack = activeAttacksMap.get(attackId);
        attack.status = 'stopped';
        attack.lastUpdate = Date.now();
        
        // If using attack manager, stop it there too
        if (attackManager && attackManager.stopAttack) {
          await attackManager.stopAttack(attackId);
        }
        
        attackEventEmitter.emit('attack-completed', {
          attackId: attackId,
          target: attack.target,
          success: true,
          stopped: true
        });
        
        // Clear memory cache after stopping
        if (systemInfoManager) {
          systemInfoManager.clearMemoryCache();
        }
        
        // Remove from active attacks after 5 seconds
        setTimeout(() => {
          activeAttacksMap.delete(attackId);
        }, 5000);
        
        return { success: true, message: 'Attack stopped successfully' };
      } else {
        return { success: false, error: 'Attack not found' };
      }
    } catch (error) {
      console.error('Error stopping attack:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('stop-all-attacks', async () => {
    try {
      const stoppedCount = activeAttacksMap.size;
      
      // Stop all active attacks
      for (const [attackId, attack] of activeAttacksMap) {
        attack.status = 'stopped';
        attack.lastUpdate = Date.now();
        
        attackEventEmitter.emit('attack-completed', {
          attackId: attackId,
          target: attack.target,
          success: true,
          stopped: true
        });
      }
      
      // Clear memory cache after stopping all attacks
      if (systemInfoManager) {
        systemInfoManager.clearMemoryCache();
      }
      
      if (coordinationApp && coordinationApp.coordinator) {
        try {
          await coordinationApp.coordinator.sendPrivateMessage('All attacks stopped');
        } catch (coordError) {
          console.warn('Failed to coordinate attack stop:', coordError.message);
        }
      }
      
      // Clear all active attacks after 5 seconds
      setTimeout(() => {
        activeAttacksMap.clear();
      }, 5000);
      
      return { 
        success: true, 
        message: `Stopped ${stoppedCount} attacks successfully`,
        stoppedCount: stoppedCount
      };
    } catch (error) {
      console.error('Error stopping all attacks:', error);
      return { success: false, error: error.message };
    }
  });

  // =================== LEGACY ATTACK HANDLERS (for compatibility) ===================
  ipcMain.handle('get-attack-stats', async (event, attackId) => {
    try {
      if (activeAttacksMap.has(attackId)) {
        const attack = activeAttacksMap.get(attackId);
        return { success: true, data: attack };
      } else {
        const stats = getAttackStats(attackId);
        return { success: true, data: stats };
      }
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
          resourceStats,
          activeAttacks: activeAttacksMap.size
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

  // =================== COORDINATION HANDLERS ===================
  ipcMain.handle('get-coordination-status', async () => {
    try {
      if (!coordinationApp || !coordinationApp.coordinator) {
        return { success: false, error: 'Coordination system not initialized' };
      }
      
      const status = coordinationApp.coordinator.getPrivateNetworkStatus();
      return { success: true, data: status };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('send-coordination-message', async (event, message) => {
    try {
      if (!coordinationApp || !coordinationApp.coordinator) {
        throw new Error('Coordination system not initialized');
      }
      
      const result = await coordinationApp.coordinator.sendPrivateMessage(message);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-machine-list', async () => {
    try {
      if (!coordinationApp || !coordinationApp.coordinator) {
        return { success: true, data: [] };
      }
      
      const status = coordinationApp.coordinator.getPrivateNetworkStatus();
      return { success: true, data: status.peerList || [] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-my-machine-info', async () => {
    try {
      if (!coordinationApp || !coordinationApp.coordinator) {
        throw new Error('Coordination system not initialized');
      }
      
      const systemInfo = await coordinationApp.coordinator.statusManager.getDetailedSystemInfo();
      const coordInfo = coordinationApp.coordinator.statusManager.extractCoordinationInfo(systemInfo);
      
      return {
        success: true,
        data: {
          publicKey: coordinationApp.coordinator.keyManager.publicKey,
          networkId: coordinationApp.coordinator.getNetworkId(),
          capabilities: coordInfo.capabilities,
          performance: coordInfo.performance,
          networkInfo: coordInfo.networkInfo,
          systemSummary: coordInfo.systemSummary,
          healthScore: await coordinationApp.coordinator.statusManager.getSystemHealthScore(),
          capabilityScore: await coordinationApp.coordinator.statusManager.getMachineCapabilityScore()
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('refresh-coordination-network', async () => {
    try {
      if (!coordinationApp || !coordinationApp.coordinator) {
        throw new Error('Coordination system not initialized');
      }
      
      await coordinationApp.coordinator.broadcastAppVerification();
      return { success: true, message: 'Network refresh initiated' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // =================== SYSTEM INFO HANDLERS ===================
  ipcMain.handle('get-system-info', async () => {
    if (!isInitialized || !systemInfoManager) {
      return { success: false, error: 'System manager not initialized' };
    }
    
    try {
      const info = await systemInfoManager.getSystemInfo();
      return { success: true, data: info };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-basic-info', async () => {
    if (!isInitialized || !systemInfoManager) {
      return { success: false, error: 'System manager not initialized' };
    }
    
    try {
      const info = await systemInfoManager.getBasicInfo();
      return { success: true, data: info };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-cpu-info', async () => {
    if (!isInitialized || !systemInfoManager) {
      return { success: false, error: 'System manager not initialized' };
    }
    
    try {
      const info = await systemInfoManager.getCPUInfo();
      return { success: true, data: info };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-memory-info', async () => {
    if (!isInitialized || !systemInfoManager) {
      return { success: false, error: 'System manager not initialized' };
    }
    
    try {
      const info = await systemInfoManager.getMemoryInfo();
      return { success: true, data: info };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-disk-info', async () => {
    if (!isInitialized || !systemInfoManager) {
      return { success: false, error: 'System manager not initialized' };
    }
    
    try {
      const info = await systemInfoManager.getDiskInfo();
      return { success: true, data: info };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-network-info', async () => {
    if (!isInitialized || !systemInfoManager) {
      return { success: false, error: 'System manager not initialized' };
    }
    
    try {
      const info = await systemInfoManager.getNetworkInfo();
      return { success: true, data: info };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-processes', async () => {
    if (!isInitialized || !systemInfoManager) {
      return { success: false, error: 'System manager not initialized' };
    }
    
    try {
      const processes = await systemInfoManager.getProcesses();
      return { success: true, data: processes };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-system-logs', async (event, { logType, maxEvents }) => {
    if (!isInitialized || !systemInfoManager) {
      return { success: false, error: 'System manager not initialized' };
    }
    
    try {
      const logs = await systemInfoManager.getSystemLogs(logType, maxEvents);
      return { success: true, data: logs };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-performance-metrics', async () => {
    if (!isInitialized || !systemInfoManager) {
      return { success: false, error: 'System manager not initialized' };
    }
    
    try {
      const metrics = await systemInfoManager.getPerformanceMetrics();
      return { success: true, data: metrics };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-platform-info', async () => {
    if (!isInitialized || !systemInfoManager) {
      return { success: false, error: 'System manager not initialized' };
    }
    
    try {
      const info = await systemInfoManager.getPlatformInfo();
      return { success: true, data: info };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-optimization-recommendations', async () => {
    if (!isInitialized || !systemInfoManager) {
      return { success: false, error: 'System manager not initialized' };
    }
    
    try {
      const recommendations = await systemInfoManager.getOptimizationRecommendations();
      return { success: true, data: recommendations };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // =================== MONITORING HANDLERS ===================
  ipcMain.handle('start-monitoring', async (event, { interval }) => {
    if (!isInitialized || !systemInfoManager) {
      return { success: false, error: 'System manager not initialized' };
    }
    
    try {
      // Validate interval parameter
      const monitoringInterval = interval && typeof interval === 'number' && interval > 0 ? interval : 5000;
      
      console.log(`Starting monitoring with interval: ${monitoringInterval}ms`);
      
      // Stop any existing monitoring
      if (monitoringSession) {
        console.log('Stopping existing monitoring session...');
        if (typeof monitoringSession.stop === 'function') {
          monitoringSession.stop();
        }
        monitoringSession = null;
      }
      
      // Remove any existing event listeners to prevent duplicates
      systemInfoManager.removeAllListeners('data');
      
      // Set up event listener for monitoring data BEFORE starting monitoring
      const dataHandler = (data) => {
        if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
          try {
            mainWindow.webContents.send('monitoring-data', data);
          } catch (error) {
            console.error('Failed to send monitoring data:', error.message);
          }
        }
      };

      // Add the event listener
      systemInfoManager.on('data', dataHandler);
      
      // Start monitoring - this should now work correctly
      monitoringSession = await systemInfoManager.startMonitoring(monitoringInterval);
      
      console.log('Monitoring started successfully');
      return { success: true, message: 'Monitoring started' };
      
    } catch (error) {
      console.error('Error starting monitoring:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('stop-monitoring', async () => {
    try {
      if (monitoringSession) {
        console.log('Stopping monitoring session...');
        if (typeof monitoringSession.stop === 'function') {
          monitoringSession.stop();
        }
        monitoringSession = null;
      }
      
      if (systemInfoManager) {
        systemInfoManager.stopMonitoring();
        systemInfoManager.removeAllListeners('data');
      }
      
      console.log('Monitoring stopped successfully');
      return { success: true, message: 'Monitoring stopped' };
    } catch (error) {
      console.error('Error stopping monitoring:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('export-system-info', async (event, { format }) => {
    if (!isInitialized || !systemInfoManager) {
      return { success: false, error: 'System manager not initialized' };
    }
    
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

  // =================== NAVIGATION HANDLERS ===================
  ipcMain.handle('navigate-to-main', async () => {
    if (!isInitialized) {
      console.log('Navigation to main blocked - system not fully initialized');
      return { success: false, error: 'System not fully initialized. Please wait...' };
    }
    
    try {
      console.log('Loading main interface...');
      await mainWindow.loadFile('renderer/index.html');
      console.log('Successfully loaded main interface');
      return { success: true };
    } catch (error) {
      console.error('Failed to load main interface:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('check-initialization-status', async () => {
    return { 
      success: true, 
      data: { 
        isInitialized,
        hasSystemManager: !!systemInfoManager,
        hasCoordination: !!(coordinationApp && coordinationApp.coordinator),
        activeAttacks: activeAttacksMap.size
      }
    };
  });

  // =================== EXPORT DATA HANDLER ===================
  ipcMain.handle('export-network-data', async () => {
    try {
      const exportData = {
        timestamp: new Date().toISOString(),
        systemInfo: systemInfoManager ? await systemInfoManager.getSystemInfo() : {},
        activeAttacks: Array.from(activeAttacksMap.values()),
        attackHistory: getAttackHistory(),
        performanceMetrics: systemInfoManager ? await systemInfoManager.getPerformanceMetrics() : {},
        coordinationStatus: coordinationApp?.coordinator ? coordinationApp.coordinator.getPrivateNetworkStatus() : {}
      };
      
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Network Data',
        defaultPath: `network-data-export-${new Date().toISOString().split('T')[0]}.json`,
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
      });

      if (!result.canceled && result.filePath) {
        await fs.writeFile(result.filePath, JSON.stringify(exportData, null, 2));
        return { success: true, message: 'Network data exported successfully', filePath: result.filePath };
      }
      
      return { success: false, message: 'Export cancelled' };
    } catch (error) {
      console.error('Error exporting network data:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('MkenyaTool with Enhanced Real-time Attack Display ready');
});

// =================== APP CLEANUP ===================
app.on('before-quit', async () => {
  try {
    // Stop all attacks
    const stoppedCount = activeAttacksMap.size;
    if (stoppedCount > 0) {
      console.log(`Stopping ${stoppedCount} active attacks...`);
      await stopAllAttacks();
    }
    
    // Clean up attack tracking
    cleanupAttacks();
    
    // Stop monitoring
    if (monitoringSession) {
      monitoringSession.stop();
    }
    
    // Clean up system manager
    if (systemInfoManager) {
      systemInfoManager.cleanup();
    }
    
    // Clean up coordination
    if (coordinationApp) {
      await coordinationApp.cleanup();
    }
    
    // Unsubscribe from events
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