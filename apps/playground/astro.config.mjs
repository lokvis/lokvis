// W14.7: Playground 迁移到独立子域名 playground.lokvis.dev（根路径部署）。
// 此前为 lokvis.com/playground 子路径（site: lokvis.com, base: /playground），
// 现改为根域部署：site: https://playground.lokvis.dev, base: '/'。
// 部署目标 Cloudflare Pages 项目 `lokvis-playground`，见 DEPLOY.md。
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://playground.lokvis.dev',
  base: '/',
  server: { port: 5601 },

  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
    server: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    },
    optimizeDeps: {
      exclude: ['@lokvis/runtime', '@lokvis/sdk'],
    },
  },
});
