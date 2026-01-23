# Cyxwiz - Social Media Post Templates

## Short Version (Twitter/X, LinkedIn)

```
Tired of memorizing nmap flags, nikto options, and nuclei syntax?

I built Cyxwiz - an AI-powered pentest assistant. Just describe what you need:

"scan this network for web vulnerabilities"

And it:
- Runs the right tools (nmap, nikto, nuclei)
- Parses the output
- Classifies findings by severity
- Generates professional reports

Built on OpenCode agent. Open source.

GitHub: https://github.com/code3hr/opencode
Download: https://github.com/code3hr/opencode/releases/latest

#infosec #pentesting #cybersecurity #AI #opensource
```

---

## Medium Version (Reddit, Dev.to, Forums)

```
# Cyxwiz: Stop Memorizing Tool Syntax, Start Describing What You Need

Hey everyone,

I've been working on something I think the community might find useful.

## The Problem

As pentesters, we spend too much time on syntax:
- nmap has 130+ options
- nuclei has dozens of flags
- sqlmap has 100+ parameters

Multiply by 30+ tools per assessment. That's not security work - that's a memorization exercise.

## The Solution: Cyxwiz

Cyxwiz is an AI-powered security assistant. You describe what you want in plain English:

```
You: "scan 192.168.1.0/24 for web vulnerabilities"

Cyxwiz: [Runs nmap → finds web servers]
     [Runs nikto → checks vulnerabilities]
     [Runs nuclei → matches CVEs]

     Found 3 critical, 5 high, 8 medium findings.
     All saved with evidence. Want a report?
```

## What Makes It Different?

Built on OpenCode (superior agent architecture), Cyxwiz adds:

- **30+ Security Tools** - nmap, nikto, nuclei, gobuster, sqlmap, etc.
- **Intelligent Parsers** - Extracts structured findings from raw output
- **Findings Database** - Severity classification, OWASP mapping, CVE tracking
- **Governance Engine** - Scope enforcement, audit trails
- **Report Generation** - Professional HTML/PDF reports

## Not Another Wrapper

Unlike basic LLM CLIs that just run commands, Cyxwiz:
- Actually understands security tool output
- Maintains persistent findings across sessions
- Prevents out-of-scope accidents
- Generates compliance-ready audit logs

## Try It

- GitHub: https://github.com/code3hr/opencode
- Download: https://github.com/code3hr/opencode/releases/latest
- Platforms: Linux, macOS, Windows

It's open source (MIT). Would love feedback from the community.

What features would you want to see?
```

---

## Long Version (Hacker News "Show HN", Blog Post)

```
# Show HN: Cyxwiz - AI-Powered Pentest Assistant (Open Source)

I built Cyxwiz because I was tired of context-switching between remembering tool syntax and actually doing security work.

## Background

I've been doing security assessments for a while, and the workflow is always:
1. Remember the right tool for the job
2. Look up the flags (again)
3. Run the command
4. Parse the output manually
5. Copy findings to a spreadsheet
6. Repeat 100 times
7. Manually write the report

## What Cyxwiz Does

Cyxwiz lets you describe what you want in natural language:

"check if this Apache server is vulnerable to path traversal"

And it:
1. Selects the right tools (nuclei with CVE-2021-41773 templates)
2. Runs them with correct parameters
3. Parses the output into structured findings
4. Classifies by severity (Critical/High/Medium/Low)
5. Stores with evidence for the report
6. Generates professional reports when you're done

## Technical Details

Built on OpenCode (https://github.com/sst/opencode), which provides:
- Superior agent architecture vs generic LLM CLIs
- Extensible tool framework with typed I/O
- Multi-LLM support (Claude, GPT-4, Gemini, local models)

Cyxwiz adds a security layer:
- 30+ tool integrations with output parsers
- Findings database with OWASP/CVE categorization
- Governance engine (scope enforcement, audit trails)
- Report generation (HTML, PDF, Markdown)

## What It's NOT

- Not a replacement for knowing what you're doing
- Not for unauthorized testing
- Not a magic "hack anything" button

It's an assistant that handles the tedious parts so you can focus on analysis.

## Stack

- TypeScript/Bun
- Runs on Kali, Parrot, any Linux, macOS, Windows
- Requires API key (Claude recommended, GPT-4 works too)

## Links

- GitHub: https://github.com/code3hr/opencode
- Downloads: https://github.com/code3hr/opencode/releases/latest

Open source, MIT licensed. Feedback welcome!
```

---

## Quick Demo Script (for Video/GIF)

```
# Terminal recording script

$ ./cyxwiz

> scan 10.0.0.5 for vulnerabilities

[Cyxwiz runs nmap, detects Apache 2.4.41]
[Cyxwiz runs nikto, finds misconfigurations]
[Cyxwiz runs nuclei, matches CVE-2021-41773]

Found 1 critical, 2 high, 3 medium findings.

> show critical findings

CRITICAL: CVE-2021-41773 - Apache Path Traversal
- Target: 10.0.0.5:80
- Impact: Remote Code Execution
- Evidence: [response data]
- Remediation: Upgrade to Apache 2.4.51+

> generate report

Report generated: assessment-2024-01-15.html
```

---

## Platform-Specific Tips

### Reddit (r/netsec, r/pentesting)
- Don't be too salesy
- Focus on the problem you solved
- Ask for feedback
- Engage with comments

### Hacker News
- Technical depth appreciated
- Mention the architecture
- Be honest about limitations
- "Show HN:" prefix for launches

### Twitter/X
- Thread format works well
- Include a GIF/video demo
- Tag relevant accounts
- Use hashtags sparingly

### LinkedIn
- More professional tone
- Mention business value
- Connect with security leaders

### Product Hunt
- Need good visuals
- Schedule for Tuesday-Thursday
- Prepare for Q&A

---

## Hashtags

```
#infosec #pentesting #cybersecurity #hacking #security
#bugbounty #redteam #AI #LLM #opensource #kalilinux
```

## Accounts to Tag (Twitter)

```
@offensive_con @defaboreal @NahamSec @staboreal
@TomNomNom @Jhaddix @inlocsec @InfoSecSherpa
```
