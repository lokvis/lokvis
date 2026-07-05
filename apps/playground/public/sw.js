/* eslint-disable no-restricted-globals */
/**
 * Lokvis Playground Service Worker
 *
 * 版本：SW_VERSION = 'v4-w15.7-review-fix'
 * 功能：
 *   W15.1：
 *   1. 预缓存 playground shell（index + 5 个核心 demo 页 + 8 个 tools 页 + manifest + icon + offline.html）
 *   2. 运行时缓存策略：
 *      - 导航请求：network-first，失败 fallback 到 index.html → /offline.html
 *      - manifest / icon：cache-first
 *      - 跨域请求：network-only，不缓存
 *   3. skipWaiting + clients.claim 实现 SW 即时更新
 *
 *   W15.3：
 *   4. immutable 缓存：/assets/* 与 /_astro/* 下带 8+ 位 hash 的构建产物
 *      用 cache-first + 永不 revalidate（命中即返回，hash 不变即内容不变）。
 *   5. 失败重试：资产请求 fetch 失败（网络错误或 5xx）时重试 2 次
 *      （共 3 次尝试，间隔 200ms），全部失败后 fallback 到缓存 → 备用 CDN → 503 错误页。
 *      4xx（404/401/403）为永久错误不重试；导航请求不重试（network-first 保持原逻辑）。
 *   6. 备用 CDN：主源失败后，对 pathname 含 `@lokvis/` 的资源尝试
 *      jsdelivr / unpkg 备用源（当前无此类资源，为未来 Squoosh WASM 引擎铺路）。
 *
 *   W15.7：
 *   7. install 后向所有 client 发 `SW_INSTALLED`（客户端可显示"刷新以激活新版本"提示）。
 *   8. activate + clients.claim 后向所有 client 发 `SW_ACTIVATED`，客户端收到后
 *      调 `preloadTop5Operations()`（engine-image/lazy.js）触发 top 5 operation chunk
 *      的 dynamic import —— 浏览器自动 fetch chunk，SW 的 immutable/SWR 缓存自然生效。
 *      SW 不硬编码 chunk URL（hash 每次构建变化），预加载完全由客户端 ESM import 驱动。
 *   9. message 事件扩展：SKIP_WAITING（现有）/ PRELOAD_TOP5（回执 TOP5_PRELOAD_TRIGGERED）
 *      / GET_VERSION（回执 SW_VERSION + 版本号）。
 *
 *   Review fix（本次）：
 *   10. SW_VERSION 与 cache 版本耦合：CACHE_VERSION 从 SW_VERSION 派生，
 *       避免 SW 升级但 cache 仍残留旧版本数据。activate 自动清理所有非当前版本 cache。
 *   11. 导航 5xx fallback：fetch 返回 !ok（5xx）时也走 cache fallback，
 *       避免 502/503 时用户看到原始错误页。
 *   12. fetchWithRetry 仅对 5xx 重试：4xx（404/401/403）为永久错误立即返回，不浪费重试次数。
 *   13. PRECACHE_URLS 补全 8 个 /tools/* 页面，确保离线可访问所有工具页。
 *   14. NETWORK_RECOVERED 消息：检测到 navigator.onLine 由 false → true 时，
 *       向所有 client 广播 NETWORK_RECOVERED，offline.html 据此自动 reload。
 *
 * 注意：Astro 构建产物带 hash 的 JS chunk 不写死 URL（hash 每次构建变化），
 *      通过 immutable / stale-while-revalidate 策略自动缓存。
 *
 * 约定（AGENTS.md）：所有 fetch 必须检查 response.ok。
 */

// SW 版本号 —— 更新此值会触发新 SW 接管 + 旧 cache 清理
const SW_VERSION = 'v4-w15.7-review-fix';

