// test/million-user-test.js
const LargeScaleNetworkSimulation = require('./large-scale-simulation');

class MillionUserTestRunner {
    constructor() {
        this.testScenarios = [
            {
                name: 'Conservative Scale Test',
                options: {
                    totalUsers: 100000, // 100K users
                    simultaneousUsers: 5000,
                    relayCount: 50,
                    duration: 180000 // 3 minutes
                }
            },
            {
                name: 'Medium Scale Test',
                options: {
                    totalUsers: 500000, // 500K users
                    simultaneousUsers: 25000,
                    relayCount: 100,
                    duration: 300000 // 5 minutes
                }
            },
            {
                name: 'Million User Simulation',
                options: {
                    totalUsers: 1000000, // 1M users
                    simultaneousUsers: 50000,
                    relayCount: 200,
                    duration: 600000 // 10 minutes
                }
            },
            {
                name: 'Peak Load Test',
                options: {
                    totalUsers: 2000000, // 2M users
                    simultaneousUsers: 100000,
                    relayCount: 500,
                    duration: 300000 // 5 minutes
                }
            }
        ];
    }

    async runAllTests() {
        console.log('🚀 Million User Network Coordination Test Suite');
        console.log('Testing network scalability for global deployment\n');

        const results = [];

        for (const scenario of this.testScenarios) {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`🧪 Running: ${scenario.name}`);
            console.log(`${'='.repeat(60)}`);

            try {
                const result = await this.runScenario(scenario);
                results.push({ scenario: scenario.name, result, status: 'success' });
            } catch (error) {
                console.error(`❌ Scenario failed: ${error.message}`);
                results.push({ scenario: scenario.name, error: error.message, status: 'failed' });
            }
        }

