# @lokvis/embed-image Favicon / ICO 生成能力实现方案（2026-07-24）

> **本文档是 @lokvis/embed-image 新增 favicon（ICO）生成能力的实现方案与细化设计**。起因：lokvis-cloud favicon-generator 工具页需要 ICO 生成能力，经边界评审（§七决策日志），favicon 生成通过中性第三方测试，属于 open 侧功能完整性范畴。
>
> 状态约定：`⬜ 待办` / `🟡 进行中` / `✅ 完成` / `⛔ 阻塞` / `❌ 取消` / `⏭️ 延后`
>
> 任务字段沿用 `20260718-phase2-4-task-plan.md` 模板：范围 / 不做 / 输入 / 输出 / 依赖 / 验收 / 估时 / 风险 / 优先级。

---

## 一、边界原则（独立性守护）

> 沿用 [20260723-quick-image-functional-completeness.md](./20260723-quick-image-functional-completeness.md) §一 确立的原则。

### 1.1 中性第三方测试

**「一个中性第三方站点（无自有设计系统、零配置接入）是否也需要 favicon 生成？」**

答案为**是**——任何拥有网站的第三方都需要生成 favicon.ico。favicon 生成是通用图片工具需求，与 compress / resize / convert 同级，不绑定任何消费方的产品决策。

### 1.2 进 / 不进 清单

| 进 open（本文档） | 不进 open（消费方自建） |
|---|---|
| ICO 多尺寸容器编码（Engine 层） | 品牌化 favicon 设计建议 / 预览 mockup |
| `image.favicon` capability 声明与实现 | 特定平台的 apple-touch-icon / manifest.json 联动 |
| `useQuickFavicon` hook（Layer 0） | 批量导出 zip 打包（cloud 产品交互） |
| `QuickFavicon` primitives（Layer 1） | 付费墙 / 转化出口 |
| `ImageQuickFavicon` 默认 UI（Layer 2） | 特定布局 / 品牌动效 |
| i18n 6 语言 | 埋点 / 状态栏 |

### 1.3 五层架构遵循

本方案严格遵循 lokvis-open 五层单向依赖：

```
UI (quick-image Layer 2)
  → Workflow (buildSingleStepImageWorkflow)
    → Runtime (WorkflowExecutor)
      → Capability (plugin-image: image.favicon)
        → Engine (engine-image: encodeIco)
```

每层仅依赖下一层，不跨层调用。Engine 层保持 `Blob ↔ Blob` 纯函数签名。

### 1.4 hooks 接口兼容

现有 6 个 hooks 接口**冻结不变**。本方案**新增** `useQuickFavicon` hook，属于向后兼容的 additive change。cloud 已基于 0.1.1 hooks 构建的原生 UI 不受影响。

---

## 二、现状评估

### 2.1 ICO 在 @lokvis 技术栈中的缺失

| 层 | 现状 | 问题 |
|---|---|---|
| Engine (`engine-image`) | `ImageOutputFormat = 'png' \| 'jpeg' \| 'webp' \| 'avif' \| 'gif'`，无 ICO | 无法编码 ICO 容器格式 |
| Capability (`image.convert`) | manifest format enum 含 `'ico'`（`image.manifest.json:52`） | **声明与实现不一致**：schema 允许 ico，engine 实际 throw（`canvas-engine.test.ts` 验证此行为） |
| quick-image hooks | `ConvertPreset = 'png' \| 'webp' \| 'avif' \| 'jpeg'` | 无 favicon 工具 |
| quick-image Layer 2 | 6 工具（compress/resize/convert/watermark/crop/pipeline） | 无 favicon UI |

### 2.2 核心结论

1. **ICO 不是简单的格式转换**：ICO 是多尺寸容器格式（一个文件包含 16/32/48/256 等多个 PNG 条目），语义上区别于 `image.convert`（1 输入 → 1 输出同尺寸不同编码）。
2. **需要独立的 Engine 操作**：`encodeIco` 内部组合 decode → 多次 resize → 多次 encode PNG → 二进制打包，是复合操作但对外仍为 `Blob → Blob`。
3. **需要独立的 Capability**：`image.favicon`（而非扩展 `image.convert`），因为参数语义不同（`sizes[]` vs `format + quality`）。
4. **`image.convert` format enum 中的 `'ico'` 是预存声明缺陷**：本方案不修复此问题（避免 manifest breaking change），在决策日志记录，后续版本清理。

