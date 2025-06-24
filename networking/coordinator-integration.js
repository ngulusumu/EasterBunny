const { app, BrowserWindow, ipcMain, Menu, Tray } = require('electron');
const path = require('path');
const { PrivateNetworkCoordinator } = require('./private-network-coordinator');

class MachineCoordinationApp {
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
        this.tray.setToolTip('MKenya Tool - Machine Coordination Network');

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
            console.log('Initializing private network coordinator...');
            
            this.coordinator = new PrivateNetworkCoordinator({
                appIdentifier: 'mkenyatool-coordination-network',
                appVersion: app.getVersion() || '1.0.0',
                networkSecret: 'mkenyatool-private-secure-network-2025-coordination-key-v1-do-not-share',
                minRequiredVersion: '1.0.0'
            });
            
            this.coordinator.onPeerVerified = (peerId, verificationData) => {
                console.log(`✅ Verified peer: ${peerId.substring(0, 8)}... (${verificationData.appVersion})`);
                this.updateNetworkStats();
                this.sendToRenderer('coordinator:peer-verified', {
                    peerId: peerId.substring(0, 8),
                    appVersion: verificationData.appVersion,
                    capabilities: verificationData.capabilities,
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
                    performance: statusData.performance,
                    timestamp: Date.now()
                });
            };

            this.coordinator.onPeerDisconnected = (peerId) => {
                console.log(`🔌 Peer disconnected: ${peerId.substring(0, 8)}...`);
                this.updateNetworkStats();
                this.sendToRenderer('coordinator:peer-disconnected', {
                    peerId: peerId.substring(0, 8),
                    timestamp: Date.now()
                });
            };

            this.coordinator.onNetworkIsolated = () => {
                console.warn('🏝️ Network isolation detected - operating in standalone mode');
                this.coordinatorStatus = 'isolated';
                this.networkStats.isolatedMode = true;
                this.updateNetworkStats();
                this.sendToRenderer('coordinator:network-isolated', {
                    message: 'No other MKenya Tool instances found on the network',
                    timestamp: Date.now()
                });
            };

            this.coordinator.onNetworkReconnected = () => {
                console.log('🌐 Network reconnected - found verified peers');
                this.coordinatorStatus = 'connected';
                this.networkStats.isolatedMode = false;
                this.updateNetworkStats();
                this.sendToRenderer('coordinator:network-reconnected', {
                    message: 'Connected to MKenya Tool network',
                    timestamp: Date.now()
                });
            };

            await this.coordinator.initialize();
            
            this.coordinatorStatus = 'connected';
            console.log('✅ Private network coordinator initialized successfully');
            console.log(`📡 Network ID: ${this.coordinator.getNetworkId()}`);
            console.log(`🔑 Public Key: ${this.coordinator.keyManager.publicKey.substring(0, 16)}...`);
            
            this.sendToRenderer('coordinator:initialized', {
                networkId: this.coordinator.getNetworkId(),
                publicKey: this.coordinator.keyManager.publicKey,
                appIdentifier: this.coordinator.appIdentifier,
                appVersion: this.coordinator.appVersion,
                status: 'connected',
                timestamp: Date.now()
            });

