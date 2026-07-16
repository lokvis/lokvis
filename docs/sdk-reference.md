# SDK 与 CLI 参考

> `@lokvis/sdk` 是将 Lokvis Runtime 嵌入任何 Web 应用的最简方式。
> `@lokvis/cli` 提供终端访问。

---

## @lokvis/sdk

### createLokvis

```typescript
import { createLokvis } from '@lokvis/sdk';
import imageToolsPlugin from '@lokvis/plugin-image';

const lokvis = await createLokvis({
  enableOpfs: true,
  enableIndexedDB: true,
  storageQuota: 1024 * 1024 * 1024, // 1GB
  plugins: [imageToolsPlugin()],
});
```

#### 配置参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enableOpfs` | boolean | `true` | 启用 OPFS 存储 |
| `enableIndexedDB` | boolean | `true` | 启用 IndexedDB 降级存储 |
| `storageQuota` | number | — | 存储配额（字节） |
| `plugins` | Plugin[] | `[]` | 插件列表 |
| `auth?` | object | — | Cloud 注入的 session/token（对接 Pro 功能） |

### Runtime API

> 类型来源：[`LokvisRuntime` 接口](../packages/runtime/src/types.ts)。下表与接口逐项对齐。
> 注：`getAssetBlob` 仅在 [PluginContext](plugins.md#plugincontext-api) 内可用（plugin 内部读取资产 Blob），公共 Runtime 不暴露——消费方应使用 `exportAsset(id, format?)` 获取 Blob。

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `version` | `string`（readonly 属性） | Runtime 版本 |
| `status` | `RuntimeStatus`（readonly 属性） | 当前状态 |
| `eventBus` | `EventBus`（readonly 属性） | 事件总线（订阅/发布） |
| `isPro` | `boolean`（readonly 属性） | 是否为 Pro 模式（影响批量上限/并发槽位/workflow 数，W6.2） |
| `batch` | `BatchProcessor`（readonly 属性） | 批量处理器（W6.1：并发控制 + 进度 + 失败重试） |
| `importAsset(source)` | `Promise<AssetId>` | 导入资产 |
| `getAsset(id)` | `Promise<Asset>` | 获取资产元数据 |
| `exportAsset(id, format?)` | `Promise<Blob>` | 导出资产为 Blob |
| `removeAsset(id)` | `Promise<void>` | 删除资产（释放配额） |
| `listAssets()` | `Promise<Asset[]>` | 列出所有资产 |
| `readAssetExif(id)` | `Promise<ExifData \| null>` | 读取 image 资产的 EXIF 元数据（非 image / 无 EXIF / reader 未注册返回 null） |
| `run(workflow, inputs, options?)` | `Promise<WorkflowResult>` | 执行工作流（可选 RunOptions：`appendHistory`） |
| `cancel(workflowId)` | `Promise<void>` | 取消执行 |
| `pause(workflowId)` | `Promise<void>` | 暂停执行 |
| `resume(workflowId)` | `Promise<void>` | 恢复执行 |
| `getCurrentOutputs(workflowId)` | `Promise<AssetId[]>` | 获取工作流当前输出 AssetId（undo/redo 后的"当前"状态） |
| `disposeWorkflow(workflowId)` | `Promise<void>` | 销毁工作流运行时状态（取消运行 + 清空历史栈 + 回收历史 outputs 资产） |
| `history(workflowId)` | `Promise<HistoryEntry[]>` | 获取工作流执行历史 |
| `getHistoryState(workflowId)` | `Promise<{ entries: HistoryEntry[]; cursor: number }>` | 获取历史状态（cursor -1 表示无已应用条目） |
| `undo(workflowId)` | `Promise<void>` | 撤销一步 |
| `redo(workflowId)` | `Promise<void>` | 重做一步 |
| `jumpTo(workflowId, index)` | `Promise<void>` | 跳转到指定历史条目（按时间顺序的索引，-1 回到初始；越界或游标未变为 no-op） |
| `capabilities()` | `Promise<Capability[]>` | 列出已注册能力 |
| `hasCapability(name)` | `Promise<boolean>` | 检查能力是否可用 |
| `isStubOnly(name)` | `Promise<boolean>` | 检查能力是否仅有 stub 实现（UI 据此显示 "Coming Soon"） |
| `getStorageUsage()` | `Promise<{ usage: number; quota: number }>` | 获取存储用量（已用 / 配额，字节） |
| `toMcpManifest(options?)` | `McpManifest`（同步） | 生成 MCP server manifest（`options.batchMode` 控制 batch-only 能力是否暴露；private 永不暴露） |
| `installPlugin(plugin)` | `Promise<void>` | 安装插件（注册能力 → 构造 PluginContext → 调用 plugin.install → 发射 `plugin:loaded` 事件；失败抛 PluginLoadError） |

### loadPlugin

动态加载插件到已创建的 Runtime：

```typescript
import { loadPlugin } from '@lokvis/sdk';
import devToolsPlugin from '@lokvis/plugin-dev';

await loadPlugin(lokvis, devToolsPlugin());
```

### Pro 功能门控

```typescript
// runtime.isPro 标志影响：
// - 批量处理上限（免费 10 / Pro 无限）
// - 工作流槽位（免费 5 / Pro 无限）
// - 自定义预设数（免费 3 / Pro 无限）
// - 高级格式（AVIF/JXL）
```

### MCP Manifest API

```typescript
const manifest = lokvis.toMcpManifest();

console.log(manifest.tools);
// [
//   {
//     name: 'lokvis_image_resize',
//     description: '...',
//     inputSchema: { ... },
//     capabilities: ['image.resize']
//   },
//   ...
// ]

console.log(manifest.resources);
// [
//   { uri: 'lokvis://capabilities', name: 'Capabilities', ... },
//   { uri: 'lokvis://workflows', name: 'Workflows', ... }
// ]
```

用途：
1. MCP server 注册 tools 前的能力探测
2. Dashboard 展示"可被 AI 调用的能力"
3. 文档站自动生成 tool 列表

### 错误体系

所有错误类均继承自 `LokvisError`，并暴露稳定的 `code` 字段（如 `'ASSET_NOT_FOUND'`、`'STORAGE_QUOTA_EXCEEDED'`）。

```typescript
import {
  LokvisError,
  AssetNotFoundError,
  AssetBlobNotFoundError,
  AssetImportError,
  AssetExportError,
  WorkflowInvalidError,
  WorkflowCycleError,
  WorkflowNodeError,
  CapabilityNotRegisteredError,
  CapabilityStubOnlyError,
  StorageQuotaExceededError,
  StorageOpfsUnavailableError,
  StorageIdbUnavailableError,
  WorkerCrashedError,
  WorkerTimeoutError,
  WorkerDeadError,
  WorkerRequestAbortedError,
  WorkerHandshakeError,
  DegradationRejectedError,
  PluginLoadError,
} from '@lokvis/sdk';
```

| 错误类 | code | 触发场景 |
|-------|------|----------|
| `LokvisError` | — | 基类，所有 SDK 错误的根 |
| `AssetNotFoundError` | `ASSET_NOT_FOUND` | 资产 ID 不存在 |
| `AssetBlobNotFoundError` | `ASSET_BLOB_NOT_FOUND` | 资产 Blob 数据缺失（OPFS/IDB 数据丢失，需重新导入） |
| `AssetImportError` | `ASSET_IMPORT_FAILED` | 资产导入失败（格式不支持 / IO 错误） |
| `AssetExportError` | `ASSET_EXPORT_FAILED` | 资产导出失败（格式不支持 / 编码错误） |
| `WorkflowInvalidError` | `WORKFLOW_INVALID` | workflow JSON 校验失败（形状 / 保留字 / 节点 id） |
| `WorkflowCycleError` | `WORKFLOW_CYCLE` | workflow 含环 |
| `WorkflowNodeError` | `WORKFLOW_NODE_ERROR` | 工作流节点执行失败（携带 nodeId / capability） |
| `CapabilityNotRegisteredError` | `CAPABILITY_NOT_REGISTERED` | 能力未注册（无对应 plugin） |
| `CapabilityStubOnlyError` | `CAPABILITY_STUB_ONLY` | 能力仅有 stub 实现（需安装真实 engine plugin） |
| `StorageQuotaExceededError` | `STORAGE_QUOTA_EXCEEDED` | 存储配额超限（携带 usage / quota） |
| `StorageOpfsUnavailableError` | `STORAGE_OPFS_UNAVAILABLE` | OPFS 不可用（降级到 IndexedDB） |
| `StorageIdbUnavailableError` | `STORAGE_IDB_UNAVAILABLE` | IndexedDB 不可用（降级到内存） |
| `WorkerCrashedError` | `WORKER_CRASHED` | Worker 崩溃且重启失败 |
| `WorkerTimeoutError` | `WORKER_TIMEOUT` | Worker 请求超时 |
| `WorkerDeadError` | `WORKER_DEAD` | Worker 进入 dead 状态（超过 maxRestarts） |
| `WorkerRequestAbortedError` | `WORKER_REQUEST_ABORTED` | Worker 请求被取消（AbortController） |
| `WorkerHandshakeError` | `WORKER_HANDSHAKE_FAILED` | Worker 握手失败（协议版本不匹配） |
| `DegradationRejectedError` | `DEGRADATION_REJECTED` | 降级被拒绝（携带引导提示） |
| `PluginLoadError` | `PLUGIN_LOAD_FAILED` | 插件加载失败（携带 pluginName） |

> **错误转换**：runtime 抛出的内部错误经 `fromLokvisError()` 转换为 SDK 错误类。消费方应优先用 `instanceof XxxError` 或 `err.code === 'XXX'` 判断，而非 message 字符串匹配。

---

## @lokvis/ui-react

Workspace UI 组件：

```tsx
import { Workspace } from '@lokvis/ui-react';
import imageToolsPlugin from '@lokvis/plugin-image';

function App() {
  return (
    <Workspace
      title="My Image Tools"
      plugins={[imageToolsPlugin()]}
    />
  );
}
```

---

## @lokvis/cli

### 安装

```bash
pnpm add -g @lokvis/cli
```

### 命令

#### `lokvis run`

```bash
lokvis run ./my-workflow.json ./input.png
```

加载 workflow JSON 并在输入文件上执行。

> 注意：依赖浏览器 API（Canvas、createImageBitmap）的能力无法在 Node.js 中运行，请使用 Web 应用。

#### `lokvis capabilities`

```bash
lokvis capabilities
```

列出所有已注册的 capability 声明。

#### `lokvis plugin create`

```bash
lokvis plugin create my-plugin
```

脚手架创建新插件包。

#### `lokvis version` / `lokvis help`

```bash
lokvis version
lokvis help
```

---

*本文档整合自 `apps/docs/src/content/docs/sdk.md`、`cli.md` 与 AI 调整方案 §6。*
