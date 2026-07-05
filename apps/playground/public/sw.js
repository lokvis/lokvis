/**
 * Lokvis Playground Service Worker
 *
 * 三阶段能力(W15.1 + W15.3 + W15.7):
 *   1. 预缓存 app shell + 关键资源(W15.1 install 阶段)
 *   2. 运行时缓存策略(W15.1 fetch 阶段):
 *        - HTML 导航: network-first → cache → offline.html
 *        - 静态资源(JS/CSS/字体/图片): stale-while-revalidate
 *        - WASM/Engine chunk: cache-first + 失败重试 + 备用 CDN(W15.3)
 *   3. PWA 安装后预加载 top 5 engine(W15.7 message 通道触发)
 *
 * 版本号变更会触发新 SW 接管(skipWaiting + clientsClaim)。
 * - 修改 CACHE_VERSION 后浏览器会在下次加载时拉取新 SW、缓存新资源、清理旧缓存。
 *
 * 注意:本文件不参与 Astro 构建,直接以源码形式部署到 Cloudflare Pages。
 * 不能使用 ES module 顶层 import(浏览器对 SW 的 importScripts 有限制),
 * 但 SW 本身支持 type:module(本文件以 classic script 形式注册,内部不使用 import)。
 */

// ────────────────────────────────────────────────────────────────
// 配置
// ────────────────────────────────────────────────────────────────

const CACHE_VERSION = 'v15.1.0';
const PRECACHE_NAME = `lokvis-precache-${CACHE_VERSION}`;
const RUNTIME_NAME = `lokvis-runtime-${CACHE_VERSION}`;
const ENGINE_NAME = `lokvis-engine-${CACHE_VERSION}`;

/**
 * 预缓存清单(W15.1)
 *
 * 这些是已知路径的"shell 资源"——非哈希命名的稳定 URL。
 * 哈希命名的 JS/CSS/图片块不在此列(由运行时缓存策略接管),
 * 因为构建产物文件名会变,无法在 SW 源码里硬编码。
 *
 * - '/' :app shell 入口(HTML)
 * - '/manifest.webmanifest' :PWA 清单
 * - '/icon.svg' / '/icon-maskable.svg' :PWA 图标
 * - '/offline.html' :离线 fallback 页(W15.6)
 * - '/_headers' :Cloudflare Pages 头文件(仅作冗余预缓存,无副作用)
 */
const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-maskable.svg',
  '/offline.html',
];

/**
 * Top 5 Engine 预加载清单(W15.7)
 *
 * 当前 MVP 引擎是浏览器原生 Canvas,无独立 WASM 文件。
 * 这里列出的是按 capability 拆分的 engine-image 子模块 URL,
 * 安装 PWA 后由 SW 后台静默预拉取并缓存——用户首次触发工具时
 * 直接命中缓存,无网络往返。
 *
 * 列表对应 5 个最常用 image capability:
 *   - resize / compress / convert / crop / watermark
 *
 * 注:这些 URL 实际是否存在取决于 W15.2 lazy.ts 是否把它们拆成
 * 独立 chunk。即使 fetch 404,SW 也只是记录日志、不会抛错。
 * 未来接入 Squoosh WASM 后,在此追加 .wasm URL 即可。
 */
const TOP5_ENGINE_URLS = [
  '/engines/resize.js',
  '/engines/compress.js',
  '/engines/convert.js',
  '/engines/crop.js',
  '/engines/watermark.js',
];

/**
 * 备用 CDN(W15.3)
 *
 * 主源(fetch)失败时按顺序尝试备用源。空数组表示无备用。
 * 配置示例(部署时按需启用):
 *   const ENGINE_FALLBACK_CDNS = [
 *     'https://cdn.jsdelivr.net/npm/@lokvis/engine-image@0.2.0-beta.0/dist/',
 *   ];
 *
 * 当前未启用——engine-image 走 canvas 实现,体积小,主源足够可靠。
 * 保留代码路径以备未来 WASM 接入。
 */
const ENGINE_FALLBACK_CDNS = [];

