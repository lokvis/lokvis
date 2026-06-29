import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://lokvis.com',

  // Cloudflare Pages 适配器（生产部署）
  // adapter: cloudflare(),

  integrations: [react()],

  // 跨域隔离配置（SharedArrayBuffer / ffmpeg.wasm 需要）
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

  // PWA 配置（通过 astro-pwa 集成或手动配置 Service Worker）
  build: {
    inlineStylesheets: 'auto',
  },
});
