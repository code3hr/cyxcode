#!/usr/bin/env node
// Patch baseline-browser-mapping to suppress the "data is over two months old" warning
import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

function findFiles(dir, pattern, results = []) {
  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        findFiles(fullPath, pattern, results)
      } else if (entry.name.match(pattern)) {
        results.push(fullPath)
      }
    }
  } catch (e) {
    // Skip directories we can't read
  }
  return results
}

// Find all baseline-browser-mapping dist files
const nodeModules = join(rootDir, 'node_modules')
const files = findFiles(nodeModules, /^index\.(js|cjs)$/)
  .filter(f => f.includes('baseline-browser-mapping') && f.includes('dist'))

let patchedCount = 0
for (const fullPath of files) {
  try {
    let content = readFileSync(fullPath, 'utf-8')
    const original = content

    // Method 1: Replace env var check with true (for newer versions)
    content = content.replace(
      /process\.env\.BASELINE_BROWSER_MAPPING_IGNORE_OLD_DATA/g,
      'true'
    )

    // Method 2: Remove the console.warn call directly (for older versions without env check)
    content = content.replace(
      /console\.warn\("\[baseline-browser-mapping\][^"]*two months old[^)]+\)/g,
      'void 0'
    )

    if (content !== original) {
      writeFileSync(fullPath, content)
      patchedCount++
      console.log(`Patched: ${fullPath.replace(rootDir, '.')}`)
    }
  } catch (e) {
    console.error(`Failed to patch ${fullPath}: ${e.message}`)
  }
}

if (patchedCount > 0) {
  console.log(`Patched ${patchedCount} file(s)`)
} else {
  console.log('No files needed patching')
}
