import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightTypeDoc from 'starlight-typedoc';

// https://astro.build/config
// 部署到独立子域名 docs.lokvis.dev(Cloudflare Pages 项目 lokvis-docs)。
// 此前为 lokvis.com/docs 子路径(site: lokvis.com, base: /docs),
// 现改为根域部署:site: https://docs.lokvis.dev, base: '/'。
// 详见 apps/docs/DEPLOY.md。
export default defineConfig({
  site: 'https://docs.lokvis.dev',
  base: '/',

  integrations: [
    starlight({
      title: 'Lokvis',
      description: 'Local-first Browser Workspace - Documentation',

      // 多语言:i18n — root (English) + zh-cn (简体中文)
      // root locale 内容在 src/content/docs/,无路径前缀
      // zh-cn locale 内容在 src/content/docs/zh-cn/,路径前缀 /zh-cn/
      locales: {
        root: {
          label: 'English',
          lang: 'en',
          // 英文侧边栏导航(手动配置以控制顺序)
          // W19.2 六段式结构:Getting Started / Concepts / Guides / Plugins / Examples / Reference
          sidebar: [
            { label: 'Overview', slug: 'index' },
            { label: 'Getting Started', slug: 'getting-started' },
            {
              label: 'Architecture',
              collapsed: true,
              items: [
                { label: 'Overview', slug: 'architecture' },
                { label: 'Runtime', slug: 'architecture/runtime' },
                { label: 'Engine', slug: 'architecture/engine' },
                { label: 'Capability', slug: 'architecture/capability' },
                { label: 'Plugin SDK', slug: 'architecture/plugin' },
              ],
            },
            {
              label: 'Concepts',
              collapsed: true,
              items: [
                { label: 'Capabilities', slug: 'capabilities' },
                { label: 'Workflows', slug: 'workflows' },
                { label: 'MCP Integration', slug: 'mcp' },
              ],
            },
            {
              label: 'Guides',
              collapsed: true,
              items: [
                { label: 'Embed the SDK', slug: 'guides/embed-sdk' },
                { label: 'Quick Actions Integration', slug: 'guides/quick-actions' },
                { label: 'Quick Actions Theming', slug: 'guides/quick-actions-theme' },
                { label: 'Custom Image Engine', slug: 'guides/custom-engine' },
                { label: 'Write Your First Plugin', slug: 'guides/write-first-plugin' },
              ],
            },
            { label: 'Plugins', slug: 'plugins' },
            {
              label: 'Examples',
              collapsed: true,
              items: [
                { label: 'Custom Workspace', slug: 'guides/custom-workspace' },
                { label: 'CLI Automation', slug: 'guides/cli-automation' },
              ],
            },
            {
              label: 'Reference',
              collapsed: true,
              items: [
                { label: 'SDK', slug: 'sdk' },
                { label: 'CLI', slug: 'cli' },
                { label: 'Roadmap', slug: 'roadmap' },
              ],
            },
          ],
        },
        'zh-cn': {
          label: '简体中文',
          lang: 'zh-CN',
          // 中文 UI 字符串覆盖
          labels: {
            'search.label': '搜索文档',
            'search.shortcut.hint': '按 Ctrl / ⌘ + K 搜索',
            'siteTitle.label': 'Lokvis 文档',
            'page.editLink': '编辑此页',
            'page.lastUpdated': '最后更新:',
            'page.navLink.previous': '上一页',
            'page.navLink.next': '下一页',
            'page.draft': '草稿',
            'page.tableOfContents.onThisPage': '本页内容',
            'page.tableOfContents.overview': '概览',
            'languageSwitcher': '语言',
            '404.title': '页面未找到',
            '404.content': '该页面不存在或已被移动。',
          },
          // 中文侧边栏导航(与英文结构一致,标签为中文)
          // W19.2 六段式结构:快速开始 / 概念 / 指南 / 插件 / 示例 / 参考
          sidebar: [
            { label: '概览', slug: 'index' },
            { label: '快速开始', slug: 'getting-started' },
            {
              label: '架构',
              collapsed: true,
              items: [
                { label: '架构概览', slug: 'architecture' },
                { label: 'Runtime 运行时', slug: 'architecture/runtime' },
                { label: 'Engine 引擎', slug: 'architecture/engine' },
                { label: 'Capability 能力', slug: 'architecture/capability' },
                { label: 'Plugin SDK 插件', slug: 'architecture/plugin' },
              ],
            },
            {
              label: '概念',
              collapsed: true,
              items: [
                { label: '能力目录', slug: 'capabilities' },
                { label: '工作流', slug: 'workflows' },
                { label: 'MCP 集成', slug: 'mcp' },
              ],
            },
            {
              label: '指南',
              collapsed: true,
              items: [
                { label: '嵌入 SDK', slug: 'guides/embed-sdk' },
                { label: 'Quick Actions 接入指南', slug: 'guides/quick-actions' },
                { label: 'Quick Actions 主题定制', slug: 'guides/quick-actions-theme' },
                { label: '自定义图像引擎', slug: 'guides/custom-engine' },
                { label: '编写第一个插件', slug: 'guides/write-first-plugin' },
              ],
            },
            { label: '插件', slug: 'plugins' },
            {
              label: '示例',
              collapsed: true,
              items: [
                { label: '自定义工作台', slug: 'guides/custom-workspace' },
                { label: 'CLI 自动化', slug: 'guides/cli-automation' },
              ],
            },
            {
              label: '参考',
              collapsed: true,
              items: [
                { label: 'SDK', slug: 'sdk' },
                { label: 'CLI', slug: 'cli' },
                { label: '路线图', slug: 'roadmap' },
              ],
            },
          ],
        },
      },

      // Starlight 插件(W13.2: TypeDoc 自动生成 API Reference)
      plugins: [
        starlightTypeDoc({
          sidebar: { collapsed: true, label: 'API Reference' },
        }),
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
    }),
  ],

  build: {
    inlineStylesheets: 'auto',
  },
});
