# Phase 15: Social Engineering Toolkit

## Overview

Phase 15 introduces the **Social Engineering Toolkit** (`pentest/soceng/`) - a comprehensive framework for authorized security testing, red team engagements, and security awareness training programs.

> **IMPORTANT DISCLAIMER**: This module is intended for AUTHORIZED security testing ONLY. Unauthorized use against systems or individuals without explicit permission is illegal and unethical. Always ensure written authorization, compliance with applicable laws, proper scoping, and ethical handling of captured data.

## Module Structure

```
src/pentest/soceng/
├── index.ts              # Module exports
├── types.ts              # SocEngTypes namespace (Zod schemas)
├── events.ts             # SocEngEvents
├── storage.ts            # Campaign persistence
├── profiles.ts           # Campaign profiles
├── tool.ts               # SocEngTool for agent
├── orchestrator.ts       # Campaign coordination
├── email/
│   ├── index.ts
│   ├── generator.ts      # Email content generation
│   ├── spoof.ts          # Spoofing analysis
│   ├── headers.ts        # Email header manipulation
│   └── validation.ts     # SPF/DKIM/DMARC validation
├── phishing/
│   ├── index.ts
│   ├── campaigns.ts      # Campaign management
│   ├── templates.ts      # Email templates
│   ├── landing.ts        # Landing page templates
│   ├── payloads.ts       # Phishing payloads
│   └── tracking.ts       # Click/open tracking
├── pretexting/
│   ├── index.ts
│   ├── scenarios.ts      # Pretexting scenarios
│   ├── personas.ts       # Social engineering personas
│   ├── scripts.ts        # Call scripts with dialogue trees
│   └── osint.ts          # OSINT integration
├── payloads/
│   ├── index.ts
│   ├── usb.ts            # USB drop payloads
│   ├── documents.ts      # Malicious documents
│   ├── macros.ts         # VBA macro payloads
│   └── hta.ts            # HTA application payloads
├── recon/
│   ├── index.ts
│   ├── email.ts          # Email discovery
│   ├── organization.ts   # Organization profiling
│   └── social.ts         # Social media reconnaissance
└── awareness/
    ├── index.ts
    ├── training.ts       # Training modules
    ├── metrics.ts        # Awareness metrics
    └── reporting.ts      # Campaign reporting
```

## Capabilities

### Email Security Assessment

| Feature | Description |
|---------|-------------|
| SPF Validation | Sender Policy Framework configuration check |
| DKIM Validation | DomainKeys Identified Mail verification |
| DMARC Validation | Domain-based Message Authentication check |
| Spoofing Analysis | Email spoofing vulnerability assessment |
| Lookalike Domains | Generate typosquatting/lookalike domains |
| Header Analysis | Email header manipulation detection |

### Phishing Campaign Management

| Feature | Description |
|---------|-------------|
| Campaign Creation | Multi-type campaign setup and management |
| Target Import | CSV-based target list import |
| Email Templates | Pre-built and custom phishing templates |
| Landing Pages | Credential harvesting page templates |
| Click Tracking | Open, click, and submission tracking |
| Campaign Reports | Detailed statistics and reports |

### Pretexting Framework

| Feature | Description |
|---------|-------------|
| Scenario Library | Pre-built social engineering scenarios |
| Persona Management | Detailed persona profiles |
| Call Scripts | Dialogue trees with objection handlers |
| OSINT Integration | Reconnaissance data integration |
| Objection Handling | Response strategies for resistance |

### Payload Generation

| Feature | Description |
|---------|-------------|
| USB Drop | Rubber ducky and BadUSB payloads |
| Office Documents | Macro-enabled document payloads |
| VBA Macros | Custom macro payload generation |
| HTA Applications | HTML Application payloads |
| PDF Exploits | PDF-based payload templates |

### OSINT Reconnaissance

| Feature | Description |
|---------|-------------|
| Email Discovery | Email address enumeration |
| Organization Profiling | Company structure analysis |
| Social Media Recon | LinkedIn, Twitter, Facebook reconnaissance |
| Search Query Generation | Optimized OSINT search queries |
| Email Permutations | Email format guessing |

### Security Awareness

| Feature | Description |
|---------|-------------|
| Training Modules | Interactive training content |
| Awareness Metrics | Click rate, report rate calculation |
| Industry Benchmarks | Compare against industry standards |
| Executive Reports | Management-ready summaries |
| Quiz Generation | Phishing awareness quizzes |

