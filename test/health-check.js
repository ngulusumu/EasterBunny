// test/health-check.js
const fs = require('fs');
const path = require('path');

class HealthCheck {
    async runHealthCheck() {
        console.log('🏥 System Health Check');
        console.log('Checking overall system health and readiness...\n');

        const checks = [
            { name: 'Node.js Version', fn: () => this.checkNodeVersion() },
            { name: 'Dependencies', fn: () => this.checkDependencies() },
            { name: 'Project Structure', fn: () => this.checkProjectStructure() },
            { name: 'Network Connectivity', fn: () => this.checkNetworkConnectivity() },
            { name: 'File Permissions', fn: () => this.checkFilePermissions() },
            { name: 'System Resources', fn: () => this.checkSystemResources() }
        ];

        let passedChecks = 0;
        
        for (const check of checks) {
            try {
                console.log(`🔍 ${check.name}...`);
                await check.fn();
                console.log(`   ✅ ${check.name} - OK`);
                passedChecks++;
            } catch (error) {
                console.log(`   ❌ ${check.name} - FAILED: ${error.message}`);
            }
        }

        console.log('\n' + '='.repeat(50));
        console.log(`🏥 Health Check Summary: ${passedChecks}/${checks.length} passed`);
        
        if (passedChecks === checks.length) {
            console.log('✅ System is healthy and ready for operation!');
        } else if (passedChecks >= checks.length * 0.8) {
            console.log('⚠️  System has minor issues but should work');
        } else {
            console.log('❌ System has significant issues - troubleshooting needed');
            process.exit(1);
        }
    }

    async checkNodeVersion() {
        const nodeVersion = process.version;
        const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
        
        if (majorVersion < 18) {
            throw new Error(`Node.js ${majorVersion} is too old, requires 18+`);
        }
        
        console.log(`   Node.js ${nodeVersion} ✓`);
    }

    async checkDependencies() {
        const requiredDeps = ['ws', 'crypto'];
        const optionalDeps = ['elliptic'];
        
        for (const dep of requiredDeps) {
            try {
                require(dep);
            } catch (error) {
                throw new Error(`Missing required dependency: ${dep}`);
            }
        }
        
        let optionalCount = 0;
        for (const dep of optionalDeps) {
            try {
                require(dep);
                optionalCount++;
            } catch (error) {
                console.log(`     ⚠️  Optional dependency missing: ${dep}`);
            }
        }
        
        console.log(`   Required dependencies: ${requiredDeps.length}/${requiredDeps.length} ✓`);
        console.log(`   Optional dependencies: ${optionalCount}/${optionalDeps.length}`);
    }

    async checkProjectStructure() {
        const requiredDirs = ['networking', 'systeminfo'];
        const requiredFiles = ['package.json', 'main.js'];
        
        const projectRoot = path.resolve(__dirname, '..');
        
        for (const dir of requiredDirs) {
            const dirPath = path.join(projectRoot, dir);
            if (!fs.existsSync(dirPath)) {
                throw new Error(`Missing directory: ${dir}`);
            }
        }
        
        for (const file of requiredFiles) {
            const filePath = path.join(projectRoot, file);
            if (!fs.existsSync(filePath)) {
                throw new Error(`Missing file: ${file}`);
            }
        }
        
        console.log(`   Project structure complete`);
    }

    async checkNetworkConnectivity() {
        // Simple DNS resolution test
        const dns = require('dns').promises;
        
        try {
            await dns.lookup('google.com');
            console.log(`   Internet connectivity OK`);
        } catch (error) {
            throw new Error('No internet connectivity');
        }
    }

    async checkFilePermissions() {
        const testDir = path.join(__dirname);
        
        try {
            // Test read permissions
            fs.accessSync(testDir, fs.constants.R_OK);
            
            // Test write permissions
            const testFile = path.join(testDir, 'temp-test-file');
            fs.writeFileSync(testFile, 'test');
            fs.unlinkSync(testFile);
            
            console.log(`   File system permissions OK`);
            
        } catch (error) {
            throw new Error(`File permission issues: ${error.message}`);
        }
    }

    async checkSystemResources() {
        const memory = process.memoryUsage();
        const memoryMB = memory.heapUsed / 1024 / 1024;
        
        if (memoryMB > 500) {
            console.log(`     ⚠️  High memory usage: ${memoryMB.toFixed(1)} MB`);
        } else {
            console.log(`   Memory usage: ${memoryMB.toFixed(1)} MB`);
        }
        
        // Check available memory
        const os = require('os');
        const freeMemoryGB = os.freemem() / 1024 / 1024 / 1024;
        
        if (freeMemoryGB < 1) {
            throw new Error(`Low system memory: ${freeMemoryGB.toFixed(1)} GB free`);
        }
        
        console.log(`   System memory: ${freeMemoryGB.toFixed(1)} GB free`);
    }
}

// Run health check if this file is executed directly
if (require.main === module) {
    new HealthCheck().runHealthCheck().catch(console.error);
}

module.exports = HealthCheck;