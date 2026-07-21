---
title: Quick Actions 一键工具
description: 用三层 API 嵌入单一用途的图片工具(compress / resize / convert / watermark / crop / pipeline)——零配置默认 UI、无样式原语、纯逻辑 hook。
draft: false
head: []
---

# Quick Actions 一键工具

Quick Actions 是预聚合的单一用途图片工具。每个工具把 Runtime 初始化、文件上传、`autoRun`、预设切换器与 `onComplete` 回调打包成一个单元 —— 用户拖入图片即可得到结果,无需调参。

它们以**三层 API** 形式提供,同一份功能可按 6 个自由度层级消费,从一行默认 UI 到纯逻辑 hook 任选。

## 何时使用 Quick Actions

| 维度 | `<Workspace />`(完整工作台) | Quick Actions(单一工具) |
|---|---|---|
| 适用场景 | 面向终端用户的多工具工作室 | 把单个工具(如压缩)嵌入宿主页面 |
| 包体积 | ~200 KB JS + React 19 | ~80–120 KB(Runtime + engine-image + 一个 Quick 层) |
| 定制能力 | `enable*` 开关 + 插件 | 6 条路径:theme / CSS 变量 / components / 原语 / hook |
| 布局 | 固定 Asset / Canvas / Inspector / Pipeline 面板 | 单张紧凑卡片,易嵌入 |
| Pipeline | 拖拽式 `WorkflowEditor` | 固定预设 pipeline(resize → compress → watermark) |

需要完整图像工作室时选 `<Workspace />`;只需在宿主页面里"压缩这张图"或"缩放到 IG 1:1"时选 Quick Action。

## 当前包状态

:::note
Quick Action 三层目前位于 `@lokvis/playground`(私有应用包)下的 `apps/playground/src/components/tools/quick/`,**尚未发布为独立 npm 包**。