### 2.3 ICO 容器格式规范

ICO 文件二进制结构（参考 Microsoft ICONDIR 规范）：

```
┌─────────────────────────────────────────────────┐
│ ICONDIR (6 bytes)                               │
│   reserved:  u16 = 0                            │
│   type:      u16 = 1  (1=ICO, 2=CUR)           │
│   count:     u16 = N  (条目数)                   │
├─────────────────────────────────────────────────┤
│ ICONDIRENTRY[0] (16 bytes)                      │
│   width:       u8  (0 表示 256)                  │
│   height:      u8  (0 表示 256)                  │
│   colorCount:  u8  = 0 (≥8bpp)                  │
│   reserved:    u8  = 0                          │
│   planes:      u16 = 1                          │
│   bitCount:    u16 = 32                         │
│   bytesInRes:  u32 = PNG data 字节数             │
│   imageOffset: u32 = PNG data 文件偏移           │
├─────────────────────────────────────────────────┤
│ ICONDIRENTRY[1..N-1] (各 16 bytes)              │
├─────────────────────────────────────────────────┤
│ PNG data[0] (完整 PNG 文件字节)                   │
│ PNG data[1]                                     │
│ ...                                             │
│ PNG data[N-1]                                   │
└─────────────────────────────────────────────────┘
```

关键约束：

- 每个条目内嵌**完整 PNG 文件**（Vista+ 规范，替代旧版 BMP DIB 格式）
- `width`/`height` 字段为 u8，256 用 `0` 表示
- 条目按尺寸升序排列（惯例，非强制）
- 所有条目 `bitCount = 32`（RGBA）

---

## 三、分层设计

### 3.1 Engine 层：`encodeIco` 操作

**位置**：`packages/engine-image/src/operations/ico.ts`（新文件）

**签名**（遵循 `BlobOperation` 类型）：

```typescript
export async function encodeIco(
  blob: Blob,
  params: Record<string, any>,
  signal?: AbortSignal
): Promise<Blob>
```

**参数接口**（`types.ts` 新增）：

```typescript
export interface EncodeIcoParams {
  /** 目标尺寸列表（正方形边长），默认 [16, 32, 48, 256] */
  sizes?: number[];
}
```

**实现流程**：

```
1. canvasEngine.decode(blob) → { bitmap, width: srcW, height: srcH }
2. 校验 sizes（去重、排序、clamp 到 1-256）
3. for each size in sizes:
   a. throwIfAborted(signal)
   b. createCanvas(size, size)
   c. ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'
   d. 计算 cover 裁剪区域（居中裁切正方形）
   e. ctx.drawImage(bitmap, sx, sy, sSize, sSize, 0, 0, size, size)
   f. canvasEngine.encode(canvas, 'png') → pngBlob
   g. pngBuffers.push(await pngBlob.arrayBuffer())
4. bitmap.close?.()
5. packIco(sizes, pngBuffers) → ArrayBuffer（二进制打包）
6. return new Blob([icoBuffer], { type: 'image/x-icon' })
```

**`packIco` 内部函数**（纯计算，无 DOM/canvas 依赖）：

```typescript
function packIco(sizes: number[], pngBuffers: ArrayBuffer[]): ArrayBuffer {
  const count = sizes.length;
  const headerSize = 6 + count * 16;
  // 计算各条目 offset
  let offset = headerSize;
  const entries = sizes.map((size, i) => {
    const entry = { size, byteLength: pngBuffers[i]!.byteLength, offset };
    offset += entry.byteLength;
    return entry;
  });
  // 写入二进制
  const total = offset;
  const buffer = new ArrayBuffer(total);
  const view = new DataView(buffer);
  // ICONDIR
  view.setUint16(0, 0, true);      // reserved
  view.setUint16(2, 1, true);      // type = ICO
  view.setUint16(4, count, true);  // count
  // ICONDIRENTRY[]
  entries.forEach((e, i) => {
    const base = 6 + i * 16;
    view.setUint8(base, e.size >= 256 ? 0 : e.size);     // width
    view.setUint8(base + 1, e.size >= 256 ? 0 : e.size); // height
    view.setUint8(base + 2, 0);    // colorCount
    view.setUint8(base + 3, 0);    // reserved
    view.setUint16(base + 4, 1, true);   // planes
    view.setUint16(base + 6, 32, true);  // bitCount
    view.setUint32(base + 8, e.byteLength, true);  // bytesInRes
    view.setUint32(base + 12, e.offset, true);     // imageOffset
  });
  // PNG data
  let pos = headerSize;
  for (const buf of pngBuffers) {
    new Uint8Array(buffer, pos, buf.byteLength).set(new Uint8Array(buf));
    pos += buf.byteLength;
  }
  return buffer;
}
```

