# WASM 图像编码器接入设计（AVIF 优先）（2026-07-24）

> **本文档是 lokvis-open 图像引擎引入 WASM 编码器的设计方案**。起因：convert 工具选择 AVIF 后浏览器无原生编码器，canvas 静默回退 PNG（已修复为显式 throw + UI 门控，见 `.changeset/fix-convert-silent-fallback.md`）。修复保证了正确性，但 AVIF 在 Firefox / 部分 Safari 上**仍然不可用**。WASM 编码器（libavif/aom 编译产物）是使 AVIF 全浏览器可用的路径，也是架构预留（`types.ts` 的 `'squoosh'` 引擎槽位、`lazy.ts` 的 WASM 兼容声明、W21.2 service worker 预加载基建）的兑现。
>
> 本文同时按评审要求**细化「类似 Squoosh 全量 WASM 编解码套件」的优劣与必要性**（§三），结论作为决策日志 D1 存档。
>
> 状态约定：`⬜ 待办` / `🟡 进行中` / `✅ 完成` / `⛔ 阻塞` / `❌ 取消` / `⏭️ 延后`
>
> 任务字段沿用 `20260718-phase2-4-task-plan.md` 模板：范围 / 不做 / 输入 / 输出 / 依赖 / 验收 / 估时 / 风险 / 优先级。

---

## 一、边界原则（独立性守护）

### 1.1 中性第三方测试

**「一个中性第三方站点（无自有设计系统、零配置接入）是否也需要 AVIF 编码？」**

答案为**是**——AVIF 是当前压缩率最优的通用 Web 格式，任何图片工具的消费方都需要它。让 AVIF 在所有浏览器可用属于 engine 层能力完整性，与 compress / convert 同级，不绑定任何消费方的产品决策。

### 1.2 进 / 不进 清单

| 进 open（本文档） | 不进 open（本文档明确排除） |
|---|---|
| AVIF WASM 编码器（engine 层，native-first / wasm-fallback） | 全量 Squoosh 式编解码套件（mozjpeg/oxipng/webp/jxl 全家桶，见 §三） |
| 编码器私有 worker（off-main-thread 编码 + 取消） | 激活 dormant WorkerHost 全链路（独立任务，见 D2） |
| WASM 二进制分发策略（运行时 fetch + sw 缓存 + 预加载接线） | 自编译 emscripten 构建链（Phase 2 用预构建产物，见 D3） |
| `formatSupport` 语义升级（avif = 原生 \|\| wasm） | WebCodecs 实现（仅监测，见 §三.4） |
| quick-image「慢速格式」提示 UX + i18n（中性 UX，任何第三方都需要） | 品牌化编码参数预设 / 付费质量档位 |
| capabilities.md 引擎支持矩阵文档 | Node 侧 WASM 统一（`/node` 入口维持 sharp 可选 peer，见 §三.3 触发条件 e） |

### 1.3 五层架构遵循

```
UI (quick-image: 慢速提示 / formatSupport 门控)
  → Workflow (buildSingleStepImageWorkflow —— 无变化)
    → Runtime (WorkflowExecutor —— 无变化，signal 已贯通)
      → Capability (plugin-image: image.compress / image.convert —— 无变化)
        → Engine (engine-image: encodeSmart 分发 → canvas 原生 | wasm-avif)
```

变更**只发生在 Engine 层内部**（+ quick-image 一个 i18n 提示）。Capability manifest 不变、`BlobOperation` 签名 `(blob, params, signal?) => Promise<Blob>` 不变、hooks 接口冻结。

### 1.4 向后兼容

- `canvasEngine.encode` 行为不变（不支持格式仍 throw），新增的 `encodeSmart` 是**内部**分发函数，compress / convert 操作改调它，对外语义从「部分浏览器 throw」变为「全浏览器成功」——这是缺陷修复方向的兼容变更。
- quick-image 6 个现有 hooks 接口冻结；`formatSupport.avif` 从「运行时探测结果」变为「恒 true（wasm 兜底）」，消费方 UI 门控逻辑无需改动（`disabled` 计算自然失效）。

---

## 二、现状评估

### 2.1 AVIF 编码支持现状

| 路径 | 状态 | 问题 |
|---|---|---|
| Canvas 原生 `toBlob('image/avif')` | Chrome/Edge 支持；Firefox 不支持编码；Safari 依版本（以运行时探测为准） | 静默回退 PNG 已修为 throw（本次修复），但 Firefox 等浏览器上 AVIF **功能缺失**而非仅报错 |
| quick-image `formatSupport` 门控 | 已上线（0.2.0 changeset 排队中）：不支持的预设禁用 | 门控只是诚实地「告知不可用」，没有解决不可用本身 |
| WASM（libavif + aom） | 代码为零，但架构槽位已预留（见 2.2） | 本方案要兑现的部分 |
| WebCodecs（`VideoEncoder` av01 + AVIF 容器） | 仅文档提及，`types.ts` 保留 `'webcodecs'` 槽位 | 成熟度不足（见 §三.4） |

### 2.2 已预留的基建盘点（关键事实）

架构对 WASM 的预留程度远超一般预期，本方案的增量工作因此显著小于从零开始：

| 基建 | 位置 | 现状 |
|---|---|---|
| 引擎槽位 | `engine-image/src/types.ts:9` | `ImageEngineName = 'canvas' \| 'squoosh' \| 'webcodecs' \| 'imagemagick'` —— `'squoosh'` 已占位 |
| 引擎注册表 | `engine-image/src/adapter.ts` | `createEngineRegistry` / `registerImageEngine` 就绪；`ImageEngineAdapter.initialize?()` 是天然的 WASM 加载钩子 |
| 懒加载接口 | `engine-image/src/lazy.ts` | 头注释明言「同一接口未来可承载 WASM 引擎（Squoosh AVIF/WebP 编码器）」；`lazyLoadOperation` / `prefetchOperation` 已声明与 WASM 兼容 |
| SW 预加载 | `apps/playground/public/sw.js`（W21.2，`SW_VERSION='v5-w21.2-wasm-preload'`） | `.wasm` cache-first 策略 + `Content-Type: application/wasm` 修正 + `PRELOAD_WASM` postMessage 协议 + 跨域 `.wasm` 缓存 + `@lokvis/` 路径备用 CDN 回退——**整套机制明言「为未来 Squoosh WASM 引擎铺路」** |
| 预加载 link | `PlaygroundLayout.astro` | `wasmPreload?: string[]` prop 注入 `<link rel="preload" as="fetch" crossorigin>`（当前传空数组） |
| 多线程前提 | 部署层 | COOP/COEP 头已上线（SharedArrayBuffer 可用，见 `THIRD_PARTY_LICENSES.md:128`） |
| Worker 协议 | `runtime/src/worker-host.ts` / `worker-protocol.ts` | 完整协议（ready 握手 / BlobRef transferable 信封 / cancel / `WorkerEvent` 进度通道）——**但 dormant**：plugin-image 当前在主线程直调 engine 操作 |
| AbortSignal | 全链路 | 主线程路径与 worker 路径均已贯通（executor → capability → operation → `throwIfAborted`） |
| 进度回调 | `schema/src/capability.ts:117` | `ExecutionContext.onProgress?` 已定义，但 `executor.ts` 从不填充；`WorkerEvent` 通道 host 侧已实现重放，worker 侧从不发射 |

