# Phase 14: Wireless Network Scanner

## Overview

Phase 14 introduces the **Wireless Network Scanner** (`pentest/wirelessscan/`) - a comprehensive security scanner for WiFi, Bluetooth, and RFID/NFC technologies, providing vulnerability assessment and rogue device detection.

## Module Structure

```
src/pentest/wirelessscan/
├── index.ts              # Module exports
├── types.ts              # WirelessScanTypes namespace (Zod schemas)
├── events.ts             # WirelessScanEvents
├── storage.ts            # Scan persistence
├── profiles.ts           # Scan profiles
├── tool.ts               # WirelessScanTool for agent
├── orchestrator.ts       # Scan coordination
├── parsers/
│   ├── index.ts
│   ├── aircrack.ts       # Aircrack-ng output parser
│   ├── kismet.ts         # Kismet output parser
│   ├── bettercap.ts      # Bettercap output parser
│   ├── ubertooth.ts      # Ubertooth output parser
│   └── hcxtools.ts       # Hcxtools output parser
├── wifi/
│   ├── index.ts
│   ├── discovery.ts      # WiFi network discovery
│   ├── security.ts       # WPA/WPA2/WPA3 assessment
│   ├── rogue-ap.ts       # Rogue AP and evil twin detection
│   ├── clients.ts        # Client enumeration
│   ├── handshake.ts      # Handshake capture and analysis
│   └── deauth.ts         # Deauthentication detection
├── bluetooth/
│   ├── index.ts
│   ├── discovery.ts      # Bluetooth device discovery
│   ├── ble.ts            # BLE service enumeration
│   ├── classic.ts        # Classic Bluetooth scanning
│   ├── profiles.ts       # Bluetooth profile analysis
│   └── vulnerabilities.ts # BlueBorne, KNOB, BIAS checks
└── rfid/
    ├── index.ts
    ├── discovery.ts      # RFID/NFC tag discovery
    ├── readers.ts        # Reader detection and enumeration
    ├── cards.ts          # Card type identification
    ├── cloning.ts        # Cloning vulnerability assessment
    └── vulnerabilities.ts # RFID-specific vulnerabilities
```

## Capabilities

### WiFi Security Assessment

| Feature | Description |
|---------|-------------|
| Network Discovery | Enumerate all visible WiFi networks with metadata |
| WPA/WPA2 Assessment | Security configuration analysis |
| WPA3 Assessment | SAE and OWE implementation checks |
| KRACK Detection | Key Reinstallation Attack vulnerability |
| Dragonblood Detection | WPA3 implementation flaws |
| PMKID Capture | PMKID-based attack capability check |
| Rogue AP Detection | Identify unauthorized access points |
| Evil Twin Detection | Detect spoofed SSIDs |
| Client Enumeration | Connected client analysis with OUI lookup |
| Probe Analysis | Client probe request monitoring |
| Handshake Capture | WPA 4-way handshake capture and validation |
| Deauth Detection | Deauthentication attack monitoring |
| WPS Assessment | WPS security and lockout status |

### Bluetooth Security Assessment

| Feature | Description |
|---------|-------------|
| Device Discovery | Classic and BLE device enumeration |
| Service Enumeration | Bluetooth service and profile discovery |
| BlueBorne Detection | CVE-2017-0781 and related vulnerabilities |
| KNOB Attack | Key Negotiation of Bluetooth vulnerability |
| BIAS Attack | Bluetooth Impersonation Attack check |
| BLESA Attack | BLE Spoofing Attack vulnerability |
| BLE Security | BLE pairing and encryption analysis |
| Device Classification | Device type and manufacturer identification |

### RFID/NFC Security Assessment

| Feature | Description |
|---------|-------------|
| Tag Discovery | Automatic tag detection and identification |
| MIFARE Classic | Default key and crypto-1 vulnerability checks |
| MIFARE DESFire | Security level assessment |
| NTAG Support | NTAG213/215/216 analysis |
| HID Support | HID access card assessment |
| EM4100 Support | Low-frequency tag analysis |
| Cloning Assessment | Cloning vulnerability evaluation |
| Key Analysis | Key reuse and weak key detection |

## Usage

### Basic Wireless Scan

