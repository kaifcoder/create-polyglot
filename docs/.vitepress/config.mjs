import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'create-polyglot',
  description: 'Scaffold polyglot microservice monorepos (Node, Python, Go, Java, Next.js)',
  head: [
    ['meta', { name: 'theme-color', content: '#3e62ad' }],
    ['meta', { name: 'og:title', content: 'create-polyglot' }],
    ['meta', { name: 'og:description', content: 'Polyglot monorepo scaffolder CLI' }]
  ],
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/' },
      { text: 'CLI', link: '/cli/' },
      { text: 'Templates', link: '/templates/' }
    ],
    sidebar: {
      '/guide/': [
        { text: 'Introduction', link: '/guide/' },
        { text: 'Getting Started', link: '/guide/getting-started' },
        { text: 'Presets', link: '/guide/presets' },
        { text: 'Docker & Compose', link: '/guide/docker' },
        { text: 'Extending (New Service)', link: '/guide/extending-service' }
      ],
      '/cli/': [
        { text: 'Usage', link: '/cli/' },
        { text: 'Flags', link: '/cli/flags' }
      ],
      '/templates/': [
        { text: 'Overview', link: '/templates/' },
        { text: 'Node', link: '/templates/node' },
        { text: 'Python', link: '/templates/python' },
        { text: 'Go', link: '/templates/go' },
        { text: 'Java (Spring Boot)', link: '/templates/java' },
        { text: 'Frontend (Next.js)', link: '/templates/frontend' }
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
