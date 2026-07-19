# Image Workspace UI 优化设计

**日期**: 2026-07-19
**状态**: 设计中(待 review)
**作者**: lokvis-open team
**关联**: Phase 2/3/4 任务计划(20260718-phase2-4-task-plan.md)

---

## 一、背景与现状

### 1.1 现有 Image Workspace 结构

当前 playground 的 image workspace 由 5 个独立工具页组成,每个工具页都是一个"重型"组件,要求用户手动配置 3-5 项参数:

| 工具 | 文件 | 主要参数 | 复杂度 |
|---|---|---|---|
| CompressTool | `apps/playground/src/components/tools/CompressTool.tsx` | 模式(质量/目标体积)/格式/质量/目标体积 | 中 |
| ResizeTool | `apps/playground/src/components/tools/ResizeTool.tsx` | 宽/高/比例/平台预设/DPI | 中 |
| ConvertTool | `apps/playground/src/components/tools/ConvertTool.tsx` | 目标格式/质量 | 低 |
| CropTool | `apps/playground/src/components/tools/CropTool.tsx` | 比例/区域 | 中 |
| WatermarkTool | `apps/playground/src/components/tools/WatermarkTool.tsx` | 文字/位置/字号/颜色/透明度 | 中 |

### 1.2 痛点分析

1. **学习成本高**:每个工具都需要用户理解参数语义(quality vs target size、fit 策略、position 9 宫格等),新手门槛高
2. **工具割裂**:工具之间无法快速组合,典型场景如 `resize → compress → watermark` 需要用户在 3 个工具页之间反复上传/下载
3. **嵌入笨重**:当前工具页依赖完整 ToolLayout(含 SEO + PrivacyBadge + Why use Lokvis 卡片),无法轻量嵌入外部站点
4. **缺少快速入口**:所有用户不论需求复杂度,都要走完整配置流程,无"一键"模式
5. **组件复用度低**:每个工具页都独立实现上传/预览/下载逻辑,虽有 `useImageTool` hook 抽象,但 UI 层仍重复

### 1.3 用户场景分析

| 场景 | 当前体验 | 期望体验 |
|---|---|---|
| 快速压缩一张图 | 进 CompressTool → 选模式 → 调 quality → 点压缩 → 下载 | 拖入图片 → 立即压缩 → 下载 |
| 适配 IG 正方形 | 进 ResizeTool → 选预设或填尺寸 → 执行 → 下载 | 拖入图片 → 选 "IG 1:1" → 下载 |
| 电商主图(裁剪+压缩+水印) | 进 3 个工具页,反复上传下载 | 上传一次 → pipeline 自动跑完 → 下载 |
| 嵌入第三方博客 | 不支持 | `<lokvis-quick-compress>` Web Component |

---

## 二、设计目标

根据用户需求"最聚合的模块,用户只用上传图片,根据已经设定好的 workflow 就可以直接快速完成相关的 image compress 操作",核心目标:

### 2.1 核心目标

| 目标 | 描述 | 验收标准 |
|---|---|---|
| **最聚合** | 单个功能模块(如 compress)自包含,不依赖外部上下文 | 单组件可独立运行,无需父组件提供状态 |
| **零配置** | 用户只需上传图片,预设 workflow 自动执行 | 上传后 ≤500ms 内开始处理,无需点击任何按钮 |
| **可独立嵌入** | 单组件可用于 .astro 页面 / iframe / 第三方站点 | 提供独立 .astro 页面 + embed 页面 + 可打包为 Web Component |
| **可组合** | 多个聚合模块可拼接成 pipeline | 支持 `onComplete` 回调串联,或 WorkflowBuilder 多节点 |

### 2.2 非目标(Out of Scope)

- ❌ 替换现有 CompressTool 等"重型"工具页(专业用户仍需精细参数)
- ❌ 实现新的 image 能力(复用现有 `image.compress` / `image.resize` 等 capability)
- ❌ 实现云端 AI 智能预设(本轮用固定预设,未来可扩展)
- ❌ 实现完整的图片编辑器(图层/滤镜/笔刷等不在范围内)

---

