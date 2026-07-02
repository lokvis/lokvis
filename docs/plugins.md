# 插件开发（Plugins）

> 插件是向 Lokvis 添加能力的唯一方式。
> 2026 AI 生态转型后，**MCP Server 是推荐路径**；Plugin SDK 维持为 Alpha 预览。

---

## 选择扩展方式

Lokvis 提供两种扩展机制：

| 维度 | Plugin SDK | MCP Server |
|------|-----------|------------|
| **适用场景** | 在自有网站嵌入 Lokvis，需要自定义浏览器内能力 | 让 AI 客户端（Claude/ChatGPT/Cursor）调用本地能力 |
| **协议** | Lokvis 自定义 | MCP 标准 |
| **触达范围** | 仅 Lokvis 用户 | 所有 MCP 兼容客户端 |
| **优先级** | Alpha 预览（教学） | **推荐方式** |
| **阶段** | Phase 1 Alpha | Phase 2 GA |

**选 Plugin SDK**：你在自己的网站通过 `@lokvis/sdk` 嵌入 Lokvis，需要自定义浏览器内能力。

**选 MCP Server**：你想让 AI 客户端处理本地文件（compress/resize/batch/workflow），或从 Claude Desktop/Cursor/ChatGPT 访问你的工具。

→ 详见 [MCP 集成](./mcp-integration.md)

---

## Plugin SDK

### 插件结构

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
      // 注册能力实现
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

### PluginContext API

插件只能看到受限的 Runtime API：

| 方法 | 说明 |
|------|------|
| `ctx.runtime.getAsset(id)` | 读取资产元数据 |
| `ctx.runtime.getAssetBlob(asset)` | 读取资产 Blob 数据 |
| `ctx.runtime.createAsset(blob, metadata, type)` | 创建新资产 |
| `ctx.runtime.listCapabilities()` | 列出所有能力 |
| `ctx.registerCapability(impl)` | 注册能力实现 |
| `ctx.registerPanel(panel)` | 注册 UI 面板 |
| `ctx.eventBus` | 发送/监听事件 |
| `ctx.log(level, message)` | 结构化日志 |

### 权限模型

| 权限 | 说明 |
|------|------|
| `asset:read` | 读取资产 |
| `asset:write` | 创建/修改资产 |
| `network:none` | 禁止网络访问（强制） |
| `filesystem:limited` | 受限文件系统访问 |

### 脚手架

```bash
lokvis plugin create my-plugin
```

---

## 官方插件

| 插件 | 能力数 | 引擎 | 状态 |
|------|--------|------|------|
| `@lokvis/plugin-image` | 8 | Canvas + createImageBitmap | ✅ 已实现 |
| `@lokvis/plugin-video` | 7 | ffmpeg.wasm | 🟡 骨架 |
| `@lokvis/plugin-pdf` | 7 | pdf-lib | 🟡 骨架 |
| `@lokvis/plugin-dev` | 4 | — | 🟡 骨架（Phase 4） |

---

## Plugin SDK 降级说明

基于 2026 AI 生态转型（详见 [AI 调整方案](./AI生态冲击调整方案.md)），Plugin SDK 的定位调整：

| 维度 | 原定位 | 新定位 |
|------|--------|--------|
| 战略角色 | 生态核心 | **兼容层**，仅浏览器内嵌入 |
| 正式发布 | Phase 2 v1 | **Phase 3 或取消** |
| 优先级 | P0 | **P3**（Alpha 预览保留） |

保留原因：
1. 浏览器内嵌入场景仍需要 Plugin SDK
2. 教学价值：帮助开发者理解 Lokvis 能力模型
3. 未来兼容：若 MCP 生态变化，可作为 fallback

不删除，但不主动投入。仅维持 `0.1.0-alpha`。

---

*本文档整合自 `apps/docs/src/content/docs/plugins.md` 与 AI 调整方案 §4。*