// Cache 版本从 SW_VERSION 派生（修改 SW_VERSION 时 cache 自动跟随升级，
// activate 阶段清理所有非当前版本 cache，避免残留旧数据）
const CACHE_VERSION = SW_VERSION.replace(/[^a-zA-Z0-9-]/g, '');
const PRECACHE = `lokvis-precache-${CACHE_VERSION}`;
const RUNTIME = `lokvis-runtime-${CACHE_VERSION}`;

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
 *   + 8 个 /tools/* 工具页（review fix：原遗漏导致离线无法访问工具页）
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
  // 8 个 /tools/* 工具页（review fix：原遗漏）
  '/tools/compress',
  '/tools/resize',
  '/tools/convert',
  '/tools/crop',
  '/tools/watermark',
  '/tools/watermark-batch',
  '/tools/batch',
  '/tools/download',
  '/manifest.webmanifest',
  '/icon.svg',
  '/offline.html',
];

// ============================================================================
// install：预缓存 + skipWaiting + 通知客户端 SW_INSTALLED（W15.7）
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
      // W15.7：通知所有 client 新 SW 已 install，客户端可显示"刷新以激活新版本"提示
      await notifyClients({ type: 'SW_INSTALLED', version: SW_VERSION });
    })(),
  );
});

// ============================================================================
// activate：清理旧 cache + clients.claim + 通知客户端 SW_ACTIVATED（W15.7）
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
      // W15.7：通知所有 client SW 已激活，客户端收到后调 preloadTop5Operations()
      // 触发 top 5 engine chunk 的 dynamic import（浏览器自动 fetch，SW 缓存自然生效）
      await notifyClients({ type: 'SW_ACTIVATED', version: SW_VERSION });
    })(),
  );
});

/**
 * 向所有同源 client 广播消息（W15.7）。
 * includeUncontrolled: true 确保尚未被当前 SW 控制的页面也能收到（如首次安装场景）。
 *
 * @param {any} message
 */
