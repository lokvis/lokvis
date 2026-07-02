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

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `importAsset(source)` | `Promise<AssetId>` | 导入资产 |
| `getAsset(id)` | `Promise<Asset>` | 获取资产元数据 |
| `exportAsset(id, format?)` | `Promise<Blob>` | 导出资产 |
| `removeAsset(id)` | `Promise<void>` | 删除资产（释放配额） |
| `listAssets()` | `Promise<Asset[]>` | 列出所有资产 |
| `run(workflow, inputs)` | `Promise<WorkflowResult>` | 执行工作流 |
| `cancel(workflowId)` | `void` | 取消执行 |
| `capabilities()` | `Promise<Capability[]>` | 列出已注册能力 |
| `undo()` | `Promise<AssetId \| null>` | 撤销上一步 |
| `redo()` | `Promise<AssetId \| null>` | 重做 |
| `toMcpManifest()` | `McpManifest` | 生成 MCP server manifest |
| `eventBus` | `EventBus` | 事件总线（订阅/发布） |

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

```typescript
import { LokvisError, QuotaExceededError } from '@lokvis/sdk';

// LokvisError — 基类
// QuotaExceededError — 存储配额超限
// CapabilityNotFoundError — 能力未注册
// WorkflowValidationError — workflow JSON 校验失败
// WorkerCrashedError — Worker 崩溃且重启失败
```

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
