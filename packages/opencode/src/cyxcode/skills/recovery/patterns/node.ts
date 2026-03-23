/**
 * Node.js / npm Error Patterns
 * 
 * Ported from CyxMake error_patterns.c
 */

import type { Pattern } from "../../../types"

export const nodePatterns: Pattern[] = [
  // MODULE NOT FOUND
  {
    id: "node-module-not-found",
    regex: /Cannot find module ['"]([@\w\/-]+)['"]/,
    category: "node",
    description: "Node.js module not found",
    extractors: { module: 0 },
    fixes: [
      { id: "npm-install", command: "npm install $1", description: "Install missing module with npm", priority: 1 },
      { id: "yarn-add", command: "yarn add $1", description: "Install missing module with yarn", priority: 2 },
      { id: "pnpm-add", command: "pnpm add $1", description: "Install missing module with pnpm", priority: 3 },
      { id: "bun-add", command: "bun add $1", description: "Install missing module with bun", priority: 4 },
    ],
  },
  
  // NPM ERR! EACCES
  {
    id: "npm-eacces",
    regex: /npm ERR! code EACCES|EACCES.*permission denied/i,
    category: "node",
    description: "npm permission denied error",
    fixes: [
      { id: "fix-npm-perms", command: "sudo chown -R $(whoami) ~/.npm", description: "Fix npm directory permissions", priority: 1 },
      { id: "use-npx", instructions: "Use npx instead of global install, or configure npm prefix", description: "Avoid global installs", priority: 2 },
    ],
  },

  // NPM ERR! ENOENT
  {
    id: "npm-enoent-package",
    regex: /npm ERR! code ENOENT.*package\.json/i,
    category: "node",
    description: "package.json not found",
    fixes: [
      { id: "npm-init", command: "npm init -y", description: "Initialize package.json", priority: 1 },
    ],
  },

  // PEER DEPENDENCIES
  {
    id: "npm-peer-deps",
    regex: /npm ERR! code ERESOLVE|peer dep.*conflict|Could not resolve dependency/i,
    category: "node",
    description: "npm peer dependency conflict",
    fixes: [
      { id: "npm-legacy-peer", command: "npm install --legacy-peer-deps", description: "Install with legacy peer deps handling", priority: 1 },
      { id: "npm-force", command: "npm install --force", description: "Force install (may cause issues)", priority: 2 },
    ],
  },

  // NODE VERSION MISMATCH
  {
    id: "node-version-mismatch",
    regex: /The engine "node" is incompatible|requires.*node.*(\d+)/i,
    category: "node",
    description: "Node.js version mismatch",
    fixes: [
      { id: "nvm-use", instructions: "Use nvm to switch Node versions: nvm use <version>", description: "Switch Node version with nvm", priority: 1 },
    ],
  },

  // NPM REGISTRY ERROR
  {
    id: "npm-registry-error",
    regex: /npm ERR! code E(404|500|503)|registry.*not found/i,
    category: "node",
    description: "npm registry error",
    fixes: [
      { id: "npm-cache-clean", command: "npm cache clean --force", description: "Clean npm cache", priority: 1 },
      { id: "npm-registry-reset", command: "npm config set registry https://registry.npmjs.org/", description: "Reset npm registry", priority: 2 },
    ],
  },

  // TYPESCRIPT ERRORS
  {
    id: "ts-cannot-find-module",
    regex: /TS2307.*Cannot find module ['"]([@\w\/-]+)['"]|error TS2307/,
    category: "node",
    description: "TypeScript cannot find module",
    extractors: { module: 0 },
    fixes: [
      { id: "install-types", command: "npm install -D @types/$1", description: "Install TypeScript types", priority: 1 },
      { id: "install-module", command: "npm install $1", description: "Install the module", priority: 2 },
    ],
  },

  // NODE_MODULES CORRUPTION
  {
    id: "node-modules-corrupt",
    regex: /EINTEGRITY|integrity checksum failed|Unexpected end of JSON/i,
    category: "node",
    description: "Corrupted node_modules or package-lock",
    fixes: [
      { id: "rm-reinstall", command: "rm -rf node_modules package-lock.json && npm install", description: "Remove node_modules and reinstall", priority: 1 },
    ],
  },

  // PORT IN USE
  {
    id: "node-port-in-use",
    regex: /EADDRINUSE.*:(\d+)|port (\d+).*already in use/i,
    category: "node",
    description: "Port already in use",
    extractors: { port: 0 },
    fixes: [
      { id: "kill-port", command: "npx kill-port $1", description: "Kill process using the port", priority: 1 },
      { id: "find-port-process", command: "lsof -i :$1", description: "Find process using port", priority: 2 },
    ],
  },
]