## Usage

### Email Security Assessment

```typescript
import { EmailValidation, EmailSpoof, EmailGenerator } from "./pentest/soceng"

// Check domain email security
const security = await EmailValidation.checkDomain("example.com")
console.log(`SPF: ${security.spf.status}`)
console.log(`DKIM: ${security.dkim.status}`)
console.log(`DMARC: ${security.dmarc.status}`)
console.log(`Spoofable: ${security.spoofable}`)

// Detailed spoofing assessment
const spoofAssessment = await EmailSpoof.assessSpoofability("example.com")
console.log(`Overall Risk: ${spoofAssessment.risk}`)
console.log(`Recommendations: ${spoofAssessment.recommendations.join(", ")}`)

// Generate lookalike domains
const lookalikes = EmailGenerator.generateLookalikeDomains("example.com")
for (const domain of lookalikes) {
  console.log(`${domain.domain} - ${domain.technique}`)
}
```

### Phishing Campaign Management

```typescript
import { PhishingCampaigns, PhishingTemplates, PhishingLanding } from "./pentest/soceng"

// Create a new campaign
const campaign = await PhishingCampaigns.create({
  name: "Security Awareness Q1 2024",
  type: "credential-harvest",
  profile: "awareness",
  targets: [
    { email: "user1@company.com", firstName: "John", lastName: "Doe", department: "IT" },
    { email: "user2@company.com", firstName: "Jane", lastName: "Smith", department: "HR" },
  ],
  templateId: "password-reset",
  landingPageId: "microsoft-365",
  senderProfile: {
    name: "IT Security Team",
    email: "security@company-it-support.com",
    replyTo: "noreply@company.com"
  },
  schedule: {
    startTime: Date.now() + 86400000, // Start in 24 hours
    sendRate: 10, // 10 emails per hour
    randomize: true
  }
})

console.log(`Campaign created: ${campaign.id}`)

// List available templates
const templates = PhishingTemplates.list()
for (const template of templates) {
  console.log(`${template.id}: ${template.name} (${template.category})`)
}

// Generate custom template
const customEmail = PhishingTemplates.generate({
  templateId: "password-reset",
  variables: {
    companyName: "Acme Corp",
    targetName: "John Doe",
    urgency: "24 hours",
    linkUrl: "https://tracking.example.com/xyz123"
  }
})

// List landing pages
const landingPages = PhishingLanding.list()
for (const page of landingPages) {
  console.log(`${page.id}: ${page.name} - ${page.type}`)
}

// Get campaign statistics
const stats = await PhishingCampaigns.getStats(campaign.id)
console.log(`Sent: ${stats.sent}`)
console.log(`Opened: ${stats.opened} (${stats.openRate}%)`)
console.log(`Clicked: ${stats.clicked} (${stats.clickRate}%)`)
console.log(`Submitted: ${stats.submitted} (${stats.submitRate}%)`)
console.log(`Reported: ${stats.reported} (${stats.reportRate}%)`)
```

### Pretexting Scenarios

```typescript
import { PretextingScenarios, PretextingPersonas, PretextingScripts } from "./pentest/soceng"

// List available scenarios
const scenarios = PretextingScenarios.list()
for (const scenario of scenarios) {
  console.log(`${scenario.id}: ${scenario.name}`)
  console.log(`  Category: ${scenario.category}`)
  console.log(`  Difficulty: ${scenario.difficulty}`)
}

// Get scenario details
const scenario = PretextingScenarios.get("it-support")
console.log(`Scenario: ${scenario.name}`)
console.log(`Description: ${scenario.description}`)
console.log(`Pretext: ${scenario.pretext}`)
console.log(`Objectives: ${scenario.objectives.join(", ")}`)

// List personas
const personas = PretextingPersonas.list()
for (const persona of personas) {
  console.log(`${persona.id}: ${persona.name} (${persona.role})`)
}

// Get persona details
const persona = PretextingPersonas.get("helpdesk-tech")
console.log(`Name: ${persona.name}`)
console.log(`Role: ${persona.role}`)
console.log(`Background: ${persona.background}`)
console.log(`Speech Patterns: ${persona.speechPatterns.join(", ")}`)

// Get call script
const script = PretextingScripts.get("password-reset-call", {
  targetName: "John",
  companyName: "Acme Corp",
  department: "IT Support"
})
console.log(`Opening: ${script.opening}`)
console.log(`Key Points: ${script.keyPoints.join(", ")}`)
console.log(`Objection Handlers:`)
for (const [objection, response] of Object.entries(script.objectionHandlers)) {
  console.log(`  "${objection}" -> "${response}"`)
}
```