### 2.3 打包约束（事实）

`engine-image` 构建是**纯 `tsc`**（ESM，无 tsup/rollup），`dist` 不含也**无法内联** `.wasm` 二进制。仓库无任何 `?url` / `?worker` 资产处理先例。因此 WASM 二进制只能**运行时 `fetch(url)` 加载**——恰好与 2.2 中 sw 预加载基建的设计意图吻合（该基建就是为 fetch 路径建的）。

### 2.4 核心结论

1. **缺口单一且明确**：只缺 AVIF 编码器。webp（Chrome/Edge/Safari 均原生支持编码）、png/jpeg（无损/通用）不存在功能缺口，canvas 路径足够。
2. **增量成本被基建摊薄**：懒加载、sw 缓存、预加载协议、COOP/COEP、引擎注册表全部就绪，本方案实质工作 = 一个编码器模块 + 一个分发函数 + 分发接线。
3. **分发是唯一新课题**：tsc 不打包二进制 → 需要定义 wasm URL 来源与消费方配置 API（§四.3），这是既往任务未覆盖的新设计面。
4. **进度上报是既有缺口，不在本方案范围内新增**：`onProgress` 从未被 executor 填充，扩展 `BlobOperation` 签名会破坏 `Blob ↔ Blob` 纯函数约定（AGENTS.md）。慢编码的 UX 缓解走「不确定态 + 可取消 + 预加载」三件套（§四.5），精细进度条留给 WorkerHost 激活任务。

---

## 三、方案对比：AVIF 单点 WASM vs 全量 Squoosh 式 WASM

> 本节是评审要求的重点：如果把方案从「只补 AVIF」扩大到「类似 Squoosh 的全量 WASM 编解码套件」（mozjpeg / oxipng / webp / avif / jxl 全部走 WASM），优劣与必要性如何。

### 3.1 方案 A：AVIF 单点 WASM 兜底（本方案推荐）

**定义**：仅在原生编码器缺失时加载 WASM AVIF 编码器；其余格式全部维持 canvas 原生路径。分发策略 native-first / wasm-fallback。

- 增量二进制：仅 avif 一项，**3.3 MB raw / 1.07 MB gzip**（`avif_enc.wasm`，T1 实测；懒加载 + sw 缓存）
- 增量工期：约 14h（§五）
- 受益面：Firefox / 旧 Safari 用户获得完整 AVIF 能力（convert + compress 两个工具同时生效）
- 风险面：单编码器，维护面小

### 3.2 方案 B：全量 Squoosh 式 WASM 套件

**定义**：所有格式（png/jpeg/webp/avif，可选 jxl/qoi）一律用 WASM 编解码器，完全绕开 canvas 原生编码。即 Squoosh 的技术路线。

#### 3.2.1 优势

1. **跨浏览器输出一致性**：同一 codec 版本在所有浏览器产出逐字节相同的输出。对需要 CI 可复现、品牌资产像素级一致的消费方是硬价值；也彻底消灭「Chrome 正常、Safari 变色」这类支持矩阵问题。
2. **质量上限更高**：mozjpeg 同质量下比 canvas 原生 JPEG 小约 5–10%（Safari 原生 JPEG 编码器尤其弱）；oxipng 对 PNG 有真实压缩收益；AVIF 质量调参（speed/chroma subsampling）比 canvas 的单一 quality 旋钮精细得多。
3. **与浏览器实现解耦**：不再有静默回退、不再有运行时探测矩阵、不再跟踪各浏览器编码器 bug。支持矩阵由我们的 wasm 构建版本唯一决定。
4. **格式扩展自由**：可实现浏览器永远不会原生支持的格式（JPEG XL、QOI、AV1 变体），产品面不受浏览器路线图约束。
5. **单一维护面**：codec 行为钉死在 wasm 构建版本，不随用户浏览器版本漂移，测试矩阵收敛。
6. **基建已为此设计**：`types.ts` 的 `'squoosh'` 槽位、sw 预加载、COOP/COEP、lazy.ts——架构文档（`business/04-技术架构设计.md` §6）明列「图像编解码：Squoosh WASM 为主」。方案 B 是架构愿景的直接兑现。
7. **竞争对位**：Squoosh / TinyPNG 级工具的稳定高质量输出是「local-first + 专业级压缩」差异化叙事的支点。

#### 3.2.2 劣势

1. **下载成本高**：mozjpeg ~0.3 MB + webp ~0.4 MB + avif ~1.5 MB + oxipng ~0.5 MB，全套 3–5 MB（gzip 1–2 MB）。即使懒加载，首次使用任一格式都要现下对应二进制；弱网环境首体验明显劣于原生。
2. **速度全面劣于原生**：wasm AVIF 编码比原生慢 10–60 倍（1MP 图约 2–10s vs 原生 50–200ms，T1 实测校准）；wasm webp 也慢于 Chrome 原生编码器。**对已拥有原生编码器的用户（Chrome/Edge 多数），方案 B 是纯粹的体验降级**——用更慢的编码器替换免费的原生能力。
3. **工程复杂度陡增**：每个 codec 都需要 worker 编排、内存治理（wasm 32 位地址空间 × 大图，需与现有 tile 路径交互设计）、版本追踪、安全补丁（解码器 CVE 史不短）、license 归属（需扩 `THIRD_PARTY_LICENSES.md`）。
4. **ROI 与阶段错配**：Phase 1/2 的产品承诺是「local-first 通用工具」，质量差异化尚未经过用户验证；方案 B 约 3–4 周工期（含测试矩阵），是方案 A 的 3–4 倍，且大部分投入（mozjpeg/oxipng）解决的是「更好」而非「从无到有」。
5. **测试面爆炸**：每 codec × 每浏览器 × 每尺寸档位，e2e 矩阵从方案 A 的 1×N 变成 5×N。
6. **原生路径足够好的格式占多数**：png 无损无需 wasm；webp 三大引擎均原生支持且质量可接受；jpeg 的 mozjpeg 增益真实但非功能缺口。**功能缺口只有 AVIF 一项**。

#### 3.2.3 必要性评估：触发条件（Go/No-Go）

方案 B 当前**不必要**。以下任一条件激活时重新评审：

| # | 触发条件 | 说明 |
|---|---|---|
| a | 产品定位转向「专业级压缩质量」为核心差异化 | 与 Squoosh/TinyPNG 正面对位时，mozjpeg/oxipng 从「更好」变为「必须有」 |
| b | 企业/CI 场景要求跨浏览器逐字节可复现输出 | 一致性从 nice-to-have 变为签单硬需求 |
| c | 原生编码器出现质量/正确性事故 | 如某主流浏览器 webp 编码器劣化，解耦成为韧性需求 |
| d | 浏览器永不实现的格式出现真实用户需求 | JPEG XL / QOI 等有可验证的搜索量或 issue 诉求 |
| e | Node/无头场景需要与浏览器同构 codec | `/node` 入口当前依赖 sharp（可选 peer）；若 MCP/SDK 服务端场景要求同构输出，wasm 是唯一路径 |

