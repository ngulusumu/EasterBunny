// Enhanced Theme Manager for Main Interface
class ThemeManager {
    constructor() {
        this.currentTheme = this.getStoredTheme() || 'dark';
        this.themes = {
            dark: { 
                name: 'Dark', 
                description: 'Kenyan flag inspired dark theme',
                icon: 'bg-gray-900'
            },
            blur: { 
                name: 'Blur', 
                description: 'Glassmorphism with blur effects',
                icon: 'bg-gray-500/30 backdrop-blur-sm'
            },
            kenyan: { 
                name: 'Kenyan', 
                description: 'Ceremonial Kenyan flag theme',
                icon: 'bg-gradient-to-r from-red-600 via-green-600 to-black'
            }
        };
        
        this.mediaQueries = {
            darkMode: window.matchMedia('(prefers-color-scheme: dark)'),
            reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)'),
            highContrast: window.matchMedia('(prefers-contrast: high)')
        };
        
        this.init();
    }

    init() {
        this.applyTheme(this.currentTheme);
        this.updateThemeButtons();
        this.setupMediaQueryListeners();
        this.setupSystemThemeDetection();
        this.createThemeTransitions();
    }

    setTheme(themeName) {
        if (!this.themes[themeName]) {
            console.warn(`Theme "${themeName}" not found`);
            return;
        }

        const previousTheme = this.currentTheme;
        this.currentTheme = themeName;
        
        this.applyTheme(themeName);
        this.storeTheme(themeName);
        this.updateThemeButtons();
        this.showThemeNotification(themeName);
        this.updateParticleColors(themeName);
        
        // Dispatch theme change event
        document.dispatchEvent(new CustomEvent('themechange', {
            detail: { 
                previous: previousTheme, 
                current: themeName,
                timestamp: Date.now()
            }
        }));

        // Update CSS custom properties dynamically
        this.updateCustomProperties(themeName);
    }

    applyTheme(themeName) {
        // Remove all existing theme classes
        Object.keys(this.themes).forEach(theme => {
            document.documentElement.classList.remove(`theme-${theme}`);
        });
        
        // Apply new theme
        document.documentElement.setAttribute('data-theme', themeName);
        document.documentElement.classList.add(`theme-${themeName}`);
        
        // Update body classes for special themes
        if (themeName === 'blur') {
            document.body.classList.add('backdrop-blur');
        } else {
            document.body.classList.remove('backdrop-blur');
        }

        // Apply accessibility preferences
        this.applyAccessibilityPreferences();
        
        console.log(`Theme applied: ${themeName}`);
    }

    updateCustomProperties(themeName) {
        const root = document.documentElement;
        
        // Theme-specific animations
        switch (themeName) {
            case 'kenyan':
                root.style.setProperty('--animation-duration', '2s');
                root.style.setProperty('--glow-intensity', '0.8');
                break;
            case 'blur':
                root.style.setProperty('--blur-intensity', '12px');
                root.style.setProperty('--backdrop-opacity', '0.7');
                break;
            case 'dark':
            default:
                root.style.setProperty('--animation-duration', '1.5s');
                root.style.setProperty('--glow-intensity', '0.5');
                break;
        }
    }

    updateParticleColors(themeName) {
        const particles = document.querySelectorAll('.particle');
        particles.forEach(particle => {
            switch (themeName) {
                case 'blur':
                    particle.style.background = 'rgba(59, 130, 246, 0.8)';
                    particle.style.boxShadow = '0 0 10px rgba(59, 130, 246, 0.6)';
                    break;
                case 'kenyan':
                    particle.style.background = 'rgba(207, 32, 39, 0.7)';
                    particle.style.boxShadow = '0 0 10px rgba(207, 32, 39, 0.5)';
                    break;
                case 'dark':
                default:
                    particle.style.background = 'rgba(59, 130, 246, 0.6)';
                    particle.style.boxShadow = '0 0 8px rgba(59, 130, 246, 0.4)';
                    break;
            }
        });
    }

    updateThemeButtons() {
        // Update theme selector buttons
        const themeButtons = document.querySelectorAll('.theme-btn');
        themeButtons.forEach(btn => {
            btn.classList.remove('ring-2', 'ring-primary-500', 'ring-offset-2', 'ring-offset-gray-900');
        });

        // Add active state to current theme button
        const activeButton = document.querySelector(`[onclick="setTheme('${this.currentTheme}')"]`);
        if (activeButton) {
            activeButton.classList.add('ring-2', 'ring-primary-500', 'ring-offset-2', 'ring-offset-gray-900');
        }

        // Update theme selector in side panel if it exists
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
        
        // Remove existing theme notifications
        const existing = document.querySelector('.theme-notification');
        if (existing) existing.remove();

        const notification = document.createElement('div');
        notification.className = 'theme-notification fixed top-20 right-6 z-50 transform transition-all duration-300 translate-x-full';
        notification.innerHTML = `
            <div class="theme-card rounded-lg p-4 backdrop-element border border-gray-700/50 min-w-64">
                <div class="flex items-center space-x-3">
                    <div class="w-8 h-8 rounded-full ${theme.icon} border-2 border-gray-600"></div>
                    <div>
                        <p class="font-medium text-white">${theme.name} Theme</p>
                        <p class="text-sm text-gray-400">${theme.description}</p>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(notification);

        // Animate in
        requestAnimationFrame(() => {
            notification.classList.remove('translate-x-full');
        });

        // Auto-remove after 3 seconds
        setTimeout(() => {
            notification.classList.add('translate-x-full');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    setupMediaQueryListeners() {
        // Listen for system dark mode changes
        this.mediaQueries.darkMode.addEventListener('change', (e) => {
            if (!this.getStoredTheme()) {
                // Only auto-switch if user hasn't set a preference
                this.setTheme(e.matches ? 'dark' : 'light');
            }
        });

        // Listen for reduced motion preference
        this.mediaQueries.reducedMotion.addEventListener('change', (e) => {
            this.applyAccessibilityPreferences();
        });

        // Listen for high contrast preference
        this.mediaQueries.highContrast.addEventListener('change', (e) => {
            this.applyAccessibilityPreferences();
        });
    }

    setupSystemThemeDetection() {
        // Auto-detect system theme on first visit
        if (!this.getStoredTheme()) {
            const prefersDark = this.mediaQueries.darkMode.matches;
            this.setTheme(prefersDark ? 'dark' : 'light');
        }
    }

    applyAccessibilityPreferences() {
        const root = document.documentElement;
        
        // Reduced motion
        if (this.mediaQueries.reducedMotion.matches) {
            root.classList.add('reduce-motion');
            root.style.setProperty('--animation-duration', '0.01ms');
        } else {
            root.classList.remove('reduce-motion');
        }

        // High contrast
        if (this.mediaQueries.highContrast.matches) {
            root.classList.add('high-contrast');
        } else {
            root.classList.remove('high-contrast');
        }
    }

    createThemeTransitions() {
        // Add smooth transitions for theme changes
        const style = document.createElement('style');
        style.textContent = `
            * {
                transition-property: background-color, border-color, color, fill, stroke, box-shadow, backdrop-filter;
                transition-duration: 300ms;
                transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            .reduce-motion * {
                transition-duration: 0.01ms !important;
                animation-duration: 0.01ms !important;
            }
            
            .high-contrast {
                --border-primary: currentColor !important;
                --border-secondary: currentColor !important;
            }
        `;
        document.head.appendChild(style);
    }

    // Theme utilities
    getCurrentTheme() {
        return this.currentTheme;
    }

    getThemeInfo(themeName = this.currentTheme) {
        return this.themes[themeName] || null;
    }

    isThemeAvailable(themeName) {
        return Object.keys(this.themes).includes(themeName);
    }

    getAvailableThemes() {
        return Object.keys(this.themes).map(key => ({
            key,
            ...this.themes[key]
        }));
    }

    // Storage methods
    storeTheme(themeName) {
        try {
            localStorage.setItem('ngulusumu-theme', themeName);
            localStorage.setItem('ngulusumu-theme-timestamp', Date.now().toString());
        } catch (error) {
            console.warn('Failed to store theme preference:', error);
        }
    }

    getStoredTheme() {
        try {
            const theme = localStorage.getItem('ngulusumu-theme');
            const timestamp = localStorage.getItem('ngulusumu-theme-timestamp');
            
            // Check if stored theme is still valid (not older than 30 days)
            if (theme && timestamp) {
                const age = Date.now() - parseInt(timestamp);
                const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
                
                if (age < maxAge && this.isThemeAvailable(theme)) {
                    return theme;
                }
            }
            
            return null;
        } catch (error) {
            console.warn('Failed to retrieve stored theme:', error);
            return null;
        }
    }

    clearStoredTheme() {
        try {
            localStorage.removeItem('ngulusumu-theme');
            localStorage.removeItem('ngulusumu-theme-timestamp');
        } catch (error) {
            console.warn('Failed to clear stored theme:', error);
        }
    }

    // Advanced theme features
    createCustomTheme(name, config) {
        if (this.themes[name]) {
            console.warn(`Theme "${name}" already exists`);
            return false;
        }

        this.themes[name] = {
            name: config.displayName || name,
            description: config.description || 'Custom theme',
            icon: config.icon || 'bg-gray-500',
            custom: true,
            ...config
        };

        return true;
    }

    removeCustomTheme(name) {
        if (!this.themes[name] || !this.themes[name].custom) {
            console.warn(`Cannot remove built-in theme "${name}"`);
            return false;
        }

        delete this.themes[name];
        
        // Switch to default theme if current theme was removed
        if (this.currentTheme === name) {
            this.setTheme('dark');
        }

        return true;
    }

    exportThemeConfig() {
        return {
            currentTheme: this.currentTheme,
            customThemes: Object.entries(this.themes)
                .filter(([key, theme]) => theme.custom)
                .reduce((acc, [key, theme]) => {
                    acc[key] = theme;
                    return acc;
                }, {}),
            timestamp: Date.now()
        };
    }

    importThemeConfig(config) {
        try {
            // Import custom themes
            if (config.customThemes) {
                Object.entries(config.customThemes).forEach(([key, theme]) => {
                    this.themes[key] = theme;
                });
            }

            // Apply imported theme if valid
            if (config.currentTheme && this.isThemeAvailable(config.currentTheme)) {
                this.setTheme(config.currentTheme);
            }

            return true;
        } catch (error) {
            console.error('Failed to import theme config:', error);
            return false;
        }
    }

    // Theme analytics
    getThemeUsageStats() {
        try {
            const stats = JSON.parse(localStorage.getItem('ngulusumu-theme-stats') || '{}');
            return stats;
        } catch (error) {
            return {};
        }
    }

    updateThemeUsageStats(themeName) {
        try {
            const stats = this.getThemeUsageStats();
            stats[themeName] = (stats[themeName] || 0) + 1;
            stats.lastUsed = themeName;
            stats.lastUpdate = Date.now();
            
            localStorage.setItem('ngulusumu-theme-stats', JSON.stringify(stats));
        } catch (error) {
            console.warn('Failed to update theme usage stats:', error);
        }
    }

    getMostUsedTheme() {
        const stats = this.getThemeUsageStats();
        let maxCount = 0;
        let mostUsed = 'dark';
        
        Object.entries(stats).forEach(([theme, count]) => {
            if (typeof count === 'number' && count > maxCount && this.isThemeAvailable(theme)) {
                maxCount = count;
                mostUsed = theme;
            }
        });
        
        return mostUsed;
    }

    // Performance optimization
    preloadThemeAssets() {
        // Preload theme-specific assets for faster switching
        const themes = Object.keys(this.themes);
        themes.forEach(theme => {
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.href = `#${theme}-theme`;
            document.head.appendChild(link);
        });
    }

    // Theme synchronization across tabs
    setupCrossTabSync() {
        window.addEventListener('storage', (e) => {
            if (e.key === 'ngulusumu-theme' && e.newValue !== this.currentTheme) {
                this.setTheme(e.newValue);
                this.showThemeNotification(e.newValue);
            }
        });
    }

    // Cleanup method
    cleanup() {
        // Remove media query listeners
        Object.values(this.mediaQueries).forEach(mq => {
            // Note: removeEventListener for MediaQueryList is not supported in all browsers
            // but it's good practice to attempt cleanup
            try {
                mq.removeEventListener('change', this.mediaQueryHandler);
            } catch (error) {
                // Silently ignore if not supported
            }
        });

        console.log('Theme manager cleaned up');
    }
}

