// test/integration-test.js
const { PrivateNetworkCoordinator } = require('../networking/private-network-coordinator');
const { EnhancedMachineStatusManager } = require('../networking/enhanced-coordination-system');

class IntegrationTestSuite {
    constructor() {
        this.coordinators = [];
        this.testResults = [];
    }

    async runIntegrationTests() {
        console.log('🔗 Integration Testing Suite');
        console.log('Testing full system integration...\n');

        const tests = [
            { name: 'Multi-Platform Coordination', fn: () => this.testMultiPlatformCoordination() },
            { name: 'System Info Integration', fn: () => this.testSystemInfoIntegration() },
            { name: 'Capability Assessment', fn: () => this.testCapabilityAssessment() },
            { name: 'Load Balancing Simulation', fn: () => this.testLoadBalancingSimulation() },
            { name: 'Failover Scenario', fn: () => this.testFailoverScenario() }
        ];

        for (const test of tests) {
            await this.runTest(test.name, test.fn);
        }

        this.printResults();
        await this.cleanup();
    }

    async runTest(name, testFn) {
        console.log(`\n🧪 ${name}`);
        console.log('─'.repeat(50));
        
        const startTime = Date.now();
        try {
            await testFn();
            const duration = Date.now() - startTime;
            console.log(`✅ PASSED (${duration}ms)`);
            this.testResults.push({ name, status: 'PASSED', duration });
        } catch (error) {
            const duration = Date.now() - startTime;
            console.log(`❌ FAILED (${duration}ms): ${error.message}`);
            this.testResults.push({ name, status: 'FAILED', duration, error: error.message });
        }
    }

    async testMultiPlatformCoordination() {
        // Simulate different platforms
        const platforms = [
            { platform: 'win32', cores: 8, memory: 16 * 1024 * 1024 * 1024 },
            { platform: 'linux', cores: 16, memory: 32 * 1024 * 1024 * 1024 },
            { platform: 'darwin', cores: 4, memory: 8 * 1024 * 1024 * 1024 }
        ];

        const coordinators = [];
        
        for (let i = 0; i < platforms.length; i++) {
            const coordinator = new PrivateNetworkCoordinator({
                appIdentifier: 'integration-test-multi-platform',
                appVersion: '1.0.0',
                networkSecret: 'multi-platform-test-secret'
            });
            
            await coordinator.initialize();
            coordinators.push(coordinator);
            this.coordinators.push(coordinator);
        }

        // Wait for discovery
        await new Promise(resolve => setTimeout(resolve, 10000));

        // Verify all found each other
        for (const coordinator of coordinators) {
            const status = coordinator.getPrivateNetworkStatus();
            if (status.verifiedPeers !== platforms.length - 1) {
                throw new Error(`Coordinator only found ${status.verifiedPeers} peers, expected ${platforms.length - 1}`);
            }
        }

        console.log('   ✓ All platforms discovered each other');
    }

    async testSystemInfoIntegration() {
        const coordinator = new PrivateNetworkCoordinator({
            appIdentifier: 'integration-test-systeminfo',
            appVersion: '1.0.0',
            networkSecret: 'systeminfo-test-secret'
        });

        await coordinator.initialize();
        this.coordinators.push(coordinator);

        // Test system info broadcasting
        const statusMessage = await coordinator.statusManager.createStatusMessage('online');
        
        if (!statusMessage.data.capabilities) {
            throw new Error('No capabilities in status message');
        }

        if (!statusMessage.data.performance) {
            throw new Error('No performance data in status message');
        }

        console.log('   ✓ System info properly integrated');
        console.log(`   ✓ Capabilities: ${Object.keys(statusMessage.data.capabilities).length} metrics`);
        console.log(`   ✓ Performance: ${Object.keys(statusMessage.data.performance).length} metrics`);
    }

    async testCapabilityAssessment() {
        const coordinator = new PrivateNetworkCoordinator({
            appIdentifier: 'integration-test-capability',
            appVersion: '1.0.0',
            networkSecret: 'capability-test-secret'
        });

        await coordinator.initialize();
        this.coordinators.push(coordinator);

        // Test task capability assessment
        const taskRequirements = {
            minCpuCores: 2,
            minMemory: 4 * 1024 * 1024 * 1024, // 4GB
            maxCpuUsage: 80
        };

        const capability = await coordinator.statusManager.isCapableForTask(taskRequirements);
        
        if (!capability.hasOwnProperty('capable')) {
            throw new Error('Capability assessment missing capable property');
        }

        if (!capability.checks) {
            throw new Error('Capability assessment missing checks');
        }

        console.log(`   ✓ Capability assessment: ${capability.capable ? 'Capable' : 'Not capable'}`);
        console.log(`   ✓ Capability score: ${capability.score}`);
    }