async function notifyClients(message) {
  const clients = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });
  for (const client of clients) {
    client.postMessage(message);
  }
}

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

  // 构建产物目录：immutable 缓存（带 hash）+ 失败重试 + 备用 CDN（W15.3）
  // 同时覆盖 /assets/* 与 Astro 默认的 /_astro/*（W15.3 fix：原仅 /assets/ 导致
  // Astro 真实输出的 /_astro/*.js chunk 不触发 immutable/retry，走通用 SWR 分支）
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/_astro/')) {
    if (isImmutableAsset(url)) {
      // 带 hash 的构建产物：cache-first + 永不 revalidate
      event.respondWith(handleImmutableAsset(request));
    } else {
      // 无 hash 的资源：stale-while-revalidate + 重试 + 备用 CDN
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
 *
 * Review fix：原仅 catch 网络错误才 fallback；现 !resp.ok（5xx）也走 cache fallback，
 * 避免 502/503 时用户看到原始错误页（CDN/源站故障时仍能展示已缓存的 shell）。
 */
async function handleNavigate(request) {
  try {
    const resp = await fetch(request);
    if (resp.ok) {
      // 成功响应写入 runtime cache 供离线使用
      const cache = await caches.open(RUNTIME);
      cache.put(request, resp.clone());
      return resp;
    }
    // 5xx 等 !ok 响应：不直接返回错误页，尝试 cache fallback
    // （4xx 如 404 仍返回原响应，因为这是"页面不存在"的正常语义）
    if (resp.status >= 500) {
      const cached = await caches.match(request);
      if (cached) return cached;
      const indexCached = await caches.match('/');
      if (indexCached) return indexCached;
      const offlineCached = await caches.match('/offline.html');
      if (offlineCached) return offlineCached;
    }
    return resp;
  } catch {
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
  } catch {
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
    } catch {
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
  if (!url.pathname.startsWith('/assets/') && !url.pathname.startsWith('/_astro/')) return false;
  return HASH_RE.test(url.pathname);
}

/**
 * 带重试的 fetch（W15.3，review fix）。
 *
 * 重试策略（review fix：4xx 不重试）：
 *   - 网络错误（throw）：可重试（可能是瞬时网络抖动）
 *   - 5xx 响应：可重试（服务器临时故障）
 *   - 4xx 响应（404/401/403）：永久错误，立即返回原响应，不重试
 *   - 2xx/3xx：成功，立即返回
 *
 * 共 retries+1 次尝试，每次间隔 200ms。
 *
 * @param {Request} request
 * @param {number} retries 额外重试次数（默认 2，共 3 次尝试）
 * @returns {Promise<Response>} response.ok 的响应；4xx 时返回原响应（调用方自行处理）
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
      // 4xx 为永久错误，立即返回（不重试，避免浪费请求）
      if (resp.status >= 400 && resp.status < 500) {
        return resp;
      }
      // 5xx 视为可重试失败，记录后继续重试
      lastErr = new Error(
        `Fetch failed: ${resp.status} ${resp.statusText} (${request.url})`,
      );
    } catch (err) {
      // 网络错误（throw）视为可重试
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
    } catch {
      // 当前 CDN 失败，尝试下一个
    }
  }
  return null;
}

/**
 * 资产 fetch 完整 fallback 链（W15.3，review fix）：主源重试 → 备用 CDN。
 *
 * Review fix：fetchWithRetry 现在对 4xx 返回原响应而非 throw，
 * 故本函数需额外检查 resp.ok —— 4xx 视为失败（返回 null，不缓存错误响应），
 * 仅 ok 响应返回给调用方写入缓存。
 *
 * @param {Request} request
 * @returns {Promise<Response|null>} response.ok 的响应；全部失败返回 null
 */
async function fetchAssetWithFallbacks(request) {
  try {
    const resp = await fetchWithRetry(request, 2);
    // 4xx 响应不缓存，返回 null 让调用方走 fallback
    return resp.ok ? resp : null;
  } catch {
    // 主源 3 次尝试全失败（5xx/网络错误）→ 尝试备用 CDN（仅 @lokvis/* 资源）
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
// message：响应客户端消息（W15.7 扩展）
//   - 'SKIP_WAITING'（字符串，向后兼容）/ { type: 'SKIP_WAITING' }：立即 skipWaiting
//   - { type: 'PRELOAD_TOP5' }：回执 TOP5_PRELOAD_TRIGGERED（实际预加载由客户端做，
//     SW 不能 import engine 模块，仅负责触发与缓存）
//   - { type: 'GET_VERSION' }：回执 SW_VERSION + 版本号（调试用）
// ============================================================================
self.addEventListener('message', (event) => {
  const data = event.data;

  // 向后兼容：字符串 'SKIP_WAITING'
  if (data === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (!data || typeof data !== 'object') {
    return;
  }

  switch (data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
    case 'PRELOAD_TOP5':
      // 回执客户端：可触发 preloadTop5Operations()（实际 dynamic import 在客户端执行）
      if (event.source) {
        event.source.postMessage({
          type: 'TOP5_PRELOAD_TRIGGERED',
          version: SW_VERSION,
        });
      }
      break;
    case 'GET_VERSION':
      if (event.source) {
        event.source.postMessage({ type: 'SW_VERSION', version: SW_VERSION });
      }
      break;
    default:
      break;
  }
});

// ============================================================================
// NETWORK_RECOVERED 广播（review fix for Major-4）
//
// offline.html 监听 `data.type === 'NETWORK_RECOVERED'` 消息以自动 reload，
// 但原 sw.js 从未发送该消息（dead code）。现补全：
// SW 作用域内有 navigator.onLine + online/offline 事件，
// 检测到 false → true 转换时向所有 client 广播 NETWORK_RECOVERED。
//
// 注意：SW 中的 navigator.onLine 与页面一致（同源同浏览器）。
// ============================================================================
let wasOnline = self.navigator.onLine;
self.addEventListener('online', () => {
  // 仅在 false → true 转换时广播（避免重复通知）
  if (!wasOnline) {
    wasOnline = true;
    notifyClients({ type: 'NETWORK_RECOVERED', version: SW_VERSION }).catch(() => {});
  }
});
self.addEventListener('offline', () => {
  wasOnline = false;
});
