import { defineConfig } from 'vitepress';

export default defineConfig({
  // Adjust base for GitHub Pages project site. When deploying under
  // https://<user>.github.io/<repo>/ the base must be '/<repo>/'. The workflow
  // sets VITEPRESS_BASE automatically; local dev stays '/'.
  base: process.env.VITEPRESS_BASE || '/',
  title: 'create-polyglot',
  // Updated to reflect newly supported frontend frameworks (Remix, Astro, SvelteKit)
  description: 'Scaffold polyglot microservice monorepos (Node, Python, Go, Java, Next.js, Remix, Astro, SvelteKit)',
  head: [
    ['meta', { name: 'theme-color', content: '#3e62ad' }],
    ['meta', { name: 'og:title', content: 'create-polyglot' }],
    ['meta', { name: 'og:description', content: 'Polyglot monorepo scaffolder CLI' }]
  ],
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/' },
      { text: 'CLI', link: '/cli/' },
      { text: 'Templates', link: '/templates/' },
      { text: 'Configuration', link: '/configuration/polyglot-json' },
      { text: 'Features', link: '/logs-feature' }
    ],
    sidebar: {
      '/guide/': [
        { text: 'Introduction', link: '/guide/' },
        { text: 'Getting Started', link: '/guide/getting-started' },
        { text: 'Presets', link: '/guide/presets' },
        { text: 'Docker & Compose', link: '/guide/docker' },
  { text: 'Extending (New Service)', link: '/guide/extending-service' },
  { text: 'Frontend Frameworks', link: '/guide/frontend-frameworks' },
        { text: 'Service Logs', link: '/logs-feature' },
        { text: 'Plugin System', link: '/plugin-system' },
        { text: 'Service Controls', link: '/service-controls-feature' },
        { text: 'Automated Release Notes', link: '/automated-release-notes' }
      ],
      '/cli/': [
        { text: 'Usage', link: '/cli/' },
        { text: 'Admin Dashboard', link: '/cli/admin' },
        { text: 'Flags', link: '/cli/flags' }
      ],
      '/configuration/': [
        { text: 'polyglot.json', link: '/configuration/polyglot-json' }
      ],
      '/templates/': [
        { text: 'Overview', link: '/templates/' },
        { text: 'Node', link: '/templates/node' },
        { text: 'Python', link: '/templates/python' },
        { text: 'Go', link: '/templates/go' },
        { text: 'Java (Spring Boot)', link: '/templates/java' },
        { text: 'Frontend (Next.js)', link: '/templates/frontend' },
        { text: 'Frontend Frameworks (Remix/Astro/SvelteKit)', link: '/guide/frontend-frameworks' }
      ]
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/kaifcoder/create-polyglot' }
    ],
    footer: {
      message: 'MIT Licensed',
      copyright: `© ${new Date().getFullYear()} create-polyglot`
    }
  }
});
