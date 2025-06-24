// Attack Manager - Handles all attack-related operations and monitoring
class AttackManager {
    constructor() {
        this.activeAttacks = new Map();
        this.attackHistory = [];
        this.globalStats = {
            totalAttacks: 0,
            totalBandwidth: 0,
            totalTargets: 0,
            successfulAttacks: 0,
            failedAttacks: 0
        };
        this.maxHistoryEntries = 100;
        this.attackQueue = [];
        this.isProcessingQueue = false;
        this.resourceLimits = null;
        
        this.init();
    }

    async init() {
        await this.loadSystemResourceLimits();
        this.setupAttackMonitoring();
        this.startResourceMonitoring();
        this.loadStoredData();
    }

    async loadSystemResourceLimits() {
        try {
            const systemResponse = await window.electronAPI.getSystemInfo();
            if (systemResponse.success) {
                const systemInfo = systemResponse.data;
                this.resourceLimits = this.calculateResourceLimits(systemInfo);
                console.log('Resource limits calculated:', this.resourceLimits);
            }
        } catch (error) {
            console.warn('Could not load system info for resource limits:', error);
            this.resourceLimits = this.getDefaultResourceLimits();
        }
    }

    calculateResourceLimits(systemInfo) {
        const cpuCores = systemInfo.cpu?.cores || 4;
        const memoryGB = Math.floor((systemInfo.memory?.total || 8000000000) / 1000000000);
        
        return {
            maxThreadsPerAttack: Math.min(cpuCores * 10, 200),
            maxConcurrentAttacks: Math.max(1, Math.floor(cpuCores / 2)),
            maxTotalThreads: cpuCores * 15,
            memoryPerThread: 10, // MB estimate
            maxMemoryUsage: Math.floor(memoryGB * 0.7 * 1024), // 70% of total memory in MB
            recommendedThreads: Math.min(cpuCores * 8, 100),
            cpuCores,
            memoryGB
        };
    }

    getDefaultResourceLimits() {
        return {
            maxThreadsPerAttack: 100,
            maxConcurrentAttacks: 2,
            maxTotalThreads: 200,
            memoryPerThread: 10,
            maxMemoryUsage: 4096,
            recommendedThreads: 50,
            cpuCores: 4,
            memoryGB: 8
        };
    }

    setupAttackMonitoring() {
        // Listen for attack progress updates
        const progressUnsubscribe = window.electronAPI.onAttackProgress((data) => {
            this.handleAttackProgress(data);
        });

        // Listen for attack completion
        const completedUnsubscribe = window.electronAPI.onAttackCompleted((data) => {
            this.handleAttackCompleted(data);
        });

        // Store unsubscribe functions for cleanup
        this.unsubscribeFunctions = [progressUnsubscribe, completedUnsubscribe];
    }

    startResourceMonitoring() {
        // Monitor system resources every 5 seconds
        setInterval(async () => {
            await this.checkResourceUsage();
        }, 5000);
    }

    async checkResourceUsage() {
        try {
            const response = await window.electronAPI.getPerformanceMetrics();
            if (response.success) {
                const performance = response.data.performance;
                this.handleResourceUpdate(performance);
            }
        } catch (error) {
            console.warn('Failed to check resource usage:', error);
        }
    }

