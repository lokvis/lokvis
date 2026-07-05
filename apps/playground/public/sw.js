/* eslint-disable no-restricted-globals */
/**
 * Lokvis Playground Service Worker
 *
 * 版本：SW_VERSION = 'v1-w15.1'
 * 功能（W15.1）：
 *   1. 预缓存 playground shell（index + 5 个核心 demo 页 HTML + manifest + icon + offline.html）
 *   2. 运行时缓存策略：
 *      - 导航请求：network-first，失败 fallback 到 index.html → /offline.html
 *      - 同源静态资产（/assets/*, *.js, *.css）：stale-while-revalidate
 *      - manifest / icon：cache-first
 *      - 跨域请求：network-only，不缓存
 *   3. skipWaiting + clients.claim 实现 SW 即时更新
 *
 * 注意：Astro 构建产物带 hash 的 JS chunk 不写死 URL（hash 每次构建变化），
 *      通过 runtime stale-while-revalidate 策略自动缓存。
 *
 * 约定（AGENTS.md）：所有 fetch 必须检查 response.ok。
 */

// SW 版本号 —— 更新此值会触发新 SW 接管 + 旧 cache 清理
const SW_VERSION = 'v1-w15.1';

// Cache 命名（修改版本时同步改后缀，activate 阶段会清理旧版本 cache）
const PRECACHE = 'lokvis-precache-v1';
const RUNTIME = 'lokvis-runtime-v1';

/**
 * 预缓存 URL 列表
 * - HTML 页面：playground shell + 5 个核心 demo 页（SDK/Runtime/Plugin/Workflow/MCP）
 * - 静态资源：manifest + icon + offline.html
 * - JS chunk 不在此列表（hash 化，运行时缓存）
 *
 * 注意：offline.html 由 W15.6 创建，此处先引用；
 *      install 阶段用 Promise.allSettled 容错，单个 URL 失败不阻塞。
 */
const PRECACHE_URLS = [
  '/',
  '/sdk',
  '/runtime',
  '/plugin',
  '/workflow',
  '/mcp',
  '/manifest.webmanifest',
  '/icon.svg',
  '/offline.html',
];

// ============================================================================
// install：预缓存 + skipWaiting
// ============================================================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      // 用 Promise.allSettled 容错：单个 URL fetch 失败（如 offline.html 暂未创建）
      // 不阻塞 install，后续版本会补上。
      const results = await Promise.allSettled(
        PRECACHE_URLS.map(async (url) => {
          // 先 fetch 再 put，避免 addAll 一个失败全部回滚
          const resp = await fetch(url);
          if (!resp.ok) {
            throw new Error(`Precache fetch failed: ${url} -> ${resp.status} ${resp.statusText}`);
          }
          await cache.put(url, resp.clone());
          return url;
        }),
      );
      // 记录失败的 URL（仅 console，不抛错）
      const failed = results
        .filter((r) => r.status === 'rejected')
        .map((r) => r.reason?.message || String(r.reason));
      if (failed.length > 0) {
        console.warn('[SW] precache partial failure (non-blocking):', failed);
      }
      // 立即接管下一跳（配合 clients.claim 实现新 SW 即时生效）
      await self.skipWaiting();
    })(),
  );
});

// ============================================================================
// activate：清理旧 cache + clients.claim
// ============================================================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 删除非 CURRENT cache 名（旧版本 PRECACHE / RUNTIME）
      const expectedCaches = new Set([PRECACHE, RUNTIME]);
      const existingCaches = await caches.keys();
      await Promise.all(
        existingCaches
          .filter((name) => !expectedCaches.has(name))
          .map((name) => caches.delete(name)),
      );
      // 立即接管所有同源 client（无需 reload 即生效）
      await self.clients.claim();
    })(),
  );
});

// ============================================================================
// fetch：路由分发
// ============================================================================
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 仅拦截 GET 请求，其他方法（POST/PUT/...）直接放行
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // 跳过 chrome-extension:// 和 dev tools 请求（非 http/https）
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // 跨域请求：network-only，不缓存（如 Sentry CDN）
  if (url.origin !== self.location.origin) {
    return;
  }

  // 导航请求：network-first → index.html → /offline.html
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigate(request));
    return;
  }

  // manifest / icon：cache-first
  if (url.pathname === '/manifest.webmanifest' || url.pathname === '/icon.svg') {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 同源静态资产（/assets/*、*.js、*.css）：stale-while-revalidate
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css')
  ) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // 其他同源 GET 请求：默认走 stale-while-revalidate（保守策略）
  event.respondWith(staleWhileRevalidate(request));
});

/**
 * 处理导航请求：network-first，失败 fallback 到缓存的 index.html → /offline.html
 */
async function handleNavigate(request) {
  try {
    const resp = await fetch(request);
    if (resp.ok) {
      // 成功响应写入 runtime cache 供离线使用
      const cache = await caches.open(RUNTIME);
      cache.put(request, resp.clone());
    }
    return resp;
  } catch (err) {
    // 网络失败，尝试缓存中的同一 URL
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    // fallback 到缓存的 index.html（shell）
    const indexCached = await caches.match('/');
    if (indexCached) {
      return indexCached;
    }
    // 最后 fallback 到 /offline.html（W15.6 提供离线页）
    const offlineCached = await caches.match('/offline.html');
    if (offlineCached) {
      return offlineCached;
    }
    // 全部失败：返回一个最小离线提示
    return new Response(
      '<!doctype html><meta charset="utf-8"><title>Offline</title>' +
        '<body style="font-family:system-ui;background:#09090b;color:#e4e4e7;padding:2rem">' +
        '<h1>You are offline</h1><p>Lokvis Playground needs a network connection to load.</p></body>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
}

/**
 * Cache-first 策略：优先缓存，缓存未命中再 fetch 并写入缓存
 * 用于 manifest / icon（极少变化）
 */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  try {
    const resp = await fetch(request);
    if (resp.ok) {
      const cache = await caches.open(RUNTIME);
      cache.put(request, resp.clone());
    }
    return resp;
  } catch (err) {
    // 网络失败且无缓存：返回 504
    return new Response('Gateway timeout', { status: 504 });
  }
}

/**
 * Stale-while-revalidate 策略：
 *  - 命中缓存：立即返回缓存 + 后台异步更新缓存
 *  - 未命中：fetch + 写入缓存 + 返回
 * 用于带 hash 的静态资产（/assets/*、*.js、*.css）
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(request);

  // 后台更新 promise（不阻塞响应）
  const networkUpdate = (async () => {
    try {
      const resp = await fetch(request);
      if (resp.ok) {
        cache.put(request, resp.clone());
      }
      return resp;
    } catch (err) {
      // 后台更新失败静默处理（缓存仍可用）
      return null;
    }
  })();

  // 命中缓存立即返回；否则等待 network
  if (cached) {
    // 触发后台更新（不 await）
    networkUpdate.catch(() => {});
    return cached;
  }
  const resp = await networkUpdate;
  if (resp) {
    return resp;
  }
  // 网络失败且无缓存
  return new Response('Gateway timeout', { status: 504 });
}

// ============================================================================
// message：响应 SKIP_WAITING（用于 SW 更新提示）
// ============================================================================
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
