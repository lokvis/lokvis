---
title: 快速开始
description: 安装 Lokvis、运行 Web 应用,并将 Runtime 嵌入你的项目。
draft: false
head: []
---

# 快速开始

本指南将带你完成 Lokvis 的安装、运行 Playground,以及将 Runtime SDK 嵌入到你的 Web 应用中。

## 前置条件

- **Node.js** ≥ 22 LTS(推荐 22.x)
- **pnpm** ≥ 9.12.0(`corepack enable && corepack prepare pnpm@9.12.0 --activate`)
- **浏览器**:任何支持 OffscreenCanvas + createImageBitmap + OPFS 的现代浏览器(Chrome 102+ / Edge 102+ / Safari 16.4+ / Firefox 111+)

> Lokvis 是 local-first 工具,**所有处理在浏览器中完成,不上传文件**。

## 1. 克隆与安装

```bash
git clone https://github.com/lokvis/lokvis.git
cd lokvis
pnpm install
```

仓库是 pnpm monorepo,包含 18+ `@lokvis/*` 包 + `apps/playground` Astro 应用。

## 2. 运行 Playground

```bash
pnpm dev --filter @lokvis/playground
# → http://localhost:5601/playground
```

Playground 提供:
- 8 个工具页(resize / compress / convert / crop / watermark / 批量水印 / 批量处理 / 下载)
- Workflow 编辑器(拖拽 + 模板 + 分享链接)
- History 面板(undo/redo)
- 隐私指示器(离线检测 + Local-only badge)

## 3. 构建与测试

```bash
pnpm typecheck   # 全量类型检查(36 包)
pnpm build       # 构建(20 任务)
pnpm test        # 运行测试(777 测试)
pnpm test:coverage  # 覆盖率(lines 91%+ / branches 88%+)
```

## 4. 嵌入 Runtime SDK

`@lokvis/sdk` 是将 Lokvis Runtime 嵌入任何 Web 应用的最简方式。

### 安装

```bash
pnpm add @lokvis/sdk @lokvis/plugin-image
```

### 最小示例

```typescript
import { createLokvis } from '@lokvis/sdk';
import { imageToolsPlugin } from '@lokvis/plugin-image';

const lokvis = await createLokvis({
  plugins: [imageToolsPlugin()],
});

// 导入文件
const assetId = await lokvis.importAsset({ kind: 'file', file });

// 定义工作流(线性 5 步上限)
const workflow = {
  id: 'demo',
  name: 'Web Optimize',
  category: 'web',
  inputs: { type: 'image/*' },
  outputs: [{ type: 'image/webp', label: 'optimized' }],
  nodes: [
    { id: 'n1', capability: 'image.resize', params: { width: 1920, height: 1080, fit: 'inside' } },
    { id: 'n2', capability: 'image.compress', params: { quality: 80 } },
    { id: 'n3', capability: 'image.convert', params: { format: 'webp' } },
  ],
  edges: [
    { from: 'input', to: 'n1' },
    { from: 'n1', to: 'n2' },
    { from: 'n2', to: 'n3' },
    { from: 'n3', to: 'output' },
  ],
};

// 执行
const result = await lokvis.run(workflow, [assetId]);
const outputBlob = await lokvis.exportAsset(result.outputs[0]);
```

## 5. 使用 Workspace UI

`@lokvis/ui-react` 提供完整的 Workspace 组件,可嵌入任意 React 19 应用。

```bash
pnpm add @lokvis/ui-react @lokvis/plugin-image
```

```tsx
import { Workspace } from '@lokvis/ui-react';
import { imageToolsPlugin } from '@lokvis/plugin-image';

function App() {
  return (
    <Workspace
      title="My Image Tools"
      plugins={[imageToolsPlugin()]}
      enableWorkflowEditor
      enableCommandPalette
      enableCompare
    />
  );
}
```

`Workspace` 提供 5 个 `enable*` prop 可按需关闭子功能,适配移动端抽屉模式。

## 6. Sentry 监控(可选)

Playground 已内置 Sentry 接入(W12.3)。部署时配置 DSN 即可启用:

```bash
# apps/playground/.env
PUBLIC_SENTRY_DSN=https://your-key@sentry.io/project-id
PUBLIC_SENTRY_RELEASE=playground@0.1.0
```

未配置 DSN 时整个模块退化为 no-op,本地开发与自托管用户零侵入。详见 [W12.3 设计](https://github.com/lokvis/lokvis/blob/dev/docs/PROJECT_PLAN.md#123-sentry-监控接入)。

## 7. 下一步

- [架构](./architecture) — 五层架构、Worker 隔离、HistoryStack、AssetStore 三级降级
- [SDK](./sdk) — `@lokvis/sdk` 完整 API 参考
- [MCP 集成](https://github.com/lokvis/lokvis/blob/dev/docs/mcp-integration.md) — 将 Lokvis 能力暴露给 Claude / ChatGPT / Cursor
- [插件开发](https://github.com/lokvis/lokvis/blob/dev/docs/plugins.md) — Plugin SDK 结构与 PluginContext API
- [项目计划](https://github.com/lokvis/lokvis/blob/dev/docs/PROJECT_PLAN.md) — Phase 1 24 周小时级任务拆分

## 故障排查

| 问题 | 原因 | 解决 |
|------|------|------|
| `pnpm install` 报 `ERR_PNPM_OUTDATED_LOCKFILE` | lockfile 与 package.json 不同步 | `pnpm install --no-frozen-lockfile` |
| Playground 白屏 + Console 报 `SharedArrayBuffer is not defined` | 未配 COOP/COEP | `apps/playground/astro.config.mjs` 已配,生产部署需在 CDN `_headers` 配 |
| `createLokvis` 报 `CAPABILITY_NOT_REGISTERED` | 未加载 plugin | `plugins: [imageToolsPlugin()]` |
| Worker 崩溃重启后仍失败 | 浏览器内存不足 | 减小批量并发数 / 用更小源图 |
| `STORAGE_QUOTA_EXCEEDED` | OPFS/IDB 配额满 | `lokvis.removeAsset(id)` 清理 / 调高 `storageQuota` |

## 反馈

- 🐛 Bug:[GitHub Issues](https://github.com/lokvis/lokvis/issues)
- 💬 讨论:[GitHub Discussions](https://github.com/lokvis/lokvis/discussions)
- 📧 邮件:hello@lokvis.com
