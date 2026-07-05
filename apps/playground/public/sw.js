/* eslint-disable no-restricted-globals */
/**
 * Lokvis Playground Service Worker
 *
 * 版本：SW_VERSION = 'v2-w15.3'
 * 功能：
 *   W15.1：
 *   1. 预缓存 playground shell（index + 5 个核心 demo 页 HTML + manifest + icon + offline.html）
 *   2. 运行时缓存策略：
 *      - 导航请求：network-first，失败 fallback 到 index.html → /offline.html
 *      - manifest / icon：cache-first
 *      - 跨域请求：network-only，不缓存
 *   3. skipWaiting + clients.claim 实现 SW 即时更新
 *
 *   W15.3（本次新增）：
 *   4. immutable 缓存：/assets/* 下带 8+ 位 hash 的构建产物（chunk-abc12345.js）
 *      用 cache-first + 永不 revalidate（命中即返回，hash 不变即内容不变）。
 *   5. 失败重试：/assets/* 请求 fetch 失败（网络错误或 !response.ok）时重试 2 次
 *      （共 3 次尝试，间隔 200ms），全部失败后 fallback 到缓存 → 备用 CDN → 503 错误页。
 *      导航请求不重试（network-first 保持原逻辑）。
 *   6. 备用 CDN：主源 /assets/* 失败后，对 pathname 含 `@lokvis/` 的资源尝试
 *      jsdelivr / unpkg 备用源（当前无此类资源，为未来 Squoosh WASM 引擎铺路）。
 *
 * 注意：Astro 构建产物带 hash 的 JS chunk 不写死 URL（hash 每次构建变化），
 *      通过 immutable / stale-while-revalidate 策略自动缓存。
 *
 * 约定（AGENTS.md）：所有 fetch 必须检查 response.ok。
 */

// SW 版本号 —— 更新此值会触发新 SW 接管 + 旧 cache 清理
const SW_VERSION = 'v2-w15.3';

// Cache 命名（修改版本时同步改后缀，activate 阶段会清理旧版本 cache）
const PRECACHE = 'lokvis-precache-v1';
const RUNTIME = 'lokvis-runtime-v1';

/**
 * 备用 CDN 列表（W15.3）
 * 仅对 pathname 含 `@lokvis/` 的资源生效（未来 Squoosh WASM 引擎的跨源资源）。
 * 当前 playground 构建产物都在同源 /assets/ 下，不触发备用 CDN。
 */
const BACKUP_CDNS = [
  'https://cdn.jsdelivr.net/npm/@lokvis/',
  'https://unpkg.com/@lokvis/',
];

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

  // /assets/*：immutable 缓存（带 hash）+ 失败重试 + 备用 CDN（W15.3）
  if (url.pathname.startsWith('/assets/')) {
    if (isImmutableAsset(url)) {
      // 带 hash 的构建产物：cache-first + 永不 revalidate
      event.respondWith(handleImmutableAsset(request));
    } else {
      // /assets/* 下无 hash 的资源：stale-while-revalidate + 重试 + 备用 CDN
      event.respondWith(handleAssetWithRetry(request));
    }
    return;
  }

  // 同源其他静态资产（*.js / *.css，非 /assets/）：stale-while-revalidate（无重试）
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
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
// W15.3：immutable 缓存 + 失败重试 + 备用 CDN 辅助函数
// ============================================================================

/**
 * hash 正则：文件名中 8 位以上十六进制 hash（如 chunk-abc12345.js、_chunk.abc123de.css）。
 * 要求 hash 前有 - _ . 分隔符，避免误判普通长名文件。
 */
const HASH_RE = /[-_.][0-9a-f]{8,}\.(?:js|css|mjs|wasm|woff2?)$/i;

/**
 * 判断 URL 是否为不可变资产（带 hash 的构建产物）。
 * 命中后用 cache-first + 永不 revalidate（hash 不变即内容不变）。
 *
 * @param {URL} url
 * @returns {boolean}
 */
function isImmutableAsset(url) {
  if (!url.pathname.startsWith('/assets/')) return false;
  return HASH_RE.test(url.pathname);
}

