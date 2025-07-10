// test/simple-connection-test.js

// Use test-compatible coordinator that doesn't rely on Electron
let PrivateNetworkCoordinator;
try {
    // Try to use the test-compatible version first
    const testCoordinator = require('./test-coordination-system');
    PrivateNetworkCoordinator = testCoordinator.TestPrivateNetworkCoordinator;
    console.log('ℹ️  Using test-compatible coordinator (Electron features disabled)');
} catch (error) {
    try {
        // Fallback to main networking directory
        const privateNetCoord = require('../networking/private-network-coordinator');
        PrivateNetworkCoordinator = privateNetCoord.PrivateNetworkCoordinator || privateNetCoord;
        console.log('ℹ️  Using main coordinator (requires Electron context)');
    } catch (error2) {
        console.error('❌ Could not find any coordinator module');
        console.error('   Make sure the networking files are in place');
        console.error('   Expected file: networking/private-network-coordinator.js');
        console.error('   Or create test/test-coordination-system.js for testing');
        process.exit(1);
    }
}

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
        console.log('   (Start another instance in a new terminal to test peer discovery)');
        
        let peerCheckCount = 0;
        const peerCheckInterval = setInterval(() => {
            peerCheckCount++;
            const currentStatus = coordinator.getPrivateNetworkStatus();
            if (currentStatus.verifiedPeers > 0) {
                console.log(`🎉 Found ${currentStatus.verifiedPeers} peer(s)!`);
                clearInterval(peerCheckInterval);
            } else if (peerCheckCount % 6 === 0) {
                console.log(`   Still waiting... (${peerCheckCount * 5}s elapsed)`);
            }
        }, 5000);
        
        await new Promise(resolve => setTimeout(resolve, 30000));
        clearInterval(peerCheckInterval);
        
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
            console.log('   This is normal if only one instance is running');
        }
        
        // Cleanup
        console.log('\n🧹 Shutting down...');
        await coordinator.shutdown();
        console.log('✅ Test completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('\n🔍 Troubleshooting tips:');
        console.error('   1. Check internet connection');
        console.error('   2. Ensure networking modules are properly installed');
        console.error('   3. Try running: npm install ws elliptic');
        console.error('   4. Make sure networking/private-network-coordinator.js exists');
        console.error('\nFull error:', error.stack);
        process.exit(1);
    }
}

// Run test if this file is executed directly
if (require.main === module) {
    simpleConnectionTest();
}

module.exports = simpleConnectionTest;