## 三、分层架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│ Layer 3: 完整 Tool(保留,Playground demo 站用)                  │
│   CompressTool / ResizeTool / ConvertTool / CropTool /          │
│   WatermarkTool                                                 │
│   → 专业用户,精细参数调整,5+ 项配置                             │
│   → 依赖完整 ToolLayout                                         │
├─────────────────────────────────────────────────────────────────┤
│ Layer 2: Pipeline 模式(新增,Playground demo 站用)             │
│   ImagePipeline                                                 │
│   → 单图多步串联(resize → compress → watermark)               │
│   → 用 WorkflowBuilder 构造多节点 workflow                       │
│   → 预设 pipeline(电商主图/社交分享/网页缩略图)                 │
├─────────────────────────────────────────────────────────────────┤
│ Layer 1: 默认 UI 组件(新增,Playground demo 站用)              │
│   ImageQuickCompress / ImageQuickResize / ...                   │
│   → 基于 Layer 0 hook 的默认 UI 实现                            │
│   → 内置 UploadBox/PreviewBox/ErrorBoundary                     │
│   → 仅给 Playground demo 站用,不面向三方接入                   │
├─────────────────────────────────────────────────────────────────┤
│ Layer 0: Headless Hook(新增,★ 最核心,三方接入可用)           │
│   useQuickCompress() / useQuickResize() / ...                   │
│   → 纯逻辑:runtime + autoRun + preset + onComplete             │
│   → 零 UI,三方接入可完全自定义 UI                              │
│   → 可基于此构建任意 UI(React/Vue/Web Component/原生)         │
└─────────────────────────────────────────────────────────────────┘

三方接入路径:
  - 简单: <ImageQuickCompress /> 默认 UI(未来打包为 Web Component)
  - 定制: useQuickCompress() hook + 自定义 UI
  - 深度: 直接调用 @lokvis/sdk 的 runtime + WorkflowBuilder
```

### 3.1 设计原则

1. **逻辑与 UI 分离**:Layer 0 是纯逻辑 hook,Layer 1 是默认 UI 实现。三方接入时可用 hook 自定义 UI,不被内置 UI 绑架
2. **单向依赖**:Layer 0 不依赖任何 UI;Layer 1 依赖 Layer 0;Layer 2/3 独立保留
3. **复用基础设施**:所有层都复用 `useImageTool`(或其变体)+ `buildSingleStepImageWorkflow` / `WorkflowBuilder`
4. **ErrorBoundary 包裹**:Layer 1 默认 UI 组件内置 ErrorBoundary(符合 AGENTS.md 硬约束);Layer 0 hook 不含 ErrorBoundary(由调用方决定)
5. **不做卡片式并行工作台**:批量场景已有 BatchQueue(并发 4 池),多步操作走 Pipeline,卡片式并行无强诉求场景

### 3.2 为什么不做卡片式并行工作台

原设计 5.1 的"卡片式工作台(并行模式)"经审视后**砍掉**,原因:

| 用户场景 | 已有方案 | 卡片式是否更优 |
|---|---|---|
| 多张图做同一种操作(如批量压缩) | BatchQueue(并发 4 池 + 进度追踪) | 否,BatchQueue 更专业 |
| 一张图走多步操作(如 resize+compress+watermark) | Pipeline 模式(QW-2) | 否,Pipeline 是串联 |
| 一张图做一种操作 | 单个 Quick Action | 无需卡片式 |
| 同时压缩+缩放+转换+水印(4 种不同操作) | 无 | 罕见场景,非真实诉求 |

卡片式并行更像是"功能展示橱窗"而非真实用户场景,Phase C 仅保留 Pipeline 模式。

---

## 四、Headless Hook + 默认 UI 设计(Layer 0 + Layer 1)

### 4.1 设计动机:逻辑与 UI 分离

原设计把 UI 逻辑(header / 预设切换器 / before/after 对比 / 下载按钮 / ErrorBoundary)全部内置到 `ImageQuickCompress` 组件,存在以下问题:

1. **三方接入受限**:接入方有自己的设计系统(Material/AntD/自定义),内置 UploadBox/PreviewBox 会样式冲突,无法替换子组件
2. **布局耦合**:三方可能只要"压缩"逻辑 + 压缩率数字,不要 before/after 对比;或只要输出 Blob,不要预览图
3. **违背"最聚合"目标**:聚合应该是**逻辑聚合**(runtime + autoRun + preset + onComplete),而非 UI 聚合

**修正方案**:分离 Layer 0(Headless Hook,纯逻辑)和 Layer 1(默认 UI 组件,仅 Playground 用)。

### 4.2 Layer 0:Headless Hook 接口设计

#### 4.2.1 通用接口契约

所有 `useQuick<Tool>` hook 遵循统一契约:

```typescript
/**
 * Quick Action Hook 通用 Props。
 * 所有 useQuick<Tool> hook 都接受此接口(具体 Preset 类型各 hook 自定义)。
 */
export interface UseQuickActionOptions<Preset extends string = string> {
  /** 初始预设,默认各 hook 自有默认值 */
  initialPreset?: Preset;
  /** 是否自动执行(默认 true;pipeline 中间节点可能需要手动触发) */
  autoRun?: boolean;
  /** 完成回调(可串联到下一个 hook / 外部状态) */
  onComplete?: (result: QuickActionResult) => void;
  /** 注入输入(用于 pipeline 模式:上一个 hook 的输出作为本 hook 输入) */
  inputBlob?: Blob | null;
}

