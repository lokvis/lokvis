/**
 * @lokvis/engine-core
 *
 * Engine 层共享的引擎注册表工厂 + Node 端 ffmpeg 共享基建。
 *
 * 背景:engine-audio / engine-video / engine-ai 三个包
 * 各自复制了一份相同的样板:
 *   - `const engines = new Map<...>(...)`
 *   - `registerXxxEngine` / `getXxxEngine` / `listXxxEngines` / `selectBestXxxEngine`
 *
 * 本包抽出 `createEngineRegistry<T>()` 工厂,把上面四段样板合并为一次调用,
 * 各 engine-* 包只需提供 adapter 类型与初始 adapter 列表。
 *
 * FO-11:新增 `node-ffmpeg.ts` 共享 Node 端 ffmpeg 调用逻辑（getFfmpegPath /
 * runFfmpegStdio / runFfmpegConcatMerge / validateTrimRange / mimeTypeForFormat），
 * 消除 engine-video / engine-audio 约 150 行重复代码。
 *
 * 注:engine-pdf 已移除 adapter 模式,改为只暴露 Blob↔Blob 纯函数操作
 *    (见 packages/engine-pdf/src/index.ts)。
 *
 * 设计约束:
 * - 本包不依赖任何具体 engine 包,只依赖 @lokvis/schema 的类型
 * - 不引入 Asset / Workflow 概念(Engine 层只感知 Blob ↔ Blob)
 * - 默认引擎 fallback 行为由调用方通过 `defaultEngine` 显式传入
 *   (各包的默认引擎不同:web-audio / ffmpeg-wasm / transformers-js)
 */

export * from './node-ffmpeg.js';

/**
 * Engine 适配器的最小契约。
 *
 * 各具体 engine 包的 adapter 接口(AudioEngineAdapter / VideoEngineAdapter 等)
 * 都满足此契约,故可作为 `createEngineRegistry<T>` 的类型参数 T 约束。
 */
export interface EngineAdapter {
  /** 引擎名(唯一标识) */
  name: string;
  /** 版本号(stub 实现包含 'stub' 标识,见 AGENTS.md) */
  version: string;
  /** 声明支持的能力名 */
  supportedCapabilities: string[];
  /** 当前环境是否可用(异步探测,如 SharedArrayBuffer / WebCodecs) */
  isSupported(): Promise<boolean>;
  /** 可选的生命周期钩子 */
  initialize?(): Promise<void>;
  dispose?(): Promise<void>;
}

/** 引擎注册表 */
export interface EngineRegistry<T extends EngineAdapter> {
  /** 注册或覆盖一个引擎 */
  register(engine: T): void;
  /** 列出所有已注册引擎 */
  list(): T[];
  /**
   * 按名获取引擎;未传名或未命中时返回 defaultEngine。
   * 与 engine-pdf/audio/video/ai 旧版 `getXxxEngine` 行为一致。
   */
  get(name?: string): T;
  /**
   * 异步选择第一个 `isSupported()` 返回 true 的引擎;
   * 全部不可用时回退到 defaultEngine。
   */
  selectBest(): Promise<T>;
}

/**
 * 创建一个引擎注册表(消除 engine-* 包重复样板)。
 *
 * @param initial 初始注册的引擎列表(通常包含 stub 占位实现)
 * @param defaultEngine 默认引擎(get(name?) 未命中 / selectBest 全部不可用时返回)
 *
 * @example
 * ```ts
 * const registry = createEngineRegistry<AudioEngineAdapter>(
 *   [webAudioEngine],
 *   webAudioEngine
 * );
 * registry.register(thirdPartyEngine);
 * const engine = registry.get('web-audio');
 * const best = await registry.selectBest();
 * ```
 */
export function createEngineRegistry<T extends EngineAdapter>(
  initial: T[],
  defaultEngine: T
): EngineRegistry<T> {
  const engines = new Map<string, T>();
  for (const e of initial) engines.set(e.name, e);

  return {
    register(engine: T): void {
      engines.set(engine.name, engine);
    },
    list(): T[] {
      return Array.from(engines.values());
    },
    get(name?: string): T {
      if (name) {
        const e = engines.get(name);
        if (e) return e;
      }
      return defaultEngine;
    },
    async selectBest(): Promise<T> {
      for (const engine of engines.values()) {
        if (await engine.isSupported()) return engine;
      }
      return defaultEngine;
    },
  };
}