**注册**（`lazy.ts` OPERATION_LOADERS 新增）：

```typescript
'encode-ico': () => import('./operations/ico.js').then(m => m.encodeIco),
```

**导出**（`operations/index.ts` 新增）：

```typescript
export * from './ico.js';  // encodeIco
```

### 3.2 Capability 层：`image.favicon`

**声明**（`packages/capability/manifests/image.manifest.json` 新增条目 → codegen 生成 `image.generated.ts`）：

```json
{
  "name": "image.favicon",
  "description": "Generate multi-size ICO favicon from image",
  "inputTypes": ["image"],
  "outputTypes": ["image"],
  "params": [
    {
      "name": "sizes",
      "type": "array",
      "items": "number",
      "description": "Target sizes (square edge px). Default [16,32,48,256]",
      "required": false
    }
  ],
  "performance": "medium",
  "batchable": true
}
```

**实现绑定**（`packages/plugin-image/src/operations.ts` IMAGE_OPERATION_ENTRIES 新增）：

```typescript
{ capability: 'image.favicon', engine: 'canvas', operation: encodeIco },
```

复用 `createBlobCapabilityImpl` 工厂，无需自定义 execute 逻辑（标准 1→1 Blob 变换）。

**MCP Server**（`packages/mcp-server/src/tools/schemas.ts` 可选新增）：

```typescript
export const faviconSchema = z.object({
  input_path: z.string(),
  sizes: z.array(z.number().min(1).max(256)).optional(),
  output_path: z.string().optional(),
});
```

> MCP 暴露为可选项，不阻塞主流程。优先级 P2。

### 3.3 quick-image Layer 0：`useQuickFavicon` hook

**位置**：`packages/quick-image/src/hooks/useQuickFavicon.ts`

**预设定义**：

```typescript
export type FaviconPreset = 'standard' | 'modern' | 'full';

export interface FaviconPresetConfig {
  /** ICO 包含的尺寸（正方形边长 px） */
  sizes: number[];
  /** UI 展示标签 */
  label: string;
  /** 简短描述 */
  description: string;
}

export const FAVICON_PRESETS: Record<FaviconPreset, FaviconPresetConfig> = {
  standard: { sizes: [16, 32, 48], label: 'Standard', description: '16/32/48px' },
  modern:   { sizes: [32, 48, 256], label: 'Modern', description: '32/48/256px' },
  full:     { sizes: [16, 32, 48, 256], label: 'Full', description: '16/32/48/256px' },
};
```

**关键设计：outputInfo 合成**

`useImageTool.runWorkflow` 内部调用 `getImageInfo(outputBlob)` 获取输出元信息。ICO 文件无法被 `Image().decode()` 解码（浏览器不支持），`getImageInfo` 将返回 `null`。

**方案**：`useQuickFavicon` 使用 `tool.runWorkflowRaw` + 自管理 output 状态，合成 outputInfo：

```typescript
// hook 内部
const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
const [outputUrl, setOutputUrl] = useState<string | null>(null);

const outputInfo: ImageInfo | null = useMemo(() => {
  if (!outputBlob) return null;
  const maxSize = Math.max(...FAVICON_PRESETS[preset].sizes);
  return {
    width: maxSize,
    height: maxSize,
    size: outputBlob.size,
    format: 'ICO',
  };
}, [outputBlob, preset]);

// runFavicon 实现
const runFavicon = useCallback(async (nextPreset: FaviconPreset) => {
  const config = FAVICON_PRESETS[nextPreset];
  const wf = buildSingleStepImageWorkflow(
    'image.favicon',
    { sizes: config.sizes },
    'QuickFavicon',
    'Generate multi-size ICO favicon'
  );
  const result = await tool.runWorkflowRaw(wf);
  if (!result || result.status !== 'completed' || !result.outputs[0]) return;
  const blob = await tool.runtime!.exportAsset(result.outputs[0]);
  setOutputBlob(blob);
}, [tool, preset]);

// outputUrl 生命周期（同 useImageTool 模式）
useEffect(() => {
  if (!outputBlob) { setOutputUrl(null); return; }
  const url = URL.createObjectURL(outputBlob);
  setOutputUrl(url);
  return () => URL.revokeObjectURL(url);
}, [outputBlob]);
```

