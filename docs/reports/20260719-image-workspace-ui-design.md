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
│ Layer 4: 完整 Tool(保留,Playground demo 站用)                  │
│   CompressTool / ResizeTool / ConvertTool / CropTool /          │
│   WatermarkTool                                                 │
│   → 专业用户,精细参数调整,5+ 项配置                             │
│   → 依赖完整 ToolLayout                                         │
├─────────────────────────────────────────────────────────────────┤
│ Layer 3: Pipeline 模式(新增,Playground demo 站用)             │
│   ImagePipeline                                                 │
│   → 单图多步串联(resize → compress → watermark)               │
│   → 用 WorkflowBuilder 构造多节点 workflow                       │
│   → 预设 pipeline(电商主图/社交分享/网页缩略图)                 │
├─────────────────────────────────────────────────────────────────┤
│ Layer 2: 默认 UI(新增,Playground demo + 三方零配置用)         │
│   ImageQuickCompress / ImageQuickResize / ...                   │
│   → 基于 Layer 1 原语 + 默认 Tailwind 样式                      │
│   → 支持 theme prop(主题对象 → CSS 变量)                       │
│   → 支持 components prop(替换子组件)                            │
│   → 支持 className / style 覆盖                                 │
├─────────────────────────────────────────────────────────────────┤
│ Layer 1: Unstyled Primitives(★ 新增,三方组件替换用)           │
│   QuickCompress.Upload / .PresetSwitcher / .Preview /           │
│   .DownloadButton / .ErrorDisplay / .RatioBadge / ...           │
│   → 无样式原语,只提供行为 + ARIA + 数据 props                   │
│   → 类似 Radix UI / Headless UI / shadcn/ui 设计                │
│   → 三方可用原语 + 自定义 className/style 组装                  │
│   → 默认 UI(Layer 2)基于此原语构建                              │
├─────────────────────────────────────────────────────────────────┤
│ Layer 0: Headless Hook(新增,三方完全自定义用)                │
│   useQuickCompress() / useQuickResize() / ...                   │
│   → 纯逻辑:runtime + autoRun + preset + onComplete             │
│   → 零 UI,可基于此构建任意 UI(React/Vue/Web Component/原生)   │
└─────────────────────────────────────────────────────────────────┘

三方接入 6 种路径(按自由度递增):
  1. 零配置:      <ImageQuickCompress />                       — 默认 UI + 默认主题
  2. 主题定制:    <ImageQuickCompress theme={{...}} />         — 默认 UI + 自定义主题
  3. CSS 变量:    覆盖 .lokvis-quick-compress { --lokvis-* }   — 纯 CSS 定制
  4. 组件替换:    <ImageQuickCompress components={{...}} />    — 替换 UploadBox 等子组件
  5. 原语组装:    <QuickCompress.Upload>... + 自定义样式        — 完全控制结构
  6. 完全自定义:  useQuickCompress() hook                       — 任意 UI
