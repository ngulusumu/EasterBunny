// Fixed Main Interface Controller - Integrated with Enhanced UI
class MainController {
    constructor() {
        this.isInitialized = false;
        this.systemInfo = null;
        this.activeAttacks = new Map();
        this.networkStats = null;
        this.updateIntervals = new Map();
        this.eventListeners = new Map();
        this.performanceMetrics = {
            cpu: 0,
            memory: 0,
            bandwidth: 0
        };
        
        this.init();
    }

    async init() {
        try {
            await this.initializeSystem();
            this.setupEventListeners();
            this.startRealTimeUpdates();
            this.bindFormHandlers();
            this.updateUI();
            
            this.isInitialized = true;
            this.showNotification('System initialized successfully', 'success');
            console.log('Main controller initialized successfully');
        } catch (error) {
            console.error('Failed to initialize main controller:', error);
            this.showNotification('Failed to initialize system', 'error');
        }
    }

    async initializeSystem() {
        try {
            // Get initial system information with error handling
            if (window.electronAPI && typeof window.electronAPI.getSystemInfo === 'function') {
                const systemResponse = await window.electronAPI.getSystemInfo();
                if (systemResponse && systemResponse.success) {
                    this.systemInfo = systemResponse.data;
                    this.updateSystemDisplay();
                }
            } else {
                // Fallback system info
                this.systemInfo = {
                    cpu: { cores: 4, usage: 0 },
                    memory: { total: 8589934592, available: 4294967296, usage: 0 }
                };
                console.warn('ElectronAPI not available, using fallback system info');
            }
        } catch (error) {
            console.warn('Could not fetch system info:', error);
            // Use fallback values
            this.systemInfo = {
                cpu: { cores: 4, usage: 0 },
                memory: { total: 8589934592, available: 4294967296, usage: 0 }
            };
        }

        try {
            // Initialize networking with error handling
            if (window.electronAPI && typeof window.electronAPI.getNetworkStats === 'function') {
                const networkResponse = await window.electronAPI.getNetworkStats();
                if (networkResponse && networkResponse.success) {
                    this.networkStats = networkResponse.data;
                    this.updateNetworkDisplay();
                }
            }
        } catch (error) {
            console.warn('Could not fetch network stats:', error);
            this.networkStats = {
                totalPeers: 1,
                status: 'offline',
                activeMethods: 0
            };
        }

        try {
            // Get initial attack status with error handling
            if (window.electronAPI && typeof window.electronAPI.getActiveAttacks === 'function') {
                const attacksResponse = await window.electronAPI.getActiveAttacks();
                if (attacksResponse && attacksResponse.success) {
                    this.processActiveAttacks(attacksResponse.data);
                }
            }
        } catch (error) {
            console.warn('Could not fetch active attacks:', error);
        }
    }

    setupEventListeners() {
        try {
            // Only setup listeners if electronAPI is available
            if (!window.electronAPI) {
                console.warn('ElectronAPI not available, skipping event listeners');
                return;
            }

            // Attack progress listener
            if (typeof window.electronAPI.onAttackProgress === 'function') {
                const progressUnsubscribe = window.electronAPI.onAttackProgress((data) => {
                    this.handleAttackProgress(data);
                });
                this.eventListeners.set('attackProgress', progressUnsubscribe);
            }

            // Attack completion listener
            if (typeof window.electronAPI.onAttackCompleted === 'function') {
                const completedUnsubscribe = window.electronAPI.onAttackCompleted((data) => {
                    this.handleAttackCompleted(data);
                });
                this.eventListeners.set('attackCompleted', completedUnsubscribe);
            }

            // Resource updates
            if (typeof window.electronAPI.onResourceUpdate === 'function') {
                const resourceUnsubscribe = window.electronAPI.onResourceUpdate((data) => {
                    this.handleResourceUpdate(data);
                });
                this.eventListeners.set('resourceUpdate', resourceUnsubscribe);
            }

            // Network events
            if (typeof window.electronAPI.onNetworkStatsUpdated === 'function') {
                const networkUnsubscribe = window.electronAPI.onNetworkStatsUpdated((data) => {
                    this.handleNetworkUpdate(data);
                });
                this.eventListeners.set('networkUpdate', networkUnsubscribe);
            }

            // System monitoring
            if (typeof window.electronAPI.onMonitoringData === 'function') {
                const monitoringUnsubscribe = window.electronAPI.onMonitoringData((data) => {
                    this.handleMonitoringUpdate(data);
                });
                this.eventListeners.set('monitoring', monitoringUnsubscribe);
            }
        } catch (error) {
            console.warn('Error setting up event listeners:', error);
        }
    }

    startRealTimeUpdates() {
        // Update system stats every 5 seconds
        const systemUpdateInterval = setInterval(async () => {
            await this.updateSystemStats();
        }, 5000);
        this.updateIntervals.set('system', systemUpdateInterval);

        // Update network stats every 3 seconds
        const networkUpdateInterval = setInterval(async () => {
            await this.updateNetworkStats();
        }, 3000);
        this.updateIntervals.set('network', networkUpdateInterval);

        // Update attack stats every 2 seconds
        const attackUpdateInterval = setInterval(async () => {
            await this.updateAttackStats();
        }, 2000);
        this.updateIntervals.set('attacks', attackUpdateInterval);

        // Start system monitoring
        this.startSystemMonitoring();
    }

    async startSystemMonitoring() {
        try {
            if (window.electronAPI && typeof window.electronAPI.startMonitoring === 'function') {
                await window.electronAPI.startMonitoring(2000);
            }
        } catch (error) {
            console.warn('Could not start system monitoring:', error);
        }
    }