```typescript
import { WirelessScanOrchestrator, WirelessScanProfiles } from "./pentest/wirelessscan"

// Full wireless scan with standard profile
const result = await WirelessScanOrchestrator.scan({
  profile: "standard",
  interface: "wlan0",
  duration: 60 // seconds
})

console.log(`WiFi Networks: ${result.wifi.networks.length}`)
console.log(`Bluetooth Devices: ${result.bluetooth.devices.length}`)
console.log(`RFID Tags: ${result.rfid.tags.length}`)
console.log(`Findings: ${result.findings.length}`)

// Get scan status
const status = await WirelessScanOrchestrator.getStatus(result.id)

// List all scans
const scans = await WirelessScanOrchestrator.listScans()
```

### WiFi-Specific Scanning

```typescript
import { WiFiDiscovery, WiFiSecurity, WiFiRogueAP, WiFiHandshake, WiFiClients } from "./pentest/wirelessscan"

// Discover WiFi networks
const networks = await WiFiDiscovery.scan({
  interface: "wlan0mon",
  duration: 30,
  channels: [1, 6, 11]
})

for (const network of networks) {
  console.log(`${network.essid} (${network.bssid})`)
  console.log(`  Channel: ${network.channel}`)
  console.log(`  Encryption: ${network.encryption}`)
  console.log(`  Signal: ${network.signal} dBm`)
}

// Security assessment
const security = await WiFiSecurity.assess(network)
console.log(`WPA Version: ${security.wpaVersion}`)
console.log(`KRACK Vulnerable: ${security.krackVulnerable}`)
console.log(`PMKID Capturable: ${security.pmkidVulnerable}`)

// Rogue AP detection
const rogueAPs = await WiFiRogueAP.detect({
  interface: "wlan0mon",
  knownNetworks: ["Corp-WiFi", "Guest-WiFi"]
})

for (const rogue of rogueAPs) {
  console.log(`[!] Rogue AP: ${rogue.essid} (${rogue.bssid})`)
  console.log(`    Type: ${rogue.type}`) // evil_twin, unauthorized, etc.
  console.log(`    Risk: ${rogue.risk}`)
}

// Client enumeration
const clients = await WiFiClients.enumerate({
  interface: "wlan0mon",
  bssid: "AA:BB:CC:DD:EE:FF"
})

for (const client of clients) {
  console.log(`Client: ${client.mac}`)
  console.log(`  Vendor: ${client.vendor}`)
  console.log(`  Probes: ${client.probes.join(", ")}`)
}

// Handshake capture
const handshake = await WiFiHandshake.capture({
  interface: "wlan0mon",
  bssid: "AA:BB:CC:DD:EE:FF",
  timeout: 120
})

if (handshake.complete) {
  console.log(`Handshake captured: ${handshake.file}`)
  console.log(`Type: ${handshake.type}`) // 4-way, pmkid
}
```

### Bluetooth Scanning

```typescript
import { BluetoothDiscovery, BluetoothBLE, BluetoothClassic, BluetoothVulnerabilities } from "./pentest/wirelessscan"

// Discover Bluetooth devices
const devices = await BluetoothDiscovery.scan({
  duration: 30,
  bleOnly: false,
  classicOnly: false
})

for (const device of devices) {
  console.log(`${device.name || "Unknown"} (${device.address})`)
  console.log(`  Type: ${device.type}`) // classic, ble, dual
  console.log(`  Class: ${device.deviceClass}`)
  console.log(`  Vendor: ${device.vendor}`)
}

// BLE service enumeration
const services = await BluetoothBLE.enumerateServices(device.address)
for (const service of services) {
  console.log(`Service: ${service.uuid}`)
  console.log(`  Name: ${service.name}`)
  for (const char of service.characteristics) {
    console.log(`    Characteristic: ${char.uuid}`)
  }
}

// Vulnerability checks
const vulns = await BluetoothVulnerabilities.check(device)
console.log(`BlueBorne: ${vulns.blueBorne}`)
console.log(`KNOB: ${vulns.knob}`)
console.log(`BIAS: ${vulns.bias}`)
console.log(`BLESA: ${vulns.blesa}`)
```

### RFID/NFC Scanning