**结论**：Phase 1/2 无任一条件激活 → 方案 B 不必要。方案 A 以约 1/4 成本解决唯一的真实功能缺口（AVIF 在 Firefox/部分 Safari 不可用），且**验证整条 wasm 管线**（加载 → 缓存 → worker → 取消 → UX）。若未来触发条件激活，管线可复用，codec 逐个追加（下一个 ROI 最高的是 mozjpeg）——`ImageEngineAdapter` 注册表 + `lazy.ts` 支持这种渐进演进，无需返工。

### 3.3 方案 A 与方案 B 的量化对照

| 维度 | 方案 A（AVIF 单点） | 方案 B（全量套件） |
|---|---|---|
| 二进制增量 | 3.3 MB raw / 1.07 MB gzip（仅 avif，懒加载） | 3–5 MB（全套） |
| 工期 | ~14h | ~3–4 周 |
| 原生支持用户的体验 | 不变（native-first） | 降级（强制 wasm，更慢） |
| 功能缺口修复 | AVIF ✅ | AVIF ✅ + 质量增益 |
| 一致性收益 | 无（各浏览器原生差异仍在） | 逐字节一致 |
| 维护面 | 1 个 codec | 4–5 个 codec + 构建链 |
| 架构兑现度 | 验证 wasm 管线 | 完全兑现 squoosh 槽位 |
| 当前必要性 | **必要**（功能缺口） | **不必要**（触发条件未激活） |

### 3.4 WebCodecs 路线评估（第三选项，仅监测）

`VideoEncoder`（codec string `av01.*`）+ 自封装 AVIF 容器理论上可获得**原生速度**的 AVIF 编码。当前不可作为主路线：仅 Chromium 系稳定支持，Safari 16.4+ 部分可用、Firefox 需 flag；`av01` 编码配置脆弱（关键帧/码率控制语义与静图编码错位）；无进度回调；容器封装需自写（AVIF = HEIF 容器 + AV1 OBU，muxer 非平凡工作量）。

**处置**：`types.ts` 的 `'webcodecs'` 槽位继续保留；方案 A 的 `encodeSmart` 分发函数是单点扩展位——未来 WebCodecs 成熟后可作为「原生速度档」插入分发链（native → webcodecs → wasm），不影响本方案任何设计。

---

## 四、分层设计（方案 A 实现）

### 4.1 Engine 层：`encodeSmart` 分发 + wasm-avif 编码器

**分发函数**（新文件 `packages/engine-image/src/operations/wasm-encode.ts`）：

```typescript
/**
 * 统一编码分发：native-first / wasm-fallback。
 * compress / convert / tile 路径的编码调用点全部改经此函数（单一集成点）。
 */
export async function encodeSmart(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  format: ImageOutputFormat,
  quality: number,
  signal?: AbortSignal
): Promise<Blob> {
  // 1. 原生优先：canvas 编码器可用（含 png/jpeg 恒真）直接走原生
  if (await isNativeEncodeSupported(format)) {
    return canvasEngine.encode(canvas, format, quality);
  }
  // 2. WASM 兜底：当前仅 avif 有 wasm 编码器
  if (format === 'avif') {
    return encodeAvifWasm(canvas, quality, signal);
  }
  // 3. 无兜底：保持既有 throw 语义（canvasEngine.encode 的 UnsupportedFormatError）
  return canvasEngine.encode(canvas, format, quality);
}
```

要点：

- `isNativeEncodeSupported(format)`：复用 `canvas-engine.ts` 现有 `detectFormatSupport()` 的探测结果，**模块级缓存**（探测一次，结果进程内不变）。png/jpeg 短路 true（与 quick-image `detectEncodeSupport` 同约定）。
- 第 3 分支故意调 `canvasEngine.encode` 让它 throw，**不新增错误类型**——不支持且无兜底的格式行为与今天完全一致。
- `operations/encode.ts` 的 `compress` / `convert` / `setBackground` 与 `tiles.ts` 的 tile 编码调用点统一替换为 `encodeSmart`。tile 路径无需特殊处理（分发点在编码函数内部）。

**WASM AVIF 编码器**（同文件或 `wasm/avif.ts`）：

```typescript
export async function encodeAvifWasm(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  quality: number,
  signal?: AbortSignal
): Promise<Blob> {
  throwIfAborted(signal);
  const { data, width, height } = extractImageData(canvas); // RGBA 像素
  const worker = await getAvifWorker();                      // 模块私有 worker，单例复用
  const buffer = await postEncodeRequest(worker, {
    data: data.buffer, width, height, quality,
  }, signal);                                               // transfer RGBA buffer
  return new Blob([buffer], { type: 'image/avif' });
}
```

要点：

- **输入是 RGBA 像素而非 canvas**：libavif 原生接受 raw RGBA，canvas/ImageBitmap 不可跨 worker 传递，`getImageData()` 的 ArrayBuffer 可 transfer，零拷贝。
- **编码器私有 worker**（D2）：`getAvifWorker()` 维护模块级单例 `Worker`（`new Worker(new URL('./avif-worker.js', import.meta.url), { type: 'module' })`），worker 内部 `import` 预构建 libavif wasm 绑定。编码是 CPU 密集秒级操作，**不得**在主线程运行。
- **取消**：T1 实测确认 `@jsquash/avif` 的 `module.encode()` 是单次同步 wasm 调用，**无进度/中断钩子**，协作式中断不可行。取消语义 = `signal` abort → **terminate worker 并重建单例**（已传输的 RGBA buffer 随 worker 回收，无泄漏；重建成本 = 一次 wasm fetch，sw 缓存命中后 <100 ms）。
- **内存**：RGBA = width×height×4 字节，4096² ≈ 67 MB，wasm 32 位地址空间内安全；>4096 走既有 tile 路径（tile 内编码，天然分块）。

### 4.2 Worker 内部：codec 加载与编码

`avif-worker.ts`（engine-image 内新文件，构建为独立 chunk）：

```typescript
// 伪代码骨架（T1 后定稿）
import encode, { init } from '@jsquash/avif/encode.js';

let ready: Promise<void> | null = null;

function ensureCodec(): Promise<void> {
  // 强制单线程版（D6）：绕过包内 threads() 自动选择，避免 pthread worker 嵌套问题
  ready ??= (async () => {
    const resp = await fetch(resolveAvifWasmUrl());       // 见 4.3，sw cache-first 已覆盖
    if (!resp.ok) throw new Error(`WASM fetch failed: ${resp.status}`);
    await init({ wasmBinary: await resp.arrayBuffer() }); // T1 实测可行的注入路径
  })();
  return ready;
}

onmessage = async (e) => {
  const { id, data, width, height, quality } = e.data;
  await ensureCodec();
  const out = await encode({ data: new Uint8ClampedArray(data), width, height }, {
    quality,
    speed: quality >= 80 ? 8 : 6,   // D7：高档位求快（含 targetSize 二分），低档位求体积
  });
  postMessage({ id, ok: true, buffer: out }, [out]);
};
// 取消不由 worker 协议处理：host 侧 abort 时直接 terminate（包无中断钩子，见 4.1）
```