    bindFormHandlers() {
        // Single target attack form
        const singleForm = document.getElementById('single-attack-form');
        if (singleForm) {
            singleForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleSingleAttack(e);
            });
        }

        // Multi-target attack form
        const multiForm = document.getElementById('multi-attack-form');
        if (multiForm) {
            multiForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleMultiAttack(e);
            });
        }

        // Network control buttons
        this.bindNetworkButtons();
        
        // Quick action buttons
        this.bindQuickActionButtons();

        // Advanced settings
        this.bindAdvancedSettings();
    }

    bindNetworkButtons() {
        const startNetworkingBtn = document.getElementById('start-networking-btn');
        if (startNetworkingBtn) {
            startNetworkingBtn.addEventListener('click', async () => {
                await this.handleStartNetworking();
            });
        }

        const discoverPeersBtn = document.getElementById('discover-peers-btn');
        if (discoverPeersBtn) {
            discoverPeersBtn.addEventListener('click', async () => {
                await this.handleDiscoverPeers();
            });
        }

        const testConnectivityBtn = document.getElementById('test-connectivity-btn');
        if (testConnectivityBtn) {
            testConnectivityBtn.addEventListener('click', async () => {
                await this.handleTestConnectivity();
            });
        }
    }

    bindQuickActionButtons() {
        const stopAllBtn = document.getElementById('stop-all-btn');
        if (stopAllBtn) {
            stopAllBtn.addEventListener('click', async () => {
                await this.handleStopAllAttacks();
            });
        }

        const viewHistoryBtn = document.getElementById('view-history-btn');
        if (viewHistoryBtn) {
            viewHistoryBtn.addEventListener('click', () => {
                this.showAttackHistory();
            });
        }

        const exportDataBtn = document.getElementById('export-data-btn');
        if (exportDataBtn) {
            exportDataBtn.addEventListener('click', async () => {
                await this.handleExportData();
            });
        }

        const systemInfoBtn = document.getElementById('system-info-btn');
        if (systemInfoBtn) {
            systemInfoBtn.addEventListener('click', () => {
                this.showSystemInfoModal();
            });
        }
    }

    bindAdvancedSettings() {
        // Tab switching
        const activityTabs = document.querySelectorAll('.activity-tab');
        activityTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchActivityTab(tab.dataset.tab);
            });
        });

        // Log controls
        const clearLogsBtn = document.getElementById('clear-logs-btn');
        if (clearLogsBtn) {
            clearLogsBtn.addEventListener('click', () => {
                this.clearLogs();
            });
        }

        // Advanced settings button
        const advancedSettingsBtn = document.getElementById('advanced-settings-btn');
        if (advancedSettingsBtn) {
            advancedSettingsBtn.addEventListener('click', () => {
                this.toggleSidePanel();
            });
        }
    }

    async handleSingleAttack(event) {
        const target = document.getElementById('single-target').value.trim();
        const layer = document.getElementById('single-layer').value;
        const method = document.getElementById('single-method').value;
        const duration = parseInt(document.getElementById('single-duration').value);
        const threads = parseInt(document.getElementById('single-threads').value);

        // Enhanced validation
        const validation = this.validateAttackConfig({
            target,
            layer,
            method,
            duration,
            threads
        });

        if (!validation.valid) {
            this.showNotification(validation.error, 'error');
            return;
        }

        // Check system resources before starting attack
        const resourceCheck = this.checkSystemResources(threads, 1);
        if (!resourceCheck.sufficient) {
            this.showNotification(`Insufficient resources: ${resourceCheck.reason}`, 'error');
            return;
        }

        // Get optimal settings based on system info
        const optimizedSettings = this.getOptimalSettings(threads, 1);

        // Create attack configuration with proper serialization
        const attackConfig = {
            target: target,
            layer: layer,
            method: method,
            duration: duration,
            threads: optimizedSettings.threads || threads,
            options: this.getAdvancedOptions()
        };

        try {
            this.showLoadingOverlay('Starting single target attack...');
            
            let response;
            if (window.electronAPI && typeof window.electronAPI.startDDosAttack === 'function') {
                // Use proper parameter passing to avoid object serialization issues
                response = await window.electronAPI.startDDosAttack(
                    attackConfig.target,
                    attackConfig.layer,
                    attackConfig.method,
                    attackConfig.duration,
                    attackConfig.threads,
                    JSON.stringify(attackConfig.options) // Serialize options properly
                );
            } else {
                // Fallback for demo mode
                response = await this.simulateSingleAttack(attackConfig);
            }

            this.hideLoadingOverlay();

            if (response && response.success) {
                this.showNotification('Attack started successfully', 'success');
                this.addAttackToDisplay(response.data);
            } else {
                this.showNotification(`Failed to start attack: ${response ? response.error : 'Unknown error'}`, 'error');
            }
        } catch (error) {
            this.hideLoadingOverlay();
            console.error('Attack error:', error);
            this.showNotification(`Error starting attack: ${error.message}`, 'error');
        }
    }

    async handleMultiAttack(event) {
        const targets = document.getElementById('multi-targets').value
            .split('\n')
            .map(t => t.trim())
            .filter(t => t.length > 0);
        
        const layer = document.getElementById('multi-layer').value;
        const method = document.getElementById('multi-method').value;
        const duration = parseInt(document.getElementById('multi-duration').value);
        const threadsPerTarget = parseInt(document.getElementById('multi-threads').value);
        const rampUpTime = parseInt(document.getElementById('multi-rampup').value);

        // Validate inputs
        if (targets.length === 0) {
            this.showNotification('Please enter at least one target', 'error');
            return;
        }

        // Enhanced resource checking for multi-target
        const resourceCheck = this.checkSystemResources(threadsPerTarget, targets.length);
        if (!resourceCheck.sufficient) {
            this.showNotification(`Insufficient resources for multi-target: ${resourceCheck.reason}`, 'error');
            return;
        }

        // Get optimal settings for multi-target
        const optimizedSettings = this.getOptimalSettings(threadsPerTarget, targets.length);

        const config = {
            targets: targets,
            layer: layer,
            method: method,
            duration: duration,
            threadsPerTarget: optimizedSettings.threadsPerTarget || threadsPerTarget,
            maxConcurrentTargets: optimizedSettings.maxConcurrentTargets || Math.min(targets.length, 3),
            rampUpTime: rampUpTime,
            options: this.getAdvancedOptions()
        };

        try {
            this.showLoadingOverlay('Starting multi-target attack...');
            
            let response;
            if (window.electronAPI && typeof window.electronAPI.startMultiTargetAttack === 'function') {
                // Serialize the entire config to avoid object passing issues
                response = await window.electronAPI.startMultiTargetAttack(JSON.stringify(config));
            } else {
                // Fallback for demo mode
                response = await this.simulateMultiAttack(config);
            }

            this.hideLoadingOverlay();

            if (response && response.success) {
                this.showNotification(`Multi-target attack started on ${targets.length} targets`, 'success');
                this.addAttackToDisplay(response.data);
            } else {
                this.showNotification(`Failed to start multi-target attack: ${response ? response.error : 'Unknown error'}`, 'error');
            }
        } catch (error) {
            this.hideLoadingOverlay();
            console.error('Multi-attack error:', error);
            this.showNotification(`Error starting multi-target attack: ${error.message}`, 'error');
        }
    }

    // Enhanced resource checking
    checkSystemResources(threadsPerTarget, targetCount = 1) {
        const totalThreads = threadsPerTarget * targetCount;
        const estimatedMemoryMB = totalThreads * 2; // 2MB per thread estimate
        const availableMemoryMB = this.systemInfo ? 
            Math.floor((this.systemInfo.memory?.available || 4294967296) / 1048576) : 4096;
        
        const cpuCores = this.systemInfo?.cpu?.cores || 4;
        const maxRecommendedThreads = cpuCores * 20; // Conservative estimate
        
        if (totalThreads > maxRecommendedThreads) {
            return {
                sufficient: false,
                reason: `Too many threads (${totalThreads}). Maximum recommended: ${maxRecommendedThreads}`
            };
        }
        
        if (estimatedMemoryMB > availableMemoryMB * 0.8) { // Use max 80% of available memory
            return {
                sufficient: false,
                reason: `Insufficient memory. Required: ${estimatedMemoryMB}MB, Available: ${Math.floor(availableMemoryMB * 0.8)}MB`
            };
        }
        
        return { sufficient: true };
    }

    getOptimalSettings(requestedThreads, targetCount = 1) {
        if (!this.systemInfo) {
            return {
                threads: Math.min(requestedThreads, 25), // Conservative fallback
                threadsPerTarget: Math.min(requestedThreads, 25),
                maxConcurrentTargets: Math.min(targetCount, 3)
            };
        }

        const cpuCores = this.systemInfo.cpu?.cores || 4;
        const memoryGB = Math.floor((this.systemInfo.memory?.total || 8589934592) / 1073741824);
        
        // Calculate optimal threads based on system resources
        const maxThreadsPerCore = memoryGB < 4 ? 5 : memoryGB < 8 ? 8 : 12;
        const totalMaxThreads = cpuCores * maxThreadsPerCore;
        
        // Apply memory-based reduction
        const memoryMultiplier = memoryGB < 4 ? 0.4 : memoryGB < 8 ? 0.7 : 1.0;
        const adjustedMaxThreads = Math.floor(totalMaxThreads * memoryMultiplier);
        
        let threadsPerTarget = requestedThreads;
        let maxConcurrentTargets = targetCount;
        
        if (targetCount > 1) {
            // For multi-target, distribute threads efficiently
            const totalRequestedThreads = requestedThreads * targetCount;
            
            if (totalRequestedThreads > adjustedMaxThreads) {
                // Reduce threads per target first
                threadsPerTarget = Math.max(5, Math.floor(adjustedMaxThreads / targetCount));
                
                // If still too low, limit concurrent targets
                if (threadsPerTarget < 10 && targetCount > 2) {
                    maxConcurrentTargets = Math.max(1, Math.floor(adjustedMaxThreads / 15));
                    threadsPerTarget = 15;
                }
            }
        } else {
            threadsPerTarget = Math.min(requestedThreads, adjustedMaxThreads);
        }

        return {
            threads: threadsPerTarget,
            threadsPerTarget,
            maxConcurrentTargets,
            recommendedThreads: threadsPerTarget !== requestedThreads ? threadsPerTarget : null
        };
    }

    getAdvancedOptions() {
        return {
            useProxies: document.getElementById('use-proxies')?.checked || false,
            rateLimitBypass: document.getElementById('rate-limit-bypass')?.checked || false,
            keepAlive: document.getElementById('keep-alive')?.checked || false,
            adaptiveScaling: document.getElementById('adaptive-scaling')?.checked || true,
            payloadSize: parseInt(document.getElementById('payload-size')?.value || 1024),
            requestTimeout: parseInt(document.getElementById('request-timeout')?.value || 5000),
            proxyList: document.getElementById('proxy-list')?.value || '',
            proxyRotation: document.getElementById('proxy-rotation')?.value || 'round-robin'
        };
    }

    validateAttackConfig(config) {
        if (!config.target) {
            return { valid: false, error: 'Target is required' };
        }

        // Enhanced target validation
        const targetPattern = /^([a-zA-Z0-9.-]+|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d+)$/;
        if (!targetPattern.test(config.target)) {
            return { valid: false, error: 'Target must be in format domain:port or IP:port' };
        }

        const port = parseInt(config.target.split(':')[1]);
        if (port < 1 || port > 65535) {
            return { valid: false, error: 'Port must be between 1 and 65535' };
        }

        if (config.duration < 1 || config.duration > 3600) {
            return { valid: false, error: 'Duration must be between 1 and 3600 seconds' };
        }

        if (config.threads < 1 || config.threads > 1000) {
            return { valid: false, error: 'Threads must be between 1 and 1000' };
        }

        return { valid: true };
    }

    // Simulation methods for fallback when electronAPI is not available
    async simulateSingleAttack(config) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
        
        const attackId = 'sim_' + Date.now();
        return {
            success: true,
            data: {
                id: attackId,
                target: config.target,
                method: config.method,
                status: 'running',
                startTime: Date.now(),
                duration: config.duration,
                threads: config.threads
            }
        };
    }

    async simulateMultiAttack(config) {
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate delay
        
        const attackId = 'multi_sim_' + Date.now();
        return {
            success: true,
            data: {
                id: attackId,
                targets: config.targets,
                method: config.method,
                status: 'running',
                startTime: Date.now(),
                duration: config.duration,
                threadsPerTarget: config.threadsPerTarget
            }
        };
    }

    async updateSystemStats() {
        try {
            if (window.electronAPI && typeof window.electronAPI.getPerformanceMetrics === 'function') {
                const response = await window.electronAPI.getPerformanceMetrics();
                if (response && response.success) {
                    this.updatePerformanceDisplay(response.data);
                    return;
                }
            }
            
            // Fallback: simulate system stats
            this.simulateSystemStats();
        } catch (error) {
            console.warn('Failed to update system stats:', error);
            this.simulateSystemStats();
        }
    }

    simulateSystemStats() {
        // Generate realistic demo data
        const baseCpu = 20 + (this.activeAttacks.size * 15);
        const baseMemory = 30 + (this.activeAttacks.size * 10);
        
        this.performanceMetrics.cpu = Math.min(95, baseCpu + (Math.random() - 0.5) * 10);
        this.performanceMetrics.memory = Math.min(90, baseMemory + (Math.random() - 0.5) * 5);
        
        this.updatePerformanceDisplay({
            performance: {
                cpu: { usage: this.performanceMetrics.cpu },
                memory: { usage: this.performanceMetrics.memory }
            }
        });
    }

    async updateNetworkStats() {
        try {
            if (window.electronAPI && typeof window.electronAPI.getNetworkStats === 'function') {
                const response = await window.electronAPI.getNetworkStats();
                if (response && response.success) {
                    this.networkStats = response.data;
                    this.updateNetworkDisplay();
                    return;
                }
            }
            
            // Fallback: use existing stats or defaults
            if (!this.networkStats) {
                this.networkStats = {
                    totalPeers: 1,
                    status: 'online',
                    activeMethods: this.activeAttacks.size
                };
            }
            this.updateNetworkDisplay();
        } catch (error) {
            console.warn('Failed to update network stats:', error);
        }
    }

    async updateAttackStats() {
        try {
            if (window.electronAPI && typeof window.electronAPI.getActiveAttacks === 'function') {
                const response = await window.electronAPI.getActiveAttacks();
                if (response && response.success) {
                    this.processActiveAttacks(response.data);
                    return;
                }
            }
            
            // Fallback: simulate attack progress
            this.simulateAttackProgress();
        } catch (error) {
            console.warn('Failed to update attack stats:', error);
            this.simulateAttackProgress();
        }
    }

    simulateAttackProgress() {
        this.activeAttacks.forEach((attack, id) => {
            if (attack.status === 'running') {
                const elapsed = (Date.now() - attack.startTime) / 1000;
                const progress = Math.min(100, (elapsed / attack.duration) * 100);
                
                attack.progress = progress;
                attack.currentBandwidth = Math.random() * 500000 + 100000; // 100KB-600KB/s
                attack.successRate = Math.max(80, 100 - Math.random() * 20);

                if (progress >= 100) {
                    attack.status = 'completed';
                    attack.progress = 100;
                    this.showNotification(`Attack ${id} completed`, 'info');
                }
            }
        });

        this.updateAttackDisplay();
    }

    processActiveAttacks(attacks) {
        // Update active attacks map
        this.activeAttacks.clear();
        attacks.forEach(attack => {
            this.activeAttacks.set(attack.id, attack);
        });

        this.updateAttackDisplay();
    }

    updateAttackDisplay() {
        const activeCount = Array.from(this.activeAttacks.values())
            .filter(attack => attack.status === 'running').length;
        
        // Update attack counts
        this.updateQuickStat('active-attacks-count', activeCount);
        this.updateQuickStat('attacks-tab-count', this.activeAttacks.size);
        
        // Calculate total stats
        let totalBandwidth = 0;
        let totalRequests = 0;
        let successfulRequests = 0;

        this.activeAttacks.forEach(attack => {
            totalBandwidth += attack.currentBandwidth || 0;
            const requests = attack.totalRequests || 0;
            totalRequests += requests;
            successfulRequests += Math.round(requests * (attack.successRate || 100) / 100);
        });

        // Update display
        this.updateQuickStat('total-bandwidth', this.formatBytes(totalBandwidth) + '/s');
        
        const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 100;
        this.updateQuickStat('success-rate', Math.round(successRate) + '%');
        this.updateQuickStat('total-requests', totalRequests + ' requests');

        // Update attack list
        this.updateActiveAttacksList();
    }

    updateActiveAttacksList() {
        const container = document.getElementById('active-attacks-list');
        if (!container) return;

        if (this.activeAttacks.size === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-400 py-8">
                    <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                    </svg>
                    <p>No active attacks</p>
                    <p class="text-sm">Start an attack to see real-time statistics</p>
                </div>
            `;
            return;
        }

        const attacksArray = Array.from(this.activeAttacks.values());
        container.innerHTML = attacksArray.map(attack => this.createAttackCard(attack)).join('');
    }

    createAttackCard(attack) {
        const status = attack.status || 'running';
        const targets = Array.isArray(attack.targets) ? attack.targets : [attack.target || 'Unknown'];
        const targetDisplay = targets.length === 1 ? targets[0] : `${targets.length} targets`;
        const method = attack.method || 'Unknown';
        const progress = attack.progress || 0;
        const bandwidth = this.formatBytes(attack.currentBandwidth || 0) + '/s';
        const successRate = Math.round(attack.successRate || 0) + '%';
        const elapsed = attack.startTime ? Math.floor((Date.now() - attack.startTime) / 1000) : 0;
        const remaining = Math.max(0, (attack.duration || 0) - elapsed);

        return `
            <div class="attack-card bg-gray-800/50 rounded-lg p-4 mb-3" data-attack-id="${attack.id}">
                <div class="flex justify-between items-start mb-3">
                    <div class="flex-1 min-w-0">
                        <h4 class="font-semibold text-white truncate">${targetDisplay}</h4>
                        <p class="text-sm text-gray-400">${method} • ${this.formatTime(remaining)} remaining</p>
                    </div>
                    <span class="status-badge status-${status} ml-2 px-2 py-1 rounded text-xs">${status}</span>
                </div>
                
                <div class="grid grid-cols-2 gap-4 mb-3 text-sm">
                    <div>
                        <span class="text-gray-400">Bandwidth:</span>
                        <span class="text-white ml-2">${bandwidth}</span>
                    </div>
                    <div>
                        <span class="text-gray-400">Success:</span>
                        <span class="text-white ml-2">${successRate}</span>
                    </div>
                </div>
                
                <div class="mb-3">
                    <div class="flex justify-between text-sm mb-1">
                        <span class="text-gray-400">Progress</span>
                        <span class="text-white">${Math.round(progress)}%</span>
                    </div>
                    <div class="w-full bg-gray-700 rounded-full h-2">
                        <div class="bg-blue-500 h-2 rounded-full transition-all duration-300" style="width: ${progress}%"></div>
                    </div>
                </div>
                
                ${status === 'running' ? `
                    <button onclick="mainController.stopAttack('${attack.id}')" 
                            class="w-full bg-red-500 hover:bg-red-600 text-white text-sm py-1.5 rounded transition-all duration-200">
                        Stop Attack
                    </button>
                ` : `
                    <button onclick="mainController.removeAttack('${attack.id}')" 
                            class="w-full bg-gray-600 hover:bg-gray-700 text-white text-sm py-1.5 rounded transition-all duration-200">
                       Remove
                   </button>
               `}
           </div>
       `;
   }

   updatePerformanceDisplay(data) {
       const cpuUsage = data.performance?.cpu?.usage || 0;
       const memoryUsage = data.performance?.memory?.usage || 0;

       // Update header stats
       this.updateQuickStat('header-cpu', Math.round(cpuUsage) + '%');
       this.updateQuickStat('header-memory', Math.round(memoryUsage) + '%');
       this.updateQuickStat('header-attacks', this.activeAttacks.size);

       // Update detailed stats
       this.updateQuickStat('cpu-usage', Math.round(cpuUsage) + '%');
       this.updateQuickStat('memory-usage', Math.round(memoryUsage) + '%');

       // Update progress bars
       const cpuBar = document.getElementById('cpu-bar');
       const memoryBar = document.getElementById('memory-bar');

       if (cpuBar) cpuBar.style.width = cpuUsage + '%';
       if (memoryBar) memoryBar.style.width = memoryUsage + '%';

       // Update system info if available
       if (this.systemInfo) {
           this.updateQuickStat('cpu-cores', this.systemInfo.cpu?.cores || 'N/A');
           this.updateQuickStat('cpu-load', (cpuUsage / 100).toFixed(1));
           
           const totalMemoryGB = Math.round((this.systemInfo.memory?.total || 0) / 1073741824);
           const freeMemoryGB = Math.round(totalMemoryGB * (1 - memoryUsage / 100));
           
           this.updateQuickStat('memory-total', totalMemoryGB + ' GB');
           this.updateQuickStat('memory-free', freeMemoryGB + ' GB');
       }

       // Update recommendations
       this.updateRecommendations(data.performance);
   }

   updateNetworkDisplay() {
       if (!this.networkStats) return;

       const peers = this.networkStats.totalPeers || 1;
       const status = this.networkStats.status || 'offline';

       this.updateQuickStat('network-peers', peers);
       this.updateQuickStat('peer-status', peers === 1 ? 'Local machine' : `${peers - 1} external`);

       // Update system status indicator
       const statusIndicator = document.getElementById('system-status-indicator');
       const statusText = document.getElementById('system-status-text');
       
       if (statusIndicator && statusText) {
           if (status === 'online') {
               statusIndicator.className = 'w-2 h-2 bg-green-500 rounded-full animate-pulse';
               statusText.textContent = 'System Online';
           } else {
               statusIndicator.className = 'w-2 h-2 bg-gray-500 rounded-full';
               statusText.textContent = 'System Ready';
           }
       }

       // Update network info panel
       this.updateQuickStat('net-status', status);
       this.updateQuickStat('net-peers', peers);
       this.updateQuickStat('net-methods', this.networkStats.activeMethods || 0);
   }

   updateQuickStat(elementId, value) {
       const element = document.getElementById(elementId);
       if (element) {
           element.textContent = value;
       }
   }

   updateSystemDisplay() {
       if (!this.systemInfo) return;
       console.log('System info updated:', this.systemInfo);
   }

   updateRecommendations(performance) {
       const container = document.getElementById('recommendations');
       if (!container) return;

       const recommendations = [];
       const cpuUsage = performance?.cpu?.usage || 0;
       const memoryUsage = performance?.memory?.usage || 0;

       if (cpuUsage > 80) {
           recommendations.push({
               type: 'warning',
               message: 'High CPU usage detected - consider reducing thread count'
           });
       }

       if (memoryUsage > 85) {
           recommendations.push({
               type: 'warning',
               message: 'High memory usage - reduce concurrent attacks'
           });
       }

       if (this.activeAttacks.size > 3) {
           recommendations.push({
               type: 'warning',
               message: 'Multiple concurrent attacks - monitor system resources'
           });
       }

       if (recommendations.length === 0) {
           recommendations.push({
               type: 'success',
               message: 'System performance optimal'
           });
       }

       container.innerHTML = recommendations.map(rec => `
           <div class="flex items-center space-x-2">
               <div class="w-2 h-2 ${rec.type === 'success' ? 'bg-green-400' : 'bg-yellow-400'} rounded-full"></div>
               <span class="text-gray-300">${rec.message}</span>
           </div>
       `).join('');
   }

   // Event handlers
   handleAttackProgress(data) {
       console.log('Attack progress:', data);
       if (this.activeAttacks.has(data.id)) {
           const attack = this.activeAttacks.get(data.id);
           Object.assign(attack, data);
           this.updateAttackDisplay();
       }
   }

   handleAttackCompleted(data) {
       console.log('Attack completed:', data);
       this.showNotification(`Attack completed: ${data.target}`, 'info');
       if (this.activeAttacks.has(data.id)) {
           const attack = this.activeAttacks.get(data.id);
           attack.status = 'completed';
           attack.progress = 100;
           this.updateAttackDisplay();
       }
   }

   handleResourceUpdate(data) {
       console.log('Resource update:', data);
       this.updatePerformanceDisplay(data);
   }

   handleNetworkUpdate(data) {
       console.log('Network update:', data);
       this.networkStats = data;
       this.updateNetworkDisplay();
   }

   handleMonitoringUpdate(data) {
       console.log('Monitoring update:', data);
       this.updatePerformanceDisplay(data);
   }

   // Attack management methods
   async stopAttack(attackId) {
       try {
           let response;
           if (window.electronAPI && typeof window.electronAPI.stopAttack === 'function') {
               response = await window.electronAPI.stopAttack(attackId);
           } else {
               // Fallback for demo mode
               response = { success: true };
               const attack = this.activeAttacks.get(attackId);
               if (attack) {
                   attack.status = 'stopped';
               }
           }

           if (response && response.success) {
               this.showNotification('Attack stopped successfully', 'success');
               this.updateAttackDisplay();
           } else {
               this.showNotification(`Failed to stop attack: ${response ? response.error : 'Unknown error'}`, 'error');
           }
       } catch (error) {
           console.error('Stop attack error:', error);
           this.showNotification(`Error stopping attack: ${error.message}`, 'error');
       }
   }

   removeAttack(attackId) {
       this.activeAttacks.delete(attackId);
       this.updateAttackDisplay();
       this.showNotification('Attack removed from display', 'info');
   }

   addAttackToDisplay(attackData) {
       this.activeAttacks.set(attackData.id, attackData);
       this.updateAttackDisplay();
   }

   // Network handlers
   async handleStartNetworking() {
       try {
           let response;
           if (window.electronAPI && typeof window.electronAPI.startNetworking === 'function') {
               response = await window.electronAPI.startNetworking();
           } else {
               // Fallback
               response = { success: true };
               this.networkStats = { ...this.networkStats, status: 'online' };
           }

           if (response && response.success) {
               this.showNotification('Networking started successfully', 'success');
               this.updateNetworkDisplay();
           } else {
               this.showNotification(`Failed to start networking: ${response ? response.error : 'Unknown error'}`, 'error');
           }
       } catch (error) {
           console.error('Start networking error:', error);
           this.showNotification(`Error starting networking: ${error.message}`, 'error');
       }
   }

   async handleDiscoverPeers() {
       try {
           let response;
           if (window.electronAPI && typeof window.electronAPI.discoverPeers === 'function') {
               response = await window.electronAPI.discoverPeers();
           } else {
               // Fallback
               response = { success: true, data: [] };
           }

           if (response && response.success) {
               const peerCount = response.data ? response.data.length : 0;
               this.showNotification(`Discovered ${peerCount} peers`, 'success');
           } else {
               this.showNotification(`Failed to discover peers: ${response ? response.error : 'Unknown error'}`, 'error');
           }
       } catch (error) {
           console.error('Discover peers error:', error);
           this.showNotification(`Error discovering peers: ${error.message}`, 'error');
       }
   }

   async handleTestConnectivity() {
       try {
           let response;
           if (window.electronAPI && typeof window.electronAPI.testConnectivity === 'function') {
               response = await window.electronAPI.testConnectivity();
           } else {
               // Fallback
               response = { success: true };
           }

           if (response && response.success) {
               this.showNotification('Connectivity test completed successfully', 'success');
           } else {
               this.showNotification(`Connectivity test failed: ${response ? response.error : 'Unknown error'}`, 'error');
           }
       } catch (error) {
           console.error('Test connectivity error:', error);
           this.showNotification(`Error testing connectivity: ${error.message}`, 'error');
       }
   }

   async handleStopAllAttacks() {
       try {
           const runningAttacks = Array.from(this.activeAttacks.values())
               .filter(attack => attack.status === 'running');

           if (runningAttacks.length === 0) {
               this.showNotification('No active attacks to stop', 'warning');
               return;
           }

           let response;
           if (window.electronAPI && typeof window.electronAPI.stopAllAttacks === 'function') {
               response = await window.electronAPI.stopAllAttacks();
           } else {
               // Fallback
               response = { success: true };
               runningAttacks.forEach(attack => {
                   attack.status = 'stopped';
               });
           }

           if (response && response.success) {
               this.showNotification(`Stopped ${runningAttacks.length} attacks`, 'success');
               this.updateAttackDisplay();
           } else {
               this.showNotification(`Failed to stop attacks: ${response ? response.error : 'Unknown error'}`, 'error');
           }
       } catch (error) {
           console.error('Stop all attacks error:', error);
           this.showNotification(`Error stopping attacks: ${error.message}`, 'error');
       }
   }

   async handleExportData() {
       try {
           let response;
           if (window.electronAPI && typeof window.electronAPI.exportNetworkData === 'function') {
               response = await window.electronAPI.exportNetworkData();
           } else {
               // Fallback - create and download export file
               const exportData = {
                   timestamp: new Date().toISOString(),
                   systemInfo: this.systemInfo,
                   activeAttacks: Array.from(this.activeAttacks.values()),
                   networkStats: this.networkStats,
                   performanceMetrics: this.performanceMetrics
               };
               
               const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
               const url = URL.createObjectURL(blob);
               
               const a = document.createElement('a');
               a.href = url;
               a.download = `ngulusumu-export-${new Date().toISOString().split('T')[0]}.json`;
               document.body.appendChild(a);
               a.click();
               document.body.removeChild(a);
               URL.revokeObjectURL(url);
               
               response = { success: true };
           }

           if (response && response.success) {
               this.showNotification('Data exported successfully', 'success');
           } else {
               this.showNotification(`Export failed: ${response ? response.error : 'Unknown error'}`, 'error');
           }
       } catch (error) {
           console.error('Export data error:', error);
           this.showNotification(`Error exporting data: ${error.message}`, 'error');
       }
   }

   // UI Control Methods
   switchActivityTab(tabName) {
       // Hide all tab contents
       document.querySelectorAll('.tab-content').forEach(tab => {
           tab.classList.remove('active');
           tab.classList.add('hidden');
       });

       // Remove active class from all tabs
       document.querySelectorAll('.activity-tab').forEach(tab => {
           tab.classList.remove('active');
       });

       // Show selected tab
       const selectedTab = document.getElementById(`${tabName}-tab`);
       const selectedButton = document.querySelector(`[data-tab="${tabName}"]`);

       if (selectedTab) {
           selectedTab.classList.add('active');
           selectedTab.classList.remove('hidden');
       }

       if (selectedButton) {
           selectedButton.classList.add('active');
       }
   }

   clearLogs() {
       const systemLogs = document.getElementById('system-logs');
       if (systemLogs) {
           systemLogs.innerHTML = '<div class="text-gray-400 text-xs">Logs cleared</div>';
       }
       this.showNotification('Logs cleared', 'info');
   }

   toggleSidePanel() {
       const sidePanel = document.getElementById('side-panel');
       if (sidePanel) {
           sidePanel.classList.toggle('translate-x-full');
       }
   }

   showAttackHistory() {
       const historyContent = `
           <div class="space-y-4">
               <div class="text-center text-gray-400 py-8">
                   <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                   </svg>
                   <p>Attack History</p>
                   <p class="text-sm">Historical attack data will be displayed here</p>
               </div>
           </div>
       `;
       this.showModal('Attack History', historyContent);
   }

   showSystemInfoModal() {
       const systemInfo = this.systemInfo || { cpu: { cores: 'Unknown' }, memory: { total: 0 } };
       
       const content = `
           <div class="space-y-6">
               <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div class="bg-gray-800/50 rounded-lg p-4">
                       <h4 class="font-semibold text-white mb-2">CPU Information</h4>
                       <div class="space-y-1 text-sm">
                           <div class="flex justify-between">
                               <span class="text-gray-400">Cores:</span>
                               <span class="text-white">${systemInfo.cpu?.cores || 'Unknown'}</span>
                           </div>
                           <div class="flex justify-between">
                               <span class="text-gray-400">Usage:</span>
                               <span class="text-white">${Math.round(this.performanceMetrics.cpu)}%</span>
                           </div>
                       </div>
                   </div>
                   
                   <div class="bg-gray-800/50 rounded-lg p-4">
                       <h4 class="font-semibold text-white mb-2">Memory Information</h4>
                       <div class="space-y-1 text-sm">
                           <div class="flex justify-between">
                               <span class="text-gray-400">Total:</span>
                               <span class="text-white">${this.formatBytes(systemInfo.memory?.total || 0)}</span>
                           </div>
                           <div class="flex justify-between">
                               <span class="text-gray-400">Usage:</span>
                               <span class="text-white">${Math.round(this.performanceMetrics.memory)}%</span>
                           </div>
                       </div>
                   </div>
               </div>
               
               <div class="bg-gray-800/50 rounded-lg p-4">
                   <h4 class="font-semibold text-white mb-3">Current Statistics</h4>
                   <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                       <div class="text-center">
                           <div class="text-2xl font-bold text-primary-400">${this.activeAttacks.size}</div>
                           <div class="text-gray-400">Active Attacks</div>
                       </div>
                       <div class="text-center">
                           <div class="text-2xl font-bold text-success-400">${this.networkStats?.totalPeers || 1}</div>
                           <div class="text-gray-400">Network Peers</div>
                       </div>
                       <div class="text-center">
                           <div class="text-2xl font-bold text-yellow-400">${Math.round(this.performanceMetrics.cpu)}%</div>
                           <div class="text-gray-400">CPU Usage</div>
                       </div>
                       <div class="text-center">
                           <div class="text-2xl font-bold text-purple-400">${Math.round(this.performanceMetrics.memory)}%</div>
                           <div class="text-gray-400">Memory Usage</div>
                       </div>
                   </div>
               </div>
           </div>
       `;
       
       this.showModal('System Information', content);
   }

   // Modal methods
   showModal(title, content) {
       const modalOverlay = document.getElementById('modal-overlay');
       const modalContent = document.getElementById('modal-content');

       if (modalOverlay && modalContent) {
           modalContent.innerHTML = `
               <div class="flex justify-between items-center mb-6">
                   <h3 class="text-xl font-semibold text-white">${title}</h3>
                   <button onclick="mainController.closeModal()" 
                           class="text-gray-400 hover:text-white transition-colors duration-200">
                       <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                       </svg>
                   </button>
               </div>
               <div>${content}</div>
           `;

           modalOverlay.classList.remove('hidden');
           modalOverlay.classList.add('show');
       }
   }

   closeModal() {
       const modalOverlay = document.getElementById('modal-overlay');
       if (modalOverlay) {
           modalOverlay.classList.add('hidden');
           modalOverlay.classList.remove('show');
       }
   }

   // Loading methods
   showLoadingOverlay(message) {
       const overlay = document.getElementById('loading-overlay');
       const text = document.getElementById('loading-text');
       
       if (overlay && text) {
           text.textContent = message;
           overlay.classList.remove('hidden');
       }
   }

   hideLoadingOverlay() {
       const overlay = document.getElementById('loading-overlay');
       if (overlay) {
           overlay.classList.add('hidden');
       }
   }

   // Utility methods
   formatBytes(bytes) {
       if (bytes === 0) return '0 B';
       const k = 1024;
       const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
       const i = Math.floor(Math.log(bytes) / Math.log(k));
       return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
   }

   formatTime(seconds) {
       if (seconds < 60) return `${seconds}s`;
       const minutes = Math.floor(seconds / 60);
       const remainingSeconds = seconds % 60;
       return `${minutes}m ${remainingSeconds}s`;
   }

   showNotification(message, type = 'info') {
       // Use enhanced UI controller notification if available
       if (window.uiController && typeof window.uiController.showNotification === 'function') {
           window.uiController.showNotification(message, type);
           return;
       }

       // Fallback notification
       const toast = document.createElement('div');
       const typeColors = {
           success: 'bg-green-500',
           error: 'bg-red-500',
           warning: 'bg-yellow-500',
           info: 'bg-blue-500'
       };
       
       toast.className = `toast fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm ${typeColors[type] || typeColors.info} text-white`;
       toast.textContent = message;

       document.body.appendChild(toast);

       setTimeout(() => {
           toast.classList.add('removing');
           setTimeout(() => {
               if (toast.parentNode) {
                   toast.remove();
               }
           }, 300);
       }, 3000);
   }

   updateUI() {
       // Force initial UI update
       this.updateSystemDisplay();
       this.updateNetworkDisplay();
       this.updateAttackDisplay();
   }

   // Cleanup method
   cleanup() {
       try {
           // Clear all intervals
           this.updateIntervals.forEach((interval, name) => {
               clearInterval(interval);
           });
           this.updateIntervals.clear();

           // Remove all event listeners
           this.eventListeners.forEach((unsubscribe, name) => {
               if (typeof unsubscribe === 'function') {
                   unsubscribe();
               }
           });
           this.eventListeners.clear();

           // Stop system monitoring
           if (window.electronAPI && typeof window.electronAPI.stopMonitoring === 'function') {
               window.electronAPI.stopMonitoring().catch(console.warn);
           }

           console.log('Main controller cleaned up successfully');
       } catch (error) {
           console.error('Error during cleanup:', error);
       }
   }
}

// Initialize main controller when DOM is loaded
let mainController;

document.addEventListener('DOMContentLoaded', () => {
   mainController = new MainController();
   
   // Make it globally accessible for button handlers
   window.mainController = mainController;
   
   console.log('Main Controller initialized and ready');
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
   if (mainController) {
       mainController.cleanup();
   }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
   module.exports = MainController;
}