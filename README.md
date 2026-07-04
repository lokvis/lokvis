# Lokvis

> **Local Vision. Browser Workspace. Everything runs in your browser.**

[![CI](https://github.com/lokvis/lokvis/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/lokvis/lokvis/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Coverage](https://img.shields.io/badge/coverage-91%25-brightgreen.svg)](docs/reports/W12.2-performance-baseline.md)

Lokvis 是一个 **Local-first 浏览器工作区平台**。在浏览器中处理图像、视频、PDF、音频——**不上传、不部署服务器、不妥协**。

所有处理在 WebAssembly + Web Workers 中完成,Cloudflare 仅承担边缘服务(CDN / R2 / Workers AI)。你的文件永远不离开设备。

## 目录

- [✨ 核心特性](#-核心特性)
- [🏗 架构](#-架构)
- [🚀 快速开始](#-快速开始)
- [📦 SDK 嵌入](#-sdk-嵌入)
- [🎨 Workspace UI](#-workspace-ui)
- [📦 Monorepo 结构](#-monorepo-结构)
- [🛠 常用命令](#-常用命令)
- [📊 项目状态](#-项目状态)
- [🤝 贡献指南](#-贡献指南)
- [📄 License](#-license)

## ✨ 核心特性

- **🔐 隐私优先**:文件永远不离开浏览器,无服务端上传
- **⚡ 零 WASM MVP**:图像引擎用原生 Canvas + createImageBitmap,首屏不阻塞
- **🧩 五层架构**:UI → Workflow → Runtime → Capability → Engine,单向依赖
- **🔌 插件化**:每个引擎是独立包,通过 Capability 注册到 Runtime
- **🤖 MCP 集成**:将 Lokvis 能力暴露给 Claude / ChatGPT / Cursor
- **💾 三级存储**:OPFS → IndexedDB → 内存,自动降级
- **🛡 内存防御**:MemoryGuard 四档压力 + OPFS 溢出 + 降级阶梯
- **↩️ 历史栈**:undo/redo 10 步 LRU + 跨会话持久化
- **🎯 Workflow 编排**:5 步线性 + 拖拽编辑器 + 模板 + 分享链接
- **📊 监控接入**:Sentry 错误监控 + Web Vitals(DSN 可选,默认 no-op)

## 🏗 架构

Lokvis 采用严格的**五层架构**,单向依赖:

```
┌─────────────────────────────────────────────────────────────┐
│  UI Layer         Astro 7 (SEO) + React 19 (Workspace SPA) │
├─────────────────────────────────────────────────────────────┤
│  Workflow Layer   JSON 声明式工作流 + 可视化编辑器 + 模板   │
├─────────────────────────────────────────────────────────────┤
│  Runtime Layer    调度 / 状态 / 事件总线 / 历史 / 资产存储  │
├─────────────────────────────────────────────────────────────┤
│  Capability Layer resize / compress / convert / OCR ...    │
├─────────────────────────────────────────────────────────────┤
│  Engine Layer     Canvas (MVP) / ffmpeg.wasm / pdf-lib ...  │
└─────────────────────────────────────────────────────────────┘
```

**三大原则**:
1. **一切皆包**——所有功能是独立 pnpm 包,monorepo 管理
2. **一切皆能力**——Runtime 只调度能力,不依赖具体引擎
3. **一切本地运行**——核心工作流在浏览器内;Cloudflare 仅边缘服务

详见 [Architecture 文档](apps/docs/src/content/docs/architecture.mdx)。

## 🚀 快速开始

### 前置要求

- **Node.js** ≥ 22 LTS
- **pnpm** ≥ 9.12.0(`corepack enable && corepack prepare pnpm@9.12.0 --activate`)
- **浏览器**:Chrome 102+ / Edge 102+ / Safari 16.4+ / Firefox 111+

### 安装 & 运行

```bash
git clone https://github.com/lokvis/lokvis.git
cd lokvis
pnpm install

# 启动 playground(http://localhost:5601/playground)
pnpm dev --filter @lokvis/playground

# 启动文档站
pnpm dev --filter @lokvis/docs
```

### 验证

```bash
pnpm typecheck      # 36 包类型检查
pnpm build          # 20 任务构建
pnpm test           # 777 测试
pnpm test:coverage  # 覆盖率(lines 91%+ / branches 88%+)
```

## 📦 SDK 嵌入

`@lokvis/sdk` 是将 Lokvis Runtime 嵌入任何 Web 应用的最简方式。

```bash
pnpm add @lokvis/sdk @lokvis/plugin-image
```

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
  id: 'web-optimize',
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

完整 API 参考: [SDK 文档](apps/docs/src/content/docs/sdk.md)。

## 🎨 Workspace UI

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
      enableWorkflowEditor    // 拖拽编辑器
      enableCommandPalette    // ⌘K 命令面板
      enableCompare           // before/after 对比
      enableGlobalDropzone    // 全屏拖拽
      enableDownloadPanel     // 批量下载
    />
  );
}
```

`Workspace` 提供 5 个 `enable*` prop 可按需关闭子功能,适配移动端抽屉模式。

## 📦 Monorepo 结构

```
lokvis/
├── apps/
│   ├── docs/                   # Astro + Starlight 文档站
│   └── playground/             # 在线 SDK playground(Astro 7 + React 19)
├── packages/
│   ├── schema/                 # 类型定义 + Zod 校验
│   ├── runtime/                # 浏览器本地执行引擎
│   ├── sdk/                    # createLokvis() SDK
│   ├── plugin-sdk/             # 插件开发 SDK
│   ├── capability/             # 标准能力名 + 63 平台预设
│   ├── ui-core/                # React 设计系统(12 组件)
│   ├── ui-react/               # Workspace UI 组件
│   ├── cli/                    # lokvis CLI
│   ├── engine-image/           # 图像引擎(Canvas MVP,9 能力)
│   ├── engine-video/           # 视频引擎(ffmpeg.wasm,stub)
│   ├── engine-pdf/             # PDF 引擎(pdf-lib,stub)
│   ├── engine-audio/           # 音频引擎(Web Audio API,stub)
│   ├── engine-ai/              # AI 引擎(transformers.js,stub)
│   ├── plugin-image/           # 官方图像工具插件(9 能力 + EXIF)
│   ├── plugin-video/           # 官方视频工具插件(stub)
│   ├── plugin-pdf/             # 官方 PDF 工具插件(stub)
│   ├── plugin-dev/             # 开发者工具插件(inspect/profile)
│   └── mcp-server/             # MCP server 适配层
├── examples/
│   ├── custom-workspace/       # 不用 ui-react 构建自定义 workspace
│   ├── cli-automation/         # 在 Node.js 脚本中使用 @lokvis/cli
│   └── embedding/              # 嵌入 Workspace 到现有 React 应用
└── docs/                       # 项目文档(中文,含白皮书 + ADR)
```

## 🛠 常用命令

```bash
# 开发
pnpm dev --filter @lokvis/playground    # 启动 playground
pnpm dev --filter @lokvis/docs          # 启动文档站

# 质量
pnpm typecheck      # 全量类型检查(36 包)
pnpm build          # 构建(20 任务)
pnpm test           # 运行测试(777 测试)
pnpm test:fast      # 跳过覆盖率快速测试
pnpm test:coverage  # 覆盖率
pnpm lint           # oxlint

# 单包操作
pnpm --filter @lokvis/runtime test
pnpm --filter @lokvis/playground typecheck

# CLI(全局安装后)
lokvis run ./workflow.json ./input.png
lokvis capabilities
lokvis plugin create my-plugin
lokvis mcp                                  # 启动 MCP server
```

## 📊 项目状态

### Phase 1 Alpha(M1.1,目标 2026.09.30)— **代码完成 ✅**

| 模块 | 状态 | 详情 |
|------|------|------|
| 6 核心图像工具 | ✅ 超额 | resize/compress/convert/crop/watermark/rotate + flip/filter/setBackground + EXIF(共 9 能力) |
| 批量队列 | ✅ | 并发 4 / 重试 3 / 免费上限 10 / Pro 无限 / 50+ 不 OOM |
| 历史栈 | ✅ | undo/redo 10 步 LRU + 跨会话持久化(IndexedDB) |
| Workflow 编排 | ✅ | 5 步线性 + 拖拽编辑器 + 5 模板 + JSON 导入导出 + 分享链接 |
| 基础设施 | ✅ | Worker 隔离 + Streaming + MemoryGuard + 降级阶梯 + Cancel + OPFS/IDB 三级 |
| Workspace UI | ✅ | CommandPalette + GlobalDropzone + CompareSlider + DownloadPanel + ThemeToggle |
| Playground | ✅ | 8 工具页 + Workflow 编辑器 + History + 隐私指示器 |
| CLI | ✅ | run / capabilities / plugin create / mcp / version |
| 文档 | ✅ | Starlight 三页定稿(Architecture / Getting Started / SDK) |
| Sentry 监控 | ✅ | 接入完成,DSN 待部署时配置 |
| 性能基线 | ✅ | 777 测试 / 91% 覆盖率 / 19.16s 套件 |
| 视频/PDF/Audio 引擎 | 🚧 stub | Phase 2 接入 ffmpeg.wasm / pdf-lib |
| Plugin SDK | 🚧 Alpha | Phase 2 优先 MCP server(ADR-O2) |

详见:
- [Alpha 验收报告](docs/reports/W12.1-alpha-acceptance.md)
- [性能基线报告](docs/reports/W12.2-performance-baseline.md)
- [项目计划](docs/PROJECT_PLAN.md)
- [路线图](docs/roadmap.md)

## 🤝 贡献指南

我们欢迎贡献!请遵循以下流程:

### 1. Fork & Clone

```bash
git clone https://github.com/<your-username>/lokvis.git
cd lokvis
git remote add upstream https://github.com/lokvis/lokvis.git
pnpm install
```

### 2. 创建分支

```bash
git checkout -b feat/your-feature   # 特性
git checkout -b fix/your-bugfix     # 修复
git checkout -b docs/your-docs      # 文档
```

### 3. 开发

```bash
# 写代码 + 测试
pnpm test:fast        # 快速验证
pnpm typecheck        # 类型检查
pnpm lint             # 代码规范
```

**架构约束**(详见 [AGENTS.md](AGENTS.md)):

- 五层架构**单向依赖**:UI → Workflow → Runtime → Capability → Engine
- Engine 层只暴露 Blob ↔ Blob 纯函数,接受 `Record<string, any>` 参数
- 禁止 `as unknown as` 双断言(Worker scope 等跨边界场景例外)
- 所有 `fetch()` 必须检查 `response.ok`
- EventBus `emit()` 必须遍历 `[...set]` 副本 + try/catch 包裹

**测试约定**:

- 框架:Vitest,`globals: false`(显式 import)
- 位置:`src/__tests__/<module>.test.ts`
- 中文测试描述
- 浏览器 API(Canvas / OPFS / IndexedDB)用 fake 实现
- 覆盖率目标:lines 60%+,branches 75%+

### 4. 提交

遵循 [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git commit -m "feat(runtime): add new capability 'image.filter'"
git commit -m "fix(ui-react): Canvas useEffect deps missing canCompare"
git commit -m "docs(w12.4): Starlight 文档三页定稿"
```

类型:`feat` / `fix` / `docs` / `refactor` / `test` / `chore` / `perf`

### 5. PR

- 推到你的 fork,向 `dev` 分支发起 PR
- PR 标题遵循 Conventional Commits
- 描述变更内容 + 验证方式(typecheck / test / build)
- CI 必须全绿(lint + typecheck + build + test)
- 至少 1 位 reviewer 批准

### 6. 行为准则

- 友善、包容、对事不对人
- 中文 / 英文均可,技术术语保留英文
- 隐私优先:不在 PR 中提交真实用户文件 / DSN / token

## 📄 License

[MIT](LICENSE) © Lokvis Contributors

### 第三方依赖

Lokvis 使用以下开源依赖(完整列表见 `THIRD_PARTY_LICENSES.md`):

- **Astro 7** (MIT) — 文档站 + playground
- **React 19** (MIT) — UI 层
- **Vitest** (MIT) — 测试框架
- **Zod** (MIT) — schema 校验
- **@sentry/browser** (MIT) — 错误监控(可选)
- **CodeMirror 6** (MIT) — playground 代码编辑器

Phase 2 将引入:
- **ffmpeg.wasm** (MIT + LGPL-2.1+) — 视频引擎
- **pdf-lib** (MIT) — PDF 引擎
- **transformers.js** (Apache 2.0) — AI 引擎

---

<p align="center">
  <sub>Built with ❤️ by <a href="https://github.com/lokvis">Lokvis</a>. Local-first, privacy-first, open-source.</sub>
</p>
