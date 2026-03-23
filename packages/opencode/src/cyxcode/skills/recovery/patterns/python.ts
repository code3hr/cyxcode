/**
 * Python/pip Error Patterns
 * 
 * Ported from CyxMake error_patterns.c
 */

import type { Pattern } from "../../../types"

export const pythonPatterns: Pattern[] = [
  // MODULE NOT FOUND
  {
    id: "python-module-not-found",
    regex: /ModuleNotFoundError: No module named ['"]([\w\.]+)['"]/,
    category: "python",
    description: "Python module not found",
    extractors: { module: 0 },
    fixes: [
      { id: "pip-install", command: "pip install $1", description: "Install with pip", priority: 1 },
      { id: "pip3-install", command: "pip3 install $1", description: "Install with pip3", priority: 2 },
      { id: "pipx-install", command: "pipx install $1", description: "Install with pipx (for CLI tools)", priority: 3 },
    ],
  },

  // IMPORT ERROR
  {
    id: "python-import-error",
    regex: /ImportError: cannot import name ['"]([\w]+)['"] from ['"]([\w\.]+)['"]/,
    category: "python",
    description: "Python import error",
    fixes: [
      { id: "pip-upgrade", command: "pip install --upgrade $2", description: "Upgrade the package", priority: 1 },
      { id: "pip-reinstall", command: "pip uninstall $2 -y && pip install $2", description: "Reinstall package", priority: 2 },
    ],
  },

  // PIP PERMISSION ERROR
  {
    id: "pip-permission-error",
    regex: /Could not install packages due to.*PermissionError|pip.*Permission denied/i,
    category: "python",
    description: "pip permission denied",
    fixes: [
      { id: "pip-user", command: "pip install --user $1", description: "Install for user only", priority: 1 },
      { id: "use-venv", command: "python -m venv venv && source venv/bin/activate", description: "Use virtual environment", priority: 2 },
    ],
  },

  // VENV NOT FOUND
  {
    id: "python-venv-not-found",
    regex: /No module named venv|ensurepip is not available/i,
    category: "python",
    description: "Python venv module not available",
    fixes: [
      { id: "apt-venv", command: "sudo apt install python3-venv", description: "Install python3-venv (Debian/Ubuntu)", priority: 1 },
    ],
  },

  // PYTHON VERSION ERROR
  {
    id: "python-version-error",
    regex: /Python (\d+\.\d+) or higher is required|requires python_requires/i,
    category: "python",
    description: "Python version incompatible",
    fixes: [
      { id: "pyenv-install", instructions: "Use pyenv to install required Python version", description: "Install with pyenv", priority: 1 },
      { id: "check-python", command: "python3 --version", description: "Check current Python version", priority: 2 },
    ],
  },

  // ENCODING ERROR
  {
    id: "python-encoding-error",
    regex: /UnicodeDecodeError|'charmap' codec can't decode/i,
    category: "python",
    description: "Python encoding error",
    fixes: [
      { id: "set-utf8", instructions: "Add encoding='utf-8' to open() calls", description: "Specify UTF-8 encoding", priority: 1 },
      { id: "set-env", command: "export PYTHONIOENCODING=utf-8", description: "Set Python IO encoding", priority: 2 },
    ],
  },

  // REQUIREMENTS NOT FOUND
  {
    id: "pip-requirements-not-found",
    regex: /Could not open requirements file|No such file.*requirements\.txt/i,
    category: "python",
    description: "requirements.txt not found",
    fixes: [
      { id: "pip-freeze", command: "pip freeze > requirements.txt", description: "Generate requirements.txt", priority: 1 },
    ],
  },

  // DEPENDENCY CONFLICT
  {
    id: "pip-dependency-conflict",
    regex: /pip.*ResolutionImpossible|package versions have conflicting dependencies/i,
    category: "python",
    description: "pip dependency conflict",
    fixes: [
      { id: "pip-upgrade-all", command: "pip install --upgrade -r requirements.txt", description: "Upgrade all dependencies", priority: 1 },
      { id: "fresh-venv", command: "rm -rf venv && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt", description: "Fresh virtual environment", priority: 2 },
    ],
  },
]
