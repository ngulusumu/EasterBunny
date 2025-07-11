//networking/network-file-system.js
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');

class NetworkFileSystem {
    constructor(coordinator, dataTransferManager) {
        this.coordinator = coordinator;
        this.dataTransfer = dataTransferManager;
        this.syncedFolders = new Map();
        this.fileWatchers = new Map();
        this.conflictResolver = 'timestamp'; // 'timestamp' | 'size' | 'manual'
        
        // Event kinds for file system operations
        this.eventKinds = {
            FILE_SYNC_REQUEST: 34000,
            FILE_SYNC_RESPONSE: 34001,
            FILE_CHANGE_NOTIFICATION: 34002,
            FOLDER_SYNC_REQUEST: 34003,
            FOLDER_SYNC_RESPONSE: 34004,
            FILE_CONFLICT: 34005
        };
        
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;

        // Hook into coordinator's event handling
        const originalHandler = this.coordinator.handlePrivateNetworkEvent.bind(this.coordinator);
        this.coordinator.handlePrivateNetworkEvent = async (event) => {
            if (this.isFileSystemEvent(event)) {
                await this.handleFileSystemEvent(event);
            } else {
                await originalHandler(event);
            }
        };

        this.isInitialized = true;
        console.log('✅ Network File System initialized');
    }

    isFileSystemEvent(event) {
        return Object.values(this.eventKinds).includes(event.kind);
    }

    async handleFileSystemEvent(event) {
        const peerPublicKey = event.pubkey;
        
        if (!this.coordinator.verifiedPeers.has(peerPublicKey)) {
            console.warn(`Ignoring file system event from unverified peer: ${peerPublicKey.substring(0, 8)}...`);
            return;
        }

        try {
            const data = JSON.parse(event.content);

            switch (event.kind) {
                case this.eventKinds.FILE_SYNC_REQUEST:
                    await this.handleFileSyncRequest(peerPublicKey, data);
                    break;
                case this.eventKinds.FILE_SYNC_RESPONSE:
                    await this.handleFileSyncResponse(peerPublicKey, data);
                    break;
                case this.eventKinds.FILE_CHANGE_NOTIFICATION:
                    await this.handleFileChangeNotification(peerPublicKey, data);
                    break;
                case this.eventKinds.FOLDER_SYNC_REQUEST:
                    await this.handleFolderSyncRequest(peerPublicKey, data);
                    break;
                case this.eventKinds.FOLDER_SYNC_RESPONSE:
                    await this.handleFolderSyncResponse(peerPublicKey, data);
                    break;
                case this.eventKinds.FILE_CONFLICT:
                    await this.handleFileConflict(peerPublicKey, data);
                    break;
            }
        } catch (error) {
            console.error('Error handling file system event:', error);
        }
    }

    /**
     * Sync a local folder with the network
     */
    async syncFolder(localPath, networkPath, options = {}) {
        try {
            const {
                autoSync = true,
                bidirectional = true,
                excludePatterns = ['.DS_Store', '*.tmp', 'node_modules'],
                conflictResolution = 'timestamp'
            } = options;

            console.log(`📁 Setting up folder sync: ${localPath} <-> ${networkPath}`);

            // Ensure local folder exists
            await this.ensureDirectoryExists(localPath);

            // Create sync configuration
            const syncConfig = {
                localPath,
                networkPath,
                autoSync,
                bidirectional,
                excludePatterns,
                conflictResolution,
                lastSync: Date.now(),
                fileIndex: new Map()
            };

            this.syncedFolders.set(networkPath, syncConfig);

            // Perform initial sync
            await this.performInitialSync(syncConfig);

            // Set up file watching if auto-sync is enabled
            if (autoSync) {
                await this.setupFileWatcher(syncConfig);
            }

            console.log(`✅ Folder sync configured: ${networkPath}`);

            return {
                networkPath,
                localPath,
                autoSync,
                bidirectional
            };

        } catch (error) {
            console.error('Error setting up folder sync:', error);
            throw new Error(`Failed to setup folder sync: ${error.message}`);
        }
    }

