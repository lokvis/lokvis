---
title: 编写你的第一个插件
description: 从零构建 @lokvis/blur-image —— 声明一个能力，包装一个 Blob→Blob 引擎操作，用 definePlugin() 注册它，并用 Vitest 进行测试。
draft: false
head: []
---

# 编写你的第一个插件

本指南从零构建一个 `@lokvis/blur-image` 插件。你将声明一个能力，编写一个 Blob→Blob 引擎操作，用 `definePlugin()` + `createBlobCapabilityImpl()` 组装所有内容，加载插件，通过工作流调用它，并添加一个 Vitest 测试。

> **Plugin SDK 处于 Alpha 阶段。** 插件旨在将 Lokvis 嵌入到你自己的 Web 应用中。如果你希望 AI 客户端（Claude / Cursor / ChatGPT）调用你的能力，请改用 [`@lokvis/mcp-server`](../mcp)。

## 1. 项目结构

```
@lokvis/blur-image/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts       # 公开导出
    ├── engine.ts      # Blob→Blob 纯函数（Engine 层）
    └── plugin.ts      # definePlugin + createBlobCapabilityImpl
```

`package.json` 将 `@lokvis/plugin-sdk` 和 `@lokvis/schema` 声明为 peer 依赖：

```json
{
  "name": "@lokvis/blur-image",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts",
  "peerDependencies": {
    "@lokvis/plugin-sdk": "workspace:*",
    "@lokvis/schema": "workspace:*"
  }
}
```

## 2. 声明能力

一个 `Capability` 描述了契约：名称、接受的输入资产类型、产出的输出资产类型，以及参数。每个参数都有一个 `CapabilityParamType` —— 取值为 `number | string | boolean | enum | color | file | array | object` 之一。

```ts
// src/plugin.ts
import type { Capability } from '@lokvis/schema';

const BLUR_CAPABILITY: Capability = {
  name: 'image.blur',
  description: 'Apply a Gaussian-style blur to an image',
  inputTypes: ['image'],
  outputTypes: ['image'],
  params: [
    {
      name: 'radius',
      type: 'number',
      required: false,
      min: 1,
      max: 100,
      default: 4,
      description: 'Blur radius in pixels',
    },
  ],
  performance: 'fast',
  batchable: true,
  mcpExposure: 'public',
};
```

## 3. 编写引擎操作（Blob → Blob）

Engine 层暴露的是**纯 Blob → Blob 函数**，完全 unaware of `Asset`、`Workflow` 或 `Plugin`。按照工作区 `AGENTS.md` 的约定，操作签名必须接受 `Record<string, any>` 作为 params —— 而不是带类型的 interface：

```ts
// src/engine.ts
import { canvasEngine, createCanvas, get2DContext } from '@lokvis/engine-image';
import { throwIfAborted } from '@lokvis/engine-image';

/**
 * 使用 Canvas 滤镜模糊输入图像。
 *
 * AGENTS.md: Blob↔Blob 纯函数。Params 必须为 Record<string, any>，
 * 这样 Capability 层（从 executor 收到的是 Record<string, unknown>）
 * 可以通过单次 `as` 断言直接传递参数 —— 而无需 `as unknown as` 双断言。
 */
export async function blur(
  blob: Blob,
  params: Record<string, any>,
  signal?: AbortSignal
): Promise<Blob> {
  const radius = Number(params.radius ?? 4);
  const { bitmap, width, height } = await canvasEngine.decode(blob);
  throwIfAborted(signal);

  const canvas = createCanvas(width, height);
  const ctx = get2DContext(canvas);
  // OffscreenCanvasRenderingContext2D 与 HTMLCanvasRenderingContext2D 都支持 filter
  // @ts-expect-error filter exists on both 2D context variants
  ctx.filter = `blur(${radius}px)`;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  throwIfAborted(signal);

  return canvasEngine.encode(canvas, 'png', 95);
}
```

### 为什么用 `Record<string, any>` 而不是带类型的 interface

Capability 层（`plugin-image`、`plugin-pdf`、`plugin-video`）从 executor 的 `params` 字段收到的是 `Record<string, unknown>`。TypeScript 不允许在 `interface` 与 `Record<string, unknown>` 之间直接转换。如果引擎函数声明的是 `params: BlurParams`，插件层就需要 `as unknown as BlurParams` 双断言 —— 这被 `AGENTS.md` 明确**禁止**（唯一例外是跨边界的 Worker scope）。

通过在引擎中接受 `Record<string, any>`，并在函数体内执行一次 `as BlurParams`，插件层只需调用 `blur(blob, params, signal)` —— 调用点无需任何断言。

## 4. 用 `definePlugin()` + `createBlobCapabilityImpl()` 组装

`createBlobCapabilityImpl()` 是来自 `@lokvis/plugin-sdk` 的工厂函数，封装了每个 Blob→Blob 能力都共有的 5 步样板代码：

1. 通过 `ctx.runtime.getAssetBlob(asset)` 获取每个输入资产的 Blob
2. 调用引擎 `operation(blob, params, signal)`
3. 从源资产 + 输出 blob 推导输出元数据
4. 通过 `ctx.runtime.createAsset(blob, metadata, outputType)` 创建输出资产
5. 在迭代之间发送进度 + 检查 `signal.aborted`