```typescript
import { RFIDDiscovery, RFIDReaders, RFIDCards, RFIDCloning, RFIDVulnerabilities } from "./pentest/wirelessscan"

// Detect readers
const readers = await RFIDReaders.detect()
for (const reader of readers) {
  console.log(`Reader: ${reader.name}`)
  console.log(`  Type: ${reader.type}`) // proxmark3, acr122u, etc.
  console.log(`  Frequencies: ${reader.frequencies.join(", ")}`)
}

// Discover tags
const tags = await RFIDDiscovery.scan({
  reader: readers[0].name,
  frequency: "13.56mhz"
})

for (const tag of tags) {
  console.log(`Tag: ${tag.uid}`)
  console.log(`  Type: ${tag.type}`) // mifare_classic, desfire, ntag, etc.
  console.log(`  Size: ${tag.size} bytes`)
}

// Card analysis
const cardInfo = await RFIDCards.analyze(tag)
console.log(`Sectors: ${cardInfo.sectors}`)
console.log(`Keys Found: ${cardInfo.keysFound}`)
console.log(`Default Keys: ${cardInfo.defaultKeys}`)

// Cloning assessment
const clonable = await RFIDCloning.assess(tag)
console.log(`Clonable: ${clonable.vulnerable}`)
console.log(`Method: ${clonable.method}`)
console.log(`Difficulty: ${clonable.difficulty}`)

// Vulnerability checks
const rfidVulns = await RFIDVulnerabilities.check(tag)
console.log(`Crypto-1 Weak: ${rfidVulns.crypto1Weak}`)
console.log(`Default Keys: ${rfidVulns.defaultKeys}`)
console.log(`Replay Possible: ${rfidVulns.replayPossible}`)
```

### Using Parsers

```typescript
import { AircrackParser, KismetParser, BettercapParser, UbertoothParser, HcxToolsParser } from "./pentest/wirelessscan"

// Parse Aircrack-ng output
const airodumpOutput = await fs.readFile("/tmp/scan-01.csv", "utf-8")
const aircrackResult = AircrackParser.parseCSV(airodumpOutput)
console.log(`Networks: ${aircrackResult.networks.length}`)
console.log(`Clients: ${aircrackResult.clients.length}`)

// Parse Kismet output
const kismetOutput = await fs.readFile("/tmp/kismet.json", "utf-8")
const kismetResult = KismetParser.parseJSON(kismetOutput)

// Parse Bettercap output
const bettercapOutput = await fs.readFile("/tmp/bettercap.json", "utf-8")
const bettercapResult = BettercapParser.parseJSON(bettercapOutput)

// Parse Ubertooth output
const ubertoothOutput = await fs.readFile("/tmp/ubertooth.txt", "utf-8")
const ubertoothResult = UbertoothParser.parse(ubertoothOutput)

// Parse hcxtools output
const pmkidOutput = await fs.readFile("/tmp/pmkid.16800", "utf-8")
const hcxResult = HcxToolsParser.parsePMKID(pmkidOutput)
```

## Tool Actions

| Action | Description |
|--------|-------------|
| `scan` | Full wireless scan with specified profile |
| `wifi` | WiFi-specific scanning |
| `bluetooth` | Bluetooth device scanning |
| `rfid` | RFID/NFC tag scanning |
| `interfaces` | List available wireless interfaces |
| `networks` | List discovered WiFi networks |
| `devices` | List discovered Bluetooth devices |
| `tags` | List discovered RFID/NFC tags |
| `security` | Security assessment for a scan |
| `rogue-ap` | Rogue AP and evil twin detection |
| `handshake` | Capture/analyze WPA handshakes |
| `baseline` | Manage network baselines |
| `report` | Generate scan report |
| `status` | Get scan status |
| `stop` | Stop a running scan |
| `profiles` | List available scan profiles |

## Scan Profiles

| Profile | WiFi | Bluetooth | RFID | Active Tests | Stealth |
|---------|------|-----------|------|--------------|---------|
| `discovery` | Passive scan | Discovery only | Read only | No | Yes |
| `quick` | Basic scan | Quick scan | Basic | Minimal | Partial |
| `standard` | Full passive | Full scan | Full read | No | Yes |
| `thorough` | Comprehensive | Deep scan | Full analysis | Some | No |
| `passive` | Listen only | Listen only | None | No | Yes |
| `active` | Full active | Active probe | Write tests | Yes | No |

## Security Checks

### WiFi Vulnerabilities

| Vulnerability | CVE | Severity | Description |
|--------------|-----|----------|-------------|
| KRACK | CVE-2017-13077 | High | Key Reinstallation Attack |
| Dragonblood | CVE-2019-9494 | High | WPA3 SAE vulnerabilities |
| PMKID Attack | N/A | Medium | PMKID-based offline attack |
| WPS PIN | N/A | Medium | Weak WPS implementation |
| Hidden SSID | N/A | Low | SSID hiding (ineffective) |
| Open Network | N/A | High | No encryption |
| WEP | N/A | Critical | Broken encryption |
| WPA-TKIP | N/A | Medium | Deprecated cipher |

### Bluetooth Vulnerabilities

