/**
 * Lokvis Service Worker
 *
 * 离线缓存策略：
 * - App Shell: 缓存优先
 * - WASM/静态资源: 缓存优先，后台更新
 * - 页面: 网络优先，降级到缓存
 */

const CACHE_VERSION = 'lokvis-v0.1.0';
const APP_SHELL = [
  '/',
  '/workspace',
  '/manifest.webmanifest',
  '/offline.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 跳过非 GET 请求
  if (request.method !== 'GET') return;

  // WASM 文件：缓存优先（immutable）
  if (url.pathname.endsWith('.wasm')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((resp) => {
            const clone = resp.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(request, clone));
            return resp;
          })
      )
    );
    return;
  }

  // 导航请求：网络优先，降级到缓存
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(request) || caches.match('/offline.html'))
    );
    return;
  }

  // 其他资源：缓存优先
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((resp) => {
          const clone = resp.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(request, clone));
          return resp;
        })
    )
  );
});
