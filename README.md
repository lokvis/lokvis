# Lokvis

> **Digital Asset Intelligence Platform 的开源 Runtime — local-first，everything runs in your browser.**

[![CI](https://github.com/lokvis/lokvis/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/lokvis/lokvis/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Coverage](https://github.com/lokvis/lokvis/actions/workflows/ci.yml)](https://github.com/lokvis/lokvis/actions/workflows/ci.yml)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![GitHub Discussions](https://img.shields.io/badge/Discussions-ask%20question-blue.svg)](https://github.com/lokvis/lokvis/discussions)
[![Powered by Astro](https://img.shields.io/badge/Powered%20by-Astro-FF5D01.svg)](https://astro.build)
[![Powered by React 19](https://img.shields.io/badge/Powered%20by-React%2019-61DAFB.svg)](https://react.dev)

> **Discord 社区频道待 W23.8 搭建(2026 Q4),在此之前请使用 [GitHub Discussions](https://github.com/lokvis/lokvis/discussions)。**

<!-- W23.1 TODO: Hero GIF/视频演示
   建议录制 15-30s 的 Workspace 操作流程:
     拖拽上传 → 选择 resize 工具 → 调参 → 实时预览 → 导出
   放到 docs/assets/ 或 /static,文件名建议 hero-workspace-demo.gif
   推荐工具:macOS 的 Kap / Windows 的 ScreenToGif,尺寸 1280x720,体积 <5MB
-->
<p align="center">
  <em>📝 Hero GIF 占位 — 待 W23.1 后续录屏补全</em>
</p>

Lokvis 是 **Digital Asset Intelligence Platform 的开源 Runtime**(本仓 `lokvis-open`)。在浏览器中处理图像、视频、PDF、音频——**不上传、不部署服务器、不妥协**。平台差异化在于「知识 + 决策 + 执行」的闭环,本仓承担其中的「执行」(Runtime + Browser Adapter)。

> **Local-first**:所有处理在 WebAssembly + Web Workers 中完成,Cloudflare 仅承担边缘服务(CDN / R2 / Workers AI)。你的文件永远不离开设备。零 WASM MVP 用原生 Canvas + `createImageBitmap`,首屏不阻塞。

## 目录

- [🆚 Why Lokvis](#-why-lokvis)
- [✨ 核心特性](#-核心特性)
- [📊 特性矩阵](#-特性矩阵)
- [🏗 架构](#-架构)
- [🚀 快速开始](#-快速开始)
- [📦 SDK 嵌入](#-sdk-嵌入)
- [🎨 Workspace UI](#-workspace-ui)
- [📦 Monorepo 结构](#-monorepo-结构)
- [🛠 常用命令](#-常用命令)
- [📊 项目状态](#-项目状态)
- [🌐 文档与社区](#-文档与社区)
- [🤝 贡献指南](#-贡献指南)
- [📄 License](#-license)
- [⭐ Star History](#-star-history)

## 🆚 Why Lokvis

传统图像处理方案的痛点 vs Lokvis 的定位:

| 维度 | Cloud 服务(Cloudinary / Imgix)| Desktop 应用(GIMP / Photoshop)| **Lokvis** |
|------|---------------------|------------------|------------|
| **隐私** | ❌ 文件上传到服务器 | ✅ 本地处理 | ✅ **文件永不离开浏览器** |
| **部署** | ❌ 需后端 + API key | ⚠️ 需安装,版本更新繁琐 | ✅ **零部署,打开浏览器即用** |
| **可编程** | ⚠️ 仅 API 调用,无 UI 编排 | ⚠️ 仅 GUI 操作,无 SDK | ✅ **SDK + CLI + GUI 三模式** |
| **AI 编排** | ❌ 闭源流水线 | ❌ 无 | ✅ **MCP 协议接 Claude/Cursor** |
| **离线** | ❌ 必须联网 | ✅ 离线可用 | ✅ **PWA,首次加载后离线可用** |
| **可扩展** | ❌ 厂商锁定 | ⚠️ 插件生态有限/封闭 | ✅ **Plugin SDK + Capability Manifest** |
| **成本** | ❌ 按 GB/请求计费 | ⚠️ Photoshop 订阅制 / GIMP 免费 | ✅ **开源 MIT,零成本** |
| **跨平台** | ✅ 浏览器即可 | ⚠️ GIMP 跨平台 / PS 仅 Mac/Win | ✅ **任何现代浏览器** |

> 表中 ⚠️ 表示该方案部分支持但有局限。Lokvis 不声称全面优于所有方案,而是聚焦"本地优先 + 可编程 + AI 编排"的交叉定位。

**核心定位**:在浏览器里跑得动、改得动、接得动 AI 的本地优先数字资产 Runtime(图像 / 视频 / PDF / 音频)。

## ✨ 核心特性

- **🔐 隐私优先**:文件永远不离开浏览器,无服务端上传,无 telemetry 遥测
- **⚡ 零 WASM 首屏**:图像引擎用原生 Canvas + `createImageBitmap`,首屏不阻塞;视频/音频按需加载 ffmpeg.wasm
- **🧩 六层架构**:`UI → Workflow → Runtime → Capability → Engine → Browser Adapter`,单向依赖,禁止跨层引用
- **🔌 插件化**:每个引擎是独立包,通过 Capability 注册到 Runtime,引擎可热插拔
- **🤖 MCP 集成**:将 Lokvis 能力暴露给 Claude / ChatGPT / Cursor,本地处理 + AI 编排
- **💾 三级存储**:OPFS → IndexedDB → 内存,自动降级,大文件不 OOM
- **🛡 内存防御**:MemoryGuard 四档压力(healthy / warn / critical / emergent)+ OPFS 溢出 + 降级阶梯
- **↩️ 历史栈**:undo/redo 10 步 LRU + 跨会话持久化(IndexedDB)
- **🎯 Workflow 编排**:5 步线性 + 拖拽编辑器 + 5 模板 + JSON 导入导出 + 分享链接
- **📊 监控接入**:Sentry 错误监控 + Web Vitals(DSN 可选,默认 no-op,不泄露隐私)

## 📊 特性矩阵

### 图像能力(Phase 1 已实装)

| 能力 | Capability ID | SDK | CLI | Workspace UI | Playground |
|------|---------------|-----|-----|--------------|------------|
| Resize(缩放) | `image.resize` | ✅ | ✅ | ✅ | ✅ |
| Compress(压缩) | `image.compress` | ✅ | ✅ | ✅ | ✅ |
| Convert(格式转换) | `image.convert` | ✅ | ✅ | ✅ | ✅ |
| Crop(裁剪) | `image.crop` | ✅ | ✅ | ✅ | ✅ |
| Watermark(水印) | `image.watermark` | ✅ | ✅ | ✅ | ✅ |
| Rotate(旋转) | `image.rotate` | ✅ | ✅ | ✅ | ✅ |
| Flip(翻转) | `image.flip` | ✅ | ✅ | ✅ | ✅ |
| Filter(滤镜) | `image.filter` | ✅ | ✅ | ✅ | ✅ |
| Set Background(背景) | `image.setBackground` | ✅ | ✅ | ✅ | ✅ |
| EXIF(元数据) | `image.exif` | ✅ | ✅ | ✅ | ✅ |
| Batch(批量) | `image.batch` | ✅ | — | ✅ | ✅ |

### 基础设施(Phase 1 已实装)

| 模块 | 功能 | 状态 |
|------|------|------|
| **Runtime** | 调度 / 事件总线 / AssetStore(OPFS→IDB→Memory 三级)/ 历史栈(10 步 LRU + 跨会话)| ✅ |
| **Workflow** | JSON 声明式 / 5 步线性 / 拖拽编辑器 / 5 模板 / 导入导出 / 分享链接 | ✅ |
| **Plugin SDK** | `definePlugin()` / `PluginContext` / 权限沙箱 / Capability Manifest codegen | ✅ |
| **Workspace UI** | CommandPalette(⌘K)/ GlobalDropzone / CompareSlider / DownloadPanel / ThemeToggle | ✅ |
| **CLI** | `run` / `capabilities` / `plugin create` / `mcp` / `version` | ✅ |
| **MCP Server** | stdio + SSE + BrowserBridge,接 Claude Desktop / Cursor | ✅ |
| **PWA** | 预缓存 9 URL / immutable 缓存 / 离线 fallback / InstallPrompt | ✅ |
| **性能** | LCP 6.9s / CLS 0.001 / Worker Transferable 零拷贝 / 大图 tile-based | ✅ |
| **监控** | Sentry 错误(DSN 可选)/ Web Vitals / MemoryGuard 四档压力 | ✅ |

### 多资产引擎(已实装)

| 引擎 | 实现依赖 | 许可证 | 说明 |
|------|---------|--------|------|
| `engine-image` | 原生 Canvas + WASM(AVIF) | MIT | 9 能力,零 WASM MVP |
| `engine-video` | ffmpeg.wasm(浏览器)/ ffmpeg-static(Node) | MIT + FFmpeg LGPL-2.1+ | compress / transcode / trim / merge / to-gif ... |
| `engine-pdf` | pdf-lib | MIT | merge / split / compress / rotate / watermark ... |
| `engine-audio` | ffmpeg-static(Node)/ Web Audio | MIT | trim / normalize / merge / transcode |
| `engine-ai` | Cloud AI proxy | Apache-2.0 | ocr / caption / generate-workflow ... |

详见 [路线图](docs/roadmap.md) 与 [packages/ENGINES.md](packages/ENGINES.md)。

## 🏗 架构

Lokvis 采用严格的**六层架构**,单向依赖,禁止跨层引用:

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
├─────────────────────────────────────────────────────────────┤
│  Browser Adapter  Canvas/OPFS/IDB/Workers 统一抽象          │
│                   (唯一允许触碰原生浏览器 API 的层)         │
└─────────────────────────────────────────────────────────────┘
```

**三大原则**:

1. **一切皆包**——所有功能是独立 pnpm 包,monorepo 管理,可独立发布
2. **一切皆能力**——Runtime 只调度能力(Capability),不依赖具体引擎(Engine)
3. **一切本地运行**——核心工作流在浏览器内;Cloudflare 仅承担边缘服务(CDN / R2 / Workers AI)

详见 [Architecture 文档](apps/docs/src/content/docs/architecture.mdx)。

## 🚀 快速开始

### 前置要求

- **Node.js** ≥ 22.12 LTS(`engines.node` 声明)
- **pnpm** ≥ 9.12.0(`corepack enable && corepack prepare pnpm@9.12.0 --activate`)
- **浏览器**:Chrome 102+ / Edge 102+ / Safari 16.4+ / Firefox 111+(需支持 OPFS / `createImageBitmap` / Web Workers)

### 克隆 & 安装

```bash
git clone https://github.com/lokvis/lokvis.git
cd lokvis
pnpm install
```

### 运行开发环境

```bash
# 启动 playground(http://localhost:5601/playground)
pnpm dev --filter @lokvis/playground

# 启动文档站(http://localhost:4321)
pnpm dev --filter @lokvis/docs
```

### 验证

```bash
pnpm typecheck      # 全量类型检查
pnpm build          # 构建所有包
pnpm test           # 运行测试
pnpm test:coverage  # 运行测试 + 覆盖率(实时数值见 CI)
```

### 在线体验

不想本地跑?直接访问线上版本:

- **Playground**:[playground.lokvis.dev](https://playground.lokvis.dev) — 在浏览器直接试用 8 个工具 + Workflow 编辑器
- **文档站**:[docs.lokvis.dev](https://docs.lokvis.dev) — API Reference + 指南 + 架构说明

## 📦 SDK 嵌入

`@lokvis/sdk` 是将 Lokvis Runtime 嵌入任何 Web 应用的最简方式。

> **npm 发布状态**:已发布 `0.9.x`(`v*` tag 推送后由 GitHub Actions 自动 publish;发版流程见 [发版就绪度报告](docs/reports/W18.1-plugin-sdk-npm-release-readiness.md))。

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

// 定义工作流(线性 5 步上限):resize → compress → convert
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

// 执行工作流
const result = await lokvis.run(workflow, [assetId]);

// 导出结果
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

`Workspace` 提供 5 个 `enable*` prop 可按需关闭子功能,适配移动端抽屉模式:

| Prop | 默认 | 功能 |
|------|------|------|
| `enableWorkflowEditor` | `true` | 拖拽式工作流编辑器(节点 + 连线) |
| `enableCommandPalette` | `true` | ⌘K / Ctrl+K 命令面板,快速访问能力 |
| `enableCompare` | `true` | before/after 滑块对比 |
| `enableGlobalDropzone` | `true` | 全屏拖拽上传区域 |
| `enableDownloadPanel` | `true` | 批量下载面板(zip 打包) |

## 📦 Monorepo 结构

```
lokvis/
├── apps/
│   ├── docs/                   # Astro + Starlight 文档站(API ref + 指南)
│   └── playground/             # 在线 SDK playground(Astro 7 + React 19)
├── packages/                   # 29 个独立包
│   ├── schema/                 # 类型定义 + Zod 校验(Workflow/Asset/Capability/Plugin/Event)
│   ├── browser-adapter/        # 浏览器 API 统一抽象(唯一允许触碰原生 API 的非展示层)
│   ├── runtime/                # 浏览器本地执行引擎(调度/事件总线/AssetStore/历史栈)
│   ├── workflow/               # 线性工作流构造工具(WorkflowBuilder + buildLinearWorkflow)
│   ├── sdk/                    # createLokvis() SDK — 嵌入 Runtime 的最简入口
│   ├── plugin-sdk/             # 插件开发 SDK(definePlugin / PluginContext / 权限沙箱)
│   ├── capability/             # 标准能力名 + 63 平台预设(Web/Social/Print/Mobile)
│   ├── i18n/                   # i18n 核心(语言配置 / URL-lang helper / 字典翻译原语)
│   ├── ui-core/                # React 设计系统(12 组件 + 设计 tokens)
│   ├── ui-react/               # Workspace UI 组件(Workspace/Canvas/CommandPalette...)
│   ├── embed-kit/              # embed-* 共享原语(theme/error boundary/runtime hook...)
│   ├── embed-image/            # 三层图像快动作组件(hooks/primitives/default UI)
│   ├── embed-pdf/              # 三层 PDF 工具组件(供三方集成)
│   ├── embed-video/            # 三层视频工具组件(供三方集成)
│   ├── cli/                    # lokvis CLI(run/capabilities/plugin-create/mcp/version)
│   ├── engine-core/            # Engine 接口抽象 + 公共类型(供各 engine 复用)
│   ├── engine-image/           # 图像引擎(Canvas MVP + WASM AVIF,9 能力)
│   ├── engine-video/           # 视频引擎(ffmpeg.wasm 浏览器 / ffmpeg-static Node)
│   ├── engine-pdf/             # PDF 引擎(pdf-lib)
│   ├── engine-audio/           # 音频引擎(ffmpeg-static Node / Web Audio)
│   ├── engine-ai/              # AI 引擎(Cloud AI proxy)
│   ├── plugin-image/           # 官方图像工具插件(10 能力 + EXIF)
│   ├── plugin-video/           # 官方视频工具插件(接 engine-video)
│   ├── plugin-pdf/             # 官方 PDF 工具插件(接 engine-pdf)
│   ├── plugin-audio/           # 官方音频工具插件(接 engine-audio)
│   ├── plugin-ai/              # 官方 AI 工具插件(接 engine-ai)
│   ├── plugin-dev/             # 开发者工具插件(inspect/profile/validate)
│   ├── mcp-server/             # MCP server 适配层(Claude/ChatGPT/Cursor)
│   └── cloud-bridge/           # Cloud 集成桥接(cloud API/pro auth,渐进式)
├── examples/                   # 8 个示例
│   ├── custom-workspace/       # 不用 ui-react 构建自定义 workspace
│   ├── embedding/              # 嵌入 Workspace 到现有 React 应用(含 cloud auth 3 模式)
│   ├── cli-automation/         # 在 Node.js 脚本中使用 @lokvis/cli
│   ├── plugin-grayscale/       # 教学示例:从零写一个插件(13 测试)
│   ├── plugin-batch-watermark/ # 教学示例:批量水印插件
│   ├── mcp-claude-desktop/     # MCP server 接入 Claude Desktop 配置
│   ├── mcp-cursor/             # MCP server 接入 Cursor 配置
│   └── mcp-e2e-verification/   # MCP 端到端验证可复现脚本
└── docs/                       # 项目文档(中文,含白皮书 + ADR + 报告)
```

**包状态说明**:
- ✅ **schema / browser-adapter / runtime / workflow / sdk / plugin-sdk / capability / i18n / ui-core / ui-react / embed-kit / embed-image / embed-pdf / embed-video / cli / engine-core / engine-image / engine-video / engine-pdf / engine-audio / engine-ai / plugin-image / plugin-video / plugin-pdf / plugin-audio / plugin-ai / plugin-dev / mcp-server** — 已实现,有完整测试
- 🔌 **cloud-bridge** — 渐进式桥接(cloud API + pro auth),非核心本地功能

## 🛠 常用命令

```bash
# 开发
pnpm dev --filter @lokvis/playground    # 启动 playground(http://localhost:5601)
pnpm dev --filter @lokvis/docs          # 启动文档站(http://localhost:4321)

# 质量
pnpm typecheck      # 全量类型检查(通过 turbo)
pnpm build          # 构建所有包(通过 turbo)
pnpm test           # 运行测试
pnpm test:fast      # 跳过覆盖率快速测试
pnpm test:coverage  # 运行测试 + 覆盖率(实时数值见 CI)
pnpm --filter @lokvis/playground test:e2e  # Playwright E2E(baseURL 5601)
pnpm lint           # oxlint(Rust 实现,替代 ESLint)

# 单包操作(--filter)
pnpm --filter @lokvis/runtime test
pnpm --filter @lokvis/playground typecheck
pnpm --filter @lokvis/sdk build

# CLI(需先 build,通过 node 直接调用 bin;未发布到 npm 无全局 lokvis 命令)
node packages/cli/bin/lokvis.js run ./workflow.json ./input.png    # 执行工作流
node packages/cli/bin/lokvis.js capabilities                       # 列出已注册能力
node packages/cli/bin/lokvis.js plugin create my-plugin            # 脚手架新插件
node packages/cli/bin/lokvis.js mcp                                # 启动 MCP server(stdio)
node packages/cli/bin/lokvis.js version                            # 查看版本
```

## 📊 项目状态

### Phase 1(M1.1 Alpha / M1.2 Beta / M1.3 发布)— **代码侧完成度 91%**

| 里程碑 | 目标日期 | 状态 | 说明 |
|--------|---------|------|------|
| **M1.1 Alpha** | 2026.09.30 | ✅ 已达成 | 2026-07-04 W12.1 Go 决策通过 |
| **M1.2 Beta** | 2026.10.31 | 🟡 代码侧就绪 | 待运维部署 + 真实用户反馈 |
| **M1.3 发布** | 2026.12.15 | 🟡 部分启动 | W21.1-21.7 性能优化 + W22.3-22.5 跨浏览器 + W23.2-23.4 开源文档 完成 |
| **M1.4 首个 $1K MRR** | 2027.02.28 | ⬜ 待开始 | cloud 侧验证 |

### 核心模块状态

| 模块 | 状态 | 详情 |
|------|------|------|
| 6 核心图像工具 | ✅ 超额 | resize/compress/convert/crop/watermark/rotate + flip/filter/setBackground + EXIF(共 9 能力) |
| 批量队列 | ✅ | 并发 4 / 重试 3 / 免费上限 10 / Pro 无限 / 50+ 不 OOM |
| 历史栈 | ✅ | undo/redo 10 步 LRU + 跨会话持久化(IndexedDB) |
| Workflow 编排 | ✅ | 5 步线性 + 拖拽编辑器 + 5 模板 + JSON 导入导出 + 分享链接 |
| 基础设施 | ✅ | Worker 隔离 + Transferable 零拷贝 + MemoryGuard 四档 + OPFS/IDB/Memory 三级 + 大图 tile-based(4K 阈值) |
| Workspace UI | ✅ | CommandPalette + GlobalDropzone + CompareSlider + DownloadPanel + ThemeToggle |
| Playground | ✅ | 8 工具页 + Workflow 编辑器 + History + 隐私指示器 + 浏览器能力检测 |
| CLI | ✅ | run / capabilities / plugin create / mcp / version |
| MCP Server | ✅ | stdio + SSE + BrowserBridge,Claude Desktop / Cursor 端到端验证 |
| Plugin SDK | ✅ | definePlugin + PluginContext + 权限沙箱 + Capability Manifest codegen |
| 文档 | ✅ | Starlight 文档站 + API Reference 自动生成(10 包 200+ 页)+ 4 guide + Playground 交互 |
| 开源治理 | ✅ | CONTRIBUTING + COC + Issue/PR 模板 + CODEOWNERS + AGENTS.md + THIRD_PARTY_LICENSES |
| Sentry 监控 | ✅ | 接入完成,DSN 待部署时配置(默认 no-op) |
| 性能基线 | ✅ | LCP 6.9s / CLS 0.001 / Lighthouse 62 分(mobile);测试数与覆盖率见 CI |
| 浏览器兼容 | 🟡 | Chrome/Edge ✅ / Firefox 降级提示 ✅ / Safari 降级路径基础设施 ✅(具体降级待 W22.2) |
| 视频/PDF/Audio/AI 引擎 | ✅ | ffmpeg.wasm / pdf-lib / ffmpeg-static / Cloud AI proxy 已实装 |

详见:

- [Alpha 部署就绪度报告](docs/reports/W16.1-alpha-deploy-readiness.md)
- [Lighthouse 跑分就绪度报告](docs/reports/W16.5-lighthouse-readiness.md)
- [Bug 修复预检查报告](docs/reports/W16.6-bug-fix-precheck.md)
- [Lighthouse 跑分基线 2026-07-17](docs/reports/W21.7-lighthouse-baseline-2026-07-17.md)
- [项目计划](docs/PROJECT_PLAN.md)
- [任务清单](docs/TASKS.md)
- [路线图](docs/roadmap.md)

## 🌐 文档与社区

### 文档

| 资源 | 链接 | 说明 |
|------|------|------|
| **文档站** | [docs.lokvis.dev](https://docs.lokvis.dev) | API Reference + 指南 + 架构 + Playground 交互 |
| **Playground** | [playground.lokvis.dev](https://playground.lokvis.dev) | 8 工具 + Workflow 编辑器在线试用 |
| **项目计划** | [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md) | 周级任务拆分(W1-W24) |
| **任务清单** | [docs/TASKS.md](docs/TASKS.md) | 状态总览(Phase 1 完成度 91%) |
| **路线图** | [docs/roadmap.md](docs/roadmap.md) | 三年四阶段战略 |
| **架构决策** | [docs/adr/](docs/adr/) | ADR 记录(O1-O3 + 011-016) |
| **架构约束** | [AGENTS.md](AGENTS.md) | AI 编码助手约定(六层架构 + 类型安全) |
| **第三方许可** | [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) | 41 MIT + 5 Apache-2.0 依赖清单 |

### 社区

| 渠道 | 链接 | 用途 |
|------|------|------|
| **GitHub Issues** | [issues](https://github.com/lokvis/lokvis/issues) | Bug 报告 / 功能请求(用模板) |
| **GitHub Discussions** | [discussions](https://github.com/lokvis/lokvis/discussions) | 使用问题 / 想法讨论 |
| **Discord** | *W23.8 搭建中* | 社区频道(2026 Q4 上线) |
| **邮件** | hello@lokvis.dev | 一般咨询 |
| **安全邮件** | security@lokvis.dev | 安全漏洞私密报告 |

### 示例

| 示例 | 路径 | 说明 |
|------|------|------|
| **Embedding** | [examples/embedding](examples/embedding) | 嵌入 Workspace 到现有 React 应用(含 cloud auth 3 模式) |
| **Custom Workspace** | [examples/custom-workspace](examples/custom-workspace) | 不用 ui-react 构建自定义 workspace |
| **CLI Automation** | [examples/cli-automation](examples/cli-automation) | 在 Node.js 脚本中使用 @lokvis/cli |
| **Plugin Grayscale** | [examples/plugin-grayscale](examples/plugin-grayscale) | 教学示例:从零写一个插件(13 测试) |
| **Plugin Batch Watermark** | [examples/plugin-batch-watermark](examples/plugin-batch-watermark) | 教学示例:批量水印插件 |
| **MCP Claude Desktop** | [examples/mcp-claude-desktop](examples/mcp-claude-desktop) | MCP server 接入 Claude Desktop |
| **MCP Cursor** | [examples/mcp-cursor](examples/mcp-cursor) | MCP server 接入 Cursor |
| **MCP E2E Verification** | [examples/mcp-e2e-verification](examples/mcp-e2e-verification) | MCP 端到端验证可复现脚本 |

## 🤝 贡献指南

我们欢迎贡献!详见 **[CONTRIBUTING.md](CONTRIBUTING.md)**(环境要求 / 架构约束 / 测试约定 / Conventional Commits / PR 流程)。

**TL;DR**:

```bash
git clone https://github.com/<your-username>/lokvis.git
cd lokvis && pnpm install && pnpm build
pnpm test:fast && pnpm typecheck && pnpm lint
# Conventional Commits → PR 到 dev 分支
```

关键约定:

- **六层架构单向依赖**:`UI → Workflow → Runtime → Capability → Engine → Browser Adapter`,禁止跨层引用(详见 [AGENTS.md](AGENTS.md))
- **Conventional Commits**:`feat` / `fix` / `docs` / `refactor` / `test` / `chore` / `perf`
- **行为准则**:见 [Code of Conduct](CODE_OF_CONDUCT.md)——友善、包容、对事不对人
- **隐私优先**:不在 PR / Issue 中提交真实用户文件 / DSN / token
- **License**:MIT,不要求 DCO / CLA,但禁止 GPL/AGPL 进入主 bundle(详见 [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md))

## 📄 License

[MIT](LICENSE) © Lokvis Contributors

### 第三方依赖

Lokvis 使用以下开源依赖(完整清单见 [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md)):

**Phase 1 当前依赖**(6 项核心):

- **Astro 7** (MIT) — 文档站 + playground
- **React 19** (MIT) — UI 层
- **Vitest** (MIT) — 测试框架
- **Zod** (MIT) — schema 校验
- **@sentry/browser** (MIT) — 错误监控(可选)
- **CodeMirror 6** (MIT) — playground 代码编辑器

**多资产引擎依赖**:

- **ffmpeg.wasm / ffmpeg-static** (MIT + FFmpeg LGPL-2.1+) — 视频/音频引擎(需 LGPL 兼容构建,不含 GPL 组件)
- **pdf-lib** (MIT) — PDF 引擎
- **Cloud AI proxy** — AI 引擎(浏览器本地不打包模型)

---

## ⭐ Star History

<a href="https://github.com/lokvis/lokvis/stargazers">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=lokvis/lokvis&type=Date&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=lokvis/lokvis&type=Date" />
    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=lokvis/lokvis&type=Date" />
  </picture>
</a>

---

<p align="center">
  <sub>Built with ❤️ by <a href="https://github.com/lokvis">Lokvis</a>. Local-first, privacy-first, open-source.</sub>
</p>