按设计文档([`docs/reports/20260719-image-workspace-ui-design.md` §10.2](https://github.com/lokvis/lokvis/blob/main/docs/reports/20260719-image-workspace-ui-design.md))的规划,后续会抽离为独立的 `@lokvis/quick-image` 包,导出三个子路径:

```bash
pnpm add @lokvis/quick-image @lokvis/plugin-image
```

```ts
import ImageQuickCompress from '@lokvis/quick-image';                 // Layer 2
import { QuickCompress } from '@lokvis/quick-image/primitives';        // Layer 1
import { useQuickCompress } from '@lokvis/quick-image/hooks';          // Layer 0
```

抽离落地之前,下文示例统一用 `apps/playground/src/components/tools/quick/` 下的源码路径。集成方可直接复制相关源文件,或等待独立包发布。
:::

## 三层架构

```
┌─────────────────────────────────────────────────────────────────┐
│ Layer 2:默认 UI —— ImageQuickCompress / ImageQuickResize / …    │
│   Tailwind 样式卡片,内置 ErrorBoundary,接 i18n。               │
│   通过 theme prop、components prop、className/style 定制。       │
├─────────────────────────────────────────────────────────────────┤
│ Layer 1:无样式原语 —— QuickCompress.Upload / .Root / …          │
│   零内置样式。仅 ARIA + 数据 props + 回调。                      │
│   用自己的 class 拼出自己的 DOM。                                 │
├─────────────────────────────────────────────────────────────────┤
│ Layer 0:Headless Hook —— useQuickCompress() / useImagePipeline()│
│   纯逻辑:Runtime + autoRun + 预设 + onComplete。                │
│   任意 UI(React/Vue/Web Component/原生)均可基于此构建。        │
└─────────────────────────────────────────────────────────────────┘
```

每个 Quick 家族遵循同一契约:

| 家族 | Hook (L0) | 原语 (L1) | 默认 UI (L2) | 预设 |
|---|---|---|---|---|
| 压缩 | `useQuickCompress` | `QuickCompress.*` | `ImageQuickCompress` | balanced / highQuality / small |
| 缩放 | `useQuickResize` | `QuickResize.*` | `ImageQuickResize` | ig-square / yt-landscape / tk-portrait / half |
| 转换 | `useQuickConvert` | `QuickConvert.*` | `ImageQuickConvert` | png / webp / avif / jpeg |
| 水印 | `useQuickWatermark` | `QuickWatermark.*` | `ImageQuickWatermark` | small-br / large-center / tile |
| 裁剪 | `useQuickCrop` | `QuickCrop.*` | `ImageQuickCrop` | square / 4:3 / 16:9 / free |
| Pipeline | `useImagePipeline` | `QuickPipeline.*` | `ImageQuickPipeline` | ecommerce / social / thumbnail / blog |

## 六条接入路径

每条路径以便利换自由度。选择仍能满足定制需求的最低路径即可。

### 路径 1 —— 零配置(Layer 2 默认 UI)

```tsx
import { ImageQuickCompress } from '@/components/tools/quick';

export default function Demo() {
  return <ImageQuickCompress />;
}
```

直接放入,得到一张带样式的卡片:上传区、预设切换器、before/after 预览、压缩率徽章、下载按钮,以及 ErrorBoundary。适合 demo 与内部工具。

### 路径 2 —— 主题定制(Layer 2 + `theme` prop)

```tsx
<ImageQuickCompress
  theme={{
    primary: '#00ff00',
    background: '#1a1a1a',
    surface: '#0f0f0f',
    radius: '0',
    fontFamily: 'Inter, sans-serif',
  }}
/>
```

`theme` 对象被转换为根元素上的 CSS 变量。所有字段可选,未提供的字段回落到 `.lokvis-quick-compress` 上声明的默认值(见 `apps/playground/src/styles/global.css`)。

| 字段 | CSS 变量 | 默认值 |
|---|---|---|
| `primary` | `--lokvis-primary` | `#6366f1` |
| `primaryHover` | `--lokvis-primary-hover` | `#4f46e5` |
| `background` | `--lokvis-bg` | `transparent` |
| `surface` | `--lokvis-surface` | `#18181b` |
| `surfaceHover` | `--lokvis-surface-hover` | `#27272a` |
| `border` | `--lokvis-border` | `#27272a` |
| `text` | `--lokvis-text` | `#f4f4f5` |
| `textMuted` | `--lokvis-text-muted` | `#71717a` |
| `success` | `--lokvis-success` | `#10b981` |
| `warning` | `--lokvis-warning` | `#f59e0b` |
| `error` | `--lokvis-error` | `#ef4444` |
| `radius` | `--lokvis-radius` | `0.5rem` |
| `fontFamily` | `--lokvis-font-family` | `inherit` |

### 路径 3 —— 纯 CSS 覆盖(Layer 2 + CSS 变量)

无需 JS。在自己的样式表里覆盖根选择器上的变量:

```css
.lokvis-quick-compress {
  --lokvis-primary: #00ff00;
  --lokvis-bg: #1a1a1a;
  --lokvis-radius: 0;
  --lokvis-font-family: 'Inter', sans-serif;
}
```

适用于宿主页面已有设计系统、希望在不触碰 JS 的前提下给默认 UI 换皮的场景。

### 路径 4 —— 组件替换(Layer 2 + `components` prop)

逐个替换子组件 —— 例如改用 AntD 的 `Upload` 与 `Button`:

```tsx
import { Upload as AntDUpload, Button as AntDButton } from 'antd';
import { ImageQuickCompress } from '@/components/tools/quick';

<ImageQuickCompress
  components={{
    UploadBox: ({ className, style, children }) => (
      <AntDUpload className={className} style={style}>{children}</AntDUpload>
    ),
    DownloadButton: ({ className, style, children }) => (
      <AntDButton type="primary" className={className} style={style}>{children}</AntDButton>
    ),
  }}
/>
```

`ImageQuickCompress` 的完整替换面是 `QuickCompressComponents`:

```ts
interface QuickCompressComponents {
  UploadBox:      ComponentType<UploadBoxProps>;
  PreviewBox:     ComponentType<PreviewBoxProps>;
  PresetSwitcher: ComponentType<PresetSwitcherProps>;
  DownloadButton: ComponentType<DownloadButtonProps>;
  RatioBadge:     ComponentType<RatioBadgeProps>;
  ErrorDisplay:   ComponentType<ErrorDisplayProps>;
  ResetButton:    ComponentType<ResetButtonProps>;
}
```

每个 Quick 家族导出各自的 `*Components` 接口 —— 见 `apps/playground/src/components/tools/quick/index.ts` 的类型再导出。

### 路径 5 —— 原语组装(Layer 1)

拿无样式原语拼出自己的 DOM 与样式。原语提供行为 + ARIA,视觉全部由你定。

```tsx
import { QuickCompress } from '@/components/tools/quick';

function MyCustomCompress() {
  return (
    <QuickCompress.Root initialPreset="balanced" onComplete={(r) => console.log(r)}>
      <QuickCompress.Upload className="my-upload">点击或拖入图片</QuickCompress.Upload>
      <QuickCompress.PresetSwitcher className="my-switcher" />
      <QuickCompress.Preview type="input" className="my-input-preview" />
      <QuickCompress.Preview type="output" className="my-output-preview" />
      <QuickCompress.RatioBadge className="my-ratio" />
      <QuickCompress.DownloadButton className="my-btn">下载</QuickCompress.DownloadButton>
      <QuickCompress.ErrorDisplay className="my-error" />
      <QuickCompress.ResetButton className="my-reset">再试一张</QuickCompress.ResetButton>
    </QuickCompress.Root>
  );
}
```

原语规则:

- **零内置样式。** 每个原语接受 `className` / `style` / `children`,并把它们透传到根元素。
- **开箱 ARIA。** `Upload` 暴露 `role="button"` + 键盘处理;`PresetSwitcher` 暴露 `role="radiogroup"`;`ErrorDisplay` 暴露 `role="alert"`;`RatioBadge` 暴露 `role="status"`。
- **render-prop 逃生口。** `Upload` 的 `children` 可以是 `({ isDragging }) => ReactNode` 函数;`PresetSwitcher` 接受 `renderButton(preset, isSelected, onClick)`。
- **必须包在 Context 内。** 所有原语必须在 `<QuickCompress.Root>` 内使用(`Root` 调用 `useQuickCompress` 并通过 React Context 共享状态)。

### 路径 6 —— 完全 Headless(Layer 0 hook)

跳过 UI,自己驱动 Runtime:

```tsx
import { useQuickCompress } from '@/components/tools/quick';

function MyVueLikeCompress() {
  const {
    ready, initError,
    inputUrl, outputUrl, ratio,
    busy, error,
    preset, setPreset,
    handleFiles, reset, clearError, run,
  } = useQuickCompress({ initialPreset: 'balanced', onComplete: (r) => console.log(r) });

  if (initError) return <p>初始化失败:{initError}</p>;
  if (!ready) return <p>加载中…</p>;

  return (
    <div className="my-own-ui">
      <input type="file" onChange={(e) => e.target.files && handleFiles([...e.target.files])} />
      {busy && <p>处理中…</p>}
      {error && <p role="alert">{error}</p>}
      {inputUrl  && <img src={inputUrl}  alt="input" />}
      {outputUrl && <img src={outputUrl} alt="output" />}
      {ratio !== null && <span>{ratio >= 0 ? '节省' : '增大'} {Math.abs(ratio).toFixed(1)}%</span>}
      <select value={preset} onChange={(e) => setPreset(e.target.value as 'balanced' | 'highQuality' | 'small')}>
        <option value="balanced">均衡</option>
        <option value="highQuality">高质量</option>
        <option value="small">小体积</option>
      </select>
      <button onClick={reset}>重置</button>
      <button onClick={() => void run()} disabled={busy}>执行</button>
    </div>
  );
}
```

hook 在 6 个家族之间返回统一契约。完整字段列表见 [`useQuickCompress.ts`](https://github.com/lokvis/lokvis/blob/main/apps/playground/src/components/tools/quick/useQuickCompress.ts) 中的 `UseQuickCompressResult`。

## Hook 契约

所有单步 Quick hook 共享 `UseQuickActionOptions`:

```ts
interface UseQuickActionOptions<Preset extends string = string> {
  /** 初始预设(每个 hook 有自己的默认值) */
  initialPreset?: Preset;
  /** 上传后是否自动执行。默认 true。Pipeline 中间节点可设为 false */
  autoRun?: boolean;
  /** 每个唯一 output Blob 触发一次 —— 用于串联下一个 hook 或外部状态 */
  onComplete?: (result: QuickActionResult) => void;
  /** 注入输入 Blob(pipeline 模式:上一个 hook 的输出作为本 hook 输入) */
  inputBlob?: Blob | null;
}

interface QuickActionResult {
  outputBlob: Blob;
  outputUrl: string;
  inputSize: number;
  outputSize: number;
  preset: string;
}
```

`onComplete` 按 Blob 引用去重 —— 同一个 Blob 传两次只触发一次。这使得 `useQuickResize` → `useQuickCompress` 的串联不会重复执行。

## 主题系统

主题系统是双层(见 [`theme.ts`](https://github.com/lokvis/lokvis/blob/main/apps/playground/src/components/tools/quick/theme.ts)):

1. **`theme` prop** —— 程序化,JS 对象 → 根元素 CSS 变量。优先级最高。
2. **CSS 变量** —— 在自己的样式表里通过 `.lokvis-quick-* { --lokvis-*: ... }` 运行时覆盖。让宿主页面无需改 JS 即可换皮。

两层组合:`theme` prop 值优先于 CSS 变量默认值,`theme` 中省略的字段回落到 CSS 默认值。Layer 2 的 Tailwind 类名引用 `var(--lokvis-*)` 而非硬编码颜色,任意变量变更会自动传播。

## Pipeline 模式

`useImagePipeline` / `QuickPipeline` / `ImageQuickPipeline` 把多个图像 capability 串联成单个 workflow。与单步 hook 不同,pipeline 用 `WorkflowBuilder` 构造多节点 workflow,并读取 `result.stepOutputs` 暴露中间结果。

```tsx
import { useImagePipeline } from '@/components/tools/quick';

function MyPipeline() {
  const { busy, currentStep, steps, outputBlob, handleFiles } = useImagePipeline({
    initialPreset: 'ecommerce',
  });

  return (
    <div>
      <input type="file" onChange={(e) => e.target.files && handleFiles([...e.target.files])} />
      {busy && <p>执行第 {currentStep + 1} 步…</p>}
      {steps.map((step) => (
        <figure key={step.index}>
          <img src={step.url} alt={step.label} />
          <figcaption>{step.label}</figcaption>
        </figure>
      ))}
    </div>
  );
}
```

每个 `step` 是 `PipelineStepOutput`,含 `{ index, label, capability, blob, url, info }`。hook 还暴露底层 `workflow`(`WorkflowBuilder` 构造的 `Workflow`),便于自行渲染节点元数据。

内置预设:

| 预设 | 步骤 | 适用场景 |
|---|---|---|
| `ecommerce` | resize(1080) → compress(q80) → watermark(@brand) | 电商商品图 |
| `social` | resize(IG 1:1) → compress(q92) | Instagram 帖子 |
| `thumbnail` | resize(400) → compress(q65) | 列表预览图 |
| `blog` | resize(1200) → compress(q80) → watermark(@blog) | 博客文章插图 |

要定义自己的 pipeline,直接用 `WorkflowBuilder` 构造 `Workflow`(见 [`@lokvis/workflow`](https://github.com/lokvis/lokvis/blob/main/packages/workflow))并交给 `runtime.run`。`buildPipelineWorkflow(preset)` 只是一个把预设 key 映射到固定步骤列表的薄封装 —— 在 [`useImagePipeline.ts`](https://github.com/lokvis/lokvis/blob/main/apps/playground/src/components/tools/quick/useImagePipeline.ts) 的 `PIPELINE_PRESETS` 里加一项即可扩展新预设。

## COOP/COEP 头

与完整 `<Workspace />` 一样,Quick Actions 使用的图像引擎会在 Web Worker 内做重度 decode/draw/encode。要为未来的 WASM 引擎启用 `SharedArrayBuffer`,宿主文档必须跨源隔离:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Vite / Cloudflare Pages / Netlify 的配置见 [嵌入 SDK](./embed-sdk)(其中的"COOP/COEP headers for SharedArrayBuffer"小节)。Canvas 引擎不需要这些头也能工作;只有未来的 WASM 引擎才依赖它们。

## 已知限制

以下是当前三方接入方需要留意的差距。它们都已在设计文档中追踪,会在后续 PR 中处理。

1. **尚无独立 npm 包。** 六个家族全部位于 `@lokvis/playground`,并依赖 playground 内部辅助(`useImageTool`、`useLokvisRuntime`、`getImageInfo`、i18n)。当前只能复制源码。抽离为 `@lokvis/quick-image` 已在规划中。
2. **`useLokvisRuntime` 硬编码 `imageToolsPlugin`。** 三方若要在同一 Runtime 里把图像 Quick Action 与 audio / pdf / video 插件组合使用,必须 fork hook 或自行实现等价物。hook 上的 `plugins` 选项已在路线图上。
3. **Layer 2 默认 UI 拉 `apps/playground/src/i18n` 的文案。** 默认 UI 在 playground 内开箱即用;在 playground 之外,要么通过 `components` prop 替换承载文案的子组件,要么改用 Layer 1 / Layer 0。
4. **仅图像。** Quick 模式构建在 `useImageTool` + `buildSingleStepImageWorkflow` + `getImageInfo` 之上。尚无 `useQuickAudio` / `useQuickPdf` / `useQuickVideo` 家族。
5. **预设 pipeline 固定。** Phase C 提供 4 个预设 pipeline。可视化 pipeline 编辑器推迟到后续阶段 —— 暂时自定义多步 workflow 直接走 `WorkflowBuilder`。

## 下一步

- [嵌入 SDK](./embed-sdk) —— 多工具工作室的完整 `<Workspace />` 集成。
- [自定义工作台](./custom-workspace) —— 仅 Runtime,无 React UI。
- [编写第一个插件](./write-first-plugin) —— 给能力目录新增一项 capability。