### OSINT Reconnaissance

```typescript
import { EmailRecon, OrgRecon, SocialRecon } from "./pentest/soceng"

// Generate email permutations
const emails = EmailRecon.generatePermutations({
  firstName: "John",
  lastName: "Doe",
  domain: "example.com"
})
console.log(`Possible emails: ${emails.join(", ")}`)

// Generate OSINT search queries
const queries = OrgRecon.generateSearchQueries("Acme Corporation")
console.log("Google Dorks:")
for (const query of queries.googleDorks) {
  console.log(`  ${query}`)
}
console.log("LinkedIn Queries:")
for (const query of queries.linkedin) {
  console.log(`  ${query}`)
}

// Organization profiling queries
const orgQueries = OrgRecon.getProfilingQueries("example.com")
console.log(`Technology Stack: ${orgQueries.technology.join(", ")}`)
console.log(`Employee Discovery: ${orgQueries.employees.join(", ")}`)
```

### Security Awareness Training

```typescript
import { AwarenessTraining, AwarenessMetrics, AwarenessReporting } from "./pentest/soceng"

// List training modules
const modules = AwarenessTraining.listModules()
for (const module of modules) {
  console.log(`${module.id}: ${module.title}`)
  console.log(`  Duration: ${module.duration} minutes`)
  console.log(`  Topics: ${module.topics.join(", ")}`)
}

// Get training content
const content = AwarenessTraining.getContent("phishing-basics")
console.log(`Title: ${content.title}`)
console.log(`Sections: ${content.sections.length}`)

// Calculate campaign metrics
const metrics = AwarenessMetrics.calculate(campaignStats)
console.log(`Click Rate: ${metrics.clickRate}%`)
console.log(`Report Rate: ${metrics.reportRate}%`)
console.log(`Phish-Prone Percentage: ${metrics.phishPronePercentage}%`)
console.log(`Industry Comparison: ${metrics.industryComparison}`)

// Generate executive summary
const summary = AwarenessReporting.executiveSummary({
  campaignId: campaign.id,
  includeRecommendations: true,
  includeBenchmarks: true
})
console.log(summary.markdown)
```

## Tool Actions

| Category | Action | Description |
|----------|--------|-------------|
| Email | `email-security` | Assess domain email security (SPF/DKIM/DMARC) |
| Email | `spoof-assessment` | Assess spoofing vulnerability |
| Email | `lookalike-domains` | Generate lookalike domains |
| Phishing | `create-campaign` | Create a phishing campaign |
| Phishing | `list-campaigns` | List all campaigns |
| Phishing | `campaign-status` | Get campaign statistics |
| Phishing | `campaign-report` | Generate detailed report |
| Phishing | `import-targets` | Import targets from CSV |
| Templates | `list-templates` | List phishing email templates |
| Templates | `generate-template` | Generate email template |
| Templates | `list-landing-pages` | List landing page templates |
| Pretexting | `list-scenarios` | List pretexting scenarios |
| Pretexting | `scenario-details` | Get scenario details |
| Pretexting | `list-personas` | List available personas |
| Pretexting | `persona-details` | Get persona details |
| Pretexting | `get-script` | Get call script |
| Recon | `recon-queries` | Generate OSINT search queries |
| Recon | `email-permutations` | Generate email permutations |
| Awareness | `list-training` | List training modules |
| Awareness | `training-content` | Get training content |
| Awareness | `campaign-metrics` | Calculate awareness metrics |
| Awareness | `executive-summary` | Generate executive summary |
| Session | `start-session` | Start a new session |
| Session | `session-status` | Get session status |
| Session | `end-session` | End current session |

## Campaign Types

| Type | Description | Objective |
|------|-------------|-----------|
| `credential-harvest` | Fake login page | Capture credentials |
| `payload-delivery` | Malicious attachment | Deliver payload |
| `link-click` | Track link clicks | Measure susceptibility |
| `data-entry` | Form submission | Capture sensitive data |
| `callback` | Phone call request | Social engineering |
| `usb-drop` | Physical USB drop | Test physical security |
| `awareness-test` | Non-malicious test | Training purposes |

