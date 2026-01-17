# Phase 9: API Security Scanner

## Overview

The API Security Scanner module (`pentest/apiscan`) provides comprehensive API security testing capabilities including:

- **API Discovery**: Auto-detection and parsing of OpenAPI/Swagger and GraphQL specifications
- **Authentication Testing**: JWT analysis, API key validation, OAuth flow testing
- **Authorization Testing**: BOLA/IDOR detection, privilege escalation checks
- **Injection Testing**: SQL, NoSQL, and command injection testing
- **OWASP API Top 10 2023**: Categorization of findings by API-specific OWASP categories

## Module Structure

```
src/pentest/apiscan/
├── index.ts              # Module exports
├── types.ts              # Zod schemas (25+ types)
├── events.ts             # BusEvent definitions (10 events)
├── storage.ts            # API spec/scan persistence
├── profiles.ts           # Scan profile definitions
├── tool.ts               # ApiScanTool for agent
├── orchestrator.ts       # Scan workflow coordination
├── discovery.ts          # API endpoint discovery
├── auth/
│   ├── index.ts          # Auth module exports
│   ├── jwt.ts            # JWT analysis (decode, validate, attack vectors)
│   ├── apikey.ts         # API key testing
│   └── oauth.ts          # OAuth flow testing
├── authz/
│   ├── index.ts          # Authz module exports
│   ├── bola.ts           # BOLA/IDOR detection
│   └── privilege.ts      # Privilege escalation testing
├── injection/
│   ├── index.ts          # Injection module exports
│   ├── sql.ts            # SQL injection testing
│   ├── nosql.ts          # NoSQL injection testing
│   └── command.ts        # Command injection testing
└── parsers/
    ├── index.ts          # Parser exports
    ├── openapi.ts        # OpenAPI/Swagger spec parser
    └── graphql.ts        # GraphQL introspection parser
```

## Usage

### API Discovery

```typescript
import { ApiDiscovery } from "./pentest/apiscan"

// Discover API endpoints from target
const result = await ApiDiscovery.discover("https://api.example.com", {
  parseOpenApi: true,
  parseGraphQL: true,
  commonPaths: true,
})

// Parse a specific OpenAPI spec
const spec = await ApiDiscovery.parseOpenApiSpec(
  "https://api.example.com/openapi.json",
  "https://api.example.com"
)
```

### JWT Analysis

```typescript
import { JwtAnalyzer } from "./pentest/apiscan"

const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
const analysis = JwtAnalyzer.analyze(token)

console.log(analysis.algorithm)     // "HS256"
console.log(analysis.isExpired)     // false
console.log(analysis.issues)        // ["WARNING: Using symmetric algorithm..."]
console.log(analysis.attackVectors) // ["None algorithm: Try setting alg to 'none'..."]

// Format for display
console.log(JwtAnalyzer.format(analysis))

// Create test tokens
const noneToken = JwtAnalyzer.createNoneAlgToken(analysis)
```

### Running Scans

```typescript
import { ApiScanOrchestrator, ApiScanProfiles } from "./pentest/apiscan"

// Quick scan
const result = await ApiScanOrchestrator.scan("https://api.example.com", {
  profile: "quick",
})

// Scan with authentication
const result = await ApiScanOrchestrator.scan("https://api.example.com", {
  profile: "standard",
  auth: {
    type: "jwt",
    token: "eyJ...",
  },
})

// Custom profile
const customProfile = ApiScanProfiles.createCustom("standard", {
  injectionTests: { enabled: true, sql: true, nosql: false, command: false },
  bolaTests: true,
})
```

### Tool Actions

The `apiscan` tool supports the following actions:

| Action | Description |
|--------|-------------|
| `discover` | Discover API endpoints from target |
| `parse-spec` | Parse OpenAPI/Swagger specification |
| `parse-graphql` | Parse GraphQL introspection |
| `scan` | Run scan with specific profile |
| `quick-scan` | Quick scan (alias for quick profile) |
| `full-scan` | Thorough scan (alias for thorough profile) |
| `endpoints` | List discovered API endpoints |
| `jwt-analyze` | Analyze a JWT token for vulnerabilities |
| `auth-test` | Test authentication mechanisms |
| `bola-test` | Test for BOLA/IDOR vulnerabilities |
| `inject-test` | Test for injection vulnerabilities |
| `status` | Get status of running scan |
| `owasp-api` | Categorize findings by OWASP API Top 10 |

## Scan Profiles

