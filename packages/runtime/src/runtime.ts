/**
 * Lokvis Runtime 入口(Facade,W1.7)
 *
 * 本文件仅 re-export runtime-impl.ts 的实现类与工厂,保持外部导入路径
 * (`@lokvis/runtime` / `'../runtime.js'`)不变。实现细节见 runtime-impl.ts。
 *
 * Re-export 列表:
 * - `LokvisRuntimeImpl` — Runtime 实现类(测试 / SDK 通过此名构造)
 * - `createRuntime`     — 异步工厂(按 OPFS → IDB → Memory 降级创建 store)
 * - `RUNTIME_VERSION`   — 版本常量(写入 manifest.version)
 * - `QuotaExceededError` — 配额超限错误类型(SDK / 集成代码从此入口导入)
 */

export {
  LokvisRuntimeImpl,
  createRuntime,
  RUNTIME_VERSION,
} from './runtime-impl.js';

// QuotaExceededError 仅作 re-export,保持 `@lokvis/runtime` 的对外导出路径不变
// (SDK / 测试 / 集成代码均从 runtime 包入口导入该错误类型)
export { QuotaExceededError } from './managers/quota-manager.js';
