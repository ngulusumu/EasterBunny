// test/network-testing-suite.js
const { PrivateNetworkCoordinator } = require('../networking/private-network-coordinator');
const { NostrKeyManager } = require('../networking/coordination-system');

class NetworkTestSuite {
    constructor() {
        this.testResults = [];
        this.coordinators = [];
        this.testTimeout = 30000; // 30 seconds per test
    }

    async runAllTests() {
        console.log('🧪 Starting Network Testing Suite...\n');
        
        const tests = [
            { name: 'Key Generation', fn: () => this.testKeyGeneration() },
            { name: 'Single Instance Initialization', fn: () => this.testSingleInstance() },
            { name: 'Dual Instance Discovery', fn: () => this.testDualInstanceDiscovery() },
            { name: 'Peer Verification', fn: () => this.testPeerVerification() },
            { name: 'Invalid Peer Rejection', fn: () => this.testInvalidPeerRejection() },
            { name: 'Status Broadcasting', fn: () => this.testStatusBroadcasting() },
            { name: 'Group Messaging', fn: () => this.testGroupMessaging() },
            { name: 'Network Isolation Detection', fn: () => this.testNetworkIsolation() },
            { name: 'Graceful Shutdown', fn: () => this.testGracefulShutdown() }
        ];

        for (const test of tests) {
            await this.runSingleTest(test.name, test.fn);
        }

        this.printTestSummary();
        await this.cleanup();
    }

    async runSingleTest(testName, testFn) {
        console.log(`\n🔬 Running Test: ${testName}`);
        console.log('─'.repeat(50));
        
        const startTime = Date.now();
        
        try {
            const result = await Promise.race([
                testFn(),
                this.createTimeout(this.testTimeout, `Test "${testName}" timed out`)
            ]);
            
            const duration = Date.now() - startTime;
            console.log(`✅ PASSED: ${testName} (${duration}ms)`);
            
            this.testResults.push({
                name: testName,
                status: 'PASSED',
                duration: duration,
                details: result
            });
            
        } catch (error) {
            const duration = Date.now() - startTime;
            console.log(`❌ FAILED: ${testName} (${duration}ms)`);
            console.log(`   Error: ${error.message}`);
            
            this.testResults.push({
                name: testName,
                status: 'FAILED',
                duration: duration,
                error: error.message
            });
        }
    }

    createTimeout(ms, message) {
        return new Promise((_, reject) => {
            setTimeout(() => reject(new Error(message)), ms);
        });
    }

    // Test 1: Key Generation
    async testKeyGeneration() {
        console.log('Testing cryptographic key generation...');
        
        const keyManager = new NostrKeyManager();
        await keyManager.initialize();
        
        if (!keyManager.publicKey || !keyManager.privateKey) {
            throw new Error('Failed to generate keys');
        }
        
        if (keyManager.publicKey.length !== 64) {
            throw new Error('Invalid public key length');
        }
        
        if (keyManager.privateKey.length !== 64) {
            throw new Error('Invalid private key length');
        }
        
        // Test signing
        const message = 'test message';
        const signature = keyManager.signMessage(message);
        const isValid = keyManager.verifySignature(message, signature, keyManager.publicKey);
        
        if (!isValid) {
            throw new Error('Failed to verify own signature');
        }
        
        console.log(`   ✓ Generated keys: ${keyManager.publicKey.substring(0, 16)}...`);
        console.log(`   ✓ Signature verification working`);
        
        return { publicKey: keyManager.publicKey.substring(0, 16) };
    }

    // Test 2: Single Instance Initialization
    async testSingleInstance() {
        console.log('Testing single coordinator instance...');
        
        const coordinator = new PrivateNetworkCoordinator({
            appIdentifier: 'test-mkenyatool-network',
            appVersion: '1.0.0-test',
            networkSecret: 'test-network-secret-123'
        });
        
        await coordinator.initialize();
        this.coordinators.push(coordinator);
        
        const status = coordinator.getPrivateNetworkStatus();
        
        if (!status.networkId) {
            throw new Error('No network ID generated');
        }
        
        if (status.verifiedPeers !== 0) {
            throw new Error('Should have 0 verified peers initially');
        }
        
        console.log(`   ✓ Network ID: ${status.networkId}`);
        console.log(`   ✓ Connected to ${status.connectedRelays} relays`);
        console.log(`   ✓ Public key: ${status.myPublicKey.substring(0, 16)}...`);
        
        return status;
    }

