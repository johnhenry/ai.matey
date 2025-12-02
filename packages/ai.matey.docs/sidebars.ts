import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docs: [
    {
      type: 'doc',
      id: 'index',
      label: 'Introduction',
    },
    {
      type: 'category',
      label: 'Getting Started',
      collapsible: false,
      items: [
        'getting-started/installation',
        'getting-started/quick-start',
        'getting-started/core-concepts',
        'getting-started/your-first-bridge',
      ],
    },
    {
      type: 'category',
      label: 'Tutorials',
      collapsed: false,
      link: {
        type: 'doc',
        id: 'tutorials/index',
      },
      items: [
        {
          type: 'category',
          label: 'Beginner',
          items: [
            'tutorials/beginner/simple-bridge',
            'tutorials/beginner/using-middleware',
            'tutorials/beginner/multi-provider',
            'tutorials/beginner/building-chat-api',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      collapsed: false,
      items: [
        {
          type: 'category',
          label: 'Architecture',
          items: [
            'guides/architecture/ir-format',
          ],
        },
        {
          type: 'category',
          label: 'Testing',
          link: {
            type: 'doc',
            id: 'guides/testing/index',
          },
          items: [],
        },
      ],
    },
    {
      type: 'category',
      label: 'Integration Patterns',
      link: {
        type: 'doc',
        id: 'patterns/index',
      },
      items: [],
    },
    {
      type: 'category',
      label: 'API Reference',
      collapsed: false,
      link: {
        type: 'doc',
        id: 'api/index',
      },
      items: [
        'api/bridge',
        'api/router',
        'api/middleware',
        'api/types',
        'api/errors',
      ],
    },
    {
      type: 'category',
      label: 'Packages',
      link: {
        type: 'doc',
        id: 'packages/overview',
      },
      items: [
        'packages/core',
        'packages/frontend',
        'packages/backend',
        'packages/middleware',
      ],
    },
    {
      type: 'category',
      label: 'Contributing',
      collapsed: true,
      link: {
        type: 'doc',
        id: 'contributing/index',
      },
      items: [
        'contributing/development',
        'contributing/architecture',
      ],
    },
  ],
  examples: [
    {
      type: 'doc',
      id: 'examples/index',
      label: 'Examples Overview',
    },
  ],
};

export default sidebars;