**返回值接口**：

```typescript
export interface UseQuickFaviconResult {
  // ─── 状态 ───
  ready: boolean;
  initError: string | null;
  inputUrl: string | null;
  inputInfo: ImageInfo | null;
  outputUrl: string | null;
  outputInfo: ImageInfo | null;   // 合成值（format='ICO'）
  outputBlob: Blob | null;
  busy: boolean;
  error: string | null;
  preset: FaviconPreset;

  // ─── 操作 ───
  handleFiles: (files: File[]) => Promise<void>;
  setPreset: (preset: FaviconPreset) => void;
  reset: () => void;
  clearError: () => void;
  run: () => Promise<void>;
}
```

**与 useQuickConvert 的结构差异**：

| 方面 | useQuickConvert | useQuickFavicon |
|---|---|---|
| 预设参数 | `{ format, quality? }` 静态 | `{ sizes: number[] }` 静态 |
| 输出元信息 | `getImageInfo(blob)` 解码获取 | **合成**（ICO 不可解码） |
| output 状态管理 | 委托 `useImageTool.runWorkflow` | **自管理**（`runWorkflowRaw` + 本地 state） |
| 派生状态 | `outputFormat: string \| null` | 无额外派生（outputInfo 已含 format） |
| 下载文件名 | `{original}.{format}` | `{original}.ico` |

### 3.4 quick-image Layer 1：`QuickFavicon` primitives

**位置**：`packages/quick-image/src/primitives/QuickFavicon.tsx`

遵循现有 compound component 模式（8 slots）：

```typescript
export const QuickFavicon = {
  Root,             // 创建 context，调用 useQuickFavicon(options)
  Upload,           // 拖放/点击选择，render-prop children
  PresetSwitcher,   // role="radiogroup"，3 个预设按钮
  Preview,          // type='input'|'output'，img 或 placeholder
  SizeBadge,        // 显示当前预设包含的尺寸列表（如 "16·32·48·256"）
  DownloadButton,   // downloadBlob(blob, '{name}.ico')
  ErrorDisplay,     // role="alert"
  ResetButton,      // disabledWhenEmpty
};
```

**特殊点**：

- `Preview` output 侧：ICO 无法直接作为 `<img src>` 预览（浏览器不解码 ICO 为图像）。**方案**：output 预览显示**输入图的缩小版**（favicon 是输入的等比缩放，视觉等价）+ format badge 标注 "ICO"。或取最大尺寸的 PNG 条目作为预览（需 engine 额外返回，增加复杂度，**不采用**）。
- `SizeBadge`：展示 `sizes.join('·')` + 文件体积（`formatBytes(outputInfo.size)`）。

### 3.5 quick-image Layer 2：`ImageQuickFavicon` 默认 UI

**位置**：`packages/quick-image/src/ImageQuickFavicon.tsx`

遵循现有 Layer 2 模式：

```typescript
export interface ImageQuickFaviconProps {
  locale?: Language;
  translations?: Partial<QuickTranslations>;
  theme?: Partial<QuickTheme>;
  mode?: QuickMode;
  initialPreset?: FaviconPreset;
  autoRun?: boolean;
  onComplete?: (result: QuickActionResult<FaviconPreset>) => void;
  plugins?: PluginLoadEntry[];
  components?: Partial<ImageQuickFaviconComponents>;
}
```

**默认 UI 布局**（与 6 个现有工具一致）：

```
┌─────────────────────────────────────────┐
│  [Drop Zone / Upload]                   │
├─────────────────────────────────────────┤
│  Preset Pills: [Standard] [Modern] [Full]│
├──────────────────┬──────────────────────┤
│  Input Preview   │  Output Preview      │
│  + Info Bar      │  + Info Bar (ICO)    │
├──────────────────┴──────────────────────┤
│  [Download .ico]          [Reset]       │
└─────────────────────────────────────────┘
```

### 3.6 i18n 键

新增共享键 + 工具专属键（6 语言：en/zh/ja/es/de/fr）：