- codec 初始化**只发生一次**（worker 单例 + 模块级缓存），第二次编码零加载成本。
- **无进度上报**（D5 定稿）：T1 确认包无进度钩子，worker 协议不含 progress 消息；精细进度留给 WorkerHost 激活任务统一设计，本方案不预留死接口。

### 4.3 WASM 二进制分发

约束（2.3）：tsc 不内联二进制 → 运行时 fetch。设计：

```typescript
// engine-image/src/wasm-config.ts（新文件）
export interface WasmEncoderConfig {
  /** avif wasm 二进制 URL；默认 = 发布包的 jsdelivr 版本化路径 */
  avifUrl?: string;
  /** 整体禁用 wasm 兜底（bundle 敏感消费方可关闭，avif 回退到 throw 语义） */
  enabled?: boolean;
}

export function configureWasmEncoders(config: WasmEncoderConfig): void;
```

- **默认 URL**：`https://cdn.jsdelivr.net/npm/@lokvis/engine-image@{version}/dist/wasm/avif.wasm`——wasm 二进制随 npm 包发布（`files` 增加 `dist/wasm`），版本与代码锁定，无漂移。
- **备用 CDN**：playground sw.js 已有 `@lokvis/` 路径的备用 CDN 回退逻辑，直接复用（验证时发现并修复其对 scoped 包前缀重复拼接的缺陷，见下方实现结论）。
- **消费方覆盖**：cloud 等消费方可 `configureWasmEncoders({ avifUrl: '/wasm/avif.wasm' })` 自托管（Astro `public/` 复制一份即可），零配置消费方走 CDN 默认。
- **预加载接线**：playground `PlaygroundLayout.astro` 的 `wasmPreload` prop 从空数组改为按工具页注入 avif.wasm URL（convert/compress 页），用户进入工具页即后台预取，sw 落缓存。

**实现结论（T3 已落地）**：

- **版本锁定的实现方式**：纯 tsc 在 `rootDir: ./src` 约束下无法 `import ../package.json`，故沿用本仓 codegen 约定——新增 `packages/engine-image/scripts/gen-version.mjs`，把 `package.json` 的 version 物化为 `src/wasm/wasm-asset-version.generated.ts`（`ENGINE_IMAGE_VERSION` 常量），`wasm-config.ts` 引用它拼接版本化 URL。该脚本串入根 `pnpm codegen`（`codegen-capabilities` 之后），`pnpm build` 在 turbo 编译前自动刷新；生成文件随仓库提交，单测断言其与 `package.json` 同步（版本变更后未重跑 codegen 会红 CI）。
- **构建产物**：`scripts/copy-wasm.mjs` 把 `@jsquash/avif/codec/enc/avif_enc.wasm`（单线程版，D6）拷到 `dist/wasm/avif.wasm`（3.32 MB），挂 engine-image `build`（`tsc && node scripts/copy-wasm.mjs`）；`files` 已含 `dist`，随包发布。
- **预加载接线（5 页）**：`ToolLayout.astro` / `EmbedLayout.astro` 均新增 `wasmPreload?: string[]` 透传；`convert` / `compress` / `quick-convert` / `quick-compress` 工具页与 `embed/.../convert` 嵌入页传入 `resolveAvifWasmUrl()`。构建产物 HTML 已验证注入 `<link rel="preload" as="fetch" crossorigin>` 版本化 URL。
- **sw.js 缺陷修复（验证时发现）**：`fetchFromBackupCdns` 原 `suffix = pathname.slice(idx)` 连同 `@lokvis/` 一起截取，与已含 `@lokvis/` 的 `BACKUP_CDNS` 基址拼出 `.../@lokvis/@lokvis/...` 非法 URL（对任何 scoped 包恒 404，备用 CDN 实际从未生效）。修正为 `slice(idx + '@lokvis/'.length)`，jsdelivr / unpkg 回退 URL 均验证正确。该修复是严格改进（原行为对 scoped 包从不成功）。
- **缓存链路验证**：跨源 `.wasm` 请求被 sw.js `handleWasmAsset` 拦截（cache-first + `Content-Type: application/wasm` 修正 + 主源重试 + 备用 CDN）；worker 内 `fetch(wasmUrl)` 同样命中该链路，预加载与实编码共享缓存。

### 4.4 Capability / Runtime / Workflow 层：零变更

- `image.manifest.json` 不变（avif 本就在 convert/compress 的 format enum 中）。
- `plugin-image/operations.ts` 不变（继续主线程直调 engine 操作；off-main-thread 由编码器私有 worker 在 engine 内部完成，capability 层无感知）。
- `WorkflowExecutor` / `buildSingleStepImageWorkflow` 不变；AbortSignal 链路已贯通（2.2）。

### 4.5 quick-image 层：`formatSupport` 语义升级 + 慢速提示

**formatSupport 升级**（`internal/format-support.ts`）：

```typescript
// avif 的支持判定从「canvas 探测」升级为「canvas 探测 || wasm 兜底可用」
export async function detectEncodeSupport(formats) {
  const native = await probeCanvasEncode(formats);   // 现有逻辑
  return {
    ...native,
    avif: native.avif || wasmEncodersEnabled(),      // wasm 默认启用 → 恒 true
  };
}
```

效果：所有浏览器 `formatSupport.avif === true`，QuickConvert 预设不再禁用，cloud 门控代码（`disabledValues`）自然失效无需改动。

**慢速提示 UX**（中性 UX，进 open）：当 `preset === 'avif'` 且原生不支持（即实际走 wasm）时，Layer 2 默认 UI 在输出区展示提示条。新增 i18n 键（6 语言）：

```typescript
'quickConvert.slowEncoder': 'AVIF encoding runs in software and may take several seconds'
  / 'AVIF 使用软件编码，可能需要数秒'
  / ...（zh 用整句模板，不直译 en 语序）
```

**不做**：不改任何 hook 返回值接口；不加精细进度条（D5）；`busy` 态复用现有。

### 4.6 性能基线（T1 实测，2026-07-24）

实测环境：macOS x64 / Node 26 单线程（浏览器 worker 单线程同构，mt 版未启用）；输入为梯度+噪声合成图。

| 指标 | 实测值 |
|---|---|
| avif_enc.wasm 体积 | 3.3 MB raw / 1.07 MB gzip |
| init + 首次编码（1MP, speed 8） | ~1.0 s（含 wasm 实例化） |
| 1MP 编码（q50）：speed 4 / 6 / 8 | 35.5 s / 2.95 s / 0.60 s |
| 4MP 编码（q50）：speed 4 / 6 / 8 | 130 s / 11.6 s / 2.3 s |
| 1MP 编码（q85 / q95, speed 8） | 1.13 s / 1.18 s |
| 1MP 输出体积（q30 / q50 / q63 / q95, speed 6-8） | 72 KB / 208 KB / 350 KB / 853 KB |
| 1MP 原生编码耗时（Chrome，参考值） | 50–200 ms |
| 二次编码加载成本 | ~0（worker 单例 + sw 缓存） |

**实测导出的两个决策**：

