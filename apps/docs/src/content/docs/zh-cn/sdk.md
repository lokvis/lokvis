---
title: SDK
description: '@lokvis/sdk 是在任何 Web 应用中嵌入 Lokvis Runtime 的最简单方式。'
draft: false
head: []
---

# Lokvis SDK

`@lokvis/sdk` 是在任何 Web 应用中嵌入 Lokvis Runtime 的最简单方式。它负责插件加载,并在 Runtime API 之上提供简洁的外门面(façade)。

## createLokvis

```typescript
import { createLokvis } from '@lokvis/sdk';
import { imageToolsPlugin } from '@lokvis/plugin-image';

const lokvis = await createLokvis({
  enableOpfs: true,
  enableIndexedDB: true,
  storageQuota: 1024 * 1024 * 1024, // 1GB
  plugins: [imageToolsPlugin()],
});
```

### 配置

| 选项 | 类型 | 默认值 | 描述 |
|--------|------|---------|-------------|
| `enableOpfs` | `boolean` | `true` | 启用 OPFS 存储(最优,支持 `FileSystemSyncAccessHandle`) |
| `enableIndexedDB` | `boolean` | `true` | 启用 IndexedDB 降级存储(Dexie,持久化) |
| `storageQuota` | `number` | — | 存储配额(字节),超限抛 `QuotaExceededError` |
| `plugins` | `Plugin[]` | `[]` | 插件列表(如 `imageToolsPlugin()`) |
| `auth?` | `object` | — | Cloud 注入的 session/token(对接 Pro 功能,open 仓库不依赖) |
| `historyLimit?` | `number` | `10` | 历史栈上限(默认 10 步 LRU) |
| `memoryBudget?` | `number` | `DEFAULT_MEMORY_BUDGET` | MemoryGuard 内存预算(字节) |

## Runtime API

