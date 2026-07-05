import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
//
// 部署目标:Cloudflare Pages → playground.lokvis.dev(W14.7)
// - site:用于生成 sitemap / canonical URL / OG 绝对链接
// - base:'/' (subdomain 根部署,无需路径前缀)
// - 本地开发:`astro dev` 仍走 5601 端口,base='/' 不影响本地路由
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