1. **speed 4 无价值**：输出与 speed 6 逐字节相同（208 KB），耗时 12 倍——直接排除，不暴露该档位。
2. **speed 分档策略（D7）**：`quality >= 80 → speed 8`（高档位编码耗时对 quality 不敏感但 speed 敏感，且 `targetSize` 二分搜索会连续编码 6–8 次，必须快档）；`quality < 80 → speed 6`（低档位用户诉求是体积效率，speed 6 比 8 小 ~10%）。

---

## 五、任务总览

| 任务 | 内容 | 估时 | 优先级 | 依赖 | 状态 |
|---|---|---|---|---|---|
| T1 | Codec 选型 spike：预构建 libavif 包评估 + 体积/速度/许可证实测 | 2h | P0 | 无 | ✅ |
| T2 | Engine `encodeAvifWasm` + 私有 worker + `encodeSmart` 分发接线 | 4h | P0 | T1 | ✅ |
| T3 | WASM 分发：`configureWasmEncoders` + npm 包 wasm 资产 + sw/preload 接线 | 2h | P0 | T2 | ✅ |
| T4 | `formatSupport` 升级（native \|\| wasm）+ 慢速提示 UX + i18n 6 语言 | 2h | P1 | T2 | ✅ |
| T5 | 测试补全（unit + 真实浏览器 AVIF round-trip e2e）+ typecheck + 覆盖率 | 3h | P0 | T2–T4 | ✅ |
| T6 | 文档（capabilities.md 引擎矩阵 / architecture worker 章节）+ changeset | 1h | P0 | T5 | ✅ |
| **合计** | | **14h** | | | |

> **排期**：T1→T2→(T3∥T4)→T5→T6。与 [favicon/ICO 方案](./20260724-quick-image-favicon-ico.md) T1-T7 无代码交叉（favicon 走 PNG-in-ICO 容器，不触及 avif 编码路径），可并行。

---

## 六、任务明细

### T1 · Codec 选型 spike（2h P0）

- **范围**：
  1. 评估预构建 libavif+aom WASM 来源：`@jsquash/avif`（Squoosh 提取，Apache-2.0）为首选，备选其他预构建发行物
  2. 实测：wasm 二进制体积（raw/gzip）、1MP/4MP 图编码耗时（speed 4/6/8 档位）、输出质量（SSIM 对比原生）
  3. 验证 libavif 协作式中断可行性（编码循环能否检查外部标志）与粒度
  4. 许可证核对：libavif BSD-2 / aom BSD-2 + AOM 专利授权，确认 `THIRD_PARTY_LICENSES.md` 需补充的条目
- **不做**：不评估自编译 emscripten 构建（D3 已否决）；不实测 WebCodecs（仅监测）
- **输入**：候选 npm 包、测试图集（1MP/4MP 各 3 张代表性照片）
- **输出**：spike 结论追加到本文档 §八 决策日志 D3；校准 §四.6 性能预算表
- **依赖**：无
- **验收**：确定 codec 来源包 + speed 档位 + 体积/耗时实测数据落档；许可证结论明确
- **估时**：2h
- **风险**：预构建包的 wasm 体积超预期（>2 MB）→ 评估 wasm-opt 后处理或降档 speed；若包 API 不支持中断 → 取消降级为 terminate worker（可接受，重建成本一次 fetch）
- **优先级**：P0
- **实测结论（2026-07-24 完成）**：
  - Codec 定案：**`@jsquash/avif@2.1.1`**（Apache-2.0，jSquash 维护，Squoosh 提取）。`avif_enc.wasm` 3.3 MB raw / 1.07 MB gzip（超原估算但可接受，gzip 后约 1 MB）
  - `init({ wasmBinary })` 注入路径实测可行（Node 与浏览器 worker 同构）；包内建 threads() 探测自动选 mt 版，本方案强制单线程版（D6）
  - `module.encode()` 单次同步调用，**无进度/中断钩子** → 取消 = terminate worker（D5 定稿）
  - 速度/体积实测见 §四.6；导出 speed 分档策略（D7）与 speed 4 排除结论
  - 许可证：jSquash/Squoosh 层 Apache-2.0；wasm 内含 libavif（BSD-2-Clause）+ aom（BSD-2-Clause + AOM 专利授权）——T6 落 `THIRD_PARTY_LICENSES.md`

### T2 · Engine wasm-avif 编码器 + encodeSmart 分发（4h P0）

- **范围**：
  1. 新增 `operations/wasm-encode.ts`：`encodeSmart` 分发 + `encodeAvifWasm` + `isNativeEncodeSupported`（模块级缓存探测结果）
  2. 新增 `wasm/avif-worker.ts`：worker 入口（codec 单例加载 / cancel / progress 预留按 D5 定稿）
  3. `operations/encode.ts`（compress/convert/setBackground）与 `tiles.ts` 编码调用点替换为 `encodeSmart`
  4. 单测：分发逻辑（native 支持→canvas 路径 / native 不支持+wasm→worker 路径 / 无兜底格式→throw 语义不变）、worker mock 下的取消语义、RGBA 提取正确性
- **不做**：不改 `canvasEngine.encode`；不改 `BlobOperation` 签名；不接线 progress 到 UI（D5）
- **输入**：T1 选定的 codec 包
- **输出**：`wasm-encode.ts`（新）、`wasm/avif-worker.ts`（新）、`encode.ts` / `tiles.ts`（调用点替换）、`__tests__/wasm-encode.test.ts`（新）
- **依赖**：T1
- **验收**：
  - `pnpm test --filter engine-image` 全过，覆盖率 lines ≥ 60% / branches ≥ 75%
  - 不支持原生 avif 的环境（mock canvas 探测失败）下 compress(format='avif') 产出 `blob.type === 'image/avif'`
  - 支持原生 avif 的环境不加载 wasm（worker 不创建，fetch 不发起）
- **估时**：4h
- **风险**：worker 构建产物与纯 tsc 构建的兼容（`new URL(..., import.meta.url)` 需消费方 bundler 支持——Vite/webpack 5 均原生支持，Astro 消费方即 Vite）→ 若 tsc 输出 worker 文件有困难，worker 入口用独立 tsconfig 编译为单文件
- **优先级**：P0
- **实现结论（2026-07-24 完成）**：
  - 新增 `wasm-config.ts` / `wasm/avif-encoder.ts`（host 桥接）/ `wasm/avif-worker.ts`（worker 入口）/ `operations/wasm-encode.ts`（`encodeSmart` 分发）
  - **集成点扩展为 12 处**（超出原预估）：除 encode.ts（3）/ tiles.ts（2）外，transform.ts（resize/crop/rotate/flip 4 处）、filters.ts（1）、watermark.ts（1）、compress-target.ts（2）均以 `inferFormat` 保留输入格式，avif 输入同样命中原生缺口，统一接入 `encodeSmart`。`ico.ts` 的 PNG 编码有意不接入（png 恒原生支持，且 ICO 容器要求 PNG 字节）
  - worker 协议仅 request/response（D5 定稿，无 progress 预留）；取消 = host 侧 terminate + 重建单例
  - typecheck 0 error（55 tasks）、oxlint 0 warning、engine-image 232 测试全过（含 14 个新增：wasm-encode 9 + wasm-config 5）

### T3 · WASM 分发与预加载接线（2h P0）