> 类型来源:[`LokvisRuntime` 接口](https://github.com/lokvis/lokvis/blob/main/packages/runtime/src/types.ts)。下表与接口逐项对齐。
> 注:`getAssetBlob` 仅在 [PluginContext](plugins.md#plugin-context-api) 内可用(plugin 内部读取资产 Blob),公共 Runtime 不暴露——消费方应使用 `exportAsset(id, format?)` 获取 Blob。

| 方法 | 返回值 | 描述 |
|--------|---------|-------------|
| `version` | `string`(readonly 属性) | Runtime 版本 |
| `status` | `RuntimeStatus`(readonly 属性) | 当前状态 |
| `eventBus` | `EventBus`(readonly 属性) | 事件总线(订阅/发布) |
| `isPro` | `boolean`(readonly 属性) | 是否为 Pro 模式(影响批量上限/并发槽位/workflow 数) |
| `batch` | `BatchProcessor`(readonly 属性) | 批量处理器(并发控制 + 进度 + 失败重试) |
| `importAsset(source)` | `Promise<AssetId>` | 导入资产(File / Blob / URL / base64) |
| `getAsset(id)` | `Promise<Asset>` | 获取资产元数据 |
| `exportAsset(id, format?)` | `Promise<Blob>` | 导出资产(可选格式转换) |
| `removeAsset(id)` | `Promise<void>` | 删除资产(释放配额) |
| `listAssets()` | `Promise<Asset[]>` | 列出所有资产 |
| `readAssetExif(id)` | `Promise<ExifData \| null>` | 读取 image 资产的 EXIF 元数据(非 image / 无 EXIF / reader 未注册返回 null) |
| `run(workflow, inputs, options?)` | `Promise<WorkflowResult>` | 执行工作流(可选 RunOptions:`appendHistory`) |
| `cancel(workflowId)` | `Promise<void>` | 取消执行(AbortSignal 贯穿到 Worker) |
| `pause(workflowId)` | `Promise<void>` | 暂停执行 |
| `resume(workflowId)` | `Promise<void>` | 恢复执行 |
| `getCurrentOutputs(workflowId)` | `Promise<AssetId[]>` | 获取工作流当前输出 AssetId(undo/redo 后的"当前"状态) |
| `disposeWorkflow(workflowId)` | `Promise<void>` | 销毁工作流运行时状态(取消运行 + 清空历史栈 + 回收历史 outputs 资产) |
| `history(workflowId)` | `Promise<HistoryEntry[]>` | 获取工作流执行历史 |
| `getHistoryState(workflowId)` | `Promise<{ entries: HistoryEntry[]; cursor: number }>` | 获取历史状态(cursor -1 表示无已应用条目) |
| `undo(workflowId)` | `Promise<void>` | 撤销一步 |
| `redo(workflowId)` | `Promise<void>` | 重做一步 |
| `jumpTo(workflowId, index)` | `Promise<void>` | 跳转到指定历史条目(按时间顺序的索引,-1 回到初始;越界或游标未变为 no-op) |
| `capabilities()` | `Promise<Capability[]>` | 列出已注册能力 |
| `hasCapability(name)` | `Promise<boolean>` | 检查能力是否可用 |
| `isStubOnly(name)` | `Promise<boolean>` | 检查能力是否仅有 stub 实现(UI 据此显示 "Coming Soon") |
| `getStorageUsage()` | `Promise<{ usage: number; quota: number }>` | 获取存储用量(已用 / 配额,字节) |
| `toMcpManifest(options?)` | `McpManifest`(同步) | 生成 MCP server manifest(`options.batchMode` 控制 batch-only 能力是否暴露;private 永不暴露) |
| `installPlugin(plugin)` | `Promise<void>` | 安装插件(注册能力 → 构造 PluginContext → 调用 plugin.install → 发射 `plugin:loaded` 事件;失败抛 PluginLoadError) |

### 事件总线

```typescript
lokvis.eventBus.on('asset:imported', (e) => console.log('Imported:', e.assetId));
lokvis.eventBus.on('workflow:started', (e) => console.log('Started:', e.workflowId));
lokvis.eventBus.on('workflow:completed', (e) => console.log('Done:', e.elapsedMs));
lokvis.eventBus.on('history:changed', (e) => console.log('History:', e.action));
lokvis.eventBus.on('memory:pressure', (e) => console.log('Pressure:', e.level));

// 一次性
lokvis.eventBus.once('workflow:completed', handler);

// 取消
const off = lokvis.eventBus.on('asset:imported', handler);
off();
```

## loadPlugin

动态加载插件到已创建的 Runtime:

```typescript
import { loadPlugin } from '@lokvis/sdk';
import { devToolsPlugin } from '@lokvis/plugin-dev';

await loadPlugin(lokvis, devToolsPlugin());
```

## WorkflowBuilder

`@lokvis/workflow` 提供 `WorkflowBuilder` 链式 API 构造 workflow:

```typescript
import { WorkflowBuilder } from '@lokvis/workflow';

const workflow = new WorkflowBuilder({ id: 'wf_001', name: 'Web 优化' })
  .setInput({ type: 'image', multiple: true })
  .setOutput({ type: 'image', format: 'webp' })
  .add('image.resize', { width: 1920, height: 1080, fit: 'inside' })
  .add('image.compress', { quality: 80 })
  .add('image.convert', { format: 'webp' })
  .build(); // 校验 + 输出 Workflow 对象

// 链式操作（构造中可调整）
builder.move(0, 2);                       // 移动节点（按索引）
builder.swap(0, 1);                       // 交换（按索引）
builder.updateParams('wf_001-node-1', { width: 1280 });
builder.remove('image.convert');          // 删除（自动重连边）
```

构造参数 `WorkflowBuilderOptions` 必填 `id` + `name`，`setInput` / `setOutput` 必填，`build()` 在未设置时抛错。

5 步上限（`MAX_WORKFLOW_STEPS`）超出时 `add()` 立即抛 `Error`。

## Pro 功能门控

```typescript
// runtime.isPro 标志影响:
// - 批量处理上限(免费 10 / Pro 无限)
// - 工作流槽位(免费 5 / Pro 无限)
// - 自定义预设数(免费 3 / Pro 无限)
// - 高级格式(AVIF/JXL,Phase 2)
```

Pro 标志由 Cloud 注入(`auth.session`),open 仓库始终为免费模式。

## MCP Manifest API

```typescript
const manifest = lokvis.toMcpManifest({
  includeStubCapabilities: false, // 默认排除 stub 能力
});

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

用途:
1. MCP server 注册 tools 前的能力探测
2. Dashboard 展示"可被 AI 调用的能力"
3. 文档站自动生成 tool 列表

## 错误处理

所有 SDK 错误都继承自 `LokvisError`,带有稳定的 `code` 字段供程序化分支使用。使用 `fromLokvisError()` 归一化任何捕获到的值:

```typescript
import {
  DegradationRejectedError,
  fromLokvisError,
} from '@lokvis/sdk';

try {
  await lokvis.run(workflow, [assetId]);
} catch (e) {
  // fromLokvisError() 总是返回 LokvisError(包括把非 lokvis 值归一为
  // code: 'UNKNOWN'),所以这里不再需要 instanceof LokvisError 守卫。
  const err = fromLokvisError(e);
  switch (err.code) {
    case 'STORAGE_QUOTA_EXCEEDED':
      alert('Storage full — clean up assets');
      break;
    case 'DEGRADATION_REJECTED':
      // guide 字段只存在于 DegradationRejectedError 上,需用 instanceof 窄化类型。
      if (err instanceof DegradationRejectedError) {
        // err.guide: user-readable suggestions
        console.warn(err.guide);
      }
      break;
    case 'CAPABILITY_NOT_REGISTERED':
      console.warn('Install the plugin for:', err.context?.capability);
      break;
    case 'UNKNOWN':
      // 归一后仍无法识别的错误:按需上抛或上报
      throw e;
    default:
      console.error(err.code, err.message);
  }
}
```

### 错误码

| Code | 描述 | 触发条件 |
|------|-------------|---------|
| `ASSET_NOT_FOUND` | 资产 ID 不存在 | `getAsset(id)` / `exportAsset(id)` 找不到 |
| `ASSET_BLOB_NOT_FOUND` | 资产 Blob 数据缺失 | OPFS/IDB 数据丢失,需重新导入 |
| `ASSET_IMPORT_FAILED` | 资产导入失败 | 格式不支持 / IO 错误 |
| `ASSET_EXPORT_FAILED` | 资产导出失败 | 格式不支持 / 编码错误 |
| `WORKFLOW_INVALID` | workflow JSON 校验失败 | `run()` 前校验空节点 / 输入输出 / capability 兼容性 |
| `WORKFLOW_CYCLE` | 工作流存在环(Phase 1 线性,不应触发) | `validateWorkflow()` |
| `WORKFLOW_NODE_ERROR` | 工作流节点执行失败 | 携带 nodeId / capability |
| `CAPABILITY_NOT_REGISTERED` | 能力未注册 | 未加载对应 plugin |
| `CAPABILITY_STUB_ONLY` | 仅有 stub 实现 | 视频/PDF/Audio 引擎未接入(Phase 2) |
| `STORAGE_QUOTA_EXCEEDED` | 存储配额超限 | OPFS/IDB 满,`run()` 前 `checkStorageQuota()` |
| `STORAGE_OPFS_UNAVAILABLE` | OPFS 不可用 | 降级到 IndexedDB |
| `STORAGE_IDB_UNAVAILABLE` | IndexedDB 不可用 | 降级到内存 |
| `WORKER_CRASHED` | Worker 崩溃且重启失败 | 心跳超时 + 重启达 `maxRestarts`(默认 3) |
| `WORKER_TIMEOUT` | Worker 请求超时 | 单请求超 60s(默认) |
| `WORKER_DEAD` | Worker 进入 dead 状态 | 超过 `maxRestarts` |
| `WORKER_REQUEST_ABORTED` | Worker 请求被取消 | AbortController 触发 |
| `WORKER_HANDSHAKE_FAILED` | Worker 握手失败 | 协议版本不匹配 |
| `DEGRADATION_REJECTED` | 内存 critical 且不可降级 | L4 拒绝,携带 `guide` 用户建议 |
| `PLUGIN_LOAD_FAILED` | 插件加载失败 | plugin install 抛错 |
| `UNKNOWN` | 归一后仍无法识别 | 非 lokvis 错误 |

## CLI

`@lokvis/cli` 提供终端访问:

```bash
pnpm add -g @lokvis/cli

lokvis run ./my-workflow.json ./input.png  # 执行 workflow
lokvis capabilities                         # 列出已注册能力
lokvis plugin create my-plugin              # 脚手架创建新插件
lokvis mcp                                  # 启动 MCP server(stdio)
lokvis version
lokvis help
```

> 注意:依赖浏览器 API(Canvas / createImageBitmap)的能力无法在 Node.js 中运行,`lokvis run` 仅适用于不依赖浏览器的 workflow。