```typescript
// 共享键（common namespace）
'common.faviconSizes': 'Sizes' / '尺寸' / ...

// 工具键（quickFavicon namespace）
'quickFavicon.title': 'Favicon Generator' / 'Favicon 生成' / ...
'quickFavicon.processing': 'Generating favicon…' / '正在生成 Favicon…' / ...
'quickFavicon.preset.standard': 'Standard' / '标准' / ...
'quickFavicon.preset.standard.desc': '16/32/48px — classic browser tabs' / '16/32/48px — 经典浏览器标签页' / ...
'quickFavicon.preset.modern': 'Modern' / '现代' / ...
'quickFavicon.preset.modern.desc': '32/48/256px — high-DPI & PWA' / '32/48/256px — 高分屏与 PWA' / ...
'quickFavicon.preset.full': 'Full' / '完整' / ...
'quickFavicon.preset.full.desc': '16/32/48/256px — maximum compatibility' / '16/32/48/256px — 最大兼容性' / ...
'quickFavicon.outputFormat': 'ICO' / 'ICO' / ...  (不翻译)
'quickFavicon.download': 'Download .ico' / '下载 .ico' / ...
```

zh 遵循 locale 模板习惯（不直译 en 语序）。

---

## 四、任务总览

| 任务 | 内容 | 估时 | 优先级 | 依赖 | 状态 |
|---|---|---|---|---|---|
| T1 | Engine `encodeIco` 操作 + 单测 | 3h | P0 | 无 | ⬜ |
| T2 | Capability `image.favicon` 声明 + plugin 注册 | 1h | P0 | T1 | ⬜ |
| T3 | `useQuickFavicon` hook（Layer 0）+ 单测 | 2h | P0 | T2 | ⬜ |
| T4 | `QuickFavicon` primitives（Layer 1） | 2h | P0 | T3 | ⬜ |
| T5 | `ImageQuickFavicon` 默认 UI（Layer 2）+ i18n 6 语言 | 3h | P0 | T4 | ⬜ |
| T6 | 测试补全 + typecheck + playground 集成 | 2h | P0 | T1-T5 | ⬜ |
| T7 | release 0.3.0 + CHANGELOG | 1h | P0 | T6 | ⬜ |
| **合计** | | **14h** | | | |

> **排期**：T1→T2→T3→T4→T5 串行（层间依赖），T6/T7 收尾。与 [20260723 功能完整性](./20260723-quick-image-functional-completeness.md) F1-F7 可并行（无代码交叉：F 系列改现有 6 工具 UI，T 系列新增第 7 工具全栈）。

---

## 五、任务明细

### T1 · Engine `encodeIco` 操作 + 单测（3h P0）

- **范围**：
  1. 新增 `packages/engine-image/src/operations/ico.ts`：`encodeIco` 函数 + 内部 `packIco` 纯函数
  2. `types.ts` 新增 `EncodeIcoParams` 接口
  3. `operations/index.ts` 导出 + `lazy.ts` OPERATION_LOADERS 注册 `'encode-ico'`
  4. 单测 `__tests__/ico.test.ts`：
     - 输入 100×100 PNG → 输出有效 ICO（验证 ICONDIR magic bytes + count + 各条目尺寸）
     - 多尺寸 [16,32,48] → 3 条目，offset 正确
     - 256 条目 width/height 字段为 0
     - 非正方形输入 → cover 裁切（验证输出 PNG 条目尺寸正确）
     - AbortSignal 中断 → 抛出 AbortError
     - 空 sizes / 超范围 size → 合理默认或 throw
- **不做**：不支持 BMP DIB 旧格式条目（仅 PNG-in-ICO）；不支持 CUR（光标）格式；不做 ICO 解码（只编码）
- **输入**：`canvasEngine`（decode/encode/createCanvas）、`throwIfAborted` 工具函数
- **输出**：`operations/ico.ts`（新）、`types.ts`（+EncodeIcoParams）、`operations/index.ts`（+export）、`lazy.ts`（+loader）、`__tests__/ico.test.ts`（新）
- **依赖**：无
- **验收**：
  - `pnpm test --filter engine-image` 全过
  - 生成的 ICO 文件可被 macOS Finder / Windows Explorer 正确显示缩略图
  - 生成的 ICO 可被 Chrome `<link rel="icon">` 正确加载
  - 覆盖率：lines ≥ 60% / branches ≥ 75%
- **估时**：3h
- **风险**：`canvasEngine.encode(canvas, 'png')` 在 Worker 环境（OffscreenCanvas）的兼容性 → 已有 compress/convert 验证此路径可行
- **优先级**：P0