- **范围**：
  1. 新增 `wasm-config.ts`：`configureWasmEncoders({ avifUrl?, enabled? })` + 默认 jsdelivr 版本化 URL 解析
  2. 构建：wasm 二进制落 `dist/wasm/`（copy 脚本挂 engine-image build），`package.json` `files` 增加 `dist/wasm`
  3. playground：`PlaygroundLayout.astro` `wasmPreload` 注入 avif.wasm URL（convert/compress 工具页）；验证 sw.js cache-first + `PRELOAD_WASM` 协议命中
  4. 验证备用 CDN 回退路径
- **不做**：不做消费方自托管的自动化脚手架（文档说明即可）
- **输入**：T2 的 `resolveAvifWasmUrl` 消费点
- **输出**：`wasm-config.ts`（新）、engine-image `package.json`（files + build script）、playground 预加载接线
- **依赖**：T2
- **验收**：playground dev/build 下 convert 页触发 wasm 预加载（Network 面板可见、sw 缓存命中）；二次访问零网络加载
- **估时**：2h
- **风险**：jsdelivr 对 `.wasm` 的 MIME 处理 → sw.js 已有 `Content-Type: application/wasm` 修正逻辑，复用
- **优先级**：P0
- **实现结论（已完成）**：
  - `wasm-config.ts` 默认 URL 版本锁定，版本来自 codegen 生成常量 `src/wasm/wasm-asset-version.generated.ts`（`scripts/gen-version.mjs` 串入根 `pnpm codegen`，单测守护与 `package.json` 同步）。
  - `scripts/copy-wasm.mjs` 拷贝单线程 `avif_enc.wasm` → `dist/wasm/avif.wasm`（3.32 MB），挂 engine-image `build`，随包发布。
  - 预加载接线 5 页：`ToolLayout` / `EmbedLayout` 新增 `wasmPreload` 透传；`convert` / `compress` / `quick-convert` / `quick-compress` + `embed/convert` 注入版本化 URL，构建产物 HTML 已验证 `<link rel="preload">`。
  - 修复 sw.js `fetchFromBackupCdns` 对 scoped 包前缀重复拼接缺陷（原备用 CDN 对 `@lokvis/*` 恒 404），jsdelivr / unpkg 回退验证正确。
  - 验证：engine-image 13 文件 234 测试全过；typecheck 55/55；oxlint 0 警告；playground 494 页构建成功。

### T4 · formatSupport 升级 + 慢速提示 UX（2h P1）

- **范围**：
  1. `internal/format-support.ts`：avif 判定升级为 `native || wasmEncodersEnabled()`
  2. Layer 2（`ImageQuickConvert`）：avif 走 wasm 时展示慢速提示条；新增 i18n 键 6 语言（zh 整句模板）
  3. 单测：wasm 启用时 avif 预设不再禁用；提示条在 native 支持时不渲染
- **不做**：不改 hook 接口；不加进度条
- **输入**：T2 的 `wasmEncodersEnabled()` 查询点
- **输出**：`format-support.ts`（改）、`ImageQuickConvert.tsx`（提示条）、i18n 6 语言键、测试
- **依赖**：T2
- **验收**：`pnpm test --filter quick-image` 全过；Firefox 实机 convert avif 预设可选且产出真 AVIF
- **估时**：2h
- **风险**：`wasmEncodersEnabled()` 跨包引用方向（quick-image → engine-image 配置）→ quick-image 已依赖 engine-image，方向合规
- **优先级**：P1（不阻塞 T5 主流程验证）
- **实现结论（已完成）**：
  - avif wasm 升级放在 `useQuickConvert.ts`（hook 层）而非 `format-support.ts`，保持 `detectEncodeSupport` 为纯原生探测函数，职责单一。
  - 新增 `@lokvis/engine-image` 依赖至 quick-image `package.json`（原文档假设已存在，实为新增；依赖方向 UI→Engine 合规，无循环）。
  - 暴露两个互补信号：`formatSupport`（有效支持，avif = native || wasm，用于预设门控）+ 新增 `slowEncode` map（标记 wasm 路径格式，用于提示条）。
  - Layer 2 新增 `ConvertSlowHint` 组件（读 context `slowEncode[preset]`，`role="status"`），在 `PresetSwitcher` 后渲染；native 支持时不渲染。
  - i18n 新增 `quickConvert.slowEncoder` 键，6 语言；zh 用整句模板：「当前浏览器不原生支持 AVIF 编码，将改用软件编码器，转换可能需要几秒钟。」
  - 验证：quick-image 22 文件 552 测试全过；typecheck 0 error；oxlint 0 警告。

### T5 · 测试补全 + 质量门禁（3h P0）

- **范围**：
  1. engine-image 单测补全（T2 遗留分支）
  2. e2e（playwright，真实浏览器）：convert avif round-trip——上传 PNG → 选 avif → 下载文件 magic bytes 校验（`ftyp avif` box）；compress targetSize+avif 组合
  3. 性能回归：确认 native 支持浏览器无 wasm 加载（worker 未创建）
  4. monorepo typecheck + 全量 test + 覆盖率门槛
- **不做**：不做跨浏览器矩阵自动化（手动 Firefox 验证一次即可）
- **输入**：T2–T4 产出
- **输出**：e2e 用例、覆盖率报告、门禁通过记录
- **依赖**：T2–T4
- **验收**：2000+ 存量测试全过 + 新增全过；typecheck 0 error；覆盖率达标（lines ≥ 60% / branches ≥ 75%）；e2e 产出文件可被 Chrome `<img>` 解码显示
- **估时**：3h
- **风险**：CI 环境 chromium 是否支持原生 avif 编码（影响 e2e 走 native 还是 wasm 分支）→ 用例断言「产出为 AVIF」而非「走哪条路径」，两分支均通过
- **优先级**：P0
- **实现结论（已完成）**：
  - **单测补全**：新增 `__tests__/avif-encoder.test.ts`（12 用例）覆盖 host 桥接层——worker 单例复用、pending Map 多路复用（乱序响应不串扰）、RGBA buffer transferable 零拷贝、ok=false 拒绝、崩溃重建、`terminateAvifWorker` 幂等。engine-image 升至 14 文件 246 测试。
  - **修复真实缺陷**：原 `onAbort` 先 `pending.delete(id)` 再 `failAllPending`，导致 abort 发起方自身的 promise 永不 settle（悬挂泄漏），仅并发请求被拒。改为直接 `failAllPending`（拒绝全部含发起方），与预取消路径 `throwIfAborted` 抛 AbortError 语义一致；新增用例「编码中途 abort：发起方与并发请求均以 AbortError 拒绝」守护。
  - **e2e（关键修正）**：实测 **Chromium 无原生 AVIF 编码**——`canvas.toBlob('image/avif')` 静默回退 PNG（blob.type='image/png'），故 AVIF 必走 wasm 兜底；且 e2e 浏览器沙箱无外网（连已知 jsdelivr URL 都 `Failed to fetch`），默认版本化 CDN URL（wasm 随 0.5.0 才发布）不可达。解法：`avif.spec.ts` 用 `page.route('**/avif.wasm')` 把编码器（含 dedicated worker）的 wasm fetch 重定向到本地 `engine-image/dist/wasm/avif.wasm`（附 `application/wasm` MIME + CORS），e2e 自包含、可离线、真实走通 worker+wasm 编码全链路。convert PNG→AVIF 与 compress target-size+AVIF 两用例均校验下载文件 `ftyp`+`avif` magic bytes，2 用例通过。
  - **性能回归**：native 支持时「worker 未创建 / 不加载 wasm」由单测覆盖（`wasm-encode.test.ts`「avif 原生支持时不加载 wasm」+ avif-encoder 单例用例）；不做网络层 e2e 断言——页面 head `<link rel="preload">` 会预取 avif.wasm，与「编码时是否创建 worker」是两件事，网络断言会误报。
  - **门禁**：typecheck 55/55 0 error；全量 127 文件 2400 测试全过；覆盖率 lines 90.92% / branches 88.63%（远超 60/75 阈值）。
  - **既有失败（非回归）**：`pdf-tools` / `video-tools` stub e2e（11 用例）在本环境失败——经 `git stash` 回到干净 HEAD 复跑 `pdf-compress` 同样失败，确认为 baseline 既有问题（stub banner 未渲染），与本次 avif/wasm 改动无关。