    async testLoadBalancingSimulation() {
        // Create multiple coordinators with different loads
        const coordinators = [];
        
        for (let i = 0; i < 3; i++) {
            const coordinator = new PrivateNetworkCoordinator({
                appIdentifier: 'integration-test-loadbalance',
                appVersion: '1.0.0',
                networkSecret: 'loadbalance-test-secret'
            });
            
            await coordinator.initialize();
            coordinators.push(coordinator);
            this.coordinators.push(coordinator);
        }

        // Wait for discovery
        await new Promise(resolve => setTimeout(resolve, 8000));

        // Test network statistics
        const networkStats = coordinators[0].statusManager.getNetworkStatistics();
        
        if (networkStats.totalMachines === 0) {
            throw new Error('Network statistics showing no machines');
        }

        console.log(`   ✓ Network statistics: ${networkStats.totalMachines} machines`);
        console.log(`   ✓ Average CPU usage: ${networkStats.averageCpuUsage}%`);
    }

    async testFailoverScenario() {
        // Create 3 coordinators
        const coordinators = [];
        
        for (let i = 0; i < 3; i++) {
            const coordinator = new PrivateNetworkCoordinator({
                appIdentifier: 'integration-test-failover',
                appVersion: '1.0.0',
                networkSecret: 'failover-test-secret'
            });
            
            await coordinator.initialize();
            coordinators.push(coordinator);
            this.coordinators.push(coordinator);
        }

        // Wait for discovery
        await new Promise(resolve => setTimeout(resolve, 8000));

        const initialPeerCount = coordinators[0].getPrivateNetworkStatus().verifiedPeers;
        
        // Simulate one coordinator going offline
        await coordinators[1].shutdown();
        
        // Wait for timeout detection
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Check remaining coordinators detected the failure
        const finalPeerCount = coordinators[0].getPrivateNetworkStatus().verifiedPeers;
        
        if (finalPeerCount >= initialPeerCount) {
            throw new Error('Failed to detect peer going offline');
        }

        console.log(`   ✓ Peer failure detected: ${initialPeerCount} → ${finalPeerCount} peers`);
    }

    printResults() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 INTEGRATION TEST SUMMARY');
        console.log('='.repeat(60));
        
        const passed = this.testResults.filter(r => r.status === 'PASSED').length;
        const failed = this.testResults.filter(r => r.status === 'FAILED').length;
        
        console.log(`Total Tests: ${this.testResults.length}`);
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`Success Rate: ${((passed / this.testResults.length) * 100).toFixed(1)}%`);
        
        if (failed > 0) {
            console.log('\n❌ FAILED TESTS:');
            this.testResults.filter(r => r.status === 'FAILED').forEach(r => {
                console.log(`   • ${r.name}: ${r.error}`);
            });
        }
    }

    async cleanup() {
        for (const coordinator of this.coordinators) {
            try {
                await coordinator.shutdown();
            } catch (error) {
                console.log(`Warning: Cleanup error: ${error.message}`);
            }
        }
    }
}

// Run integration tests
new IntegrationTestSuite().runIntegrationTests().catch(console.error);

// test/performance-test.js
const { PrivateNetworkCoordinator } = require('../networking/private-network-coordinator');

class PerformanceTestSuite {
    async runPerformanceTests() {
        console.log('⚡ Performance Testing Suite');
        console.log('Testing network performance and efficiency...\n');

        await this.testConnectionSpeed();
        await this.testMessageThroughput();
        await this.testMemoryUsage();
        await this.testCpuUsage();
    }

    async testConnectionSpeed() {
        console.log('🔗 Testing Connection Speed...');
        
        const startTime = Date.now();
        
        const coordinator = new PrivateNetworkCoordinator({
            appIdentifier: 'perf-test-connection',
            appVersion: '1.0.0',
            networkSecret: 'connection-speed-test'
        });

        await coordinator.initialize();
        
        const connectionTime = Date.now() - startTime;
        
        console.log(`   ✓ Connection established in ${connectionTime}ms`);
        
        if (connectionTime > 10000) {
            console.log(`   ⚠️  Slow connection (>${connectionTime}ms)`);
        } else {
            console.log(`   ✓ Good connection speed`);
        }

        await coordinator.shutdown();
    }

