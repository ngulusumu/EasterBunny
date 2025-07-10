// test/basic-network-test.js

async function basicNetworkTest() {
    console.log('🌐 Basic Network Test');
    console.log('Running essential network functionality tests...\n');
    
    const tests = [
        { name: 'Relay Connectivity', file: './relay-connection-test.js' },
        { name: 'Simple Connection', file: './simple-connection-test.js' }
    ];
    
    let passedTests = 0;
    
    for (const test of tests) {
        console.log(`\n🧪 Running: ${test.name}`);
        console.log('─'.repeat(50));
        
        try {
            const testFunction = require(test.file);
            if (typeof testFunction === 'function') {
                await testFunction();
            }
            console.log(`✅ ${test.name} - PASSED`);
            passedTests++;
        } catch (error) {
            console.log(`❌ ${test.name} - FAILED: ${error.message}`);
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 BASIC NETWORK TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Tests Passed: ${passedTests}/${tests.length}`);
    console.log(`Success Rate: ${((passedTests / tests.length) * 100).toFixed(1)}%`);
    
    if (passedTests === tests.length) {
        console.log('✅ All basic network tests passed!');
    } else {
        console.log('⚠️  Some basic tests failed - check network connectivity');
        process.exit(1);
    }
}

// Run test if this file is executed directly
if (require.main === module) {
    basicNetworkTest().catch(console.error);
}

module.exports = basicNetworkTest;