## Phishing Templates

### Email Templates

| ID | Name | Category |
|----|------|----------|
| `password-reset` | Password Reset Required | IT Security |
| `account-verification` | Account Verification | Account Security |
| `document-shared` | Document Shared With You | Collaboration |
| `invoice-attached` | Invoice Attached | Finance |
| `hr-policy-update` | HR Policy Update | Human Resources |
| `executive-request` | Urgent Request from Executive | Business Email Compromise |
| `delivery-notification` | Package Delivery Update | Shipping |
| `voicemail-notification` | New Voicemail Message | Communications |

### Landing Page Templates

| ID | Name | Type |
|----|------|------|
| `microsoft-365` | Microsoft 365 Login | Credential Harvest |
| `google-workspace` | Google Workspace Login | Credential Harvest |
| `generic-login` | Generic Corporate Login | Credential Harvest |
| `webmail` | Webmail Access | Credential Harvest |
| `vpn-portal` | VPN Portal Login | Credential Harvest |
| `file-download` | File Download Page | Payload Delivery |
| `survey-form` | Survey/Feedback Form | Data Entry |

## Pretexting Scenarios

| ID | Name | Category | Difficulty |
|----|------|----------|------------|
| `it-support` | IT Support Call | Technical | Easy |
| `hr-benefits` | HR Benefits Update | HR | Easy |
| `vendor-invoice` | Vendor Invoice Query | Finance | Medium |
| `executive-assistant` | Executive Assistant | BEC | Medium |
| `security-audit` | Security Audit Team | Security | Hard |
| `new-employee` | New Employee Onboarding | HR | Easy |
| `building-maintenance` | Building Maintenance | Physical | Medium |
| `delivery-driver` | Delivery Driver | Physical | Easy |

## Events

| Event | Description |
|-------|-------------|
| `pentest.soceng.session_started` | Assessment session started |
| `pentest.soceng.session_ended` | Assessment session ended |
| `pentest.soceng.campaign_created` | Phishing campaign created |
| `pentest.soceng.campaign_launched` | Campaign started sending |
| `pentest.soceng.campaign_completed` | Campaign finished |
| `pentest.soceng.email_sent` | Phishing email sent |
| `pentest.soceng.email_opened` | Email opened (tracking pixel) |
| `pentest.soceng.link_clicked` | Phishing link clicked |
| `pentest.soceng.credential_captured` | Credentials submitted |
| `pentest.soceng.phish_reported` | User reported phishing |
| `pentest.soceng.payload_executed` | Payload was executed |

## Data Types

### PhishingCampaign

```typescript
{
  id: string
  name: string
  type: "credential-harvest" | "payload-delivery" | "link-click" | ...
  status: "draft" | "scheduled" | "running" | "paused" | "completed"
  profile: string
  targets: Target[]
  templateId: string
  landingPageId?: string
  senderProfile: {
    name: string
    email: string
    replyTo?: string
  }
  schedule: {
    startTime: number
    endTime?: number
    sendRate: number
    randomize: boolean
  }
  stats: CampaignStats
  createdAt: number
  launchedAt?: number
  completedAt?: number
}
```

### Target

```typescript
{
  id: string
  email: string
  firstName?: string
  lastName?: string
  department?: string
  title?: string
  manager?: string
  customFields?: Record<string, string>
  status: "pending" | "sent" | "opened" | "clicked" | "submitted" | "reported"
  events: TargetEvent[]
}
```

### PretextingScenario

```typescript
{
  id: string
  name: string
  category: "technical" | "hr" | "finance" | "security" | "physical"
  difficulty: "easy" | "medium" | "hard"
  description: string
  pretext: string
  objectives: string[]
  requiredInfo: string[]
  suggestedPersona: string
  keyTalkingPoints: string[]
  objectionHandlers: Record<string, string>
  successIndicators: string[]
  ethicalBoundaries: string[]
}
```

### AwarenessMetrics

```typescript
{
  campaignId: string
  totalTargets: number
  emailsSent: number
  emailsOpened: number
  linksClicked: number
  credentialsSubmitted: number
  phishReported: number
  openRate: number
  clickRate: number
  submitRate: number
  reportRate: number
  phishPronePercentage: number
  industryBenchmark: {
    clickRate: number
    reportRate: number
  }
  departmentBreakdown: Record<string, DepartmentStats>
  timeToClick: {
    average: number
    median: number
    fastest: number
  }
  recommendations: string[]
}
```

