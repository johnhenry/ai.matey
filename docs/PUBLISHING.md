# Publishing to npm

This guide covers how to publish ai.matey packages to npm using Changesets.

## Overview

The monorepo uses:
- **npm workspaces** for package management
- **Turbo** for parallel builds
- **Changesets** for versioning and publishing

## Prerequisites

### 1. Login to npm

```bash
npm login
```

You'll be prompted for username, password, and OTP if 2FA is enabled.

### 2. Verify login

```bash
npm whoami
```

### 3. Ensure packages build successfully

```bash
npm run build
```

## Publishing Workflow

### Step 1: Create a Changeset

When you make changes that should be published, create a changeset:

```bash
npm run changeset
```

This interactive CLI will ask:
1. **Which packages changed?** (select with spacebar)
2. **Semver bump type?** (major/minor/patch)
3. **Summary of changes?** (appears in CHANGELOG)

This creates a markdown file in `.changeset/` describing the changes.

**Example changeset file** (`.changeset/happy-dogs-dance.md`):
```markdown
---
"ai.matey.core": minor
"ai.matey.http.core": patch
---

Added new routing capabilities to core and fixed rate limiter bug
```

### Step 2: Version Packages

When ready to release, consume the changesets and update versions:

```bash
npm run version-packages
```

This will:
- Update `package.json` versions for changed packages
- Update internal dependency versions automatically
- Generate/update CHANGELOG.md files
- Delete the consumed changeset files

### Step 3: Commit Version Changes

```bash
git add .
git commit -m "Version packages for release"
git push
```

### Step 4: Publish to npm

```bash
npm run release
```

This runs `turbo run build && changeset publish`, which:
- Rebuilds all packages
- Publishes changed packages to npm
- Creates git tags for each published version

## First-Time Publish

For an initial publish of all 21 packages.

### Option A: Using Changesets (Recommended)

```bash
# Create a changeset for all packages
npm run changeset
# Select all packages, choose "patch" or "minor" for initial release

# Version and publish
npm run version-packages
git add . && git commit -m "Initial release"
npm run release
```

### Option B: Manual bulk publish

```bash
# Build everything first
npm run build

# Publish all packages from workspace
npm exec --workspaces -- npm publish --access public
```

### Staggered Rollout (Avoiding Rate Limits)

When publishing many packages for the first time, npm may rate limit you. To avoid this, publish in batches with delays:

**Option 1: Publish by category with delays**

```bash
# Build everything first
npm run build

# Core packages first (these are dependencies)
for pkg in ai.matey.types ai.matey.errors ai.matey.utils ai.matey.testing ai.matey.core ai.matey; do
  npm publish --workspace=$pkg --access public
  sleep 5
done

# Wait before next batch
sleep 30

# Backend and Frontend packages
for pkg in ai.matey.backend ai.matey.backend.browser ai.matey.frontend; do
  npm publish --workspace=$pkg --access public
  sleep 5
done

# Middleware and HTTP
for pkg in ai.matey.middleware ai.matey.http-core ai.matey.http; do
  npm publish --workspace=$pkg --access public
  sleep 5
done

# Wrappers, React, Native, CLI
for pkg in ai.matey.wrapper ai.matey.react.core ai.matey.react.hooks ai.matey.react.nextjs ai.matey.react.stream ai.matey.native.apple ai.matey.native.model-runner ai.matey.native.node-llamacpp ai.matey.cli; do
  npm publish --workspace=$pkg --access public
  sleep 5
done
```

**Option 2: Simple staggered publish script**

Create a file `scripts/staggered-publish.sh`:

```bash
#!/bin/bash
# Staggered publish to avoid npm rate limits

DELAY_BETWEEN_PACKAGES=5  # seconds
DELAY_BETWEEN_BATCHES=60  # seconds
BATCH_SIZE=10

packages=($(npm query .workspace | jq -r '.[].name'))
count=0

for pkg in "${packages[@]}"; do
  echo "Publishing $pkg..."
  npm publish --workspace="$pkg" --access public

  count=$((count + 1))

  if [ $((count % BATCH_SIZE)) -eq 0 ]; then
    echo "Batch complete. Waiting ${DELAY_BETWEEN_BATCHES}s..."
    sleep $DELAY_BETWEEN_BATCHES
  else
    sleep $DELAY_BETWEEN_PACKAGES
  fi
done

echo "Done! Published $count packages."
```

