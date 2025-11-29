#!/bin/bash
# Script to extract a native backend into its own package

ADAPTER=$1

if [ -z "$ADAPTER" ]; then
    echo "Usage: $0 <adapter-name>"
    exit 1
fi

# Skip index.ts
if [ "$ADAPTER" = "index" ]; then
    echo "Skipping index file"
    exit 0
fi

# Skip model-runner-base.ts
if [ "$ADAPTER" = "model-runner-base" ]; then
    echo "Skipping model-runner-base file (handled separately)"
    exit 0
fi

PACKAGE_DIR="packages/native-$ADAPTER"
PACKAGE_NAME="ai.matey.native.$ADAPTER"

echo "Creating package: $PACKAGE_NAME"

# Create directory
mkdir -p "$PACKAGE_DIR/src"

# Copy adapter file
cp "src/adapters/backend-native/$ADAPTER.ts" "$PACKAGE_DIR/src/index.ts"

# Update imports in the copied file
sed -i -E "s|from '\\.\\./\\.\\./types/[^']+\\.js'|from 'ai.matey.types'|g" "$PACKAGE_DIR/src/index.ts"
sed -i -E "s|from '\\.\\./\\.\\./\\.\\./types/[^']+\\.js'|from 'ai.matey.types'|g" "$PACKAGE_DIR/src/index.ts"
sed -i -E "s|from '\\.\\./\\.\\./errors/[^']+\\.js'|from 'ai.matey.errors'|g" "$PACKAGE_DIR/src/index.ts"
sed -i -E "s|from '\\.\\./\\.\\./\\.\\./errors/[^']+\\.js'|from 'ai.matey.errors'|g" "$PACKAGE_DIR/src/index.ts"
sed -i -E "s|from '\\.\\./\\.\\./utils/[^']+\\.js'|from 'ai.matey.utils'|g" "$PACKAGE_DIR/src/index.ts"
sed -i -E "s|from '\\.\\./\\.\\./\\.\\./utils/[^']+\\.js'|from 'ai.matey.utils'|g" "$PACKAGE_DIR/src/index.ts"
sed -i -E "s|from '\\.\\./\\.\\./core/[^']+\\.js'|from 'ai.matey.core'|g" "$PACKAGE_DIR/src/index.ts"
sed -i -E "s|from '\\.\\./\\.\\./\\.\\./core/[^']+\\.js'|from 'ai.matey.core'|g" "$PACKAGE_DIR/src/index.ts"

# Create package.json
cat > "$PACKAGE_DIR/package.json" << EOF
{
  "name": "$PACKAGE_NAME",
  "version": "1.0.0",
  "description": "${ADAPTER} native backend for AI Matey",
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
  "files": ["dist", "README.md", "CHANGELOG.md", "LICENSE"],
  "scripts": {
    "build": "npm run build:esm && npm run build:cjs && npm run build:types",
    "build:esm": "tsc -p tsconfig.esm.json",
    "build:cjs": "tsc -p tsconfig.cjs.json",
    "build:types": "tsc -p tsconfig.types.json",
    "clean": "rm -rf dist",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "ai.matey.types": "*",
    "ai.matey.errors": "*",
    "ai.matey.utils": "*"
  },
  "devDependencies": {
    "ai.matey.testing": "*",
    "typescript": "^5.9.3",
    "vitest": "^3.2.4"
  },
  "keywords": ["ai", "llm", "$ADAPTER", "native", "backend", "ai-matey"],
  "author": "AI Matey",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/johnhenry/ai.matey.git",
    "directory": "$PACKAGE_DIR"
  },
  "engines": { "node": ">=18.0.0" }
}
EOF

# Create tsconfig.json
cat > "$PACKAGE_DIR/tsconfig.json" << 'EOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
EOF

# Create tsconfig.esm.json
cat > "$PACKAGE_DIR/tsconfig.esm.json" << 'EOF'
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "ESNext",
    "outDir": "./dist/esm",
    "declaration": false,
    "declarationMap": false
  }
}
EOF

# Create tsconfig.cjs.json
cat > "$PACKAGE_DIR/tsconfig.cjs.json" << 'EOF'
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "./dist/cjs",
    "declaration": false,
    "declarationMap": false
  }
}
EOF

# Create tsconfig.types.json
cat > "$PACKAGE_DIR/tsconfig.types.json" << 'EOF'
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "ESNext",
    "outDir": "./dist/types",
    "declaration": true,
    "declarationMap": true,
    "emitDeclarationOnly": true
  }
}
EOF

echo "Created package: $PACKAGE_NAME"
