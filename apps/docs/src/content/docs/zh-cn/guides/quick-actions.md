---
title: Quick Actions 集成指南
description: 使用三层架构集成 Lokvis Quick Actions（Compress / Resize / Convert / Watermark / Crop / Pipeline）—— 从零配置默认 UI 到完全 headless hooks，按你的用例选择集成深度。
draft: false
head: []
---

# Quick Actions 集成指南

Quick Actions 是一组有主见的、单一用途的图像工具——Compress、Resize、Convert、Watermark、Crop 与 Pipeline——构建在**三层架构**之上，第三方可以按需选择集成深度。

> **状态：Alpha。** Quick Action API 目前随 playground 应用一同发布。要在宿主应用中使用，当前需把 `apps/playground/src/components/tools/quick/` 目录拷贝到你的项目里。未来计划提供独立的 `@lokvis/quick-image` 包（见 [§6 路线图](#_6-已知局限与路线图)）。

## 架构概览

```
┌──────────────────────────────────────────────────────┐
│ Layer 2  ImageQuickCompress  (default UI, Tailwind)  │  ← zero-config
├──────────────────────────────────────────────────────┤
│ Layer 1  QuickCompress.Root / Upload / Preview / ... │  ← unstyled primitives
├──────────────────────────────────────────────────────┤
│ Layer 0  useQuickCompress()  (headless hook)         │  ← pure logic
└──────────────────────────────────────────────────────┘
```

每一层构建在下一层之上。各层**可替换**：Layer 2 组合 Layer 1，Layer 1 消费 Layer 0。你可以在任意层切入，并替换其上方的任何东西。

| 层 | 你能得到什么 | 你需要写什么 | 何时停在此处 |
|---|---|---|---|
| **Layer 2** | 带 Tailwind、i18n、ErrorBoundary 的默认 UI | `<ImageQuickCompress />`（1 行） | "样子够好，我只是想换主题" |
| **Layer 1** | 带行为（拖拽、ARIA、状态）的无样式 primitive | `<QuickCompress.Root>...</QuickCompress.Upload>...` | "我要完全的布局掌控，默认逻辑够用" |
| **Layer 0** | Headless hook（状态、预设、runtime、回调） | 你自己的 JSX 消费 `useQuickCompress()` | "我要完全不同的 UI，或干脆无 UI" |

## 六个工具

| 工具 | Hook | 能力 | 输出 |
|---|---|---|---|
| Compress | `useQuickCompress` | `image.compress` | 更小的 WebP（q65/80/92） |
| Resize | `useQuickResize` | `image.resize` | 固定尺寸（1280/1920/IG 1:1/Story 9:16） |
| Convert | `useQuickConvert` | `image.convert` | PNG / WebP / AVIF / JPEG |
| Watermark | `useQuickWatermark` | `image.watermark` | 文字覆盖（品牌 / 版权 / 自定义） |
| Crop | `useQuickCrop` | `image.crop` | 方形 / 4:3 / 16:9 / 自由 |
| Pipeline | `useImagePipeline` | 多步工作流 | 电商 / 社媒 / 缩略图 / 博客预设 |

六个工具共享同一个 hook 契约（`UseQuickActionOptions`）与同一个 primitive 形态（8 个 slot：Root / Upload / PresetSwitcher / Preview / [工具特定] / DownloadButton / ErrorDisplay / ResetButton）。

## 集成路径（自由度递增）

### 路径 1 — 零配置默认 UI

放入 `<ImageQuickCompress />`，你就得到一个完整的卡片 UI：上传、预设切换器、前后对比预览、压缩率、下载、重置与错误显示。内置的 `ErrorBoundary` 捕获任何运行时错误并优雅降级。

```tsx
import { ImageQuickCompress } from './tools/quick';

export function MyPage() {
  return <ImageQuickCompress />;
}
```

六个工具都遵循同一模式：`ImageQuickCompress`、`ImageQuickResize`、`ImageQuickConvert`、`ImageQuickWatermark`、`ImageQuickCrop`、`ImageQuickPipeline`。

#### 通用 props（全部 6 个工具）

| Prop | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `className` | `string` | `''` | 追加到根 div |
| `style` | `CSSProperties` | — | 在主题 CSS 变量之后合并 |
| `theme` | `QuickTheme` | — | 主题 token → CSS 变量（见 [主题指南](./quick-actions-theme)） |
| `components` | `Partial<QuickXxxComponents>` | — | Slot 替换（见 [路径 4](#路径-4--组件-slot-替换)） |
| `showPresetSwitcher` | `boolean` | `true` | 隐藏预设单选组 |
| `showBeforeAfter` | `boolean` | `true` | 在输出旁显示输入预览 |
| `showDownloadButton` | `boolean` | `true` | 隐藏下载按钮 |
| `showResetButton` | `boolean` | `true` | 隐藏重置按钮 |
| `initialPreset` | `Preset` | 工具默认 | 初始预设选择 |
| `autoRun` | `boolean` | `true` | 上传后自动运行 |
| `onComplete` | `(result: QuickActionResult) => void` | — | 每次产生新输出 Blob 时触发 |
| `inputBlob` | `Blob \| null` | — | 注入输入（用于工具链式调用） |

工具特定 props：`showRatio`（Compress）、`showFormat`（Convert）、`showDimension`（Resize）、`showTextInput`（Watermark）、`showCropArea`（Crop）、`showStepList`（Pipeline）。

### 路径 2 — 主题定制

传入 `theme` 对象即可在不触碰 CSS 的情况下为整张卡片重新配色：

```tsx
<ImageQuickCompress
  theme={{
    primary: '#0ea5e9',
    surface: '#0f172a',
    success: '#22c55e',
    radius: '0.75rem',
  }}
/>
```

13 个主题 token 映射到 `--lokvis-*` CSS 变量。未指定的 token 回退到 CSS 默认值（定义在 `global.css`）。完整 token 列表、暗色模式说明与 CSS 变量覆盖路径，参见 [主题定制指南](./quick-actions-theme)。

### 路径 3 — CSS 变量覆盖（无 JS）

如果你只需重新配色、且更偏好 CSS 而非 `theme` prop，可在根类上覆盖 CSS 变量：

```css
.my-app .lokvis-quick-compress {
  --lokvis-primary: #0ea5e9;
  --lokvis-surface: #0f172a;
  --lokvis-radius: 0.75rem;
}
```

根 div 自带 `lokvis-quick-compress` / `lokvis-quick-resize` / ... 类正是为此设计。该路径无需 `!important` —— 变量级联自然胜出。

### 路径 4 — 组件 slot 替换

通过 `components` prop 替换 7 个内部子组件中的任意一个（Root 不可替换）：

```tsx
<ImageQuickCompress
  components={{
    UploadBox: MyUploadBox,
    DownloadButton: MyDownloadButton,
    // Other slots fall back to defaults
  }}
/>
```

每个工具的 7 个 slot：

| Slot | 默认角色 | Slot props |
|---|---|---|
| `UploadBox` | 拖拽区 + 文件选择器 | `{ className?, style?, children? }` |
| `PreviewBox` | 图像预览（输入或输出） | `{ type: 'input' \| 'output', className?, style? }` |
| `PresetSwitcher` | 预设单选组 | `{ className?, style? }` |
| `DownloadButton` | 下载触发器 | `{ className?, style?, children? }` |
| `ErrorDisplay` | 错误消息 | `{ className?, style? }` |
| `ResetButton` | 重置触发器 | `{ className?, style?, children? }` |
| 工具特定 | `RatioBadge` / `FormatBadge` / `DimensionBadge` / `TextInput` / `CropAreaBox` / `StepListBox` | `{ className?, style? }` |

> **已知局限：**slot 替换当前只接收 `{ className, style, children }`——它们**不会**收到 hook 状态（preset、busy、error、inputUrl、outputUrl）。如果你自定义的 `PresetSwitcher` 需要知道当前 preset，请改用 [路径 6](#路径-6--完全-headless-hook)。为 slot props 补充状态已在路线图上（见 [§6](#_6-已知局限与路线图)）。

### 路径 5 — Primitive 组合（Radix 风格）

下到 Layer 1，自己组合无样式 primitive。每个 primitive 已内置行为（拖拽、ARIA、键盘、状态订阅），但没有样式——布局由你掌控。

```tsx
import { QuickCompress } from './tools/quick';

export function MyCompressCard() {
  return (
    <QuickCompress.Root autoRun onComplete={(r) => console.log(r.outputSize)}>
      <QuickCompress.Upload
        className="my-upload"
        accept="image/*"
      >
        {({ isDragging }) => (isDragging ? 'Drop it' : 'Click or drop')}
      </QuickCompress.Upload>

      <QuickCompress.PresetSwitcher
        renderButton={(preset, isSelected, onClick) => (
          <button
            key={preset}
            onClick={onClick}
            className={isSelected ? 'active' : ''}
          >
            {preset}
          </button>
        )}
      />

      <div className="my-preview-row">
        <QuickCompress.Preview type="input" />
        <QuickCompress.Preview type="output" />
      </div>

      <QuickCompress.RatioBadge />
      <QuickCompress.DownloadButton fileName="compressed" />
      <QuickCompress.ErrorDisplay />
      <QuickCompress.ResetButton>Try another</QuickCompress.ResetButton>
    </QuickCompress.Root>
  );
}
```

每个 primitive 从 `<QuickCompress.Root>` 提供的 React Context 读取状态。在 `<Root>` 之外调用 primitive 会抛错。每个工具的 8 个 primitive：

| Primitive | 职责 |
|---|---|
| `Root` | 提供 context，调用 Layer 0 hook |
| `Upload` | 拖拽 + 点击 + 键盘选择文件 |
| `PresetSwitcher` | 渲染预设按钮，支持 `renderButton` 全控渲染 |
| `Preview` | 渲染输入或输出的 `<img>`，带元数据 caption |
| 工具特定 | `RatioBadge` / `FormatBadge` / `DimensionBadge` / `TextInput` / `CropArea` / `StepList` |
| `DownloadButton` | 触发 `downloadBlob()` 并自动加扩展名 |
| `ErrorDisplay` | 渲染状态中的 `error` 或 `initError` |
| `ResetButton` | 触发 `reset()`，空状态时禁用 |

### 路径 6 — 完全 headless hook

下到 Layer 0，完全自己掌控 UI。Hook 给你状态、动作与回调——没有任何 React 组件。

```tsx
import { useQuickCompress } from './tools/quick';

export function MyHeadlessCompress() {
  const {
    ready,
    busy,
    error,
    inputUrl,
    outputUrl,
    outputBlob,
    ratio,
    preset,
    setPreset,
    handleFiles,
    reset,
    clearError,
    run,
  } = useQuickCompress({
    initialPreset: 'balanced',
    autoRun: true,
    onComplete: (result) => {
      console.log(`Compressed: ${result.inputSize} → ${result.outputSize} bytes`);
    },
  });

  if (!ready) return <p>Loading runtime…</p>;

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))}
      />
      <select value={preset} onChange={(e) => setPreset(e.target.value as any)}>
        <option value="balanced">Balanced</option>
        <option value="highQuality">High Quality</option>
        <option value="small">Small</option>
      </select>
      {busy && <p>Processing…</p>}
      {error && <p role="alert">{error}</p>}
      {ratio !== null && <p>Saved {ratio.toFixed(1)}%</p>}
      {inputUrl && <img src={inputUrl} alt="input" />}
      {outputUrl && <img src={outputUrl} alt="output" />}
      {outputBlob && (
        <a href={outputUrl!} download={`compressed.${outputBlob.type.split('/')[1]}`}>
          Download
        </a>
      )}
      <button onClick={reset}>Reset</button>
    </div>
  );
}
```

#### Hook 返回值（6 个工具共享大部分字段）

| 字段 | 类型 | 描述 |
|---|---|---|
| `ready` | `boolean` | Runtime 已初始化 |
| `initError` | `string \| null` | Runtime 初始化失败 |
| `inputUrl` | `string \| null` | 用于预览的 Object URL |
| `inputInfo` | `ImageInfo \| null` | `{ width, height, size, format }` |
| `outputUrl` | `string \| null` | 用于预览的 Object URL |
| `outputInfo` | `ImageInfo \| null` | 输出元数据 |
| `outputBlob` | `Blob \| null` | 输出 Blob |
| `busy` | `boolean` | 正在处理 |
| `error` | `string \| null` | 工作流执行错误 |
| `preset` | `Preset` | 当前预设 |
| `setPreset` | `(p: Preset) => void` | 切换预设（若已有输入则自动重跑） |
| `handleFiles` | `(files: File[]) => Promise<void>` | 从文件选择器 / 拖拽设置输入 |
| `reset` | `() => void` | 清空输入与输出 |
| `clearError` | `() => void` | 清空错误状态 |
| `run` | `() => Promise<void>` | 手动触发（当 `autoRun: false` 时） |
| `ratio`（Compress） | `number \| null` | 压缩率（-100 ~ 100） |
| `cropRect`（Crop） | `CropRect \| null` | 当前裁剪区域 |
| `setCropRect`（Crop） | `(r: CropRect) => void` | 更新裁剪区域 |
| `watermarkText`（Watermark） | `string` | 当前水印文字 |
| `setWatermarkText`（Watermark） | `(t: string) => void` | 更新文字 |
| `steps`（Pipeline） | `PipelineStepOutput[]` | 每步中间结果 |
| `currentStep`（Pipeline） | `number` | 当前执行的步骤索引 |
| `workflow`（Pipeline） | `Workflow` | 已构造的流水线工作流 |

## 把工具链成自定义流水线

`inputBlob` 选项让一个工具的输出可以喂给另一个工具的输入。配合 `onComplete`，你可以把 Quick Actions 串成临时流水线：

```tsx
function ChainedTools() {
  const [compressed, setCompressed] = useState<Blob | null>(null);
  const [watermarked, setWatermarked] = useState<Blob | null>(null);

  const compress = useQuickCompress({
    onComplete: (r) => setCompressed(r.outputBlob),
  });
  const watermark = useQuickWatermark({
    inputBlob: compressed,           // ← feed compress output
    onComplete: (r) => setWatermarked(r.outputBlob),
  });

  return (
    <>
      <ImageQuickCompress {...compress} />
      <ImageQuickWatermark {...watermark} />
      {watermarked && <a href={URL.createObjectURL(watermarked)} download="final.webp">Download</a>}
    </>
  );
}
```

对于预定义的多步流水线（电商 / 社媒 / 缩略图 / 博客），改用 `useImagePipeline`——它会构造一个多节点 `Workflow`，并通过单次 `runtime.run()` 调用暴露 `steps[]` 与每步中间结果。

## 国际化

Layer 2 组件从 i18n 字典（`apps/playground/src/i18n/ui.ts`）读取翻译。翻译 key 遵循 `quickCompress.*`、`quickResize.*`、`quickConvert.*`、`quickWatermark.*`、`quickCrop.*`、`quickPipeline.*` 模式。

目前支持的语言：English（默认）、简体中文、日本語、Español、Deutsch、Français。

> **已知局限：**`Language` 类型是 6 个字符串的封闭联合，字典是 const，不是运行时注册表。新增语言（例如韩语）当前需编辑 `i18n/config.ts` + `i18n/ui.ts`。Layer 2 组件上没有 `labels` prop 来覆盖单条字符串。运行时翻译注册 API 已在路线图上。如果你需要非支持语言，目前请用 [路径 5](#路径-5--primitive-组合radix-风格) 或 [路径 6](#路径-6--完全-headless-hook) 渲染你自己的字符串。

## 可访问性

所有 Layer 1 与 Layer 2 组件都自带 ARIA：

- `Upload` 是 `role="button"`，带 `aria-disabled`、`aria-label`，键盘（Enter / Space）激活，以及拖拽状态。
- `PresetSwitcher` 是 `role="radiogroup"`，带 `aria-label`；每个预设按钮是 `role="radio"`，带 `aria-checked`。
- `Preview` 有 `aria-label="input/output preview"`。
- `DownloadButton` 与 `ResetButton` 是 `type="button"`。
- `ErrorDisplay` 是 `role="alert"`。
- `RatioBadge` / `FormatBadge` / `DimensionBadge` 是 `role="status"`。
- `CropArea` 是 `role="img"`，带描述裁剪区域的 `aria-label`。
- `StepList` 是 `<ol role="list">`，每步带描述 running / pending / done 状态的 `aria-label`。

当你通过 `components`（路径 4）替换 slot 时，请在你的替换组件里保留这些 ARIA 语义以保持可访问性。

## 6. 已知局限与路线图

Quick Action API 处于 **Alpha** 阶段——三层架构已稳定，但若干扩展面仍是封闭的。第三方可能遇到的已知缺口：

| 缺口 | 临时方案 | 计划 |
|---|---|---|
| 未打包为 `@lokvis/quick-image` | 把 `tools/quick/` 目录拷贝到你的项目 | 在 Phase 2 抽取为已发布包 |
| 封闭的预设注册表（无法通过 props 添加自定义预设） | 用 Layer 0 hook + 你自己的预设状态 + `run()` | 在 Phase 2 给 Layer 2 添加 `presets` prop |
| 封闭的 i18n（6 种硬编码语言，无运行时注册） | 用 Layer 0/1 渲染你自己的字符串 | 在 Phase 2 添加 `labels` prop + 运行时注册 |
| Slot 替换不收 hook 状态 | 直接用 Layer 0/1 | 在 Phase 2 给 slot props 补充 `{ state }` |
| 无 `onError` / `onProgress` 回调 | 轮询 `error` 状态与 `busy` 布尔 | 在 Phase 2 添加回调 |
| 部分默认字符串绕过 i18n（预设标签、"Drop image" 等） | 通过 `components` prop 替换 slot | 在 Phase 2 把所有字符串接入 `t()` |

如果你遇到其中之一，请在 [github.com/lokvis/lokvis/issues](https://github.com/lokvis/lokvis/issues) 提 issue 描述你的用例——这有助于排定 Phase 2 的工作优先级。
