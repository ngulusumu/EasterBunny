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
        process.exit(1);
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
            if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
            reject(new Error('Connection timeout (10s)'));
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
            if (code !== 1000 && code !== 1005) {
                reject(new Error(`Connection closed with code: ${code}`));
            }
        });
    });
}

// Run test if this file is executed directly
if (require.main === module) {
    testRelayConnections().catch(console.error);
}

module.exports = testRelayConnections;