// Global theme management functions
function setTheme(themeName) {
    if (window.themeManager) {
        window.themeManager.setTheme(themeName);
    } else {
        console.warn('Theme manager not initialized');
    }
}

function getCurrentTheme() {
    return window.themeManager ? window.themeManager.getCurrentTheme() : 'dark';
}

function toggleTheme() {
    const currentTheme = getCurrentTheme();
    const themes = ['dark', 'blur', 'kenyan'];
    const currentIndex = themes.indexOf(currentTheme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
}

// Auto-theme based on time of day
function setAutoTheme() {
    const hour = new Date().getHours();
    
    if (hour >= 6 && hour < 18) {
        // Daytime: use blur theme
        setTheme('blur');
    } else if (hour >= 18 && hour < 22) {
        // Evening: use kenyan theme
        setTheme('kenyan');
    } else {
        // Night: use dark theme
        setTheme('dark');
    }
}

// Theme initialization and management
let themeManager;

document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme manager
    themeManager = new ThemeManager();
    
    // Make it globally accessible
    window.themeManager = themeManager;
    
    // Setup cross-tab synchronization
    themeManager.setupCrossTabSync();
    
    // Preload theme assets for better performance
    themeManager.preloadThemeAssets();
    
    // Add keyboard shortcut for theme switching
    document.addEventListener('keydown', (e) => {
        if (e.key === 't' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            toggleTheme();
        }
    });
    
    // Add theme cycling with T key (when not in input)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'T' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            toggleTheme();
        }
    });
    
    console.log('Theme system initialized');
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (themeManager) {
        themeManager.cleanup();
    }
});