```ts
// src/plugin.ts（续）
import { definePlugin, createBlobCapabilityImpl } from '@lokvis/plugin-sdk';
import { blur } from './engine.js';

export const PLUGIN_NAME = 'lokvis-blur-image';
export const PLUGIN_VERSION = '0.1.0';
export const PLUGIN_ENGINE = 'canvas';

export function blurImagePlugin() {
  return definePlugin(
    {
      name: PLUGIN_NAME,
      version: PLUGIN_VERSION,
      description: 'Gaussian-style image blur (Canvas engine)',
      capabilities: [BLUR_CAPABILITY],
      engine: PLUGIN_ENGINE,
      permissions: ['asset:read', 'asset:write', 'network:none'],
    },
    (ctx) => {
      // 依据 AGENTS.md 检测 stub 引擎
      const isStub = PLUGIN_ENGINE.includes('stub');

      const impl = createBlobCapabilityImpl(
        {
          capability: 'image.blur',
          engine: PLUGIN_ENGINE,
          outputType: 'image',
          operation: blur,
          isStub,
        },
        ctx
      );
      ctx.registerCapability(impl);
      ctx.log('info', `Registered image.blur capability`);
    }
  );
}
```

当 `isStub` 为 `true` 时，工厂会自动设置 `CapabilityImplementation.status = 'stub'`。`CapabilityRegistry.resolve()` 会跳过 stub 实现，因此当用户尝试调用一个只有 stub 实现的能力时，executor 会抛出 `CapabilityStubOnlyError` —— 而不是在引擎深处撞到 `not implemented` 错误。

## 5. PluginContext API

传给安装函数的 `ctx` 参数是 Runtime 的**受限视图** —— 插件永远无法触及 React、Redux 或 Cloud。它暴露 9 个成员：

| 成员 | 签名 | 用途 |
|---|---|---|
| `runtime.getAsset` | `(id) => Promise<Asset>` | 读取资产元数据 |
| `runtime.importAsset` | `(file: File \| Blob) => Promise<string>` | 导入 File 或 Blob，返回 AssetId |
| `runtime.getAssetBlob` | `(asset) => Promise<Blob>` | 读取资产的原始字节用于处理 |
| `runtime.createAsset` | `(blob, metadata, type) => Promise<Asset>` | 创建新资产（能力输出） |
| `runtime.listCapabilities` | `() => Promise<Capability[]>` | 查询所有已注册能力 |
| `eventBus` | `EventBus` | 发送/监听 `LokvisEvent` |
| `registerCapability` | `(impl: CapabilityImplementation) => void` | 注册一个变换（Asset → Asset） |
| `registerMetadataReader` | `<T>(name, reader: MetadataReader<T>) => void` | 注册一个查询（Asset → T），例如 EXIF 读取器 |
| `registerPanel` | `(panel: PanelDefinition) => void` | 注册一个 UI 面板（由宿主应用渲染） |
| `log` | `(level, message) => void` | 结构化日志（`info` / `warn` / `error`） |

插件永远不会看到 `run()`、`undo()`、`disposeWorkflow()` 或任何内部 `_` 前缀成员 —— 它们是 Runtime 私有的。

## 6. Stub 引擎处理

"stub 引擎" 是 Engine 适配器的占位实现（例如 Phase 2 之前的 `engine-video`、`engine-pdf`）。按照 `AGENTS.md`，stub 引擎：

- 拥有包含 `'stub'` 的 `version` 字符串
- 每个操作方法都抛出 `new Error('xxx not implemented in stub')`
- 列出 `supportedCapabilities` 用于未来规划

插件层会检测这一点并向下传递：

```ts
const isStub = engine.version.includes('stub');
// → createBlobCapabilityImpl 设置 CapabilityImplementation.status = 'stub'
// → CapabilityRegistry.resolve() 过滤掉 stub 实现
// → 若没有真实实现，Executor 抛出 CapabilityStubOnlyError
```

这就是为什么你的 `blur-image` 插件应该基于自己的引擎标识声明 `isStub`，而不是盲目假设引擎是真实可用的。

## 7. 权限（Alpha 阶段为建议性）

在 Alpha 阶段，插件权限**仅作建议** —— 它们在 `PluginConfig.permissions` 中声明，但不会被强制执行。可接受的值为：

- `asset:read` / `asset:write` —— 读取或创建资产
- `network:none` / `network:limited` / `network:full` —— 网络访问级别
- `filesystem:opfs` / `filesystem:local` —— 文件系统作用域

Phase 2 将引入强制执行。目前请如实声明权限，这样未来的强制执行就不会破坏你的插件。

## 8. 加载插件

```ts
import { createLokvis, loadPlugin } from '@lokvis/sdk';
import { imageToolsPlugin } from '@lokvis/plugin-image';
import { blurImagePlugin } from '@lokvis/blur-image';

// 选项 A：在构造时预加载
const lokvis = await createLokvis({
  plugins: [imageToolsPlugin(), blurImagePlugin()],
});

// 选项 B：在运行时加载（例如用户切换某个功能）
const runtime = await createLokvis({ plugins: [imageToolsPlugin()] });
await loadPlugin(runtime, blurImagePlugin());
```

