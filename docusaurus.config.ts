import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Genesis Studio Docs',
  tagline: 'Internal documentation for Genesis Studio',
  favicon: 'favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://pr0y.github.io',
  baseUrl: '/genesis-docs/',
  organizationName: 'pr0y',
  projectName: 'genesis-docs',
  deploymentBranch: 'gh-pages',

  onBrokenLinks: 'throw',

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'throw',
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
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/pr0y/genesis-docs/tree/main/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/genesis-logo-dark.svg',
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: false,
      respectPrefersColorScheme: false,
    },
    navbar: {
      title: 'Genesis Studio Docs',
      logo: {
        alt: 'Genesis Studio logo',
        src: 'img/genesis-logo-light.svg',
        srcDark: 'img/genesis-logo-dark.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Documentation',
        },
        {
          href: 'https://genesistudio.com',
          label: 'Site',
          position: 'right',
        },
        {
          href: 'https://github.com/pr0y/genesis-docs',
          label: 'GitHub',
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
            {
              label: 'Overview',
              to: '/',
            },
            {
              label: 'Architecture',
              to: '/01-Architecture-Overview',
            },
            {
              label: 'UI Docs',
              to: '/09-UI-Homepage',
            },
          ],
        },
        {
          title: 'Genesis Studio',
          items: [
            {
              label: 'Main Site',
              href: 'https://genesistudio.com',
            },
            {
              label: 'Internal Docs Repo',
              href: 'https://github.com/pr0y/genesis-docs',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Genesis Studio. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.oneDark,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
