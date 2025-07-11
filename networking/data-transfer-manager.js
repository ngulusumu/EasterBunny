//networking/data-transfer-manager.js
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

class DataTransferManager {
    constructor(coordinator) {
        this.coordinator = coordinator;
        this.transferQueue = new Map();
        this.activeTransfers = new Map();
        this.receivedChunks = new Map();
        this.maxChunkSize = 32768; // 32KB
        this.maxConcurrentTransfers = 5;
        this.transferTimeout = 300000; // 5 minutes
        
        // Event handlers
        this.onFileReceived = null;
        this.onDataReceived = null;
        this.onTransferProgress = null;
        this.onTransferComplete = null;
        this.onTransferError = null;
        
        // Event kinds for data transfer
        this.eventKinds = {
            FILE_CHUNK: 32000,
            FILE_START: 32001,
            FILE_COMPLETE: 32002,
            FILE_ACK: 32003,
            DATA_TRANSFER: 32004,
            TRANSFER_ERROR: 32005
        };
        
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;

        // Set up event handlers for data transfer events
        const originalHandler = this.coordinator.handlePrivateNetworkEvent.bind(this.coordinator);
        this.coordinator.handlePrivateNetworkEvent = async (event) => {
            // Handle data transfer events
            if (this.isDataTransferEvent(event)) {
                await this.handleDataTransferEvent(event);
            } else {
                // Pass to original handler
                await originalHandler(event);
            }
        };

        // Start cleanup interval
        this.startCleanupInterval();

        this.isInitialized = true;
        console.log('✅ Data Transfer Manager initialized');
    }

    isDataTransferEvent(event) {
        return Object.values(this.eventKinds).includes(event.kind);
    }

    async handleDataTransferEvent(event) {
        const peerPublicKey = event.pubkey;
        
        // Only process from verified peers
        if (!this.coordinator.verifiedPeers.has(peerPublicKey)) {
            console.warn(`Ignoring data transfer from unverified peer: ${peerPublicKey.substring(0, 8)}...`);
            return;
        }

        try {
            const data = JSON.parse(event.content);

            switch (event.kind) {
                case this.eventKinds.FILE_START:
                    await this.handleFileStart(peerPublicKey, data);
                    break;
                case this.eventKinds.FILE_CHUNK:
                    await this.handleFileChunk(peerPublicKey, data);
                    break;
                case this.eventKinds.FILE_COMPLETE:
                    await this.handleFileComplete(peerPublicKey, data);
                    break;
                case this.eventKinds.FILE_ACK:
                    await this.handleFileAck(peerPublicKey, data);
                    break;
                case this.eventKinds.DATA_TRANSFER:
                    await this.handleDataTransfer(peerPublicKey, data);
                    break;
                case this.eventKinds.TRANSFER_ERROR:
                    await this.handleTransferError(peerPublicKey, data);
                    break;
            }
        } catch (error) {
            console.error('Error handling data transfer event:', error);
        }
    }

    /**
     * Send a file to another machine
     */
    async sendFile(filePath, targetMachineId, options = {}) {
        try {
            const {
                compression = true,
                encryption = false,
                priority = 'normal',
                timeout = this.transferTimeout
            } = options;

            console.log(`📤 Starting file transfer: ${filePath} to ${targetMachineId.substring(0, 8)}...`);

            // Read file
            const fileData = await fs.readFile(filePath);
            const fileName = path.basename(filePath);
            const fileSize = fileData.length;
            
            // Generate transfer ID
            const transferId = crypto.randomBytes(16).toString('hex');
            
            // Prepare file data
            let processedData = fileData;
            
            if (compression) {
                processedData = await gzip(processedData);
                console.log(`🗜️ Compressed file from ${fileSize} to ${processedData.length} bytes`);
            }

            // Create transfer metadata
            const transferMeta = {
                transferId,
                fileName,
                fileSize,
                compressedSize: processedData.length,
                compression,
                encryption,
                totalChunks: Math.ceil(processedData.length / this.maxChunkSize),
                timestamp: Date.now()
            };

            // Send file start event
            await this.sendTransferEvent(this.eventKinds.FILE_START, transferMeta, targetMachineId);

            // Track transfer
            this.activeTransfers.set(transferId, {
                ...transferMeta,
                targetMachineId,
                data: processedData,
                sentChunks: 0,
                status: 'sending',
                startTime: Date.now()
            });

            // Start sending chunks
            await this.sendFileChunks(transferId);

            return {
                transferId,
                fileName,
                fileSize,
                status: 'started'
            };

        } catch (error) {
            console.error('Error sending file:', error);
            throw new Error(`Failed to send file: ${error.message}`);
        }
    }

