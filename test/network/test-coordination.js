#!/usr/bin/env node
const path = require('path');
const os = require('os');

// Import Node.js compatible coordination system
const { PrivateNetworkCoordinator } = require('./nodejs-private-network-coordinator');

class NetworkTester {
    constructor(machineName) {
        this.machineName = machineName || os.hostname();
        this.coordinator = null;
        this.onlineMachines = new Map();
        
        console.log(`🚀 Starting ${this.machineName} network test...`);
    }

    setupInteractiveMessaging() {
        // Set up readline for interactive messaging
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        // Don't interfere with other console output
        rl.on('line', async (input) => {
            const message = input.trim();
            if (message) {
                if (this.onlineMachines.size > 0) {
                    try {
                        await this.coordinator.sendPrivateMessage(`${this.machineName}: ${message}`);
                        console.log(`📤 You sent: "${message}"`);
                    } catch (error) {
                        console.error(`❌ Failed to send message:`, error.message);
                    }
                } else {
                    console.log(`📵 No other machines online to receive your message`);
                }
            }
        });

        // Show messaging instructions after first status
        setTimeout(() => {
            if (this.onlineMachines.size > 0) {
                console.log(`\n💬 MESSAGING ENABLED`);
                console.log(`   Type any message and press Enter to send to all machines`);
                console.log(`   Messages will appear automatically from other machines\n`);
            }
        }, 5000);
    }

    async initialize() {
        try {
            // Initialize the coordinator with test config
            this.coordinator = new PrivateNetworkCoordinator({
                appIdentifier: 'mkenyatool-coordination-network',
                appVersion: '1.0.0',
                networkSecret: 'mkenyatool-private-secure-network-2025-coordination-key-v1-do-not-share',
                minRequiredVersion: '1.0.0',
                machineId: this.machineName // Use unique machine name for different keys
            });

            // Set up event handlers
            this.setupEventHandlers();

            // Initialize the coordinator
            await this.coordinator.initialize();

            console.log(`✅ ${this.machineName} initialized successfully!`);
            console.log(`🔑 Public Key: ${this.coordinator.keyManager.publicKey.substring(0, 16)}...`);
            console.log(`🌐 Network ID: ${this.coordinator.getNetworkId()}`);
            
            // Start monitoring and reporting
            this.startStatusReporting();
            
        } catch (error) {
            console.error(`❌ Failed to initialize ${this.machineName}:`, error.message);
            process.exit(1);
        }
    }

    setupEventHandlers() {
        // When a peer is verified
        this.coordinator.onPeerVerified = (peerId, verificationData) => {
            const shortId = peerId.substring(0, 8);
            this.onlineMachines.set(peerId, {
                shortId: shortId,
                capabilities: verificationData.capabilities,
                joinedAt: new Date().toISOString(),
                lastSeen: Date.now()
            });

            console.log(`\n🎉 NEW MACHINE JOINED THE NETWORK!`);
            console.log(`   Machine ID: ${shortId}...`);
            console.log(`   Platform: ${verificationData.capabilities?.platform || 'Unknown'}`);
            console.log(`   CPU Cores: ${verificationData.capabilities?.cpuCores || 'Unknown'}`);
            this.showNetworkStatus();
        };

        // When a peer sends status update
        this.coordinator.onVerifiedPeerStatusUpdate = (peerId, statusData) => {
            if (this.onlineMachines.has(peerId)) {
                const machine = this.onlineMachines.get(peerId);
                machine.lastSeen = Date.now();
                machine.status = statusData.status;
                machine.performance = statusData.performance;
            }
        };

        // Handle incoming messages
        this.coordinator.onGroupChatMessage = (message) => {
            const senderMachine = this.onlineMachines.get(message.author);
            const senderName = senderMachine ? senderMachine.shortId : message.author.substring(0, 8);
            
            console.log(`\n💬 MESSAGE FROM ${senderName}:`);
            console.log(`   "${message.content}"`);
            console.log(`   Received at: ${new Date(message.timestamp).toLocaleTimeString()}\n`);
        };

        // When a peer disconnects
        this.coordinator.onPeerDisconnected = (peerId) => {
            const machine = this.onlineMachines.get(peerId);
            if (machine) {
                console.log(`\n👋 MACHINE LEFT THE NETWORK!`);
                console.log(`   Machine ID: ${machine.shortId}...`);
                this.onlineMachines.delete(peerId);
                this.showNetworkStatus();
            }
        };

        // Network isolation detected
        this.coordinator.onNetworkIsolated = () => {
            console.log(`\n🏝️  ${this.machineName} is in ISOLATED MODE`);
            console.log(`   Waiting for other machines to join...`);
        };

        // Network reconnected
        this.coordinator.onNetworkReconnected = () => {
            console.log(`\n🌐 ${this.machineName} RECONNECTED to network!`);
            this.showNetworkStatus();
        };
    }