Run with:
```bash
chmod +x scripts/staggered-publish.sh
./scripts/staggered-publish.sh
```

**Option 3: Use npm's built-in retry**

If you get rate limited, npm will show an error with a retry-after time. You can:

```bash
# Retry failed publishes after waiting
npm run release 2>&1 | tee publish.log

# Check which packages failed
grep -i "error" publish.log

# Retry specific packages
npm publish --workspace=ai.matey.backend/openai --access public
```

**Rate limit tips:**
- npm typically allows ~100 publishes per hour for verified accounts
- New accounts may have stricter limits
- Wait 1-2 hours if you hit limits, then resume
- Consider publishing over multiple sessions for very large initial releases

## Configuration

### Changeset Config (`.changeset/config.json`)

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

Key settings:
- `access: "public"` - Packages publish publicly (required for unscoped packages)
- `updateInternalDependencies: "patch"` - Auto-bumps dependents when dependencies change
- `baseBranch: "main"` - Base branch for version comparisons

## Package Structure

Each package includes:
```
packages/ai.matey.core/
├── src/              # Source TypeScript
├── dist/
│   ├── esm/          # ES Modules build
│   ├── cjs/          # CommonJS build
│   └── types/        # TypeScript declarations
├── package.json
├── README.md
├── CHANGELOG.md      # Auto-generated by changesets
└── LICENSE
```

The `files` field in `package.json` controls what gets published:
```json
{
  "files": ["dist", "README.md", "CHANGELOG.md", "LICENSE"]
}
```

## Troubleshooting

### Check if package name is available

```bash
npm view ai.matey.core
# 404 = name is available
```

### Dry run publish

```bash
npm publish --dry-run --workspace=ai.matey.core
```

### Inspect what will be published

```bash
npm pack --workspace=ai.matey.core
# Creates a tarball you can extract and inspect
tar -tzf ai.matey.core-1.0.0.tgz
```

### Authentication issues

```bash
# Check current user
npm whoami

# Re-login if needed
npm logout
npm login
```

### Build failures

```bash
# Clean and rebuild
npm run clean
npm run build

# Check specific package
npm run build --workspace=ai.matey.core
```

### Version conflicts

If changesets shows unexpected versions:
```bash
# Reset changeset state
rm .changeset/*.md  # Keep config.json and README.md

# Start fresh
npm run changeset
```

## CI/CD Integration

For automated publishing in CI:

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - run: npm ci
      - run: npm run build

      - name: Create Release PR or Publish
        uses: changesets/action@v1
        with:
          publish: npm run release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Package List

The monorepo contains 21 packages organized by category:

| Category | Packages |
|----------|----------|
| Core | `ai.matey`, `ai.matey.core`, `ai.matey.types`, `ai.matey.errors`, `ai.matey.utils`, `ai.matey.testing` |
| Backends | `ai.matey.backend` (server-side providers), `ai.matey.backend.browser` (browser-native) |
| Frontend | `ai.matey.frontend` (all provider adapters) |
| Middleware | `ai.matey.middleware` (retry, caching, logging, telemetry, etc.) |
| HTTP | `ai.matey.http-core`, `ai.matey.http` (Express, Fastify, Hono, Koa, Node, Deno) |
| React | `ai.matey.react.core`, `ai.matey.react.hooks`, `ai.matey.react.nextjs`, `ai.matey.react.stream` |
| Wrappers | `ai.matey.wrapper` (OpenAI SDK, Anthropic SDK, Chrome AI, Chat) |
| Native | `ai.matey.native.apple`, `ai.matey.native.model-runner`, `ai.matey.native.node-llamacpp` |
| CLI | `ai.matey.cli` |

## Adding New Packages

To add a new package to the monorepo:

### 1. Create Package Directory

```bash
mkdir -p packages/my-new-package/src
```

### 2. Create package.json

