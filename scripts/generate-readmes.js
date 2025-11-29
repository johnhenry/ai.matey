#!/usr/bin/env node

/**
 * Generate README.md files for all packages that don't have one.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packagesDir = path.join(__dirname, '..', 'packages');

// Package categories and their descriptions
const categories = {
  'ai.matey': { type: 'umbrella', desc: 'Main umbrella package for ai.matey' },
  'ai.matey.core': { type: 'core', desc: 'Core Bridge and Router implementations' },
  'ai.matey.types': { type: 'core', desc: 'TypeScript type definitions' },
  'ai.matey.errors': { type: 'core', desc: 'Error classes and utilities' },
  'ai.matey.utils': { type: 'core', desc: 'Shared utility functions' },
  'ai.matey.testing': { type: 'core', desc: 'Testing utilities and mocks' },
  'backend-': { type: 'backend', desc: 'Backend adapter for' },
  'frontend-': { type: 'frontend', desc: 'Frontend adapter for' },
  'middleware-': { type: 'middleware', desc: 'Middleware for' },
  'http-': { type: 'http', desc: 'HTTP integration for' },
  'wrapper-': { type: 'wrapper', desc: 'SDK wrapper for' },
  'react-': { type: 'react', desc: 'React integration for' },
  'native-': { type: 'native', desc: 'Native integration for' },
  'cli': { type: 'cli', desc: 'Command-line interface' },
};

function getPackageInfo(pkgName) {
  for (const [prefix, info] of Object.entries(categories)) {
    if (pkgName === prefix || pkgName.startsWith(prefix)) {
      const suffix = pkgName.replace(prefix, '').replace(/-/g, ' ').trim();
      return {
        type: info.type,
        desc: suffix ? `${info.desc} ${suffix}` : info.desc,
        suffix,
      };
    }
  }
  return { type: 'unknown', desc: pkgName, suffix: '' };
}

function generateReadme(pkgDir, pkgJson) {
  const pkgName = pkgJson.name;
  const dirName = path.basename(pkgDir);
  const info = getPackageInfo(dirName);

  const providerName = info.suffix
    ? info.suffix.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : '';

  let content = `# ${pkgName}

${pkgJson.description || info.desc}

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

\`\`\`bash
npm install ${pkgName}
\`\`\`

`;

  // Add type-specific content
  switch (info.type) {
    case 'umbrella':
      content += `## Usage

This is the main umbrella package. **Note:** This package only exports the VERSION constant.
For functionality, import from specific packages:

\`\`\`typescript
// Import from specific packages
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend/anthropic';
\`\`\`

## Available Packages

See the [main documentation](https://github.com/johnhenry/ai.matey) for a full list of available packages.
`;
      break;

    case 'core':
      content += `## Usage

\`\`\`typescript
import { /* exports */ } from '${pkgName}';
\`\`\`

See the [API documentation](https://github.com/johnhenry/ai.matey/tree/main/docs) for detailed usage.
`;
      break;

    case 'backend':
      content += `## Usage

\`\`\`typescript
import { ${providerName.replace(/[^a-zA-Z]/g, '')}BackendAdapter } from '${pkgName}';
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';

const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new ${providerName.replace(/[^a-zA-Z]/g, '')}BackendAdapter({
    apiKey: process.env.API_KEY,
  })
);

const response = await bridge.chat({
  model: 'model-name',
  messages: [{ role: 'user', content: 'Hello!' }],
});
\`\`\`

## Configuration

| Option | Type | Description |
|--------|------|-------------|
| \`apiKey\` | string | API key for authentication |
| \`baseUrl\` | string | Optional custom base URL |

## Supported Models

See the provider's documentation for available models.
`;
      break;

    case 'frontend':
      content += `## Usage

\`\`\`typescript
import { ${providerName.replace(/[^a-zA-Z]/g, '')}FrontendAdapter } from '${pkgName}';
import { Bridge } from 'ai.matey.core';

// Create a bridge that accepts ${providerName} format requests
const bridge = new Bridge(
  new ${providerName.replace(/[^a-zA-Z]/g, '')}FrontendAdapter(),
  yourBackendAdapter
);
\`\`\`
`;
      break;

    case 'middleware':
      content += `## Usage

\`\`\`typescript
import { create${providerName.replace(/[^a-zA-Z]/g, '')}Middleware } from '${pkgName}';
import { Bridge } from 'ai.matey.core';

const bridge = new Bridge(frontend, backend);

// Add middleware
bridge.use(create${providerName.replace(/[^a-zA-Z]/g, '')}Middleware({
  // options
}));
\`\`\`
`;
      break;

    case 'http':
      content += `## Usage

\`\`\`typescript
import { create${providerName.replace(/[^a-zA-Z]/g, '')}Handler } from '${pkgName}';
import { Bridge } from 'ai.matey.core';

const bridge = new Bridge(frontend, backend);
const handler = create${providerName.replace(/[^a-zA-Z]/g, '')}Handler(bridge);

// Use with your ${providerName} server
\`\`\`
`;
      break;

    case 'react':
      content += `## Usage

\`\`\`typescript
import { /* hooks or components */ } from '${pkgName}';
\`\`\`

See the [React integration guide](https://github.com/johnhenry/ai.matey/tree/main/docs) for detailed usage.
`;
      break;

    case 'wrapper':
      content += `## Usage

\`\`\`typescript
import { createCompatibleClient } from '${pkgName}';

// Create a drop-in replacement for the official SDK
const client = createCompatibleClient({
  backend: yourBackendAdapter,
});

// Use the same API as the official SDK
\`\`\`
`;
      break;

    case 'cli':
      content += `## Usage

\`\`\`bash
npx ai-matey --help
\`\`\`

## Commands

See \`ai-matey --help\` for available commands.
`;
      break;

    default:
      content += `## Usage

See the [documentation](https://github.com/johnhenry/ai.matey/tree/main/docs) for usage examples.
`;
  }

  // Add common footer
  content += `
## License

MIT - see [LICENSE](./LICENSE) for details.

## Contributing

See the [contributing guide](https://github.com/johnhenry/ai.matey/blob/main/CONTRIBUTING.md) in the main repository.
`;

  return content;
}

// Main
async function main() {
  const packages = fs.readdirSync(packagesDir).filter(f =>
    fs.statSync(path.join(packagesDir, f)).isDirectory()
  );

  let created = 0;
  let skipped = 0;

  for (const pkg of packages) {
    const pkgDir = path.join(packagesDir, pkg);
    const readmePath = path.join(pkgDir, 'README.md');
    const pkgJsonPath = path.join(pkgDir, 'package.json');

    if (!fs.existsSync(pkgJsonPath)) {
      console.log(`Skipping ${pkg}: no package.json`);
      skipped++;
      continue;
    }

    // Always regenerate READMEs for consistency
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    const readme = generateReadme(pkgDir, pkgJson);
    fs.writeFileSync(readmePath, readme);
    created++;
    console.log(`Created: ${pkg}/README.md`);
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped`);
}

main().catch(console.error);