    // Test 3: Dual Instance Discovery
    async testDualInstanceDiscovery() {
        console.log('Testing peer discovery between two instances...');
        
        // Create second coordinator with same network config
        const coordinator2 = new PrivateNetworkCoordinator({
            appIdentifier: 'test-mkenyatool-network',
            appVersion: '1.0.0-test',
            networkSecret: 'test-network-secret-123'
        });
        
        let peer1Verified = false;
        let peer2Verified = false;
        
        // Set up event listeners
        const coordinator1 = this.coordinators[0];
        
        coordinator1.onPeerVerified = (peerId, data) => {
            console.log(`   ✓ Coordinator 1 verified peer: ${peerId.substring(0, 8)}...`);
            peer1Verified = true;
        };
        
        coordinator2.onPeerVerified = (peerId, data) => {
            console.log(`   ✓ Coordinator 2 verified peer: ${peerId.substring(0, 8)}...`);
            peer2Verified = true;
        };
        
        await coordinator2.initialize();
        this.coordinators.push(coordinator2);
        
        // Wait for mutual discovery
        await this.waitForCondition(() => peer1Verified && peer2Verified, 15000);
        
        const status1 = coordinator1.getPrivateNetworkStatus();
        const status2 = coordinator2.getPrivateNetworkStatus();
        
        if (status1.verifiedPeers !== 1 || status2.verifiedPeers !== 1) {
            throw new Error('Peers did not discover each other');
        }
        
        console.log(`   ✓ Mutual peer discovery completed`);
        console.log(`   ✓ Both coordinators have 1 verified peer`);
        
        return { 
            coordinator1Peers: status1.verifiedPeers, 
            coordinator2Peers: status2.verifiedPeers 
        };
    }

    // Test 4: Peer Verification
    async testPeerVerification() {
        console.log('Testing peer verification process...');
        
        const coordinator1 = this.coordinators[0];
        const coordinator2 = this.coordinators[1];
        
        // Force re-verification
        await coordinator1.broadcastAppVerification();
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const status1 = coordinator1.getPrivateNetworkStatus();
        const status2 = coordinator2.getPrivateNetworkStatus();
        
        if (status1.verifiedPeers === 0 || status2.verifiedPeers === 0) {
            throw new Error('Verification failed');
        }
        
        // Check that both can see each other's network ID
        if (status1.networkId !== status2.networkId) {
            throw new Error('Network IDs do not match');
        }
        
        console.log(`   ✓ Network ID consistency: ${status1.networkId}`);
        console.log(`   ✓ Peer verification successful`);
        
        return { networkId: status1.networkId };
    }

    // Test 5: Invalid Peer Rejection
    async testInvalidPeerRejection() {
        console.log('Testing rejection of invalid peers...');
        
        // Create coordinator with different network secret
        const fakeCoordinator = new PrivateNetworkCoordinator({
            appIdentifier: 'test-mkenyatool-network',
            appVersion: '1.0.0-test',
            networkSecret: 'wrong-network-secret-456' // Different secret
        });
        
        let invalidPeerDetected = false;
        
        this.coordinators[0].onInvalidPeerDetected = (peerId, reason) => {
            console.log(`   ✓ Invalid peer rejected: ${peerId.substring(0, 8)}... (${reason})`);
            invalidPeerDetected = true;
        };
        
        await fakeCoordinator.initialize();
        
        // Wait a bit for the rejection to happen
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // The fake coordinator should not be verified by legitimate peers
        const status1 = this.coordinators[0].getPrivateNetworkStatus();
        
        if (status1.verifiedPeers > 1) {
            throw new Error('Invalid peer was incorrectly verified');
        }
        
        await fakeCoordinator.shutdown();
        
        console.log(`   ✓ Invalid peer properly rejected`);
        console.log(`   ✓ Network security maintained`);
        
        return { invalidPeerDetected };
    }

    // Test 6: Status Broadcasting
    async testStatusBroadcasting() {
        console.log('Testing status broadcasting...');
        
        let statusUpdateReceived = false;
        
        this.coordinators[1].onVerifiedPeerStatusUpdate = (peerId, statusData) => {
            console.log(`   ✓ Status update received from: ${peerId.substring(0, 8)}...`);
            statusUpdateReceived = true;
        };
        
        // Force status broadcast
        await this.coordinators[0].broadcastStatus();
        
        // Wait for status update
        await this.waitForCondition(() => statusUpdateReceived, 10000);
        
        console.log(`   ✓ Status broadcasting working`);
        
        return { statusUpdateReceived };
    }

    // Test 7: Group Messaging
    async testGroupMessaging() {
        console.log('Testing group messaging...');
        
        let messageReceived = false;
        const testMessage = `Test message ${Date.now()}`;
        
        this.coordinators[1].handlePrivateChat = (event) => {
            const messageData = JSON.parse(event.content);
            if (messageData.content === testMessage) {
                console.log(`   ✓ Message received: "${messageData.content}"`);
                messageReceived = true;
            }
        };
        
        // Send message from coordinator 1
        await this.coordinators[0].sendPrivateMessage(testMessage);
        
        // Wait for message
        await this.waitForCondition(() => messageReceived, 10000);
        
        console.log(`   ✓ Group messaging working`);
        
        return { messageReceived };
    }