/**
 * 不可变资源的判定(W15.3 immutable 缓存)
 *
 * 哈希命名的 chunk(如 _astro/client.DW6xmEpB.js)一经发布内容不变,
 * 适合 cache-first 永久缓存。判定规则:
 *   - 路径以 /_astro/ 开头(Astro 构建产物目录)
 *   - 文件名包含 8 位以上字母数字哈希(如 DW6xmEpB)
 */
function isImmutableAsset(url) {
  const u = new URL(url);
  if (u.pathname.startsWith('/_astro/')) return true;
  return /[-_][a-z0-9]{8,}\.(?:js|css|wasm|woff2?)$/i.test(u.pathname);
}

/** 是否为 WASM / Engine 模块(W15.3 重试 + 备用 CDN 仅对此类生效) */
function isEngineAsset(url) {
  const u = new URL(url);
  return (
    u.pathname.startsWith('/engines/') ||
    u.pathname.endsWith('.wasm') ||
    u.pathname.includes('/engine-')
  );
}

/** 是否为 HTML 导航请求 */
function isNavigationRequest(request) {
  return (
    request.mode === 'navigate' ||
    (request.method === 'GET' &&
      request.headers.get('accept')?.includes('text/html'))
  );
}

// ────────────────────────────────────────────────────────────────
// W15.1 — install:预缓存 app shell
// ────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE_NAME);
      // allSettled:即使某个 URL 失败(如 offline.html 还没建好),
      // 也不阻塞 SW 安装。失败项会在下次 activate 时被清理。
      const results = await Promise.allSettled(
        PRECACHE_URLS.map(async (url) => {
          const resp = await fetch(url, { cache: 'no-cache' });
          if (!resp.ok) throw new Error(`precache ${url} → ${resp.status}`);
          return cache.put(url, resp);
        })
      );
      const failed = results
        .map((r, i) => (r.status === 'rejected' ? PRECACHE_URLS[i] : null))
        .filter(Boolean);
      if (failed.length > 0) {
        console.warn('[sw] precache partial failure:', failed);
      }
      // 立即激活新 SW(配合 clientsClaim)
      await self.skipWaiting();
    })()
  );
});

// ────────────────────────────────────────────────────────────────
// activate:清理旧缓存 + 接管所有 client
// ────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      // 删除所有不属于当前版本的缓存(包括 PRECACHE/RUNTIME/ENGINE)
      await Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith('lokvis-') &&
              ![
                PRECACHE_NAME,
                RUNTIME_NAME,
                ENGINE_NAME,
              ].includes(key)
          )
          .map((key) => caches.delete(key))
      );
      // 立即接管所有未受控的 client
      await self.clients.claim();
    })()
  );
});

// ────────────────────────────────────────────────────────────────
// W15.1 + W15.3 — fetch:分级缓存策略
// ────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 仅拦截 GET 同源请求;其他方法/跨域请求直接走网络
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 1. HTML 导航:network-first → cache → offline.html
  if (isNavigationRequest(request)) {
    event.respondWith(handleNavigation(request));
    return;
  }

  // 2. Engine / WASM 资源:cache-first + 重试 + 备用 CDN(W15.3)
  if (isEngineAsset(url.href)) {
    event.respondWith(handleEngineAsset(event, request));
    return;
  }

  // 3. 不可变资源(哈希 chunk):stale-while-revalidate
  if (isImmutableAsset(url.href)) {
    event.respondWith(handleStaleWhileRevalidate(request));
    return;
  }

  // 4. 其他静态资源(manifest/icon 等):stale-while-revalidate
  event.respondWith(handleStaleWhileRevalidate(request));
});

/**
 * HTML 导航:network-first
 * - 在线:返回网络响应,同时更新缓存
 * - 离线 / 网络失败:回退缓存 → /offline.html
 */
async function handleNavigation(request) {
  const cache = await caches.open(RUNTIME_NAME);
  try {
    const resp = await fetch(request);
    // 仅缓存有效响应(避免缓存 5xx 错误页)
    if (resp.ok && resp.type === 'basic') {
      cache.put(request, resp.clone());
    }
    return resp;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    const offline = await caches.match('/offline.html');
    if (offline) return offline;
    throw err;
  }
}

/**
 * 不可变资源 + 一般静态资源:stale-while-revalidate
 * - 有缓存:立即返回,后台异步更新
 * - 无缓存:走网络,成功后写入缓存
 */