### T2 · Capability `image.favicon` 声明 + plugin 注册（1h P0）

- **范围**：
  1. `packages/capability/manifests/image.manifest.json` 新增 `image.favicon` 条目
  2. 运行 `pnpm codegen`（或手动同步 `image.generated.ts`）
  3. `packages/plugin-image/src/operations.ts` IMAGE_OPERATION_ENTRIES 新增 `{ capability: 'image.favicon', engine: 'canvas', operation: encodeIco }`
  4. 更新 `docs/capabilities.md` 能力清单
- **不做**：不修改 `image.convert` format enum（预存 `'ico'` 条目保留，见决策日志）；不新增 MCP tool（P2 延后）
- **输入**：T1 产出的 `encodeIco` 函数
- **输出**：`image.manifest.json`（+条目）、`image.generated.ts`（重新生成）、`operations.ts`（+entry）、`docs/capabilities.md`（+行）
- **依赖**：T1
- **验收**：
  - `pnpm test --filter plugin-image` 全过（capability 注册不 throw）
  - `runtime.run({ nodes: [{ capability: 'image.favicon', params: { sizes: [32] } }] }, [assetId])` 返回有效 ICO blob
- **估时**：1h
- **风险**：codegen 脚本是否需要额外配置 → 检查 `pnpm codegen` 现有流程
- **优先级**：P0

### T3 · `useQuickFavicon` hook（Layer 0）+ 单测（2h P0）

- **范围**：
  1. 新增 `packages/quick-image/src/hooks/useQuickFavicon.ts`：
     - `FaviconPreset` / `FaviconPresetConfig` / `FAVICON_PRESETS`
     - `UseQuickFaviconResult` 接口
     - `useQuickFavicon(options?)` 实现（使用 `tool.runWorkflowRaw` + 自管理 output state + 合成 outputInfo）
  2. `hooks/index.ts` 导出
  3. 包根 `index.ts` 导出
  4. 单测 `__tests__/useQuickFavicon.test.ts`：
     - 初始状态正确（ready=false, preset='standard'）
     - handleFiles → autoRun → outputBlob 非 null + outputInfo.format='ICO'
     - setPreset 触发重跑
     - onComplete 回调触发（deduped）
     - reset 清空全部状态
- **不做**：不改 `useImageTool` 内部实现；不新增 `useImageTool` 的 API
- **输入**：T2 产出的 `image.favicon` capability（workflow 可执行）
- **输出**：`hooks/useQuickFavicon.ts`（新）、`hooks/index.ts`（+export）、`index.ts`（+export）、`__tests__/useQuickFavicon.test.ts`（新）
- **依赖**：T2
- **验收**：
  - `pnpm test --filter quick-image` 全过
  - hook 返回的 `outputInfo` 正确合成（width=maxSize, format='ICO', size=blob.size）
  - `outputUrl` 生命周期正确（revoke on change / unmount）
- **估时**：2h
- **风险**：`runWorkflowRaw` 返回后 `runtime.exportAsset` 的 blob type 可能为 `application/octet-stream`（OPFS 兜底）→ 下载时 `downloadBlob` 已有 MIME repair 逻辑（`inferMimeFromFilename`），需确保 `.ico` 扩展名在 MIME 映射中 → **T3 需同步在 `internal/download.ts` 的 `MIME_BY_EXT` 新增 `ico: 'image/x-icon'`**
- **优先级**：P0

### T4 · `QuickFavicon` primitives（Layer 1）（2h P0）

- **范围**：
  1. 新增 `packages/quick-image/src/primitives/QuickFavicon.tsx`：8 slot compound component
  2. `primitives/index.ts` 导出
  3. 特殊处理：
     - `Preview` output 侧：ICO 不可直接 `<img>` 预览 → 显示输入图缩小版 + "ICO" format badge overlay
     - `SizeBadge`：显示 `sizes.join(' · ')` + `formatBytes(outputInfo.size)`
     - `DownloadButton`：固定文件名 `{originalName}.ico`
  4. 包根 `index.ts` 导出
- **不做**：不做 ICO 解码预览（不提取内嵌 PNG 条目）；不做自定义尺寸输入（YAGNI，预设覆盖主流需求）
- **输入**：T3 产出的 `useQuickFavicon` hook
- **输出**：`primitives/QuickFavicon.tsx`（新）、`primitives/index.ts`（+export）、`index.ts`（+export）
- **依赖**：T3
- **验收**：
  - 所有 slot 可独立渲染（context 外 throw）
  - ARIA 属性完整（radiogroup / alert / button roles）
  - 键盘可操作（Tab / Enter / Space）