### T6 · 文档 + changeset（1h P0）

- **范围**：
  1. `docs/capabilities.md`：新增引擎支持矩阵（format × native/wasm 可用性）
  2. `apps/docs` architecture 相关章节：补充 wasm 编码器与私有 worker 说明（含与 dormant WorkerHost 的关系）
  3. changeset：`'@lokvis/engine-image': minor`（新特性，additive）
  4. `THIRD_PARTY_LICENSES.md`：补充 libavif/aom 条目（T1 结论）
- **不做**：不写消费方迁移指南（无 breaking change，无需迁移）
- **输入**：T1–T5 结论
- **输出**：文档更新、changeset 文件
- **依赖**：T5
- **验收**：`pnpm changeset status` 显示 engine-image minor；fixed 组联动版本正确
- **估时**：1h
- **风险**：无
- **优先级**：P0
- **实现结论（已完成）**：
  - `docs/capabilities.md`：Image 章节新增「图像编码引擎支持矩阵」（format × 原生 Canvas / WASM 兜底），标注 Chrome/Firefox 无原生 avif 编码、`encodeSmart` native-first/wasm-fallback 分发与 `configureWasmEncoders` 覆盖入口。
  - `docs/architecture.md`：「三、Worker 隔离」新增「AVIF WASM 编码器私有 Worker」小节——阐明 avif worker 为 `avif-encoder.ts` 模块级单例、与 dormant `WorkerHost` 互不复用、精简 request/response 协议（无 ping/pong/progress）、terminate-and-rebuild 取消语义、崩溃重建、wasm URL 随消息注入。
  - `THIRD_PARTY_LICENSES.md`：Runtime 表新增 `@jsquash/avif`（Apache-2.0）行；License Summary Apache-2.0 计数 5→6 并新增 BSD-2-Clause 行；新增「WASM 内嵌许可证(avif)」小节，落档 libavif（BSD-2-Clause）+ aom（BSD-2-Clause + AOM 专利授权）。
  - changeset：新增 `.changeset/feat-engine-wasm-avif-encoder.md`（`@lokvis/engine-image`: minor + `@lokvis/embed-image`: minor）。
  - **⚠️ 发布车隔离（须遵守 §7.2）**：本 feature changeset **不得**与已排队的 0.4.3 修复车 changeset（`fix-convert-silent-fallback.md`）同次 `changeset version` 消费——否则 fixed 组版本从 patch 跳 minor，破坏 lokvis-cloud 已按 0.4.3 预置的依赖版本。正确顺序：先发布 0.4.3 修复车（仅消费 fix changeset）→ 再单独 `version-packages` 本 feature changeset 发 0.5.0。建议按 §7.3 走 beta 通道验证 wasm 分发。

---

## 七、发布策略与向后兼容

### 7.1 版本

- `@lokvis/engine-image` **minor**（新增 wasm 编码能力，additive，无 breaking change）。fixed 组（~23 包）联动同版本 bump。
- `@lokvis/embed-image`：若 T4 同期合入则 minor（formatSupport 语义变更 + 新 i18n 键），否则不动。

### 7.2 发布车隔离（重要）

**本方案任务不与当前排队的 0.4.3 修复车合并发布。** 当前 `.changeset/` 已排队 convert 静默回退修复（engine patch + quick-image minor → 0.4.3/0.2.0），lokvis-cloud 依赖版本已按 0.4.3 预置。本方案为独立 feature 车：0.4.3 修复车先行发布 → 本方案 changeset 单独 `version-packages` → 发布 0.5.0（或届时基线的下一个 minor）。两车混发会导致 fixed 组版本从 patch 跳 minor，破坏已预置的 cloud 依赖版本。

### 7.3 beta 通道建议

wasm 二进制体积大、分发路径新（CDN + sw），建议走 beta 通道验证：dev 分支 `changeset pre enter beta` → 发布 `0.5.0-beta.0` → playground + cloud staging 实测（弱网、二次缓存、Firefox 实机）→ 稳定后退出 beta 发稳定版。

### 7.4 向后兼容清单

| 面 | 影响 |
|---|---|
| `BlobOperation` 签名 | 不变 |
| `canvasEngine.encode` 行为 | 不变（不支持仍 throw） |
| Capability manifest | 不变 |
| quick-image hooks 接口 | 冻结 |
| 消费方（cloud）代码 | 无需改动（formatSupport.avif 自然变 true，门控逻辑自然失效） |
| bundle 敏感消费方 | `configureWasmEncoders({ enabled: false })` 可整体关闭，回退到 throw 语义 |

---

## 八、决策日志

### D1 · AVIF 单点 vs 全量 Squoosh 套件

- **背景**：canvas 仅缺 AVIF 编码器。修复路径有两种尺度：只补 AVIF（方案 A），或借此机会全量 WASM 化（方案 B，Squoosh 路线）。
- **评审结论**：**采用方案 A**。方案 B 的优势（一致性、质量上限、格式自由）真实但属于「更好」，其必要性触发条件（§三.2.3 a–e）在 Phase 1/2 均未激活；方案 B 的代价（3–5 MB 二进制、原生用户提速变降速、3–4 周工期、维护面×5）与当前阶段错配。
- **被否决的方案**：方案 B（全量套件）——否决理由见 §三.2.2/§三.2.3，**非否定其长期价值**：方案 A 验证的 wasm 管线（加载/缓存/worker/取消/UX）是方案 B 的前置基建，触发条件激活时 codec 逐个追加即可，`ImageEngineAdapter` 注册表 + `lazy.ts` 支持渐进演进。
- **确立方案**：AVIF 单点 native-first / wasm-fallback；全量套件作为长期选项，触发条件存档于 §三.2.3，由产品/商业信号驱动重新评审。

### D2 · WASM 编码的执行位置：编码器私有 worker vs 激活 WorkerHost