    // Test 8: Network Isolation Detection
    async testNetworkIsolation() {
        console.log('Testing network isolation detection...');
        
        // Simulate isolation by disconnecting all relays from coordinator 2
        const coordinator2 = this.coordinators[1];
        coordinator2.relays.forEach(relay => relay.disconnect());
        
        let isolationDetected = false;
        
        coordinator2.onNetworkIsolated = () => {
            console.log(`   ✓ Network isolation detected`);
            isolationDetected = true;
        };
        
        // Wait for isolation detection
        await this.waitForCondition(() => isolationDetected, 15000);
        
        console.log(`   ✓ Isolation detection working`);
        
        return { isolationDetected };
    }

    // Test 9: Graceful Shutdown
    async testGracefulShutdown() {
        console.log('Testing graceful shutdown...');
        
        const coordinator = this.coordinators[0];
        const initialRelayCount = coordinator.relays.length;
        
        await coordinator.shutdown();
        
        const finalRelayCount = coordinator.relays.length;
        
        if (finalRelayCount !== 0) {
            throw new Error('Relays not properly disconnected');
        }
        
        console.log(`   ✓ ${initialRelayCount} relays disconnected`);
        console.log(`   ✓ Graceful shutdown completed`);
        
        return { relaysDisconnected: initialRelayCount };
    }

    async waitForCondition(condition, timeoutMs) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeoutMs) {
            if (condition()) {
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        throw new Error(`Condition not met within ${timeoutMs}ms`);
    }

    printTestSummary() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 TEST SUMMARY');
        console.log('='.repeat(60));
        
        const passed = this.testResults.filter(r => r.status === 'PASSED').length;
        const failed = this.testResults.filter(r => r.status === 'FAILED').length;
        const total = this.testResults.length;
        
        console.log(`Total Tests: ${total}`);
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
        
        if (failed > 0) {
            console.log('\n❌ FAILED TESTS:');
            this.testResults
                .filter(r => r.status === 'FAILED')
                .forEach(r => {
                    console.log(`   • ${r.name}: ${r.error}`);
                });
        }
        
        console.log('\n⏱️  TIMING:');
        this.testResults.forEach(r => {
            const status = r.status === 'PASSED' ? '✅' : '❌';
            console.log(`   ${status} ${r.name}: ${r.duration}ms`);
        });
    }

    async cleanup() {
        console.log('\n🧹 Cleaning up test resources...');
        
        for (const coordinator of this.coordinators) {
            try {
                await coordinator.shutdown();
            } catch (error) {
                console.log(`   Warning: Error during cleanup: ${error.message}`);
            }
        }
        
        this.coordinators = [];
        console.log('   ✓ All coordinators shut down');
    }
}

// Manual Testing Helper
class ManualTestHelper {
    static async createTestInstance(instanceName) {
        console.log(`\n🚀 Creating test instance: ${instanceName}`);
        
        const coordinator = new PrivateNetworkCoordinator({
            appIdentifier: 'manual-test-mkenyatool',
            appVersion: '1.0.0-manual',
            networkSecret: 'manual-test-secret-shared'
        });
        
        // Set up event logging
        coordinator.onPeerVerified = (peerId, data) => {
            console.log(`[${instanceName}] ✅ Verified peer: ${peerId.substring(0, 8)}... (${data.appVersion})`);
        };
        
        coordinator.onInvalidPeerDetected = (peerId, reason) => {
            console.log(`[${instanceName}] ❌ Rejected peer: ${peerId.substring(0, 8)}... (${reason})`);
        };
        
        coordinator.onVerifiedPeerStatusUpdate = (peerId, statusData) => {
            console.log(`[${instanceName}] 📊 Status update from: ${peerId.substring(0, 8)}...`);
        };
        
        coordinator.onNetworkIsolated = () => {
            console.log(`[${instanceName}] 🏝️  Network isolated - no peers found`);
        };
        
        coordinator.onNetworkReconnected = () => {
            console.log(`[${instanceName}] 🌐 Network reconnected - peers found`);
        };
        
        await coordinator.initialize();
        
        const status = coordinator.getPrivateNetworkStatus();
        console.log(`[${instanceName}] Network ID: ${status.networkId}`);
        console.log(`[${instanceName}] Public Key: ${status.myPublicKey.substring(0, 16)}...`);
        console.log(`[${instanceName}] Connected to ${status.connectedRelays} relays`);
        
        return coordinator;
    }
    
    static logNetworkStatus(coordinator, instanceName) {
        const status = coordinator.getPrivateNetworkStatus();
        console.log(`\n[${instanceName}] Network Status:`);
        console.log(`   Verified Peers: ${status.verifiedPeers}`);
        console.log(`   Connected Relays: ${status.connectedRelays}`);
        console.log(`   Isolated Mode: ${status.isolatedMode}`);
        console.log(`   Last Peer Contact: ${status.lastPeerContact ? new Date(status.lastPeerContact).toLocaleTimeString() : 'Never'}`);
        
        if (status.peerList.length > 0) {
            console.log(`   Peer List:`);
            status.peerList.forEach(peer => {
                console.log(`     - ${peer.shortId}: ${peer.status} (last seen: ${new Date(peer.lastSeen).toLocaleTimeString()})`);
            });
        }
    }
}

module.exports = { NetworkTestSuite, ManualTestHelper };