/**
 * Runtime 类型化错误类(T10:消除 SDK message 模式匹配)
 *
 * 这些错误类供 runtime 各模块在对应场景抛出,替代原先的 `throw new Error(...)`。
 * SDK 的 `fromLokvisError()` 通过 `instanceof` 检测这些类,包装为对应的 SDK
 * 错误类(LokvisError 子类),无需再依赖 message 字符串模式匹配。
 *
 * 命名与 SDK 错误类对应(如 runtime `AssetNotFoundError` → SDK `AssetNotFoundError`),
 * 但 runtime 侧继承 `Error`(不依赖 SDK 的 `LokvisError`),符合五层架构
 * (Runtime 不依赖 SDK)。SDK import 时加 `Runtime` 前缀别名避免命名冲突
 * (与 QuotaExceededError / Worker*Error 等现有模式一致)。
 *
 * super message 与原 `throw new Error(...)` 的 message 完全一致,保证:
 * - 日志/堆栈输出不变
 * - 依赖 message 文案的测试不破
 */

/** 资产未找到(assetStore.get 返回空) */
export class AssetNotFoundError extends Error {
  readonly assetId: string;
  constructor(assetId: string) {
    super(`Asset not found: ${assetId}`);
    this.name = 'AssetNotFoundError';
    this.assetId = assetId;
  }
}

/** 资产 Blob 未找到(getBlob 在 store 中找不到对应 blob) */
export class AssetBlobNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssetBlobNotFoundError';
  }
}

/** 工作流结构校验失败(节点 ID 重复 / edge 引用未知节点 / 自环等) */
export class WorkflowInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowInvalidError';
  }
}

/** 工作流包含环(拓扑排序后 sorted.length !== nodes.length) */
export class WorkflowCycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowCycleError';
  }
}

/** 工作流节点执行失败(transform 节点缺 capability 字段) */
export class WorkflowNodeError extends Error {
  readonly nodeId: string;
  constructor(nodeId: string, message: string) {
    super(message);
    this.name = 'WorkflowNodeError';
    this.nodeId = nodeId;
  }
}

/** 能力未注册(capabilityRegistry.resolve 返回空且非 stub-only) */
export class CapabilityNotRegisteredError extends Error {
  readonly capability: string;
  constructor(capability: string) {
    super(`No implementation registered for capability "${capability}"`);
    this.name = 'CapabilityNotRegisteredError';
    this.capability = capability;
  }
}

/** 能力仅有 stub 实现(需安装真实 engine 插件) */
export class CapabilityStubOnlyError extends Error {
  readonly capability: string;
  constructor(capability: string) {
    super(
      `Capability "${capability}" is not yet available (only stub engine registered). Install a real engine plugin to use this capability.`
    );
    this.name = 'CapabilityStubOnlyError';
    this.capability = capability;
  }
}