async function handleStaleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_NAME);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((resp) => {
      if (resp.ok && resp.type === 'basic') {
        cache.put(request, resp.clone());
      }
      return resp;
    })
    .catch(() => null);
  // 有缓存先用缓存;无缓存等网络
  return cached || (await networkPromise) || Response.error();
}

/**
 * W15.3 — Engine / WASM:cache-first + 失败重试 + 备用 CDN
 *
 * 策略:
 *   1. 命中缓存 → 立即返回(后台 SWR 更新)
 *   2. 未命中 → fetch 主源,重试 2 次(共 3 次尝试)
 *   3. 主源全失败 → 依次尝试 ENGINE_FALLBACK_CDNS
 *   4. 全失败 → 返回 504(让上层降级到 canvas)
 */
async function handleEngineAsset(event, request) {
  const cache = await caches.open(ENGINE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    // 后台 SWR 更新(不阻塞响应)
    event.waitUntil(refreshEngineAsset(request, cache));
    return cached;
  }

  const resp = await fetchWithRetry(request, 3);
  if (resp) {
    cache.put(request, resp.clone());
    return resp;
  }

  // 备用 CDN(W15.3)
  for (const cdnBase of ENGINE_FALLBACK_CDNS) {
    const fallbackUrl = cdnBase + new URL(request.url).pathname.split('/').pop();
    const fbResp = await fetchWithRetry(new Request(fallbackUrl, request), 2);
    if (fbResp) {
      cache.put(request, fbResp.clone()); // 用原 URL 作 key,下次直接命中
      return fbResp;
    }
  }

  // 全失败:返回 504,触发上层降级逻辑
  return new Response('Engine asset unavailable offline', {
    status: 504,
    headers: { 'Content-Type': 'text/plain' },
  });
}

/** 后台刷新 engine 资源(SWR) */
async function refreshEngineAsset(request, cache) {
  try {
    const resp = await fetch(request);
    if (resp.ok && resp.type === 'basic') {
      await cache.put(request, resp.clone());
    }
  } catch {
    /* 后台刷新失败不影响用户,忽略 */
  }
}

/** 带重试的 fetch:attempts 次失败后返回 null */
async function fetchWithRetry(request, attempts) {
  for (let i = 0; i < attempts; i++) {
    try {
      const resp = await fetch(request);
      if (resp.ok) return resp;
    } catch {
      /* 网络错误,继续重试 */
    }
    // 指数退避(只在 SW 里安全使用,不阻塞主线程)
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 200 * (i + 1)));
    }
  }
  return null;
}

// ────────────────────────────────────────────────────────────────
// W15.7 — message:PWA 安装后预加载 top 5 engine
// ────────────────────────────────────────────────────────────────

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  // 页面在 appinstalled 事件后发送此消息,触发后台静默预加载
  if (data.type === 'PRELOAD_TOP5_ENGINES') {
    event.waitUntil(preloadTop5Engines());
    return;
  }

  // 手动触发 skipWaiting(用于"有新版本,立即更新"按钮)
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
});

/**
 * 预加载 top 5 engine 模块
 *
 * - 静默执行,不打断用户操作
 * - 失败项仅记录日志,不影响其他项
 * - 已缓存的跳过
 */
async function preloadTop5Engines() {
  const cache = await caches.open(ENGINE_NAME);
  const results = await Promise.allSettled(
    TOP5_ENGINE_URLS.map(async (url) => {
      // 已缓存则跳过
      const cached = await cache.match(url);
      if (cached) return;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`${url} → ${resp.status}`);
      await cache.put(url, resp.clone());
      // 通知所有 client 进度(可选)
      await notifyClients({ type: 'ENGINE_PRELOADED', url });
    })
  );
  const failed = results
    .map((r, i) => (r.status === 'rejected' ? TOP5_ENGINE_URLS[i] : null))
    .filter(Boolean);
  if (failed.length > 0) {
    console.warn('[sw] top5 preload partial failure:', failed);
  }
  await notifyClients({ type: 'TOP5_PRELOAD_DONE', failed });
}

/** 向所有受控 client 广播消息 */
async function notifyClients(message) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  for (const c of clients) {
    c.postMessage(message);
  }
}