| Vulnerability | CVE | Severity | Description |
|--------------|-----|----------|-------------|
| BlueBorne | CVE-2017-0781 | Critical | RCE via Bluetooth |
| KNOB | CVE-2019-9506 | High | Key Negotiation weakness |
| BIAS | CVE-2020-10135 | High | Impersonation attack |
| BLESA | CVE-2020-9770 | Medium | BLE spoofing attack |
| BlueSmack | N/A | Medium | DoS attack |
| BlueSnarfing | N/A | High | Data theft |
| BlueJacking | N/A | Low | Unsolicited messages |

### RFID Vulnerabilities

| Vulnerability | Severity | Description |
|--------------|----------|-------------|
| Default Keys | Critical | Factory default keys in use |
| Crypto-1 Weak | Critical | MIFARE Classic crypto weakness |
| UID Cloning | High | UID-only authentication |
| Replay Attack | High | Captured data replay |
| Side Channel | Medium | Power analysis attacks |
| No Auth | Critical | No authentication required |

## Events

| Event | Description |
|-------|-------------|
| `pentest.wirelessscan.scan_started` | Scan initiated |
| `pentest.wirelessscan.scan_completed` | Scan finished |
| `pentest.wirelessscan.scan_failed` | Scan failed |
| `pentest.wirelessscan.network_discovered` | WiFi network found |
| `pentest.wirelessscan.device_discovered` | Bluetooth device found |
| `pentest.wirelessscan.tag_discovered` | RFID tag found |
| `pentest.wirelessscan.vulnerability_found` | Security issue detected |
| `pentest.wirelessscan.rogue_ap_detected` | Rogue AP identified |
| `pentest.wirelessscan.handshake_captured` | WPA handshake captured |
| `pentest.wirelessscan.deauth_detected` | Deauth attack detected |

## Data Types

### WiFiNetwork

```typescript
{
  id: string
  bssid: string              // AP MAC address
  essid: string              // Network name
  channel: number
  frequency: number
  band: "2.4ghz" | "5ghz" | "6ghz"
  signal: number             // dBm
  quality: number            // 0-100
  encryption: "open" | "wep" | "wpa" | "wpa2" | "wpa3"
  cipher: "ccmp" | "tkip" | "wep" | "gcmp"
  authentication: "psk" | "eap" | "sae" | "owe" | "open"
  wps: boolean
  wpsLocked: boolean
  hidden: boolean
  vendor: string
  clients: string[]
  pmkidVulnerable: boolean
  firstSeen: number
  lastSeen: number
}
```

### BluetoothDevice

```typescript
{
  id: string
  address: string            // MAC address
  name: string
  type: "classic" | "ble" | "dual"
  deviceClass: number
  classDescription: string
  vendor: string
  rssi: number
  services: BluetoothService[]
  paired: boolean
  connected: boolean
  legacyPairing: boolean
  vulnerabilities: string[]
  firstSeen: number
  lastSeen: number
}
```

### RFIDTag

```typescript
{
  id: string
  uid: string                // Tag UID
  type: "mifare_classic" | "mifare_desfire" | "ntag" | "hid" | "em4100"
  frequency: "125khz" | "13.56mhz"
  size: number               // bytes
  sectors: number
  blocks: number
  manufacturer: string
  atqa: string               // Answer to Request A
  sak: string                // Select Acknowledge
  readable: boolean
  writable: boolean
  clonable: boolean
  vulnerabilities: string[]
  discoveredAt: number
}
```

### WirelessFinding

```typescript
{
  id: string
  scanId: string
  type: "wifi" | "bluetooth" | "rfid"
  target: string             // BSSID, MAC, UID
  title: string
  description: string
  severity: "critical" | "high" | "medium" | "low" | "info"
  cve: string[]
  cwe: string
  recommendation: string
  evidence: string
  verified: boolean
  detectedAt: number
}
```

## External Tools

### Required Tools

| Tool | Purpose | Installation |
|------|---------|--------------|
| Aircrack-ng | WiFi security suite | `apt install aircrack-ng` |
| iw | Wireless configuration | `apt install iw` |

### Optional Tools

| Tool | Purpose | Installation |
|------|---------|--------------|
| Kismet | Wireless detector | https://www.kismetwireless.net/ |
| Bettercap | Network attack tool | https://www.bettercap.org/ |
| Ubertooth | Bluetooth sniffer | https://github.com/greatscottgadgets/ubertooth |
| Proxmark3 | RFID tool | https://github.com/Proxmark/proxmark3 |
| hcxtools | WPA capture tools | https://github.com/ZerBea/hcxtools |
| hcxdumptool | Traffic capture | https://github.com/ZerBea/hcxdumptool |
| Bluez | Linux Bluetooth | `apt install bluez` |
| libnfc | NFC tools | `apt install libnfc-bin` |

