// Loading Page Logic and Animation Controller
class LoadingController {
    constructor() {
        this.currentProgress = 0;
        this.targetProgress = 0;
        this.loadingStages = [
            { id: 1, name: 'System Information', duration: 800 },
            { id: 2, name: 'Network Coordinator', duration: 1200 },
            { id: 3, name: 'Security Engine', duration: 1000 },
            { id: 4, name: 'Security Protocols', duration: 600 },
            { id: 5, name: 'Final Checks', duration: 400 }
        ];
        this.currentStage = 0;
        this.isComplete = false;
        this.hasError = false;
        this.startTime = Date.now();
        
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
            img.onload = () => console.log(`✅ Image loaded: ${path}`);
            img.onerror = () => {
                console.error(`❌ Failed to load image: ${path}`);
                console.log('Trying alternative paths...');
                
                // Try alternative paths
                const altPaths = [
                    path.replace('./images/', '../images/'),
                    path.replace('./images/', './'),
                    path.replace('./images/', '')
                ];
                
                altPaths.forEach(altPath => {
                    const altImg = new Image();
                    altImg.onload = () => console.log(`✅ Alternative path works: ${altPath}`);
                    altImg.onerror = () => console.log(`❌ Alternative failed: ${altPath}`);
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

        // Get all stage elements
        this.stageElements = {};
        for (let i = 1; i <= 5; i++) {
            this.stageElements[i] = {
                check: document.getElementById(`check-${i}`),
                stage: document.getElementById(`stage-${i}`)
            };
        }
    }

    setupEventListeners() {
        // Listen for keyboard shortcuts
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

        // Listen for click anywhere to skip when complete
        document.addEventListener('click', (e) => {
            if (this.isComplete && !e.target.closest('.theme-selector')) {
                this.navigateToMain();
            }
        });

        // Listen for theme changes
        document.addEventListener('themechange', (e) => {
            this.onThemeChange(e.detail);
        });
    }

    // Fixed Image Switching Logic - Only left side switches
    initImageSwitching() {
        const leftImageF = document.getElementById('left-image-f');
        const leftImageM = document.getElementById('left-image-m');
        const rightImageSiah = document.getElementById('right-image-siah');
        
        if (!leftImageF || !leftImageM || !rightImageSiah) {
            console.warn('Image elements not found for switching');
            return;
        }
        
        // Force set the right image immediately
        this.setBackgroundImage(rightImageSiah, './images/siahKE.jpg');
        
        let showingF = true;
        
        // Add visual indicator for debugging
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
                // Switch to M: Hide F, Show M
                leftImageF.style.opacity = '0';
                leftImageM.style.opacity = '0.8';
                leftImageF.style.transform = 'scale(0.95)';
                leftImageM.style.transform = 'scale(1)';
                this.setBackgroundImage(leftImageM, './images/ngulusumuM.jpg');
            } else {
                // Switch to F: Hide M, Show F
                leftImageF.style.opacity = '0.8';
                leftImageM.style.opacity = '0';
                leftImageF.style.transform = 'scale(1)';
                leftImageM.style.transform = 'scale(0.95)';
                this.setBackgroundImage(leftImageF, './images/ngulusumuF.jpg');
            }
            showingF = !showingF;
        };
        
        // Set initial images
        this.setBackgroundImage(leftImageF, './images/ngulusumuF.jpg');
        this.setBackgroundImage(leftImageM, './images/ngulusumuM.jpg');
        
        // Initial switch after 2 seconds
        setTimeout(switchImages, 2000);
        
        // Then switch every 4 seconds
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
                console.log(`✅ Successfully set image: ${possiblePaths[index]}`);
            };
            img.onerror = () => {
                console.log(`❌ Failed path: ${possiblePaths[index]}`);
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
        
        // Clear existing particles
        particlesContainer.innerHTML = '';
        
        // Create 9 particles with proper styling
        for (let i = 0; i < 9; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particlesContainer.appendChild(particle);
        }
    }

    async startLoading() {
        try {
            // Simulate system initialization with realistic stages
            await this.loadStage(1, 'Initializing system information...');
            await this.loadStage(2, 'Starting network coordinator...');
            await this.loadStage(3, 'Loading security engine...');
            await this.loadStage(4, 'Configuring security protocols...');
            await this.loadStage(5, 'Running final system checks...');
            
            await this.completeLoading();
        } catch (error) {
            this.showError(error.message);
        }
    }

    async loadStage(stageId, statusText) {
        const stage = this.loadingStages[stageId - 1];
        this.currentStage = stageId;
        
        // Update status text
        this.updateStatus(statusText);
        
        // Mark stage as loading
        this.updateStageIndicator(stageId, 'loading');
        
        // Simulate actual loading with real system calls
        try {
            await this.performStageOperations(stageId);
        } catch (error) {
            throw new Error(`Failed at stage ${stageId}: ${error.message}`);
        }
        
        // Calculate progress
        const progressIncrement = 100 / this.loadingStages.length;
        this.targetProgress = stageId * progressIncrement;
        
        // Animate progress
        await this.animateProgress();
        
        // Mark stage as completed
        this.updateStageIndicator(stageId, 'completed');
        
    }

    async performStageOperations(stageId) {
        switch (stageId) {
            case 1:
                // System Information
                if (window.electronAPI) {
                    try {
                        const systemInfo = await window.electronAPI.getBasicInfo();
                        this.updateSystemInfo(systemInfo.data);
                    } catch (error) {
                        console.warn('Failed to get system info:', error);
                    }
                }
                await this.delay(800);
                break;
                
            case 2:
                // Network Coordinator
                if (window.electronAPI) {
                    try {
                        await window.electronAPI.testConnectivity();
                    } catch (error) {
                        console.warn('Network test failed:', error);
                    }
                }
                await this.delay(1200);
                break;
                
            case 3:
                // Security Engine
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
                    } catch (error) {
                        console.warn('Security engine check failed:', error);
                    }
                }
                await this.delay(1000);
                break;
                
            case 4:
                // Security Protocols
                await this.delay(600);
                break;
                
            case 5:
                // Final Checks
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
        
        // Remove all status classes
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
        this.isComplete = true;
        this.updateStatus('System ready! Click anywhere to continue...');
        
        // Add completion effects
        this.addCompletionEffects();
        
        // Auto-navigate after 3 seconds
        setTimeout(() => {
            if (this.isComplete) {
                this.navigateToMain();
            }
        }, 3000);
    }