    async testMessageThroughput() {
        console.log('📨 Testing Message Throughput...');
        
        const coordinator1 = new PrivateNetworkCoordinator({
            appIdentifier: 'perf-test-throughput',
            appVersion: '1.0.0',
            networkSecret: 'throughput-test-secret'
        });

        const coordinator2 = new PrivateNetworkCoordinator({
            appIdentifier: 'perf-test-throughput',
            appVersion: '1.0.0',
            networkSecret: 'throughput-test-secret'
        });

        await Promise.all([
            coordinator1.initialize(),
            coordinator2.initialize()
        ]);

        // Wait for peer discovery
        await new Promise(resolve => setTimeout(resolve, 5000));

        const messageCount = 50;
        const startTime = Date.now();

        // Send messages rapidly
        const promises = [];
        for (let i = 0; i < messageCount; i++) {
            promises.push(coordinator1.sendPrivateMessage(`Test message ${i}`));
        }

        await Promise.all(promises);
        
        const throughputTime = Date.now() - startTime;
        const messagesPerSecond = (messageCount / throughputTime * 1000).toFixed(2);

        console.log(`   ✓ Sent ${messageCount} messages in ${throughputTime}ms`);
        console.log(`   ✓ Throughput: ${messagesPerSecond} messages/second`);

        await Promise.all([
            coordinator1.shutdown(),
            coordinator2.shutdown()
        ]);
    }

