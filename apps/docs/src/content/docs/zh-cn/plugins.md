---
title: 插件
description: 插件是为 Lokvis 添加能力的唯一方式。
draft: false
head: []
---

# 插件(Plugins)

插件是为 Lokvis 添加能力的唯一方式。插件在安装期间声明能力并注册其实现。

## 插件结构

```typescript
import { definePlugin } from '@lokvis/plugin-sdk';
import type { Capability } from '@lokvis/schema';

const CAPABILITIES: Capability[] = [
  {
    name: 'image.resize',
    description: 'Resize image',
    inputTypes: ['image'],
    outputTypes: ['image'],
    params: [...],
    performance: 'fast',
    batchable: true,
  },
];

export default function myPlugin() {
  return definePlugin(
    {
      name: 'my-plugin',
      version: '1.0.0',
      capabilities: CAPABILITIES,
      permissions: ['asset:read', 'asset:write', 'network:none'],
    },
    (ctx) => {
      // Register capability implementations
      ctx.registerCapability({
        capability: 'image.resize',
        engine: 'my-engine',
        execute: async (inputs, params, execCtx) => {
          // ...
          return outputs;
        },
      });
    }
  );
}
```

## PluginContext API

插件只能访问受限的 Runtime API:

- `ctx.runtime.getAsset(id)` — 读取资产元数据
- `ctx.runtime.getAssetBlob(asset)` — 读取资产 blob 数据
- `ctx.runtime.createAsset(blob, metadata, type)` — 创建新资产
- `ctx.runtime.listCapabilities()` — 列出所有能力
- `ctx.registerCapability(impl)` — 注册一个实现
- `ctx.registerPanel(panel)` — 注册 UI 面板
- `ctx.eventBus` — 发射 / 监听事件
- `ctx.log(level, message)` — 结构化日志

## 脚手架生成插件

```bash
lokvis plugin create my-plugin
```

## 官方插件

- `@lokvis/plugin-image` — 8 个图像能力(Canvas 引擎)
- `@lokvis/plugin-video` — 7 个视频能力(ffmpeg.wasm,stub)
- `@lokvis/plugin-pdf` — 7 个 PDF 能力(pdf-lib,stub)
- `@lokvis/plugin-dev` — 开发者工具(真实实现)

## Plugin SDK 与 MCP Server 对比

Lokvis 提供两种扩展机制。顺应 2026 年 AI 生态的变革(见 [`AI生态冲击调整方案.md`](https://github.com/lokvis/lokvis/blob/dev/docs/AI生态冲击调整方案.md)),**MCP Server 现已成为向 AI 客户端暴露能力的推荐路径**;Plugin SDK 作为浏览器嵌入场景的 Alpha 预览继续维护。

| 维度 | Plugin SDK | MCP Server |
|---|---|---|
| 使用场景 | 在你自己的 Web 应用中嵌入 Lokvis、添加自定义能力 | 让 AI 客户端(Claude / ChatGPT / Cursor)调用本地能力 |
| 协议 | Lokvis 自定义 | MCP 标准 |
| 触达范围 | 仅 Lokvis 用户 | 所有 MCP 兼容客户端 |
| 优先级 | Alpha 预览(教学用) | **推荐** |
| 阶段 | Phase 1 Alpha | Phase 2 GA |

**选择 Plugin SDK 的场景:**

- 你通过 `@lokvis/sdk` 将 Lokvis 嵌入自己的网站,且需要浏览器内的自定义能力。

**选择 MCP Server 的场景:**

- 你希望 AI 客户端处理本地文件(压缩 / 缩放 / 批量 / workflow)。
- 你希望自己的工具可被 Claude Desktop、Cursor、ChatGPT 或任何 MCP 兼容客户端调用。

配置方式与完整工具列表见 [MCP 集成](./mcp)。
