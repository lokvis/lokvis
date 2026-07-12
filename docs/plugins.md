# 插件开发（Plugins）

> 插件是向 Lokvis 添加能力的唯一方式。
> 2026 AI 生态转型后，**MCP Server 是推荐路径**；Plugin SDK 维持为 Alpha 预览。

> **仓库范围（[ADR-012](./adr/012-商业资产迁出.md)）**：开源仓库（MIT）仅保留
> `apps/docs/`（文档站）与 `apps/playground/`（SDK/Runtime/Plugin demo）。
> 商业化 Workspace SPA、SEO 工具页等已迁出至闭源 `lokvis-cloud` 仓库。插件开发者
> 可在 `apps/playground/` 中验证自有插件，无需依赖已迁出的 `apps/web`。

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
| `@lokvis/plugin-image` | 9 | Canvas + createImageBitmap | ✅ 已实现 |
| `@lokvis/plugin-video` | 7 | ffmpeg.wasm（计划） | 🟡 stub |
| `@lokvis/plugin-pdf` | 7 | pdf-lib（计划） | 🟡 stub |
| `@lokvis/plugin-dev` | 4 | 无（内置实现） | ✅ 已实现 |

> stub 引擎遵循统一约定（见 [AGENTS.md](../AGENTS.md)）：`version` 含 `'stub'` 标识，
> 操作抛 `not implemented in stub`，`CapabilityRegistry.resolve()` 自动跳过。
> UI 层（A7）会为 stub-only 能力显示 "Coming Soon" 标记，避免用户执行时才报错。

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

不删除，但不主动投入。当前维持在 `0.2.2`（Alpha 预览，不发 GA）。

---

*本文档为插件信息单一信息源（对齐 [ADR-012](./adr/012-商业资产迁出.md)），
`apps/docs/` 中的 `plugins.md` 为其发布版摘要。*