export interface QuickActionResult {
  outputBlob: Blob;
  outputUrl: string;
  inputSize: number;
  outputSize: number;
  preset: string;
}
```

#### 4.2.2 useQuickCompress 详细设计

```typescript
/**
 * useQuickCompress — 图片一键压缩的纯逻辑 hook,无 UI。
 *
 * 三方接入时可完全自定义 UI,只复用逻辑:
 *   - runtime 初始化(复用 useLokvisRuntime)
 *   - 文件上传 → importAsset
 *   - autoRun(上传即执行)
 *   - 预设切换 + 自动重跑
 *   - onComplete 回调
 *
 * @example 三方自定义 UI
 * ```tsx
 * function MyCustomCompress() {
 *   const { inputUrl, outputUrl, ratio, busy, error, handleFiles, preset, setPreset } = useQuickCompress();
 *   return (
 *     <div className="my-own-ui">
 *       <input type="file" onChange={(e) => e.target.files && handleFiles([...e.target.files])} />
 *       {busy && <MySpinner />}
 *       {error && <MyError text={error} />}
 *       {inputUrl && <img src={inputUrl} />}
 *       {outputUrl && <img src={outputUrl} />}
 *       {ratio !== null && <span>{ratio.toFixed(1)}%</span>}
 *       <select value={preset} onChange={(e) => setPreset(e.target.value as CompressPreset)}>
 *         <option value="balanced">均衡</option>
 *         <option value="highQuality">高质量</option>
 *         <option value="small">小体积</option>
 *       </select>
 *     </div>
 *   );
 * }
 * ```
 */
export type CompressPreset = 'balanced' | 'highQuality' | 'small';

export interface UseQuickCompressResult {
  // 状态
  ready: boolean;
  initError: string | null;
  inputUrl: string | null;
  inputInfo: ImageInfo | null;
  outputUrl: string | null;
  outputInfo: ImageInfo | null;
  outputBlob: Blob | null;
  busy: boolean;
  error: string | null;
  preset: CompressPreset;
  /** 压缩率(-100 ~ 100,负值表示增大;null 表示无输出) */
  ratio: number | null;

  // 操作
  handleFiles: (files: File[]) => Promise<void>;
  setPreset: (preset: CompressPreset) => void;
  reset: () => void;
  clearError: () => void;
  /** 手动触发执行(autoRun=false 时用) */
  run: () => Promise<void>;
}

export function useQuickCompress(options?: UseQuickActionOptions<CompressPreset>): UseQuickCompressResult;
```

#### 4.2.3 预设配置

| 预设 key | quality | format | 适用场景 | 文件大小预期 |
|---|---|---|---|---|
| `balanced` | 80 | WebP | 通用场景(默认) | 中等,质量与体积均衡 |
| `highQuality` | 92 | WebP | 高质量需求(摄影/设计) | 较大,接近原图质量 |
| `small` | 65 | WebP | 极限压缩(网页缩略图/预览) | 最小,可见画质损失 |

**为什么选 WebP**:浏览器原生支持,压缩率优于 JPEG/PNG,Playground 已有完整 `image.compress` capability 支持。

#### 4.2.4 行为流程(纯逻辑,无 UI)

```
┌─────────────────────────────────────────────────────────┐
│ 1. 调用方调用 handleFiles(files)                        │
│    ↓                                                    │
│ 2. runtime.importAsset({ kind: 'file', file })          │
│    ↓                                                    │
│ 3. autoRun=true 时,effect 检测 inputId 变化自动触发     │
│    autoRun=false 时,等待调用方调用 run()                │
│    ↓                                                    │
│ 4. buildSingleStepImageWorkflow(                        │
│      'image.compress',                                  │
│      { format: 'webp', quality: PRESET_QUALITY[preset] }│
│    )                                                    │
│    ↓                                                    │
│ 5. runtime.run(wf, [inputId]) → exportAsset             │
│    ↓                                                    │
│ 6. 更新 outputBlob/outputUrl/ratio 状态                 │
│    ↓                                                    │
│ 7. onComplete 回调触发(可串联到下一个 hook)             │
└─────────────────────────────────────────────────────────┘
```

#### 4.2.5 autoRun 机制(关键)

为避免重复触发 / 死循环,用 `useRef` 标记"已对当前 inputId 触发过压缩":

```typescript
const lastRunInputId = useRef<string | null>(null);

useEffect(() => {
  // 仅在 inputId 变化时触发一次,preset 变化不自动重跑
  if (tool.inputId && tool.ready && autoRun && lastRunInputId.current !== tool.inputId) {
    lastRunInputId.current = tool.inputId;
    void runCompress(preset);
  }
  // inputId 被重置(reset)时清空标记
  if (!tool.inputId) {
    lastRunInputId.current = null;
  }
}, [tool.inputId, tool.ready, autoRun, preset, runCompress]);

