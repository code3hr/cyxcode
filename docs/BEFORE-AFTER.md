# Before/After: CyxCode vs Standard AI Error Handling

This document shows the same errors handled with and without CyxCode's pattern matching.

## Example 1: Python Module Not Found

### Without CyxCode (standard AI tool)

```
User: python3 -c 'import flask'

Thinking: The user is running a Python command to check if Flask is
importable. Let me run this command for them.

$ python3 -c 'import flask'
Traceback (most recent call last):
  File "<string>", line 1, in <module>
ModuleNotFoundError: No module named 'flask'

Thinking: As expected, ModuleNotFoundError for the nonexistent module.
The flask module is not installed. I should let the user know.

Flask is not installed. Run `pip install flask` to install it.

Tokens used: ~1,200 (input: ~800, output: ~400)
Time: ~5-6 seconds
Cost: ~$0.002
```

**Two LLM calls**: One to decide to run the command, another to analyze the error.

### With CyxCode — Normal Mode

```
User: python3 -c 'import flask'

Thinking: The user is running a Python command to check if Flask is
installed. Let me run this command for them.

$ python3 -c 'import flask'
ModuleNotFoundError: No module named 'flask'

[CyxCode] Pattern matched: python-module-not-found (recovery)
[CyxCode] Python module not found
[CyxCode] Suggested fixes:
1. Install with pip
  pip install flask
2. Install with pip3
  pip3 install flask
3. Install with pipx (for CLI tools)
  pipx install flask
[CyxCode] Tokens saved by pattern match (no LLM needed for diagnosis)

Tokens used: ~600 (input only, LLM Call #2 skipped)
Time: ~3-4 seconds
Cost: ~$0.001
```

**One LLM call**: AI decides to run the command. CyxCode short-circuits the return trip.

### With CyxCode — Shell Mode (`!` prefix)

```
User: !python3 -c 'import flask'

# Shell
$ python3 -c 'import flask'
ModuleNotFoundError: No module named 'flask'

[CyxCode] Pattern matched: python-module-not-found (recovery)
[CyxCode] Python module not found
[CyxCode] Suggested fixes:
1. Install with pip
  pip install flask
2. Install with pip3
  pip3 install flask
3. Install with pipx (for CLI tools)
  pipx install flask
[CyxCode] Tokens saved by pattern match (no LLM needed for diagnosis)

Tokens used: 0
Time: instant (~50ms)
Cost: $0.00
```

**Zero LLM calls**: Command runs directly, CyxCode handles the error. No AI involved at all.

---

## Example 2: Git Push Rejected

### Without CyxCode

```
User: push my changes

Thinking: I'll push the changes to the remote repository.

$ git push
error: failed to push some refs to 'origin'
hint: Updates were rejected because the remote contains work that you do not have locally.

Thinking: The push was rejected because the remote has changes we don't have.
We need to pull first.

Your push was rejected because the remote has newer changes.
Run `git pull --rebase` first, then push again.

Tokens: ~1,400    Time: ~6s    Cost: ~$0.003
```

### With CyxCode — Shell Mode

```
User: !git push

# Shell
$ git push
error: failed to push some refs to 'origin'
Updates were rejected because the remote contains work...

[CyxCode] Pattern matched: git-push-rejected (recovery)
[CyxCode] Git push rejected - need to pull first
[CyxCode] Suggested fixes:
1. Pull with rebase then push
  git pull --rebase
2. Pull and merge then push
  git pull

Tokens: 0    Time: instant    Cost: $0.00
```

---

## Example 3: Docker Daemon Not Running

### Without CyxCode

```
User: start the containers

Thinking: Let me start the Docker containers.

$ docker-compose up -d
Cannot connect to the Docker daemon. Is the docker daemon running?

Thinking: The Docker daemon isn't running. I should suggest starting it.

Docker is not running. Start it with:
- Linux: `sudo systemctl start docker`
- macOS: Open Docker Desktop

Tokens: ~1,100    Time: ~5s    Cost: ~$0.002
```

### With CyxCode — Shell Mode

```
User: !docker-compose up -d

# Shell
$ docker-compose up -d
Cannot connect to the Docker daemon. Is the docker daemon running?

[CyxCode] Pattern matched: docker-daemon-not-running (recovery)
[CyxCode] Docker daemon not running
[CyxCode] Suggested fixes:
1. Start Docker (Linux)
  sudo systemctl start docker
2. Start Docker Desktop (macOS)
  (manual)

Tokens: 0    Time: instant    Cost: $0.00
```

---

## Summary

| Scenario | LLM Calls | Tokens | Time | Cost |
|----------|-----------|--------|------|------|
| Standard AI (no CyxCode) | 2 | ~1,200 | ~5-6s | ~$0.002 |
| CyxCode Normal Mode | 1 (short-circuit) | ~600 | ~3-4s | ~$0.001 |
| CyxCode Shell Mode (`!`) | 0 | 0 | instant | **$0.00** |

**Over a typical dev session with 20 errors that match patterns:**

| Tool | Total tokens | Total cost |
|------|-------------|------------|
| Standard AI | ~24,000 | ~$0.04 |
| CyxCode Normal | ~12,000 | ~$0.02 |
| CyxCode Shell | **0** | **$0.00** |
