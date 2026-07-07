---
title: SDK
description: '@lokvis/sdk 是将 Lokvis Runtime 嵌入任意 Web 应用最便捷的方式。'
draft: false
head: []
---

# Lokvis SDK

`@lokvis/sdk` 是将 Lokvis Runtime 嵌入任意 Web 应用最便捷的方式。它处理插件加载,并在 Runtime API 之上提供一层简洁的外观(façade)。

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

| 选项 | 类型 | 默认值 | 说明 |
|--------|------|---------|-------------|
| `enableOpfs` | `boolean` | `true` | 启用 OPFS 存储(最优,支持 `FileSystemSyncAccessHandle`) |
| `enableIndexedDB` | `boolean` | `true` | 启用 IndexedDB 降级存储(Dexie,持久化) |
| `storageQuota` | `number` | — | 存储配额(字节),超限抛 `QuotaExceededError` |
| `plugins` | `Plugin[]` | `[]` | 插件列表(如 `imageToolsPlugin()`) |
| `auth?` | `object` | — | Cloud 注入的 session/token(对接 Pro 功能,open 仓库不依赖) |
| `historyLimit?` | `number` | `10` | 历史栈上限(默认 10 步 LRU) |
| `memoryBudget?` | `number` | `DEFAULT_MEMORY_BUDGET` | MemoryGuard 内存预算(字节) |

## Runtime API

### 资产管理

| 方法 | 返回值 | 说明 |
|--------|---------|-------------|
| `importAsset(source)` | `Promise<AssetId>` | 导入资产(File / Blob / URL / base64) |
| `getAsset(id)` | `Promise<Asset>` | 获取资产元数据 |
| `getAssetBlob(id)` | `Promise<Blob>` | 获取资产 Blob(从 OPFS/IDB 读回) |
| `exportAsset(id, format?)` | `Promise<Blob>` | 导出资产(可选格式转换) |
| `removeAsset(id)` | `Promise<void>` | 删除资产(释放配额) |
| `listAssets()` | `Promise<Asset[]>` | 列出所有资产 |

### 工作流执行

| 方法 | 返回值 | 说明 |
|--------|---------|-------------|
| `run(workflow, inputs)` | `Promise<WorkflowResult>` | 执行工作流(5 步上限,线性) |
| `cancel(workflowId)` | `void` | 取消执行(AbortSignal 贯穿到 Worker) |
| `undo()` | `Promise<AssetId \| null>` | 撤销上一步(游标回退) |
| `redo()` | `Promise<AssetId \| null>` | 重做(游标前进) |

### 能力与元数据

| 方法 | 返回值 | 说明 |
|--------|---------|-------------|
| `capabilities()` | `Promise<Capability[]>` | 列出已注册能力 |
| `listCapabilities()` | `Promise<Capability[]>` | 同上(alias) |
| `readAssetMetadata(id)` | `Promise<ExifData>` | 读 EXIF 元数据(plugin-image 提供) |
| `toMcpManifest(options?)` | `McpManifest` | 生成 MCP server manifest |
| `eventBus` | `EventBus` | 事件总线(订阅 / 发布) |

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

`@lokvis/runtime` 提供 `WorkflowBuilder` 链式 API 构造 workflow:

```typescript
import { WorkflowBuilder } from '@lokvis/runtime';

const workflow = new WorkflowBuilder({ name: 'Web Optimize', category: 'web' })
  .setInput({ type: 'image/*' })
  .add('image.resize', { width: 1920, height: 1080, fit: 'inside' })
  .add('image.compress', { quality: 80 })
  .add('image.convert', { format: 'webp' })
  .setOutput({ type: 'image/webp', label: 'optimized' })
  .build(); // 校验 + 输出 Workflow 对象

// 链式操作
builder.move('n1', 'n2');      // 移动节点
builder.swap('n1', 'n2');      // 交换
builder.updateParams('n1', { width: 1280 });
builder.remove('n1');           // 删除(自动重连边)
```

5 步上限超出时抛 `WorkflowValidationError`。

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

所有 SDK 错误都继承自 `LokvisError`,带有稳定的 `code` 字段以便程序化分支。
使用 `fromLokvisError()` 归一化任意捕获到的值:

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

| 错误码 | 说明 | 触发场景 |
|------|-------------|---------|
| `ASSET_NOT_FOUND` | 资产不存在 | `getAsset(id)` / `exportAsset(id)` 找不到 |
| `WORKFLOW_INVALID` | workflow JSON 校验失败 | `run()` 前校验空节点 / 输入输出 / capability 兼容性 |
| `WORKFLOW_CYCLE` | 工作流存在环(Phase 1 线性,不应触发) | `validateWorkflow()` |
| `CAPABILITY_NOT_REGISTERED` | 能力未注册 | 未加载对应 plugin |
| `CAPABILITY_STUB_ONLY` | 仅有 stub 实现 | 视频/PDF/Audio 引擎未接入(Phase 2) |
| `STORAGE_QUOTA_EXCEEDED` | 存储配额超限 | OPFS/IDB 满,`run()` 前 `checkStorageQuota()` |
| `WORKER_CRASHED` | Worker 崩溃且重启失败 | 心跳超时 + 重启达 `maxRestarts`(默认 3) |
| `WORKER_TIMEOUT` | Worker 请求超时 | 单请求超 60s(默认) |
| `DEGRADATION_REJECTED` | 内存 critical 且不可降级 | L4 拒绝,携带 `guide` 用户建议 |
| `PLUGIN_LOAD_FAILED` | 插件加载失败 | plugin install 抛错 |
| `BATCH_LIMIT_EXCEEDED` | 批量超免费上限 | 10 项免费 / Pro 无限 |
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