// 手动切换预设后立即重跑(已有输入时)
const handlePresetChange = useCallback((next: CompressPreset) => {
  setPreset(next);
  if (tool.inputId && !tool.busy) {
    lastRunInputId.current = tool.inputId;
    void runCompress(next);
  }
}, [tool.inputId, tool.busy, runCompress]);
```

### 4.3 Layer 1:默认 UI 组件(仅 Playground 用)

#### 4.3.1 设计定位

| 维度 | Layer 0 (Hook) | Layer 1 (默认 UI) |
|---|---|---|
| 目标用户 | 三方接入 / 自定义 UI | Playground demo 站 |
| 包含 UI | 否(纯逻辑) | 是(UploadBox/PreviewBox/ErrorBoundary) |
| 可定制性 | 完全自由 | 仅 className / showPresetSwitcher |
| 复用范围 | 任意 React 项目 | 仅 Playground |

#### 4.3.2 ImageQuickCompress 默认 UI

```typescript
/**
 * ImageQuickCompress — Playground 默认 UI 实现。
 *
 * 基于 useQuickCompress hook,内置:
 *   - ErrorBoundary 包裹(符合 AGENTS.md 硬约束)
 *   - UploadBox / PreviewBox 组件
 *   - 预设切换器
 *   - before/after 对比 + 压缩率 + 下载按钮
 *
 * 仅给 Playground demo 站用,三方接入请用 useQuickCompress hook。
 *
 * @example Playground 内部用
 * ```tsx
 * <ImageQuickCompress initialPreset="balanced" />
 * ```
 *
 * @example 三方接入(自定义 UI)
 * ```tsx
 * const { inputUrl, outputUrl, ratio, busy, handleFiles, preset, setPreset } = useQuickCompress();
 * // 用自己的 UI 组件渲染...
 * ```
 */
export interface ImageQuickCompressProps {
  initialPreset?: CompressPreset;
  className?: string;
  showPresetSwitcher?: boolean;
  onComplete?: (result: QuickActionResult) => void;
}

export default function ImageQuickCompress(props: ImageQuickCompressProps) {
  return (
    <ErrorBoundary>
      <ImageQuickCompressDefault {...props} />
    </ErrorBoundary>
  );
}
```

#### 4.3.3 默认 UI 布局(紧凑卡片式)

```
┌───────────────────────────────────────────────────┐
│ 一键压缩                       [均衡][高质][小]    │  ← header(标题 + 预设切换)
│ 拖入图片 → 立即压缩为 WebP                        │
├───────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐                │
│  │   Input     │  │   Output    │                │  ← 主体(before/after 对比)
│  │  [原图预览]  │  │ [压缩后预览] │                │
│  │ 120KB JPEG  │  │ 42KB WebP   │                │
│  └─────────────┘  └─────────────┘                │
│                                [下载]              │
├───────────────────────────────────────────────────┤
│  节省 65.3% (120KB → 42KB)                        │  ← 统计(压缩率)
│                              [再试一张]            │  ← 重置按钮
└───────────────────────────────────────────────────┘
```

**响应式**:
- 桌面(md+):before/after 横向 grid-cols-2
- 移动:纵向堆叠 grid-cols-1

**注意**:此布局仅是 Playground 默认实现,三方接入用 hook 可完全自定义。

#### 4.3.4 错误处理

- Layer 1 默认 UI 内置 ErrorBoundary 包裹(符合 AGENTS.md 硬约束)
- `initError`:runtime 初始化失败时显示
- `error`:workflow 执行失败时显示
- 错误状态不阻塞重新上传(用户可点击"再试一张"重置)
- Layer 0 hook 不含 ErrorBoundary(由调用方决定是否包裹)

### 4.4 后续可扩展的 Quick Action 家族

每个 Quick Action 都遵循 Layer 0 (hook) + Layer 1 (默认 UI) 双层设计:

| Hook | 默认 UI 组件 | 预设示例 | 工作流 | 估时 |
|---|---|---|---|---|
| `useQuickCompress` | `ImageQuickCompress` | balanced / highQuality / small | `image.compress` | 4h(含 hook+UI) |
| `useQuickResize` | `ImageQuickResize` | IG 1:1 / YouTube 16:9 / TikTok 9:16 / 原图 50% | `image.resize` | 4h |
| `useQuickConvert` | `ImageQuickConvert` | PNG / WebP / AVIF / JPEG | `image.convert` | 3h |
| `useQuickWatermark` | `ImageQuickWatermark` | 右下小字 / 居中大字 / 平铺 | `image.watermark` | 4h |
| `useQuickCrop` | `ImageQuickCrop` | 1:1 / 4:3 / 16:9 / 自由 | `image.crop` | 3h |

每个 hook 复用相同的:
- `useLokvisRuntime` hook(runtime 初始化)
- `buildSingleStepImageWorkflow` 工厂(单节点 workflow)
- `getImageInfo` / `formatBytes` 工具(图片信息 + 格式化)
- 统一 i18n key 命名规范(`quick<Tool>.<key>`,仅 Layer 1 默认 UI 用)

**三方接入只需 import hook**,不需要 import 任何 UI 组件:
```typescript
import { useQuickCompress, useQuickResize } from '@lokvis/playground-hooks';
```

---

## 五、Pipeline 模式设计(Layer 2)

### 5.1 卡片式并行工作台(已砍掉)

原设计的"卡片式并行工作台"经审视后**砍掉**,原因见 §3.2。批量场景已有 BatchQueue,多步操作走 Pipeline,卡片式并行无强诉求场景。

### 5.2 Pipeline 模式(串联模式)

```
┌─────────────────────────────────────────────────────────────┐
│ Image Pipeline                                              │
│ 上传一张图,自动跑完 3 步,输出最终结果                       │
├─────────────────────────────────────────────────────────────┤
│  [上传一张图]                                                │
│       ↓                                                     │
│  ① Resize (1080px) ──┐                                      │
│       ↓              │ 各步中间结果可展开查看               │
│  ② Compress (q80) ───┤                                      │
│       ↓              │                                      │
│  ③ Watermark (@lokvis)┘                                     │
│       ↓                                                     │
│  [最终结果 + 下载]                                           │
└─────────────────────────────────────────────────────────────┘
```

**实现**:用 `WorkflowBuilder` 构造多节点 workflow:

```typescript
const wf = new WorkflowBuilder({
  id: 'image-pipeline',
  name: '电商主图优化',
})
  .setInput({ type: 'image', multiple: false })
  .setOutput({ type: 'image' })
  .add('image.resize', { width: 1080, fit: 'inside' }, 'Resize')
  .add('image.compress', { format: 'webp', quality: 80 }, 'Compress')
  .add('image.watermark', { text: '@lokvis', position: 'bottom-right' }, 'Watermark')
  .build();

