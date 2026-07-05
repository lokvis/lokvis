import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightTypeDoc from 'starlight-typedoc';

// https://astro.build/config
export default defineConfig({
  site: 'https://lokvis.com',
  base: '/docs',

  integrations: [
    starlight({
      title: 'Lokvis',
      description: 'Local-first Browser Workspace - Documentation',

      // 多语言:i18n 基础设施
      // 当前 root locale 为 English,后续添加中文时:
      // 1. 创建 src/content/docs/zh-cn/ 目录并放入翻译
      // 2. 在下方 locales 添加 'zh-cn': { label: '简体中文', lang: 'zh-CN' }
      locales: {
        root: { label: 'English', lang: 'en' },
      },

      // 侧边栏导航(手动配置以控制顺序)
      // API Reference 组由 starlight-typedoc 自动注入,放在末尾
      sidebar: [
        { label: 'Overview', slug: 'index' },
        { label: 'Getting Started', slug: 'getting-started' },
        { label: 'Architecture', slug: 'architecture' },
        { label: 'Capabilities', slug: 'capabilities' },
        { label: 'Plugins', slug: 'plugins' },
        { label: 'MCP Integration', slug: 'mcp' },
        { label: 'Workflows', slug: 'workflows' },
        {
          label: 'Guides',
          collapsed: false,
          items: [
            { label: 'Embed the SDK', slug: 'guides/embed-sdk' },
            { label: 'Write Your First Plugin', slug: 'guides/write-first-plugin' },
            { label: 'Build a Custom Workspace', slug: 'guides/custom-workspace' },
            { label: 'CLI Automation', slug: 'guides/cli-automation' },
          ],
        },
        { label: 'SDK', slug: 'sdk' },
        { label: 'CLI', slug: 'cli' },
        { label: 'Roadmap', slug: 'roadmap' },
      ],

      // 全局搜索(Pagefind 客户端搜索,构建时索引,无需服务端)
      // Starlight 0.33+ 默认启用搜索,无需显式配置

      // GitHub 编辑链接
      editLink: {
        baseUrl: 'https://github.com/lokvis/lokvis/edit/main/apps/docs/src/content/docs',
      },

      // 社交链接(Starlight 0.33+ 使用数组语法)
      social: [
        { label: 'GitHub', href: 'https://github.com/lokvis/lokvis', icon: 'github' },
      ],

      // 目录(TOC)配置
      tableOfContents: {
        minHeadingLevel: 2,
        maxHeadingLevel: 3,
      },

      // 自定义 CSS(品牌色微调)
      customCss: ['./src/styles/custom.css'],

      // Starlight 插件:TypeDoc 自动生成 API Reference
      // 入口点/过滤/排序配置在 ./typedoc.json
      plugins: [
        starlightTypeDoc({
          sidebar: {
            collapsed: true,
            label: 'API Reference',
          },
        }),
      ],
    }),
  ],

  build: {
    inlineStylesheets: 'auto',
  },
});