- **估时**：2h
- **风险**：无
- **优先级**：P0

### T5 · `ImageQuickFavicon` 默认 UI（Layer 2）+ i18n 6 语言（3h P0）

- **范围**：
  1. 新增 `packages/quick-image/src/ImageQuickFavicon.tsx`：组合 QuickFavicon primitives 为完整默认 UI
  2. `i18n/ui.ts` 新增 quickFavicon 命名空间键（6 语言 en/zh/ja/es/de/fr）
  3. 遵循 F1（功能完整性文档）确立的规范：
     - CSS 变量走 `--lokvis-*`（含 inline fallback）
     - `mode` prop 支持 light/dark/system
     - busy 状态渲染（shimmer + spinner + processing 文案）
     - 文件信息栏（input: format · WxH · size / output: ICO · maxSize · size）
     - a11y（aria-live / focus-visible / keyboard）
  4. 包根 `index.ts` 导出 `ImageQuickFavicon` + `ImageQuickFaviconProps`
- **不做**：不做自定义尺寸输入 UI；不做多文件批量；不做 apple-touch-icon 联动
- **输入**：T4 产出的 primitives、F1 产出的 theme/mode 基础设施（若 F1 未完成，先用现有 theme 系统，F1 后自动受益）
- **输出**：`ImageQuickFavicon.tsx`（新）、`i18n/ui.ts`（+键）、`index.ts`（+export）
- **依赖**：T4；软依赖 F1（theme/mode 基础设施）
- **验收**：
  - playground 新增 `/tools/quick-favicon` 页面可完整走通流程
  - 浅色/深色模式正确
  - 6 语言无缺失键
  - 纯键盘完成完整流程
- **估时**：3h
- **风险**：若 F1 未完成，theme/mode 需临时用现有暗色硬编码 → 可接受，F1 完成后统一迁移
- **优先级**：P0

### T6 · 测试补全 + typecheck + playground 集成（2h P0）

- **范围**：
  1. 集成测试：`__tests__/ImageQuickFavicon.test.tsx`（Layer 2 渲染 + 交互）
  2. `pnpm typecheck`（全 monorepo）0 errors
  3. `pnpm test`（全 monorepo）全过，覆盖率不低于现状
  4. playground 新增 `src/pages/tools/quick-favicon.astro` 页面
  5. playground 导航新增 favicon 入口
  6. 浏览器走查：上传 → 自动处理 → 切换预设 → 下载 → 验证 .ico 文件有效
- **不做**：不做 E2E（Playwright）测试（现有 quick-image 工具均无 E2E）
- **输入**：T1-T5 全部产出
- **输出**：集成测试文件、playground 页面、typecheck/test 通过
- **依赖**：T1-T5
- **验收**：
  - `pnpm typecheck` 0 errors
  - `pnpm test` 全过
  - playground `/tools/quick-favicon` 完整可用
  - 下载的 .ico 文件在 Chrome / macOS Finder 中正确显示
- **估时**：2h
- **风险**：无
- **优先级**：P0

### T7 · release 0.3.0 + CHANGELOG（1h P0）

- **范围**：
  1. 版本 0.2.0 → **0.3.0**（新增工具 = minor bump，0.x 语义）
  2. CHANGELOG.md 记录：新增 `useQuickFavicon` / `QuickFavicon` / `ImageQuickFavicon`；新增 `image.favicon` capability；新增 `encodeIco` engine operation
  3. `engine-image` 同步 bump（新增 operation）
  4. `plugin-image` 同步 bump（新增 capability）
  5. npm publish（quick-image + engine-image + plugin-image）
- **不做**：不改现有 hooks API（冻结承诺不变）
- **输入**：T6 通过
- **输出**：CHANGELOG.md、package.json 版本号、npm 发布
- **依赖**：T6
- **验收**：
  - `npm view @lokvis/embed-image version` = 0.3.0
  - 空白 Vite 项目 `npm i @lokvis/embed-image@0.3.0` + import `ImageQuickFavicon` 可渲染
- **估时**：1h
- **风险**：与 F1-F7（0.2.0）的发布顺序 → 若 F 系列先发布则本任务基于 0.2.0 bump；若本任务先完成则 F 系列基于 0.3.0 bump。两者代码无交叉，顺序灵活。
- **优先级**：P0