    /**
     * Send data object to another machine
     */
    async sendData(data, targetMachineId, options = {}) {
        try {
            const {
                compression = true,
                priority = 'normal',
                reliable = true
            } = options;

            console.log(`📤 Sending data to ${targetMachineId.substring(0, 8)}...`);

            // Serialize data
            let serializedData = JSON.stringify(data);
            let processedData = Buffer.from(serializedData, 'utf8');

            if (compression) {
                processedData = await gzip(processedData);
                console.log(`🗜️ Compressed data from ${serializedData.length} to ${processedData.length} bytes`);
            }

            const transferData = {
                data: processedData.toString('base64'),
                compression,
                originalSize: serializedData.length,
                compressedSize: processedData.length,
                timestamp: Date.now(),
                reliable
            };

            // Send data transfer event
            await this.sendTransferEvent(this.eventKinds.DATA_TRANSFER, transferData, targetMachineId);

            return {
                success: true,
                originalSize: serializedData.length,
                compressedSize: processedData.length,
                compression
            };

        } catch (error) {
            console.error('Error sending data:', error);
            throw new Error(`Failed to send data: ${error.message}`);
        }
    }

    async sendFileChunks(transferId) {
        const transfer = this.activeTransfers.get(transferId);
        if (!transfer) return;

        try {
            const { data, totalChunks, targetMachineId } = transfer;

            for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
                const start = chunkIndex * this.maxChunkSize;
                const end = Math.min(start + this.maxChunkSize, data.length);
                const chunkData = data.slice(start, end);

                const chunkMeta = {
                    transferId,
                    chunkIndex,
                    totalChunks,
                    data: chunkData.toString('base64'),
                    timestamp: Date.now()
                };

                await this.sendTransferEvent(this.eventKinds.FILE_CHUNK, chunkMeta, targetMachineId);

                // Update progress
                transfer.sentChunks = chunkIndex + 1;
                const progress = Math.round((transfer.sentChunks / totalChunks) * 100);
                
                if (this.onTransferProgress) {
                    this.onTransferProgress(transferId, progress, 'sending');
                }

                console.log(`📦 Sent chunk ${chunkIndex + 1}/${totalChunks} (${progress}%)`);

                // Small delay to prevent overwhelming
                await this.delay(10);
            }

            // Send completion event
            await this.sendTransferEvent(this.eventKinds.FILE_COMPLETE, {
                transferId,
                timestamp: Date.now()
            }, targetMachineId);

            transfer.status = 'completed';
            transfer.endTime = Date.now();

            if (this.onTransferComplete) {
                this.onTransferComplete(transferId, 'sent');
            }

            console.log(`✅ File transfer completed: ${transferId}`);

        } catch (error) {
            console.error(`Error sending file chunks for ${transferId}:`, error);
            
            // Send error event
            await this.sendTransferEvent(this.eventKinds.TRANSFER_ERROR, {
                transferId,
                error: error.message,
                timestamp: Date.now()
            }, transfer.targetMachineId);

            if (this.onTransferError) {
                this.onTransferError(transferId, error.message, 'sending');
            }
        }
    }

    async handleFileStart(peerPublicKey, data) {
        const { transferId, fileName, fileSize, totalChunks } = data;
        
        console.log(`📥 Receiving file: ${fileName} (${fileSize} bytes, ${totalChunks} chunks) from ${peerPublicKey.substring(0, 8)}...`);

        // Initialize received chunks tracking
        this.receivedChunks.set(transferId, {
            ...data,
            senderPublicKey: peerPublicKey,
            chunks: new Map(),
            receivedCount: 0,
            status: 'receiving',
            startTime: Date.now()
        });

        // Send acknowledgment
        await this.sendTransferEvent(this.eventKinds.FILE_ACK, {
            transferId,
            status: 'ready',
            timestamp: Date.now()
        }, peerPublicKey);
    }

    async handleFileChunk(peerPublicKey, data) {
        const { transferId, chunkIndex, totalChunks, data: chunkData } = data;
        
        const transfer = this.receivedChunks.get(transferId);
        if (!transfer) {
            console.warn(`Received chunk for unknown transfer: ${transferId}`);
            return;
        }

        // Store chunk
        transfer.chunks.set(chunkIndex, Buffer.from(chunkData, 'base64'));
        transfer.receivedCount++;

        const progress = Math.round((transfer.receivedCount / totalChunks) * 100);
        
        if (this.onTransferProgress) {
            this.onTransferProgress(transferId, progress, 'receiving');
        }

        console.log(`📦 Received chunk ${chunkIndex + 1}/${totalChunks} (${progress}%)`);

        // Send chunk acknowledgment
        await this.sendTransferEvent(this.eventKinds.FILE_ACK, {
            transferId,
            chunkIndex,
            status: 'received',
            timestamp: Date.now()
        }, peerPublicKey);
    }

    async handleFileComplete(peerPublicKey, data) {
        const { transferId } = data;
        
        const transfer = this.receivedChunks.get(transferId);
        if (!transfer) {
            console.warn(`Received completion for unknown transfer: ${transferId}`);
            return;
        }

        try {
            // Reassemble file
            const chunks = [];
            for (let i = 0; i < transfer.totalChunks; i++) {
                const chunk = transfer.chunks.get(i);
                if (!chunk) {
                    throw new Error(`Missing chunk ${i}`);
                }
                chunks.push(chunk);
            }

            let fileData = Buffer.concat(chunks);

            // Decompress if needed
            if (transfer.compression) {
                fileData = await gunzip(fileData);
                console.log(`🗜️ Decompressed file from ${transfer.compressedSize} to ${fileData.length} bytes`);
            }

            transfer.status = 'completed';
            transfer.endTime = Date.now();
            transfer.fileData = fileData;

            // Notify completion
            if (this.onFileReceived) {
                this.onFileReceived({
                    transferId,
                    fileName: transfer.fileName,
                    fileSize: transfer.fileSize,
                    data: fileData,
                    senderPublicKey: peerPublicKey,
                    metadata: transfer
                });
            }

            if (this.onTransferComplete) {
                this.onTransferComplete(transferId, 'received');
            }

            console.log(`✅ File received successfully: ${transfer.fileName}`);

            // Send final acknowledgment
            await this.sendTransferEvent(this.eventKinds.FILE_ACK, {
                transferId,
                status: 'completed',
                timestamp: Date.now()
            }, peerPublicKey);

        } catch (error) {
            console.error(`Error assembling file ${transferId}:`, error);
            
            await this.sendTransferEvent(this.eventKinds.TRANSFER_ERROR, {
                transferId,
                error: error.message,
                timestamp: Date.now()
            }, peerPublicKey);

            if (this.onTransferError) {
                this.onTransferError(transferId, error.message, 'receiving');
            }
        }
    }

    async handleDataTransfer(peerPublicKey, data) {
        try {
            const { data: encodedData, compression, originalSize } = data;
            
            let processedData = Buffer.from(encodedData, 'base64');

            if (compression) {
                processedData = await gunzip(processedData);
                console.log(`🗜️ Decompressed data to ${processedData.length} bytes`);
            }

            const receivedData = JSON.parse(processedData.toString('utf8'));

            if (this.onDataReceived) {
                this.onDataReceived({
                    data: receivedData,
                    senderPublicKey: peerPublicKey,
                    originalSize,
                    compression,
                    timestamp: data.timestamp
                });
            }

            console.log(`✅ Data received from ${peerPublicKey.substring(0, 8)}...`);

        } catch (error) {
            console.error('Error handling data transfer:', error);
        }
    }

    async handleFileAck(peerPublicKey, data) {
        const { transferId, status, chunkIndex } = data;
        
        if (status === 'completed') {
            console.log(`✅ Transfer acknowledged as completed: ${transferId}`);
        }
    }

    async handleTransferError(peerPublicKey, data) {
        const { transferId, error } = data;
        
        console.error(`❌ Transfer error for ${transferId}: ${error}`);
        
        if (this.onTransferError) {
            this.onTransferError(transferId, error, 'remote');
        }
    }

    async sendTransferEvent(kind, content, targetPeerId) {
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
     * Get active transfers
     */
    getActiveTransfers() {
        return {
            sending: Array.from(this.activeTransfers.entries()).map(([id, transfer]) => ({
                transferId: id,
                fileName: transfer.fileName,
                status: transfer.status,
                progress: Math.round((transfer.sentChunks / transfer.totalChunks) * 100),
                targetMachine: transfer.targetMachineId.substring(0, 8)
            })),
            receiving: Array.from(this.receivedChunks.entries()).map(([id, transfer]) => ({
                transferId: id,
                fileName: transfer.fileName,
                status: transfer.status,
                progress: Math.round((transfer.receivedCount / transfer.totalChunks) * 100),
                senderMachine: transfer.senderPublicKey.substring(0, 8)
            }))
        };
    }

    /**
     * Cancel a transfer
     */
    async cancelTransfer(transferId) {
        const transfer = this.activeTransfers.get(transferId) || this.receivedChunks.get(transferId);
        
        if (transfer) {
            const targetId = transfer.targetMachineId || transfer.senderPublicKey;
            
            await this.sendTransferEvent(this.eventKinds.TRANSFER_ERROR, {
                transferId,
                error: 'Transfer cancelled',
                timestamp: Date.now()
            }, targetId);

            this.activeTransfers.delete(transferId);
            this.receivedChunks.delete(transferId);
            
            console.log(`❌ Transfer cancelled: ${transferId}`);
        }
    }

    startCleanupInterval() {
        setInterval(() => {
            this.cleanupStaleTransfers();
        }, 60000); // Every minute
    }

    cleanupStaleTransfers() {
        const now = Date.now();
        
        // Clean up stale active transfers
        for (const [transferId, transfer] of this.activeTransfers.entries()) {
            if (now - transfer.startTime > this.transferTimeout) {
                console.log(`🧹 Cleaning up stale transfer: ${transferId}`);
                this.activeTransfers.delete(transferId);
            }
        }
        
        // Clean up stale received chunks
        for (const [transferId, transfer] of this.receivedChunks.entries()) {
            if (now - transfer.startTime > this.transferTimeout) {
                console.log(`🧹 Cleaning up stale received transfer: ${transferId}`);
                this.receivedChunks.delete(transferId);
            }
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async shutdown() {
        console.log('🧹 Shutting down Data Transfer Manager...');
        
        // Cancel all active transfers
        for (const transferId of this.activeTransfers.keys()) {
            await this.cancelTransfer(transferId);
        }
        
        this.activeTransfers.clear();
        this.receivedChunks.clear();
        this.transferQueue.clear();
        
        this.isInitialized = false;
        console.log('✅ Data Transfer Manager shutdown complete');
    }
}

module.exports = { DataTransferManager };