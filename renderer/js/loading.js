class LoadingController {
    constructor() {
        this.currentProgress = 0;
        this.targetProgress = 0;
        this.loadingStages = [
            { id: 1, name: 'System Information', duration: 800 },
            { id: 2, name: 'Private Network Coordinator', duration: 1200 },
            { id: 3, name: 'Security Engine', duration: 1000 },
            { id: 4, name: 'Coordination Protocols', duration: 600 },
            { id: 5, name: 'Final Checks', duration: 400 }
        ];
        this.currentStage = 0;
        this.isComplete = false;
        this.hasError = false;
        this.startTime = Date.now();
        this.systemData = {};
        
        this.init();
    }

    init() {
        this.setupElements();
        this.setupEventListeners();
        this.checkImagePaths();
        this.initImageSwitching();
        this.createParticles();
        this.startLoading();
        this.setupSystemInfo();
        this.setupSkipTimer();
    }

    checkImagePaths() {
        const imagePaths = [
            './images/ngulusumuF.jpg',
            './images/ngulusumuM.jpg', 
            './images/siahKE.jpg'
        ];
        
        imagePaths.forEach(path => {
            const img = new Image();
            img.onload = () => console.log(`Image loaded: ${path}`);
            img.onerror = () => {
                console.error(`Failed to load image: ${path}`);
                
                const altPaths = [
                    path.replace('./images/', '../images/'),
                    path.replace('./images/', './'),
                    path.replace('./images/', '')
                ];
                
                altPaths.forEach(altPath => {
                    const altImg = new Image();
                    altImg.onload = () => console.log(`Alternative path works: ${altPath}`);
                    altImg.onerror = () => console.log(`Alternative failed: ${altPath}`);
                    altImg.src = altPath;
                });
            };
            img.src = path;
        });
    }

    setupElements() {
        this.elements = {
            progressBar: document.getElementById('progress-bar'),
            loadingStatus: document.getElementById('loading-status'),
            loadingPercentage: document.getElementById('loading-percentage'),
            errorContainer: document.getElementById('error-container'),
            errorMessage: document.getElementById('error-message'),
            skipContainer: document.getElementById('skip-container'),
            systemInfo: document.getElementById('system-info')
        };

        this.stageElements = {};
        for (let i = 1; i <= 5; i++) {
            this.stageElements[i] = {
                check: document.getElementById(`check-${i}`),
                stage: document.getElementById(`stage-${i}`)
            };
        }
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'Escape':
                    this.skipToMain();
                    break;
                case 'r':
                case 'R':
                    if (this.hasError) {
                        this.retryLoading();
                    }
                    break;
                case ' ':
                    e.preventDefault();
                    if (this.isComplete) {
                        this.navigateToMain();
                    }
                    break;
                case '1':
                    setTheme('dark');
                    break;
                case '2':
                    setTheme('blur');
                    break;
                case '3':
                    setTheme('kenyan');
                    break;
            }
        });

        document.addEventListener('click', (e) => {
            if (this.isComplete && !e.target.closest('.theme-selector')) {
                this.navigateToMain();
            }
        });

        document.addEventListener('themechange', (e) => {
            this.onThemeChange(e.detail);
        });

        // Listen for initialization stage updates
        if (window.electronAPI) {
            window.electronAPI.onInitializationStage((data) => {
                this.onInitializationStage(data);
            });
        }
    }

    initImageSwitching() {
        const leftImageF = document.getElementById('left-image-f');
        const leftImageM = document.getElementById('left-image-m');
        const rightImageSiah = document.getElementById('right-image-siah');
        
        if (!leftImageF || !leftImageM || !rightImageSiah) {
            console.warn('Image elements not found for switching');
            return;
        }
        
        this.setBackgroundImage(rightImageSiah, './images/siahKE.jpg');
        
        let showingF = true;
        
        const createIndicator = (text, color) => {
            const indicator = document.createElement('div');
            indicator.style.cssText = `
                position: absolute;
                top: 20px;
                left: 20px;
                background: ${color};
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                z-index: 10;
                opacity: 0.9;
                font-weight: bold;
            `;
            indicator.textContent = text;
            return indicator;
        };
        
        const indicatorF = createIndicator('F', 'rgba(207, 32, 39, 0.9)');
        const indicatorM = createIndicator('M', 'rgba(0, 102, 51, 0.9)');
        const indicatorSiah = createIndicator('SIAH', 'rgba(59, 130, 246, 0.9)');
        
        leftImageF.appendChild(indicatorF);
        leftImageM.appendChild(indicatorM);
        rightImageSiah.appendChild(indicatorSiah);
        
        console.log('Image switching initialized');
        
        const switchImages = () => {
            console.log(`Switching to: ${showingF ? 'M' : 'F'}`);
            
            if (showingF) {
                leftImageF.style.opacity = '0';
                leftImageM.style.opacity = '0.8';
                leftImageF.style.transform = 'scale(0.95)';
                leftImageM.style.transform = 'scale(1)';
                this.setBackgroundImage(leftImageM, './images/ngulusumuM.jpg');
            } else {
                leftImageF.style.opacity = '0.8';
                leftImageM.style.opacity = '0';
                leftImageF.style.transform = 'scale(1)';
                leftImageM.style.transform = 'scale(0.95)';
                this.setBackgroundImage(leftImageF, './images/ngulusumuF.jpg');
            }
            showingF = !showingF;
        };
        
        this.setBackgroundImage(leftImageF, './images/ngulusumuF.jpg');
        this.setBackgroundImage(leftImageM, './images/ngulusumuM.jpg');
        
        setTimeout(switchImages, 2000);
        setInterval(switchImages, 4000);
    }

    setBackgroundImage(element, imagePath) {
        const possiblePaths = [
            imagePath,
            imagePath.replace('./images/', '../images/'),
            imagePath.replace('./images/', './'),
            imagePath.replace('./images/', '')
        ];
        
        const tryPath = (index = 0) => {
            if (index >= possiblePaths.length) {
                console.error(`All paths failed for: ${imagePath}`);
                return;
            }
            
            const img = new Image();
            img.onload = () => {
                element.style.backgroundImage = `url('${possiblePaths[index]}')`;
                console.log(`Successfully set image: ${possiblePaths[index]}`);
            };
            img.onerror = () => {
                console.log(`Failed path: ${possiblePaths[index]}`);
                tryPath(index + 1);
            };
            img.src = possiblePaths[index];
        };
        
        tryPath();
    }

    createParticles() {
        const particlesContainer = document.querySelector('.particles');
        
        if (!particlesContainer) {
            console.warn('Particles container not found');
            return;
        }
        
        particlesContainer.innerHTML = '';
        
        for (let i = 0; i < 9; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particlesContainer.appendChild(particle);
        }
    }

    async startLoading() {
        try {
            await this.loadStage(1, 'Initializing system information...');
            await this.loadStage(2, 'Starting private network coordinator...');
            await this.loadStage(3, 'Loading security engine...');
            await this.loadStage(4, 'Configuring coordination protocols...');
            await this.loadStage(5, 'Running final system checks...');
            
            await this.completeLoading();
        } catch (error) {
            this.showError(error.message);
        }
    }

    async loadStage(stageId, statusText) {
        const stage = this.loadingStages[stageId - 1];
        this.currentStage = stageId;
        
        this.updateStatus(statusText);
        this.updateStageIndicator(stageId, 'loading');
        
        try {
            await this.performStageOperations(stageId);
        } catch (error) {
            throw new Error(`Failed at stage ${stageId}: ${error.message}`);
        }
        
        const progressIncrement = 100 / this.loadingStages.length;
        this.targetProgress = stageId * progressIncrement;
        
        await this.animateProgress();
        this.updateStageIndicator(stageId, 'completed');
    }

    async performStageOperations(stageId) {
        switch (stageId) {
            case 1:
                if (window.electronAPI) {
                    try {
                        const systemInfo = await window.electronAPI.getBasicInfo();
                        if (systemInfo.success && systemInfo.data) {
                            this.systemData.basic = systemInfo.data;
                            this.updateSystemInfo(systemInfo.data);
                        }
                    } catch (error) {
                        console.warn('Failed to get system info:', error);
                    }
                }
                await this.delay(800);
                break;
                
            case 2:
                if (window.electronAPI) {
                    try {
                        const coordStatus = await window.electronAPI.getCoordinationStatus();
                        if (coordStatus.success && coordStatus.data) {
                            this.systemData.coordination = coordStatus.data;
                        }
                        
                        const myInfo = await window.electronAPI.getMyMachineInfo();
                        if (myInfo.success && myInfo.data) {
                            this.systemData.machine = myInfo.data;
                        }
                    } catch (error) {
                        console.warn('Coordination system not ready:', error);
                    }
                }
                await this.delay(1200);
                break;
                
            case 3:
                if (window.electronAPI) {
                    try {
                        const validation = await window.electronAPI.validateAttackConfig({
                            targets: ['localhost'],
                            layer: 'LAYER7',
                            method: 'GET',
                            duration: 1
                        });
                        if (!validation.success) {
                            throw new Error('Security engine validation failed');
                        }
                        this.systemData.security = { validated: true };
                    } catch (error) {
                        console.warn('Security engine check failed:', error);
                        this.systemData.security = { validated: false };
                    }
                }
                await this.delay(1000);
                break;
                
            case 4:
                if (window.electronAPI) {
                    try {
                        await window.electronAPI.refreshCoordinationNetwork();
                        this.systemData.networkRefreshed = true;
                    } catch (error) {
                        console.warn('Network refresh failed:', error);
                        this.systemData.networkRefreshed = false;
                    }
                }
                await this.delay(600);
                break;
                
            case 5:
                if (window.electronAPI) {
                    try {
                        const performance = await window.electronAPI.getPerformanceMetrics();
                        if (performance.success && performance.data) {
                            this.systemData.performance = performance.data;
                        }
                    } catch (error) {
                        console.warn('Performance check failed:', error);
                    }
                }
                await this.delay(400);
                break;
        }
    }

    updateStatus(text) {
        if (this.elements.loadingStatus) {
            this.elements.loadingStatus.textContent = text;
            this.elements.loadingStatus.classList.add('loading-text');
        }
    }

    updateStageIndicator(stageId, status) {
        const stageElement = this.stageElements[stageId];
        if (!stageElement) return;

        const { check, stage } = stageElement;
        
        check.classList.remove('loading', 'completed', 'error');
        stage.classList.remove('text-gray-500', 'text-blue-400', 'text-green-400', 'text-red-400');
        
        switch (status) {
            case 'loading':
                check.classList.add('loading');
                stage.classList.add('text-blue-400');
                break;
                
            case 'completed':
                check.classList.add('completed');
                stage.classList.add('text-green-400');
                break;
                
            case 'error':
                check.classList.add('error');
                stage.classList.add('text-red-400');
                break;
                
            case 'pending':
                check.style.background = '#4b5563';
                stage.classList.add('text-gray-500');
                break;
        }
    }

    async animateProgress() {
        return new Promise(resolve => {
            const animate = () => {
                const diff = this.targetProgress - this.currentProgress;
                const step = diff * 0.1;
                
                if (Math.abs(diff) < 0.1) {
                    this.currentProgress = this.targetProgress;
                } else {
                    this.currentProgress += step;
                }
                
                this.updateProgressDisplay();
                
                if (this.currentProgress < this.targetProgress) {
                    requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            };
            
            animate();
        });
    }

    updateProgressDisplay() {
        const percentage = Math.round(this.currentProgress);
        
        if (this.elements.progressBar) {
            this.elements.progressBar.style.width = `${percentage}%`;
        }
        
        if (this.elements.loadingPercentage) {
            this.elements.loadingPercentage.textContent = `${percentage}%`;
        }
    }

    async completeLoading() {
        this.updateStatus('Waiting for system initialization...');
        
        // Wait for initialization complete signal from main process
        this.waitForInitialization();
        
        // Also set a maximum timeout to prevent infinite waiting
        setTimeout(() => {
            if (!this.isComplete && !this.hasError) {
                console.warn('Initialization timeout - forcing navigation');
                this.onInitializationComplete();
            }
        }, 15000); // 15 second timeout
    }

    waitForInitialization() {
        // Listen for initialization events
        if (window.electronAPI) {
            window.electronAPI.onInitializationComplete(() => {
                this.onInitializationComplete();
            });

            window.electronAPI.onInitializationError((error) => {
                this.onInitializationError(error);
            });
            
            // Also listen for stage updates
            window.electronAPI.onInitializationStage((data) => {
                this.onInitializationStage(data);
            });
        } else {
            // Fallback for browser testing
            setTimeout(() => {
                this.onInitializationComplete();
            }, 5000);
        }
    }

    onInitializationComplete() {
        this.isComplete = true;
        this.updateStatus('System ready! Click anywhere to continue...');
        
        this.addCompletionEffects();
        
        // Wait longer before auto-navigation to ensure user sees completion
        setTimeout(() => {
            if (this.isComplete) {
                this.navigateToMain();
            }
        }, 5000); // Increased to 5 seconds
    }

    onInitializationError(error) {
        this.showError(`Initialization failed: ${error.error || 'Unknown error'}`);
    }

    onInitializationStage(data) {
        if (data.stage && data.stage <= 5) {
            // Update the corresponding stage
            this.updateStageIndicator(data.stage, 'loading');
            
            // Mark previous stages as completed
            for (let i = 1; i < data.stage; i++) {
                this.updateStageIndicator(i, 'completed');
            }
            
            // Update progress
            this.targetProgress = (data.stage / 5) * 100;
            this.animateProgress();
            
            // Update status message
            if (data.message) {
                this.updateStatus(data.message);
            }
        }
    }

    addCompletionEffects() {
        if (this.elements.progressBar) {
            this.elements.progressBar.style.background = 'linear-gradient(90deg, #10b981, #34d399, #10b981)';
            this.elements.progressBar.style.backgroundSize = '200% 100%';
        }
        
        this.showCompletionNotification();
    }

    showCompletionNotification() {
        const notification = document.createElement('div');
        notification.className = 'completion-notification';
        notification.innerHTML = `
            <div class="flex items-center space-x-3 text-green-400">
                <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                </svg>
                <span class="font-medium">System initialization complete!</span>
            </div>
        `;
        
        notification.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%) translateY(20px);
            background: var(--bg-card);
            color: var(--text-primary);
            padding: 16px 24px;
            border-radius: 12px;
            border: 1px solid rgba(16, 185, 129, 0.3);
            box-shadow: var(--shadow-lg);
            z-index: 1000;
            opacity: 0;
            transition: all 0.5s ease-in-out;
        `;

        if (window.themeManager?.getCurrentTheme() === 'blur') {
            notification.style.backdropFilter = 'blur(8px)';
        }

        document.body.appendChild(notification);

        requestAnimationFrame(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(-50%) translateY(0)';
        });

        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(-50%) translateY(20px)';
            setTimeout(() => notification.remove(), 500);
        }, 2500);
    }

    showError(message) {
        this.hasError = true;
        
        if (this.currentStage > 0) {
            this.updateStageIndicator(this.currentStage, 'error');
        }
        
        if (this.elements.errorContainer) {
            this.elements.errorContainer.classList.remove('hidden');
            this.elements.errorContainer.classList.add('error-shake');
        }
        
        if (this.elements.errorMessage) {
            this.elements.errorMessage.textContent = message;
        }
        
        this.updateStatus('Loading failed. Please retry.');
    }

    async retryLoading() {
        this.hasError = false;
        this.currentProgress = 0;
        this.targetProgress = 0;
        this.currentStage = 0;
        this.isComplete = false;
        this.systemData = {};
        
        if (this.elements.errorContainer) {
            this.elements.errorContainer.classList.add('hidden');
            this.elements.errorContainer.classList.remove('error-shake');
        }
        
        for (let i = 1; i <= 5; i++) {
            this.updateStageIndicator(i, 'pending');
        }
        
        this.updateProgressDisplay();
        
        await this.delay(500);
        this.startLoading();
    }

    setupSystemInfo() {
        if (window.electronAPI) {
            this.updateSystemInfoPeriodically();
        } else {
            this.elements.systemInfo.textContent = 'Nairobi, Kenya • System Ready';
        }
    }

    async updateSystemInfoPeriodically() {
        try {
            const info = await window.electronAPI.getPlatformInfo();
            if (info.success && info.data) {
                const platform = info.data.platform || 'Unknown';
                const arch = info.data.arch || 'Unknown';
                this.elements.systemInfo.textContent = `${platform} ${arch} • Nairobi, Kenya`;
            } else {
                this.elements.systemInfo.textContent = 'Nairobi, Kenya • System Ready';
            }
        } catch (error) {
            this.elements.systemInfo.textContent = 'Nairobi, Kenya • System Ready';
        }
    }

    updateSystemInfo(systemInfo) {
        if (systemInfo && this.elements.systemInfo) {
            const platform = systemInfo.platform || 'Unknown';
            const arch = systemInfo.arch || 'Unknown';
            const hostname = systemInfo.hostname || 'Unknown';
            this.elements.systemInfo.textContent = `${platform} ${arch} • ${hostname}`;
        }
    }

    setupSkipTimer() {
        setTimeout(() => {
            if (this.elements.skipContainer && !this.isComplete) {
                this.elements.skipContainer.classList.remove('hidden');
            }
        }, 5000);
    }

    skipToMain() {
        this.navigateToMain();
    }

    async navigateToMain() {
        try {
            document.body.style.transition = 'opacity 0.5s ease-in-out';
            document.body.style.opacity = '0';
            
            await this.delay(500);
            
            if (window.electronAPI) {
                await window.electronAPI.navigateToMain();
            } else {
                window.location.href = 'index.html';
            }
        } catch (error) {
            console.error('Navigation failed:', error);
            window.location.href = 'index.html';
        }
    }

    onThemeChange(themeDetail) {
        const particles = document.querySelectorAll('.particle');
        particles.forEach(particle => {
            switch (themeDetail.current) {
                case 'blur':
                    particle.style.background = 'rgba(59, 130, 246, 0.8)';
                    break;
                case 'kenyan':
                    particle.style.background = 'rgba(207, 32, 39, 0.6)';
                    break;
                case 'dark':
                default:
                    particle.style.background = 'rgba(59, 130, 246, 0.6)';
                    break;
            }
        });
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getLoadingProgress() {
        return {
            currentProgress: this.currentProgress,
            targetProgress: this.targetProgress,
            currentStage: this.currentStage,
            isComplete: this.isComplete,
            hasError: this.hasError,
            elapsedTime: Date.now() - this.startTime,
            systemData: this.systemData
        };
    }

    setCustomLoadingStages(stages) {
        this.loadingStages = stages;
    }
}

class ThemeManager {
    constructor() {
        this.currentTheme = this.getStoredTheme() || 'dark';
        this.themes = {
            dark: { name: 'Dark', description: 'Kenyan flag inspired dark theme' },
            blur: { name: 'Blur', description: 'Glassmorphism with blur effects' },
            kenyan: { name: 'Kenyan', description: 'Ceremonial Kenyan flag theme' }
        };
        
        this.init();
    }

    init() {
        this.applyTheme(this.currentTheme);
        this.updateThemeButtons();
    }

    setTheme(themeName) {
        if (!this.themes[themeName]) return;

        const previousTheme = this.currentTheme;
        this.currentTheme = themeName;
        this.applyTheme(themeName);
        this.storeTheme(themeName);
        this.updateThemeButtons();
        this.showThemeNotification(themeName);
        
        document.dispatchEvent(new CustomEvent('themechange', {
            detail: { previous: previousTheme, current: themeName }
        }));
    }

    applyTheme(themeName) {
        document.documentElement.setAttribute('data-theme', themeName);
        
        const particles = document.querySelectorAll('.particle');
        particles.forEach(particle => {
            switch (themeName) {
                case 'blur':
                    particle.style.background = 'rgba(59, 130, 246, 0.8)';
                    break;
                case 'kenyan':
                    particle.style.background = 'rgba(207, 32, 39, 0.6)';
                    break;
                case 'dark':
                default:
                    particle.style.background = 'rgba(59, 130, 246, 0.6)';
                    break;
            }
        });
    }

    updateThemeButtons() {
        const themeOptions = document.querySelectorAll('.theme-option');
        themeOptions.forEach(option => {
            option.classList.remove('active');
            if (option.classList.contains(this.currentTheme)) {
                option.classList.add('active');
            }
        });
    }

    showThemeNotification(themeName) {
        const theme = this.themes[themeName];
        
        const existing = document.querySelector('.theme-notification');
        if (existing) existing.remove();

        const notification = document.createElement('div');
        notification.className = 'theme-notification';
        notification.innerHTML = `
            <div class="flex items-center space-x-2 text-sm">
                <span>${theme.name} theme activated</span>
            </div>
        `;
        
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: var(--bg-card);
            color: var(--text-primary);
            padding: 12px 16px;
            border-radius: 8px;
            border: 1px solid var(--border-secondary);
            box-shadow: var(--shadow-lg);
            z-index: 10000;
            transform: translateX(100%);
            transition: transform 0.3s ease-in-out;
        `;

        if (this.currentTheme === 'blur') {
            notification.style.backdropFilter = 'blur(8px)';
        }

        document.body.appendChild(notification);

        requestAnimationFrame(() => {
            notification.style.transform = 'translateX(0)';
        });

        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }

    getCurrentTheme() {
        return this.currentTheme;
    }

    storeTheme(themeName) {
        try {
            localStorage.setItem('ngulusumu-theme', themeName);
        } catch (error) {
            console.warn('Failed to store theme preference:', error);
        }
    }

    getStoredTheme() {
        try {
            return localStorage.getItem('ngulusumu-theme');
        } catch (error) {
            console.warn('Failed to retrieve stored theme:', error);
            return null;
        }
    }
}

function retryLoading() {
    if (window.loadingController) {
        window.loadingController.retryLoading();
    }
}

function skipToMain() {
    if (window.loadingController) {
        window.loadingController.skipToMain();
    }
}

function setTheme(themeName) {
    if (window.themeManager) {
        window.themeManager.setTheme(themeName);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.themeManager = new ThemeManager();
    window.loadingController = new LoadingController();
});

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        const particles = document.querySelectorAll('.particle');
        particles.forEach(p => p.style.animationPlayState = 'paused');
    } else {
        const particles = document.querySelectorAll('.particle');
        particles.forEach(p => p.style.animationPlayState = 'running');
    }
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LoadingController, ThemeManager };
}