// Theme persistence across sessions
window.addEventListener('visibilitychange', () => {
    if (document.hidden && themeManager) {
        // Save current theme when tab becomes hidden
        themeManager.updateThemeUsageStats(themeManager.getCurrentTheme());
    }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ThemeManager, setTheme, getCurrentTheme, toggleTheme, setAutoTheme };
}

// Additional theme utilities
const ThemeUtils = {
    // Get theme-appropriate colors for charts/graphs
    getChartColors(themeName = getCurrentTheme()) {
        const colorSchemes = {
            dark: {
                primary: '#3b82f6',
                secondary: '#10b981',
                accent: '#f59e0b',
                danger: '#ef4444',
                background: '#1f2937',
                text: '#ffffff'
            },
            blur: {
                primary: '#60a5fa',
                secondary: '#34d399',
                accent: '#fbbf24',
                danger: '#f87171',
                background: 'rgba(31, 41, 55, 0.7)',
                text: '#ffffff'
            },
            kenyan: {
                primary: '#cf2027',
                secondary: '#006633',
                accent: '#ffffff',
                danger: '#000000',
                background: '#000000',
                text: '#ffffff'
            }
        };
        
        return colorSchemes[themeName] || colorSchemes.dark;
    },

    // Get CSS custom property values
    getCSSCustomProperty(property, themeName = getCurrentTheme()) {
        const element = document.createElement('div');
        element.setAttribute('data-theme', themeName);
        element.style.display = 'none';
        document.body.appendChild(element);
        
        const value = getComputedStyle(element).getPropertyValue(property);
        document.body.removeChild(element);
        
        return value.trim();
    },

    // Check if current theme is dark
    isDarkTheme(themeName = getCurrentTheme()) {
        return ['dark', 'kenyan'].includes(themeName);
    },

    // Check if current theme supports transparency
    supportsTransparency(themeName = getCurrentTheme()) {
        return themeName === 'blur';
    },

    // Get theme-appropriate loading spinner
    getLoadingSpinner(themeName = getCurrentTheme()) {
        const spinners = {
            dark: 'border-blue-500',
            blur: 'border-blue-400',
            kenyan: 'border-red-500'
        };
        
        return spinners[themeName] || spinners.dark;
    },

    // Generate theme-based gradients
    getGradient(type = 'primary', themeName = getCurrentTheme()) {
        const gradients = {
            dark: {
                primary: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                secondary: 'linear-gradient(135deg, #10b981, #059669)',
                accent: 'linear-gradient(135deg, #f59e0b, #d97706)'
            },
            blur: {
                primary: 'linear-gradient(135deg, rgba(59, 130, 246, 0.8), rgba(29, 78, 216, 0.8))',
                secondary: 'linear-gradient(135deg, rgba(16, 185, 129, 0.8), rgba(5, 150, 105, 0.8))',
                accent: 'linear-gradient(135deg, rgba(245, 158, 11, 0.8), rgba(217, 119, 6, 0.8))'
            },
            kenyan: {
                primary: 'linear-gradient(135deg, #cf2027, #a61c22)',
                secondary: 'linear-gradient(135deg, #006633, #004d26)',
                accent: 'linear-gradient(135deg, #ffffff, #f0f0f0)'
            }
        };
        
        return gradients[themeName]?.[type] || gradients.dark.primary;
    }
};

// Make ThemeUtils globally accessible
window.ThemeUtils = ThemeUtils;