| Profile | Discovery | Auth Tests | Injection | BOLA | Use Case |
|---------|-----------|------------|-----------|------|----------|
| `discovery` | full | none | none | no | Map API surface |
| `quick` | basic | jwt-decode | none | no | Fast assessment |
| `standard` | full | all auth | sql, nosql | yes | Normal pentest |
| `thorough` | full | all + fuzzing | all injection | yes | Comprehensive |
| `passive` | spec-only | jwt-decode | none | no | No active testing |
| `auth-focused` | basic | all + brute | none | yes | Auth-specific testing |
| `custom` | configurable | configurable | configurable | configurable | Custom configuration |

## OWASP API Top 10 2023 Categories

The scanner categorizes findings according to the OWASP API Security Top 10 2023:

| Category | Detection Patterns |
|----------|-------------------|
| API1:2023 Broken Object Level Authorization | BOLA, IDOR, horizontal privilege |
| API2:2023 Broken Authentication | JWT issues, weak auth, session problems |
| API3:2023 Broken Object Property Level Authorization | Mass assignment, excessive data exposure |
| API4:2023 Unrestricted Resource Consumption | Rate limiting issues, DoS vectors |
| API5:2023 Broken Function Level Authorization | Vertical privilege escalation |
| API6:2023 Unrestricted Access to Sensitive Business Flows | Business logic bypass |
| API7:2023 Server Side Request Forgery | SSRF via API parameters |
| API8:2023 Security Misconfiguration | CORS, headers, verbose errors |
| API9:2023 Improper Inventory Management | Undocumented endpoints, old API versions |
| API10:2023 Unsafe Consumption of APIs | Third-party API trust issues |

## Events

The module emits the following events:

| Event | Description |
|-------|-------------|
| `pentest.apiscan.discovery_started` | API discovery began |
| `pentest.apiscan.endpoint_discovered` | New endpoint found |
| `pentest.apiscan.spec_parsed` | OpenAPI/GraphQL spec parsed |
| `pentest.apiscan.scan_started` | Scan began |
| `pentest.apiscan.endpoint_tested` | Endpoint test completed |
| `pentest.apiscan.auth_tested` | Auth test completed |
| `pentest.apiscan.injection_tested` | Injection test completed |
| `pentest.apiscan.vulnerability_found` | Vulnerability discovered |
| `pentest.apiscan.scan_completed` | Scan finished |
| `pentest.apiscan.scan_failed` | Scan failed |

## Storage

API specifications and scan results are persisted in:

```
pentest/apiscan/
  specs/
    spec_abc123.json        # Parsed API specs
  scans/
    apiscan_xyz789.json     # Scan results
```

## Data Types

### ApiEndpoint

```typescript
{
  id: string
  path: string              // /api/users/{id}
  method: HttpMethod        // GET, POST, PUT, DELETE, PATCH
  summary?: string
  description?: string
  operationId?: string
  parameters: ApiParameter[]
  requestBody?: RequestBody
  responses: ResponseSchema[]
  security?: SecurityRequirement[]
  tags?: string[]
  deprecated?: boolean
}
```

### ApiSpec

```typescript
{
  id: string
  target: string            // Base URL
  type: "openapi" | "graphql" | "manual"
  version?: string          // OpenAPI version
  title?: string
  description?: string
  endpoints: ApiEndpoint[]
  securitySchemes: SecurityScheme[]
  graphqlSchema?: GraphQLSchema
  servers?: string[]
  discoveredAt: number
}
```

### JwtAnalysis

```typescript
{
  raw: string
  header: Record<string, unknown>
  payload: Record<string, unknown>
  signature: string
  algorithm: string
  isExpired: boolean
  expiresAt?: number
  issuedAt?: number
  issuer?: string
  subject?: string
  audience?: string | string[]
  issues: string[]          // Security issues found
  attackVectors: string[]   // Suggested attack vectors
}
```

### ApiScanResult

```typescript
{
  id: string
  target: string
  specId?: string
  profile: ProfileId
  auth?: AuthConfig
  endpoints: EndpointTestResult[]
  jwtAnalysis?: JwtAnalysis
  bolaResults?: BolaTestResult[]
  injectionResults?: InjectionTestResult[]
  findings: string[]        // Finding IDs
  stats: ScanStats
  startedAt: number
  completedAt?: number
  status: Status
  error?: string
}
```

## Testing

Run the apiscan tests with:

```bash
bun test test/pentest/apiscan.test.ts
```

The test suite covers:
- JWT decoding and analysis
- OpenAPI 2.0 and 3.x parsing
- GraphQL introspection parsing
- Profile configurations
- Storage operations
- Type validation

## Dependencies

The module uses:
- No external packages (uses native fetch, base64 decode)
- Existing modules: Storage, Bus, Findings, GovernanceScope
- Patterns from: webscan module (Tool.define, storage, events)
