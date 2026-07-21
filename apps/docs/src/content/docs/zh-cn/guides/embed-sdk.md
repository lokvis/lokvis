---
title: 嵌入 SDK
description: 使用 @lokvis/sdk、@lokvis/plugin-image 与 @lokvis/ui-react 把 Lokvis Workspace 嵌入宿主 React 19 + Vite 应用。
draft: false
head: []
---

# 嵌入 SDK

本指南带你把 Lokvis Workspace 嵌入一个宿主 **React 19 + Vite** 应用。你将安装三个包、挂载 `<Workspace />` 组件、了解可用 props，并配置 COOP/COEP 头以让图像引擎能用 `SharedArrayBuffer`。

## 前置条件

- **Node.js** ≥ 22 LTS
- **pnpm** ≥ 9.12
- 一个可运行的 Vite + React 19 应用（`pnpm create vite my-app --template react-ts`）
- 支持 `OffscreenCanvas`、`createImageBitmap` 与 OPFS 的现代浏览器（Chrome 102+ / Edge 102+ / Safari 16.4+ / Firefox 111+）

## 1. 安装包

```bash
pnpm add @lokvis/sdk @lokvis/plugin-image @lokvis/ui-react
```

| 包 | 职责 |
|---|---|
| `@lokvis/sdk` | `createLokvis()` 工厂 + `loadPlugin()` + `LokvisError` 类型 |
| `@lokvis/plugin-image` | 官方图像插件：9 个图像能力 + EXIF reader |
| `@lokvis/ui-react` | `<Workspace />` React 组件 + `useLokvis()` 钩子 |

`@lokvis/sdk` 和 `@lokvis/plugin-image` 已被 `@lokvis/ui-react` 传递性引入，但显式安装能让导入路径更短、意图更清晰。

## 2. 最小宿主应用

`src/main.tsx` —— 标准 Vite 入口，无任何 Lokvis 特定内容：

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

`src/App.tsx` —— 挂载 `<Workspace />` 并预加载图像插件：

```tsx
import { Workspace } from '@lokvis/ui-react';
import { imageToolsPlugin } from '@lokvis/plugin-image';

const plugins = [imageToolsPlugin()];

export default function App() {
  return (
    <Workspace
      title="My Image Tools"
      plugins={plugins}
      showStatusBar
    />
  );
}
```

这就是完整的集成。`<Workspace />` 组件会初始化 Runtime、连接 Redux store、挂载资产 / Canvas / 检视面板，并渲染流水线条。插件在模块作用域一次性传入，以免每次渲染都重新创建。

## 3. Workspace props

`<Workspace />` 接受下列 `enable*` props 以开关各子系统。除非另注，默认均为 `true`。

| Prop | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `title` | `string` | — | 顶部工具栏标题 |
| `showStatusBar` | `boolean` | `true` | 底部状态栏（存储用量、Runtime 状态） |
| `enableWorkflowEditor` | `boolean` | `false` | 拖拽式工作流编辑器；为 `false` 时回退到只读 `PipelineBar` |
| `enableCommandPalette` | `boolean` | `true` | ⌘K 命令面板 |
| `enableCompare` | `boolean` | `true` | Canvas 上的前后对比滑块 |
| `enableGlobalDropzone` | `boolean` | `true` | 带 MIME 校验的全屏拖拽 |
| `enableDownloadPanel` | `boolean` | `true` | 工作流输出下载面板 |
| `enableThemeToggle` | `boolean` | `true` | 深色模式开关 |
| `enableProgressBar` | `boolean` | `true` | 进度条 + 取消按钮 |
| `enableErrorBanner` | `boolean` | `true` | 带 `LokvisError` 错误码的错误横幅 |
| `enableShareLink` | `boolean` | `true` | `?workflow=<base64url>` 分享链接按钮 |
| `plugins` | `PluginLoadEntry[]` | `[]` | Runtime 初始化时加载的插件 |
| `lokvisOptions` | `UseLokvisOptions` | `{}` | 转发给 `useLokvis()`（Runtime 配置） |

```tsx
<Workspace
  title="Minimal Tools"
  plugins={[imageToolsPlugin()]}
  enableWorkflowEditor={false}
  enableCommandPalette={false}
  enableCompare
  enableGlobalDropzone
  enableDownloadPanel
/>
```

## 4. `useLokvis` 钩子

若你需要直接访问 `LokvisRuntime`（例如从自己的 UI 调用 `importAsset`、`run` 或 `readAssetExif`），可使用 `useLokvis()` 钩子来替代或配合 `<Workspace />`：

```tsx
import { useLokvis } from '@lokvis/ui-react';
import { imageToolsPlugin } from '@lokvis/plugin-image';

function MyPanel() {
  const { runtime, status, error } = useLokvis({
    plugins: [imageToolsPlugin()],
    storageQuota: 1024 * 1024 * 1024, // 1 GB
    memoryBudget: 512 * 1024 * 1024,  // 512 MB
  });

  if (status === 'initializing') return <p>Loading…</p>;
  if (status === 'error') return <p>Failed: {error}</p>;
  if (!runtime) return null;

  return (
    <button onClick={() => runtime.capabilities().then(caps => console.log(caps))}>
      List capabilities
    </button>
  );
}
```

该钩子保证每个组件生命周期内只存在一个 Runtime 实例（`initRef` 守卫），暴露 `idle | initializing | ready | error` 状态，并通过 `useWorkspaceStore.init(rt)` 把得到的 Runtime 转发给 Redux store。

## 5. 为 SharedArrayBuffer 配置 COOP/COEP 头

图像引擎在 Web Worker 中运行重活（解码 / 绘制 / 编码）。为给未来多线程 WASM 引擎启用 `SharedArrayBuffer`，宿主文档必须处于**跨源隔离**状态：

### Vite 开发服务器

在 `vite.config.ts` 中：

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
```

### 生产环境（Cloudflare Pages / Netlify `_headers`）

```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

### 验证

打开 DevTools → Console 并运行：

```js
console.log(typeof SharedArrayBuffer); // 应用了 COOP/COEP 时为 'function'
```

若打印 `'undefined'`，说明缺少头。Lokvis 此情况下仍能工作（Canvas 引擎不要求 `SharedArrayBuffer`），但未来的 WASM 引擎（Squoosh、ffmpeg.wasm）将不可用。

## 6. 运行应用

```bash
pnpm dev
```

打开打印出的 URL，把一张图像拖到 Workspace 上，resize / compress / convert 工具应即生效。

## 后续步骤

- [Quick Actions 一键工具](./quick-actions) —— 用三层 API 嵌入单一用途的工具(压缩 / 缩放 / 转换 / 水印 / 裁剪 / pipeline),替代完整 `<Workspace />`。
- [编写你的第一个插件](./write-first-plugin) —— 声明一个能力、包装一个引擎操作、通过 `definePlugin()` 注册。
- [自定义 Workspace](./custom-workspace) —— 仅用 `@lokvis/sdk`（无 React UI）构建最小工作台。
- [SDK 参考](../sdk) —— 完整的 `LokvisRuntime` API 表。
