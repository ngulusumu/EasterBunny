# MKenya Tool Networking System

## 🎯 **What Is This?**

The MKenya Tool networking system allows multiple users running the tool to **automatically find each other** and **share attack statistics** without revealing their IP addresses or requiring manual setup.

Think of it like a **"ghost network"** where your tool can:
- See how many other users are online
- Share total bandwidth usage
- Find the best performing machines
- Coordinate attacks safely

## 🔍 **How Does It Work?**

### **The Problem**
Most users can't open ports on their network due to:
- Corporate firewalls
- University restrictions  
- ISP limitations
- NAT/router configurations

### **Our Solution: Multiple Discovery Methods**

We use **4 different ways** to find other users, so it works for EVERYONE:

```
Method 1: Local Network (Fastest)
├── UDP broadcast on local network
├── Finds users on same WiFi/LAN
└── Works instantly if on same network

Method 2: WebSocket Relay (Most Common)
├── Uses standard web ports (80/443)
├── Works through most firewalls
└── Real-time communication

Method 3: HTTP Polling (Universal)
├── Regular HTTP requests
├── Works everywhere the internet works
└── Bulletproof compatibility

Method 4: DNS Discovery (Ultimate Fallback)
├── Uses DNS queries as messaging
├── Works through ANY network
└── Emergency communication method
```

## 🛡️ **Privacy & Security**

### **What We Share:**
```javascript
{
  "sessionId": "random-abc123",     // Anonymous ID (changes each run)
  "bandwidth": "150MB/s",           // Your current bandwidth usage
  "cpuUsage": 45,                   // Your CPU usage percentage
  "attackType": "Layer7-GET",       // Type of attack you're running
  "targetHash": "sha256-abc...",    // Encrypted target (not real IP)
  "onlineUsers": 1                  // How many users you can see
}
```

### **What We DON'T Share:**
- ❌ Your real IP address
- ❌ Your actual target IPs
- ❌ Your personal information
- ❌ Your network configuration
- ❌ Your location

### **How It's Protected:**
- 🔒 **AES-256 Encryption** - All data is encrypted
- 🎭 **Anonymous Sessions** - Random IDs that change
- ⏰ **Auto-Expiring Data** - Information disappears quickly
- 🔀 **Multiple Hops** - Data bounces through relays

## 📊 **What You'll See**

When networking is active, you'll see stats like:

```
🌐 Network Status: CONNECTED
👥 Online Users: 12 people
📈 Total Bandwidth: 2.3 GB/s
🏆 Top Machine: 750 MB/s (25% CPU)
🔗 Active Methods: Local + WebSocket + HTTP
⚡ Your Contribution: 180 MB/s
```

## 🚀 **How To Use**

### **Automatic (Recommended)**
The networking starts automatically when you launch an attack:

1. **Start MKenya Tool**
2. **Configure your attack**
3. **Click "Start Attack"**
4. **Networking activates automatically**
5. **See real-time coordination stats**

### **Manual Control**
You can also control it manually:

```javascript
// Start networking
await electronAPI.startNetworking();

// Get current stats
const stats = await electronAPI.getNetworkStats();

// Update your stats
await electronAPI.updateAttackStats({
  bandwidth: 150,
  cpuUsage: 45,
  attackType: "Layer7-GET"
});
```

## 🔧 **Behind The Scenes**

### **Step 1: Discovery**
```
Your Tool: "Hello? Any MKenya Tools here?"
Method 1: Broadcasts on local network
Method 2: Connects to WebSocket relays  
Method 3: Polls HTTP endpoints
Method 4: Queries DNS records
```

### **Step 2: Handshake**
```
Other Tool: "Yes! Here's my encrypted stats"
Your Tool: "Great! Here's mine too"
Both: "Let's coordinate!"
```

### **Step 3: Coordination**
```
Every 30 seconds:
- Share updated statistics
- Calculate total network performance
- Find best performing machines
- Update coordination display
```

### **Step 4: Cleanup**
```
When attack ends:
- Stop sharing data
- Clean up connections
- Remove temporary information
- Reset to private mode
```

## 🌍 **Network Compatibility**

### **✅ Works On:**
- Home networks (WiFi/Ethernet)
- Corporate networks (most)
- University networks (most)  
- Public WiFi
- Mobile hotspots
- VPN connections
- Restrictive firewalls

### **⚠️ May Have Limited Features:**
- Extremely restrictive corporate networks
- Networks blocking all external connections
- Air-gapped networks

### **🚨 Emergency Mode:**
If all else fails, the tool automatically enables "Emergency Mode":
- Minimal data sharing
- 2-minute update intervals
- Basic coordination only
- Maximum compatibility

## 🔧 **Technical Details**

### **File Structure:**
```
networking/
├── coordinator.js    # Main networking controller
├── discovery.js      # Local network discovery  
├── relay.js         # Firewall-friendly relays
└── README.md        # This file
```

### **Dependencies:**
```bash
npm install ws        # WebSocket support
```

### **Ports Used:**
- **UDP 33445** - Local discovery (fallback if blocked)
- **TCP 80/443** - WebSocket/HTTP (standard web ports)
- **DNS 53** - DNS discovery (always available)

## 🛠️ **Troubleshooting**

### **"No peers found"**
- Check if other users are online
- Try enabling emergency mode
- Verify internet connection

### **"Limited connectivity"**
- You're behind a strict firewall
- Emergency mode is active
- Basic coordination still works

### **"High CPU usage"**
- Network coordination uses minimal resources
- Check your attack parameters instead
- Consider reducing attack intensity

## 🎯 **Real-World Example**

**Scenario:** 5 users want to coordinate a stress test

```
User A (Home WiFi): Discovers via local network + WebSocket
User B (Corporate): Only HTTP polling works  
User C (University): WebSocket + HTTP work
User D (Mobile): Emergency mode only
User E (VPN): All methods work

Result: All 5 users can see each other and coordinate!

Network Stats:
- Total Online: 5 users
- Combined Bandwidth: 1.2 GB/s  
- Top Performer: User E (300 MB/s)
- Methods Active: 3 different types
```

## 💡 **Key Benefits**

1. **Zero Configuration** - Works automatically
2. **Maximum Compatibility** - Multiple fallback methods
3. **Anonymous Operation** - No IP addresses shared
4. **Real-time Coordination** - Live statistics
5. **Firewall Friendly** - Works through restrictions
6. **Emergency Fallback** - Always has basic functionality

## 🔐 **Security Notes**

- All communication is encrypted
- No personal data is transmitted
- Sessions are temporary and anonymous
- Data automatically expires
- Multiple security layers protect privacy

---

**The networking system makes MKenya Tool incredibly powerful for coordinated testing while keeping all users safe and anonymous!** 🚀