```bash
cat > packages/my-new-package/package.json << 'EOF'
{
  "name": "ai.matey.my-new-package",
  "version": "1.0.0",
  "description": "Description of your package",
  "type": "module",
  "main": "./dist/cjs/index.js",
  "module": "./dist/esm/index.js",
  "types": "./dist/types/index.d.ts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/types/index.d.ts",
        "default": "./dist/esm/index.js"
      },
      "require": {
        "types": "./dist/types/index.d.ts",
        "default": "./dist/cjs/index.js"
      }
    }
  },
  "files": [
    "dist",
    "readme.md",
    "CHANGELOG.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "npm run build:esm && npm run build:cjs && npm run build:types",
    "build:esm": "tsc -p tsconfig.esm.json",
    "build:cjs": "tsc -p tsconfig.cjs.json",
    "build:types": "tsc -p tsconfig.types.json",
    "clean": "rm -rf dist",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix"
  },
  "dependencies": {
    "ai.matey.types": "*"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "vitest": "^3.2.4"
  },
  "keywords": ["ai", "llm", "ai-matey"],
  "author": "AI Matey",
  "license": "MIT",
  "homepage": "https://github.com/johnhenry/ai.matey#readme",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/johnhenry/ai.matey.git",
    "directory": "packages/my-new-package"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF
```

### 3. Create TypeScript Configs

```bash
# tsconfig.json (base)
cat > packages/my-new-package/tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noEmit": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
EOF

# tsconfig.esm.json
cat > packages/my-new-package/tsconfig.esm.json << 'EOF'
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "ESNext",
    "outDir": "./dist/esm",
    "noEmit": false,
    "declaration": false
  }
}
EOF

# tsconfig.cjs.json
cat > packages/my-new-package/tsconfig.cjs.json << 'EOF'
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "CommonJS",
    "outDir": "./dist/cjs",
    "noEmit": false,
    "declaration": false
  }
}
EOF

# tsconfig.types.json
cat > packages/my-new-package/tsconfig.types.json << 'EOF'
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist/types",
    "emitDeclarationOnly": true,
    "noEmit": false
  }
}
EOF
```

### 4. Create Source File

```bash
cat > packages/my-new-package/src/index.ts << 'EOF'
/**
 * My New Package
 *
 * @module
 */

export function hello(): string {
  return 'Hello from my new package!';
}
EOF
```

### 5. Create readme.md

```bash
cat > packages/my-new-package/readme.md << 'EOF'
# ai.matey.my-new-package

Description of your package.

## Installation

```bash
npm install ai.matey.my-new-package
```

## Usage

```typescript
import { hello } from 'ai.matey.my-new-package';

console.log(hello());
```
EOF
```

### 6. Install Dependencies and Build

```bash
# Install workspace dependencies (links the new package)
npm install

# Build to verify everything works
npm run build --workspace=ai.matey.my-new-package
```

### 7. Add to Version Control

```bash
git add packages/my-new-package
git commit -m "Add ai.matey.my-new-package"
```

### Package Naming Conventions

| Type | Naming Pattern | Example |
|------|----------------|---------|
| Backend adapter | `ai.matey.backend.<provider>` | `ai.matey.backend/openai` |
| Frontend adapter | `ai.matey.frontend.<provider>` | `ai.matey.frontend/openai` |
| Middleware | `ai.matey.middleware.<name>` | `ai.matey.middleware` |
| HTTP framework | `ai.matey.http.<framework>` | `ai.matey.http/express` |
| React package | `ai.matey.react.<name>` | `ai.matey.react.hooks` |
| Wrapper | `ai.matey.wrapper.<sdk>` | `ai.matey.wrapper/openai` |
| Native | `ai.matey.native.<name>` | `ai.matey.native.model-runner` |
| Core/Utility | `ai.matey.<name>` | `ai.matey.utils` |

### Internal Dependencies

To depend on other monorepo packages, use `"*"` as the version:

```json
{
  "dependencies": {
    "ai.matey.types": "*",
    "ai.matey.errors": "*"
  }
}
```

Changesets will automatically update these to real versions during publishing.

## Best Practices

1. **Always create changesets for user-facing changes** - Even small fixes deserve changelog entries

2. **Use semantic versioning correctly**:
   - `patch` - Bug fixes, internal changes
   - `minor` - New features, non-breaking additions
   - `major` - Breaking changes

3. **Write clear changeset summaries** - These become CHANGELOG entries

4. **Test before publishing**:
   ```bash
   npm run build
   npm test
   npm run lint
   ```

5. **Review version changes** - Check `git diff` after `version-packages` before committing

6. **Use lowercase `readme.md`** - For cross-platform consistency