两条路径都共用同一个 `installPlugin()` 内部实现 —— 它们注册能力，构建 `PluginContext`，运行 `plugin.install(ctx)`，并发送 `plugin:loaded` 事件。

## 9. 通过工作流调用

```ts
const assetId = await lokvis.importAsset({ kind: 'file', file });

const workflow = {
  id: 'blur-demo',
  version: '1.0.0',
  name: 'Blur demo',
  description: 'Apply a 6px blur',
  author: { id: 'local', name: 'Local User' },
  category: 'image',
  tags: ['blur'],
  nodes: [
    { id: 'n-blur', type: 'transform', capability: 'image.blur', params: { radius: 6 } },
  ],
  edges: [],
  inputs: { type: 'image', multiple: false, accept: ['image/*'] },
  outputs: { type: 'image', format: 'png' },
};

const result = await lokvis.run(workflow, [assetId]);
const blob = await lokvis.exportAsset(result.outputs[0]!);
```

## 10. Vitest 测试模式

Lokvis 使用 Vitest，配置为 `globals: false`（显式 import），测试位于 `src/__tests__/`，并使用中文测试描述。浏览器 API（`Canvas`、`createImageBitmap`、`OffscreenCanvas`）通过 `vi.stubGlobal` 或 `vi.mock` 进行 fake。

```ts
// src/__tests__/plugin.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Asset, CapabilityImplementation, PluginContext } from '@lokvis/schema';

// Fake 引擎，使测试无需真实 Canvas 即可运行
vi.mock('@lokvis/engine-image', () => ({
  canvasEngine: { version: '0.1.0', decode: vi.fn(), encode: vi.fn(async () => new Blob()) },
  createCanvas: vi.fn(),
  get2DContext: vi.fn(() => ({ filter: '', drawImage: vi.fn() })),
  throwIfAborted: vi.fn(),
}));

const { blurImagePlugin, PLUGIN_NAME } = await import('../plugin.js');

function createMockContext(): { ctx: PluginContext; registered: CapabilityImplementation[] } {
  const registered: CapabilityImplementation[] = [];
  const ctx: PluginContext = {
    runtime: {
      getAsset: vi.fn(async (id: string) => ({ id }) as Asset),
      importAsset: vi.fn(async () => 'asset-id'),
      getAssetBlob: vi.fn(async () => new Blob([new Uint8Array([0])], { type: 'image/png' })),
      createAsset: vi.fn(async (blob, metadata, type) => ({
        id: 'out-1', type, metadata,
        blob: { path: 'memory://out-1', size: blob.size, mimeType: metadata.mimeType },
        history: [], tags: [], createdAt: 0, updatedAt: 0,
      }) as Asset),
      listCapabilities: vi.fn(async () => []),
    },
    eventBus: { on: vi.fn(), onAny: vi.fn(), emit: vi.fn(), clear: vi.fn() },
    registerCapability: vi.fn((impl) => registered.push(impl)),
    registerMetadataReader: vi.fn(),
    registerPanel: vi.fn(),
    log: vi.fn(),
  };
  return { ctx, registered };
}

describe('blurImagePlugin', () => {
  it('应注册 image.blur 能力声明', () => {
    const plugin = blurImagePlugin();
    expect(plugin.config.name).toBe(PLUGIN_NAME);
    expect(plugin.config.capabilities).toHaveLength(1);
    expect(plugin.config.capabilities[0]!.name).toBe('image.blur');
  });

  it('installer 应通过 ctx.registerCapability 注册实现', async () => {
    const { ctx, registered } = createMockContext();
    const plugin = blurImagePlugin();
    await plugin.install(ctx);
    expect(registered).toHaveLength(1);
    expect(registered[0]!.capability).toBe('image.blur');
    expect(registered[0]!.engine).toBe('canvas');
  });
});
```

使用 `pnpm test` 运行。覆盖率目标：lines 60%+，branches 75%+。

## 回顾

- **Engine 层** = 纯 `Blob → Blob` 函数，params 使用 `Record<string, any>`（不使用 `as unknown as` 双断言）。
- **能力声明** = `name` / `inputTypes` / `outputTypes` / `params`（`CapabilityParam` 8 种类型）/ `performance` / `batchable` / `mcpExposure`。
- **插件组装** = `definePlugin(config, installer)` + `createBlobCapabilityImpl(options, ctx)`（封装了 5 步样板代码）。
- **Stub 检测** = `engine.version.includes('stub')` 传递给 `CapabilityImplementation.status = 'stub'`，注册表会跳过该实现。
- **权限** = Alpha 阶段为建议性，Phase 2 起强制执行。

## 下一步

- [架构：Plugin 层](../architecture/plugin) —— `@lokvis/plugin-sdk` 的完整深入解析。
- [自定义 Workspace](./custom-workspace) —— 不使用 `<Workspace />` 调用一个能力。
- [Plugin 参考](../plugins) —— `PluginContext` API 概览。