## Example Use Cases

### Use Case 1: Corporate WiFi Audit

```bash
# Full corporate WiFi assessment
wirelessscan scan profile=thorough interface=wlan0 duration=300

# Check for rogue APs
wirelessscan rogue-ap interface=wlan0mon ssid="Corp-WiFi"

# Assess specific network
wirelessscan security bssid=AA:BB:CC:DD:EE:FF
```

### Use Case 2: Evil Twin Detection

```bash
# Create baseline of known networks
wirelessscan baseline baselineAction=create baselineName=corporate

# Monitor for evil twins
wirelessscan scan profile=passive interface=wlan0mon

# Compare against baseline
wirelessscan baseline baselineAction=compare baselineName=corporate
```

### Use Case 3: WPA Handshake Capture

```bash
# Start handshake capture
wirelessscan handshake interface=wlan0mon bssid=AA:BB:CC:DD:EE:FF

# Check capture status
wirelessscan status scanId=<id>
```

### Use Case 4: Bluetooth Device Audit

```bash
# Scan for Bluetooth devices
wirelessscan bluetooth duration=60

# Check for vulnerabilities
wirelessscan devices
wirelessscan security scanId=<id>
```

### Use Case 5: Access Card Assessment

```bash
# Scan for RFID tags
wirelessscan rfid reader=proxmark3 frequency=13.56mhz

# Analyze discovered cards
wirelessscan tags

# Check cloning vulnerability
wirelessscan security scanId=<id>
```

## Storage

Scan data is persisted in:

```
pentest/wirelessscan/
  scans/
    wirelessscan_abc123.json    # Scan results
  networks/
    network_def456.json         # WiFi networks
  devices/
    device_ghi789.json          # Bluetooth devices
  tags/
    tag_jkl012.json             # RFID tags
  findings/
    finding_mno345.json         # Security findings
  baselines/
    corporate.json              # Network baselines
```

## Testing

Run the tests:

```bash
bun test test/pentest/wirelessscan.test.ts
```

## Integration

The tool is registered in `src/tool/registry.ts`:
- `WirelessScanTool` - Available as `wirelessscan` tool

Exports available from `src/pentest/index.ts`:
- All types: `WirelessScanTypes`
- Events: `WirelessScanEvents`
- Storage: `WirelessScanStorage`
- Profiles: `WirelessScanProfiles`
- Orchestrator: `WirelessScanOrchestrator`
- Tool: `WirelessScanTool`
- Parsers: `AircrackParser`, `KismetParser`, `BettercapParser`, `UbertoothParser`, `HcxToolsParser`
- WiFi: `WiFiDiscovery`, `WiFiSecurity`, `WiFiRogueAP`, `WiFiClients`, `WiFiHandshake`, `WiFiDeauth`
- Bluetooth: `BluetoothDiscovery`, `BluetoothBLE`, `BluetoothClassic`, `BluetoothProfiles`, `BluetoothVulnerabilities`
- RFID: `RFIDDiscovery`, `RFIDReaders`, `RFIDCards`, `RFIDCloning`, `RFIDVulnerabilities`

## Hardware Requirements

### WiFi Scanning

For passive scanning, any WiFi adapter works. For monitor mode and packet injection:

| Adapter | Chipset | Monitor | Injection |
|---------|---------|---------|-----------|
| Alfa AWUS036ACH | RTL8812AU | Yes | Yes |
| Alfa AWUS036ACS | RTL8811AU | Yes | Yes |
| TP-Link TL-WN722N v1 | Atheros AR9271 | Yes | Yes |
| Panda PAU09 | Ralink RT5572 | Yes | Yes |

### Bluetooth Scanning

| Device | Type | Features |
|--------|------|----------|
| Built-in adapter | HCI | Basic scanning |
| Ubertooth One | BLE sniffer | Packet capture |
| CSR 4.0 dongle | HCI | Extended range |

### RFID/NFC Scanning

| Reader | Frequencies | Features |
|--------|-------------|----------|
| Proxmark3 | 125kHz, 13.56MHz | Full analysis |
| ACR122U | 13.56MHz | Basic NFC |
| Chameleon Mini | 13.56MHz | Emulation |