    async performInitialSync(syncConfig) {
        console.log(`🔄 Performing initial sync for ${syncConfig.networkPath}`);

        try {
            // Scan local files
            const localFiles = await this.scanLocalFiles(syncConfig.localPath, syncConfig.excludePatterns);
            
            // Request folder index from network
            const networkFiles = await this.requestFolderIndex(syncConfig.networkPath);

            // Compare and sync
            await this.syncFiles(localFiles, networkFiles, syncConfig);

            syncConfig.lastSync = Date.now();
            console.log(`✅ Initial sync completed for ${syncConfig.networkPath}`);

        } catch (error) {
            console.error('Error during initial sync:', error);
        }
    }

    async scanLocalFiles(folderPath, excludePatterns = []) {
        const files = new Map();

        async function scanDirectory(dirPath, relativePath = '') {
            try {
                const entries = await fs.readdir(dirPath, { withFileTypes: true });

                for (const entry of entries) {
                    const fullPath = path.join(dirPath, entry.name);
                    const relativeFilePath = path.join(relativePath, entry.name);

                    // Check if file should be excluded
                    if (this.shouldExcludeFile(relativeFilePath, excludePatterns)) {
                        continue;
                    }

                    if (entry.isDirectory()) {
                        await scanDirectory.call(this, fullPath, relativeFilePath);
                    } else if (entry.isFile()) {
                        const stats = await fs.stat(fullPath);
                        const fileHash = await this.calculateFileHash(fullPath);

                        files.set(relativeFilePath, {
                            path: relativeFilePath,
                            fullPath: fullPath,
                            size: stats.size,
                            mtime: stats.mtime.getTime(),
                            hash: fileHash,
                            isDirectory: false
                        });
                    }
                }
            } catch (error) {
                console.error(`Error scanning directory ${dirPath}:`, error);
            }
        }

        await scanDirectory.call(this, folderPath);
        return files;
    }

