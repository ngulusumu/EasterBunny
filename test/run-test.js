// test/run-tests.js
const { NetworkTestSuite, ManualTestHelper } = require('./network-testing-suite');

async function runAutomatedTests() {
    const testSuite = new NetworkTestSuite();
    await testSuite.runAllTests();
}

async function runManualTest() {
    console.log('🧪 Manual Network Testing');
    console.log('This will create two coordinators and let you observe their interaction');
    console.log('Press Ctrl+C to stop\n');
    
    const coordinator1 = await ManualTestHelper.createTestInstance('Instance-A');
    
    // Wait a bit, then create second instance
    setTimeout(async () => {
        const coordinator2 = await ManualTestHelper.createTestInstance('Instance-B');
        
        // Log status every 10 seconds
        setInterval(() => {
            ManualTestHelper.logNetworkStatus(coordinator1, 'Instance-A');
            ManualTestHelper.logNetworkStatus(coordinator2, 'Instance-B');
        }, 10000);
        
        // Test messaging after 15 seconds
        setTimeout(async () => {
            console.log('\n📨 Testing group messaging...');
            await coordinator1.sendPrivateMessage('Hello from Instance A!');
            await coordinator2.sendPrivateMessage('Hello from Instance B!');
        }, 15000);
        
    }, 5000);
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down test instances...');
        await coordinator1.shutdown();
        await coordinator2.shutdown();
        process.exit(0);
    });
}

// Run based on command line argument
const testType = process.argv[2] || 'auto';

if (testType === 'manual') {
    runManualTest().catch(console.error);
} else {
    runAutomatedTests().catch(console.error);
}

// test/simple-connection-test.js
const { PrivateNetworkCoordinator } = require('../networking/private-network-coordinator');

async function simpleConnectionTest() {
    console.log('🔗 Simple Connection Test');
    console.log('Testing basic coordinator functionality...\n');
    
    try {
        // Create coordinator
        const coordinator = new PrivateNetworkCoordinator({
            appIdentifier: 'simple-test-app',
            appVersion: '1.0.0',
            networkSecret: 'test-secret-123'
        });
        
        console.log('⏳ Initializing coordinator...');
        await coordinator.initialize();
        
        console.log('✅ Coordinator initialized successfully!');
        
        // Get status
        const status = coordinator.getPrivateNetworkStatus();
        console.log('\n📊 Network Status:');
        console.log(`   Network ID: ${status.networkId}`);
        console.log(`   App: ${status.appIdentifier} v${status.appVersion}`);
        console.log(`   Public Key: ${status.myPublicKey.substring(0, 16)}...`);
        console.log(`   Connected Relays: ${status.connectedRelays}/${status.connectedRelays + (5 - status.connectedRelays)}`);
        console.log(`   Verified Peers: ${status.verifiedPeers}`);
        console.log(`   Isolated Mode: ${status.isolatedMode}`);
        
        // Wait for potential peer discovery
        console.log('\n⏳ Waiting 30 seconds for peer discovery...');
        await new Promise(resolve => setTimeout(resolve, 30000));
        
        const finalStatus = coordinator.getPrivateNetworkStatus();
        console.log('\n📊 Final Status:');
        console.log(`   Verified Peers: ${finalStatus.verifiedPeers}`);
        console.log(`   Last Peer Contact: ${finalStatus.lastPeerContact ? new Date(finalStatus.lastPeerContact).toLocaleString() : 'None'}`);
        
        if (finalStatus.verifiedPeers > 0) {
            console.log('🎉 Found other instances on the network!');
            finalStatus.peerList.forEach(peer => {
                console.log(`   - Peer ${peer.shortId}: ${peer.status}`);
            });
        } else {
            console.log('🏝️  No other instances found (isolated mode)');
        }
        
        // Cleanup
        console.log('\n🧹 Shutting down...');
        await coordinator.shutdown();
        console.log('✅ Test completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

simpleConnectionTest();

// test/relay-connection-test.js
const WebSocket = require('ws');

async function testRelayConnections() {
    console.log('🔗 Testing Relay Connections');
    console.log('Checking if Nostr relays are accessible...\n');
    
    const relays = [
        'wss://relay.damus.io',
        'wss://nos.lol',
        'wss://relay.nostr.band',
        'wss://nostr-pub.wellorder.net',
        'wss://relay.current.fyi'
    ];
    
    const results = [];
    
    for (const relayUrl of relays) {
        console.log(`Testing ${relayUrl}...`);
        
        try {
            const result = await testSingleRelay(relayUrl);
            results.push({ url: relayUrl, status: 'success', ...result });
            console.log(`   ✅ Connected successfully (${result.responseTime}ms)`);
        } catch (error) {
            results.push({ url: relayUrl, status: 'failed', error: error.message });
            console.log(`   ❌ Failed: ${error.message}`);
        }
    }
    
    console.log('\n📊 Summary:');
    const successful = results.filter(r => r.status === 'success').length;
    console.log(`   Successful: ${successful}/${relays.length}`);
    console.log(`   Success Rate: ${((successful / relays.length) * 100).toFixed(1)}%`);
    
    if (successful === 0) {
        console.log('\n❌ No relays accessible! Check your internet connection.');
        console.log('   The networking system requires at least one working relay.');
    } else if (successful < relays.length) {
        console.log('\n⚠️  Some relays are not accessible, but the system should still work.');
    } else {
        console.log('\n✅ All relays accessible! Network should work perfectly.');
    }
    
    return results;
}

function testSingleRelay(url) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const timeout = setTimeout(() => {
            ws.close();
            reject(new Error('Connection timeout'));
        }, 10000);
        
        const ws = new WebSocket(url);
        
        ws.on('open', () => {
            clearTimeout(timeout);
            const responseTime = Date.now() - startTime;
            ws.close();
            resolve({ responseTime });
        });
        
        ws.on('error', (error) => {
            clearTimeout(timeout);
            reject(new Error(`Connection error: ${error.message}`));
        });
        
        ws.on('close', (code) => {
            clearTimeout(timeout);
            if (code !== 1000) {
                reject(new Error(`Connection closed with code: ${code}`));
            }
        });
    });
}

testRelayConnections().catch(console.error);