        this.generateComparisonReport(results);
        return results;
    }

    async runScenario(scenario) {
        const simulation = new LargeScaleNetworkSimulation(scenario.options);
        
        // Set up event listeners for real-time monitoring
        this.setupMonitoring(simulation, scenario.name);
        
        const result = await simulation.runSimulation(scenario.options.duration);
        
        // Add scenario-specific analysis
        result.scenarioAnalysis = this.analyzeScenarioResult(result, scenario.options);
        
        return result;
    }

    setupMonitoring(simulation, scenarioName) {
        let lastStatsUpdate = 0;
        
        simulation.on('statsUpdate', (stats) => {
            const now = Date.now();
            if (now - lastStatsUpdate > 30000) { // Update every 30 seconds
                console.log(`📊 [${scenarioName}] Live Stats:`);
                console.log(`   Active Users: ${stats.activeUsers.toLocaleString()}`);
                console.log(`   Messages: ${stats.totalMessages.toLocaleString()}`);
                console.log(`   Success Rate: ${(stats.successRate * 100).toFixed(1)}%`);
                console.log(`   Avg Latency: ${stats.averageLatency.toFixed(0)}ms`);
                console.log(`   Relay Load: ${(stats.relayLoad * 100).toFixed(1)}%`);
                lastStatsUpdate = now;
            }
        });

        simulation.on('userJoined', (user) => {
            // Silent monitoring - could log major milestones
            if (simulation.simulation.activeUsers.size % 10000 === 0) {
                console.log(`   👥 ${simulation.simulation.activeUsers.size.toLocaleString()} users active`);
            }
        });

        simulation.on('coordinationTask', (task) => {
            console.log(`   🤝 Coordination task: ${task.type} (${task.participants.length} participants)`);
        });
    }

    analyzeScenarioResult(result, options) {
        const analysis = {
            scalabilityScore: this.calculateScalabilityScore(result, options),
            bottlenecks: this.identifyBottlenecks(result),
            recommendations: this.generateScenarioRecommendations(result, options),
            readinessLevel: this.assessDeploymentReadiness(result, options)
        };

        return analysis;
    }

    calculateScalabilityScore(result, options) {
        // Score from 0-100 based on multiple factors
        const successRateScore = result.messaging.successRate * 40; // 40% weight
        const latencyScore = Math.max(0, (5000 - result.messaging.averageLatency) / 5000) * 25; // 25% weight
        const efficiencyScore = result.network.networkEfficiency * 25; // 25% weight
        const capacityScore = Math.min(1, result.scalability.estimatedCapacity / options.totalUsers) * 10; // 10% weight

        return Math.round(successRateScore + latencyScore + efficiencyScore + capacityScore);
    }

    identifyBottlenecks(result) {
        const bottlenecks = [];

        if (result.messaging.successRate < 0.95) {
            bottlenecks.push({
                type: 'Message Delivery',
                severity: 'high',
                description: `Only ${(result.messaging.successRate * 100).toFixed(1)}% success rate`
            });
        }

        if (result.messaging.averageLatency > 2000) {
            bottlenecks.push({
                type: 'Network Latency',
                severity: 'medium',
                description: `Average latency of ${result.messaging.averageLatency.toFixed(0)}ms is high`
            });
        }

        if (result.network.relayUtilization > 0.85) {
            bottlenecks.push({
                type: 'Relay Capacity',
                severity: 'high',
                description: `Relays at ${(result.network.relayUtilization * 100).toFixed(1)}% utilization`
            });
        }

        if (result.scalability.messagesPerSecond < 100) {
            bottlenecks.push({
                type: 'Message Throughput',
                severity: 'medium',
                description: `Low throughput of ${result.scalability.messagesPerSecond.toFixed(1)} msg/s`
            });
        }

        return bottlenecks;
    }

    generateScenarioRecommendations(result, options) {
        const recommendations = [];

        // Infrastructure recommendations
        if (result.network.relayUtilization > 0.8) {
            const additionalRelays = Math.ceil(options.relayCount * 0.5);
            recommendations.push(`Add ${additionalRelays} more relays to reduce load`);
        }

        // Performance recommendations
        if (result.messaging.averageLatency > 1500) {
            recommendations.push('Deploy more regional relays to reduce geographic latency');
        }

        // Scalability recommendations
        const capacityRatio = result.scalability.estimatedCapacity / options.totalUsers;
        if (capacityRatio < 1.2) {
            recommendations.push('Increase overall network capacity by 50% for safe scaling');
        }

        // Protocol recommendations
        if (result.messaging.successRate < 0.98) {
            recommendations.push('Implement message retry mechanisms and improved error handling');
        }

        return recommendations;
    }

    assessDeploymentReadiness(result, options) {
        const criteria = {
            successRate: result.messaging.successRate >= 0.95,
            latency: result.messaging.averageLatency <= 2000,
            capacity: result.scalability.estimatedCapacity >= options.totalUsers,
            efficiency: result.network.networkEfficiency >= 0.8,
            relayLoad: result.network.relayUtilization <= 0.8
        };

        const passedCriteria = Object.values(criteria).filter(Boolean).length;
        const totalCriteria = Object.keys(criteria).length;
        const readinessScore = (passedCriteria / totalCriteria) * 100;

        let readinessLevel;
        if (readinessScore >= 90) {
            readinessLevel = 'Production Ready';
        } else if (readinessScore >= 70) {
            readinessLevel = 'Beta Ready';
        } else if (readinessScore >= 50) {
            readinessLevel = 'Alpha Ready';
        } else {
            readinessLevel = 'Development Stage';
        }

        return {
            level: readinessLevel,
            score: Math.round(readinessScore),
            criteria: criteria,
            details: this.getReadinessDetails(criteria)
        };
    }

    getReadinessDetails(criteria) {
        const details = [];
        
        if (criteria.successRate) details.push('✅ Message delivery reliability');
        else details.push('❌ Message delivery needs improvement');
        
        if (criteria.latency) details.push('✅ Network latency acceptable');
        else details.push('❌ Network latency too high');
        
        if (criteria.capacity) details.push('✅ Network capacity sufficient');
        else details.push('❌ Network capacity insufficient');
        
        if (criteria.efficiency) details.push('✅ Network efficiency good');
        else details.push('❌ Network efficiency needs optimization');
        
        if (criteria.relayLoad) details.push('✅ Relay load balanced');
        else details.push('❌ Relays overloaded');

        return details;
    }

    generateComparisonReport(results) {
        console.log('\n' + '='.repeat(80));
        console.log('📊 MILLION USER TEST COMPARISON REPORT');
        console.log('='.repeat(80));

        // Success overview
        const successful = results.filter(r => r.status === 'success');
        const failed = results.filter(r => r.status === 'failed');
        
        console.log(`\n🎯 Test Results Overview:`);
        console.log(`   Successful Scenarios: ${successful.length}/${results.length}`);
        console.log(`   Failed Scenarios: ${failed.length}/${results.length}`);

        if (failed.length > 0) {
            console.log('\n❌ Failed Scenarios:');
            failed.forEach(f => {
                console.log(`   • ${f.scenario}: ${f.error}`);
            });
        }

        if (successful.length === 0) {
            console.log('\n❌ No successful tests - network not ready for large scale deployment');
            return;
        }

        // Comparison table
        console.log('\n📈 Scalability Comparison:');
        console.log('┌─────────────────────────┬──────────────┬─────────────┬───────────────┬─────────────┐');
        console.log('│ Scenario                │ Users        │ Success %   │ Latency (ms)  │ Readiness   │');
        console.log('├─────────────────────────┼──────────────┼─────────────┼───────────────┼─────────────┤');
        
        successful.forEach(test => {
            const r = test.result;
            const scenario = test.scenario.padEnd(23);
            const users = r.simulation.peakConcurrentUsers.toLocaleString().padStart(12);
            const success = `${(r.messaging.successRate * 100).toFixed(1)}%`.padStart(11);
            const latency = `${r.messaging.averageLatency.toFixed(0)}`.padStart(13);
            const readiness = r.scenarioAnalysis.readinessLevel.padEnd(11);
            
            console.log(`│ ${scenario} │ ${users} │ ${success} │ ${latency} │ ${readiness} │`);
        });
        
        console.log('└─────────────────────────┴──────────────┴─────────────┴───────────────┴─────────────┘');

        // Best performing scenario
        const bestScenario = successful.reduce((best, current) => {
            return current.result.scenarioAnalysis.scalabilityScore > best.result.scenarioAnalysis.scalabilityScore 
                ? current : best;
        });

        console.log(`\n🏆 Best Performing Scenario: ${bestScenario.scenario}`);
        console.log(`   Scalability Score: ${bestScenario.result.scenarioAnalysis.scalabilityScore}/100`);
        console.log(`   Readiness Level: ${bestScenario.result.scenarioAnalysis.readinessLevel}`);

        // Million user readiness assessment
        const millionUserTest = successful.find(t => t.scenario === 'Million User Simulation');
        if (millionUserTest) {
            this.assessMillionUserReadiness(millionUserTest.result);
        }

        // Global deployment recommendations
        console.log('\n🌍 Global Deployment Recommendations:');
        this.generateGlobalRecommendations(successful);
    }

    assessMillionUserReadiness(result) {
        console.log('\n🎯 Million User Readiness Assessment:');
        
        const readiness = result.scenarioAnalysis.readinessLevel;
        const score = result.scenarioAnalysis.scalabilityScore;
        
        console.log(`   Overall Readiness: ${readiness} (${score}/100)`);
        
        if (score >= 80) {
            console.log('   ✅ Network is ready for million-user deployment!');
            console.log('   📈 Estimated capacity for millions of users globally');
        } else if (score >= 60) {
            console.log('   ⚠️  Network can handle millions of users with optimizations');
            console.log('   🔧 Some improvements needed before full deployment');
        } else {
            console.log('   ❌ Network needs significant improvements for million-user scale');
            console.log('   🛠️  Major infrastructure upgrades required');
        }

        // Bottleneck analysis
        if (result.scenarioAnalysis.bottlenecks.length > 0) {
            console.log('\n⚠️  Key Bottlenecks to Address:');
            result.scenarioAnalysis.bottlenecks.forEach(bottleneck => {
                const icon = bottleneck.severity === 'high' ? '🔴' : '🟡';
                console.log(`   ${icon} ${bottleneck.type}: ${bottleneck.description}`);
            });
        }
    }

    generateGlobalRecommendations(successfulTests) {
        const recommendations = [];
        
        // Analyze all successful tests for patterns
        const avgSuccessRate = successfulTests.reduce((sum, t) => 
            sum + t.result.messaging.successRate, 0) / successfulTests.length;
        
        const avgLatency = successfulTests.reduce((sum, t) => 
            sum + t.result.messaging.averageLatency, 0) / successfulTests.length;

        if (avgSuccessRate < 0.98) {
            recommendations.push('Implement global message retry and redundancy systems');
        }

        if (avgLatency > 1000) {
            recommendations.push('Deploy relay servers in more geographic regions');
        }

        recommendations.push('Implement auto-scaling mechanisms for relay infrastructure');
        recommendations.push('Set up real-time monitoring and alerting systems');
        recommendations.push('Create disaster recovery and failover procedures');
        recommendations.push('Establish regional coordinator nodes for better load distribution');

        recommendations.forEach((rec, index) => {
            console.log(`   ${index + 1}. ${rec}`);
        });

        // Cost and infrastructure estimates
        console.log('\n💰 Infrastructure Estimates for 1M Users:');
        console.log('   Recommended Relays: 200-500 globally distributed');
        console.log('   Expected Message Volume: 10K-100K messages/second');
        console.log('   Storage Requirements: ~1TB/day for coordination data');
        console.log('   Bandwidth: ~10-100 Gbps aggregate across all relays');
    }
}

