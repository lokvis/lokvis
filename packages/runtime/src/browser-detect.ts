/**
 * 浏览器能力检测(W22.3)
 *
 * 提供 Safari / Firefox 等浏览器的特性降级路径所需的能力探测:
 * - 存储类:OPFS / IndexedDB / navigator.storage.estimate
 * - 编解码类:WebCodecs(ImageDecoder/VideoDecoder/AudioDecoder/VideoEncoder) /
 *   OffscreenCanvas / createImageBitmap
 * - 并发类:SharedArrayBuffer / crossOriginIsolated(WASM 线程所需)
 * - 其他:WebWorker / ServiceWorker / WebAssembly
 *
 * 设计原则:
 * 1. 优先 feature detection(typeof X !== 'undefined' / 'function'),
 *    不依赖 UA 嗅探(UA 易伪装且不未来兼容)
 * 2. UA 嗅探仅作辅助,用于已知 Safari/ Firefox 版本的特定 workaround
 * 3. 所有检测在 SSR(Node)环境下安全返回 false / unknown
 * 4. 探测结果可被 Runtime 初始化 + Playground UI 复用
 *
 * 现有降级链(已在其他模块实现,本模块仅提供能力探测供调用方决策):
 * - AssetStore:OPFS → IndexedDB → Memory(createAssetStore 工厂,W2.8)
 * - engine-image:纯 Canvas 2D API(无 WebCodecs 需要降级)
 * - canvas-engine.decodeResized:Safari 16.4+ 支持 createImageBitmap resize
 *   选项,不支持时回退到普通 decode + drawImage(已实现)
 */

import { isOpfsSupported } from './opfs-asset-store.js';
import { isIdbSupported } from './idb-asset-store.js';

/** 浏览器能力检测结果 */
export interface BrowserCapabilities {
  /** OPFS(Origin Private File System)——大文件持久化存储 */
  opfs: boolean;
  /** IndexedDB——元数据 + blob 持久化(OPFS 不可用时的降级) */
  indexedDB: boolean;
  /** navigator.storage.estimate——存储配额查询 */
  storageEstimate: boolean;
  /** WebCodecs ImageDecoder——图像解码(未来引擎,当前未实装) */
  webCodecsImageDecoder: boolean;
  /** WebCodecs VideoDecoder——视频解码(Phase 2 engine-video) */
  webCodecsVideoDecoder: boolean;
  /** WebCodecs VideoEncoder——视频编码(Phase 2 engine-video) */
  webCodecsVideoEncoder: boolean;
  /** WebCodecs AudioDecoder——音频解码(Phase 2 engine-audio) */
  webCodecsAudioDecoder: boolean;
  /** OffscreenCanvas——离屏 canvas 渲染(engine-image 编解码核心依赖) */
  offscreenCanvas: boolean;
  /** createImageBitmap——图像位图创建(engine-image 解码核心依赖) */
  createImageBitmap: boolean;
  /** SharedArrayBuffer——WASM 多线程(ffmpeg.wasm 等 Phase 2 引擎) */
  sharedArrayBuffer: boolean;
  /** crossOriginIsolated——WASM 线程所需的安全上下文 */
  crossOriginIsolated: boolean;
  /** WebAssembly——WASM 引擎基础依赖 */
  webAssembly: boolean;
  /** WebWorker——Worker 内执行引擎(runtime worker-host) */
  webWorker: boolean;
  /** ServiceWorker——PWA 离线缓存 */
  serviceWorker: boolean;
}

/** 浏览器 UA 识别结果(辅助用,优先用 BrowserCapabilities) */
export interface BrowserInfo {
  /** 浏览器名(基于 UA 嗅探,可能不准确) */
  name: 'safari' | 'firefox' | 'chrome' | 'edge' | 'unknown';
  /** 浏览器主版本号(基于 UA 嗅探,可能不准确) */
  version: number;
  /** 是否为 Safari(iOS Safari / macOS Safari) */
  isSafari: boolean;
  /** 是否为 Firefox */
  isFirefox: boolean;
  /** 是否为 Chrome(含 Chromium 内核,Edge 单独识别) */
  isChrome: boolean;
  /** 是否为 Microsoft Edge(Chromium 内核) */
  isEdge: boolean;
  /** 是否为移动端 */
  isMobile: boolean;
}

/** 缓存能力探测结果(同一会话内不变,避免重复检测) */
let cachedCapabilities: BrowserCapabilities | undefined;
/** 缓存 UA 识别结果(同一会话内不变) */
let cachedBrowserInfo: BrowserInfo | undefined;

/**
 * 探测当前环境(浏览器/Node)的能力。
 *
 * 在 SSR(Node)环境下,所有浏览器 API 检测返回 false。
 *
 * 结果在首次调用后缓存,同一会话内重复调用返回同一对象。
 * 如需强制重新探测(测试场景),传 { force: true }。
 */
