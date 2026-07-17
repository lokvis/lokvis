// W14.7: Playground 迁移到独立子域名 playground.lokvis.dev（根路径部署）。
// 此前为 lokvis.com/playground 子路径（site: lokvis.com, base: /playground），
// 现改为根域部署：site: https://playground.lokvis.dev, base: '/'。
// 部署目标 Cloudflare Pages 项目 `lokvis-playground`，见 DEPLOY.md。
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { visualizer } from 'rollup-plugin-visualizer';

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
    plugins: [
      tailwindcss(),
      // W21.3: Bundle 可视化分析 —— pnpm --filter @lokvis/playground build 后
      // 生成 dist/stats.html,直观查看各 chunk 构成与体积占比。
      // 仅在显式 ANALYZE=1 时启用,避免 CI 每次构建都产出报告。
      ...(process.env.ANALYZE === '1'
        ? [
            visualizer({
              filename: 'dist/stats.html',
              template: 'treemap',
              gzipSize: true,
              brotliSize: true,
              open: false,
            }),
          ]
        : []),
    ],
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
      // W21.3: 现代浏览器目标 —— 减少转译产物体积(es2022 支持 top-level await /
      // class fields / private methods / error cause 等,所有 2023+ 浏览器支持)。
      target: 'es2022',
      // W21.3: CodeMirror chunk 335KB 已超 Vite 默认 500KB 警告线(实测 500KB
      // 是 chunk 数量提示阈值,这里调高到 1000KB 避免构建噪音)。
      chunkSizeWarningLimit: 1000,
      // W21.3: 代码分割 —— 把 vendor 分组,避免单个 chunk 过大
      // CodeMirror 已通过 React.lazy 懒加载(CodeEditor 组件),自然分到独立 chunk
      rollupOptions: {
        output: {
          manualChunks(id) {
            // CodeMirror 7 个包统一分到 codemirror chunk(仅 / CodeEditor 页懒加载)
            if (id.includes('node_modules/@codemirror/')) return 'codemirror';
            // React 19 核心 + react-dom(首屏必需,独立 chunk 便于浏览器缓存)
            if (
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/scheduler/')
            ) {
              return 'react-vendor';
            }
            // Sentry SDK ~80KB,通过 dynamic import 懒加载但打包时仍需独立 chunk
            if (id.includes('node_modules/@sentry/')) return 'sentry';
            // zod / mitt / zustand / exifr 等小型 vendor 合并到 vendor chunk
            if (id.includes('node_modules/zod/')) return 'vendor';
            if (id.includes('node_modules/mitt/')) return 'vendor';
            if (id.includes('node_modules/zustand/')) return 'vendor';
            if (id.includes('node_modules/exifr/')) return 'vendor';
            if (id.includes('node_modules/dexie/')) return 'vendor';
          },
        },
      },
    },
  },
});