// Quick test runner for different scales
async function runQuickScaleTest() {
    console.log('⚡ Quick Scale Test - Testing different user counts\n');
    
    const scales = [
        { users: 1000, name: '1K Users' },
        { users: 10000, name: '10K Users' },
        { users: 100000, name: '100K Users' },
        { users: 1000000, name: '1M Users' }
    ];

    for (const scale of scales) {
        console.log(`\n🧪 Testing ${scale.name}...`);
        
        const simulation = new LargeScaleNetworkSimulation({
            totalUsers: scale.users,
            simultaneousUsers: Math.min(scale.users, 10000),
            relayCount: Math.min(Math.ceil(scale.users / 5000), 100),
            geographicRegions: 5
        });

        try {
            const result = await simulation.runSimulation(60000); // 1 minute test
            
            console.log(`   ✅ Success Rate: ${(result.messaging.successRate * 100).toFixed(1)}%`);
            console.log(`   ⏱️  Avg Latency: ${result.messaging.averageLatency.toFixed(0)}ms`);
            console.log(`   📊 Messages/sec: ${result.scalability.messagesPerSecond.toFixed(1)}`);
            console.log(`   🏗️  Estimated Capacity: ${result.scalability.estimatedCapacity.toLocaleString()}`);
            
        } catch (error) {
            console.log(`   ❌ Failed: ${error.message}`);
        }
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--quick')) {
        await runQuickScaleTest();
    } else {
        const testRunner = new MillionUserTestRunner();
        await testRunner.runAllTests();
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { MillionUserTestRunner, runQuickScaleTest };