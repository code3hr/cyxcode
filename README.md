# CyxCode

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a> |
  <a href="README.zht.md">繁體中文</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.it.md">Italiano</a> |
  <a href="README.da.md">Dansk</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.pl.md">Polski</a> |
  <a href="README.ru.md">Русский</a> |
  <a href="README.bs.md">Bosanski</a> |
  <a href="README.ar.md">العربية</a> |
  <a href="README.no.md">Norsk</a> |
  <a href="README.br.md">Português (Brasil)</a> |
  <a href="README.th.md">ไทย</a> |
  <a href="README.tr.md">Türkçe</a> |
  <a href="README.uk.md">Українська</a> |
  <a href="README.bn.md">বাংলা</a> |
  <a href="README.gr.md">Ελληνικά</a> |
  <a href="README.vi.md">Tiếng Việt</a>
</p>

[![OpenCode Terminal UI](packages/web/src/assets/lander/screenshot.png)](https://opencode.ai)

---

## Why CyxCode?

OpenClaw has 700+ skills. We have 3. **Thats the point.**

# Package managers
npm i -g opencode-ai@latest        # or bun/pnpm/yarn
scoop install opencode             # Windows
choco install opencode             # Windows
brew install anomalyco/tap/opencode # macOS and Linux (recommended, always up to date)
brew install opencode              # macOS and Linux (official brew formula, updated less)
sudo pacman -S opencode            # Arch Linux (Stable)
paru -S opencode-bin               # Arch Linux (Latest from AUR)
mise use -g opencode               # Any OS
nix run nixpkgs#opencode           # or github:anomalyco/opencode for latest dev branch
```

Most developer errors are **known patterns**. Why burn tokens asking an LLM to figure out "module not found" for the 10,000th time?

### Desktop App (BETA)

OpenCode is also available as a desktop application. Download directly from the [releases page](https://github.com/anomalyco/opencode/releases) or [opencode.ai/download](https://opencode.ai/download).

| Platform              | Download                              |
| --------------------- | ------------------------------------- |
| macOS (Apple Silicon) | `opencode-desktop-darwin-aarch64.dmg` |
| macOS (Intel)         | `opencode-desktop-darwin-x64.dmg`     |
| Windows               | `opencode-desktop-windows-x64.exe`    |
| Linux                 | `.deb`, `.rpm`, or AppImage           |

```bash
# macOS (Homebrew)
brew install --cask opencode-desktop
# Windows (Scoop)
scoop bucket add extras; scoop install extras/opencode-desktop
```
$ docker-compose up -d
Error: Cannot connect to the Docker daemon. Is the docker daemon running?

<cyxcode_recovery pattern="docker-daemon-not-running">
Matched: Docker daemon not running
Suggested fixes:
  1. Start Docker (Linux)
     sudo systemctl start docker
  2. Start Docker Desktop (macOS)
     (open Docker Desktop app)
</cyxcode_recovery>

The install script respects the following priority order for the installation path:

1. `$OPENCODE_INSTALL_DIR` - Custom installation directory
2. `$XDG_BIN_DIR` - XDG Base Directory Specification compliant path
3. `$HOME/bin` - Standard user binary directory (if it exists or can be created)
4. `$HOME/.opencode/bin` - Default fallback

```bash
# Examples
OPENCODE_INSTALL_DIR=/usr/local/bin curl -fsSL https://opencode.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://opencode.ai/install | bash
```

### Agents

OpenCode includes two built-in agents you can switch between with the `Tab` key.

- **build** - Default, full-access agent for development work
- **plan** - Read-only agent for analysis and code exploration
  - Denies file edits by default
  - Asks permission before running bash commands
  - Ideal for exploring unfamiliar codebases or planning changes

Also included is a **general** subagent for complex searches and multistep tasks.
This is used internally and can be invoked using `@general` in messages.

Learn more about [agents](https://opencode.ai/docs/agents).

### Documentation

For more info on how to configure OpenCode, [**head over to our docs**](https://opencode.ai/docs).

### Contributing

If you're interested in contributing to OpenCode, please read our [contributing docs](./CONTRIBUTING.md) before submitting a pull request.

### Building on OpenCode

If you are working on a project that's related to OpenCode and is using "opencode" as part of its name, for example "opencode-dashboard" or "opencode-mobile", please add a note to your README to clarify that it is not built by the OpenCode team and is not affiliated with us in any way.

### FAQ

#### How is this different from Claude Code?

It's very similar to Claude Code in terms of capability. Here are the key differences:

- 100% open source
- Not coupled to any provider. Although we recommend the models we provide through [OpenCode Zen](https://opencode.ai/zen), OpenCode can be used with Claude, OpenAI, Google, or even local models. As models evolve, the gaps between them will close and pricing will drop, so being provider-agnostic is important.
- Out-of-the-box LSP support
- A focus on TUI. OpenCode is built by neovim users and the creators of [terminal.shop](https://terminal.shop); we are going to push the limits of what's possible in the terminal.
- A client/server architecture. This, for example, can allow OpenCode to run on your computer while you drive it remotely from a mobile app, meaning that the TUI frontend is just one of the possible clients.

---

## Token Savings

| Scenario | Without CyxCode | With CyxCode | Savings |
|----------|-----------------|--------------|---------|
| npm module not found | ~700 tokens | 0 tokens | **100%** |
| git push rejected | ~500 tokens | 0 tokens | **100%** |
| Docker daemon error | ~600 tokens | 0 tokens | **100%** |
| SSL cert expired | ~800 tokens | 0 tokens | **100%** |
| Terraform state lock | ~900 tokens | 0 tokens | **100%** |
| Kubernetes pod crash | ~1000 tokens | 0 tokens | **100%** |

**136 patterns = 136 common errors that never need LLM tokens.**

---

## Skills (3 Deep, Not 700 Wide)

### Recovery Skill - 51 patterns
Zero LLM tokens for known build/runtime errors.

| Category | Patterns | Examples |
|----------|----------|----------|
| Node/npm | 9 | module not found, EACCES, peer deps |
| Git | 9 | merge conflict, push rejected, auth |
| Build | 8 | CMake, linker, compiler not found |
| Docker | 8 | daemon not running, port conflict |
| Python | 8 | ModuleNotFoundError, venv, encoding |
| System | 9 | permission denied, disk full, OOM |

### Security Skill - 39 patterns
SSL, auth, SSH, and vulnerability detection.

| Category | Patterns | Examples |
|----------|----------|----------|
| SSL/TLS | 7 | cert expired, untrusted, handshake |
| Auth | 8 | 401/403, OAuth, CORS, rate limit |
| SSH | 7 | publickey denied, host key, agent |
| Network | 8 | firewall, VPN, CSP, HSTS |
| Scans | 9 | SQLi, XSS, CVE, exposed secrets |

### DevOps Skill - 46 patterns
Kubernetes, Terraform, CI/CD, cloud providers.

| Category | Patterns | Examples |
|----------|----------|----------|
| Kubernetes | 10 | CrashLoopBackOff, ImagePull, RBAC |
| Terraform | 9 | state lock, cycles, backend, import |
| CI/CD | 9 | GHA syntax, runner offline, cache |
| Cloud | 10 | AWS/GCP/Azure auth, quotas |
| Ansible | 8 | unreachable, vault, undefined vars |

---

## How It Works

```
Error occurs
     |
     v
+-------------------+
| Pattern Match     |---- Match found ----> Apply fix (FREE, 0 tokens)
| (136 patterns)    |                              |
+---------+---------+                              |
          |                                        |
     No match                                      |
          |                                        |
          v                                        |
+-------------------+                              |
| LLM Fallback      |---- Novel solution ----------+
| (costs tokens)    |                              |
+-------------------+                              |
                                                   v
                                            +----------+
                                            |  Retry   |
                                            +----------+
```

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+U` | Scroll up (half page) |
| `Ctrl+D` | Scroll down (half page) |
| `Ctrl+B` | Page up |
| `Ctrl+F` | Page down |
| `Ctrl+T` | Switch model variants |
| `Tab` | Switch agents |
| `Ctrl+P` | Open command palette |

---

## Installation

```bash
# Clone and run
git clone https://github.com/code3hr/cyxcode.git
cd cyxcode
bun install
bun run dev
```

### API Key

```bash
export ANTHROPIC_API_KEY=sk-ant-...    # Claude (recommended)
# or
export OPENAI_API_KEY=sk-...           # GPT-4
```

---

## Architecture

```
                        CYXCODE
    +--------------------------------------------------+
    |                  Skill Router                     |
    |   Match error -> Find patterns -> Suggest fix    |
    +--------------------------------------------------+
                           |
        +------------------+------------------+
        v                  v                  v
  +-----------+      +-----------+      +-----------+
  |  Recovery |      | Security  |      |  DevOps   |
  |  51 ptns  |      |  39 ptns  |      |  46 ptns  |
  +-----------+      +-----------+      +-----------+
       |                  |                  |
  node, git,         ssl, auth,         k8s, tf,
  docker, py         ssh, scan          cicd, cloud
```

---

## Comparison

### vs OpenClaw

| | OpenClaw | CyxCode |
|--|----------|---------|
| Skills | 700+ | 3 deep |
| Patterns | 0 | 136 |
| Decision | LLM always | Patterns first |
| Token cost | High | **80% lower** |

### vs Claude Code / Cursor

| | Claude Code | CyxCode |
|--|-------------|---------|
| Error handling | LLM every time | Pattern library |
| Domain knowledge | None built-in | 136 patterns |
| Token savings | None | **136 free fixes** |

---

## Roadmap

| Phase | Focus | Status |
|-------|-------|--------|
| 1 | Skill interface + router | **Done** |
| 2 | Recovery skill (51 patterns) | **Done** |
| 3 | Security skill (39 patterns) | **Done** |
| 4 | DevOps skill (46 patterns) | **Done** |
| 5 | Bash tool integration | **Done** |
| 6 | Track token savings | Next |
| 7 | Community skills | Planned |

---

## License

MIT License - See [LICENSE](LICENSE)

---

**CyxCode** - *136 patterns. Zero tokens. Depth over breadth.*