    addCompletionEffects() {
        // Add success animation to progress bar
        if (this.elements.progressBar) {
            this.elements.progressBar.style.background = 'linear-gradient(90deg, #10b981, #34d399, #10b981)';
            this.elements.progressBar.style.backgroundSize = '200% 100%';
        }
        
        // Show completion message
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

        // Animate in
        requestAnimationFrame(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(-50%) translateY(0)';
        });

        // Auto-remove
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(-50%) translateY(20px)';
            setTimeout(() => notification.remove(), 500);
        }, 2500);
    }

    showError(message) {
        this.hasError = true;
        
        // Update current stage to error
        if (this.currentStage > 0) {
            this.updateStageIndicator(this.currentStage, 'error');
        }
        
        // Show error container
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
        
        // Hide error container
        if (this.elements.errorContainer) {
            this.elements.errorContainer.classList.add('hidden');
            this.elements.errorContainer.classList.remove('error-shake');
        }
        
        // Reset all stages
        for (let i = 1; i <= 5; i++) {
            this.updateStageIndicator(i, 'pending');
        }
        
        // Reset progress
        this.updateProgressDisplay();
        
        // Restart loading
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
            if (info.success) {
                const platform = info.data.platform;
                const arch = info.data.arch;
                this.elements.systemInfo.textContent = `${platform} ${arch} • Nairobi, Kenya`;
            }
        } catch (error) {
            this.elements.systemInfo.textContent = 'Nairobi, Kenya • System Ready';
        }
    }

    updateSystemInfo(systemInfo) {
        if (systemInfo && this.elements.systemInfo) {
            const { platform, arch, hostname } = systemInfo;
            this.elements.systemInfo.textContent = `${platform} ${arch} • ${hostname}`;
        }
    }

    setupSkipTimer() {
        // Show skip button after 5 seconds
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
            // Add fade out effect
            document.body.style.transition = 'opacity 0.5s ease-in-out';
            document.body.style.opacity = '0';
            
            await this.delay(500);
            
            if (window.electronAPI) {
                await window.electronAPI.navigateToMain();
            } else {
                // Fallback for browser testing
                window.location.href = 'index.html';
            }
        } catch (error) {
            console.error('Navigation failed:', error);
            // Force navigation as fallback
            window.location.href = 'index.html';
        }
    }

    onThemeChange(themeDetail) {
        // Adjust particles based on theme
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

    // Public methods for external access
    getLoadingProgress() {
        return {
            currentProgress: this.currentProgress,
            targetProgress: this.targetProgress,
            currentStage: this.currentStage,
            isComplete: this.isComplete,
            hasError: this.hasError,
            elapsedTime: Date.now() - this.startTime
        };
    }

    setCustomLoadingStages(stages) {
        this.loadingStages = stages;
    }
}

// Theme Management Class
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
        
        // Dispatch theme change event
        document.dispatchEvent(new CustomEvent('themechange', {
            detail: { previous: previousTheme, current: themeName }
        }));
    }

    applyTheme(themeName) {
        document.documentElement.setAttribute('data-theme', themeName);
        
        // Update particle colors based on theme
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

// Global functions for HTML onclick handlers
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

// Initialize controllers when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.themeManager = new ThemeManager();
    window.loadingController = new LoadingController();
});

// Handle page visibility changes for performance
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Pause animations when page is hidden
        const particles = document.querySelectorAll('.particle');
        particles.forEach(p => p.style.animationPlayState = 'paused');
    } else {
        // Resume animations when page is visible
        const particles = document.querySelectorAll('.particle');
        particles.forEach(p => p.style.animationPlayState = 'running');
    }
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LoadingController, ThemeManager };
}