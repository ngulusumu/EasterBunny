// Enhanced UI Controller - Handles all interface interactions and real-time data
class EnhancedUIController {
    constructor() {
        this.isInitialized = false;
        this.systemStats = {
            cpu: 0,
            memory: 0,
            attacks: 0,
            bandwidth: 0,
            peers: 1
        };
        this.activeAttacks = new Map();
        this.logs = [];
        this.maxLogs = 1000;
        this.autoScrollEnabled = true;
        this.logsPaused = false;
        this.autoRefreshEnabled = true;
        this.sidePanelOpen = false;
        this.currentPreset = null;
        this.validationStates = new Map();
        this.updateIntervals = new Map();
        this.bandwidthHistory = [];
        this.maxBandwidth = 0;
        
        this.init();
    }

    async init() {
        try {
            this.setupEventListeners();
            this.setupFileHandlers();
            this.setupRealTimeUpdates();
            this.setupValidation();
            this.loadUserPreferences();
            this.initializeSystemMonitoring();
            
            this.isInitialized = true;
            this.addLog('System initialized successfully', 'success');
            console.log('Enhanced UI Controller initialized');
        } catch (error) {
            console.error('Failed to initialize UI controller:', error);
            this.showNotification('Failed to initialize UI controller', 'error');
        }
    }

    setupEventListeners() {
        // Modal and panel handlers
        this.setupModalHandlers();
        this.setupSidePanelHandlers();
        
        // Form handlers
        this.setupFormHandlers();
        
        // Tab switching
        this.setupTabHandlers();
        
        // Quick action buttons
        this.setupQuickActionHandlers();
        
        // Advanced settings
        this.setupAdvancedSettingsHandlers();
        
        // Log controls
        this.setupLogControlHandlers();
        
        // Keyboard shortcuts
        this.setupKeyboardShortcuts();
    }

