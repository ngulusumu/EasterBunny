//networking/distributed-storage-manager.js
const crypto = require('crypto');
const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

class DistributedStorageManager {
    constructor(coordinator) {
        this.coordinator = coordinator;
        this.localStorage = new Map(); // Local storage cache
        this.replicationMap = new Map(); // Track where data is replicated
        this.storageRequests = new Map(); // Pending storage requests
        this.defaultReplicas = 3;
        this.storageTimeout = 30000; // 30 seconds
        
        // Event kinds for distributed storage
        this.eventKinds = {
            STORAGE_REQUEST: 33000,
            STORAGE_RESPONSE: 33001,
            STORAGE_STORE: 33002,
            STORAGE_RETRIEVE: 33003,
            STORAGE_DELETE: 33004,
            STORAGE_SYNC: 33005,
            STORAGE_HEARTBEAT: 33006
        };
        
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;

        // Hook into coordinator's event handling
        const originalHandler = this.coordinator.handlePrivateNetworkEvent.bind(this.coordinator);
        this.coordinator.handlePrivateNetworkEvent = async (event) => {
            if (this.isStorageEvent(event)) {
                await this.handleStorageEvent(event);
            } else {
                await originalHandler(event);
            }
        };

        // Start heartbeat for storage sync
        this.startStorageHeartbeat();

        this.isInitialized = true;
        console.log('✅ Distributed Storage Manager initialized');
    }

    isStorageEvent(event) {
        return Object.values(this.eventKinds).includes(event.kind);
    }

    async handleStorageEvent(event) {
        const peerPublicKey = event.pubkey;
        
        if (!this.coordinator.verifiedPeers.has(peerPublicKey)) {
            console.warn(`Ignoring storage event from unverified peer: ${peerPublicKey.substring(0, 8)}...`);
            return;
        }

        try {
            const data = JSON.parse(event.content);

            switch (event.kind) {
                case this.eventKinds.STORAGE_REQUEST:
                    await this.handleStorageRequest(peerPublicKey, data);
                    break;
                case this.eventKinds.STORAGE_RESPONSE:
                    await this.handleStorageResponse(peerPublicKey, data);
                    break;
                case this.eventKinds.STORAGE_STORE:
                    await this.handleStorageStore(peerPublicKey, data);
                    break;
                case this.eventKinds.STORAGE_RETRIEVE:
                    await this.handleStorageRetrieve(peerPublicKey, data);
                    break;
                case this.eventKinds.STORAGE_DELETE:
                    await this.handleStorageDelete(peerPublicKey, data);
                    break;
                case this.eventKinds.STORAGE_SYNC:
                    await this.handleStorageSync(peerPublicKey, data);
                    break;
                case this.eventKinds.STORAGE_HEARTBEAT:
                    await this.handleStorageHeartbeat(peerPublicKey, data);
                    break;
            }
        } catch (error) {
            console.error('Error handling storage event:', error);
        }
    }

    /**
     * Store data across the network with replication
     */
    async store(key, data, options = {}) {
        try {
            const {
                replicas = this.defaultReplicas,
                compression = true,
                encryption = false,
                priority = 'normal',
                ttl = null // Time to live in milliseconds
            } = options;

            console.log(`💾 Storing data with key: ${key} (replicas: ${replicas})`);

            // Serialize and process data
            let serializedData = JSON.stringify(data);
            let processedData = Buffer.from(serializedData, 'utf8');

            if (compression) {
                processedData = await gzip(processedData);
                console.log(`🗜️ Compressed data from ${serializedData.length} to ${processedData.length} bytes`);
            }

            // Create storage metadata
            const storageId = crypto.randomBytes(16).toString('hex');
            const dataHash = crypto.createHash('sha256').update(processedData).digest('hex');
            
            const storageMetadata = {
                storageId,
                key,
                dataHash,
                originalSize: serializedData.length,
                compressedSize: processedData.length,
                compression,
                encryption,
                replicas,
                ttl,
                timestamp: Date.now(),
                owner: this.coordinator.publicKey
            };

            // Store locally first
            this.localStorage.set(key, {
                ...storageMetadata,
                data: processedData,
                replicas: new Set([this.coordinator.publicKey])
            });

            // Find suitable machines for replication
            const availableMachines = this.getAvailableMachines();
            const selectedMachines = this.selectReplicationMachines(availableMachines, replicas - 1);

            console.log(`📡 Selected ${selectedMachines.length} machines for replication`);

            // Send storage requests to selected machines
            const replicationPromises = selectedMachines.map(machineId =>
                this.requestStorage(machineId, {
                    ...storageMetadata,
                    data: processedData.toString('base64')
                })
            );

            // Wait for replication responses
            const replicationResults = await Promise.allSettled(replicationPromises);
            const successfulReplicas = replicationResults.filter(result => result.status === 'fulfilled');

            // Update replication map
            const replicatedMachines = new Set([this.coordinator.publicKey]);
            successfulReplicas.forEach((result, index) => {
                if (result.value) {
                    replicatedMachines.add(selectedMachines[index]);
                }
            });

            this.localStorage.get(key).replicas = replicatedMachines;
            this.replicationMap.set(key, replicatedMachines);

            console.log(`✅ Data stored with ${replicatedMachines.size} replicas`);

            return {
                storageId,
                key,
                replicas: replicatedMachines.size,
                dataHash,
                success: true
            };

        } catch (error) {
            console.error('Error storing data:', error);
            throw new Error(`Failed to store data: ${error.message}`);
        }
    }