- **背景**：wasm 编码秒级 CPU 密集，必须 off-main-thread。repo 已有完整但 dormant 的 WorkerHost 协议（runtime 层，含 BlobRef 传输/cancel/事件通道）。
- **评审结论**：**采用编码器私有 worker**（engine-image 内部单例 worker，仅服务 avif 编码）。
- **被否决的方案**：激活 WorkerHost 全链路——它会让所有 capability 迁移到 worker 执行，是正确的长期方向但影响面远超本方案（需 plugin-image 全部操作迁移 + 集成测试 + 性能回归），应作为独立任务排期。
- **确立方案**：私有 worker 作用域限定在 `encodeAvifWasm`，capability 层无感知；WorkerHost 激活任务单独登记，届时 avif worker 可合并进统一 worker（`avif-worker.ts` 的协议设计向 `worker-protocol.ts` 的 `WorkerRequest/WorkerResponse` 形态靠拢，降低合并成本）。

### D3 · Codec 来源：预构建包 vs 自编译 libavif

- **背景**：WASM AVIF 编码器可来自预构建 npm 包（`@jsquash/avif` 等）或自建 emscripten 构建链。
- **评审结论**：**采用预构建包**（T1 实测确认，首选 `@jsquash/avif`，Apache-2.0）。
- **被否决的方案**：自编译——需要 emscripten 工具链 + aom 构建参数调优 + 持续跟踪上游安全补丁，Phase 2 无此维护预算；预构建包体积/速度不达标时再评估（T1 风险项）。
- **确立方案**：预构建包优先；wasm 二进制随 `@lokvis/engine-image` npm 包分发（`dist/wasm/`），版本与代码锁定。
- **T1 实测闭环（2026-07-24）**：定案 `@jsquash/avif@2.1.1`（Apache-2.0）。`avif_enc.wasm` 3.3 MB raw / 1.07 MB gzip——raw 超原估算（1.1–1.5 MB），但 gzip 后 ~1 MB 且懒加载 + sw 缓存，可接受，不触发 wasm-opt 后处理风险项。`init({ wasmBinary })` 注入路径实测可行；`module.encode()` 无进度/中断钩子（导出 D5 定稿与取消语义）。

### D4 · 二进制分发：运行时 fetch vs base64 内联

- **背景**：纯 tsc 构建无法打包 `.wasm` 资产。
- **评审结论**：**运行时 `fetch(url)`**。base64 内联会使 engine-image JS 膨胀 ~2 MB 且破坏 sw 缓存语义。
- **确立方案**：默认 jsdelivr 版本化 URL（随包发布，版本锁定）+ `configureWasmEncoders({ avifUrl })` 消费方覆盖 + sw cache-first + playground preload 接线。该路径与 W21.2 预加载基建的设计意图完全吻合。

### D5 · 进度上报：本期不做，UX 三件套缓解

- **背景**：wasm 编码 2–10s，用户需要反馈。但 `ExecutionContext.onProgress` 从未被 executor 填充，`BlobOperation` 签名无进度通道，扩展签名违反 `Blob ↔ Blob` 纯函数约定。
- **评审结论**：**本期不实现精细进度**。缓解 = ① 不确定态提示（「AVIF 使用软件编码，可能需要数秒」）② AbortSignal 取消（已贯通）③ 预加载消除加载等待。
- **被否决的方案**：扩展 `BlobOperation` 签名加 `onProgress` 参数——破坏全仓库 engine 操作约定，且进度从 engine 穿透到 UI 需要 executor/capability/hook 全链路改造，是独立基建任务。
- **确立方案**：**不预留 progress 接口**（T1 实测闭环：`@jsquash/avif` 的编码是单次同步 wasm 调用，包层面无进度钩子，预留无实现基础）。worker 协议仅含 request/response；取消 = host 侧 terminate worker 并重建单例（重建成本 = 一次 wasm fetch，sw 缓存命中后 <100 ms）。精细进度待 WorkerHost 激活任务统一设计。

### D6 · 线程模型：单线程优先

- **背景**：libavif wasm 可单线程或 pthread 多线程（后者需 SharedArrayBuffer，COOP/COEP 已部署）。
- **评审结论**：**单线程起步**。多线程编码提速 2–4 倍但引入 worker 池管理 + COOP/COEP 对 embed 消费方的约束（第三方站点可能未部署 COOP/COEP，`embed-sdk` 场景会直接失败）。
- **确立方案**：单线程为默认；多线程作为后续优化项，以「独立 worker 池 + 能力探测降级」形式实现，不阻塞本方案。
- **T1 补充（2026-07-24）**：`@jsquash/avif` 的 `init()` 在浏览器侧会自动探测 `threads()`（SharedArrayBuffer 可用时）并加载 mt 版 wasm（`avif_enc_mt.wasm`）。本方案 **显式强制单线程版**——直接绑定 `codec/enc/avif_enc.js`，绕过自动选择：emscripten pthread 会在我们的私有 module worker 内再嵌套创建子 worker，URL 解析（`emscriptenModuleUrl`）在消费方 bundler 下不可控， predictability 优先于 2–4 倍提速。

### D7 · 编码 speed 分档策略（T1 实测导出）

- **背景**：libavif 的 `speed` 参数（0–10）控制编码速度/压缩率权衡，需要定默认策略。
- **实测依据**：q50 下 speed 4 与 speed 6 输出逐字节相同（208 KB）但耗时 35.5 s vs 2.95 s（12 倍）；speed 8 比 6 快 5 倍但体积大 ~10%；q85/q95 下 speed 8 仅 1.1–1.2 s/1MP（speed 6 需 5.6 s）。
- **评审结论**：**`quality >= 80 → speed 8`，`quality < 80 → speed 6`**；speed 4 及更低档位直接排除（无压缩率收益）。
- **理由**：高档位（convert 默认 q95、compress 默认 q85）编码耗时对 quality 不敏感而对 speed 敏感，且 `compressToTargetSize` 二分搜索会连续编码 6–8 次，必须快档（否则 1MP 图 targetSize 流程 >30 s）；低档位用户的核心诉求是体积效率，speed 6 的 ~10% 体积优势值得 5 倍时间。
- **确立方案**：分档逻辑内置于 `avif-worker.ts`，不暴露 speed 参数给上层（engine 操作参数保持 `Record<string, any>` 约定，quality 透传）。

---

## 九、文档导航

| 相关文档 | 关系 |
|---|---|
| [20260723-quick-image-functional-completeness.md](./20260723-quick-image-functional-completeness.md) | 边界原则（中性第三方测试）的来源文档 |
| [20260724-quick-image-favicon-ico.md](./20260724-quick-image-favicon-ico.md) | 同期并行任务（无代码交叉） |
| [architecture.md](../architecture.md) | 五层架构与 Worker 隔离设计（本方案 §四 的上位约束） |
| [capabilities.md](../capabilities.md) | T6 将补充引擎支持矩阵 |
| [technical-debt.md](../technical-debt.md) | WorkerHost dormant / onProgress 未填充——本方案引用但不偿还的两个既有债务 |
| `.changeset/fix-convert-silent-fallback.md` | 本方案的起因修复（canvas 静默回退 → throw + 门控） |
| [business/04-技术架构设计.md](../business/04-技术架构设计.md) §6 | 「Squoosh WASM 为主」的原始架构愿景——§三 对其做了阶段性校准 |