await runtime.run(wf, [inputId]);
```

**预设 Pipeline**:
| Pipeline 名 | 步骤 | 适用场景 |
|---|---|---|
| 电商主图优化 | resize(1080) → compress(q80) → watermark(@brand) | 电商商品图 |
| 社交媒体分享 | resize(IG 1:1) → compress(q92) | Instagram 帖子 |
| 网页缩略图 | resize(400) → compress(q65) | 列表预览图 |
| 博客配图 | resize(1200) → compress(q80) → watermark(@blog) | 博客文章插图 |

---

## 六、技术实现要点

### 6.1 复用现有基础设施

| 设施 | 路径 | 用途 |
|---|---|---|
| `useImageTool` hook | `apps/playground/src/components/toolkit/useImageTool.ts` | runtime + input/output 生命周期 |
| `buildSingleStepImageWorkflow` | `apps/playground/src/components/toolkit/workflow-builder.ts` | 单节点 workflow 工厂 |
| `UploadBox` | `apps/playground/src/components/toolkit/UploadBox.tsx` | 上传区组件 |
| `PreviewBox` | `apps/playground/src/components/toolkit/PreviewBox.tsx` | 预览区组件 |
| `downloadBlob` / `formatBytes` / `imageInfoToMeta` | `apps/playground/src/components/toolkit/download.ts` | 下载 / 格式化 / 元数据 |
| `ErrorBoundary` | `apps/playground/src/components/ErrorBoundary.tsx` | 错误边界(硬约束) |
| `useLang` / `useTranslations` | `apps/playground/src/i18n/*` | i18n |
| `WorkflowBuilder` | `packages/workflow/src/workflow-builder.ts` | 多节点 pipeline 构造 |

### 6.2 i18n 命名规范

新增 i18n key 遵循统一命名规范:

```
quick<Tool>.<key>
```

示例:
- `quickCompress.title` / `quickCompress.subtitle`
- `quickCompress.presetBalanced` / `quickCompress.presetHighQuality` / `quickCompress.presetSmall`
- `quickCompress.dropHint` / `quickCompress.processing` / `quickCompress.download` / `quickCompress.retry`
- `quickResize.title` / `quickResize.presetIgSquare` / `quickResize.presetYouTube` / ...

6 语言全覆盖(en/zh/ja/es/de/fr),复用现有 `compress.savedPrefix` / `compress.increasedPrefix` 等通用 key。

### 6.3 SEO + 路由

每个 Quick Action 组件对应:
- 1 个主页面: `[lang]/tools/quick-<tool>.astro`(用 ToolLayout,含 SEO + PrivacyBadge)
- 1 个 embed 页面: `embed/[lang]/tools/quick-<tool>.astro`(用 EmbedLayout,无 chrome)
- 1 个 SEO 条目: `TOOL_SEO['quick-<tool>']`

Quick Workspace 对应:
- `[lang]/tools/quick-workspace.astro`
- `embed/[lang]/tools/quick-workspace.astro`

### 6.4 测试策略

| 层级 | 测试方式 | 覆盖项 |
|---|---|---|
| Quick Action 组件 | Vitest + React Testing Library | 预设切换 / autoRun / 错误处理 / onComplete 回调 |
| Quick Workspace | Vitest + RTL | 卡片独立运行 / 响应式布局 |
| E2E | Playwright | 拖入图片 → 自动执行 → 下载 |
| 视觉回归 | (可选)Playwright screenshot | UI 一致性 |

---

## 七、与现有 CompressTool 的对比

| 维度 | CompressTool(Layer 3) | ImageQuickCompress(Layer 1) |
|---|---|---|
| 目标用户 | 专业用户 | 所有人 |
| 参数配置 | 5+ 项(模式/格式/质量/目标体积) | 0-1 项(预设) |
| 执行方式 | 手动点击"压缩"按钮 | 上传即执行(autoRun) |
| UI 复杂度 | 中等(参数面板 + 对比栏) | 极简(单卡片) |
| 嵌入能力 | 重(依赖完整 ToolLayout) | 轻(单组件即可) |
| 适用场景 | 精细调整 | 快速使用 / 嵌入第三方 |
| 文件大小 | ~15KB | ~5KB |
| 学习成本 | 中(需理解参数) | 低(选预设即可) |

**两者共存策略**:
- `/tools/compress` 保留 CompressTool(专业用户)
- `/tools/quick-compress` 新增 ImageQuickCompress(快速使用)
- 首页 / 工具索引页优先推荐 Quick 版本,提供"高级模式"链接到完整 Tool

---

## 八、实施路径

### Phase A: MVP(最小可行)

**目标**:验证 Headless Hook + 默认 UI 设计思路,实现 useQuickCompress + ImageQuickCompress

| 任务 | 估时 | 依赖 |
|---|---|---|
| A1. 新增 i18n key(`quickCompress.*` 6 语言,仅 Layer 1 UI 用) | 0.5h | 无 |
| A2. 实现 `useQuickCompress` hook(Layer 0,纯逻辑) | 2h | A1 |
| A3. 实现 `ImageQuickCompress` 默认 UI 组件(Layer 1,基于 A2) | 1.5h | A2 |
| A4. 新增 SEO 条目 + 主 .astro 页面 + embed .astro 页面 | 0.5h | A3 |
| A5. typecheck + 测试验证 | 0.5h | A4 |
| A6. 浏览器手动验证(拖入图片 / 预设切换 / 下载) | 0.5h | A5 |
| **小计** | **5.5h** | |

### Phase B: 扩展 Quick Action 家族

**目标**:覆盖 image workspace 主要场景,每个工具实现 hook + 默认 UI

| 任务 | 估时 | 依赖 |
|---|---|---|
| B1. `useQuickResize` + `ImageQuickResize`(IG/YouTube/TikTok/原图 50%) | 4h | Phase A |
| B2. `useQuickConvert` + `ImageQuickConvert`(PNG/WebP/AVIF/JPEG) | 3h | Phase A |
| B3. `useQuickWatermark` + `ImageQuickWatermark`(右下/居中/平铺) | 4h | Phase A |
| B4. `useQuickCrop` + `ImageQuickCrop`(1:1/4:3/16:9/自由) | 3h | Phase A |
| B5. 各组件 .astro 页面 + SEO + i18n | 2h | B1-B4 |
| B6. typecheck + 测试 + 浏览器验证 | 2h | B5 |
| **小计** | **18h** | |

### Phase C: Pipeline 模式(仅保留串联,砍掉卡片式并行)

**目标**:单图多步 pipeline,用 WorkflowBuilder 构造多节点 workflow

| 任务 | 估时 | 依赖 |
|---|---|---|
| C1. Pipeline 模式实现(WorkflowBuilder 多节点) | 4h | Phase B |
| C2. 预设 Pipeline(电商主图 / 社交分享 / 网页缩略图) | 2h | C1 |
| C3. .astro 页面 + SEO + i18n | 1h | C2 |
| C4. typecheck + 测试 + 浏览器验证 | 2h | C3 |
| **小计** | **9h** | |

### Phase D: Embed SDK(可选,未来)

**目标**:打包为 Web Component,可嵌入任意第三方站点

| 任务 | 估时 | 依赖 |
|---|---|---|
| D1. 调研 Web Component 打包方案(lit / stencil / 原生) | 2h | Phase A |
| D2. 实现 `@lokvis/embed-sdk` 包(基于 Layer 0 hook) | 8h | D1 |
| D3. 打包 `<lokvis-quick-compress>` Web Component | 4h | D2 |
| D4. CDN 发布 + 文档 | 2h | D3 |
| **小计** | **16h** | |

### 总估时

| Phase | 估时 | 优先级 | 说明 |
|---|---|---|---|
| A (MVP) | 5.5h | P0(本轮) | 含 hook + UI |
| B (家族扩展) | 18h | P1 | 4 工具 × (hook + UI) |
| C (Pipeline) | 9h | P2 | 仅串联,砍掉并行 |
| D (Embed SDK) | 16h | P3(未来) | Web Component |
| **合计** | **48.5h** | | |

---

## 九、任务拆分(详细任务卡片)

### QA-1: useQuickCompress + ImageQuickCompress MVP(Phase A)

**任务 ID**: QA-1
**Phase**: A
**估时**: 5.5h
**优先级**: P0
**依赖**: 无

**范围**:
- 新增 i18n key `quickCompress.*`(6 语言,约 10 个 key,仅 Layer 1 UI 用)
- 实现 `useQuickCompress` hook(Layer 0,纯逻辑)
  - 路径: `apps/playground/src/components/toolkit/useQuickCompress.ts`
  - 接口: `UseQuickCompressResult`(见 §4.2.2)
  - 复用 `useLokvisRuntime` + `buildSingleStepImageWorkflow`
  - autoRun 机制(useEffect + useRef 标记)
- 实现 `ImageQuickCompress` 默认 UI 组件(Layer 1,基于 hook)
  - 路径: `apps/playground/src/components/tools/quick/ImageQuickCompress.tsx`
  - 内置 ErrorBoundary + UploadBox + PreviewBox + 预设切换器 + before/after 对比 + 下载按钮
- 新增 SEO 条目 `quick-compress`
- 创建 `[lang]/tools/quick-compress.astro`
- 创建 `embed/[lang]/tools/quick-compress.astro`

**验收标准**:
- [ ] typecheck 通过
- [ ] 测试通过(99 files / 1786 tests 不退化)
- [ ] hook 单元测试覆盖:autoRun / 预设切换 / onComplete 回调 / 错误处理
- [ ] 浏览器手动验证:拖入图片 → 自动压缩为 WebP → 显示压缩率 → 可下载
- [ ] 预设切换可用:balanced(80) / highQuality(92) / small(65)
- [ ] Layer 1 默认 UI 内置 ErrorBoundary(符合 AGENTS.md)
- [ ] Layer 0 hook 不含 ErrorBoundary(由调用方决定)
- [ ] 6 语言文案完整
- [ ] 三方接入可用:hook 可独立 import,不依赖任何 UI 组件

**技术要点**:
- Layer 0 hook 复用 `useLokvisRuntime`(runtime 初始化)
- Layer 0 hook 复用 `buildSingleStepImageWorkflow('image.compress', { format: 'webp', quality })`
- autoRun 机制:useEffect + useRef 标记 lastRunInputId(见 §4.2.5)
- Layer 1 UI 包裹 ErrorBoundary,内部用 hook
- i18n key 仅 Layer 1 UI 用,Layer 0 hook 不含 i18n(纯逻辑)

---

### QA-2: useQuickResize + ImageQuickResize(Phase B)

**任务 ID**: QA-2
**Phase**: B
**估时**: 4h
**优先级**: P1
**依赖**: QA-1

**范围**:
- 实现 `useQuickResize` hook(Layer 0)
- 实现 `ImageQuickResize` 默认 UI 组件(Layer 1)
- 预设:IG 1:1(1080×1080) / YouTube 16:9(1280×720) / TikTok 9:16(1080×1920) / 原图缩放 50%
- 新增 i18n key + SEO + .astro 页面

**验收标准**:
- [ ] typecheck + 测试通过
- [ ] hook 单元测试覆盖
- [ ] 浏览器验证:4 个预设均可正确缩放
- [ ] 输出尺寸与预设一致
- [ ] hook 可独立 import

---

### QA-3: useQuickConvert + ImageQuickConvert(Phase B)

**任务 ID**: QA-3
**Phase**: B
**估时**: 3h
**优先级**: P1
**依赖**: QA-1

**范围**:
- 实现 `useQuickConvert` hook(Layer 0)
- 实现 `ImageQuickConvert` 默认 UI 组件(Layer 1)
- 预设:转 PNG / 转 WebP / 转 AVIF / 转 JPEG
- 新增 i18n key + SEO + .astro 页面

**验收标准**:
- [ ] typecheck + 测试通过
- [ ] hook 单元测试覆盖
- [ ] 浏览器验证:4 种格式转换正确
- [ ] hook 可独立 import

---

### QA-4: useQuickWatermark + ImageQuickWatermark(Phase B)

**任务 ID**: QA-4
**Phase**: B
**估时**: 4h
**优先级**: P1
**依赖**: QA-1

**范围**:
- 实现 `useQuickWatermark` hook(Layer 0)
- 实现 `ImageQuickWatermark` 默认 UI 组件(Layer 1)
- 预设:右下角小字 / 居中大字 / 平铺水印
- 文字输入框(可自定义水印文字)
- 新增 i18n key + SEO + .astro 页面

**验收标准**:
- [ ] typecheck + 测试通过
- [ ] hook 单元测试覆盖
- [ ] 浏览器验证:3 种位置预设正确
- [ ] 自定义文字可输入
- [ ] hook 可独立 import

---

### QA-5: useQuickCrop + ImageQuickCrop(Phase B)

**任务 ID**: QA-5
**Phase**: B
**估时**: 3h
**优先级**: P2
**依赖**: QA-1

**范围**:
- 实现 `useQuickCrop` hook(Layer 0)
- 实现 `ImageQuickCrop` 默认 UI 组件(Layer 1)
- 预设:1:1 / 4:3 / 16:9 / 自由
- 新增 i18n key + SEO + .astro 页面

**验收标准**:
- [ ] typecheck + 测试通过
- [ ] hook 单元测试覆盖
- [ ] 浏览器验证:3 种比例预设正确裁剪
- [ ] hook 可独立 import

---

### QW-1: Pipeline 模式(Phase C,原 QW-2)

**任务 ID**: QW-1
**Phase**: C
**估时**: 9h
**优先级**: P2
**依赖**: QA-1 ~ QA-5

**范围**:
- 实现 Pipeline 模式(用 WorkflowBuilder 多节点)
- 预设 Pipeline:电商主图 / 社交分享 / 网页缩略图 / 博客配图
- 中间结果可展开查看
- 新增 i18n key + SEO + .astro 页面

**验收标准**:
- [ ] typecheck + 测试通过
- [ ] 浏览器验证:3 步 pipeline 正确执行
- [ ] 中间结果可查看
- [ ] pipeline 用 WorkflowBuilder 构造(符合 AGENTS.md 架构约束)

**注**:原 QW-1(卡片式并行工作台)已砍掉,原因见 §3.2。

---

## 十、风险与决策点

### 10.1 风险

| 风险 | 影响 | 缓解措施 |
|---|---|---|
| autoRun 机制在 preset 切换时重复触发 | 性能浪费 / 用户困惑 | 用 useRef 标记 lastRunInputId,preset 变化时手动触发(见 §4.2.5) |
| WebP 在旧浏览器不支持 | 输出无法显示 | WebP 在所有现代浏览器(Chrome 32+/Firefox 65+/Safari 14+)均支持,不考虑兼容 |
| Quick Action 与完整 Tool 功能重叠 | 用户困惑 | 定位区分:Quick = 快速 / Tool = 精细,首页推荐 Quick,提供"高级模式"入口 |
| Pipeline 模式复杂度上升 | 实施延期 | Phase C 可选,先做 Phase A/B 验证 |
| Layer 0 hook 被三方误用为"完整 SDK" | 期望落差 | 文档明确:hook 仅提供预设能力,深度定制请用 @lokvis/sdk |
| hook 与 UI 分离导致包导出复杂 | 接入方困惑 | 包导出明确分层:`@lokvis/playground-hooks`(Layer 0)+ `@lokvis/playground-ui`(Layer 1,未来) |

### 10.2 决策点

1. **预设数量**:每个 Quick Action 提供 3 个还是 4 个预设?
   - 建议:3 个(符合"少即是多"原则,更多预设走完整 Tool)
2. **Pipeline 是否可视化编辑**:用户能否自定义 pipeline 步骤?
   - 建议:Phase C 仅提供预设 pipeline,自定义编辑留到 Phase D
3. **Embed SDK 时机**:何时启动 Phase D?
   - 建议:Phase A/B/C 完成后,根据用户反馈决定
4. **hook 是否单独发包**:Layer 0 hook 放在 `apps/playground/src` 还是独立 `@lokvis/playground-hooks` 包?
   - 建议:Phase A 先放在 `apps/playground/src/components/toolkit/`,Phase B 验证稳定后抽离为独立包
5. **三方接入文档时机**:何时提供三方接入文档?
   - 建议:Phase A 完成后写最小接入示例,Phase B 完成后写完整文档

---

## 十一、参考

- [Phase 2/3/4 任务计划](./20260718-phase2-4-task-plan.md)
- [AGENTS.md 架构约束](../../AGENTS.md)
- [useImageTool hook](../../apps/playground/src/components/toolkit/useImageTool.ts)
- [WorkflowBuilder](../../packages/workflow/src/workflow-builder.ts)
- [ErrorBoundary](../../apps/playground/src/components/ErrorBoundary.tsx)
