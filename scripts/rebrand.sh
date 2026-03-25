#!/bin/bash
# CyxCode Rebranding Script
# Run this after merging upstream changes to rebrand from opencode to cyxcode

set -e

echo "=== CyxCode Rebranding Script ==="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

echo -e "${YELLOW}Step 1: Updating package names...${NC}"

# Update package.json files - package names
find . -name "package.json" -not -path "*/node_modules/*" -exec sed -i \
    -e 's/"name": "opencode"/"name": "cyxcode"/g' \
    -e 's/"@opencode-ai\//"@cyxcode\//g' \
    -e 's/"opencode": "workspace/"cyxcode": "workspace/g' \
    {} \;

echo -e "${GREEN}✓ Package names updated${NC}"

echo -e "${YELLOW}Step 2: Updating source imports...${NC}"

# Update TypeScript/JavaScript imports
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
    -not -path "*/node_modules/*" -not -path "*/.git/*" \
    -exec sed -i 's/@opencode-ai\//@cyxcode\//g' {} \;

echo -e "${GREEN}✓ Source imports updated${NC}"

echo -e "${YELLOW}Step 3: Updating binary references...${NC}"

# Update binary/CLI references
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.sh" -o -name "*.json" -o -name "*.nix" \) \
    -not -path "*/node_modules/*" -not -path "*/.git/*" \
    -exec sed -i \
    -e 's/\.scriptName("opencode")/.scriptName("cyxcode")/g' \
    -e 's/CYXCODE_/CYXCODE_/g' \
    -e 's/"opencode"/"cyxcode"/g' \
    {} \;

echo -e "${GREEN}✓ Binary references updated${NC}"

echo -e "${YELLOW}Step 4: Updating branding text...${NC}"

# Update branding in markdown and documentation
find . -type f \( -name "*.md" -o -name "*.mdx" -o -name "*.txt" \) \
    -not -path "*/node_modules/*" -not -path "*/.git/*" \
    -exec sed -i \
    -e 's/OpenCode/CyxCode/g' \
    -e 's/opencode\.ai/cyxcode.ai/g' \
    -e 's/anomalyco\/opencode/code3hr\/cyxcode/g' \
    {} \;

echo -e "${GREEN}✓ Branding text updated${NC}"

echo -e "${YELLOW}Step 5: Renaming files...${NC}"

# Rename opencode files to cyxcode
find . -name "*opencode*" -not -path "*/node_modules/*" -not -path "*/.git/*" | while read file; do
    newname=$(echo "$file" | sed 's/opencode/cyxcode/g')
    if [ "$file" != "$newname" ]; then
        mv "$file" "$newname" 2>/dev/null || true
    fi
done

echo -e "${GREEN}✓ Files renamed${NC}"

echo -e "${YELLOW}Step 6: Updating theme references...${NC}"

# Update theme file references
if [ -f "packages/opencode/src/cli/cmd/tui/context/theme.tsx" ]; then
    sed -i \
        -e 's/import opencode from/import cyxcode from/g' \
        -e 's/theme\/opencode\.json/theme\/cyxcode.json/g' \
        -e 's/"opencode"/"cyxcode"/g' \
        -e 's/themes\.opencode/themes.cyxcode/g' \
        packages/opencode/src/cli/cmd/tui/context/theme.tsx
fi

# Rename theme file if exists
if [ -f "packages/opencode/src/cli/cmd/tui/context/theme/opencode.json" ]; then
    mv "packages/opencode/src/cli/cmd/tui/context/theme/opencode.json" \
       "packages/opencode/src/cli/cmd/tui/context/theme/cyxcode.json"
fi

echo -e "${GREEN}✓ Theme references updated${NC}"

echo -e "${YELLOW}Step 7: Updating Debian package files...${NC}"

# Update debian files
if [ -d "debian" ]; then
    find debian -type f -exec sed -i \
        -e 's/opencode/cyxcode/g' \
        -e 's/OpenCode/CyxCode/g' \
        {} \;

    # Rename man page if exists
    [ -f "debian/opencode.1" ] && mv "debian/opencode.1" "debian/cyxcode.1"
fi

echo -e "${GREEN}✓ Debian files updated${NC}"

echo -e "${YELLOW}Step 8: Updating Nix configuration...${NC}"

# Update nix files
if [ -f "nix/opencode.nix" ]; then
    sed -i \
        -e 's/pname = "opencode"/pname = "cyxcode"/g' \
        -e 's/opencode/cyxcode/g' \
        -e 's/OpenCode/CyxCode/g' \
        nix/opencode.nix
    mv "nix/opencode.nix" "nix/cyxcode.nix"
fi

echo -e "${GREEN}✓ Nix configuration updated${NC}"

echo -e "${YELLOW}Step 9: Updating Zed extension...${NC}"

# Update Zed extension
if [ -f "packages/extensions/zed/extension.toml" ]; then
    sed -i \
        -e 's/id = "opencode"/id = "cyxcode"/g' \
        -e 's/name = "OpenCode"/name = "CyxCode"/g' \
        -e 's/opencode/cyxcode/g' \
        -e 's/anomalyco/code3hr/g' \
        packages/extensions/zed/extension.toml

    # Rename icon if exists
    [ -f "packages/extensions/zed/icons/opencode.svg" ] && \
        mv "packages/extensions/zed/icons/opencode.svg" "packages/extensions/zed/icons/cyxcode.svg"
fi

echo -e "${GREEN}✓ Zed extension updated${NC}"

echo -e "${YELLOW}Step 10: Updating GitHub workflows...${NC}"

# Update GitHub workflows
if [ -f ".github/workflows/opencode.yml" ]; then
    sed -i \
        -e 's/opencode/cyxcode/g' \
        -e 's/CYXCODE_/CYXCODE_/g' \
        -e 's/\/oc/\/cc/g' \
        .github/workflows/opencode.yml
    mv ".github/workflows/opencode.yml" ".github/workflows/cyxcode.yml"
fi

echo -e "${GREEN}✓ GitHub workflows updated${NC}"

echo -e "${YELLOW}Step 11: Updating brand assets...${NC}"

# Rename brand asset files
for dir in "packages/console/app/src/asset/brand" "packages/console/app/src/asset/lander"; do
    if [ -d "$dir" ]; then
        find "$dir" -name "*opencode*" | while read file; do
            newname=$(echo "$file" | sed 's/opencode/cyxcode/g')
            [ "$file" != "$newname" ] && mv "$file" "$newname" 2>/dev/null || true
        done
    fi
done

echo -e "${GREEN}✓ Brand assets renamed${NC}"

echo ""
echo -e "${GREEN}=== Rebranding Complete! ===${NC}"
echo ""
echo "Next steps:"
echo "  1. Run 'bun install' to update dependencies"
echo "  2. Review changes with 'git diff'"
echo "  3. Commit with 'git commit -am \"rebrand: apply cyxcode branding\"'"
echo ""
