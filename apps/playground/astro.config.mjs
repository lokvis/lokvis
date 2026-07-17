// W14.7: Playground 迁移到独立子域名 playground.lokvis.dev（根路径部署）。
// 此前为 lokvis.com/playground 子路径（site: lokvis.com, base: /playground），
// 现改为根域部署：site: https://playground.lokvis.dev, base: '/'。
// 部署目标 Cloudflare Pages 项目 `lokvis-playground`，见 DEPLOY.md。
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

// https://astro.build/config
export default defineConfig({
  site: 'https://playground.lokvis.dev',
  base: '/',
  server: { port: 5601 },

  // i18n:中英双语,路径前缀 /en/ /zh/,英文为默认语言
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh'],
    routing: {
      prefixDefaultLocale: true,
    },
  },

  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    },
    optimizeDeps: {
      exclude: ['@lokvis/runtime', '@lokvis/sdk'],
    },
    build: {
      // W21.3: 代码分割 — 把 vendor 分组,避免单个 chunk 过大
      // CodeMirror 已通过 React.lazy 懒加载(CodeEditor 组件),自然分到独立 chunk
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/@codemirror/')) return 'codemirror';
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) return 'react-vendor';
          },
        },
      },
    },
  },
});