    showNetworkStatus() {
        console.log(`\n📊 NETWORK STATUS FOR ${this.machineName.toUpperCase()}`);
        console.log(`═══════════════════════════════════════════════`);
        console.log(`🔗 Connected Relays: ${this.coordinator.relays.filter(r => r.connected).length}/5`);
        console.log(`👥 Online Machines: ${this.onlineMachines.size + 1} (including me)`);
        
        if (this.onlineMachines.size === 0) {
            console.log(`   - ${this.machineName} (me) ✨`);
            console.log(`   - Waiting for other machines...`);
        } else {
            console.log(`   - ${this.machineName} (me) ✨`);
            
            for (const [peerId, machine] of this.onlineMachines.entries()) {
                const timeSinceJoin = Math.floor((Date.now() - new Date(machine.joinedAt).getTime()) / 1000);
                console.log(`   - Machine ${machine.shortId}... (${machine.capabilities?.platform || 'Unknown'}) - online ${timeSinceJoin}s`);
            }
        }
        console.log(`═══════════════════════════════════════════════\n`);
    }

    startStatusReporting() {
        // Show initial status faster
        setTimeout(() => {
            this.showNetworkStatus();
        }, 2000); // Show after 2 seconds instead of 3

        // Show status every 15 seconds for more frequent updates
        setInterval(() => {
            this.showNetworkStatus();
        }, 15000);

        // Send test message every 30 seconds (faster)
        setInterval(async () => {
            if (this.onlineMachines.size > 0) {
                try {
                    const message = `Hello from ${this.machineName} at ${new Date().toLocaleTimeString()}! 👋`;
                    await this.coordinator.sendPrivateMessage(message);
                    console.log(`📨 Sent message: "${message}"`);
                } catch (error) {
                    console.error(`❌ Failed to send message:`, error.message);
                }
            }
        }, 30000); // Every 30 seconds instead of 60

        // Interactive messaging (listen for user input)
        this.setupInteractiveMessaging();
    }

    async shutdown() {
        console.log(`\n🧹 Shutting down ${this.machineName}...`);
        if (this.coordinator) {
            try {
                await this.coordinator.reportMachineOffline(this.coordinator.keyManager.publicKey);
                await this.coordinator.shutdown();
                console.log(`✅ ${this.machineName} shutdown complete`);
            } catch (error) {
                console.error(`❌ Error during shutdown:`, error.message);
            }
        }
        process.exit(0);
    }
}

// Handle shutdown gracefully
process.on('SIGINT', async () => {
    console.log('\n🛑 Received shutdown signal...');
    if (global.tester) {
        await global.tester.shutdown();
    } else {
        process.exit(0);
    }
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received termination signal...');
    if (global.tester) {
        await global.tester.shutdown();
    } else {
        process.exit(0);
    }
});

// Main execution
async function main() {
    const machineName = process.argv[2] || `Machine-${os.hostname()}`;
    
    console.log(`\n🌍 MKenya Tool Network Test`);
    console.log(`════════════════════════════`);
    console.log(`Machine Name: ${machineName}`);
    console.log(`Platform: ${os.platform()}`);
    console.log(`Architecture: ${os.arch()}`);
    console.log(`Node Version: ${process.version}`);
    console.log(`════════════════════════════\n`);

    const tester = new NetworkTester(machineName);
    global.tester = tester;
    
    await tester.initialize();
    
    // Keep the process running
    console.log(`💡 ${machineName} is now listening for other machines...`);
    console.log(`💡 Press Ctrl+C to exit gracefully\n`);
}

// Run the test
main().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
});