    // Attack validation and optimization
    validateAttackConfig(config) {
        const errors = [];
        const warnings = [];

        // Basic validation
        if (!config.target && !config.targets) {
            errors.push('Target(s) required');
        }

        if (!config.method) {
            errors.push('Attack method required');
        }

        if (!config.duration || config.duration <= 0) {
            errors.push('Duration must be positive');
        }

        // Resource validation
        if (this.resourceLimits) {
            const threads = config.threads || config.threadsPerTarget || 50;
            const targetCount = config.targets ? config.targets.length : 1;
            const totalThreads = threads * targetCount;

            if (threads > this.resourceLimits.maxThreadsPerAttack) {
                warnings.push(`Threads reduced from ${threads} to ${this.resourceLimits.maxThreadsPerAttack} (system limit)`);
                config.threads = this.resourceLimits.maxThreadsPerAttack;
            }

            if (totalThreads > this.resourceLimits.maxTotalThreads) {
                const adjustedThreads = Math.floor(this.resourceLimits.maxTotalThreads / targetCount);
                warnings.push(`Threads per target reduced to ${adjustedThreads} due to system limits`);
                config.threadsPerTarget = adjustedThreads;
            }

            const estimatedMemory = totalThreads * this.resourceLimits.memoryPerThread;
            if (estimatedMemory > this.resourceLimits.maxMemoryUsage) {
                warnings.push(`High memory usage expected (${estimatedMemory}MB). Consider reducing threads.`);
            }

            // Check concurrent attacks limit
            if (this.activeAttacks.size >= this.resourceLimits.maxConcurrentAttacks) {
                errors.push(`Maximum concurrent attacks reached (${this.resourceLimits.maxConcurrentAttacks})`);
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            optimizedConfig: config
        };
    }

    // Single target attack
    async startSingleAttack(target, layer, method, duration, options = {}) {
        const config = {
            target,
            layer,
            method,
            duration,
            threads: options.threads || this.resourceLimits?.recommendedThreads || 50,
            ...options
        };

        const validation = this.validateAttackConfig(config);
        if (!validation.valid) {
            throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }

        // Show warnings if any
        if (validation.warnings.length > 0) {
            validation.warnings.forEach(warning => {
                if (window.uiController) {
                    window.uiController.showNotification(warning, 'warning');
                }
            });
        }

        try {
            const response = await window.electronAPI.startDDosAttack(
                config.target,
                config.layer,
                config.method,
                config.duration,
                validation.optimizedConfig
            );

            if (response.success) {
                this.addAttackToTracking(response.data);
                this.updateGlobalStats('started');
                return response.data;
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            this.updateGlobalStats('failed');
            throw error;
        }
    }

    // Multi-target attack
    async startMultiTargetAttack(targets, layer, method, duration, options = {}) {
        const config = {
            targets: Array.isArray(targets) ? targets : targets.split('\n').filter(t => t.trim()),
            layer,
            method,
            duration,
            threadsPerTarget: options.threadsPerTarget || 30,
            maxConcurrentTargets: options.maxConcurrentTargets || 5,
            rampUpTime: options.rampUpTime || 0,
            ...options
        };

        const validation = this.validateAttackConfig(config);
        if (!validation.valid) {
            throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }

        // Show warnings if any
        if (validation.warnings.length > 0) {
            validation.warnings.forEach(warning => {
                if (window.uiController) {
                    window.uiController.showNotification(warning, 'warning');
                }
            });
        }

        try {
            const response = await window.electronAPI.startMultiTargetAttack(validation.optimizedConfig);

            if (response.success) {
                this.addAttackToTracking(response.data);
                this.updateGlobalStats('started', config.targets.length);
                return response.data;
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            this.updateGlobalStats('failed');
            throw error;
        }
    }

    // Enhanced attack with custom configuration
    async startEnhancedAttack(config) {
        const validation = this.validateAttackConfig(config);
        if (!validation.valid) {
            throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }

        try {
            const response = await window.electronAPI.startEnhancedAttack(validation.optimizedConfig);

            if (response.success) {
                this.addAttackToTracking(response.data);
                this.updateGlobalStats('started');
                return response.data;
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            this.updateGlobalStats('failed');
            throw error;
        }
    }

    // Queue management for batch attacks
    async queueAttack(attackConfig) {
        this.attackQueue.push({
            ...attackConfig,
            id: this.generateAttackId(),
            queuedAt: Date.now()
        });

        if (!this.isProcessingQueue) {
            this.processAttackQueue();
        }
    }

    async processAttackQueue() {
        if (this.isProcessingQueue || this.attackQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;

        while (this.attackQueue.length > 0 && this.activeAttacks.size < this.resourceLimits.maxConcurrentAttacks) {
            const attackConfig = this.attackQueue.shift();
            
            try {
                if (attackConfig.targets && attackConfig.targets.length > 1) {
                    await this.startMultiTargetAttack(
                        attackConfig.targets,
                        attackConfig.layer,
                        attackConfig.method,
                        attackConfig.duration,
                        attackConfig
                    );
                } else {
                    await this.startSingleAttack(
                        attackConfig.target || attackConfig.targets[0],
                        attackConfig.layer,
                        attackConfig.method,
                        attackConfig.duration,
                        attackConfig
                    );
                }

                // Wait a bit before starting next attack
                await this.delay(attackConfig.rampUpTime || 1000);
            } catch (error) {
                console.error('Failed to start queued attack:', error);
                
                if (window.uiController) {
                    window.uiController.showNotification(
                        `Queued attack failed: ${error.message}`,
                        'error'
                    );
                }
            }
        }

        this.isProcessingQueue = false;
    }

    // Attack tracking and management
    addAttackToTracking(attackData) {
        const attack = {
            ...attackData,
            startTime: Date.now(),
            status: 'running',
            progress: 0,
            currentBandwidth: 0,
            successRate: 0,
            totalRequests: 0,
            errors: 0
        };

        this.activeAttacks.set(attack.id, attack);
        
        // Update UI
        if (window.mainController) {
            window.mainController.processActiveAttacks([...this.activeAttacks.values()]);
        }
    }

    handleAttackProgress(data) {
        const attack = this.activeAttacks.get(data.attackId);
        if (attack) {
            // Update attack data
            Object.assign(attack, {
                progress: data.progress || 0,
                currentBandwidth: data.currentBandwidth || 0,
                successRate: data.successRate || 0,
                totalRequests: data.totalRequests || 0,
                errors: data.errors || 0,
                lastUpdate: Date.now()
            });

            // Update global stats
            this.updateGlobalStats('progress', 0, data.currentBandwidth);

            // Update UI
            if (window.mainController) {
                window.mainController.processActiveAttacks([...this.activeAttacks.values()]);
            }
        }
    }

    handleAttackCompleted(data) {
        const attack = this.activeAttacks.get(data.attackId);
        if (attack) {
            // Move to history
            const completedAttack = {
                ...attack,
                ...data,
                status: data.success ? 'completed' : 'failed',
                endTime: Date.now(),
                duration: Date.now() - attack.startTime
            };

            this.addToHistory(completedAttack);
            this.activeAttacks.delete(data.attackId);

            // Update global stats
            this.updateGlobalStats(data.success ? 'completed' : 'failed');

            // Show notification
            if (window.uiController) {
                window.uiController.showNotification(
                    `Attack ${data.success ? 'completed' : 'failed'}: ${attack.target}`,
                    data.success ? 'success' : 'error'
                );
            }

            // Update UI
            if (window.mainController) {
                window.mainController.processActiveAttacks([...this.activeAttacks.values()]);
            }

            // Process queue if there are waiting attacks
            if (this.attackQueue.length > 0) {
                this.processAttackQueue();
            }
        }
    }

    handleResourceUpdate(performance) {
        // Check if we need to throttle attacks due to high resource usage
        const cpuUsage = performance.cpu?.usage || 0;
        const memoryUsage = performance.memory?.usage || 0;

        if (cpuUsage > 90 || memoryUsage > 90) {
            this.throttleActiveAttacks();
        }

        // Update resource recommendations
        if (window.mainController) {
            window.mainController.updatePerformanceDisplay({ performance });
        }
    }

    throttleActiveAttacks() {
        // Reduce threads on active attacks if system is under stress
        this.activeAttacks.forEach(attack => {
            if (attack.status === 'running') {
                // Send throttle command to backend
                window.electronAPI.updateAttackStats({
                    attackId: attack.id,
                    throttle: true,
                    reason: 'High resource usage'
                }).catch(console.warn);
            }
        });

        if (window.uiController) {
            window.uiController.showNotification(
                'System under stress - throttling active attacks',
                'warning'
            );
        }
    }

    // Stop operations
    async stopAttack(attackId) {
        try {
            const response = await window.electronAPI.stopAttack(attackId);
            
            if (response.success) {
                const attack = this.activeAttacks.get(attackId);
                if (attack) {
                    attack.status = 'stopped';
                    attack.endTime = Date.now();
                    this.addToHistory(attack);
                    this.activeAttacks.delete(attackId);
                }

                return true;
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            throw error;
        }
    }

    async stopAllAttacks() {
        try {
            const response = await window.electronAPI.stopAllAttacks();
            
            if (response.success) {
                // Move all active attacks to history as stopped
                this.activeAttacks.forEach((attack, id) => {
                    attack.status = 'stopped';
                    attack.endTime = Date.now();
                    this.addToHistory(attack);
                });

                this.activeAttacks.clear();
                return true;
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            throw error;
        }
    }

    // History and statistics
    addToHistory(attack) {
        this.attackHistory.unshift(attack);
        
        // Limit history size
        if (this.attackHistory.length > this.maxHistoryEntries) {
            this.attackHistory = this.attackHistory.slice(0, this.maxHistoryEntries);
        }

        this.saveStoredData();
    }

    updateGlobalStats(action, targetCount = 1, bandwidth = 0) {
        switch (action) {
            case 'started':
                this.globalStats.totalAttacks++;
                this.globalStats.totalTargets += targetCount;
                break;
            case 'completed':
                this.globalStats.successfulAttacks++;
                break;
            case 'failed':
                this.globalStats.failedAttacks++;
                break;
            case 'progress':
                this.globalStats.totalBandwidth = bandwidth;
                break;
        }

        this.saveStoredData();
    }

    getAttackHistory(limit = 20) {
        return this.attackHistory.slice(0, limit);
    }

    getGlobalStats() {
        return {
            ...this.globalStats,
            activeAttacks: this.activeAttacks.size,
            queuedAttacks: this.attackQueue.length,
            successRate: this.globalStats.totalAttacks > 0 
                ? Math.round((this.globalStats.successfulAttacks / this.globalStats.totalAttacks) * 100)
                : 100
        };
    }

    getActiveAttacks() {
        return [...this.activeAttacks.values()];
    }

    getAttackById(attackId) {
        return this.activeAttacks.get(attackId);
    }

    // Data persistence
    saveStoredData() {
        try {
            const data = {
                attackHistory: this.attackHistory,
                globalStats: this.globalStats,
                lastSaved: Date.now()
            };
            
            localStorage.setItem('ngulusumu-attack-data', JSON.stringify(data));
        } catch (error) {
            console.warn('Failed to save attack data:', error);
        }
    }

    loadStoredData() {
        try {
            const data = JSON.parse(localStorage.getItem('ngulusumu-attack-data') || '{}');
            
            if (data.attackHistory) {
                this.attackHistory = data.attackHistory;
            }
            
            if (data.globalStats) {
                this.globalStats = { ...this.globalStats, ...data.globalStats };
            }
        } catch (error) {
            console.warn('Failed to load stored attack data:', error);
        }
    }

    // Export functionality
    exportAttackData(format = 'json') {
        const data = {
            activeAttacks: this.getActiveAttacks(),
            attackHistory: this.attackHistory,
            globalStats: this.getGlobalStats(),
            resourceLimits: this.resourceLimits,
            exportedAt: new Date().toISOString()
        };

        if (format === 'csv') {
            return this.convertToCSV(data);
        }

        return JSON.stringify(data, null, 2);
    }

    convertToCSV(data) {
        const attacks = [...data.attackHistory];
        if (attacks.length === 0) return 'No attack data available';

        const headers = ['Target', 'Method', 'Duration', 'Status', 'Success Rate', 'Total Requests', 'Start Time', 'End Time'];
        const rows = attacks.map(attack => [
            attack.target,
            attack.method,
            attack.duration,
            attack.status,
            attack.successRate || 0,
            attack.totalRequests || 0,
            new Date(attack.startTime).toISOString(),
            attack.endTime ? new Date(attack.endTime).toISOString() : ''
        ]);

        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    // Utility methods
    generateAttackId() {
        return `attack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    // Cleanup
    cleanup() {
        // Stop all active attacks
        this.stopAllAttacks().catch(console.warn);
        
        // Clear intervals and unsubscribe from events
        if (this.unsubscribeFunctions) {
            this.unsubscribeFunctions.forEach(unsubscribe => {
                if (typeof unsubscribe === 'function') {
                    unsubscribe();
                }
            });
        }

        // Save final state
        this.saveStoredData();
        
        console.log('Attack manager cleaned up');
    }
}

// Initialize attack manager
let attackManager;

document.addEventListener('DOMContentLoaded', () => {
    attackManager = new AttackManager();
    
    // Make it globally accessible
    window.attackManager = attackManager;
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (attackManager) {
        attackManager.cleanup();
    }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AttackManager;
}