    /**
     * Retrieve data from the network
     */
    async retrieve(key, options = {}) {
        try {
            const {
                timeout = this.storageTimeout,
                preferLocal = true
            } = options;

            console.log(`🔍 Retrieving data with key: ${key}`);

            // Check local storage first
            if (preferLocal && this.localStorage.has(key)) {
                console.log(`📦 Found data locally`);
                return await this.getLocalData(key);
            }

            // Request from network
            const availableMachines = this.getAvailableMachines();
            const retrievalPromises = availableMachines.map(machineId =>
                this.requestRetrieval(machineId, key)
            );

            // Race to get the first successful response
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Retrieval timeout')), timeout)
            );

            const result = await Promise.race([
                Promise.any(retrievalPromises),
                timeoutPromise
            ]);

            if (result) {
                // Cache locally for future use
                this.localStorage.set(key, result.metadata);
                console.log(`✅ Data retrieved and cached locally`);
                return result.data;
            }

            throw new Error('Data not found in network');

        } catch (error) {
            console.error('Error retrieving data:', error);
            throw new Error(`Failed to retrieve data: ${error.message}`);
        }
    }

    /**
     * Delete data from the network
     */
    async delete(key) {
        try {
            console.log(`🗑️ Deleting data with key: ${key}`);

            // Remove from local storage
            this.localStorage.delete(key);

            // Get machines that have replicas
            const replicaMachines = this.replicationMap.get(key);
            if (replicaMachines) {
                // Send delete requests to all replicas
                const deletePromises = Array.from(replicaMachines).map(machineId =>
                    this.requestDeletion(machineId, key)
                );

                await Promise.allSettled(deletePromises);
                this.replicationMap.delete(key);
            }

            console.log(`✅ Data deleted from network`);
            return true;

        } catch (error) {
            console.error('Error deleting data:', error);
            return false;
        }
    }

    async getLocalData(key) {
        const stored = this.localStorage.get(key);
        if (!stored) return null;

        let data = stored.data;

        if (stored.compression) {
            data = await gunzip(data);
        }

        return JSON.parse(data.toString('utf8'));
    }

    async requestStorage(machineId, storageData) {
        const requestId = crypto.randomBytes(8).toString('hex');
        
        return new Promise((resolve, reject) => {
            // Set up timeout
            const timeout = setTimeout(() => {
                this.storageRequests.delete(requestId);
                reject(new Error('Storage request timeout'));
            }, this.storageTimeout);

            // Store request
            this.storageRequests.set(requestId, {
                resolve,
                reject,
                timeout,
                type: 'store'
            });

            // Send storage request
            this.sendStorageEvent(this.eventKinds.STORAGE_STORE, {
                requestId,
                ...storageData
            }, machineId);
        });
    }

    async requestRetrieval(machineId, key) {
        const requestId = crypto.randomBytes(8).toString('hex');
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.storageRequests.delete(requestId);
                reject(new Error('Retrieval request timeout'));
            }, this.storageTimeout);

            this.storageRequests.set(requestId, {
                resolve,
                reject,
                timeout,
                type: 'retrieve'
            });

            this.sendStorageEvent(this.eventKinds.STORAGE_RETRIEVE, {
                requestId,
                key
            }, machineId);
        });
    }

    async requestDeletion(machineId, key) {
        return this.sendStorageEvent(this.eventKinds.STORAGE_DELETE, {
            key,
            timestamp: Date.now()
        }, machineId);
    }

    async handleStorageStore(peerPublicKey, data) {
        try {
            const { requestId, key, data: encodedData, ...metadata } = data;
            
            // Decode and store data
            const processedData = Buffer.from(encodedData, 'base64');
            
            this.localStorage.set(key, {
                ...metadata,
                data: processedData,
                replicas: new Set([peerPublicKey])
            });

            console.log(`💾 Stored data for peer: ${key}`);

            // Send success response
            await this.sendStorageEvent(this.eventKinds.STORAGE_RESPONSE, {
                requestId,
                success: true,
                key,
                timestamp: Date.now()
            }, peerPublicKey);

        } catch (error) {
            console.error('Error handling storage store:', error);
            
            // Send error response
            await this.sendStorageEvent(this.eventKinds.STORAGE_RESPONSE, {
                requestId: data.requestId,
                success: false,
                error: error.message,
                timestamp: Date.now()
            }, peerPublicKey);
        }
    }

    async handleStorageRetrieve(peerPublicKey, data) {
        try {
            const { requestId, key } = data;
            
            if (this.localStorage.has(key)) {
                const stored = this.localStorage.get(key);
                
                await this.sendStorageEvent(this.eventKinds.STORAGE_RESPONSE, {
                    requestId,
                    success: true,
                    key,
                    data: stored.data.toString('base64'),
                    metadata: {
                        compression: stored.compression,
                        originalSize: stored.originalSize,
                        timestamp: stored.timestamp
                    }
                }, peerPublicKey);

                console.log(`📤 Sent data to peer: ${key}`);
            } else {
                await this.sendStorageEvent(this.eventKinds.STORAGE_RESPONSE, {
                    requestId,
                    success: false,
                    error: 'Data not found',
                    key
                }, peerPublicKey);
            }

        } catch (error) {
            console.error('Error handling storage retrieve:', error);
        }
    }

    async handleStorageDelete(peerPublicKey, data) {
        const { key } = data;
        
        if (this.localStorage.has(key)) {
            this.localStorage.delete(key);
            console.log(`🗑️ Deleted data for peer: ${key}`);
        }
    }

    async handleStorageResponse(peerPublicKey, data) {
        const { requestId, success } = data;
        
        const request = this.storageRequests.get(requestId);
        if (!request) return;

        clearTimeout(request.timeout);
        this.storageRequests.delete(requestId);

        if (success) {
            if (request.type === 'retrieve' && data.data) {
                // Process retrieved data
                let processedData = Buffer.from(data.data, 'base64');
                
                if (data.metadata.compression) {
                    processedData = await gunzip(processedData);
                }
                
                const result = {
                    data: JSON.parse(processedData.toString('utf8')),
                    metadata: data.metadata
                };
                
                request.resolve(result);
            } else {
                request.resolve(true);
            }
        } else {
            request.reject(new Error(data.error || 'Storage operation failed'));
        }
    }

    async handleStorageHeartbeat(peerPublicKey, data) {
        // Update peer storage info
        console.log(`💓 Storage heartbeat from ${peerPublicKey.substring(0, 8)}...`);
    }

    getAvailableMachines() {
        return Array.from(this.coordinator.verifiedPeers.keys())
            .filter(machineId => machineId !== this.coordinator.publicKey);
    }

    selectReplicationMachines(availableMachines, count) {
        // Simple selection - could be enhanced with capacity, reliability, etc.
        return availableMachines.slice(0, count);
    }

    async sendStorageEvent(kind, content, targetPeerId) {
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

    startStorageHeartbeat() {
        setInterval(() => {
            this.broadcastStorageHeartbeat();
        }, 60000); // Every minute
    }

    async broadcastStorageHeartbeat() {
        const heartbeatData = {
            availableStorage: this.getAvailableStorage(),
            storedKeys: this.localStorage.size,
            timestamp: Date.now()
        };

        // Broadcast to all verified peers
        const machines = this.getAvailableMachines();
        const promises = machines.map(machineId =>
            this.sendStorageEvent(this.eventKinds.STORAGE_HEARTBEAT, heartbeatData, machineId)
        );

        await Promise.allSettled(promises);
    }

    getAvailableStorage() {
        // Simple implementation - could check actual disk space
        return {
            total: 1024 * 1024 * 1024, // 1GB
            used: this.getStorageUsed(),
            available: 1024 * 1024 * 1024 - this.getStorageUsed()
        };
    }

    getStorageUsed() {
        let total = 0;
        for (const stored of this.localStorage.values()) {
            total += stored.data.length;
        }
        return total;
    }

    /**
     * Get storage statistics
     */
    getStorageStats() {
        const localKeys = Array.from(this.localStorage.keys());
        const replicationInfo = {};
        
        for (const [key, replicas] of this.replicationMap.entries()) {
            replicationInfo[key] = Array.from(replicas).map(id => id.substring(0, 8));
        }

        return {
            localKeys: localKeys.length,
            totalStorage: this.getStorageUsed(),
            availableStorage: this.getAvailableStorage(),
            replicationMap: replicationInfo,
            activeRequests: this.storageRequests.size
        };
    }

    /**
     * List all stored keys
     */
    listKeys() {
        return Array.from(this.localStorage.keys()).map(key => {
            const stored = this.localStorage.get(key);
            return {
                key,
                size: stored.data.length,
                timestamp: stored.timestamp,
                replicas: stored.replicas ? stored.replicas.size : 0,
                ttl: stored.ttl
            };
        });
    }

    async shutdown() {
        console.log('🧹 Shutting down Distributed Storage Manager...');
        
        // Cancel all pending requests
        for (const [requestId, request] of this.storageRequests.entries()) {
            clearTimeout(request.timeout);
            request.reject(new Error('Storage manager shutting down'));
        }
        
        this.storageRequests.clear();
        this.localStorage.clear();
        this.replicationMap.clear();
        
        this.isInitialized = false;
        console.log('✅ Distributed Storage Manager shutdown complete');
    }
}

module.exports = { DistributedStorageManager };