import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import { themes as prismThemes } from 'prism-react-renderer';

const config: Config = {
  title: 'ai.matey',
  tagline: 'Universal AI Adapter System - Write once, run anywhere',
  favicon: 'img/favicon.ico',

  url: 'https://ai-matey.dev',
  baseUrl: '/',

  organizationName: 'johnhenry',
  projectName: 'ai.matey',

  onBrokenLinks: 'warn',

  markdown: {
    format: 'mdx',
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/johnhenry/ai.matey/tree/main/packages/ai.matey.docs/',
          routeBasePath: '/',
          remarkPlugins: [],
          rehypePlugins: [],
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/og-image.png',
    navbar: {
      title: 'ai.matey',
      logo: {
        alt: 'ai.matey Logo',
        src: 'img/logo.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docs',
          position: 'left',
          label: 'Docs',
        },
        {
          type: 'docSidebar',
          sidebarId: 'examples',
          position: 'left',
          label: 'Examples',
        },
        {
          to: '/api',
          label: 'API',
          position: 'left',
        },
        {
          href: 'https://github.com/johnhenry/ai.matey',
          label: 'GitHub',
          position: 'right',
        },
        {
          href: 'https://www.npmjs.com/package/ai.matey',
          label: 'npm',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Getting Started', to: '/getting-started/installation' },
            { label: 'Tutorials', to: '/tutorials' },
            { label: 'API Reference', to: '/api' },
          ],
        },
        {
          title: 'Examples',
          items: [
            { label: 'Browse Examples', to: '/examples' },
            { label: 'View on GitHub', href: 'https://github.com/johnhenry/ai.matey/tree/main/packages/ai.matey.docs/examples' },
          ],
        },
        {
          title: 'Community',
          items: [
            { label: 'GitHub', href: 'https://github.com/johnhenry/ai.matey' },
            { label: 'Issues', href: 'https://github.com/johnhenry/ai.matey/issues' },
            { label: 'npm', href: 'https://www.npmjs.com/package/ai.matey' },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} AI Matey. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['typescript', 'bash', 'json', 'javascript'],
    },
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