/**
 * 带重试的 fetch（W15.3）。
 * fetch 失败（网络错误 throw，或 !response.ok）时重试，共 retries+1 次尝试，
 * 每次间隔 200ms。成功返回 response.ok 的响应，全部失败抛出最后一个错误。
 *
 * @param {Request} request
 * @param {number} retries 额外重试次数（默认 2，共 3 次尝试）
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(request, retries = 2) {
  let lastErr;
  const totalAttempts = retries + 1;
  for (let attempt = 0; attempt < totalAttempts; attempt++) {
    try {
      const resp = await fetch(request);
      if (resp.ok) {
        return resp;
      }
      // !response.ok 视为可重试失败（5xx 等），记录后继续重试
      lastErr = new Error(
        `Fetch failed: ${resp.status} ${resp.statusText} (${request.url})`,
      );
    } catch (err) {
      lastErr = err;
    }
    // 非最后一次尝试 → 等待 200ms 后重试
    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw lastErr;
}

/**
 * 从备用 CDN 拉取资源（W15.3）。
 * 仅当 pathname 含 `@lokvis/` 时尝试，依次请求 jsdelivr → unpkg。
 * 返回 response.ok 的响应，或 null（无匹配 / 全部失败）。
 *
 * @param {string} pathname
 * @returns {Promise<Response|null>}
 */
async function fetchFromBackupCdns(pathname) {
  const idx = pathname.indexOf('@lokvis/');
  if (idx === -1) {
    return null;
  }
  // 截取 @lokvis/... 部分（包名 + 子路径）拼到 CDN 基址后
  const suffix = pathname.slice(idx);
  for (const cdnBase of BACKUP_CDNS) {
    try {
      const resp = await fetch(cdnBase + suffix);
      if (resp.ok) {
        return resp;
      }
    } catch (err) {
      // 当前 CDN 失败，尝试下一个
    }
  }
  return null;
}

/**
 * 资产 fetch 完整 fallback 链（W15.3）：主源重试 → 备用 CDN。
 * 成功返回 response.ok 的响应（已脱离原 cache key，调用方负责 cache.put）；
 * 全部失败返回 null。
 *
 * @param {Request} request
 * @returns {Promise<Response|null>}
 */
async function fetchAssetWithFallbacks(request) {
  try {
    return await fetchWithRetry(request, 2);
  } catch (_err) {
    // 主源 3 次尝试全失败 → 尝试备用 CDN（仅 @lokvis/* 资源）
    const url = new URL(request.url);
    const backup = await fetchFromBackupCdns(url.pathname);
    return backup;
  }
}

/**
 * 资产加载失败的 503 错误页（简短，离线可读）。
 */
function assetErrorResponse() {
  return (
    '<!doctype html><meta charset="utf-8"><title>Asset load failed</title>' +
    '<body style="font-family:system-ui;background:#09090b;color:#e4e4e7;padding:2rem">' +
    '<h1>Asset load failed</h1>' +
    '<p>Lokvis Playground could not load a required asset after multiple retries.</p>' +
    '<p>Check your connection and <a href="#" onclick="location.reload()">reload</a>.</p></body>'
  );
}

/**
 * immutable 资产处理（带 hash 的 /assets/*）：cache-first + 永不 revalidate。
 * - 命中缓存：直接返回（不后台更新，hash 不变即内容不变）
 * - 未命中：fetchAssetWithFallbacks（重试 + 备用 CDN），成功写入缓存
 * - 全部失败：返回缓存（若有旧值）→ 否则 503 错误页
 */
async function handleImmutableAsset(request) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(request);
  if (cached) {
    // immutable：永不 revalidate，直接返回
    return cached;
  }
  const resp = await fetchAssetWithFallbacks(request);
  if (resp) {
    await cache.put(request, resp.clone());
    return resp;
  }
  // 无缓存且全源失败 → 503
  return new Response(assetErrorResponse(), {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

/**
 * /assets/* 非 hash 资产处理：stale-while-revalidate + 重试 + 备用 CDN。
 * - 命中缓存：立即返回 + 后台用 fetchAssetWithFallbacks 更新
 * - 未命中：等待 fetchAssetWithFallbacks，成功写入缓存并返回
 * - 全部失败：返回缓存（若有）→ 否则 503 错误页
 */
async function handleAssetWithRetry(request) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(request);

  // 后台更新（重试 + 备用 CDN），不阻塞响应
  const networkUpdate = (async () => {
    const resp = await fetchAssetWithFallbacks(request);
    if (resp) {
      await cache.put(request, resp.clone());
    }
    return resp;
  })().catch(() => null);

  if (cached) {
    // 触发后台更新（不 await）
    networkUpdate.catch(() => {});
    return cached;
  }
  const resp = await networkUpdate;
  if (resp) {
    return resp;
  }
  // 网络失败且无缓存 → 503
  return new Response(assetErrorResponse(), {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

// ============================================================================
// message：响应 SKIP_WAITING（用于 SW 更新提示）
// ============================================================================
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