## Security Considerations

### Ethical Guidelines

1. **Authorization Required**: Always obtain written authorization before testing
2. **Scope Limits**: Stay within defined scope and rules of engagement
3. **Data Protection**: Handle captured credentials securely
4. **No Real Harm**: Never use captured data for malicious purposes
5. **Immediate Notification**: Report critical findings immediately
6. **Training Focus**: Emphasize awareness training over punishment

### Data Handling

- Captured credentials should be hashed or encrypted
- PII should be minimized and protected
- Campaign data should be retained only as long as necessary
- Results should be shared only with authorized personnel

### Legal Compliance

- Ensure compliance with GDPR, CCPA, and other privacy laws
- Follow anti-phishing regulations in your jurisdiction
- Document authorization and scope clearly
- Maintain audit trails for all activities

## Example Use Cases

### Use Case 1: Security Awareness Assessment

```bash
# Check domain email security first
soceng email-security domain=example.com

# Create awareness campaign
soceng create-campaign \
  campaignName="Q1 Awareness Test" \
  campaignType=awareness-test \
  templateId=password-reset \
  landingPageId=microsoft-365

# Import targets
soceng import-targets campaignId=<id> file=/path/to/targets.csv

# Monitor progress
soceng campaign-status campaignId=<id>

# Generate report
soceng campaign-report campaignId=<id>

# Get metrics
soceng campaign-metrics campaignId=<id>

# Executive summary
soceng executive-summary campaignId=<id>
```

### Use Case 2: Red Team Engagement

```bash
# OSINT reconnaissance
soceng recon-queries domain=target-company.com
soceng email-permutations firstName=John lastName=Doe domain=target-company.com

# Assess spoofing potential
soceng spoof-assessment domain=target-company.com
soceng lookalike-domains domain=target-company.com

# Prepare pretexting
soceng list-scenarios
soceng scenario-details scenarioId=it-support
soceng get-script scriptId=password-reset-call targetName=John
```

### Use Case 3: Employee Training Program

```bash
# List training modules
soceng list-training

# Get specific training content
soceng training-content moduleId=phishing-basics

# Calculate metrics for completed campaign
soceng campaign-metrics campaignId=<id>

# Generate executive summary
soceng executive-summary campaignId=<id>
```

## Storage

Campaign data is persisted in:

```
pentest/soceng/
  sessions/
    session_abc123.json         # Session data
  campaigns/
    campaign_def456.json        # Campaign configuration
  targets/
    target_ghi789.json          # Target information
  events/
    event_jkl012.json           # Tracking events
  templates/
    custom_template_mno345.json # Custom templates
  reports/
    report_pqr678.json          # Generated reports
```

## Testing

Run the tests:

```bash
bun test test/pentest/soceng.test.ts
```

## Integration

The tool is registered in `src/tool/registry.ts`:
- `SocEngTool` - Available as `soceng` tool

Exports available from `src/pentest/index.ts`:
- All types: `SocEngTypes`
- Events: `SocEngEvents`
- Storage: `SocEngStorage`
- Profiles: `SocEngProfiles`
- Orchestrator: `SocEngOrchestrator`
- Tool: `SocEngTool`
- Email: `EmailGenerator`, `EmailSpoof`, `EmailHeaders`, `EmailValidation`
- Phishing: `PhishingCampaigns`, `PhishingTemplates`, `PhishingTracking`, `PhishingLanding`, `PhishingPayloads`
- Pretexting: `PretextingScenarios`, `PretextingPersonas`, `PretextingScripts`, `PretextingOSINT`
- Payloads: `USBPayloads`, `DocumentPayloads`, `MacroPayloads`, `HTAPayloads`
- Recon: `EmailRecon`, `OrgRecon`, `SocialRecon`
- Awareness: `AwarenessTraining`, `AwarenessMetrics`, `AwarenessReporting`

## Industry Benchmarks

Based on industry research, typical phishing metrics:

| Metric | Average | Good | Excellent |
|--------|---------|------|-----------|
| Click Rate | 10-15% | 5-10% | <5% |
| Submit Rate | 3-5% | 1-3% | <1% |
| Report Rate | 10-20% | 20-40% | >40% |
| Time to Click | 1-4 hours | N/A | N/A |

Source: Industry reports from KnowBe4, Proofpoint, and Verizon DBIR