    async requestFolderIndex(networkPath) {
        const requestId = crypto.randomBytes(8).toString('hex');
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Folder index request timeout'));
            }, 30000);

            // Store request
            this.pendingRequests = this.pendingRequests || new Map();
            this.pendingRequests.set(requestId, {
                resolve,
                reject,
                timeout,
                type: 'folder_index'
            });

            // Broadcast request to all machines
            const machines = this.getAvailableMachines();
            machines.forEach(machineId => {
                this.sendFileSystemEvent(this.eventKinds.FOLDER_SYNC_REQUEST, {
                    requestId,
                    networkPath,
                    timestamp: Date.now()
                }, machineId);
            });
        });
    }

    async syncFiles(localFiles, networkFiles, syncConfig) {
        const { localPath, networkPath, bidirectional, conflictResolution } = syncConfig;

        // Files to download (exist in network but not locally or are newer)
        for (const [filePath, networkFile] of networkFiles) {
            const localFile = localFiles.get(filePath);
            
            if (!localFile) {
                // File doesn't exist locally, download it
                console.log(`⬇️ Downloading new file: ${filePath}`);
                await this.downloadFile(networkPath, filePath, localPath);
            } else if (networkFile.mtime > localFile.mtime) {
                // Network file is newer, check for conflicts
                if (conflictResolution === 'timestamp') {
                    console.log(`⬇️ Downloading newer file: ${filePath}`);
                    await this.downloadFile(networkPath, filePath, localPath);
                } else {
                    await this.handleFileConflict(filePath, localFile, networkFile, syncConfig);
                }
            }
        }

        // Files to upload (exist locally but not in network or are newer)
        if (bidirectional) {
            for (const [filePath, localFile] of localFiles) {
                const networkFile = networkFiles.get(filePath);
                
                if (!networkFile) {
                    // File doesn't exist in network, upload it
                    console.log(`⬆️ Uploading new file: ${filePath}`);
                    await this.uploadFile(localFile.fullPath, networkPath, filePath);
                } else if (localFile.mtime > networkFile.mtime) {
                    // Local file is newer
                    if (conflictResolution === 'timestamp') {
                        console.log(`⬆️ Uploading newer file: ${filePath}`);
                        await this.uploadFile(localFile.fullPath, networkPath, filePath);
                    } else {
                        await this.handleFileConflict(filePath, localFile, networkFile, syncConfig);
                    }
                }
            }
        }

        // Update file index
        syncConfig.fileIndex = new Map([...localFiles, ...networkFiles]);
    }

    async downloadFile(networkPath, filePath, localBasePath) {
        try {
            // Request file from network
            const fileData = await this.requestNetworkFile(networkPath, filePath);
            
            if (fileData) {
                const localFilePath = path.join(localBasePath, filePath);
                await this.ensureDirectoryExists(path.dirname(localFilePath));
                await fs.writeFile(localFilePath, fileData);
                console.log(`✅ Downloaded: ${filePath}`);
            }
        } catch (error) {
            console.error(`Error downloading file ${filePath}:`, error);
        }
    }

    async uploadFile(localFilePath, networkPath, relativePath) {
        try {
            // Use data transfer manager to send file to network
            const machines = this.getAvailableMachines();
            
            if (machines.length > 0) {
                // Upload to first available machine (could be enhanced to upload to multiple)
                const targetMachine = machines[0];
                
                const result = await this.dataTransfer.sendFile(localFilePath, targetMachine, {
                    metadata: {
                        networkPath: networkPath,
                        relativePath: relativePath,
                        isNetworkSync: true
                    }
                });

                console.log(`✅ Uploaded: ${relativePath}`);
                return result;
            }
        } catch (error) {
            console.error(`Error uploading file ${relativePath}:`, error);
        }
    }

    async requestNetworkFile(networkPath, filePath) {
        const requestId = crypto.randomBytes(8).toString('hex');
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error('File request timeout'));
            }, 60000);

            this.pendingRequests = this.pendingRequests || new Map();
            this.pendingRequests.set(requestId, {
                resolve,
                reject,
                timeout,
                type: 'file_request'
            });

            // Request from all machines
            const machines = this.getAvailableMachines();
            machines.forEach(machineId => {
                this.sendFileSystemEvent(this.eventKinds.FILE_SYNC_REQUEST, {
                    requestId,
                    networkPath,
                    filePath,
                    timestamp: Date.now()
                }, machineId);
            });
        });
    }

    async setupFileWatcher(syncConfig) {
        const { localPath, networkPath } = syncConfig;
        
        try {
            // Simple file watching implementation
            // In production, you might want to use a proper file watcher library
            const watchInterval = setInterval(async () => {
                try {
                    const currentFiles = await this.scanLocalFiles(localPath, syncConfig.excludePatterns);
                    const changes = this.detectFileChanges(syncConfig.fileIndex, currentFiles);
                    
                    if (changes.length > 0) {
                        console.log(`📝 Detected ${changes.length} file changes in ${networkPath}`);
                        await this.processFileChanges(changes, syncConfig);
                        syncConfig.fileIndex = currentFiles;
                    }
                } catch (error) {
                    console.error('Error in file watcher:', error);
                }
            }, 5000); // Check every 5 seconds

            this.fileWatchers.set(networkPath, watchInterval);
            console.log(`👁️ File watcher started for ${networkPath}`);
            
        } catch (error) {
            console.error('Error setting up file watcher:', error);
        }
    }

    detectFileChanges(oldIndex, newIndex) {
        const changes = [];

        // Check for new and modified files
        for (const [filePath, newFile] of newIndex) {
            const oldFile = oldIndex.get(filePath);
            
            if (!oldFile) {
                changes.push({ type: 'added', path: filePath, file: newFile });
            } else if (oldFile.hash !== newFile.hash) {
                changes.push({ type: 'modified', path: filePath, file: newFile, oldFile });
            }
        }

        // Check for deleted files
        for (const [filePath, oldFile] of oldIndex) {
            if (!newIndex.has(filePath)) {
                changes.push({ type: 'deleted', path: filePath, oldFile });
            }
        }

        return changes;
    }

    async processFileChanges(changes, syncConfig) {
        for (const change of changes) {
            try {
                switch (change.type) {
                    case 'added':
                    case 'modified':
                        if (syncConfig.bidirectional) {
                            await this.uploadFile(change.file.fullPath, syncConfig.networkPath, change.path);
                            await this.notifyFileChange(syncConfig.networkPath, change);
                        }
                        break;
                    case 'deleted':
                        if (syncConfig.bidirectional) {
                            await this.notifyFileChange(syncConfig.networkPath, change);
                        }
                        break;
                }
            } catch (error) {
                console.error(`Error processing file change ${change.type} for ${change.path}:`, error);
            }
        }
    }

    async notifyFileChange(networkPath, change) {
        const machines = this.getAvailableMachines();
        
        const notificationData = {
            networkPath,
            change,
            timestamp: Date.now(),
            sender: this.coordinator.publicKey
        };

        machines.forEach(machineId => {
            this.sendFileSystemEvent(this.eventKinds.FILE_CHANGE_NOTIFICATION, notificationData, machineId);
        });
    }

    async handleFileSyncRequest(peerPublicKey, data) {
        const { requestId, networkPath, filePath } = data;
        
        try {
            // Check if we have this file
            const syncConfig = this.syncedFolders.get(networkPath);
            if (syncConfig && filePath) {
                const localFilePath = path.join(syncConfig.localPath, filePath);
                
                try {
                    const fileData = await fs.readFile(localFilePath);
                    const stats = await fs.stat(localFilePath);
                    
                    // Send file via data transfer
                    await this.dataTransfer.sendData({
                        requestId,
                        fileData: fileData.toString('base64'),
                        filePath,
                        stats: {
                            size: stats.size,
                            mtime: stats.mtime.getTime()
                        }
                    }, peerPublicKey);
                    
                } catch (fileError) {
                    // File not found, send error response
                    await this.sendFileSystemEvent(this.eventKinds.FILE_SYNC_RESPONSE, {
                        requestId,
                        success: false,
                        error: 'File not found'
                    }, peerPublicKey);
                }
            }
        } catch (error) {
            console.error('Error handling file sync request:', error);
        }
    }

    async handleFolderSyncRequest(peerPublicKey, data) {
        const { requestId, networkPath } = data;
        
        try {
            const syncConfig = this.syncedFolders.get(networkPath);
            if (syncConfig) {
                const fileIndex = await this.scanLocalFiles(syncConfig.localPath, syncConfig.excludePatterns);
                
                // Convert to simple object for transmission
                const indexData = {};
                for (const [filePath, fileInfo] of fileIndex) {
                    indexData[filePath] = {
                        size: fileInfo.size,
                        mtime: fileInfo.mtime,
                        hash: fileInfo.hash
                    };
                }
                
                await this.sendFileSystemEvent(this.eventKinds.FOLDER_SYNC_RESPONSE, {
                    requestId,
                    networkPath,
                    fileIndex: indexData,
                    timestamp: Date.now()
                }, peerPublicKey);
            }
        } catch (error) {
            console.error('Error handling folder sync request:', error);
        }
    }

    async handleFolderSyncResponse(peerPublicKey, data) {
        const { requestId, fileIndex } = data;
        
        const request = this.pendingRequests?.get(requestId);
        if (request && request.type === 'folder_index') {
            clearTimeout(request.timeout);
            this.pendingRequests.delete(requestId);
            
            // Convert back to Map
            const indexMap = new Map();
            for (const [filePath, fileInfo] of Object.entries(fileIndex)) {
                indexMap.set(filePath, fileInfo);
            }
            
            request.resolve(indexMap);
        }
    }

    async handleFileChangeNotification(peerPublicKey, data) {
        const { networkPath, change } = data;
        
        const syncConfig = this.syncedFolders.get(networkPath);
        if (syncConfig && syncConfig.autoSync) {
            console.log(`📢 File change notification: ${change.type} ${change.path}`);
            
            // Process the change
            switch (change.type) {
                case 'added':
                case 'modified':
                    await this.downloadFile(networkPath, change.path, syncConfig.localPath);
                    break;
                case 'deleted':
                    const localFilePath = path.join(syncConfig.localPath, change.path);
                    try {
                        await fs.unlink(localFilePath);
                        console.log(`🗑️ Deleted local file: ${change.path}`);
                    } catch (error) {
                        console.error(`Error deleting local file ${change.path}:`, error);
                    }
                    break;
            }
        }
    }

    async handleFileConflict(filePath, localFile, networkFile, syncConfig) {
        console.warn(`⚠️ File conflict detected: ${filePath}`);
        
        // For now, just log the conflict
        // In a full implementation, you'd have a proper conflict resolution UI
        const conflictInfo = {
            filePath,
            local: {
                mtime: localFile.mtime,
                size: localFile.size,
                hash: localFile.hash
            },
            network: {
                mtime: networkFile.mtime,
                size: networkFile.size,
                hash: networkFile.hash
            },
            timestamp: Date.now()
        };
        
        // Notify about conflict
        console.log('Conflict details:', conflictInfo);
        
        // Simple resolution: keep newer file
        if (localFile.mtime > networkFile.mtime) {
            await this.uploadFile(localFile.fullPath, syncConfig.networkPath, filePath);
        } else {
            await this.downloadFile(syncConfig.networkPath, filePath, syncConfig.localPath);
        }
    }

    shouldExcludeFile(filePath, excludePatterns) {
        return excludePatterns.some(pattern => {
            if (pattern.includes('*')) {
                const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                return regex.test(filePath);
            }
            return filePath.includes(pattern);
        });
    }

    async calculateFileHash(filePath) {
        try {
            const data = await fs.readFile(filePath);
            return crypto.createHash('sha256').update(data).digest('hex');
        } catch (error) {
            console.error(`Error calculating hash for ${filePath}:`, error);
            return '';
        }
    }

    async ensureDirectoryExists(dirPath) {
        try {
            await fs.mkdir(dirPath, { recursive: true });
        } catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }

    getAvailableMachines() {
        return Array.from(this.coordinator.verifiedPeers.keys())
            .filter(machineId => machineId !== this.coordinator.publicKey);
    }

    async sendFileSystemEvent(kind, content, targetPeerId) {
        const tags = [
            ['n', this.coordinator.getNetworkId()],
            ['app', this.coordinator.appIdentifier],
            ['v', this.coordinator.appVersion],
            ['p', targetPeerId]
        ];

        const { finalizeEvent } = require('nostr-tools');
        
        const event = finalizeEvent({
            kind: kind,
            pubkey: this.coordinator.publicKey,
            created_at: Math.floor(Date.now() / 1000),
            tags: tags,
            content: JSON.stringify(content)
        }, this.coordinator.privateKey);

        return await this.coordinator.publishEvent(event);
    }

    /**
     * Stop syncing a folder
     */
    async stopFolderSync(networkPath) {
        const syncConfig = this.syncedFolders.get(networkPath);
        if (syncConfig) {
            // Stop file watcher
            const watcher = this.fileWatchers.get(networkPath);
            if (watcher) {
                clearInterval(watcher);
                this.fileWatchers.delete(networkPath);
            }
            
            this.syncedFolders.delete(networkPath);
            console.log(`🛑 Stopped syncing folder: ${networkPath}`);
        }
    }

    /**
     * Get sync status for all folders
     */
    getSyncStatus() {
        const status = {};
        
        for (const [networkPath, config] of this.syncedFolders.entries()) {
            status[networkPath] = {
                localPath: config.localPath,
                autoSync: config.autoSync,
                bidirectional: config.bidirectional,
                lastSync: config.lastSync,
                fileCount: config.fileIndex.size,
                isWatching: this.fileWatchers.has(networkPath)
            };
        }
        
        return status;
    }

    /**
     * Manually trigger sync for a folder
     */
    async triggerSync(networkPath) {
        const syncConfig = this.syncedFolders.get(networkPath);
        if (syncConfig) {
            console.log(`🔄 Manual sync triggered for ${networkPath}`);
            await this.performInitialSync(syncConfig);
        } else {
            throw new Error(`No sync configuration found for ${networkPath}`);
        }
    }

    async shutdown() {
        console.log('🧹 Shutting down Network File System...');
        
        // Stop all file watchers
        for (const watcher of this.fileWatchers.values()) {
            clearInterval(watcher);
        }
        
        // Cancel pending requests
        if (this.pendingRequests) {
            for (const [requestId, request] of this.pendingRequests.entries()) {
                clearTimeout(request.timeout);
                request.reject(new Error('Network File System shutting down'));
            }
            this.pendingRequests.clear();
        }
        
        this.fileWatchers.clear();
        this.syncedFolders.clear();
        
        this.isInitialized = false;
        console.log('✅ Network File System shutdown complete');
    }
}

module.exports = { NetworkFileSystem };