```

### 3.1 设计原则

1. **多层级 API**:提供 6 种接入路径,从零配置到完全自定义,覆盖不同接入需求
2. **逻辑与 UI 分离**:Layer 0 是纯逻辑 hook,Layer 1/2 是 UI 实现
3. **样式与结构分离**:Layer 1 原语无样式,Layer 2 默认 UI 才加 Tailwind 样式;三方可用原语 + 自定义样式
4. **主题系统双层支持**:theme prop(对象) + CSS 变量(运行时覆盖),兼顾程序化配置和纯 CSS 定制
5. **组件可替换**:Layer 2 支持 components prop 替换任意子组件(UploadBox/PreviewBox 等)
6. **单向依赖**:Layer 0 不依赖任何 UI;Layer 1 依赖 Layer 0;Layer 2 依赖 Layer 1;Layer 3/4 独立保留
7. **复用基础设施**:所有层都复用 `useImageTool`(或其变体)+ `buildSingleStepImageWorkflow` / `WorkflowBuilder`
8. **ErrorBoundary 包裹**:Layer 2 默认 UI 内置 ErrorBoundary;Layer 0/1 不含(由调用方决定)
9. **不做卡片式并行工作台**:批量场景已有 BatchQueue,多步操作走 Pipeline

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

### 4.3 Layer 2:默认 UI 组件(支持 theme + components prop)

#### 4.3.1 设计定位

| 维度 | Layer 0 (Hook) | Layer 1 (原语) | Layer 2 (默认 UI) |
|---|---|---|---|
| 目标用户 | 三方完全自定义 | 三方组件替换 | Playground + 三方零配置 |
| 包含 UI | 否(纯逻辑) | 是(无样式) | 是(Tailwind 样式) |
| 可定制性 | 完全自由 | 自定义 className | theme + components + className |
| 复用范围 | 任意 React 项目 | 任意 React 项目 | React + Tailwind 项目 |

#### 4.3.2 ImageQuickCompress 默认 UI(完整 Props)

```typescript
/**
 * ImageQuickCompress — 默认 UI 实现。
 *
 * 基于 Layer 1 原语 + Tailwind 默认样式,支持三种定制方式:
 *   1. theme prop:主题对象(转 CSS 变量)
 *   2. components prop:替换子组件
 *   3. className/style:外层覆盖
 *
 * @example 1. 零配置(Playground 内部用)
 * ```tsx
 * <ImageQuickCompress initialPreset="balanced" />
 * ```
 *
 * @example 2. 主题定制(三方改配色)
 * ```tsx
 * <ImageQuickCompress theme={{ primary: '#00ff00', background: '#1a1a1a' }} />
 * ```
 *
 * @example 3. 组件替换(三方用 AntD Upload)
 * ```tsx
 * <ImageQuickCompress components={{
 *   UploadBox: AntDUpload,
 *   DownloadButton: AntDButton,
 * }} />
 * ```
 *
 * @example 4. 完全自定义(用 hook)
 * ```tsx
 * const { inputUrl, outputUrl, ratio, busy, handleFiles, preset, setPreset } = useQuickCompress();
 * // 用自己的 UI 组件渲染...
 * ```
 */
export interface ImageQuickCompressProps {
  // ─── 基础配置 ───
  initialPreset?: CompressPreset;
  autoRun?: boolean;
  onComplete?: (result: QuickActionResult) => void;
  inputBlob?: Blob | null;

  // ─── UI 配置 ───
  className?: string;
  style?: React.CSSProperties;
  showPresetSwitcher?: boolean;
  showBeforeAfter?: boolean;        // 是否显示 before/after 对比,默认 true
  showRatio?: boolean;              // 是否显示压缩率,默认 true
  showDownloadButton?: boolean;     // 是否显示下载按钮,默认 true

  // ─── 主题定制(转 CSS 变量) ───
  theme?: QuickCompressTheme;

  // ─── 组件替换 ───
  components?: Partial<QuickCompressComponents>;
}

/**
 * 主题对象 — 会被转换为 CSS 变量应用到根元素。
 * 所有字段可选,未提供的字段使用默认值。
 */
export interface QuickCompressTheme {
  primary?: string;          // 主色(按钮选中态、链接)— 默认 #6366f1
  primaryHover?: string;     // 主色 hover — 默认 #4f46e5
  background?: string;       // 组件背景 — 默认 transparent
  surface?: string;          // 卡片背景 — 默认 #18181b
  surfaceHover?: string;     // 卡片 hover — 默认 #27272a
  border?: string;           // 边框 — 默认 #27272a
  text?: string;             // 主文字 — 默认 #f4f4f5
  textMuted?: string;        // 次要文字 — 默认 #71717a
  success?: string;          // 成功(节省) — 默认 #10b981
  warning?: string;          // 警告(增大) — 默认 #f59e0b
  error?: string;            // 错误 — 默认 #ef4444
  radius?: string;           // 圆角 — 默认 0.5rem
  fontFamily?: string;       // 字体 — 默认 inherit
}

/**
 * 组件替换 — 三方可用自己的组件替换默认子组件。
 * 每个组件接收标准 props(含 data 属性 + 事件回调)。
 */
