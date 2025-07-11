//networking/enhanced-coordination-integration.js
const { app, BrowserWindow, ipcMain, Menu, Tray } = require('electron');
const path = require('path');
const { EnhancedPrivateNetworkCoordinator } = require('./enhanced-private-network-coordinator');

class EnhancedMachineCoordinationApp {
    constructor() {
        this.mainWindow = null;
        this.coordinator = null;
        this.tray = null;
        this.isQuitting = false;
        this.coordinatorStatus = 'initializing';
        this.networkStats = {
            totalMachines: 0,
            verifiedPeers: 0,
            connectedRelays: 0,
            isolatedMode: false
        };
        
        this.setupApp();
    }

    setupApp() {
        app.whenReady().then(() => {
            this.createWindow();
            this.createTray();
            this.initializeCoordinator();
            this.setupIPC();
        });

        app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') {
                this.cleanup();
                app.quit();
            }
        });

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                this.createWindow();
            }
        });

        app.on('before-quit', () => {
            this.isQuitting = true;
            this.cleanup();
        });

        process.on('SIGINT', () => {
            this.cleanup();
            process.exit(0);
        });

        process.on('SIGTERM', () => {
            this.cleanup();
            process.exit(0);
        });
    }

    createWindow() {
        this.mainWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            icon: path.join(__dirname, '../icons/icon.png'),
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                enableRemoteModule: false,
                preload: path.join(__dirname, 'coordinator-preload.js')
            },
            titleBarStyle: 'hiddenInset',
            show: false,
            minWidth: 800,
            minHeight: 600
        });

        this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

        this.mainWindow.once('ready-to-show', () => {
            this.mainWindow.show();
        });

        this.mainWindow.on('close', (event) => {
            if (!this.isQuitting) {
                event.preventDefault();
                this.mainWindow.hide();
                
                if (process.platform === 'darwin') {
                    app.dock.hide();
                }
            }
        });

        this.mainWindow.on('closed', () => {
            this.mainWindow = null;
        });

        if (process.env.NODE_ENV === 'development') {
            this.mainWindow.webContents.openDevTools();
        }
    }

    createTray() {
        const trayIconPath = path.join(__dirname, '../icons/tray-icon.png');
        this.tray = new Tray(trayIconPath);
        
        this.updateTrayMenu();
        this.tray.setToolTip('MKenya Tool - Enhanced Machine Coordination Network');

        this.tray.on('click', () => {
            this.showWindow();
        });

        this.tray.on('double-click', () => {
            this.showWindow();
        });

        setInterval(() => {
            this.updateTrayMenu();
        }, 10000);
    }

    showWindow() {
        if (this.mainWindow) {
            if (this.mainWindow.isMinimized()) {
                this.mainWindow.restore();
            }
            this.mainWindow.show();
            this.mainWindow.focus();
            
            if (process.platform === 'darwin') {
                app.dock.show();
            }
        } else {
            this.createWindow();
        }
    }

    async initializeCoordinator() {
        try {
            console.log('🚀 Initializing Enhanced Private Network Coordinator...');
            
            this.coordinator = new EnhancedPrivateNetworkCoordinator({
                appIdentifier: 'mkenyatool-enhanced-coordination-network',
                appVersion: app.getVersion() || '1.0.0',
                networkSecret: 'mkenyatool-enhanced-private-secure-network-2025-coordination-key-v2-do-not-share',
                minRequiredVersion: '1.0.0',
                machineId: 'default'
            });
            
            // Set up event handlers
            this.coordinator.onPeerVerified = (peerId, verificationData) => {
                console.log(`✅ Enhanced Verified peer: ${peerId.substring(0, 8)}... (${verificationData.appVersion})`);
                this.updateNetworkStats();
                this.sendToRenderer('coordinator:peer-verified', {
                    peerId: peerId.substring(0, 8),
                    appVersion: verificationData.appVersion,
                    capabilities: verificationData.capabilities,
                    performance: verificationData.performance,
                    systemSummary: verificationData.systemSummary,
                    timestamp: Date.now()
                });
            };

            this.coordinator.onInvalidPeerDetected = (peerId, reason) => {
                console.warn(`❌ Invalid peer rejected: ${peerId.substring(0, 8)}... (${reason})`);
                this.sendToRenderer('coordinator:invalid-peer', {
                    peerId: peerId.substring(0, 8),
                    reason: reason,
                    timestamp: Date.now()
                });
            };

            this.coordinator.onVerifiedPeerStatusUpdate = (peerId, statusData) => {
                this.updateNetworkStats();
                this.sendToRenderer('coordinator:peer-status-update', {
                    peerId: peerId.substring(0, 8),
                    status: statusData.status,
                    capabilities: statusData.capabilities,
                    performance: statusData.performance,
                    healthScore: statusData.healthScore,
                    capabilityScore: statusData.capabilityScore,
                    timestamp: Date.now()
                });
            };

            this.coordinator.onPeerDisconnected = (peerId) => {
                console.log(`🔌 Enhanced peer disconnected: ${peerId.substring(0, 8)}...`);
                this.updateNetworkStats();
                this.sendToRenderer('coordinator:peer-disconnected', {
                    peerId: peerId.substring(0, 8),
                    timestamp: Date.now()
                });
            };

            this.coordinator.onNetworkIsolated = () => {
                console.warn('🏝️ Enhanced network isolation detected - operating in standalone mode');
                this.coordinatorStatus = 'isolated';
                this.networkStats.isolatedMode = true;
                this.updateNetworkStats();
                this.sendToRenderer('coordinator:network-isolated', {
                    message: 'No other Enhanced MKenya Tool instances found on the network',
                    timestamp: Date.now()
                });
            };

            this.coordinator.onNetworkReconnected = () => {
                console.log('🌐 Enhanced network reconnected - found verified peers');
                this.coordinatorStatus = 'connected';
                this.networkStats.isolatedMode = false;
                this.updateNetworkStats();
                this.sendToRenderer('coordinator:network-reconnected', {
                    message: 'Connected to Enhanced MKenya Tool network',
                    timestamp: Date.now()
                });
            };

            this.coordinator.onGroupChatMessage = (message) => {
                console.log(`💬 Group message from ${message.authorName}: ${message.content}`);
                this.sendToRenderer('coordinator:group-message', {
                    id: message.id,
                    author: message.author.substring(0, 8),
                    authorName: message.authorName,
                    content: message.content,
                    timestamp: message.timestamp
                });
            };

            await this.coordinator.initialize();
            
            this.coordinatorStatus = 'connected';
            console.log('✅ Enhanced Private Network Coordinator initialized successfully');
            console.log(`📡 Network ID: ${this.coordinator.getNetworkId()}`);
            console.log(`🔑 Public Key: ${this.coordinator.publicKey.substring(0, 16)}...`);
            
            this.sendToRenderer('coordinator:initialized', {
                networkId: this.coordinator.getNetworkId(),
                publicKey: this.coordinator.publicKey,
                appIdentifier: this.coordinator.appIdentifier,
                appVersion: this.coordinator.appVersion,
                status: 'connected',
                enhanced: true,
                timestamp: Date.now()
            });

            this.updateNetworkStats();
            
        } catch (error) {
            console.error('❌ Failed to initialize enhanced coordinator:', error);
            this.coordinatorStatus = 'error';
            this.sendToRenderer('coordinator:error', {
                error: error.message,
                enhanced: true,
                timestamp: Date.now()
            });
        }
    }

    updateNetworkStats() {
        if (!this.coordinator) return;

        try {
            const networkStatus = this.coordinator.getPrivateNetworkStatus();
            this.networkStats = {
                totalMachines: networkStatus.verifiedPeers + networkStatus.connectedMachines,
                verifiedPeers: networkStatus.verifiedPeers,
                connectedMachines: networkStatus.connectedMachines,
                connectedRelays: networkStatus.connectedRelays,
                isolatedMode: networkStatus.isolatedMode,
                lastPeerContact: networkStatus.lastPeerContact,
                networkId: networkStatus.networkId
            };

            this.sendToRenderer('coordinator:network-stats-update', this.networkStats);
        } catch (error) {
            console.error('Error updating network stats:', error);
        }
    }

    updateTrayMenu() {
        if (!this.tray) return;

        const statusText = this.coordinatorStatus === 'connected' 
            ? `Machines: ${this.networkStats.verifiedPeers} | Connected: ${this.networkStats.connectedMachines}`
            : `Status: ${this.coordinatorStatus}`;

        const isolationStatus = this.networkStats.isolatedMode ? '🏝️ Isolated' : '🌐 Connected';

        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'MKenya Tool Enhanced Network',
                enabled: false,
                icon: path.join(__dirname, '../icons/menu-icon.png')
            },
            { type: 'separator' },
            {
                label: 'Show Application',
                click: () => this.showWindow()
            },
            {
                label: 'Enhanced Network Status',
                submenu: [
                    {
                        label: statusText,
                        enabled: false
                    },
                    {
                        label: isolationStatus,
                        enabled: false
                    },
                    {
                        label: `Network ID: ${this.networkStats.networkId || 'Unknown'}`,
                        enabled: false
                    },
                    { type: 'separator' },
                    {
                        label: 'Refresh Network',
                        click: async () => {
                            if (this.coordinator) {
                                try {
                                    await this.coordinator.broadcastAppVerification();
                                    await this.coordinator.pingKnownPeers();
                                    console.log('Enhanced network refresh initiated');
                                } catch (error) {
                                    console.error('Failed to refresh enhanced network:', error);
                                }
                            }
                        }
                    },
                    {
                        label: 'Send Test Message',
                        click: async () => {
                            if (this.coordinator) {
                                try {
                                    await this.coordinator.sendPrivateMessage('Test message from tray menu');
                                    console.log('Test message sent');
                                } catch (error) {
                                    console.error('Failed to send test message:', error);
                                }
                            }
                        }
                    },
                    {
                        label: 'View Network Statistics',
                        click: () => {
                            this.showWindow();
                            this.sendToRenderer('coordinator:show-network-stats', {});
                        }
                    }
                ]
            },
            { type: 'separator' },
            {
                label: 'Settings',
                submenu: [
                    {
                        label: 'Open Logs Folder',
                        click: () => {
                            const { shell } = require('electron');
                            shell.openPath(path.join(app.getPath('userData'), 'logs'));
                        }
                    },
                    {
                        label: 'Reset Network Keys',
                        click: async () => {
                            if (this.coordinator) {
                                await this.coordinator.loadOrGenerateKeys();
                                console.log('Enhanced network keys reset - restart recommended');
                            }
                        }
                    },
                    {
                        label: 'Force Network Refresh',
                        click: async () => {
                            if (this.coordinator) {
                                await this.coordinator.broadcastAppVerification();
                                await this.coordinator.sendAnnouncement();
                            }
                        }
                    }
                ]
            },
            { type: 'separator' },
            {
                label: 'Quit MKenya Tool',
                click: () => {
                    this.isQuitting = true;
                    app.quit();
                }
            }
        ]);

        this.tray.setContextMenu(contextMenu);
    }

    setupIPC() {
        ipcMain.handle('coordinator:get-network-status', async () => {
            if (!this.coordinator) {
                return { 
                    error: 'Enhanced coordinator not initialized',
                    status: this.coordinatorStatus 
                };
            }
            return this.coordinator.getPrivateNetworkStatus();
        });

        ipcMain.handle('coordinator:send-group-message', async (event, content) => {
            if (!this.coordinator) {
                throw new Error('Enhanced coordinator not initialized');
            }
            
            try {
                const result = await this.coordinator.sendPrivateMessage(content);
                console.log(`📨 Enhanced group message sent: "${content.substring(0, 50)}..."`);
                return { success: true, relaysReached: result };
            } catch (error) {
                console.error('Failed to send enhanced group message:', error);
                throw new Error(`Failed to send message: ${error.message}`);
            }
        });

        ipcMain.handle('coordinator:get-machine-list', async () => {
            if (!this.coordinator) {
                return [];
            }
            
            try {
                const networkStatus = this.coordinator.getPrivateNetworkStatus();
                return networkStatus.peerList || [];
            } catch (error) {
                console.error('Failed to get enhanced machine list:', error);
                return [];
            }
        });

        ipcMain.handle('coordinator:report-machine-offline', async (event, machineId) => {
            if (!this.coordinator) {
                throw new Error('Enhanced coordinator not initialized');
            }
            
            try {
                await this.coordinator.reportMachineOffline(machineId);
                console.log(`📤 Reported enhanced machine offline: ${machineId.substring(0, 8)}...`);
                return { success: true };
            } catch (error) {
                console.error('Failed to report enhanced machine offline:', error);
                throw new Error(`Failed to report machine offline: ${error.message}`);
            }
        });

        ipcMain.handle('coordinator:get-my-info', async () => {
            if (!this.coordinator) {
                return { error: 'Enhanced coordinator not initialized' };
            }
            
            try {
                const systemInfo = await this.coordinator.getDetailedSystemInfo();
                const coordinationInfo = this.coordinator.extractCoordinationInfo(systemInfo);
                
                return {
                    publicKey: this.coordinator.publicKey,
                    shortId: this.coordinator.publicKey.substring(0, 8),
                    networkId: this.coordinator.getNetworkId(),
                    appIdentifier: this.coordinator.appIdentifier,
                    appVersion: this.coordinator.appVersion,
                    capabilities: coordinationInfo.capabilities,
                    performance: coordinationInfo.performance,
                    networkInfo: coordinationInfo.networkInfo,
                    systemSummary: coordinationInfo.systemSummary,
                    healthScore: await this.coordinator.getSystemHealthScore(),
                    capabilityScore: await this.coordinator.getMachineCapabilityScore(),
                    enhanced: true
                };
            } catch (error) {
                console.error('Failed to get enhanced my info:', error);
                return { error: error.message };
            }
        });

        ipcMain.handle('coordinator:get-connection-stats', async () => {
            if (!this.coordinator) {
                return { error: 'Enhanced coordinator not initialized' };
            }
            
            try {
                const networkStats = this.coordinator.getNetworkStatistics();
                
                return {
                    networkStats: networkStats,
                    verifiedPeers: this.coordinator.verifiedPeers.size,
                    connectedMachines: this.coordinator.connectedMachines.size,
                    isolatedMode: this.coordinator.isolatedMode,
                    lastPeerContact: this.coordinator.lastPeerContact,
                    enhanced: true
                };
            } catch (error) {
                console.error('Failed to get enhanced connection stats:', error);
                return { error: error.message };
            }
        });

        ipcMain.handle('coordinator:refresh-network', async () => {
            if (!this.coordinator) {
                throw new Error('Enhanced coordinator not initialized');
            }
            
            try {
                await this.coordinator.broadcastAppVerification();
                await this.coordinator.pingKnownPeers();
                await this.coordinator.sendAnnouncement();
                this.updateNetworkStats();
                return { success: true, enhanced: true };
            } catch (error) {
                console.error('Failed to refresh enhanced network:', error);
                throw new Error(`Failed to refresh network: ${error.message}`);
            }
        });

        ipcMain.handle('coordinator:get-network-statistics', async () => {
            if (!this.coordinator) {
                return { error: 'Enhanced coordinator not initialized' };
            }
            
            try {
                return this.coordinator.getNetworkStatistics();
            } catch (error) {
                console.error('Failed to get network statistics:', error);
                return { error: error.message };
            }
        });

        ipcMain.on('window-action', (event, action) => {
            if (!this.mainWindow) return;
            
            switch (action) {
                case 'minimize':
                    this.mainWindow.minimize();
                    break;
                case 'maximize':
                    if (this.mainWindow.isMaximized()) {
                        this.mainWindow.unmaximize();
                    } else {
                        this.mainWindow.maximize();
                    }
                    break;
                case 'close':
                    this.mainWindow.close();
                    break;
            }
        });
    }

    sendToRenderer(channel, data) {
        if (this.mainWindow && this.mainWindow.webContents) {
            this.mainWindow.webContents.send(channel, data);
        }
    }

    async cleanup() {
        console.log('🧹 Cleaning up enhanced application...');
        
        if (this.coordinator) {
            try {
                console.log('📤 Broadcasting enhanced offline status...');
                await this.coordinator.reportMachineOffline(this.coordinator.publicKey);
                await this.coordinator.shutdown();
                console.log('✅ Enhanced coordinator shutdown complete');
            } catch (error) {
                console.error('❌ Error during enhanced coordinator shutdown:', error);
            }
        }

        if (this.tray) {
            this.tray.destroy();
            this.tray = null;
        }

        console.log('✅ Enhanced application cleanup complete');
    }
}

const enhancedCoordinationApp = new EnhancedMachineCoordinationApp();

module.exports = EnhancedMachineCoordinationApp;