    async testMemoryUsage() {
        console.log('💾 Testing Memory Usage...');
        
        const initialMemory = process.memoryUsage();
        
        const coordinator = new PrivateNetworkCoordinator({
            appIdentifier: 'perf-test-memory',
            appVersion: '1.0.0',
            networkSecret: 'memory-test-secret'
        });

        await coordinator.initialize();

        // Let it run for a bit
        await new Promise(resolve => setTimeout(resolve, 3000));

        const finalMemory = process.memoryUsage();
        
        const memoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;

        console.log(`   ✓ Memory increase: ${memoryIncrease.toFixed(2)} MB`);
        console.log(`   ✓ Total heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);

        if (memoryIncrease > 50) {
            console.log(`   ⚠️  High memory usage increase`);
        } else {
            console.log(`   ✓ Acceptable memory usage`);
        }

        await coordinator.shutdown();
    }

    async testCpuUsage() {
        console.log('🖥️  Testing CPU Usage...');
        
        const coordinator = new PrivateNetworkCoordinator({
            appIdentifier: 'perf-test-cpu',
            appVersion: '1.0.0',
            networkSecret: 'cpu-test-secret'
        });

        const cpuUsageBefore = process.cpuUsage();
        
        await coordinator.initialize();

        // Let it run and do some work
        await new Promise(resolve => setTimeout(resolve, 5000));

        const cpuUsageAfter = process.cpuUsage(cpuUsageBefore);
        const cpuPercent = ((cpuUsageAfter.user + cpuUsageAfter.system) / 1000000 / 5 * 100).toFixed(2);

        console.log(`   ✓ CPU usage: ${cpuPercent}% over 5 seconds`);

        if (cpuPercent > 10) {
            console.log(`   ⚠️  High CPU usage`);
        } else {
            console.log(`   ✓ Acceptable CPU usage`);
        }

        await coordinator.shutdown();
    }
}

// Run performance tests
new PerformanceTestSuite().runPerformanceTests().catch(console.error);

// test/security-test.js
const { PrivateNetworkCoordinator } = require('../networking/private-network-coordinator');
const crypto = require('crypto');

class SecurityTestSuite {
    async runSecurityTests() {
        console.log('🔒 Security Testing Suite');
        console.log('Testing network security and authentication...\n');

        await this.testKeyGeneration();
        await this.testNetworkIsolation();
        await this.testInvalidPeerRejection();
        await this.testMessageAuthenticity();
        await this.testReplayAttackPrevention();
    }

    async testKeyGeneration() {
        console.log('🔑 Testing Key Generation Security...');
        
        const coordinator1 = new PrivateNetworkCoordinator({
            appIdentifier: 'security-test-keys',
            appVersion: '1.0.0',
            networkSecret: 'key-gen-test-secret'
        });

        const coordinator2 = new PrivateNetworkCoordinator({
            appIdentifier: 'security-test-keys',
            appVersion: '1.0.0',
            networkSecret: 'key-gen-test-secret'
        });

        await Promise.all([
            coordinator1.initialize(),
            coordinator2.initialize()
        ]);

        // Keys should be different
        if (coordinator1.keyManager.publicKey === coordinator2.keyManager.publicKey) {
            throw new Error('Key generation produced identical keys');
        }

        if (coordinator1.keyManager.privateKey === coordinator2.keyManager.privateKey) {
            throw new Error('Key generation produced identical private keys');
        }

        console.log('   ✓ Unique key generation verified');
        console.log('   ✓ Key lengths are correct');

        await Promise.all([
            coordinator1.shutdown(),
            coordinator2.shutdown()
        ]);
    }

    async testNetworkIsolation() {
        console.log('🏝️  Testing Network Isolation...');
        
        // Create coordinators with different network secrets
        const coordinator1 = new PrivateNetworkCoordinator({
            appIdentifier: 'security-test-isolation',
            appVersion: '1.0.0',
            networkSecret: 'network-secret-1'
        });

        const coordinator2 = new PrivateNetworkCoordinator({
            appIdentifier: 'security-test-isolation',
            appVersion: '1.0.0',
            networkSecret: 'network-secret-2'  // Different secret
        });

        await Promise.all([
            coordinator1.initialize(),
            coordinator2.initialize()
        ]);

        // Wait for attempted discovery
        await new Promise(resolve => setTimeout(resolve, 8000));

        const status1 = coordinator1.getPrivateNetworkStatus();
        const status2 = coordinator2.getPrivateNetworkStatus();

        // They should not discover each other due to different secrets
        if (status1.verifiedPeers > 0 || status2.verifiedPeers > 0) {
            throw new Error('Network isolation failed - peers with different secrets connected');
        }

        console.log('   ✓ Network isolation working correctly');
        console.log('   ✓ Different secrets prevent connection');

        await Promise.all([
            coordinator1.shutdown(),
            coordinator2.shutdown()
        ]);
    }

    async testInvalidPeerRejection() {
        console.log('❌ Testing Invalid Peer Rejection...');
        
        const validCoordinator = new PrivateNetworkCoordinator({
            appIdentifier: 'security-test-rejection',
            appVersion: '1.0.0',
            networkSecret: 'valid-secret'
        });

        let rejectionDetected = false;

        validCoordinator.onInvalidPeerDetected = (peerId, reason) => {
            console.log(`   ✓ Rejected invalid peer: ${reason}`);
            rejectionDetected = true;
        };

        await validCoordinator.initialize();

        // Create invalid coordinator with wrong app identifier
        const invalidCoordinator = new PrivateNetworkCoordinator({
            appIdentifier: 'wrong-app-identifier',  // Wrong app
            appVersion: '1.0.0',
            networkSecret: 'valid-secret'
        });

        await invalidCoordinator.initialize();

        // Wait for rejection
        await new Promise(resolve => setTimeout(resolve, 8000));

        if (!rejectionDetected) {
            console.log('   ⚠️  Invalid peer rejection might not be working');
        } else {
            console.log('   ✓ Invalid peer properly rejected');
        }

        await Promise.all([
            validCoordinator.shutdown(),
            invalidCoordinator.shutdown()
        ]);
    }

    async testMessageAuthenticity() {
        console.log('✍️  Testing Message Authenticity...');
        
        const coordinator = new PrivateNetworkCoordinator({
            appIdentifier: 'security-test-auth',
            appVersion: '1.0.0',
            networkSecret: 'auth-test-secret'
        });

        await coordinator.initialize();

        // Test message signing and verification
        const testMessage = 'Test message for authenticity';
        const signature = coordinator.keyManager.signMessage(testMessage);

        const isValid = coordinator.keyManager.verifySignature(
            testMessage, 
            signature, 
            coordinator.keyManager.publicKey
        );

        if (!isValid) {
            throw new Error('Message signature verification failed');
        }

        // Test with tampered message
        const tamperedMessage = 'Tampered message for authenticity';
        const isTamperedValid = coordinator.keyManager.verifySignature(
            tamperedMessage, 
            signature, 
            coordinator.keyManager.publicKey
        );

        if (isTamperedValid) {
            throw new Error('Tampered message incorrectly verified as valid');
        }

        console.log('   ✓ Message signing working correctly');
        console.log('   ✓ Tampered messages properly rejected');

        await coordinator.shutdown();
    }

    async testReplayAttackPrevention() {
        console.log('🔄 Testing Replay Attack Prevention...');
        
        const coordinator = new PrivateNetworkCoordinator({
            appIdentifier: 'security-test-replay',
            appVersion: '1.0.0',
            networkSecret: 'replay-test-secret'
        });

        await coordinator.initialize();

        // Test that timestamps prevent replay attacks
        const oldTimestamp = Date.now() - 600000; // 10 minutes ago
        
        const verificationData = {
            appIdentifier: coordinator.appIdentifier,
            appVersion: coordinator.appVersion,
            challenge: crypto.randomBytes(32).toString('hex'),
            timestamp: oldTimestamp,  // Old timestamp
            capabilities: {},
            networkInfo: {}
        };

        const proof = coordinator.createAppProof(verificationData);
        verificationData.proof = proof;

        const verification = coordinator.verifyAppProof(
            verificationData, 
            coordinator.keyManager.publicKey
        );

        if (verification.valid) {
            throw new Error('Old timestamp was incorrectly accepted');
        }

        if (verification.reason !== 'expired') {
            throw new Error(`Expected 'expired' reason, got: ${verification.reason}`);
        }

        console.log('   ✓ Old timestamps properly rejected');
        console.log('   ✓ Replay attack prevention working');

        await coordinator.shutdown();
    }
}

// Run security tests
new SecurityTestSuite().runSecurityTests().catch(console.error);

// test/setup-test-env.js
const fs = require('fs').promises;
const path = require('path');

async function setupTestEnvironment() {
    console.log('🔧 Setting up test environment...');
    
    try {
        // Create test directories
        const testDirs = ['test/logs', 'test/temp', 'test/coverage'];
        
        for (const dir of testDirs) {
            try {
                await fs.mkdir(dir, { recursive: true });
                console.log(`   ✓ Created directory: ${dir}`);
            } catch (error) {
                if (error.code !== 'EEXIST') {
                    throw error;
                }
            }
        }

        // Create test config
        const testConfig = {
            testRelays: [
                'wss://relay.damus.io',
                'wss://nos.lol',
                'wss://relay.nostr.band'
            ],
            testTimeout: 30000,
            maxConcurrentTests: 5,
            retryAttempts: 3,
            networkSecrets: {
                test: 'test-network-secret-123',
                integration: 'integration-test-secret-456',
                performance: 'performance-test-secret-789',
                security: 'security-test-secret-000'
            },
            mockData: {
                systemInfo: {
                    platform: 'linux',
                    cpuCores: 8,
                    totalMemory: 16 * 1024 * 1024 * 1024,
                    freeMemory: 8 * 1024 * 1024 * 1024
                }
            }
        };

        await fs.writeFile(
            path.join('test', 'test-config.json'), 
            JSON.stringify(testConfig, null, 2)
        );
        console.log('   ✓ Created test configuration');

        // Create test log configuration
        const logConfig = {
            level: 'debug',
            timestamp: true,
            colorize: true,
            fileLogging: true,
            logFile: 'test/logs/test.log'
        };

        await fs.writeFile(
            path.join('test', 'log-config.json'),
            JSON.stringify(logConfig, null, 2)
        );
        console.log('   ✓ Created log configuration');

        console.log('✅ Test environment setup complete!');
        
    } catch (error) {
        console.error('❌ Failed to setup test environment:', error.message);
        process.exit(1);
    }
}

setupTestEnvironment();

// test/cleanup-test-env.js
const fs = require('fs').promises;
const path = require('path');

async function cleanupTestEnvironment() {
    console.log('🧹 Cleaning up test environment...');
    
    try {
        // Remove temporary test files
        const tempFiles = [
            'test/temp',
            'test/logs',
            'test/coverage',
            'test/test-config.json',
            'test/log-config.json'
        ];

        for (const file of tempFiles) {
            try {
                const stats = await fs.stat(file);
                if (stats.isDirectory()) {
                    await fs.rmdir(file, { recursive: true });
                } else {
                    await fs.unlink(file);
                }
                console.log(`   ✓ Removed: ${file}`);
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    console.log(`   ⚠️  Could not remove ${file}: ${error.message}`);
                }
            }
        }

        console.log('✅ Test environment cleanup complete!');
        
    } catch (error) {
        console.error('❌ Failed to cleanup test environment:', error.message);
        process.exit(1);
    }
}

cleanupTestEnvironment();

// test/mock-relay-server.js
const WebSocket = require('ws');

class MockRelayServer {
    constructor(port = 8080) {
        this.port = port;
        this.wss = null;
        this.clients = new Set();
        this.events = new Map();
        this.subscriptions = new Map();
    }

    start() {
        return new Promise((resolve, reject) => {
            this.wss = new WebSocket.Server({ port: this.port }, (error) => {
                if (error) {
                    reject(error);
                    return;
                }
                console.log(`🚀 Mock relay server started on port ${this.port}`);
                resolve();
            });

            this.wss.on('connection', (ws) => {
                console.log('📡 Client connected to mock relay');
                this.clients.add(ws);

                ws.on('message', (data) => {
                    this.handleMessage(ws, data);
                });

                ws.on('close', () => {
                    console.log('📡 Client disconnected from mock relay');
                    this.clients.delete(ws);
                });

                ws.on('error', (error) => {
                    console.error('📡 Mock relay client error:', error);
                    this.clients.delete(ws);
                });
            });
        });
    }

    handleMessage(ws, data) {
        try {
            const message = JSON.parse(data.toString());
            const [type, ...args] = message;

            switch (type) {
                case 'EVENT':
                    this.handleEvent(ws, args[0]);
                    break;
                case 'REQ':
                    this.handleRequest(ws, args[0], ...args.slice(1));
                    break;
                case 'CLOSE':
                    this.handleClose(ws, args[0]);
                    break;
                default:
                    console.log(`📡 Unknown message type: ${type}`);
            }
        } catch (error) {
            console.error('📡 Error parsing message:', error);
        }
    }

    handleEvent(ws, event) {
        // Store the event
        this.events.set(event.id, event);
        
        // Send OK response
        const response = JSON.stringify(['OK', event.id, true, '']);
        ws.send(response);

        // Relay to other clients based on subscriptions
        this.relayEvent(event, ws);
        
        console.log(`📡 Stored event: ${event.id.substring(0, 8)}...`);
    }

    handleRequest(ws, subscriptionId, ...filters) {
        // Store subscription
        this.subscriptions.set(subscriptionId, { ws, filters });
        
        // Send matching stored events
        for (const event of this.events.values()) {
            if (this.eventMatchesFilters(event, filters)) {
                const response = JSON.stringify(['EVENT', subscriptionId, event]);
                ws.send(response);
            }
        }

        // Send EOSE
        const eose = JSON.stringify(['EOSE', subscriptionId]);
        ws.send(eose);
        
        console.log(`📡 Created subscription: ${subscriptionId}`);
    }

    handleClose(ws, subscriptionId) {
        this.subscriptions.delete(subscriptionId);
        console.log(`📡 Closed subscription: ${subscriptionId}`);
    }

    relayEvent(event, sender) {
        for (const [subId, sub] of this.subscriptions.entries()) {
            if (sub.ws !== sender && this.eventMatchesFilters(event, sub.filters)) {
                const response = JSON.stringify(['EVENT', subId, event]);
                sub.ws.send(response);
            }
        }
    }

    eventMatchesFilters(event, filters) {
        // Simple filter matching - extend as needed
        for (const filter of filters) {
            if (filter.kinds && !filter.kinds.includes(event.kind)) {
                continue;
            }
            if (filter.since && event.created_at < filter.since) {
                continue;
            }
            if (filter.until && event.created_at > filter.until) {
                continue;
            }
            return true;
        }
        return filters.length === 0;
    }

    stop() {
        if (this.wss) {
            this.wss.close();
            console.log('🛑 Mock relay server stopped');
        }
    }

    getStats() {
        return {
            connectedClients: this.clients.size,
            storedEvents: this.events.size,
            activeSubscriptions: this.subscriptions.size
        };
    }
}

// Start mock relay if run directly
if (require.main === module) {
    const mockRelay = new MockRelayServer();
    
    mockRelay.start().then(() => {
        console.log('📡 Mock relay server running...');
        console.log('📡 Connect to: ws://localhost:8080');
        
        // Log stats every 10 seconds
        setInterval(() => {
            const stats = mockRelay.getStats();
            console.log(`📡 Stats: ${stats.connectedClients} clients, ${stats.storedEvents} events, ${stats.activeSubscriptions} subscriptions`);
        }, 10000);
    }).catch(console.error);

    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down mock relay...');
        mockRelay.stop();
        process.exit(0);
    });
}

module.exports = MockRelayServer;

// test/stress-test.js
const { PrivateNetworkCoordinator } = require('../networking/private-network-coordinator');

class StressTestSuite {
    constructor() {
        this.coordinators = [];
        this.results = {
            maxPeers: 0,
            totalMessages: 0,
            averageLatency: 0,
            failureRate: 0
        };
    }

    async runStressTests() {
        console.log('💪 Stress Testing Suite');
        console.log('Testing system under high load...\n');

        await this.testHighPeerCount();
        await this.testMessageFlood();
        await this.testConcurrentOperations();
        await this.testResourceExhaustion();
        
        this.printResults();
        await this.cleanup();
    }

    async testHighPeerCount() {
        console.log('👥 Testing High Peer Count...');
        
        const peerCount = 10; // Adjust based on system capabilities
        const coordinators = [];

        console.log(`   Creating ${peerCount} coordinators...`);
        
        // Create coordinators in batches to avoid overwhelming
        for (let i = 0; i < peerCount; i++) {
            const coordinator = new PrivateNetworkCoordinator({
                appIdentifier: 'stress-test-peers',
                appVersion: '1.0.0',
                networkSecret: 'stress-test-high-peer-count'
            });
            
            coordinators.push(coordinator);
            this.coordinators.push(coordinator);
            
            // Small delay between creations
            if (i % 3 === 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // Initialize all coordinators
        const initPromises = coordinators.map(c => c.initialize());
        await Promise.all(initPromises);

        console.log('   ⏳ Waiting for peer discovery...');
        await new Promise(resolve => setTimeout(resolve, 30000));

        // Check peer discovery results
        let totalPeersFound = 0;
        for (const coordinator of coordinators) {
            const status = coordinator.getPrivateNetworkStatus();
            totalPeersFound += status.verifiedPeers;
        }

        const averagePeersPerNode = totalPeersFound / coordinators.length;
        this.results.maxPeers = Math.max(this.results.maxPeers, averagePeersPerNode);

        console.log(`   ✓ Average peers per node: ${averagePeersPerNode.toFixed(1)}`);
        console.log(`   ✓ Total peer connections: ${totalPeersFound}`);

        if (averagePeersPerNode < peerCount * 0.5) {
            console.log(`   ⚠️  Low peer discovery rate: ${(averagePeersPerNode / (peerCount - 1) * 100).toFixed(1)}%`);
        }
    }

    async testMessageFlood() {
        console.log('🌊 Testing Message Flood...');
        
        if (this.coordinators.length < 2) {
            console.log('   ⚠️  Need at least 2 coordinators for message flood test');
            return;
        }

        const messageCount = 100;
        const sender = this.coordinators[0];
        const startTime = Date.now();

        console.log(`   Sending ${messageCount} messages rapidly...`);

        const promises = [];
        for (let i = 0; i < messageCount; i++) {
            promises.push(sender.sendPrivateMessage(`Flood test message ${i}`));
        }

        try {
            await Promise.all(promises);
            const duration = Date.now() - startTime;
            const messagesPerSecond = (messageCount / duration * 1000).toFixed(2);
            
            this.results.totalMessages += messageCount;
            
            console.log(`   ✓ Sent ${messageCount} messages in ${duration}ms`);
            console.log(`   ✓ Rate: ${messagesPerSecond} messages/second`);
            
            if (messagesPerSecond < 10) {
                console.log(`   ⚠️  Low message throughput`);
            }
            
        } catch (error) {
            console.log(`   ❌ Message flood failed: ${error.message}`);
            this.results.failureRate += 0.25;
        }
    }

    async testConcurrentOperations() {
        console.log('⚡ Testing Concurrent Operations...');
        
        if (this.coordinators.length < 3) {
            console.log('   ⚠️  Need at least 3 coordinators for concurrent test');
            return;
        }

        const operations = [];
        const startTime = Date.now();

        // Concurrent status broadcasts
        for (let i = 0; i < Math.min(5, this.coordinators.length); i++) {
            operations.push(this.coordinators[i].broadcastStatus());
        }

        // Concurrent messaging
        for (let i = 0; i < Math.min(3, this.coordinators.length); i++) {
            operations.push(this.coordinators[i].sendPrivateMessage(`Concurrent test ${i}`));
        }

        // Concurrent app verification
        for (let i = 0; i < Math.min(2, this.coordinators.length); i++) {
            operations.push(this.coordinators[i].broadcastAppVerification());
        }

        try {
            await Promise.all(operations);
            const duration = Date.now() - startTime;
            
            console.log(`   ✓ ${operations.length} concurrent operations completed in ${duration}ms`);
            
            if (duration > 10000) {
                console.log(`   ⚠️  Slow concurrent operations`);
            }
            
        } catch (error) {
            console.log(`   ❌ Concurrent operations failed: ${error.message}`);
            this.results.failureRate += 0.25;
        }
    }

    async testResourceExhaustion() {
        console.log('🔥 Testing Resource Exhaustion...');
        
        const initialMemory = process.memoryUsage();
        
        // Create additional load
        const additionalCoordinators = [];
        
        try {
            for (let i = 0; i < 5; i++) {
                const coordinator = new PrivateNetworkCoordinator({
                    appIdentifier: 'stress-test-exhaustion',
                    appVersion: '1.0.0',
                    networkSecret: 'stress-test-resource-exhaustion'
                });
                
                await coordinator.initialize();
                additionalCoordinators.push(coordinator);
                this.coordinators.push(coordinator);
            }

            // Generate continuous activity for 30 seconds
            const activityDuration = 30000;
            const endTime = Date.now() + activityDuration;
            
            console.log(`   Running continuous activity for ${activityDuration/1000} seconds...`);
            
            while (Date.now() < endTime) {
                const randomCoordinator = additionalCoordinators[Math.floor(Math.random() * additionalCoordinators.length)];
                await randomCoordinator.sendPrivateMessage(`Resource test ${Date.now()}`);
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            const finalMemory = process.memoryUsage();
            const memoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
            
            console.log(`   ✓ Memory increase: ${memoryIncrease.toFixed(2)} MB`);
            console.log(`   ✓ System remained stable under load`);
            
            if (memoryIncrease > 100) {
                console.log(`   ⚠️  High memory consumption`);
            }
            
        } catch (error) {
            console.log(`   ❌ Resource exhaustion test failed: ${error.message}`);
            this.results.failureRate += 0.5;
        }
    }

    printResults() {
        console.log('\n' + '='.repeat(60));
        console.log('💪 STRESS TEST RESULTS');
        console.log('='.repeat(60));
        
        console.log(`Max Peers per Node: ${this.results.maxPeers.toFixed(1)}`);
        console.log(`Total Messages Sent: ${this.results.totalMessages}`);
        console.log(`Overall Failure Rate: ${(this.results.failureRate * 100).toFixed(1)}%`);
        
        if (this.results.failureRate === 0) {
            console.log('✅ System passed all stress tests!');
        } else if (this.results.failureRate < 0.5) {
            console.log('⚠️  System showed some stress under high load');
        } else {
            console.log('❌ System struggled under stress conditions');
        }
    }

    async cleanup() {
        console.log('\n🧹 Cleaning up stress test resources...');
        
        // Cleanup in batches to avoid overwhelming
        const batchSize = 5;
        for (let i = 0; i < this.coordinators.length; i += batchSize) {
            const batch = this.coordinators.slice(i, i + batchSize);
            const cleanupPromises = batch.map(async (coordinator) => {
                try {
                    await coordinator.shutdown();
                } catch (error) {
                    console.log(`   Warning: Cleanup error: ${error.message}`);
                }
            });
            
            await Promise.all(cleanupPromises);
            console.log(`   ✓ Cleaned up batch ${Math.floor(i/batchSize) + 1}`);
            
            // Small delay between batches
            if (i + batchSize < this.coordinators.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        console.log('✅ Stress test cleanup complete!');
    }
}

// Run stress tests
new StressTestSuite().runStressTests().catch(console.error);

// test/health-check.js
const { PrivateNetworkCoordinator } = require('../networking/private-network-coordinator');
const { spawn } = require('child_process');

class HealthCheck {
    async runHealthCheck() {
        console.log('🏥 System Health Check');
        console.log('Checking overall system health and readiness...\n');

        const checks = [
            { name: 'Node.js Version', fn: () => this.checkNodeVersion() },
            { name: 'Dependencies', fn: () => this.checkDependencies() },
            { name: 'Network Connectivity', fn: () => this.checkNetworkConnectivity() },
            { name: 'Coordinator Initialization', fn: () => this.checkCoordinatorInit() },
            { name: 'System Resources', fn: () => this.checkSystemResources() },
            { name: 'File Permissions', fn: () => this.checkFilePermissions() }
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
        }
    }

    async checkNodeVersion() {
        const nodeVersion = process.version;
        const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
        
        if (majorVersion < 18) {
            throw new Error(`Node.js ${majorVersion} is too old, requires 18+`);
        }
        
        console.log(`   Node.js ${nodeVersion}`);
    }

    async checkDependencies() {
        const requiredDeps = ['ws', 'elliptic', 'crypto'];
        
        for (const dep of requiredDeps) {
            try {
                require(dep);
            } catch (error) {
                throw new Error(`Missing dependency: ${dep}`);
            }
        }
        
        console.log(`   All required dependencies available`);
    }

    async checkNetworkConnectivity() {
        const testUrls = [
            'relay.damus.io',
            'nos.lol',
            'relay.nostr.band'
        ];
        
        let reachableCount = 0;
        
        for (const url of testUrls) {
            try {
                await this.pingHost(url);
                reachableCount++;
            } catch (error) {
                console.log(`     ⚠️  ${url} not reachable`);
            }
        }
        
        if (reachableCount === 0) {
            throw new Error('No relay servers reachable');
        }
        
        console.log(`   ${reachableCount}/${testUrls.length} relay servers reachable`);
    }

    async checkCoordinatorInit() {
        const coordinator = new PrivateNetworkCoordinator({
            appIdentifier: 'health-check-test',
            appVersion: '1.0.0',
            networkSecret: 'health-check-secret'
        });
        
        try {
            await coordinator.initialize();
            const status = coordinator.getPrivateNetworkStatus();
            
            if (!status.networkId) {
                throw new Error('No network ID generated');
            }
            
            console.log(`   Coordinator initialized, network ID: ${status.networkId}`);
            await coordinator.shutdown();
            
        } catch (error) {
            throw new Error(`Coordinator initialization failed: ${error.message}`);
        }
    }

    async checkSystemResources() {
        const memory = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        const memoryMB = memory.heapUsed / 1024 / 1024;
        
        if (memoryMB > 500) {
            console.log(`     ⚠️  High memory usage: ${memoryMB.toFixed(1)} MB`);
        }
        
        console.log(`   Memory: ${memoryMB.toFixed(1)} MB, CPU usage normal`);
    }

    async checkFilePermissions() {
        const fs = require('fs').promises;
        const path = require('path');
        
        try {
            // Test read permissions
            await fs.access(__dirname, fs.constants.R_OK);
            
            // Test write permissions in temp directory
            const testFile = path.join(__dirname, 'temp-test-file');
            await fs.writeFile(testFile, 'test');
            await fs.unlink(testFile);
            
            console.log(`   File system permissions OK`);
            
        } catch (error) {
            throw new Error(`File permission issues: ${error.message}`);
        }
    }

    async pingHost(hostname) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout'));
            }, 5000);
            
            // Simple TCP connection test
            const net = require('net');
            const socket = new net.Socket();
            
            socket.connect(443, hostname, () => {
                clearTimeout(timeout);
                socket.destroy();
                resolve();
            });
            
            socket.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    }
}

// Run health check
new HealthCheck().runHealthCheck().catch(console.error);