export interface QuickCompressComponents {
  UploadBox: React.ComponentType<UploadBoxProps>;
  PreviewBox: React.ComponentType<PreviewBoxProps>;
  PresetSwitcher: React.ComponentType<PresetSwitcherProps>;
  DownloadButton: React.ComponentType<DownloadButtonProps>;
  RatioBadge: React.ComponentType<RatioBadgeProps>;
  ErrorDisplay: React.ComponentType<ErrorDisplayProps>;
  ResetButton: React.ComponentType<ResetButtonProps>;
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

**显示开关**:
- `showPresetSwitcher`(默认 true):隐藏后不显示预设切换器
- `showBeforeAfter`(默认 true):隐藏后只显示 output,不显示 input
- `showRatio`(默认 true):隐藏后不显示压缩率
- `showDownloadButton`(默认 true):隐藏后不显示下载按钮(三方可自己渲染)

#### 4.3.4 错误处理

- Layer 2 默认 UI 内置 ErrorBoundary 包裹(符合 AGENTS.md 硬约束)
- `initError`:runtime 初始化失败时显示
- `error`:workflow 执行失败时显示
- 错误状态不阻塞重新上传(用户可点击"再试一张"重置)
- Layer 0/1 不含 ErrorBoundary(由调用方决定)

### 4.4 Layer 1:Unstyled Primitives(无样式原语)

#### 4.4.1 设计动机

Layer 2 默认 UI 即使支持 theme + components prop,仍有局限:
- 三方想完全控制 DOM 结构(如不用 grid 布局,改用 flex / 自定义网格)
- 三方想逐个子组件定制样式,而非整体替换
- 三方想用 CSS-in-JS / styled-components / CSS Modules,而非 Tailwind

**解决方案**:抽出 Layer 1 Unstyled Primitives,提供"无样式 + 有行为"的原语组件,类似 Radix UI / Headless UI / shadcn/ui 设计。

#### 4.4.2 原语组件清单

每个 Quick Action 对应一组原语,以 `QuickCompress` 为例:

```typescript
/**
 * QuickCompress — 无样式原语集合(Layer 1)。
 *
 * 所有原语:
 *   - 无内置样式(零 className,零 style)
 *   - 提供完整 ARIA 属性(无障碍)
 *   - 提供数据 props(状态 + 事件回调)
 *   - 可用 className / style / children 完全自定义
 *
 * 必须包裹在 <QuickCompress.Root> 内使用(提供 context)。
 *
 * @example 三方用原语组装自定义 UI
 * ```tsx
 * import { QuickCompress } from '@lokvis/quick-image/primitives';
 *
 * function MyCustomCompress() {
 *   return (
 *     <QuickCompress.Root initialPreset="balanced" onComplete={...}>
 *       <QuickCompress.Upload className="my-upload">点击上传</QuickCompress.Upload>
 *       <QuickCompress.PresetSwitcher className="my-switcher" />
 *       <QuickCompress.Preview type="output" className="my-preview" />
 *       <QuickCompress.RatioBadge className="my-ratio" />
 *       <QuickCompress.DownloadButton className="my-btn">下载</QuickCompress.DownloadButton>
 *     </QuickCompress.Root>
 *   );
 * }
 * ```
 */
export const QuickCompress = {
  /** 根组件:提供 context,接收所有配置 */
  Root: QuickCompressRoot,

  /** 上传区:拖拽 + 点击选择,接收 onFiles 回调 */
  Upload: QuickCompressUpload,

  /** 预设切换器:渲染预设按钮组,接收 preset + onChange */
  PresetSwitcher: QuickCompressPresetSwitcher,

  /** 预览区:渲染 input 或 output 图片,接收 type='input'|'output' */
  Preview: QuickCompressPreview,

  /** 压缩率徽章:渲染压缩率文字,接收 format 函数 */
  RatioBadge: QuickCompressRatioBadge,

  /** 下载按钮:触发下载,接收 fileName */
  DownloadButton: QuickCompressDownloadButton,

  /** 错误显示:渲染 error 文案,接收 format 函数 */
  ErrorDisplay: QuickCompressErrorDisplay,

  /** 重置按钮:触发 reset */
  ResetButton: QuickCompressResetButton,
};
```

#### 4.4.3 原语组件 Props 契约(以 Upload 为例)

```typescript
/**
 * QuickCompressUpload — 上传区原语。
 *
 * 无样式,提供:
 *   - 完整拖拽 + 点击行为
 *   - ARIA 属性(role, aria-label, aria-disabled)
 *   - 数据 props(isDragging, isDisabled)
 *   - 事件回调(onFiles)
 *
 * 三方可用 className / style / children 完全自定义外观。
 */
export interface QuickCompressUploadProps {
  /** 自定义 className */
  className?: string;
  /** 自定义 style */
  style?: React.CSSProperties;
  /** 自定义 children(默认渲染 "Click or drop image" 文案) */
  children?: React.ReactNode | ((state: { isDragging: boolean }) => React.ReactNode);
  /** 接受的文件类型,默认 'image/*' */
  accept?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** ARIA 标签(无障碍) */
  'aria-label'?: string;
}

export const QuickCompressUpload: React.FC<QuickCompressUploadProps>;
```

#### 4.4.4 Layer 2 默认 UI 如何基于 Layer 1 原语构建

```typescript
// ImageQuickCompressDefault(Layer 2)基于原语(Layer 1)构建
function ImageQuickCompressDefault({ theme, components, ...props }: ImageQuickCompressProps) {
  // 应用主题:theme 对象 → CSS 变量
  const cssVars = themeToCssVars(theme);

  // 替换组件:默认用 Layer 1 原语 + Tailwind 样式
  const {
    UploadBox = (p) => <QuickCompress.Upload className="tailwind-upload-classes" {...p} />,
    PreviewBox = (p) => <QuickCompress.Preview className="tailwind-preview-classes" {...p} />,
    PresetSwitcher = (p) => <QuickCompress.PresetSwitcher className="tailwind-switcher-classes" {...p} />,
    DownloadButton = (p) => <QuickCompress.DownloadButton className="tailwind-btn-classes" {...p} />,
    RatioBadge = (p) => <QuickCompress.RatioBadge className="tailwind-ratio-classes" {...p} />,
    ErrorDisplay = (p) => <QuickCompress.ErrorDisplay className="tailwind-error-classes" {...p} />,
    ResetButton = (p) => <QuickCompress.ResetButton className="tailwind-reset-classes" {...p} />,
  } = components ?? {};

  return (
    <div className="lokvis-quick-compress" style={cssVars}>
      <QuickCompress.Root {...props}>
        {/* header */}
        <header>
          <UploadBox />
          <PresetSwitcher />
        </header>
        {/* before/after */}
        <div className="grid grid-cols-2">
          <PreviewBox type="input" />
          <PreviewBox type="output" />
        </div>
        {/* footer */}
        <RatioBadge />
        <DownloadButton />
        <ResetButton />
        <ErrorDisplay />
      </QuickCompress.Root>
    </div>
  );
}
```

### 4.5 主题系统设计(theme prop + CSS 变量)

#### 4.5.1 双层支持

| 方式 | API | 适用场景 |
|---|---|---|
| theme prop | `<ImageQuickCompress theme={{...}} />` | 程序化配置(JS 对象) |
| CSS 变量 | `.lokvis-quick-compress { --lokvis-primary: ... }` | 运行时覆盖(纯 CSS) |

#### 4.5.2 theme 对象 → CSS 变量映射

```typescript
/**
 * theme 对象转换为 CSS 变量样式对象。
 * 应用到根元素 style 属性,所有子组件通过 var(--lokvis-*) 引用。
 */
function themeToCssVars(theme?: QuickCompressTheme): React.CSSProperties {
  if (!theme) return {};
  const vars: Record<string, string> = {};
  if (theme.primary) vars['--lokvis-primary'] = theme.primary;
  if (theme.primaryHover) vars['--lokvis-primary-hover'] = theme.primaryHover;
  if (theme.background) vars['--lokvis-bg'] = theme.background;
  if (theme.surface) vars['--lokvis-surface'] = theme.surface;
  if (theme.surfaceHover) vars['--lokvis-surface-hover'] = theme.surfaceHover;
  if (theme.border) vars['--lokvis-border'] = theme.border;
  if (theme.text) vars['--lokvis-text'] = theme.text;
  if (theme.textMuted) vars['--lokvis-text-muted'] = theme.textMuted;
  if (theme.success) vars['--lokvis-success'] = theme.success;
  if (theme.warning) vars['--lokvis-warning'] = theme.warning;
  if (theme.error) vars['--lokvis-error'] = theme.error;
  if (theme.radius) vars['--lokvis-radius'] = theme.radius;
  if (theme.fontFamily) vars['--lokvis-font-family'] = theme.fontFamily;
  return vars as React.CSSProperties;
}
```

#### 4.5.3 CSS 变量默认值(根元素)

```css
/* 所有 Quick Action 组件根元素都加 .lokvis-quick-* class,提供 CSS 变量默认值 */
.lokvis-quick-compress,
.lokvis-quick-resize,
.lokvis-quick-convert,
.lokvis-quick-watermark,
.lokvis-quick-crop {
  --lokvis-primary: #6366f1;
  --lokvis-primary-hover: #4f46e5;
  --lokvis-bg: transparent;
  --lokvis-surface: #18181b;
  --lokvis-surface-hover: #27272a;
  --lokvis-border: #27272a;
  --lokvis-text: #f4f4f5;
  --lokvis-text-muted: #71717a;
  --lokvis-success: #10b981;
  --lokvis-warning: #f59e0b;
  --lokvis-error: #ef4444;
  --lokvis-radius: 0.5rem;
  --lokvis-font-family: inherit;
}
```

#### 4.5.4 Tailwind 类名引用 CSS 变量

Layer 2 默认 UI 的 Tailwind 类名引用 CSS 变量,而非硬编码颜色:

```typescript
// ❌ 错误:硬编码颜色,无法被主题覆盖
<button className="bg-indigo-600 hover:bg-indigo-500 text-white">

// ✅ 正确:引用 CSS 变量,可被主题覆盖
<button
  className="text-white"
  style={{
    backgroundColor: 'var(--lokvis-primary)',
  }}
>
```

或用 Tailwind v4 的 arbitrary value:

```typescript
<button className="bg-[var(--lokvis-primary)] hover:bg-[var(--lokvis-primary-hover)] text-[var(--lokvis-text)]">
```

#### 4.5.5 三方覆盖示例

```css
/* 三方在自己的 CSS 中覆盖 */
.lokvis-quick-compress {
  --lokvis-primary: #00ff00;       /* 改主色为绿色 */
  --lokvis-bg: #1a1a1a;            /* 改背景 */
  --lokvis-radius: 0;              /* 去圆角 */
  --lokvis-font-family: 'Inter', sans-serif;
}
```

```tsx
// 或通过 theme prop 程序化配置
<ImageQuickCompress
  theme={{
    primary: '#00ff00',
    background: '#1a1a1a',
    radius: '0',
    fontFamily: 'Inter, sans-serif',
  }}
/>
```

### 4.6 后续可扩展的 Quick Action 家族

每个 Quick Action 都遵循 Layer 0 (hook) + Layer 1 (原语) + Layer 2 (默认 UI) 三层设计:

| Hook (L0) | Primitives (L1) | 默认 UI (L2) | 预设示例 | 估时 |
|---|---|---|---|---|
| `useQuickCompress` | `QuickCompress.*` | `ImageQuickCompress` | balanced / highQuality / small | 7h(含三层) |
| `useQuickResize` | `QuickResize.*` | `ImageQuickResize` | IG 1:1 / YouTube 16:9 / TikTok 9:16 / 原图 50% | 5h |
| `useQuickConvert` | `QuickConvert.*` | `ImageQuickConvert` | PNG / WebP / AVIF / JPEG | 4h |
| `useQuickWatermark` | `QuickWatermark.*` | `ImageQuickWatermark` | 右下小字 / 居中大字 / 平铺 | 5h |
| `useQuickCrop` | `QuickCrop.*` | `ImageQuickCrop` | 1:1 / 4:3 / 16:9 / 自由 | 4h |

每个 hook 复用相同的:
- `useLokvisRuntime` hook(runtime 初始化)
- `buildSingleStepImageWorkflow` 工厂(单节点 workflow)
- `getImageInfo` / `formatBytes` 工具(图片信息 + 格式化)
- 统一 i18n key 命名规范(`quick<Tool>.<key>`,仅 Layer 2 默认 UI 用)
- 统一主题系统(CSS 变量 + theme prop)

**三方接入按需选择层级**:
```typescript
// 路径 1:零配置(用 Layer 2)
import ImageQuickCompress from '@lokvis/quick-image';
<ImageQuickCompress />

// 路径 5:原语组装(用 Layer 1)
import { QuickCompress } from '@lokvis/quick-image/primitives';
<QuickCompress.Root>...</QuickCompress.Root>

// 路径 6:完全自定义(用 Layer 0)
import { useQuickCompress } from '@lokvis/quick-image/hooks';
const state = useQuickCompress();
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

**目标**:验证三层架构(Layer 0 hook + Layer 1 原语 + Layer 2 默认 UI)+ 主题系统,实现 useQuickCompress + QuickCompress 原语 + ImageQuickCompress

| 任务 | 估时 | 依赖 |
|---|---|---|
| A1. 新增 i18n key(`quickCompress.*` 6 语言,仅 Layer 2 UI 用) | 0.5h | 无 |
| A2. 实现 `useQuickCompress` hook(Layer 0,纯逻辑) | 2h | A1 |
| A3. 定义主题系统(CSS 变量默认值 + themeToCssVars 函数) | 1h | 无 |
| A4. 实现 `QuickCompress.*` 原语集合(Layer 1,8 个无样式原语) | 2h | A2, A3 |
| A5. 实现 `ImageQuickCompress` 默认 UI(Layer 2,基于 A4 + Tailwind) | 1.5h | A4 |
| A6. 新增 SEO 条目 + 主 .astro 页面 + embed .astro 页面 | 0.5h | A5 |
| A7. typecheck + 测试验证(含 hook 单元测试 + 原语测试) | 1h | A6 |
| A8. 浏览器手动验证(拖入图片 / 预设切换 / theme / components 替换) | 0.5h | A7 |
| **小计** | **9h** | |

### Phase B: 扩展 Quick Action 家族

**目标**:覆盖 image workspace 主要场景,每个工具实现 Layer 0+1+2 三层

| 任务 | 估时 | 依赖 |
|---|---|---|
| B1. `useQuickResize` + `QuickResize.*` + `ImageQuickResize` | 5h | Phase A |
| B2. `useQuickConvert` + `QuickConvert.*` + `ImageQuickConvert` | 4h | Phase A |
| B3. `useQuickWatermark` + `QuickWatermark.*` + `ImageQuickWatermark` | 5h | Phase A |
| B4. `useQuickCrop` + `QuickCrop.*` + `ImageQuickCrop` | 4h | Phase A |
| B5. 各组件 .astro 页面 + SEO + i18n | 2h | B1-B4 |
| B6. typecheck + 测试 + 浏览器验证 | 2h | B5 |
| **小计** | **22h** | |

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
| A (MVP) | 9h | P0(本轮) | 含 hook + 原语 + UI + 主题 |
| B (家族扩展) | 22h | P1 | 4 工具 × (hook + 原语 + UI) |
| C (Pipeline) | 9h | P2 | 仅串联,砍掉并行 |
| D (Embed SDK) | 16h | P3(未来) | Web Component |
| **合计** | **56h** | | |

---

## 九、任务拆分(详细任务卡片)

### QA-1: useQuickCompress + QuickCompress 原语 + ImageQuickCompress MVP(Phase A)

**任务 ID**: QA-1
**Phase**: A
**估时**: 9h
**优先级**: P0
**依赖**: 无

**范围**:
- 新增 i18n key `quickCompress.*`(6 语言,约 10 个 key,仅 Layer 2 UI 用)
- 实现 `useQuickCompress` hook(Layer 0,纯逻辑)
  - 路径: `apps/playground/src/components/toolkit/useQuickCompress.ts`
  - 接口: `UseQuickCompressResult`(见 §4.2.2)
  - 复用 `useLokvisRuntime` + `buildSingleStepImageWorkflow`
  - autoRun 机制(useEffect + useRef 标记)
- 定义主题系统(Layer 2 共用)
  - 路径: `apps/playground/src/components/tools/quick/theme.ts`
  - `QuickCompressTheme` 接口(见 §4.3.2)
  - `themeToCssVars()` 函数(见 §4.5.2)
  - CSS 变量默认值(见 §4.5.3,加到 global.css)
- 实现 `QuickCompress.*` 原语集合(Layer 1,8 个无样式原语)
  - 路径: `apps/playground/src/components/tools/quick/primitives/QuickCompress.tsx`
  - 原语清单:Root / Upload / PresetSwitcher / Preview / RatioBadge / DownloadButton / ErrorDisplay / ResetButton
  - 每个原语:零 className + 完整 ARIA + 数据 props + 事件回调
- 实现 `ImageQuickCompress` 默认 UI 组件(Layer 2,基于原语 + Tailwind)
  - 路径: `apps/playground/src/components/tools/quick/ImageQuickCompress.tsx`
  - 内置 ErrorBoundary + 用 Layer 1 原语 + Tailwind 样式(引用 CSS 变量)
  - 支持 theme prop / components prop / className / style
- 新增 SEO 条目 `quick-compress`
- 创建 `[lang]/tools/quick-compress.astro`
- 创建 `embed/[lang]/tools/quick-compress.astro`

**验收标准**:
- [ ] typecheck 通过
- [ ] 测试通过(99 files / 1786 tests 不退化)
- [ ] Layer 0 hook 单元测试:autoRun / 预设切换 / onComplete 回调 / 错误处理
- [ ] Layer 1 原语单元测试:每个原语渲染 + ARIA + 事件回调
- [ ] Layer 2 默认 UI 测试:theme prop 转 CSS 变量 / components prop 替换子组件
- [ ] 浏览器手动验证:
  - [ ] 拖入图片 → 自动压缩为 WebP → 显示压缩率 → 可下载
  - [ ] 预设切换可用:balanced(80) / highQuality(92) / small(65)
  - [ ] theme prop 生效:改 primary 颜色后按钮变色
  - [ ] components prop 生效:替换 UploadBox 后用三方组件
  - [ ] CSS 变量覆盖生效:在 .lokvis-quick-compress 覆盖 --lokvis-primary
- [ ] Layer 2 默认 UI 内置 ErrorBoundary(符合 AGENTS.md)
- [ ] Layer 0/1 不含 ErrorBoundary
- [ ] 6 语言文案完整
- [ ] 三方接入 6 种路径均可用(见 §3 架构图)

**技术要点**:
- Layer 0 hook 复用 `useLokvisRuntime`(runtime 初始化)
- Layer 0 hook 复用 `buildSingleStepImageWorkflow('image.compress', { format: 'webp', quality })`
- autoRun 机制:useEffect + useRef 标记 lastRunInputId(见 §4.2.5)
- Layer 1 原语用 React Context 共享 hook 状态(<QuickCompress.Root> 提供)
- Layer 2 UI 用 Tailwind arbitrary value 引用 CSS 变量:`bg-[var(--lokvis-primary)]`
- i18n key 仅 Layer 2 UI 用,Layer 0/1 不含 i18n(纯逻辑 + 无样式)

---

### QA-2: useQuickResize + QuickResize 原语 + ImageQuickResize(Phase B)

**任务 ID**: QA-2
**Phase**: B
**估时**: 5h
**优先级**: P1
**依赖**: QA-1

**范围**:
- 实现 `useQuickResize` hook(Layer 0)
- 实现 `QuickResize.*` 原语集合(Layer 1)
- 实现 `ImageQuickResize` 默认 UI 组件(Layer 2)
- 预设:IG 1:1(1080×1080) / YouTube 16:9(1280×720) / TikTok 9:16(1080×1920) / 原图缩放 50%
- 新增 i18n key + SEO + .astro 页面

**验收标准**:
- [ ] typecheck + 测试通过
- [ ] 三层单元测试覆盖
- [ ] 浏览器验证:4 个预设均可正确缩放
- [ ] 输出尺寸与预设一致
- [ ] theme / components prop 可用
- [ ] 原语可独立组装

---

### QA-3: useQuickConvert + QuickConvert 原语 + ImageQuickConvert(Phase B)

**任务 ID**: QA-3
**Phase**: B
**估时**: 4h
**优先级**: P1
**依赖**: QA-1

**范围**:
- 实现 `useQuickConvert` hook(Layer 0)
- 实现 `QuickConvert.*` 原语集合(Layer 1)
- 实现 `ImageQuickConvert` 默认 UI 组件(Layer 2)
- 预设:转 PNG / 转 WebP / 转 AVIF / 转 JPEG
- 新增 i18n key + SEO + .astro 页面

**验收标准**:
- [ ] typecheck + 测试通过
- [ ] 三层单元测试覆盖
- [ ] 浏览器验证:4 种格式转换正确
- [ ] theme / components prop 可用
- [ ] 原语可独立组装

---

### QA-4: useQuickWatermark + QuickWatermark 原语 + ImageQuickWatermark(Phase B)

**任务 ID**: QA-4
**Phase**: B
**估时**: 5h
**优先级**: P1
**依赖**: QA-1

**范围**:
- 实现 `useQuickWatermark` hook(Layer 0)
- 实现 `QuickWatermark.*` 原语集合(Layer 1,含 TextInput 原语)
- 实现 `ImageQuickWatermark` 默认 UI 组件(Layer 2)
- 预设:右下角小字 / 居中大字 / 平铺水印
- 文字输入框(可自定义水印文字)
- 新增 i18n key + SEO + .astro 页面

**验收标准**:
- [ ] typecheck + 测试通过
- [ ] 三层单元测试覆盖
- [ ] 浏览器验证:3 种位置预设正确
- [ ] 自定义文字可输入
- [ ] theme / components prop 可用
- [ ] 原语可独立组装

---

### QA-5: useQuickCrop + QuickCrop 原语 + ImageQuickCrop(Phase B)

**任务 ID**: QA-5
**Phase**: B
**估时**: 4h
**优先级**: P2
**依赖**: QA-1

**范围**:
- 实现 `useQuickCrop` hook(Layer 0)
- 实现 `QuickCrop.*` 原语集合(Layer 1,含 CropArea 原语)
- 实现 `ImageQuickCrop` 默认 UI 组件(Layer 2)
- 预设:1:1 / 4:3 / 16:9 / 自由
- 新增 i18n key + SEO + .astro 页面

**验收标准**:
- [ ] typecheck + 测试通过
- [ ] 三层单元测试覆盖
- [ ] 浏览器验证:3 种比例预设正确裁剪
- [ ] theme / components prop 可用
- [ ] 原语可独立组装

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
| 三层架构导致包导出复杂 | 接入方困惑 | 包导出明确分层:`@lokvis/quick-image`(Layer 2)+ `/primitives`(Layer 1)+ `/hooks`(Layer 0) |
| Layer 1 原语 Context 设计不当 | 重渲染性能问题 | 用 React Context + useMemo 优化,仅在状态变化时触发重渲染 |
| theme prop 与 CSS 变量冲突 | 优先级混乱 | theme prop 生成的 CSS 变量在根元素 style 属性(高优先级),外部 CSS 覆盖需用 `!important` 或更高特异性 |
| components prop 替换组件契约不匹配 | 运行时错误 | 用 TypeScript 严格类型约束 + Props 接口文档 |
| Tailwind arbitrary value 兼容性 | 旧版 Tailwind 不支持 | 项目用 Tailwind v4,支持 arbitrary value;三方若用 Tailwind v3 需自行配置 |

### 10.2 决策点

1. **预设数量**:每个 Quick Action 提供 3 个还是 4 个预设?
   - 建议:3 个(符合"少即是多"原则,更多预设走完整 Tool)
2. **Pipeline 是否可视化编辑**:用户能否自定义 pipeline 步骤?
   - 建议:Phase C 仅提供预设 pipeline,自定义编辑留到 Phase D
3. **Embed SDK 时机**:何时启动 Phase D?
   - 建议:Phase A/B/C 完成后,根据用户反馈决定
4. **三层是否单独发包**:Layer 0/1/2 放在 `apps/playground/src` 还是独立 `@lokvis/quick-image` 包?
   - 建议:Phase A 先放在 `apps/playground/src/components/tools/quick/`,Phase B 验证稳定后抽离为独立包 `@lokvis/quick-image`,导出三个子路径(`/`,`/primitives`,`/hooks`)
5. **三方接入文档时机**:何时提供三方接入文档?
   - 建议:Phase A 完成后写最小接入示例(6 种路径),Phase B 完成后写完整文档
6. **Layer 1 原语是否支持非 React 框架**:是否提供 Vue/Svelte 版本?
   - 建议:Phase A/B 仅支持 React;Phase D Embed SDK 用 Web Component 跨框架
7. **主题系统是否支持暗色/亮色自动切换**:是否支持 `prefers-color-scheme`?
   - 建议:Phase A 默认暗色主题;Phase B 加 `theme.mode='light'|'dark'|'auto'` 支持

---

## 十一、参考

- [Phase 2/3/4 任务计划](./20260718-phase2-4-task-plan.md)
- [AGENTS.md 架构约束](../../AGENTS.md)
- [useImageTool hook](../../apps/playground/src/components/toolkit/useImageTool.ts)
- [WorkflowBuilder](../../packages/workflow/src/workflow-builder.ts)
- [ErrorBoundary](../../apps/playground/src/components/ErrorBoundary.tsx)