export function detectBrowserCapabilities(
  options: { force?: boolean } = {}
): BrowserCapabilities {
  if (cachedCapabilities && !options.force) return cachedCapabilities;
  const g = globalThis as Record<string, unknown>;
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  cachedCapabilities = {
    opfs: isOpfsSupported(),
    indexedDB: isIdbSupported(),
    storageEstimate:
      !!nav && typeof nav.storage?.estimate === 'function',
    webCodecsImageDecoder: typeof g.ImageDecoder !== 'undefined',
    webCodecsVideoDecoder: typeof g.VideoDecoder !== 'undefined',
    webCodecsVideoEncoder: typeof g.VideoEncoder !== 'undefined',
    webCodecsAudioDecoder: typeof g.AudioDecoder !== 'undefined',
    offscreenCanvas: typeof g.OffscreenCanvas !== 'undefined',
    createImageBitmap: typeof g.createImageBitmap === 'function',
    sharedArrayBuffer: typeof g.SharedArrayBuffer !== 'undefined',
    crossOriginIsolated:
      typeof g.crossOriginIsolated === 'boolean' ? g.crossOriginIsolated : false,
    webAssembly: typeof g.WebAssembly !== 'undefined',
    webWorker: typeof g.Worker !== 'undefined',
    serviceWorker: !!nav && typeof nav.serviceWorker !== 'undefined',
  };
  return cachedCapabilities;
}

/** UA 嗅探正则(仅作辅助,优先用 detectBrowserCapabilities) */
const SAFARI_REGEX = /Version\/(\d+)\.\d+.*Safari\/[\d.]+/;
const FIREFOX_REGEX = /Firefox\/(\d+)\.\d+/;
const EDGE_REGEX = /Edg\/(\d+)\.\d+/;
const CHROME_REGEX = /Chrome\/(\d+)\.\d+/;
const MOBILE_REGEX = /Mobi|Android|iPhone|iPad|iPod/i;

/**
 * 识别当前浏览器(基于 UA 嗅探)。
 *
 * 注意:UA 嗅探不可靠,浏览器可伪装 UA。优先用 detectBrowserCapabilities()
 * 检测实际能力。本函数仅用于已知浏览器的特定 workaround(如 Safari 的
 * createImageBitmap resize 选项兼容性)。
 *
 * 结果在首次调用后缓存,同一会话内重复调用返回同一对象。
 * 如需强制重新识别(测试场景),传 { force: true }。
 */
export function detectBrowserInfo(
  options: { force?: boolean } = {}
): BrowserInfo {
  if (cachedBrowserInfo && !options.force) return cachedBrowserInfo;
  if (typeof navigator === 'undefined') {
    cachedBrowserInfo = {
      name: 'unknown', version: 0,
      isSafari: false, isFirefox: false, isChrome: false, isEdge: false,
      isMobile: false,
    };
    return cachedBrowserInfo;
  }
  const ua = navigator.userAgent;
  // Edge 必须先检测(含 Chrome 字样)
  const edgeMatch = ua.match(EDGE_REGEX);
  if (edgeMatch && edgeMatch[1]) {
    cachedBrowserInfo = {
      name: 'edge', version: parseInt(edgeMatch[1], 10),
      isSafari: false, isFirefox: false, isChrome: false, isEdge: true,
      isMobile: MOBILE_REGEX.test(ua),
    };
    return cachedBrowserInfo;
  }
  // Safari 必须在 Chrome 之前检测(排除 Chrome:Chrome UA 含 Chrome/ 但不含 Version/X Safari/X)
  const safariMatch = ua.match(SAFARI_REGEX);
  if (safariMatch && safariMatch[1] && !ua.includes('Chrome/')) {
    cachedBrowserInfo = {
      name: 'safari', version: parseInt(safariMatch[1], 10),
      isSafari: true, isFirefox: false, isChrome: false, isEdge: false,
      isMobile: MOBILE_REGEX.test(ua),
    };
    return cachedBrowserInfo;
  }
  const firefoxMatch = ua.match(FIREFOX_REGEX);
  if (firefoxMatch && firefoxMatch[1]) {
    cachedBrowserInfo = {
      name: 'firefox', version: parseInt(firefoxMatch[1], 10),
      isSafari: false, isFirefox: true, isChrome: false, isEdge: false,
      isMobile: MOBILE_REGEX.test(ua),
    };
    return cachedBrowserInfo;
  }
  const chromeMatch = ua.match(CHROME_REGEX);
  if (chromeMatch && chromeMatch[1]) {
    cachedBrowserInfo = {
      name: 'chrome', version: parseInt(chromeMatch[1], 10),
      isSafari: false, isFirefox: false, isChrome: true, isEdge: false,
      isMobile: MOBILE_REGEX.test(ua),
    };
    return cachedBrowserInfo;
  }
  cachedBrowserInfo = {
    name: 'unknown', version: 0,
    isSafari: false, isFirefox: false, isChrome: false, isEdge: false,
    isMobile: MOBILE_REGEX.test(ua),
  };
  return cachedBrowserInfo;
}

/**
 * 判断当前浏览器是否为 Safari(基于 UA 嗅探)。
 *
 * 用于已知 Safari 版本的特定 workaround,如:
 * - Safari 16.4 以下不支持 createImageBitmap resize 选项
 * - Safari 的 OffscreenCanvas 在 Worker 中行为不一致
 *
 * 优先用 detectBrowserCapabilities().offscreenCanvas 等能力检测。
 */
export function isSafari(): boolean {
  return detectBrowserInfo().isSafari;
}

/**
 * 判断当前浏览器是否为 Firefox(基于 UA 嗅探)。
 *
 * 用于 Firefox 特定 workaround(如某些 CSS / API 差异)。
 * 优先用 detectBrowserCapabilities() 检测实际能力。
 */
export function isFirefox(): boolean {
  return detectBrowserInfo().isFirefox;
}

/** 测试专用:重置缓存(确保下次 detectBrowserXxx 重新探测) */
export function _resetBrowserDetectCache(): void {
  cachedCapabilities = undefined;
  cachedBrowserInfo = undefined;
}