    setupModalHandlers() {
        const modalOverlay = document.getElementById('modal-overlay');
        if (modalOverlay) {
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) {
                    this.closeModal();
                }
            });
        }
    }

    setupSidePanelHandlers() {
        const advancedSettingsBtn = document.getElementById('advanced-settings-btn');
        if (advancedSettingsBtn) {
            advancedSettingsBtn.addEventListener('click', () => {
                this.toggleSidePanel();
            });
        }

        const closePanelBtn = document.getElementById('close-panel-btn');
        if (closePanelBtn) {
            closePanelBtn.addEventListener('click', () => {
                this.closeSidePanel();
            });
        }
    }

    setupFormHandlers() {
        // Single attack form
        const singleForm = document.getElementById('single-attack-form');
        if (singleForm) {
            singleForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleSingleAttack(e);
            });
        }

        // Multi attack form
        const multiForm = document.getElementById('multi-attack-form');
        if (multiForm) {
            multiForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleMultiAttack(e);
            });
        }
    }

    setupTabHandlers() {
        const activityTabs = document.querySelectorAll('.activity-tab');
        activityTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchActivityTab(tab.dataset.tab);
            });
        });
    }

    setupQuickActionHandlers() {
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

    setupAdvancedSettingsHandlers() {
        // Preset buttons
        const presetButtons = document.querySelectorAll('.preset-btn');
        presetButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.applyPreset(btn.dataset.preset);
            });
        });

        // Configuration management
        const exportConfigBtn = document.getElementById('export-config-btn');
        if (exportConfigBtn) {
            exportConfigBtn.addEventListener('click', () => {
                this.exportConfiguration();
            });
        }

        const resetConfigBtn = document.getElementById('reset-config-btn');
        if (resetConfigBtn) {
            resetConfigBtn.addEventListener('click', () => {
                this.resetConfiguration();
            });
        }

        // Proxy management
        const validateProxiesBtn = document.getElementById('validate-proxies-btn');
        if (validateProxiesBtn) {
            validateProxiesBtn.addEventListener('click', async () => {
                await this.validateProxies();
            });
        }
    }

    setupLogControlHandlers() {
        const clearLogsBtn = document.getElementById('clear-logs-btn');
        if (clearLogsBtn) {
            clearLogsBtn.addEventListener('click', () => {
                this.clearLogs();
            });
        }

        const autoScrollBtn = document.getElementById('auto-scroll-btn');
        if (autoScrollBtn) {
            autoScrollBtn.addEventListener('click', () => {
                this.toggleAutoScroll();
            });
        }

        const pauseLogsBtn = document.getElementById('pause-logs-btn');
        if (pauseLogsBtn) {
            pauseLogsBtn.addEventListener('click', () => {
                this.toggleLogsPause();
            });
        }

        const autoRefreshToggle = document.getElementById('auto-refresh');
        if (autoRefreshToggle) {
            autoRefreshToggle.addEventListener('change', () => {
                this.toggleAutoRefresh();
            });
        }
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only trigger if not in input fields
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
                return;
            }

            switch (e.key.toLowerCase()) {
                case 's':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.saveCurrentConfiguration();
                    }
                    break;
                case 'h':
                    this.showKeyboardShortcuts();
                    break;
                case ' ':
                    e.preventDefault();
                    this.toggleLogsPause();
                    break;
                case 'escape':
                    this.handleEscapeKey();
                    break;
            }
        });
    }

    setupFileHandlers() {
        // Proxy file input
        const proxyFileInput = document.getElementById('proxy-file-input');
        if (proxyFileInput) {
            proxyFileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    await this.handleProxyFileUpload(file);
                    e.target.value = ''; // Reset input
                }
            });
        }

        // Targets file input
        const targetsFileInput = document.getElementById('targets-file-input');
        if (targetsFileInput) {
            targetsFileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    await this.handleTargetFileUpload(file);
                    e.target.value = ''; // Reset input
                }
            });
        }

        // Config file input
        const configFileInput = document.getElementById('config-file-input');
        if (configFileInput) {
            configFileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    await this.handleConfigFileUpload(file);
                    e.target.value = ''; // Reset input
                }
            });
        }
    }

    setupRealTimeUpdates() {
        // Start system monitoring
        const systemUpdateInterval = setInterval(() => {
            this.updateSystemStats();
        }, 2000);
        this.updateIntervals.set('system', systemUpdateInterval);

        // Start attack monitoring
        const attackUpdateInterval = setInterval(() => {
            this.updateAttackStats();
        }, 1000);
        this.updateIntervals.set('attacks', attackUpdateInterval);

        // Start network monitoring
        const networkUpdateInterval = setInterval(() => {
            this.updateNetworkStats();
        }, 3000);
        this.updateIntervals.set('network', networkUpdateInterval);

        // Start log updates
        const logUpdateInterval = setInterval(() => {
            this.updateLogDisplay();
        }, 500);
        this.updateIntervals.set('logs', logUpdateInterval);
    }

    setupValidation() {
        // Real-time validation for inputs
        const singleTarget = document.getElementById('single-target');
        if (singleTarget) {
            singleTarget.addEventListener('input', this.debounce(() => {
                this.validateTargetInput(singleTarget);
            }, 300));
        }

        const multiTargets = document.getElementById('multi-targets');
        if (multiTargets) {
            multiTargets.addEventListener('input', this.debounce(() => {
                this.validateMultiTargets(multiTargets);
                this.updateTargetCount();
            }, 300));
        }

        // Thread count validation with system recommendations
        const threadInputs = ['single-threads', 'multi-threads'];
        threadInputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', this.debounce(() => {
                    this.validateThreadCount(input);
                }, 300));
            }
        });

        // Proxy list validation
        const proxyList = document.getElementById('proxy-list');
        if (proxyList) {
            proxyList.addEventListener('input', this.debounce(() => {
                this.updateProxyCount();
            }, 300));
        }
    }

    async initializeSystemMonitoring() {
        try {
            // Initialize system info if electronAPI is available
            if (window.electronAPI) {
                const systemResponse = await window.electronAPI.getSystemInfo();
                if (systemResponse.success) {
                    this.systemInfo = systemResponse.data;
                    this.updateSystemRecommendations();
                }
            }
        } catch (error) {
            console.warn('Could not initialize system monitoring:', error);
            // Use fallback system info
            this.systemInfo = {
                cpu: { cores: 4, model: 'Unknown' },
                memory: { total: 8000000000, available: 4000000000 }
            };
        }
    }

    // File Upload Handlers
    async handleProxyFileUpload(file) {
        try {
            this.showLoadingOverlay('Loading proxy list...');
            const content = await this.readFileContent(file);
            
            const proxies = content.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0 && !line.startsWith('#'));

            if (proxies.length === 0) {
                this.showNotification('No valid proxies found in file', 'warning');
                return;
            }

            const proxyTextarea = document.getElementById('proxy-list');
            if (proxyTextarea) {
                proxyTextarea.value = proxies.join('\n');
                this.updateProxyCount();
                this.showNotification(`Loaded ${proxies.length} proxies from ${file.name}`, 'success');
                
                // Auto-validate proxies if not too many
                if (proxies.length <= 50) {
                    await this.validateProxies();
                }
            }
        } catch (error) {
            this.showNotification(`Error loading proxy file: ${error.message}`, 'error');
        } finally {
            this.hideLoadingOverlay();
        }
    }

    async handleTargetFileUpload(file) {
        try {
            this.showLoadingOverlay('Loading target list...');
            const content = await this.readFileContent(file);
            
            const targets = content.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0 && !line.startsWith('#'));

            if (targets.length === 0) {
                this.showNotification('No valid targets found in file', 'warning');
                return;
            }

            const targetsTextarea = document.getElementById('multi-targets');
            if (targetsTextarea) {
                targetsTextarea.value = targets.join('\n');
                this.updateTargetCount();
                this.validateMultiTargets(targetsTextarea);
                this.showNotification(`Loaded ${targets.length} targets from ${file.name}`, 'success');
            }
        } catch (error) {
            this.showNotification(`Error loading target file: ${error.message}`, 'error');
        } finally {
            this.hideLoadingOverlay();
        }
    }

    async handleConfigFileUpload(file) {
        try {
            this.showLoadingOverlay('Loading configuration...');
            const content = await this.readFileContent(file);
            const config = JSON.parse(content);
            
            this.applyConfiguration(config);
            this.showNotification(`Configuration loaded from ${file.name}`, 'success');
        } catch (error) {
            this.showNotification(`Error loading configuration: ${error.message}`, 'error');
        } finally {
            this.hideLoadingOverlay();
        }
    }

    async readFileContent(file) {
        return new Promise((resolve, reject) => {
            if (file.size > 10 * 1024 * 1024) { // 10MB limit
                reject(new Error('File too large. Maximum size is 10MB.'));
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    // Attack Handlers
    async handleSingleAttack(event) {
        try {
            // Validate form inputs
            if (!this.validateAllInputs()) {
                this.highlightErrors();
                this.showNotification('Please fix validation errors before starting attack', 'error');
                return;
            }

            const target = document.getElementById('single-target').value.trim();
            const layer = document.getElementById('single-layer').value;
            const method = document.getElementById('single-method').value;
            const duration = parseInt(document.getElementById('single-duration').value);
            const threads = parseInt(document.getElementById('single-threads').value);

            const config = {
                target,
                layer,
                method,
                duration,
                threads,
                ...this.getAdvancedOptions()
            };

            this.showLoadingOverlay('Starting single target attack...');
            this.disableAttackButtons();

            // Simulate attack start (replace with actual electronAPI call)
            if (window.electronAPI) {
                const response = await window.electronAPI.startDDosAttack(config);
                this.handleAttackResponse(response, 'single');
            } else {
                // Demo mode
                await this.simulateAttackStart(config, 'single');
            }

        } catch (error) {
            this.showNotification(`Error starting attack: ${error.message}`, 'error');
        } finally {
            this.hideLoadingOverlay();
            this.enableAttackButtons();
        }
    }

    async handleMultiAttack(event) {
        try {
            if (!this.validateAllInputs()) {
                this.highlightErrors();
                this.showNotification('Please fix validation errors before starting attack', 'error');
                return;
            }

            const targets = document.getElementById('multi-targets').value
                .split('\n')
                .map(t => t.trim())
                .filter(t => t.length > 0);
            
            if (targets.length === 0) {
                this.showNotification('Please enter at least one target', 'error');
                return;
            }

            const layer = document.getElementById('multi-layer').value;
            const method = document.getElementById('multi-method').value;
            const duration = parseInt(document.getElementById('multi-duration').value);
            const threadsPerTarget = parseInt(document.getElementById('multi-threads').value);
            const rampUpTime = parseInt(document.getElementById('multi-rampup').value);

            const config = {
                targets,
                layer,
                method,
                duration,
                threadsPerTarget,
                rampUpTime,
                ...this.getAdvancedOptions()
            };

            this.showLoadingOverlay('Starting multi-target attack...');
            this.disableAttackButtons();

            if (window.electronAPI) {
                const response = await window.electronAPI.startMultiTargetAttack(config);
                this.handleAttackResponse(response, 'multi');
            } else {
                // Demo mode
                await this.simulateAttackStart(config, 'multi');
            }

        } catch (error) {
            this.showNotification(`Error starting multi-target attack: ${error.message}`, 'error');
        } finally {
            this.hideLoadingOverlay();
            this.enableAttackButtons();
        }
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

    handleAttackResponse(response, type) {
        if (response.success) {
            const targetCount = type === 'multi' ? 
                document.getElementById('multi-targets').value.split('\n').filter(t => t.trim()).length : 1;
            
            this.showNotification(
                `${type === 'single' ? 'Single' : 'Multi'} target attack started on ${targetCount} target${targetCount > 1 ? 's' : ''}`, 
                'success'
            );
            
            this.addAttackToDisplay(response.data);
            this.addLog(`Attack started: ${response.data.id}`, 'info');
        } else {
            this.showNotification(`Failed to start attack: ${response.error}`, 'error');
        }
    }

    async simulateAttackStart(config, type) {
        // Demo mode simulation
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const attackId = `demo_${Date.now()}`;
        const attackData = {
            id: attackId,
            type,
            targets: type === 'multi' ? config.targets : [config.target],
            status: 'running',
            startTime: Date.now(),
            duration: config.duration,
            threads: config.threads || config.threadsPerTarget,
            method: config.method,
            progress: 0,
            currentBandwidth: 0,
            successRate: 100
        };

        this.addAttackToDisplay(attackData);
        this.addLog(`Demo attack started: ${attackId}`, 'info');
        this.showNotification(`Demo ${type} attack started`, 'success');
    }

    // Real-time Updates
    async updateSystemStats() {
        try {
            if (window.electronAPI) {
                const response = await window.electronAPI.getPerformanceMetrics();
                if (response.success) {
                    this.updateSystemDisplay(response.data);
                }
            } else {
                // Demo mode - simulate system stats
                this.simulateSystemStats();
            }
        } catch (error) {
            console.warn('Failed to update system stats:', error);
            this.simulateSystemStats();
        }
    }

    simulateSystemStats() {
        // Generate realistic demo data
        const cpuUsage = Math.min(100, Math.max(0, 
            this.systemStats.cpu + (Math.random() - 0.5) * 10
        ));
        
        const memoryUsage = Math.min(90, Math.max(10, 
            this.systemStats.memory + (Math.random() - 0.5) * 5
        ));

        this.systemStats.cpu = cpuUsage;
        this.systemStats.memory = memoryUsage;

        this.updateSystemDisplay({
            performance: {
                cpu: { usage: cpuUsage },
                memory: { usage: memoryUsage }
            }
        });
    }

    updateSystemDisplay(data) {
        const cpuUsage = data.performance?.cpu?.usage || 0;
        const memoryUsage = data.performance?.memory?.usage || 0;

        // Update header stats
        this.updateElementText('header-cpu', Math.round(cpuUsage) + '%');
        this.updateElementText('header-memory', Math.round(memoryUsage) + '%');
        this.updateElementText('header-attacks', this.activeAttacks.size);

        // Update detailed stats
        this.updateElementText('cpu-usage', Math.round(cpuUsage) + '%');
        this.updateElementText('memory-usage', Math.round(memoryUsage) + '%');

        // Update progress bars
        this.updateProgressBar('cpu-bar', cpuUsage);
        this.updateProgressBar('memory-bar', memoryUsage);

        // Update system info if available
        if (this.systemInfo) {
            this.updateElementText('cpu-cores', this.systemInfo.cpu?.cores || 'N/A');
            this.updateElementText('cpu-load', (cpuUsage / 100).toFixed(1));
            
            const totalMemoryGB = Math.round((this.systemInfo.memory?.total || 0) / 1000000000);
            const freeMemoryGB = Math.round(totalMemoryGB * (1 - memoryUsage / 100));
            
            this.updateElementText('memory-total', totalMemoryGB + ' GB');
            this.updateElementText('memory-free', freeMemoryGB + ' GB');
        }

        // Update recommendations
        this.updateSystemRecommendations();
    }

    async updateAttackStats() {
        try {
            if (window.electronAPI) {
                const response = await window.electronAPI.getActiveAttacks();
                if (response.success) {
                    this.processActiveAttacks(response.data);
                }
            } else {
                // Demo mode - simulate attack progress
                this.simulateAttackProgress();
            }
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
                attack.currentBandwidth = Math.random() * 1000000 + 500000; // 0.5-1.5 MB/s
                attack.successRate = Math.max(85, 100 - Math.random() * 15);

                if (progress >= 100) {
                    attack.status = 'completed';
                    attack.progress = 100;
                    this.addLog(`Attack completed: ${id}`, 'success');
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
        this.updateElementText('active-attacks-count', activeCount);
        this.updateElementText('attacks-tab-count', this.activeAttacks.size);
        
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

        // Update bandwidth tracking
        this.bandwidthHistory.push(totalBandwidth);
        if (this.bandwidthHistory.length > 60) { // Keep last 60 readings (1 minute)
            this.bandwidthHistory.shift();
        }
        this.maxBandwidth = Math.max(this.maxBandwidth, totalBandwidth);

        // Update display
        this.updateElementText('total-bandwidth', this.formatBytes(totalBandwidth) + '/s');
        this.updateElementText('bandwidth-peak', 'Peak: ' + this.formatBytes(this.maxBandwidth) + '/s');
        
        const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 100;
        this.updateElementText('success-rate', Math.round(successRate) + '%');
        this.updateElementText('total-requests', totalRequests + ' requests');

        // Update attack status
        if (activeCount > 0) {
            this.updateElementText('attacks-status', `${activeCount} running`);
            document.getElementById('stop-all-btn').disabled = false;
        } else {
            this.updateElementText('attacks-status', 'Ready to start');
            document.getElementById('stop-all-btn').disabled = true;
        }

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
            <div class="attack-card" data-attack-id="${attack.id}">
                <div class="flex justify-between items-start mb-3">
                    <div class="flex-1 min-w-0">
                        <h4 class="font-semibold text-white truncate">${targetDisplay}</h4>
                        <p class="text-sm text-gray-400">${method} • ${this.formatTime(remaining)} remaining</p>
                    </div>
                    <span class="status-badge ${status} ml-2">${status}</span>
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
                        <div class="progress-bar h-2 rounded-full transition-all duration-300" style="width: ${progress}%"></div>
                    </div>
                </div>
                
                ${status === 'running' ? `
                    <button onclick="uiController.stopAttack('${attack.id}')" 
                            class="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-sm py-1.5 rounded transition-all duration-200">
                        Stop Attack
                    </button>
                ` : `
                    <button onclick="uiController.removeAttack('${attack.id}')" 
                            class="w-full bg-gray-600 hover:bg-gray-700 text-white text-sm py-1.5 rounded transition-all duration-200">
                        Remove
                    </button>
                `}
            </div>
        `;
    }

    async updateNetworkStats() {
        try {
            if (window.electronAPI) {
                const response = await window.electronAPI.getNetworkStats();
                if (response.success) {
                    this.updateNetworkDisplay(response.data);
                }
            } else {
                // Demo mode
                this.simulateNetworkStats();
            }
        } catch (error) {
            console.warn('Failed to update network stats:', error);
            this.simulateNetworkStats();
        }
    }

    simulateNetworkStats() {
        const peers = Math.floor(Math.random() * 3) + 1; // 1-3 peers
        this.updateNetworkDisplay({
            totalPeers: peers,
            status: 'online',
            activeMethods: this.activeAttacks.size
        });
    }

    updateNetworkDisplay(data) {
        const peers = data.totalPeers || 1;
        const status = data.status || 'offline';

        this.updateElementText('network-peers', peers);
        this.updateElementText('peer-status', peers === 1 ? 'Local machine' : `${peers - 1} external`);

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
    }

    updateLogDisplay() {
        if (this.logsPaused || !this.autoRefreshEnabled) return;

        const logsContainer = document.getElementById('system-logs');
        if (!logsContainer) return;

        // Add new logs
        while (this.logs.length > 0) {
            const log = this.logs.shift();
            const logElement = this.createLogElement(log);
            logsContainer.appendChild(logElement);

            // Remove old logs if too many
            while (logsContainer.children.length > this.maxLogs) {
                logsContainer.removeChild(logsContainer.firstChild);
            }
        }

        // Auto-scroll if enabled
        if (this.autoScrollEnabled) {
            logsContainer.scrollTop = logsContainer.scrollHeight;
        }

        // Update log count
        const logCount = logsContainer.children.length;
        this.updateElementText('logs-tab-count', logCount);
    }

    createLogElement(log) {
        const logElement = document.createElement('div');
        logElement.className = 'text-xs flex items-center space-x-2 py-1';
        
        const typeColors = {
            info: 'text-blue-400',
            success: 'text-green-400',
            warning: 'text-yellow-400',
            error: 'text-red-400'
        };

        logElement.innerHTML = `
            <span class="${typeColors[log.type] || 'text-gray-400'}">[${log.type.toUpperCase()}]</span>
            <span class="text-gray-500">${log.timestamp}</span>
            <span class="text-gray-300">${log.message}</span>
        `;

        return logElement;
    }

    // Validation Methods
    validateAllInputs() {
        let isValid = true;
        
        // Validate single target if filled
        const singleTarget = document.getElementById('single-target');
        if (singleTarget && singleTarget.value.trim()) {
            this.validateTargetInput(singleTarget);
            const validation = this.validationStates.get(singleTarget.id);
            if (validation && validation.state === 'error') {
                isValid = false;
            }
        }

        // Validate multi targets if filled
        const multiTargets = document.getElementById('multi-targets');
        if (multiTargets && multiTargets.value.trim()) {
            this.validateMultiTargets(multiTargets);
            const validation = this.validationStates.get(multiTargets.id);
            if (validation && validation.state === 'error') {
                isValid = false;
            }
        }

        // Validate thread counts
        ['single-threads', 'multi-threads'].forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                this.validateThreadCount(input);
                const validation = this.validationStates.get(id);
                if (validation && validation.state === 'error') {
                    isValid = false;
                }
            }
        });

        return isValid;
    }

    validateTargetInput(input) {
        const target = input.value.trim();
        if (!target) {
            this.setValidationState(input, 'neutral');
            return;
        }

        // Basic validation for domain:port or IP:port format
        const pattern = /^([a-zA-Z0-9.-]+|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d+)$/;
        
        if (pattern.test(target)) {
            const port = parseInt(target.split(':')[1]);
            if (port >= 1 && port <= 65535) {
                this.setValidationState(input, 'success', 'Valid target format');
            } else {
                this.setValidationState(input, 'error', 'Port must be between 1 and 65535');
            }
        } else {
            this.setValidationState(input, 'error', 'Use format: domain:port or IP:port');
        }
    }

    validateMultiTargets(textarea) {
        const targets = textarea.value.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        if (targets.length === 0) {
            this.setValidationState(textarea, 'neutral');
            return;
        }

        let validCount = 0;
        let invalidCount = 0;
        const pattern = /^([a-zA-Z0-9.-]+|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d+)$/;

        targets.forEach(target => {
            if (pattern.test(target)) {
                const port = parseInt(target.split(':')[1]);
                if (port >= 1 && port <= 65535) {
                    validCount++;
                } else {
                    invalidCount++;
                }
            } else {
                invalidCount++;
            }
        });

        if (invalidCount === 0) {
            this.setValidationState(textarea, 'success', `${validCount} valid targets`);
        } else if (validCount === 0) {
            this.setValidationState(textarea, 'error', `All ${invalidCount} targets are invalid`);
        } else {
            this.setValidationState(textarea, 'warning', `${validCount} valid, ${invalidCount} invalid targets`);
        }
    }

    validateThreadCount(input) {
        const value = parseInt(input.value);
        const min = parseInt(input.min);
        const max = parseInt(input.max);

        if (isNaN(value) || value < min || value > max) {
            this.setValidationState(input, 'error', `Must be between ${min} and ${max}`);
            return;
        }

        // System-based recommendations
        if (this.systemInfo) {
            const cores = this.systemInfo.cpu?.cores || 4;
            const optimalThreads = cores * 8;
            
            if (value > optimalThreads * 1.5) {
                this.setValidationState(input, 'warning', `High thread count. Recommended: ${optimalThreads}`);
            } else if (value <= optimalThreads) {
                this.setValidationState(input, 'success', 'Optimal thread count');
            } else {
                this.setValidationState(input, 'success');
            }
        } else {
            this.setValidationState(input, 'success');
        }
   }

   setValidationState(element, state, message = '') {
       // Remove existing validation classes
       element.classList.remove('form-input-error', 'form-input-success', 'form-input-warning');

       // Add new validation class
       if (state === 'error') {
           element.classList.add('form-input-error');
       } else if (state === 'success') {
           element.classList.add('form-input-success');
       } else if (state === 'warning') {
           element.classList.add('form-input-warning');
       }

       // Store validation state
       this.validationStates.set(element.id, { state, message });

       // Update validation message
       this.updateValidationMessage(element, message, state);
   }

   updateValidationMessage(element, message, state) {
       let messageEl = element.parentNode.querySelector('.validation-message');
       
       if (message) {
           if (!messageEl) {
               messageEl = document.createElement('div');
               messageEl.className = 'validation-message';
               element.parentNode.appendChild(messageEl);
           }
           messageEl.textContent = message;
           messageEl.className = `validation-message ${state}`;
       } else if (messageEl) {
           messageEl.remove();
       }
   }

   highlightErrors() {
       this.validationStates.forEach((validation, elementId) => {
           if (validation.state === 'error') {
               const element = document.getElementById(elementId);
               if (element) {
                   element.classList.add('error-shake');
                   setTimeout(() => {
                       element.classList.remove('error-shake');
                   }, 500);
               }
           }
       });
   }

   // Proxy Management
   async validateProxies() {
       const proxyList = document.getElementById('proxy-list').value;
       if (!proxyList.trim()) {
           this.showNotification('No proxies to validate', 'warning');
           return;
       }

       const proxies = proxyList.split('\n')
           .map(line => line.trim())
           .filter(line => line.length > 0);

       try {
           this.showLoadingOverlay('Validating proxies...');
           this.updateLoadingProgress(0, 'Starting proxy validation...');

           if (window.electronAPI) {
               const response = await window.electronAPI.validateProxies(proxies);
               if (response.success) {
                   this.showProxyValidationResults(response.data.valid, response.data.invalid);
               } else {
                   this.showNotification(`Proxy validation failed: ${response.error}`, 'error');
               }
           } else {
               // Demo mode - simulate proxy validation
               await this.simulateProxyValidation(proxies);
           }
       } catch (error) {
           this.showNotification(`Error validating proxies: ${error.message}`, 'error');
       } finally {
           this.hideLoadingOverlay();
       }
   }

   async simulateProxyValidation(proxies) {
       const valid = [];
       const invalid = [];

       for (let i = 0; i < proxies.length; i++) {
           const proxy = proxies[i];
           const progress = ((i + 1) / proxies.length) * 100;
           
           this.updateLoadingProgress(progress, `Validating proxy ${i + 1} of ${proxies.length}...`);
           
           // Simulate validation delay
           await new Promise(resolve => setTimeout(resolve, 100));
           
           // Randomly mark some as invalid (realistic simulation)
           if (Math.random() > 0.2) { // 80% success rate
               valid.push(proxy);
           } else {
               invalid.push(proxy);
           }
       }

       this.showProxyValidationResults(valid, invalid);
   }

   showProxyValidationResults(valid, invalid) {
       const total = valid.length + invalid.length;
       const validPercentage = total > 0 ? Math.round((valid.length / total) * 100) : 0;

       let message = `Proxy validation complete: ${valid.length}/${total} (${validPercentage}%) valid`;
       let type = validPercentage > 70 ? 'success' : validPercentage > 30 ? 'warning' : 'error';

       this.showNotification(message, type);
       this.addLog(`Proxy validation: ${valid.length} valid, ${invalid.length} invalid`, 'info');

       // Update proxy status
       document.getElementById('proxy-status').textContent = 
           `${validPercentage}% valid (${valid.length}/${total})`;

       // Show detailed results in modal
       this.showModal('Proxy Validation Results', this.createProxyValidationContent(valid, invalid));
   }

   createProxyValidationContent(valid, invalid) {
       return `
           <div class="space-y-6">
               <div class="grid grid-cols-2 gap-4">
                   <div class="bg-green-500/20 rounded-lg p-4">
                       <h4 class="font-semibold text-green-400 mb-2">Valid Proxies</h4>
                       <p class="text-3xl font-bold text-white">${valid.length}</p>
                       <p class="text-sm text-green-300">Ready to use</p>
                   </div>
                   <div class="bg-red-500/20 rounded-lg p-4">
                       <h4 class="font-semibold text-red-400 mb-2">Invalid Proxies</h4>
                       <p class="text-3xl font-bold text-white">${invalid.length}</p>
                       <p class="text-sm text-red-300">Connection failed</p>
                   </div>
               </div>
               
               ${invalid.length > 0 ? `
                   <div>
                       <h4 class="font-semibold text-white mb-3">Invalid Proxies:</h4>
                       <div class="bg-gray-800/50 rounded-lg p-3 max-h-48 overflow-y-auto">
                           ${invalid.map(proxy => `
                               <div class="text-red-400 text-sm font-mono py-1">${proxy}</div>
                           `).join('')}
                       </div>
                   </div>
               ` : ''}
               
               <div class="flex space-x-3">
                   <button onclick="uiController.updateProxyListWithValid(${JSON.stringify(valid).replace(/"/g, '&quot;')})" 
                           class="flex-1 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                       Use Valid Proxies Only
                   </button>
                   <button onclick="uiController.closeModal()" 
                           class="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                       Keep All
                   </button>
               </div>
           </div>
       `;
   }

   updateProxyListWithValid(validProxies) {
       document.getElementById('proxy-list').value = validProxies.join('\n');
       this.updateProxyCount();
       this.closeModal();
       this.showNotification(`Updated to ${validProxies.length} valid proxies`, 'success');
   }

   // Configuration Management
   applyPreset(presetName) {
       const presets = {
           light: {
               threads: 10,
               duration: 30,
               method: 'GET',
               useProxies: false,
               adaptiveScaling: true,
               payloadSize: 512,
               requestTimeout: 3000
           },
           medium: {
               threads: 50,
               duration: 60,
               method: 'GET',
               useProxies: true,
               adaptiveScaling: true,
               payloadSize: 1024,
               requestTimeout: 5000
           },
           heavy: {
               threads: 100,
               duration: 120,
               method: 'POST',
               useProxies: true,
               adaptiveScaling: false,
               payloadSize: 2048,
               requestTimeout: 8000
           }
       };

       const preset = presets[presetName];
       if (!preset) return;

       // Apply to both single and multi attack forms
       this.setInputValue('single-threads', preset.threads);
       this.setInputValue('single-duration', preset.duration);
       this.setSelectValue('single-method', preset.method);

       this.setInputValue('multi-threads', Math.floor(preset.threads / 2));
       this.setInputValue('multi-duration', preset.duration);
       this.setSelectValue('multi-method', preset.method);

       // Apply advanced settings
       this.setCheckboxValue('use-proxies', preset.useProxies);
       this.setCheckboxValue('adaptive-scaling', preset.adaptiveScaling);
       this.setInputValue('payload-size', preset.payloadSize);
       this.setInputValue('request-timeout', preset.requestTimeout);

       this.currentPreset = presetName;
       this.showNotification(`Applied ${presetName} preset`, 'success');
       this.addLog(`Preset applied: ${presetName}`, 'info');

       // Update preset button states
       document.querySelectorAll('.preset-btn').forEach(btn => {
           btn.classList.toggle('bg-primary-500/20', btn.dataset.preset === presetName);
       });

       // Re-validate inputs
       this.validateAllInputs();
   }

   exportConfiguration() {
       const config = this.getCurrentConfiguration();
       const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
       const url = URL.createObjectURL(blob);
       
       const a = document.createElement('a');
       a.href = url;
       a.download = `ngulusumu-config-${new Date().toISOString().split('T')[0]}.json`;
       document.body.appendChild(a);
       a.click();
       document.body.removeChild(a);
       URL.revokeObjectURL(url);

       this.showNotification('Configuration exported successfully', 'success');
       this.addLog('Configuration exported', 'info');
   }

   getCurrentConfiguration() {
       return {
           version: '2.1',
           timestamp: new Date().toISOString(),
           singleTarget: this.getInputValue('single-target'),
           singleLayer: this.getSelectValue('single-layer'),
           singleMethod: this.getSelectValue('single-method'),
           singleDuration: this.getInputValue('single-duration'),
           singleThreads: this.getInputValue('single-threads'),
           multiTargets: this.getTextareaValue('multi-targets'),
           multiLayer: this.getSelectValue('multi-layer'),
           multiMethod: this.getSelectValue('multi-method'),
           multiDuration: this.getInputValue('multi-duration'),
           multiThreads: this.getInputValue('multi-threads'),
           multiRampup: this.getInputValue('multi-rampup'),
           useProxies: this.getCheckboxValue('use-proxies'),
           rateLimitBypass: this.getCheckboxValue('rate-limit-bypass'),
           keepAlive: this.getCheckboxValue('keep-alive'),
           adaptiveScaling: this.getCheckboxValue('adaptive-scaling'),
           payloadSize: this.getInputValue('payload-size'),
           requestTimeout: this.getInputValue('request-timeout'),
           proxyList: this.getTextareaValue('proxy-list'),
           proxyRotation: this.getSelectValue('proxy-rotation'),
           preset: this.currentPreset
       };
   }

   applyConfiguration(config) {
       try {
           // Apply single attack settings
           this.setInputValue('single-target', config.singleTarget);
           this.setSelectValue('single-layer', config.singleLayer);
           this.setSelectValue('single-method', config.singleMethod);
           this.setInputValue('single-duration', config.singleDuration);
           this.setInputValue('single-threads', config.singleThreads);

           // Apply multi attack settings
           this.setTextareaValue('multi-targets', config.multiTargets);
           this.setSelectValue('multi-layer', config.multiLayer);
           this.setSelectValue('multi-method', config.multiMethod);
           this.setInputValue('multi-duration', config.multiDuration);
           this.setInputValue('multi-threads', config.multiThreads);
           this.setInputValue('multi-rampup', config.multiRampup);

           // Apply advanced settings
           this.setCheckboxValue('use-proxies', config.useProxies);
           this.setCheckboxValue('rate-limit-bypass', config.rateLimitBypass);
           this.setCheckboxValue('keep-alive', config.keepAlive);
           this.setCheckboxValue('adaptive-scaling', config.adaptiveScaling);
           this.setInputValue('payload-size', config.payloadSize);
           this.setInputValue('request-timeout', config.requestTimeout);

           // Apply proxy settings
           this.setTextareaValue('proxy-list', config.proxyList);
           this.setSelectValue('proxy-rotation', config.proxyRotation);

           // Update counts and validation
           this.updateTargetCount();
           this.updateProxyCount();
           this.validateAllInputs();

           // Apply preset if available
           if (config.preset) {
               this.currentPreset = config.preset;
               document.querySelectorAll('.preset-btn').forEach(btn => {
                   btn.classList.toggle('bg-primary-500/20', btn.dataset.preset === config.preset);
               });
           }

           this.addLog('Configuration applied successfully', 'success');
       } catch (error) {
           this.showNotification(`Error applying configuration: ${error.message}`, 'error');
       }
   }

   resetConfiguration() {
       if (confirm('Are you sure you want to reset all settings to defaults? This action cannot be undone.')) {
           // Reset all forms
           document.getElementById('single-attack-form')?.reset();
           document.getElementById('multi-attack-form')?.reset();
           
           // Reset advanced settings to defaults
           this.setCheckboxValue('adaptive-scaling', true);
           this.setInputValue('payload-size', 1024);
           this.setInputValue('request-timeout', 5000);
           this.setSelectValue('proxy-rotation', 'round-robin');
           
           // Clear lists
           this.setTextareaValue('proxy-list', '');
           this.setTextareaValue('multi-targets', '');
           this.setInputValue('single-target', '');
           
           // Clear validation states
           this.validationStates.clear();
           document.querySelectorAll('.form-input-error, .form-input-success, .form-input-warning').forEach(element => {
               element.classList.remove('form-input-error', 'form-input-success', 'form-input-warning');
           });
           document.querySelectorAll('.validation-message').forEach(element => {
               element.remove();
           });

           // Reset preset selection
           this.currentPreset = null;
           document.querySelectorAll('.preset-btn').forEach(btn => {
               btn.classList.remove('bg-primary-500/20');
           });

           // Update counts
           this.updateTargetCount();
           this.updateProxyCount();

           this.showNotification('Configuration reset to defaults', 'info');
           this.addLog('Configuration reset', 'info');
       }
   }

   // Attack Management
   async stopAttack(attackId) {
       try {
           if (window.electronAPI) {
               const response = await window.electronAPI.stopAttack(attackId);
               if (response.success) {
                   this.showNotification('Attack stopped successfully', 'success');
               } else {
                   this.showNotification(`Failed to stop attack: ${response.error}`, 'error');
               }
           } else {
               // Demo mode
               const attack = this.activeAttacks.get(attackId);
               if (attack) {
                   attack.status = 'stopped';
                   attack.progress = Math.min(100, attack.progress);
                   this.showNotification('Demo attack stopped', 'success');
               }
           }
           this.addLog(`Attack stopped: ${attackId}`, 'info');
       } catch (error) {
           this.showNotification(`Error stopping attack: ${error.message}`, 'error');
       }
   }

   removeAttack(attackId) {
       this.activeAttacks.delete(attackId);
       this.updateAttackDisplay();
       this.addLog(`Attack removed: ${attackId}`, 'info');
   }

   async handleStopAllAttacks() {
       const runningAttacks = Array.from(this.activeAttacks.values())
           .filter(attack => attack.status === 'running');

       if (runningAttacks.length === 0) {
           this.showNotification('No active attacks to stop', 'warning');
           return;
       }

       try {
           this.showLoadingOverlay('Stopping all attacks...');
           
           if (window.electronAPI) {
               const response = await window.electronAPI.stopAllAttacks();
               if (response.success) {
                   this.showNotification(`Stopped ${runningAttacks.length} attacks`, 'success');
               } else {
                   this.showNotification(`Failed to stop attacks: ${response.error}`, 'error');
               }
           } else {
               // Demo mode
               runningAttacks.forEach(attack => {
                   attack.status = 'stopped';
               });
               this.showNotification(`Stopped ${runningAttacks.length} demo attacks`, 'success');
           }
           
           this.addLog(`All attacks stopped (${runningAttacks.length})`, 'info');
       } catch (error) {
           this.showNotification(`Error stopping attacks: ${error.message}`, 'error');
       } finally {
           this.hideLoadingOverlay();
       }
   }

   addAttackToDisplay(attackData) {
       this.activeAttacks.set(attackData.id, attackData);
       this.updateAttackDisplay();
       this.addLog(`Attack added: ${attackData.id}`, 'info');
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

       this.addLog(`Switched to ${tabName} tab`, 'info');
   }

   toggleSidePanel() {
       const sidePanel = document.getElementById('side-panel');
       if (sidePanel) {
           const isOpen = !sidePanel.classList.contains('translate-x-full');
           if (isOpen) {
               this.closeSidePanel();
           } else {
               this.openSidePanel();
           }
       }
   }

   openSidePanel() {
       const sidePanel = document.getElementById('side-panel');
       if (sidePanel) {
           sidePanel.classList.remove('translate-x-full');
           this.sidePanelOpen = true;
           this.addLog('Advanced settings panel opened', 'info');
       }
   }

   closeSidePanel() {
       const sidePanel = document.getElementById('side-panel');
       if (sidePanel) {
           sidePanel.classList.add('translate-x-full');
           this.sidePanelOpen = false;
           this.addLog('Advanced settings panel closed', 'info');
       }
   }

   // Modal Methods
   showModal(title, content) {
       const modalOverlay = document.getElementById('modal-overlay');
       const modalContent = document.getElementById('modal-content');

       if (modalOverlay && modalContent) {
           modalContent.innerHTML = `
               <div class="flex justify-between items-center mb-6">
                   <h3 class="text-xl font-semibold text-white">${title}</h3>
                   <button onclick="uiController.closeModal()" 
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

   // Loading Methods
   showLoadingOverlay(message) {
       const overlay = document.getElementById('loading-overlay');
       const text = document.getElementById('loading-text');
       const progress = document.getElementById('loading-progress');
       const percentage = document.getElementById('loading-percentage');
       
       if (overlay && text) {
           text.textContent = message;
           overlay.classList.remove('hidden');
           
           if (progress) progress.style.width = '0%';
           if (percentage) percentage.textContent = '0%';
       }
   }

   hideLoadingOverlay() {
       const overlay = document.getElementById('loading-overlay');
       if (overlay) {
           overlay.classList.add('hidden');
       }
   }

   updateLoadingProgress(percentage, message = null) {
       const progress = document.getElementById('loading-progress');
       const text = document.getElementById('loading-text');
       const percentageElement = document.getElementById('loading-percentage');
       
       if (progress) {
           progress.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
       }
       
       if (percentageElement) {
           percentageElement.textContent = `${Math.round(percentage)}%`;
       }
       
       if (text && message) {
           text.textContent = message;
       }
   }

   // Log Methods
   addLog(message, type = 'info') {
       const timestamp = new Date().toLocaleTimeString();
       this.logs.push({ message, type, timestamp });
       
       // Limit log storage
       if (this.logs.length > this.maxLogs) {
           this.logs.shift();
       }
   }

   clearLogs() {
       this.logs.length = 0;
       const logsContainer = document.getElementById('system-logs');
       if (logsContainer) {
           logsContainer.innerHTML = '<div class="text-gray-400 text-xs">Logs cleared</div>';
       }
       this.updateElementText('logs-tab-count', 0);
       this.addLog('Logs cleared', 'info');
   }

   toggleAutoScroll() {
       this.autoScrollEnabled = !this.autoScrollEnabled;
       const btn = document.getElementById('auto-scroll-btn');
       if (btn) {
           btn.classList.toggle('text-primary-400', this.autoScrollEnabled);
           btn.classList.toggle('text-gray-400', !this.autoScrollEnabled);
       }
       this.addLog(`Auto-scroll ${this.autoScrollEnabled ? 'enabled' : 'disabled'}`, 'info');
   }

   toggleLogsPause() {
       this.logsPaused = !this.logsPaused;
       const btn = document.getElementById('pause-logs-btn');
       if (btn) {
           const icon = btn.querySelector('svg');
           if (this.logsPaused) {
               // Change to play icon
               icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h6m-6 0v6m6-6v6"/>`;
               btn.classList.add('text-yellow-400');
               btn.classList.remove('text-gray-400');
           } else {
               // Change to pause icon
               icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"/>`;
               btn.classList.remove('text-yellow-400');
               btn.classList.add('text-gray-400');
           }
       }
       this.addLog(`Logs ${this.logsPaused ? 'paused' : 'resumed'}`, 'info');
   }

   toggleAutoRefresh() {
       this.autoRefreshEnabled = !this.autoRefreshEnabled;
       this.addLog(`Auto-refresh ${this.autoRefreshEnabled ? 'enabled' : 'disabled'}`, 'info');
   }

   // System Recommendations
   updateSystemRecommendations() {
       const container = document.getElementById('recommendations');
       if (!container) return;

       const recommendations = [];
       const cpuUsage = this.systemStats.cpu || 0;
       const memoryUsage = this.systemStats.memory || 0;
       const activeAttacks = this.activeAttacks.size;

       if (cpuUsage > 85) {
           recommendations.push({
               type: 'warning',
               message: 'High CPU usage - consider reducing thread counts'
           });
       }

       if (memoryUsage > 80) {
           recommendations.push({
               type: 'warning',
               message: 'High memory usage - limit concurrent attacks'
           });
       }

       if (activeAttacks > 5) {
           recommendations.push({
               type: 'warning',
               message: 'Many active attacks - monitor system resources'
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

   // Quick Action Handlers
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
               <div class="text-sm text-gray-500">
                   <p>• View past attack statistics</p>
                   <p>• Export historical data</p>
                   <p>• Analyze performance trends</p>
               </div>
           </div>
       `;
       this.showModal('Attack History', historyContent);
   }

   async handleExportData() {
       try {
           this.showLoadingOverlay('Exporting data...');
           
           if (window.electronAPI) {
               const response = await window.electronAPI.exportNetworkData();
               if (response.success) {
                   this.showNotification('Data exported successfully', 'success');
               } else {
                   this.showNotification(`Export failed: ${response.error}`, 'error');
               }
           } else {
               // Demo mode - simulate export
               await new Promise(resolve => setTimeout(resolve, 1000));
               
               const exportData = {
                   timestamp: new Date().toISOString(),
                   systemStats: this.systemStats,
                   activeAttacks: Array.from(this.activeAttacks.values()),
                   logs: this.logs.slice(-100), // Last 100 logs
                   configuration: this.getCurrentConfiguration()
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
               
               this.showNotification('Demo data exported successfully', 'success');
           }
           
           this.addLog('Data exported', 'info');
       } catch (error) {
           this.showNotification(`Error exporting data: ${error.message}`, 'error');
       } finally {
           this.hideLoadingOverlay();
       }
   }

   showSystemInfoModal() {
       const systemInfo = this.systemInfo || {
           cpu: { cores: 'Unknown', model: 'Unknown' },
           memory: { total: 0, available: 0 },
           platform: 'Unknown'
       };

       const content = `
           <div class="space-y-6">
               <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div class="bg-gray-800/50 rounded-lg p-4">
                       <h4 class="font-semibold text-white mb-2">CPU Information</h4>
                       <div class="space-y-1 text-sm">
                           <div class="flex justify-between">
                               <span class="text-gray-400">Cores:</span>
                               <span class="text-white">${systemInfo.cpu.cores}</span>
                           </div>
                           <div class="flex justify-between">
                               <span class="text-gray-400">Model:</span>
                               <span class="text-white">${systemInfo.cpu.model || 'Unknown'}</span>
                           </div>
                           <div class="flex justify-between">
                               <span class="text-gray-400">Usage:</span>
                               <span class="text-white">${Math.round(this.systemStats.cpu)}%</span>
                           </div>
                       </div>
                   </div>
                   
                   <div class="bg-gray-800/50 rounded-lg p-4">
                       <h4 class="font-semibold text-white mb-2">Memory Information</h4>
                       <div class="space-y-1 text-sm">
                       <div class="flex justify-between">
                               <span class="text-gray-400">Total:</span>
                               <span class="text-white">${this.formatBytes(systemInfo.memory.total)}</span>
                           </div>
                           <div class="flex justify-between">
                               <span class="text-gray-400">Available:</span>
                               <span class="text-white">${this.formatBytes(systemInfo.memory.available)}</span>
                           </div>
                           <div class="flex justify-between">
                               <span class="text-gray-400">Usage:</span>
                               <span class="text-white">${Math.round(this.systemStats.memory)}%</span>
                           </div>
                       </div>
                   </div>
               </div>
               
               <div class="bg-gray-800/50 rounded-lg p-4">
                   <h4 class="font-semibold text-white mb-3">Performance Statistics</h4>
                   <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                       <div class="text-center">
                           <div class="text-2xl font-bold text-primary-400">${this.activeAttacks.size}</div>
                           <div class="text-gray-400">Active Attacks</div>
                       </div>
                       <div class="text-center">
                           <div class="text-2xl font-bold text-success-400">${this.formatBytes(this.maxBandwidth)}/s</div>
                           <div class="text-gray-400">Peak Bandwidth</div>
                       </div>
                       <div class="text-center">
                           <div class="text-2xl font-bold text-yellow-400">${this.logs.length}</div>
                           <div class="text-gray-400">Log Entries</div>
                       </div>
                       <div class="text-center">
                           <div class="text-2xl font-bold text-purple-400">${Math.floor((Date.now() - (window.startTime || Date.now())) / 1000)}s</div>
                           <div class="text-gray-400">Uptime</div>
                       </div>
                   </div>
               </div>
               
               <div class="bg-gray-800/50 rounded-lg p-4">
                   <h4 class="font-semibold text-white mb-3">Optimization Recommendations</h4>
                   <div class="space-y-2 text-sm">
                       ${this.generateOptimizationRecommendations().map(rec => `
                           <div class="flex items-start space-x-2">
                               <div class="w-2 h-2 ${rec.type === 'good' ? 'bg-green-400' : rec.type === 'warning' ? 'bg-yellow-400' : 'bg-red-400'} rounded-full mt-2"></div>
                               <span class="text-gray-300">${rec.message}</span>
                           </div>
                       `).join('')}
                   </div>
               </div>
           </div>
       `;
       
       this.showModal('System Information', content);
   }

   generateOptimizationRecommendations() {
       const recommendations = [];
       const cpuUsage = this.systemStats.cpu;
       const memoryUsage = this.systemStats.memory;
       const cores = this.systemInfo?.cpu?.cores || 4;
       
       if (cpuUsage < 50) {
           recommendations.push({
               type: 'good',
               message: 'CPU usage is optimal - you can increase thread counts for better performance'
           });
       } else if (cpuUsage > 80) {
           recommendations.push({
               type: 'warning',
               message: 'High CPU usage detected - consider reducing concurrent attacks'
           });
       }
       
       if (memoryUsage < 60) {
           recommendations.push({
               type: 'good',
               message: 'Memory usage is healthy - system can handle more concurrent operations'
           });
       } else if (memoryUsage > 85) {
           recommendations.push({
               type: 'critical',
               message: 'Critical memory usage - reduce attack intensity to prevent system instability'
           });
       }
       
       const optimalThreads = cores * 8;
       recommendations.push({
           type: 'good',
           message: `Recommended max threads for your ${cores}-core system: ${optimalThreads}`
       });
       
       if (this.activeAttacks.size > 3) {
           recommendations.push({
               type: 'warning',
               message: 'Multiple concurrent attacks detected - monitor system resources closely'
           });
       }
       
       return recommendations;
   }

   showKeyboardShortcuts() {
       const shortcuts = [
           { key: 'Ctrl+S', description: 'Save current configuration' },
           { key: 'Ctrl+O', description: 'Import configuration file' },
           { key: 'Space', description: 'Pause/Resume logs' },
           { key: 'H', description: 'Show keyboard shortcuts' },
           { key: 'Escape', description: 'Close modal/panel' }
       ];

       const content = `
           <div class="space-y-4">
               <div class="grid gap-3">
                   ${shortcuts.map(shortcut => `
                       <div class="flex justify-between items-center py-2 px-3 bg-gray-800/50 rounded-lg">
                           <span class="font-mono text-primary-400">${shortcut.key}</span>
                           <span class="text-gray-300">${shortcut.description}</span>
                       </div>
                   `).join('')}
               </div>
               <div class="text-sm text-gray-400 bg-gray-800/30 rounded-lg p-3">
                   <p><strong>Note:</strong> Shortcuts work when not focused on input fields.</p>
                   <p class="mt-1">Additional features:</p>
                   <ul class="list-disc list-inside mt-1 space-y-1">
                       <li>Drag and drop files onto target/proxy text areas</li>
                       <li>Real-time validation with color-coded feedback</li>
                       <li>Auto-save configuration every 30 seconds</li>
                       <li>System performance monitoring and recommendations</li>
                   </ul>
               </div>
           </div>
       `;

       this.showModal('Keyboard Shortcuts & Features', content);
   }

   handleEscapeKey() {
       const modal = document.getElementById('modal-overlay');
       const sidePanel = document.getElementById('side-panel');
       
       if (modal && !modal.classList.contains('hidden')) {
           this.closeModal();
       } else if (sidePanel && !sidePanel.classList.contains('translate-x-full')) {
           this.closeSidePanel();
       }
   }

   // Button State Management
   disableAttackButtons() {
       const singleBtn = document.getElementById('single-attack-btn');
       const multiBtn = document.getElementById('multi-attack-btn');
       
       if (singleBtn) {
           singleBtn.disabled = true;
           singleBtn.innerHTML = `
               <span class="flex items-center justify-center space-x-2">
                   <div class="spinner w-4 h-4"></div>
                   <span>Starting Attack...</span>
               </span>
           `;
       }
       
       if (multiBtn) {
           multiBtn.disabled = true;
           multiBtn.innerHTML = `
               <span class="flex items-center justify-center space-x-2">
                   <div class="spinner w-4 h-4"></div>
                   <span>Starting Attack...</span>
               </span>
           `;
       }
   }

   enableAttackButtons() {
       const singleBtn = document.getElementById('single-attack-btn');
       const multiBtn = document.getElementById('multi-attack-btn');
       
       if (singleBtn) {
           singleBtn.disabled = false;
           singleBtn.innerHTML = `
               <span class="flex items-center justify-center space-x-2">
                   <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                   </svg>
                   <span>Start Single Attack</span>
               </span>
           `;
       }
       
       if (multiBtn) {
           multiBtn.disabled = false;
           multiBtn.innerHTML = `
               <span class="flex items-center justify-center space-x-2">
                   <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                   </svg>
                   <span>Start Multi-Target Attack</span>
               </span>
           `;
       }
   }

   // Utility Methods
   updateTargetCount() {
       const textarea = document.getElementById('multi-targets');
       const countSpan = document.getElementById('target-count');
       
       if (textarea && countSpan) {
           const targets = textarea.value.split('\n')
               .map(line => line.trim())
               .filter(line => line.length > 0);
           countSpan.textContent = `${targets.length} targets`;
       }
   }

   updateProxyCount() {
       const textarea = document.getElementById('proxy-list');
       const countSpan = document.getElementById('proxy-count');
       
       if (textarea && countSpan) {
           const proxies = textarea.value.split('\n')
               .map(line => line.trim())
               .filter(line => line.length > 0);
           countSpan.textContent = `${proxies.length} proxies`;
       }
   }

   updateElementText(elementId, text) {
       const element = document.getElementById(elementId);
       if (element) {
           element.textContent = text;
       }
   }

   updateProgressBar(elementId, percentage) {
       const element = document.getElementById(elementId);
       if (element) {
           element.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
       }
   }

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

   debounce(func, wait) {
       let timeout;
       return function executedFunction(...args) {
           const later = () => {
               clearTimeout(timeout);
               func(...args);
           };
           clearTimeout(timeout);
           timeout = setTimeout(later, wait);
       };
   }

   // Form Utility Methods
   getInputValue(id) {
       const element = document.getElementById(id);
       return element ? element.value : '';
   }

   setInputValue(id, value) {
       const element = document.getElementById(id);
       if (element && value !== undefined && value !== null) {
           element.value = value;
       }
   }

   getSelectValue(id) {
       const element = document.getElementById(id);
       return element ? element.value : '';
   }

   setSelectValue(id, value) {
       const element = document.getElementById(id);
       if (element && value !== undefined && value !== null) {
           element.value = value;
       }
   }

   getCheckboxValue(id) {
       const element = document.getElementById(id);
       return element ? element.checked : false;
   }

   setCheckboxValue(id, value) {
       const element = document.getElementById(id);
       if (element && value !== undefined && value !== null) {
           element.checked = Boolean(value);
       }
   }

   getTextareaValue(id) {
       const element = document.getElementById(id);
       return element ? element.value : '';
   }

   setTextareaValue(id, value) {
       const element = document.getElementById(id);
       if (element && value !== undefined && value !== null) {
           element.value = value;
       }
   }

   // Notification System
   showNotification(message, type = 'info', duration = 4000) {
       const container = document.getElementById('toast-container') || this.createToastContainer();
       
       const toast = document.createElement('div');
       toast.className = `toast p-4 rounded-lg shadow-lg max-w-sm text-white transition-all duration-300 transform translate-x-full`;
       
       // Set color based on type
       const typeColors = {
           success: 'bg-green-500',
           error: 'bg-red-500',
           warning: 'bg-yellow-500',
           info: 'bg-blue-500'
       };
       
       toast.classList.add(typeColors[type] || typeColors.info);

       toast.innerHTML = `
           <div class="flex items-center space-x-3">
               <div class="flex-shrink-0">
                   ${this.getNotificationIcon(type)}
               </div>
               <div class="flex-1">
                   <p class="text-sm font-medium">${message}</p>
               </div>
               <button onclick="this.parentElement.parentElement.remove()" 
                       class="flex-shrink-0 text-white/80 hover:text-white transition-colors">
                   <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                   </svg>
               </button>
           </div>
       `;

       container.appendChild(toast);

       // Animate in
       requestAnimationFrame(() => {
           toast.classList.remove('translate-x-full');
       });

       // Auto remove
       setTimeout(() => {
           toast.classList.add('translate-x-full');
           setTimeout(() => {
               if (toast.parentNode) {
                   toast.remove();
               }
           }, 300);
       }, duration);
   }

   createToastContainer() {
       const container = document.createElement('div');
       container.id = 'toast-container';
       container.className = 'fixed top-4 right-4 z-50 space-y-3';
       document.body.appendChild(container);
       return container;
   }

   getNotificationIcon(type) {
       const icons = {
           success: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
           </svg>`,
           error: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
           </svg>`,
           warning: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/>
           </svg>`,
           info: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
           </svg>`
       };
       
       return icons[type] || icons.info;
   }

   // User Preferences
   loadUserPreferences() {
       try {
           const preferences = JSON.parse(localStorage.getItem('ngulusumu-enhanced-preferences') || '{}');
           
           // Apply saved preferences
           if (preferences.autoScroll !== undefined) {
               this.autoScrollEnabled = preferences.autoScroll;
           }
           
           if (preferences.autoRefresh !== undefined) {
               this.autoRefreshEnabled = preferences.autoRefresh;
               const toggle = document.getElementById('auto-refresh');
               if (toggle) toggle.checked = this.autoRefreshEnabled;
           }
           
           if (preferences.maxLogs !== undefined) {
               this.maxLogs = preferences.maxLogs;
           }
           
           // Load last configuration if auto-save is enabled
           if (preferences.autoSave && preferences.lastConfig) {
               setTimeout(() => {
                   this.applyConfiguration(preferences.lastConfig);
                   this.showNotification('Previous configuration restored', 'info');
               }, 1000);
           }
           
           this.addLog('User preferences loaded', 'info');
       } catch (error) {
           console.warn('Failed to load user preferences:', error);
           this.addLog('Failed to load preferences, using defaults', 'warning');
       }
   }

   saveUserPreferences() {
       try {
           const preferences = {
               autoScroll: this.autoScrollEnabled,
               autoRefresh: this.autoRefreshEnabled,
               maxLogs: this.maxLogs,
               autoSave: true,
               lastConfig: this.getCurrentConfiguration(),
               timestamp: new Date().toISOString()
           };
           
           localStorage.setItem('ngulusumu-enhanced-preferences', JSON.stringify(preferences));
       } catch (error) {
           console.warn('Failed to save user preferences:', error);
       }
   }

   saveCurrentConfiguration() {
       this.saveUserPreferences();
       this.showNotification('Configuration saved', 'success');
       this.addLog('Configuration saved', 'info');
   }

   // Auto-save functionality
   enableAutoSave(interval = 30000) { // 30 seconds
       const autoSaveInterval = setInterval(() => {
           this.saveUserPreferences();
       }, interval);
       this.updateIntervals.set('autoSave', autoSaveInterval);
       
       this.addLog('Auto-save enabled', 'info');
   }

   // Cleanup
   cleanup() {
       try {
           // Save current state before cleanup
           this.saveUserPreferences();
           
           // Clear all intervals
           this.updateIntervals.forEach((interval, name) => {
               clearInterval(interval);
           });
           this.updateIntervals.clear();
           
           // Clear validation states
           this.validationStates.clear();
           
           // Clear active attacks
           this.activeAttacks.clear();
           
           this.addLog('UI Controller cleaned up', 'info');
           console.log('Enhanced UI Controller cleaned up successfully');
       } catch (error) {
           console.error('Error during cleanup:', error);
       }
   }
}

// Initialize enhanced UI controller
let uiController;
window.startTime = Date.now();

document.addEventListener('DOMContentLoaded', () => {
   uiController = new EnhancedUIController();
   
   // Make it globally accessible for button handlers
   window.uiController = uiController;
   
   // Enable auto-save
   uiController.enableAutoSave();
   
   console.log('Enhanced UI Controller initialized and ready');
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
   if (uiController) {
       uiController.cleanup();
   }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
   module.exports = EnhancedUIController;
}