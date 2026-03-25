# Testing Documentation

This document describes the testing approach, test structure, and how to run tests for cyxcode.

---

## Table of Contents

- [Overview](#overview)
- [Running Tests](#running-tests)
- [Test Structure](#test-structure)
- [Governance Tests](#governance-tests)
- [Writing Tests](#writing-tests)
- [Coverage](#coverage)

---

## Overview

cyxcode uses [Bun's built-in test runner](https://bun.sh/docs/cli/test) for unit and integration testing. Tests are located in the `packages/opencode/test/` directory and mirror the source structure.

### Test Stack

| Tool | Purpose |
|------|---------|
| Bun Test | Test runner and assertions |
| `bun:test` | Test framework imports (test, expect, describe) |
| Coverage | Built-in coverage reporting |

---

## Running Tests

### Prerequisites

Ensure Bun is installed:

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Verify installation
bun --version
```

### Run All Tests

```bash
cd packages/opencode
bun test
```

### Run Specific Test File

```bash
cd packages/opencode
bun test test/governance/governance.test.ts
```

### Run Tests Matching Pattern

```bash
cd packages/opencode
bun test --test-name-pattern "classifyTarget"
```

### Run Tests with Coverage

```bash
cd packages/opencode
bun test --coverage
```

### Watch Mode

```bash
cd packages/opencode
bun test --watch
```

---

## Test Structure

```
packages/opencode/test/
├── agent/              # Agent-related tests
├── cli/                # CLI command tests
├── config/             # Configuration tests
├── file/               # File operation tests
├── governance/         # Governance engine tests
│   ├── governance.test.ts    # Main test suite
│   └── test-standalone.ts    # Standalone test script
├── lsp/                # LSP integration tests
├── mcp/                # MCP protocol tests
├── permission/         # Permission system tests
├── plugin/             # Plugin system tests
├── provider/           # Provider tests
├── session/            # Session management tests
├── tool/               # Tool tests
├── util/               # Utility function tests
├── bun.test.ts         # Bun test configuration
└── preload.ts          # Test preload script
```

---

## Governance Tests

The governance module has comprehensive test coverage across all submodules.

### Test File

`test/governance/governance.test.ts`

### Test Results

```
 42 pass
 0 fail
 78 expect() calls
```

### Test Categories

#### GovernanceMatcher Tests

| Test | Description |
|------|-------------|
| `classifyTarget: IPv4 address` | Classifies "192.168.1.1" as IP |
| `classifyTarget: CIDR notation` | Classifies "10.0.0.0/8" as CIDR |
| `classifyTarget: domain` | Classifies "example.com" as domain |
| `classifyTarget: URL extracts hostname` | Extracts hostname from URLs |
| `classifyTarget: unknown` | Returns unknown for unrecognized strings |
| `classifyTarget: validates IP octets` | Rejects invalid IPs like "999.999.999.999" |
| `extractTargets: bash curl` | Extracts URL from curl commands |
| `extractTargets: bash ping` | Extracts IP from ping commands |
| `extractTargets: bash SSH` | Extracts host from SSH commands |
| `extractTargets: webfetch` | Extracts URL from webfetch tool |
| `extractTargets: websearch` | Returns empty for search queries |
| `extractTargets: deduplication` | Deduplicates same targets |
| `extractTargets: multiple targets` | Extracts multiple different targets |
| `ipInCidr: /8 range` | Tests /8 CIDR matching |
| `ipInCidr: /24 range` | Tests /24 CIDR matching |
| `ipInCidr: /32 single host` | Tests single host matching |
| `ipInCidr: /0 all IPs` | Tests match-all CIDR |
| `matchTarget: IP vs CIDR` | Matches IP against CIDR pattern |
| `matchTarget: domain wildcard` | Matches domain against wildcard |
| `matchTarget: exact domain` | Matches exact domain |

#### GovernanceScope Tests

| Test | Description |
|------|-------------|
| `allows when no scope` | Allows all when no config |
| `allows when no targets` | Allows when no targets extracted |
| `allows IP in allowed CIDR` | Allows IPs in allowed range |
| `denies IP not in range` | Denies IPs outside allowed range |
| `deny takes precedence` | Deny list overrides allow list |
| `allows domain matching` | Allows domains matching pattern |
| `denies domain in deny list` | Denies domains matching deny pattern |
| `fails on first violation` | Checks multiple targets, fails fast |

#### GovernancePolicy Tests

| Test | Description |
|------|-------------|
| `default action` | Returns default when no policies |
| `matches by tool name` | Matches policy by tool |
| `matches by tool wildcard` | Matches policy by tool pattern |
| `matches bash command` | Matches bash command patterns |
| `non-bash command filter` | Command filter only applies to bash |
| `matches by target` | Matches policy by target pattern |
| `first match wins` | Policy order determines outcome |
| `AND logic` | All conditions must match |
| `describe formatting` | Formats policy description |

#### GovernanceAudit Tests

| Test | Description |
|------|-------------|
| `records to memory` | Records audit entry to memory |
| `strips args` | Removes args when include_args=false |
| `lists entries` | Lists entries with filters |
| `memoryCount` | Returns correct entry count |
| `clearMemory` | Clears memory buffer |

### Running Governance Tests

```bash
cd packages/opencode

# Run all governance tests
bun test test/governance/governance.test.ts

# Run with coverage
bun test test/governance/governance.test.ts --coverage

# Run specific test
bun test --test-name-pattern "ipInCidr"
```

### Standalone Test Script

For environments without Bun's test runner, use the standalone script:

```bash
cd packages/opencode
bun run test/governance/test-standalone.ts
```

This script runs the same tests without framework dependencies.

---

## Writing Tests

### Basic Test Structure

```typescript
import { test, expect, describe, beforeEach } from "bun:test"
import { MyModule } from "../../src/mymodule"

describe("MyModule", () => {
  beforeEach(() => {
    // Setup before each test
  })

  test("does something", () => {
    const result = MyModule.doSomething()
    expect(result).toBe(expectedValue)
  })

  test("handles edge case", () => {
    expect(() => MyModule.badInput(null)).toThrow()
  })
})
```

### Common Assertions

```typescript
// Equality
expect(value).toBe(expected)           // Strict equality
expect(value).toEqual(expected)        // Deep equality

// Truthiness
expect(value).toBeTruthy()
expect(value).toBeFalsy()
expect(value).toBeNull()
expect(value).toBeUndefined()
expect(value).toBeDefined()

// Numbers
expect(value).toBeGreaterThan(n)
expect(value).toBeGreaterThanOrEqual(n)
expect(value).toBeLessThan(n)
expect(value).toBeLessThanOrEqual(n)

// Strings
expect(string).toContain(substring)
expect(string).toMatch(/regex/)

// Arrays
expect(array).toContain(item)
expect(array).toHaveLength(n)

// Objects
expect(object).toHaveProperty("key")
expect(object).toHaveProperty("key", value)

// Exceptions
expect(() => fn()).toThrow()
expect(() => fn()).toThrow("message")
expect(() => fn()).toThrow(ErrorType)

// Async
await expect(promise).resolves.toBe(value)
await expect(promise).rejects.toThrow()
```

### Testing Async Code

```typescript
test("async operation", async () => {
  const result = await asyncFunction()
  expect(result).toBe(expected)
})

test("async with beforeEach", async () => {
  beforeEach(async () => {
    await setup()
  })

  // Tests run after setup completes
})
```

### Mocking

```typescript
import { mock, spyOn } from "bun:test"

test("with mock", () => {
  const mockFn = mock(() => "mocked")

  const result = mockFn()

  expect(mockFn).toHaveBeenCalled()
  expect(mockFn).toHaveBeenCalledTimes(1)
  expect(result).toBe("mocked")
})

test("with spy", () => {
  const spy = spyOn(object, "method")

  object.method()

  expect(spy).toHaveBeenCalled()
})
```

---

## Coverage

### Viewing Coverage

Run tests with coverage flag:

```bash
bun test --coverage
```

Output shows coverage by file:

```
---------------------------|---------|---------|-------------------
File                       | % Funcs | % Lines | Uncovered Line #s
---------------------------|---------|---------|-------------------
All files                  |   55.37 |   56.88 |
 src/governance/types.ts   |  100.00 |  100.00 |
 src/governance/matcher.ts |  100.00 |   88.52 | 187-193,270-275
 src/governance/policy.ts  |  100.00 |   96.59 | 237,258
 src/governance/scope.ts   |  100.00 |   87.30 | 193-194,219-220
 src/governance/audit.ts   |   80.00 |   56.31 | ...
---------------------------|---------|---------|-------------------
```

### Coverage Goals

| Module | Target |
|--------|--------|
| Core governance | >90% functions, >80% lines |
| Utilities | >80% functions |
| Integration | >70% lines |

### Improving Coverage

1. Identify uncovered lines from coverage report
2. Add tests for edge cases and error paths
3. Test error handling and exception cases
4. Add integration tests for complex flows

---

## Continuous Integration

Tests run automatically on:

- Pull request creation
- Push to main/dev branches
- Manual workflow trigger

### CI Configuration

Tests are configured in `.github/workflows/` to:

1. Install dependencies with Bun
2. Run type checking
3. Run test suite
4. Report coverage

---

## Troubleshooting

### Common Issues

#### "Cannot find module" Error

Ensure you're in the correct directory:

```bash
cd packages/opencode
bun test
```

#### Tests Timeout

Increase timeout for slow tests:

```typescript
test("slow test", async () => {
  // ...
}, 30000) // 30 second timeout
```

#### Flaky Tests

- Avoid relying on timing
- Use proper async/await
- Clean up state in beforeEach/afterEach
- Isolate tests from external dependencies

#### Coverage Not Working

Ensure bun version supports coverage:

```bash
bun --version  # Should be 1.0+
```

---

## Resources

- [Bun Test Documentation](https://bun.sh/docs/cli/test)
- [Bun Test API](https://bun.sh/docs/api/test)
- [Jest-compatible Matchers](https://bun.sh/docs/test/matchers)