---

## 六、发布策略与向后兼容

| 层 | 本次变更 | 兼容性 |
|---|---|---|
| Engine (`engine-image`) | 新增 `encodeIco` 操作 + `EncodeIcoParams` 类型 | 纯新增，不影响现有操作 |
| Capability (`plugin-image`) | 新增 `image.favicon` 条目 | 纯新增，现有 9 个 capability 不变 |
| Layer 0 hooks | 新增 `useQuickFavicon` | 现有 6 hooks 接口冻结不变 |
| Layer 1 primitives | 新增 `QuickFavicon` compound | 纯新增 |
| Layer 2 default UI | 新增 `ImageQuickFavicon` | 纯新增 |
| i18n | 新增 quickFavicon 命名空间键 | 纯新增，现有键不变 |

**与 cloud 的解耦**：cloud 可直接消费 `useQuickFavicon` hook（Layer 0）构建品牌化 favicon UI，或等待 Layer 2 默认 UI 直接使用。两侧独立推进，无阻塞关系。

**与 F1-F7（功能完整性）的关系**：代码路径无交叉（F 改现有 6 工具 UI 基础设施，T 新增第 7 工具全栈）。发布顺序灵活，建议 F1（theme/mode 基础设施）先完成，T5 可直接受益。

---

## 七、决策日志

### 2026-07-24 · favicon 归属 open 侧

- **背景**：lokvis-cloud favicon-generator 工具页需要 ICO 生成能力，当前 `WorkspaceShell` 的 `format=ico` 参数实际无法产出有效 ICO 文件（engine 不支持）
- **评审结论**：favicon 生成通过中性第三方测试（任何网站都需要），属于 open 侧功能完整性
- **被否决的方案**：
  - 「cloud 侧自行实现 ICO 编码」——违反 DRY，ICO 编码是通用能力，不应绑定单一消费方
  - 「扩展 `image.convert` 支持 format=ico」——ICO 是多尺寸容器，语义不同于单格式转换；参数集不同（sizes[] vs quality）；会污染 convert 的简洁接口
- **确立方案**：独立 `image.favicon` capability + `encodeIco` engine operation + `useQuickFavicon` hook 全栈实现

### 2026-07-24 · `image.convert` format enum 中的 'ico' 处理

- **背景**：`image.manifest.json` 的 `image.convert` format enum 已包含 `'ico'`（`image.generated.ts:71`），但 engine 实际无法编码 ICO（`canvas-engine.test.ts` 验证 throw 行为）
- **决策**：本次**不修改** `image.convert` 声明（避免 manifest breaking change + 已发布的 capability schema 兼容性）
- **后续**：下一个 major 版本（或专项清理任务）中，从 `image.convert` format enum 移除 `'ico'`，引导用户使用 `image.favicon`
- **临时措施**：`image.convert` 传入 `format: 'ico'` 时 engine 会 throw 明确错误信息（现有行为，已有测试覆盖），用户不会得到静默错误

### 2026-07-24 · ICO 预览策略

- **背景**：ICO 文件无法被浏览器 `<img>` 元素解码显示
- **被否决的方案**：
  - 「engine 额外返回最大尺寸 PNG 条目用于预览」——改变 `Blob → Blob` 签名，违反 Engine 层纯函数约束
  - 「hook 层解码 ICO 提取 PNG 条目」——需要 ICO 解码器，增加复杂度，且 hook 层不应有格式解析逻辑
- **确立方案**：output 预览使用**输入图的缩小版**（favicon 是输入的等比 cover 裁切，视觉等价）+ "ICO" format badge 标注。用户通过下载后在系统文件管理器中确认最终效果。

---

## 八、文档导航

- [← 20260723-quick-image-functional-completeness.md（Layer 2 功能缺口修复）](./20260723-quick-image-functional-completeness.md)
- [← 20260719-image-workspace-ui-design.md（三层架构设计）](./20260719-image-workspace-ui-design.md)
- [← 20260718-phase2-4-task-plan.md（任务模板基线）](./20260718-phase2-4-task-plan.md)
- [→ lokvis-cloud：Tool 页 Quick Image 原生 UI 改造](../../lokvis-cloud/docs/tasks/quick-image-native-ui.md)

---

*本文档基于 2026-07-24 架构调研编制。任务字段模板沿用 20260718-phase2-4-task-plan.md。*