            this.updateNetworkStats();
            
        } catch (error) {
            console.error('❌ Failed to initialize coordinator:', error);
            this.coordinatorStatus = 'error';
            this.sendToRenderer('coordinator:error', {
                error: error.message,
                timestamp: Date.now()
            });
        }
    }

    updateNetworkStats() {
        if (!this.coordinator) return;

        try {
            const networkStatus = this.coordinator.getPrivateNetworkStatus();
            this.networkStats = {
                totalMachines: networkStatus.verifiedPeers,
                verifiedPeers: networkStatus.verifiedPeers,
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
            ? `Machines: ${this.networkStats.verifiedPeers} | Relays: ${this.networkStats.connectedRelays}`
            : `Status: ${this.coordinatorStatus}`;

        const isolationStatus = this.networkStats.isolatedMode ? '🏝️ Isolated' : '🌐 Connected';

        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'MKenya Tool Network',
                enabled: false,
                icon: path.join(__dirname, '../icons/menu-icon.png')
            },
            { type: 'separator' },
            {
                label: 'Show Application',
                click: () => this.showWindow()
            },
            {
                label: 'Network Status',
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
                                    console.log('Network refresh initiated');
                                } catch (error) {
                                    console.error('Failed to refresh network:', error);
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
                                await this.coordinator.keyManager.generateNewKeys();
                                console.log('Network keys reset - restart required');
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
                    error: 'Coordinator not initialized',
                    status: this.coordinatorStatus 
                };
            }
            return this.coordinator.getPrivateNetworkStatus();
        });

        ipcMain.handle('coordinator:send-group-message', async (event, content) => {
            if (!this.coordinator) {
                throw new Error('Coordinator not initialized');
            }
            
            try {
                const result = await this.coordinator.sendPrivateMessage(content);
                console.log(`📨 Group message sent: "${content.substring(0, 50)}..."`);
                return { success: true, relaysReached: result };
            } catch (error) {
                console.error('Failed to send group message:', error);
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
                console.error('Failed to get machine list:', error);
                return [];
            }
        });

        ipcMain.handle('coordinator:report-machine-offline', async (event, machineId) => {
            if (!this.coordinator) {
                throw new Error('Coordinator not initialized');
            }
            
            try {
                await this.coordinator.reportMachineOffline(machineId);
                console.log(`📤 Reported machine offline: ${machineId.substring(0, 8)}...`);
                return { success: true };
            } catch (error) {
                console.error('Failed to report machine offline:', error);
                throw new Error(`Failed to report machine offline: ${error.message}`);
            }
        });

        ipcMain.handle('coordinator:get-my-info', async () => {
            if (!this.coordinator) {
                return { error: 'Coordinator not initialized' };
            }
            
            try {
                const systemInfo = await this.coordinator.statusManager.getDetailedSystemInfo();
                const coordinationInfo = this.coordinator.statusManager.extractCoordinationInfo(systemInfo);
                
                return {
                    publicKey: this.coordinator.keyManager.publicKey,
                    shortId: this.coordinator.keyManager.publicKey.substring(0, 8),
                    networkId: this.coordinator.getNetworkId(),
                    appIdentifier: this.coordinator.appIdentifier,
                    appVersion: this.coordinator.appVersion,
                    capabilities: coordinationInfo.capabilities,
                    performance: coordinationInfo.performance,
                    networkInfo: coordinationInfo.networkInfo,
                    systemSummary: coordinationInfo.systemSummary,
                    healthScore: await this.coordinator.statusManager.getSystemHealthScore(),
                    capabilityScore: await this.coordinator.statusManager.getMachineCapabilityScore()
                };
            } catch (error) {
                console.error('Failed to get my info:', error);
                return { error: error.message };
            }
        });

        ipcMain.handle('coordinator:get-connection-stats', async () => {
            if (!this.coordinator) {
                return { error: 'Coordinator not initialized' };
            }
            
            try {
                const networkStats = this.coordinator.statusManager.getNetworkStatistics();
                const relayStats = this.coordinator.relays.map(relay => ({
                    url: relay.url,
                    connected: relay.connected,
                    reconnectAttempts: relay.reconnectAttempts
                }));
                
                return {
                    networkStats: networkStats,
                    relayStats: relayStats,
                    verifiedPeers: this.coordinator.verifiedPeers.size,
                    isolatedMode: this.coordinator.isolatedMode,
                    lastPeerContact: this.coordinator.lastPeerContact
                };
            } catch (error) {
                console.error('Failed to get connection stats:', error);
                return { error: error.message };
            }
        });

        ipcMain.handle('coordinator:refresh-network', async () => {
            if (!this.coordinator) {
                throw new Error('Coordinator not initialized');
            }
            
            try {
                await this.coordinator.broadcastAppVerification();
                await this.coordinator.pingKnownPeers();
                this.updateNetworkStats();
                return { success: true };
            } catch (error) {
                console.error('Failed to refresh network:', error);
                throw new Error(`Failed to refresh network: ${error.message}`);
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
        console.log('🧹 Cleaning up application...');
        
        if (this.coordinator) {
            try {
                console.log('📤 Broadcasting offline status...');
                await this.coordinator.reportMachineOffline(this.coordinator.keyManager.publicKey);
                await this.coordinator.shutdown();
                console.log('✅ Coordinator shutdown complete');
            } catch (error) {
                console.error('❌ Error during coordinator shutdown:', error);
            }
        }

        if (this.tray) {
            this.tray.destroy();
            this.tray = null;
        }

        console.log('✅ Application cleanup complete');
    }
}

const coordinationApp = new MachineCoordinationApp();

module.exports = MachineCoordinationApp;