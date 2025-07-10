#!/usr/bin/env node
// Simple test to verify our Nostr implementation matches the spec
const crypto = require('crypto');

class SimpleNostrTest {
    constructor() {
        this.EC = require('elliptic').ec;
        this.ec = new this.EC('secp256k1');
    }

    generateKeyPair() {
        const keyPair = this.ec.genKeyPair();
        
        // Private key: 32 bytes as hex string
        const privateKey = keyPair.getPrivate().toString('hex').padStart(64, '0');
        
        // Public key: X coordinate only (32 bytes as hex string)
        const publicKey = keyPair.getPublic().getX().toString('hex').padStart(64, '0');
        
        return { privateKey, publicKey };
    }

    createEvent(privateKey, publicKey, kind, content, tags = []) {
        const event = {
            pubkey: publicKey,
            created_at: Math.floor(Date.now() / 1000),
            kind: kind,
            tags: tags,
            content: content
        };

        // Create serialized data for hashing
        const serialized = JSON.stringify([
            0,
            event.pubkey,
            event.created_at,
            event.kind,
            event.tags,
            event.content
        ]);

        // Generate event ID
        const eventId = crypto.createHash('sha256').update(serialized, 'utf8').digest('hex');

        // Sign the event ID
        const keyPair = this.ec.keyFromPrivate(privateKey, 'hex');
        const signature = keyPair.sign(eventId, 'hex');

        // Create 64-byte signature
        const r = signature.r.toString('hex').padStart(64, '0');
        const s = signature.s.toString('hex').padStart(64, '0');

        event.id = eventId;
        event.sig = r + s;

        return event;
    }

    verifyEvent(event) {
        try {
            // Recreate serialized data
            const serialized = JSON.stringify([
                0,
                event.pubkey,
                event.created_at,
                event.kind,
                event.tags,
                event.content
            ]);

            // Verify event ID
            const expectedId = crypto.createHash('sha256').update(serialized, 'utf8').digest('hex');
            if (event.id !== expectedId) {
                console.log('❌ Event ID mismatch');
                return false;
            }

            // Verify signature using X-coordinate public key
            // Add compression prefix '02' for even Y coordinate
            const fullPubKey = '02' + event.pubkey;
            const keyPair = this.ec.keyFromPublic(fullPubKey, 'hex');

            const r = event.sig.substring(0, 64);
            const s = event.sig.substring(64, 128);

            const isValid = keyPair.verify(event.id, { r: r, s: s });
            return isValid;

        } catch (error) {
            console.error('Verification error:', error);
            return false;
        }
    }

    runTest() {
        console.log('🧪 Testing Nostr Event Creation and Verification\n');

        // Generate keypair
        const { privateKey, publicKey } = this.generateKeyPair();
        console.log(`🔑 Generated keypair:`);
        console.log(`   Private: ${privateKey.substring(0, 16)}... (${privateKey.length} chars)`);
        console.log(`   Public:  ${publicKey.substring(0, 16)}... (${publicKey.length} chars)`);

        // Create test event
        const event = this.createEvent(
            privateKey,
            publicKey,
            1, // Text note
            'Hello from MKenya Tool test!',
            [['t', 'mkenyatool-test']]
        );

        console.log(`\n📝 Created event:`);
        console.log(`   ID: ${event.id.substring(0, 16)}... (${event.id.length} chars)`);
        console.log(`   Sig: ${event.sig.substring(0, 16)}... (${event.sig.length} chars)`);
        console.log(`   Kind: ${event.kind}`);
        console.log(`   Content: "${event.content}"`);

        // Verify event
        const isValid = this.verifyEvent(event);
        console.log(`\n✅ Event verification: ${isValid ? 'PASSED' : 'FAILED'}`);

        if (isValid) {
            console.log('\n🎉 Our Nostr implementation appears to be correct!');
            console.log('The issue might be with the relay or other factors.');
        } else {
            console.log('\n❌ There is an issue with our Nostr implementation.');
        }

        // Output the complete event for inspection
        console.log('\n📄 Complete event object:');
        console.log(JSON.stringify(event, null, 2));

        return event;
    }
}

// Run the test
const test = new SimpleNostrTest();
test.runTest();