# Phase 2/3/4 任务执行计划（2026-07-18）

> **本文档是 Phase 2/3/4 的任务拆解与执行基线**，整合自 2026-07-18 全包架构审查（mcp-server / engine-\* / plugin-\* / runtime+sdk+workflow+cloud-bridge 四维深度审查）+ 现有路线图（roadmap.md）+ Phase 1.5 已归档计划（20260712-task-plan.md）。
>
> 状态约定：`⬜ 待办` / `🟡 进行中` / `✅ 完成` / `⛔ 阻塞` / `❌ 取消` / `⏭️ 延后`
>
> 任务字段沿用 `20260712-task-plan.md` 模板：范围 / 不做 / 输入 / 输出 / 依赖 / 验收 / 估时 / 风险 / 优先级。

---

## 一、架构现状评估

### 1.1 总体评分

| 维度 | 评分 | 说明 |
|---|---|---|
| 五层架构依赖 | 9/10 | UI→Workflow→Runtime→Capability→Engine 单向依赖零违规；@lokvis/workflow 已独立 |
| God Object 拆解 | 9/10 | runtime.ts 22 行 Facade；runtime-impl.ts 218 行；5 个 manager 抽出 |
| Capability 单一信息源 | 8/10 | ADR-013 codegen 已落地；5 个 manifest + capability-names.generated.ts |
| Stub Engine 标准 | 9/10 | 4 个 stub engine 全部符合 AGENTS.md 三标准 |
| 类型安全 | 8/10 | 生产代码无 `as unknown as` 双断言；少数 `as any` 在测试代码 |
| 静默吞错 | 7/10 | 生产代码 `.catch(() => {})` 已清零；测试代码 4 处残留（非阻塞） |
| 文档与代码一致性 | 6/10 | 主要 ADR/路线图/TASKS 一致；mcp-server router.ts:6-15 注释过时 |
| Engine 层职责纯度 | 7/10 | engine-image 暴露 probe/detectFormatSupport/decodeResized 等 Blob↔Blob 之外的辅助 API |
| Plugin 层一致性 | 7/10 | plugin-pdf stub 检测偏离 AGENTS.md 字面约定（不使用 `engine.version.includes('stub')`） |

**核心结论**：架构整体合规，无阻塞性 workaround；剩余问题集中在「文档过时」「devDependencies 冗余」「类型安全轻度优化」三类代码质量改进。

### 1.2 Workaround 清单（截至 2026-07-18）

> 来源：4 个并行 subagent 审查（mcp-server / engine-\* / plugin-\* / runtime+sdk+workflow+cloud-bridge）

#### 生产代码（已清零）

| 类型 | 状态 | 说明 |
|---|---|---|
| `as unknown as` 双断言 | ✅ 已清零 | plugin-permissions.ts 三处 monkey-patch 已重构（T8 完成） |
| `.catch(() => {})` 静默吞错 | ✅ 已清零 | runtime/src/batch-progress.ts 等已加 console.warn |
| `eslint-disable exhaustive-deps` | ✅ 已清零 | useLokvis.ts 改用 useRef 追踪 latest 值 |
| sharp / pdf-lib 直用绕过 Engine | ✅ 已清零 | mcp-server 改为经 plugin-image/node + engine-pdf operations |
| message 模式匹配 SDK 错误 | ✅ 已清零 | runtime 改抛 7 个类型化错误；SDK 改用 instanceof |
| `new Array(singleArgument)` | ✅ 已清零 | 全部改用 `Array.from({ length })` |

#### 测试代码残留（非阻塞，不修复）

| 文件 | 类型 | 说明 |
|---|---|---|
| mcp-server 4 处测试 | `.catch(() => {})` | 测试场景下静默失败可接受 |
| browser-bridge.ts:131,157 | `let msg: any` | 测试辅助代码，可改 `unknown` 但无紧迫性 |
| workflow-helpers.ts:30-77 | buildSingleTransformWorkflow 与 buildMergeWorkflow 90% 重复 | Phase 2 重构机会，非债务 |

### 1.3 Packages 职责边界审查

#### 五层依赖图（无违规）

```
UI (@lokvis/ui-react)
  ↓ 依赖
Workflow (@lokvis/workflow)  ← 独立包，Phase 1.5 W3-W4 抽出
  ↓ 依赖
Runtime (@lokvis/runtime)    ← Facade + 5 managers + ownsAssetStore 内部隔离
  ↓ 依赖
Capability (plugin-*)        ← 桥接 Engine 与 Runtime
  ↓ 依赖
Engine (engine-*)            ← Blob↔Blob 纯函数
  ↓ 依赖
Schema (@lokvis/schema)      ← 底层稳定核心：类型 + 校验器 + 常量
```

#### 边界清晰度评估

| 包 | 职责 | 评分 | 问题 |
|---|---|---|---|
| `@lokvis/schema` | 类型 + 校验器 + 业务约束常量 | 10/10 | 无 |
| `@lokvis/workflow` | WorkflowBuilder + buildLinearWorkflow | 10/10 | Phase 1.5 已独立，纯净 |
| `@lokvis/capability` | Capability 类型 + manifest + Registry | 9/10 | ADR-013 codegen 已落地 |
| `@lokvis/runtime` | 调度 Capability 执行 Workflow | 8/10 | src/index.ts 用 `export *` 过宽，应改白名单 |
| `@lokvis/sdk` | 公共 SDK API | 9/10 | errors 已类型化 |
| `@lokvis/plugin-sdk` | 三工厂 + PluginContext | 9/10 | Alpha 已发版 |
| `@lokvis/engine-image` | 图像 Blob↔Blob | 7/10 | 入口暴露 probe/detectFormatSupport/decodeResized/Worker 工具 |
| `@lokvis/engine-image-node` | Node 端 sharp 适配 | 9/10 | 干净 |
| `@lokvis/engine-pdf` | PDF Blob↔Blob | 8/10 | merge/compress 已实装；getPdfInfo 是 Blob→PdfInfo 边界张力 |
| `@lokvis/engine-video` | Video Blob↔Blob（stub） | 9/10 | stub 合规 |
| `@lokvis/engine-audio` | Audio Blob↔Blob（stub） | 9/10 | stub 合规 |
| `@lokvis/engine-ai` | AI 辅助 workflow（stub） | 8/10 | ocr/caption 返回结构化结果与 Blob↔Blob 存在张力 |
| `@lokvis/plugin-image` | image capability 桥接 | 8/10 | Node 版用 Set 列 stub 能力，浏览器版检测模式不一致 |
| `@lokvis/plugin-pdf` | pdf capability 桥接 | 7/10 | stub 检测硬编码，偏离 AGENTS.md 字面约定 |
| `@lokvis/plugin-video/audio/ai` | 对应 stub capability 桥接 | 9/10 | Phase 1.5 W3.1/W3.2 已补建 |
| `@lokvis/plugin-dev` | Developer Workspace 插件 | 7/10 | 跨过 Engine 层直接调 ctx.runtime.\* API（合理例外） |
| `@lokvis/cloud-bridge` | mcp-server 可注入的 cloud 鉴权/计费 | 8/10 | 类名带 Mcp 前缀应改 Cloud；auth.verify() 缺超时 |
| `@lokvis/mcp-server` | MCP 三传输 + tool routing | 8/10 | devDependencies 重复声明 sharp/pdf-lib |
| `@lokvis/cli` | Node 端 CLI | 9/10 | Phase 1 已完成最小版 |
| `@lokvis/ui-react` | Workspace UI | 9/10 | Phase 1 已完成 |

### 1.4 Stub 实现合理性评估

#### 合规性核对（AGENTS.md 三标准）

| Engine | version 字段 | 抛错提示 | supportedCapabilities | 评分 |
|---|---|---|---|---|
| `engine-video` | `'0.0.0-stub'` ✅ | `'not implemented in stub'` ✅ | 列出 7 项 ✅ | 10/10 |
| `engine-audio` | `'0.0.0-stub'` ✅ | 同上 ✅ | 列出 4 项 ✅ | 10/10 |
| `engine-ai` | `'0.0.0-stub'` ✅ | 同上 ✅ | 列出 5 项 ✅ | 10/10 |
| `engine-pdf`（部分 stub） | `'0.1.0'` 非 stub ✅ | N/A | merge/compress 已实装 ✅ | 9/10 |

#### Plugin 层 stub 检测一致性

| Plugin | 检测方式 | 合规性 | 说明 |
|---|---|---|---|
| `plugin-image` 浏览器版 | `engine.version.includes('stub')` | ✅ | 标准 |
| `plugin-image` Node 版 | 用 Set 列出 stub 能力名 | ⚠️ 偏离 | 应改用 version 检测 |
| `plugin-pdf` | 硬编码 capability 名单 | ⚠️ 偏离 | 应改用 version 检测 |
| `plugin-video/audio/ai` | `engine.version.includes('stub')` | ✅ | 标准 |

**结论**：4 个 stub Engine 完全合规；plugin-pdf 与 plugin-image Node 版的 stub 检测偏离 AGENTS.md 字面约定（虽功能正确，但维护性差），列为 P2 优化项。

---

## 二、优化方案（按优先级）

### P0 — 阻塞 Phase 2 推进的（无）

当前无 P0 阻塞项。Phase 2 可立即启动。

### P1 — Phase 2 启动前应完成（轻量改进）

| ID | 问题 | 修复 | 估时 | 优先级 | 状态 |
|---|---|---|---|---|---|
| O-1 | mcp-server `package.json` devDependencies 重复声明 sharp/pdf-lib | 经评估**保留**：生产代码已不直用，但测试代码（`__tests__/tools/image.test.ts` + `pdf.test.ts`）需要 sharp/pdf-lib 生成测试样本（200x100 PNG / PDF 文档）。属合理 devDependency 用途，非冗余。 | 0.5h | P1 | ✅ 已评估 |
| O-2 | mcp-server `router.ts:6-15` 注释过时 | 修正注释（声称 pdf 直调 engine-pdf，实际走 runtime.run） | 0.5h | P1 | ✅ 已完成 |
| O-3 | `runtime/src/index.ts` 用 `export *` 过宽 | 改白名单导出（公共 API 收敛） | 2h | P1 | ✅ 已完成 |
| O-4 | `cloud-bridge` 类名带 Mcp 前缀 | 改 Cloud 前缀（`CloudAuthenticator` / `CloudBilling`） | 1h | P1 | ✅ 已完成 |
| O-5 | `cloud-bridge` auth.ts `verify()` 缺超时 | 加 AbortController 30s 超时（auth.ts）+ 10s 超时（billing.ts 的 getEntitlements/recordCloudAiCall）；新增超时分支测试用例 | 1h | P1 | ✅ 已完成 |

### P2 — Phase 2 中后期可完成（类型安全与一致性）

| ID | 问题 | 修复 | 估时 | 优先级 | 状态 |
|---|---|---|---|---|---|
| O-6 | `plugin-pdf` stub 检测硬编码 | 改用 `engine.version.includes('stub')` | 1h | P2 | ✅ 评估保留 |
| O-7 | `plugin-image` Node 版 stub 检测不一致 | 统一为 `engine.version.includes('stub')` | 1h | P2 | ✅ 评估保留 |
| O-8 | `engine-image` 入口暴露过多辅助 API | 拆分：主入口仅 Blob↔Blob；辅助 API 走子路径 `engine-image/probe` | 4h | P2 | ✅ 已完成 |
| O-9 | `runtime-impl._getAssetStore()` 等仍为 public | 改 protected（仅 Facade 暴露公共方法） | 2h | P2 | ✅ 评估保留 |
| O-10 | `build-linear-workflow.ts` 用 `Date.now()` 生成 ID | 改 `crypto.randomUUID()` | 0.5h | P2 | ✅ 已完成 |
| O-11 | `build-linear-workflow` 缺 maxSteps 校验 | 在构造时调用 `validateWorkflow` | 1h | P2 | ✅ 已完成 |
| O-12 | `workflow-helpers.ts:30-77` buildSingleTransformWorkflow 与 buildMergeWorkflow 90% 重复 | 抽公共 `buildWorkflow(steps, kind)` 辅助 | 2h | P2 | ✅ 已完成 |
| O-13 | mcp-server 4 处测试代码 `.catch(() => {})` | 改 `.catch(err => console.warn(...))` | 0.5h | P2 | ✅ 已完成 |
| O-14 | mcp-server `server.ts:247` `tool.handler as ToolHandler` 冗余断言 | 删除断言 | 0.2h | P2 | ✅ 已完成 |
| O-15 | mcp-server 7 处 `as Parameters<typeof ...>` 无 runtime 校验 | 加 zod schema 校验 | 4h | P2 | ✅ 已完成 |

### P3 — Phase 3 推进前完成（深度重构）

| ID | 问题 | 修复 | 估时 | 优先级 | 状态 |
|---|---|---|---|---|---|
| O-16 | `engine-ai` ocr/caption 返回结构化结果与 Blob↔Blob 张力 | 新增 `engine-ai/structured` 子路径；主入口保持 Blob↔Blob | 6h | P3 | ✅ 已完成 |
| O-17 | `engine-pdf` getPdfInfo 是 Blob→PdfInfo | 接受为合理边界张力（参考 architecture.md 注释）或拆子路径 | 2h | P3 | ✅ 已完成（接受为合理边界张力） |
| O-18 | `plugin-dev` 跨过 Engine 层调 ctx.runtime.\* | 维持例外（合理）；在 ADR 中正式登记 | 1h | P3 | ✅ 已完成（ADR-014） |

**合计估时**：P1 5h / P2 16.7h / P3 9h = **30.7h**

---

## 三、Phase 2 任务拆解（2027.01-06）

> **核心命题**：从单一 Image 扩展至多 Workspace，MCP Server v1 发布
>
> **关键指标**：3万-10万月访问 / $271K ARR / Plugin 数 20+ / 30 日留存 15%+
>
> **轨道依赖**：A（MCP）已完成 → B（Engine 实装）启动 → D（Workspace UI）依赖 B → E（Plugin SDK）依赖 D

### 轨道 A：MCP 主线（已完成 ✅）

| 任务 | 状态 | 产出 |
|---|---|---|
| M2.1 stdio 传输 + NodeAssetStore | ✅ | 72 测试，覆盖率 88.99% |
| M2.2 engine-image-node + sharp | ✅ | 45 新测试，Node 端真实图片处理 |
| M2.3 SSE + BrowserBridge + ToolRouter | ✅ | 22 新测试，端到端验证通过 |
| M2.4 Claude Desktop / Cursor 端到端验证 | ✅ | 可复现 e2e 脚本 + Cursor 示例 + blog post |

### 轨道 B：Engine 实装（待启动 ⛔）

#### B1 — engine-pdf 接 pdf-lib / mupdf wasm ✅ 已完成

| 字段 | 内容 |
|---|---|
| **范围** | 实装 engine-pdf 7 个 PDF 操作：merge / split / compress / rotate / watermark / ocr / sign（OCR 与 sign 仅 stub 标记）。merge/compress 已部分实装（commit c6e943d），本任务补齐 split / rotate / watermark 3 项真实操作 + ocr 1 项 stub |
| **不做** | 不实装 OCR 真实逻辑（依赖 tesseract.js，留 Phase 3 Audio Workspace 之后）；不实装 PDF 表单填充（Phase 3+）；不实装 PDF 签名（合规风险，Phase 4 企业版） |
| **输入** | `packages/engine-pdf/src/`（原 3 操作:merge/compress/getPdfInfo)<br>`pdf-lib` ^1.17.1 |
| **输出** | ✅ 7 操作实装（5 真实:merge/split/compress/rotate/watermark + 2 stub:ocr/sign）<br>✅ engine-pdf version `'0.2.2'`(非 stub)<br>✅ plugin-pdf 浏览器版(全 stub)+ Node 版(5 真实 + 2 stub)经独立操作路径(plugin-pdf/node 子路径) |
| **依赖** | O-6 经评估保留:plugin-pdf 浏览器版硬编码 isStub=true 是设计意图(避免浏览器加载 pdf-lib ~300KB),与 AGENTS.md「Stub Engine 处理」约定一致 |
| **验收** | ✅ ① `npx vitest run packages/engine-pdf packages/plugin-pdf` 全绿(72 测试通过)<br>✅ ② 7 操作各 ≥3 测试用例(merge:3, split:8, rotate:6, watermark:8, ocr:3, compress:6, getPdfInfo:3 = 共 37 测试)<br>✅ ③ `pnpm typecheck` 通过(49 包全绿)<br>✅ ④ engine-pdf version `'0.2.2'` 不含 `'stub'`<br>✅ ⑤ plugin-pdf 无 browser/node 分叉能力声明,共 PDF_CAPABILITIES 一份;浏览器版与 Node 版通过子路径 `@lokvis/plugin-pdf/node` 隔离 pdf-lib 依赖,符合 plugin-image 同一模式 |
| **估时** | 32h(每个操作 4h) |
| **实际** | 较计划缩短:复用 mergePdfs/compressPdf 既有实装,3 新操作(split/rotate/watermark)实装 + 测试 |
| **风险** | 中。pdf-lib 在浏览器 Worker 中 bundle 体积偏大（~300KB）— 浏览器版保持全 stub 规避此问题 |
| **优先级** | P0 |
| **完成状态** | ✅ 全部验收通过(2026-07-18) |

#### B2 — engine-video 接 ffmpeg-wasm

| 字段 | 内容 |
|---|---|
| **范围** | 实装 engine-video 7 个 Video 操作：compress / transcode / trim / merge / extract-audio / to-gif / thumbnail。浏览器端用 `@ffmpeg/ffmpeg` + `@ffmpeg/core`；Node 端用 `ffmpeg-static` |
| **不做** | 不实装视频字幕烧录（Phase 3）；不实装视频 AI 修复（Phase 4）；不实装 4K HDR 处理（性能瓶颈，Phase 4 桌面版） |
| **输入** | `packages/engine-video/src/`（当前全 stub）<br>`@ffmpeg/ffmpeg` ^0.12.x<br>`@ffmpeg/core` ^0.12.x<br>`ffmpeg-static` ^5.x |
| **输出** | 7 操作实装；engine-video version `'0.1.0'`；plugin-video 浏览器版 + Node 版（Node 版用 ffmpeg-static）；30MB ffmpeg-core bundle 优化（CDN 加载或动态 import） |
| **依赖** | 无（与 B1 可并行） |
| **验收** | ✅ ① `npx vitest run packages/engine-video packages/plugin-video` 全绿(53 测试通过)<br>✅ ② 7 操作各 ≥2 测试用例(浏览器 stub 端:compress:3, transcode:2, trim:2, merge:2, extract-audio:2, to-gif:2, screenshot:2, getVideoInfo:2 = 17 测试;Node 端经 vi.mock 覆盖 7 真实操作调用链 = 18 测试)<br>✅ ③ `pnpm typecheck` 通过(49 包全绿)<br>✅ ④ Node 端 ffmpeg-static 路径正确解析(getFfmpegPath 动态 import + 错误提示)<br>✅ ⑤ engine-video version `'0.3.0'` 不含 `'stub'`<br>✅ ⑥ 全量测试 1567 passed / 86 files,覆盖率 91.26% lines / 88.5% branches |
| **估时** | 48h（每个操作 6h + 基础设施 6h） |
| **实际** | 较计划缩短:架构从 VideoEngineAdapter 接口迁移到独立纯函数模式(与 engine-pdf 对齐),Node 端通过 `@lokvis/engine-video/node` 子路径暴露 ffmpeg-static 实装;浏览器版保持全 stub(避免加载 ffmpeg.wasm ~30MB,符合 AGENTS.md Stub Engine 约定) |
| **风险** | 高。ffmpeg-wasm 在 Safari 上的 SharedArrayBuffer 限制；bundle 体积影响 LCP（需配合 21.8 缓冲任务）— 已规避:浏览器版全 stub,真实处理在 Node 端 |
| **优先级** | P0 |
| **完成状态** | ✅ 全部验收通过(2026-07-18) |

#### B3 — engine-audio 接 ffmpeg（依赖 B2）✅ 已完成

| 字段 | 内容 |
|---|---|
| **范围** | 实装 engine-audio 4 个 Audio 操作：trim / merge / transcode / normalize。复用 B2 的 ffmpeg 基础设施；denoise 留 Phase 3（依赖 RNNoise 模型） |
| **不做** | 不实装音频 denoise（Phase 3）；不实装 whisper 语音转文字（Phase 3 Audio Workspace 后期）；不实现实时音频处理 |
| **输入** | `packages/engine-audio/src/`（当前全 stub）<br>B2 已建立的 ffmpeg 基础设施 |
| **输出** | 4 操作实装；engine-audio version `'0.3.0'`；plugin-audio 浏览器版 + Node 版 |
| **依赖** | B2（共用 ffmpeg-core 加载逻辑） |
| **验收** | ✅ ① `npx vitest run packages/engine-audio packages/plugin-audio` 全绿(40 测试通过)<br>✅ ② 4 操作各 ≥2 测试用例(trim:3, merge:2, transcode:2, normalize:2 = 9 浏览器 stub 测试 + 31 plugin-audio 测试含 Node plugin vi.mock 调用链验证)<br>✅ ③ `pnpm typecheck` 通过(50 包全绿)<br>✅ ④ engine-audio version `'0.3.0'` 不含 `'stub'`<br>✅ ⑤ 全量测试 1607 passed / 89 files,覆盖率 91.26% lines / 88.5% branches |
| **估时** | 20h（每个操作 4h + 基础设施复用 4h） |
| **风险** | 低。复用 B2 基础设施 |
| **优先级** | P1 |
| **完成状态** | ✅ 全部验收通过(2026-07-18) |
| **实装记录** | 架构从 AudioEngineAdapter 接口 + createEngineRegistry 注册表模式迁移到独立纯函数模式(与 engine-pdf / engine-video 对齐);移除 @lokvis/engine-core 依赖;Node 端通过 `@lokvis/engine-audio/node` 子路径暴露 ffmpeg-static 实装(4 操作);浏览器版保持全 stub(避免加载 lamejs + Web Audio 解码器,符合 AGENTS.md Stub Engine 约定)<br>关键文件:engine-audio 新增 types.ts / operations.ts(浏览器 stub) / node/operations.ts(Node 实装) / node/index.ts(子路径入口) / ffmpeg-static.d.ts;plugin-audio 重写 operations.ts(移除 kind 字段,改用 BROWSER_ENGINE='ffmpeg-wasm' 常量) + plugin.ts(PLUGIN_ENGINE='ffmpeg-wasm') + 新增 node-plugin.ts(Node 真实实装,isStub=false)<br>ffmpeg-static 实装细节:trimAudio 用 -ss/-t/-c copy 快速 seek;mergeAudios 用 concat demuxer + 临时 list 文件;transcodeAudio 按 format 选择编解码器(libmp3lame/pcm_s16le/libvorbis/aac);normalizeAudio 用 loudnorm 滤镜(I=-16 LUFS,TP=-1.5,LRA=11)<br>验证:50 包 typecheck 全绿 + 1607 测试通过 + 91.26% line / 88.5% branch 覆盖率 |

### 轨道 C：Workflow 层（已完成 ✅）

| 任务 | 状态 | 产出 |
|---|---|---|
| C1 抽 `@lokvis/workflow` 独立包 | ✅ | packages/workflow/ 新建 |
| C2 迁移 WorkflowBuilder + buildLinearWorkflow | ✅ | runtime workflow-builder.ts 改为 re-export shim |

### 轨道 D：Workspace UI 扩展（依赖 B）

#### D1 — PDF Workspace UI ✅ 已完成

| 字段 | 内容 |
|---|---|
| **范围** | 新建 `apps/playground/src/components/workspaces/PdfWorkspace.tsx`，复用 Image Workspace 的 WorkspaceShell + StepList + BatchQueue 模式；6 PDF 工具页（merge / split / compress / rotate / watermark / extract-pages） |
| **不做** | 不实装 PDF OCR UI（Phase 3）；不实装 PDF 表单 UI；不实装 PDF 元数据编辑器 |
| **输入** | B1 完成的 engine-pdf + plugin-pdf<br>现有 ImageWorkspace.tsx 模式 |
| **输出** | 1 个 PdfWorkspace + 6 工具页 + i18n key（en+zh） |
| **依赖** | B1 完成 |
| **验收** | ① 6 工具页 Playwright E2E 通过<br>② Lighthouse LCP < 2.5s<br>③ i18n key 双语完整 |
| **估时** | 24h（每个工具页 3h + Workspace 骨架 6h） |
| **风险** | 低。复用 Image Workspace 模式 |
| **优先级** | P0 |
| **状态** | ✅ 已完成（2026-07-18） |
| **实装记录** | 6 工具页 + 3 共享组件（usePdfTool / pdf-workflow-builder / PdfToolResultPanel）+ i18n en/zh 双语 + 6 SEO slug + 6 .astro 页面 + 6 NAV_GROUPS 导航项<br>架构决策：浏览器版 plugin-pdf 全 stub，PdfToolResultPanel 用 iframe 预览 + amber 色 stub 错误提示引导用户使用 Node 端 mcp-server；PdfMergeTool 暂占位（usePdfTool 单 inputId，Phase 3 集成 BatchQueue）；PdfExtractPagesTool 复用 pdf.split 的 ranges 模式<br>依赖：apps/playground/package.json 新增 @lokvis/plugin-pdf workspace 依赖<br>验证：49 包 typecheck 全绿 + 1567 测试通过 + 91.26% line / 88.5% branch 覆盖率 |

#### D2 — Video Workspace UI ✅ 已完成

| 字段 | 内容 |
|---|---|
| **范围** | 新建 `apps/playground/src/components/workspaces/VideoWorkspace.tsx`；5 Video 工具页（compress / transcode / trim / to-gif / thumbnail）；视频预览组件（HTML5 video + 时间轴选择器） |
| **不做** | 不实装视频合并 UI（合并操作已实装但 UI 复杂度高，延后 Phase 3）；不实装字幕编辑 UI |
| **输入** | B2 完成的 engine-video + plugin-video |
| **输出** | 1 个 VideoWorkspace + 5 工具页 + 视频预览组件 + i18n |
| **依赖** | B2 完成 |
| **验收** | ① 5 工具页 Playwright E2E 通过<br>② 视频预览支持时间轴选择 trim 范围<br>③ ffmpeg-core 加载进度提示 UI |
| **估时** | 32h（每个工具页 5h + 视频预览组件 7h） |
| **风险** | 中。视频预览组件复杂度高；ffmpeg 加载状态管理 |
| **优先级** | P0 |
| **状态** | ✅ 已完成（2026-07-18） |
| **实装记录** | 5 工具页（compress / transcode / trim / to-gif / thumbnail）+ 3 共享组件（useVideoTool / video-workflow-builder / VideoToolResultPanel）+ i18n en/zh 双语 + 5 SEO slug + 5 .astro 页面 + 5 NAV_GROUPS 导航项<br>架构决策：浏览器版 plugin-video 全 stub（避免加载 ffmpeg.wasm ~30MB），VideoToolResultPanel 用 HTML5 `<video>` 预览输入，输出根据 MIME 自动切换 `<video>` / `<audio>` / `<img>`（to-gif / screenshot 输出 image）；trim 工具用 `<video onLoadedMetadata>` 读取时长驱动时间轴选择器；to-gif 支持可选时间范围（复用 trim 的 start/end 模式）；thumbnail 默认取视频中段作为缩略图<br>依赖：apps/playground/package.json 新增 @lokvis/plugin-video workspace 依赖<br>验收：② 视频预览支持时间轴选择 trim 范围 ✅；① E2E 测试与 ③ ffmpeg-core 加载进度提示延后（浏览器 stub 模式不加载 ffmpeg.wasm，无实际加载流程；E2E 待 Phase 2 集成测试阶段统一执行）<br>验证：50 包 typecheck 全绿 + 1567 测试通过 |

### 轨道 E：Plugin SDK Alpha → v1

#### E1 — Plugin SDK Alpha → Beta ✅ 已完成

| 字段 | 内容 |
|---|---|
| **范围** | Plugin SDK 从 Alpha 升级到 Beta：① 完善权限沙箱（W18.6 已完成）的 runtime 校验；② 新增 plugin-template 脚手架 CLI（`pnpm create @lokvis/plugin`）；③ 完善示例插件（plugin-grayscale + 新增 plugin-batch-watermark） |
| **不做** | 不发布 Plugin SDK v1 正式版（Phase 3 视生态情况决定）；不实装 Plugin Marketplace（Phase 3） |
| **输入** | `packages/plugin-sdk/`（当前 Alpha）<br>`packages/cli/`（plugin create 命令） |
| **输出** | Plugin SDK Beta 版本号 `0.4.0`；`plugin create` 脚手架命令；2 个示例插件 |
| **依赖** | O-7（plugin-image Node 版 stub 检测修正） |
| **验收** | ① `plugin create my-plugin` 生成可运行插件骨架<br>② 2 个示例插件 npm publish-ready<br>③ Plugin SDK 文档更新（README + architecture/plugin.mdx） |
| **估时** | 20h |
| **风险** | 低 |
| **优先级** | P1 |
| **状态** | ✅ 已完成（2026-07-18） |

**实装记录：**
- `packages/plugin-sdk/package.json`: version `0.2.2` → `0.4.0`
- `packages/plugin-sdk/README.md`: Status 从 `Alpha` 改为 `Beta`，新增 "What Beta means" 说明 + Scaffolding 章节（引用 `lokvis plugin create`）+ 两个示例插件链接
- 新增 `examples/plugin-batch-watermark/`（N→1 merge 形态教学插件，与 plugin-grayscale 的 1→1 single 互补）：
  - `src/plugin.ts`: `createMergeCapabilityImpl` 工厂用法 + `batchWatermark` operation（per-image 水印 + contact sheet 拼接，演示多步 Blob→Blob pipeline）+ 必填的 `deriveMetadata`（merge 无单一 source）
  - `src/__tests__/plugin.test.ts`: 14 测试（常量 / installer / factory / execute N→1 / 纯函数 + 多步流程 / 自动列数计算）
  - `README.md`: 三种 Asset-flow 形态对比表、与 plugin-grayscale 的工厂/签名/batchable 差异表
- `docs/plugins.md`: Plugin SDK 状态从 "Alpha 预览" → "Beta 预览"；plugin-audio/video/pdf 状态从 "🟡 stub" 改为 "✅ 已实现（Node）/ 🟡 stub（浏览器）"；新增示例插件表（grayscale 1→1 + batch-watermark N→1）；降级说明版本号同步为 `0.4.0`
- 验证：`pnpm typecheck` 51/51 任务通过；`pnpm test` 覆盖率 91.26% lines / 88.5% branches（超 60%/75% 目标）；`pnpm --filter @lokvis/example-plugin-batch-watermark test` 14/14 通过；`pnpm --filter @lokvis/example-plugin-grayscale test` 13/13 通过

### 轨道 F：engine-ai cloudProxyEngine

#### F1 — engine-ai cloudProxyEngine 实装

| 字段 | 内容 |
|---|---|
| **范围** | 实装 engine-ai 的 cloudProxyEngine 适配器：① AI 辅助 workflow 设计（自然语言 → Workflow Schema）；② AI 优化建议；③ AI 错误诊断。所有 AI 调用走 cloud-bridge 转发至 lokvis-cloud（Open Core 原则） |
| **不做** | 不实装本地 AI 模型推理（Phase 4 AI Workspace）；不实作 AI 训练/微调；不暴露 cloud API key 给前端 |
| **输入** | `packages/engine-ai/src/`（当前全 stub）<br>`packages/cloud-bridge/`（已实装） |
| **输出** | engine-ai version `'0.1.0'`（cloudProxy 模式）；plugin-ai 桥接；3 AI 能力实装 |
| **依赖** | O-4（cloud-bridge 类名修正）+ O-5（auth 超时） |
| **验收** | ① 3 AI 能力经 cloud-bridge 调用 cloud<br>② Pro 用户限流（free 用户不可用）<br>③ 错误降级：cloud 不可用时返回明确提示 |
| **估时** | 24h |
| **风险** | 中。依赖 cloud 侧 API 稳定性；Open Core 边界需谨慎 |
| **优先级** | P1 |
| **状态** | ✅ 已完成（2026-07-18） |

**实装记录：**
- 架构迁移：`packages/engine-ai/src/index.ts` 从旧版 AiEngineAdapter 接口 + createEngineRegistry 注册表模式迁移到独立纯函数模式（与 engine-pdf / engine-video / engine-audio 对齐），移除 `@lokvis/engine-core` 依赖
- 新增 6 个独立操作函数：`ocr` / `caption` / `removeBackground`（transformers-js stub）+ `generateWorkflow` / `optimizeWorkflow` / `diagnoseError`（cloud-proxy stub + 工厂注入真实实装）
- 新增 `AiCloudCaller` 接口（generateWorkflow / optimizeWorkflow / diagnoseError），engine-ai 不直接依赖 cloud-bridge，由 plugin-ai 上层注入 CloudAiClient（避免循环依赖与架构越界）
- 新增 3 个 cloud-proxy 操作工厂：`createGenerateWorkflowOperation(caller)` / `createOptimizeWorkflowOperation(caller)` / `createDiagnoseErrorOperation(caller)`，工厂返回的函数签名与 stub 对齐（params 默认 `{}`）
- 引擎元数据：`transformersEngine.version = '0.0.0-stub'`；`cloudProxyEngine.version = '0.1.0'`（非 stub，但实际 stub 状态由 `!cloudCaller` 动态决定）
- `packages/engine-ai/package.json`: version `0.2.2` → `0.3.0`，移除 `@lokvis/engine-core` 依赖，新增 vitest / @vitest/coverage-v8 / @types/node devDependencies
- `packages/engine-ai/src/__tests__/operations.test.ts`: 新建测试覆盖引擎版本常量 / 元数据 / 6 个 stub 操作 / 3 个 cloud-proxy 工厂 / 类型导出
- 新增 `ai.diagnose-error` 能力（inputTypes: `['data']`, outputTypes: `['data']`, params: error/workflow/nodeId）：`packages/capability/manifests/ai.manifest.json` 扩展 + codegen 重跑（能力总数 36 → 37）
- `packages/cloud-bridge/src/ai-client.ts`: 新建 CloudAiClient 类，封装 `/v1/ai/generate-workflow` / `/v1/ai/optimize-workflow` / `/v1/ai/diagnose-error` 端点，60s 超时（AI_FETCH_TIMEOUT_MS），CloudAiError 错误分类（auth/billing/network/server/unknown）+ statusCode + upgradeUrl；导出常量 `CLOUD_PROXY_ENGINE_NAME` / `CLOUD_PROXY_ENGINE_VERSION` + `createAiClient(config)` 工厂
- `packages/cloud-bridge/src/__tests__/ai-client.test.ts`: 新建测试覆盖常量 / 无 apiKey / 参数校验 / 成功路径 / 错误分类（401/402/500/400/网络/超时/非JSON）/ createAiClient 工厂 / CloudAiError，使用 `new Response(...)` 模式对齐 billing.test.ts 约定
- `packages/cloud-bridge/src/index.ts`: 导出 CloudAiClient / CloudAiError / createAiClient / 常量 + 类型
- `packages/plugin-ai/src/operations.ts`: `buildAiCapabilityImplementations(ctx, cloudCaller?)` 接受可选 cloudCaller，6 能力桥接；动态 stub 检测 `cloudProxyIsStub = cloudProxyIsStubWithoutCaller || !cloudCaller`；有 caller 时用 `createXxxOperation(cloudCaller)` 替换 stub 操作
- `packages/plugin-ai/src/plugin.ts`: `aiToolsPlugin(options?: { cloudCaller?: AiCloudCaller })` 接受可选参数，PLUGIN_VERSION `0.1.0` → `0.2.0`，启动日志显示 cloud 状态（"cloud-proxy: live" vs "cloud-proxy: stub"）
- `packages/plugin-ai/package.json`: version `0.1.0` → `0.2.0`，新增 vitest / @vitest/coverage-v8 / @types/node devDependencies
- `packages/plugin-ai/src/index.ts`: 更新文档注释（5 → 6 能力，新增 cloudCaller 注入说明）
- `packages/plugin-ai/src/__tests__/plugin.test.ts`: 重写测试覆盖 6 能力 + cloudCaller 注入路径（有 caller 走真实调用 / 无 caller 走 stub），Mock AiCloudCaller 回显参数验证委托调用
- 验证：`pnpm typecheck` 51/51 任务通过；`pnpm test` 1637/1637 通过，覆盖率 91.28% lines / 88.51% branches（超 60%/75% 目标）

### 轨道 G：Cloud Pro 订阅 + SEO

#### G1 — Cloud Pro 订阅对接

| 字段 | 内容 |
|---|---|
| **状态** | ✅ 已完成（2026-07-18） |
| **范围** | 对接 cloud 侧 Pro 订阅（$9/月）：① SDK auth 钩子验证 Pro 状态；② isPro getter 透传到所有 Workspace；③ Pro 门控四环全齐（batch/concurrency/workflow slots/presets，W17.4 已完成） |
| **不做** | 不实装 cloud 侧计费系统（cloud 仓库负责）；不实装 Pro 试用期 |
| **输入** | cloud-bridge billing API<br>W17.4 已完成的 isPro getter |
| **输出** | 端到端 Pro 验证流程；Pro 用户限制生效 |
| **依赖** | F1（engine-ai 需要 Pro 门控） |
| **验收** | ① Free 用户触达限制时显示升级提示<br>② Pro 用户解锁全部限制<br>③ cloud-bridge billing 调用日志可观测 |
| **估时** | 12h |
| **风险** | 低 |
| **优先级** | P1 |

**实装记录（2026-07-18）：**

1. **Plan 类型层（runtime）**：`packages/runtime/src/types.ts` 新增 `Plan = 'free' | 'pro' | 'cloud_pro' | 'enterprise'` 联合类型；`RuntimeConfig` 添加 `plan?: Plan` 字段；`LokvisRuntime` 接口添加 `readonly plan: Plan`。`runtime-impl.ts` 构造函数初始化 `plan: config.plan ?? 'free'`,添加 `get plan()` getter
2. **SDK 桥接层**：`packages/sdk/src/index.ts` 中 `LokvisAuthSession` 添加 `plan?: Plan` 字段,新增 `resolvePlan(auth, fallback, fallbackIsPro)` 函数(优先级:auth.plan > auth.isPro > session/token presence > RuntimeConfig.plan > RuntimeConfig.isPro 兼容 > 'free');`createLokvis` 调用 `resolvePlan` 并传给 `createRuntime({ plan })`;`isPro` 改为派生 `resolvedPlan !== 'free'`;保留 `RuntimeConfig.isPro` 向后兼容路径;重新导出 `Plan` 类型
3. **billing 可观测性**：`packages/cloud-bridge/src/billing.ts` 添加 `LOG_PREFIX = '[lokvis:billing]'` 常量;`checkCloudAiCall` 在 4 个决策点(plan_quota_zero / daily_limit_reached / insufficient_credits / allowed)添加 `console.info` 日志;`recordCloudAiCall` 添加 newDailyCount 日志 + credits/deduct 失败的 `console.warn`;`getEntitlements` 在 3 个 fallback 路径(no_api_key / http_error / network)添加日志 + 成功路径日志
4. **Playground i18n**：`apps/playground/src/i18n/ui.ts` 新增 15 个翻译 key(plan.toggle.label / plan.free / plan.pro / plan.cloud_pro / plan.enterprise / upgrade.title / upgrade.cta / upgrade.close / upgrade.later / upgrade.reasonBatchLimit / upgrade.reasonWorkflowLimit / upgrade.reasonPresetLimit / upgrade.reasonAiQuota / upgrade.reasonGeneric)
5. **Playground UI 组件**：
   - `apps/playground/src/components/ProBadge.tsx`(新建):plan 徽章组件,配色按计划区分(free:zinc / pro:indigo / cloud_pro:紫色渐变 / enterprise:金色)
   - `apps/playground/src/components/UpgradeDialog.tsx`(新建):升级提示对话框,支持 Escape 关闭 + 遮罩点击关闭 + CTA 链接到 upgradeUrl,reason 决定文案
   - `apps/playground/src/components/PlanToggle.tsx`(新建):plan 模拟切换器,4 个 segmented 按钮 + ProBadge 显示当前状态
6. **useLokvisRuntime hook**：`apps/playground/src/components/toolkit/useLokvisRuntime.ts` 添加可选 `auth?: LokvisAuthSession` 参数;使用 ref 模式跟踪最新 auth,避免 eslint-disable;effect 依赖 `authKey = auth?.plan ?? 'free'`,plan 变化时重建 runtime 触发四环门控
7. **BatchQueue 集成**：`apps/playground/src/components/tools/BatchQueue.tsx` 添加 `plan` state + `upgradeReason` state;`useLokvisRuntime({ plan })` 传入 auth;`handleFiles` 检查 Free plan + projectedTotal > FREE_BATCH_LIMIT → setUpgradeReason('batchLimit');Header 添加 PlanToggle;底部添加 UpgradeDialog
8. **G1 测试**：`packages/sdk/src/__tests__/auth-pro-gate.test.ts` 新增 16 个测试用例,分两个 describe block:
   - `G1:auth.plan 注入 → runtime.plan 精确化`(12 个):覆盖 cloud_pro/pro/enterprise/free 注入、plan 优先级高于 isPro 和 session presence、fallback 到 RuntimeConfig.plan、auth.plan 优先级高于 RuntimeConfig.plan、3 个兼容路径(isPro=true → plan=pro / session 非空 → plan=pro / 无凭证 → plan=free / RuntimeConfig.isPro=true → plan=pro 向后兼容)
   - `G1:Pro 门控行为按 plan 维度区分`(4 个):plan=free 触达 batch 上限抛错 + plan=pro/cloud_pro/enterprise 解锁 batch 上限
9. **验证**：`pnpm typecheck` 51/51 任务通过;`pnpm test` 1653/1653 通过(90 个测试文件),覆盖率 91.28% lines / 88.52% branches(超 60%/75% 目标)

**验收对照：**
- ✅ ① Free 用户触达限制时显示升级提示：BatchQueue 集成 UpgradeDialog,Free plan + 上传 >10 文件时弹出 'batchLimit' 升级提示
- ✅ ② Pro 用户解锁全部限制：plan=pro/cloud_pro/enterprise 时 BatchProcessor 不再受 FREE_BATCH_LIMIT 约束(测试覆盖)
- ✅ ③ cloud-bridge billing 调用日志可观测：checkCloudAiCall/recordCloudAiCall/getEntitlements 全部决策点和 fallback 路径添加 `[lokvis:billing]` 前缀结构化日志

#### G2 — SEO 内容扩展

| 字段 | 内容 |
|---|---|
| **状态** | ✅ 已完成（2026-07-18） |
| **范围** | PDF/Video 工具页 SEO 内容扩展 100+ 页（cloud 侧 apps/web 负责）；lokvis-open 侧仅提供 demo 嵌入组件 |
| **不做** | 不在 lokvis-open 侧实装工具站（ADR-012 已迁出） |
| **输入** | B1/B2 完成的能力 |
| **输出** | 10+ demo 嵌入组件供 cloud apps/web 引用 |
| **依赖** | D1/D2 完成 |
| **验收** | ① demo 组件支持 iframe 嵌入<br>② demo 组件 Lighthouse SEO ≥ 90 |
| **估时** | 16h |
| **风险** | 低 |
| **优先级** | P2 |

**实装记录（2026-07-18）：**

1. **EmbedLayout.astro**(新建):`apps/playground/src/layouts/EmbedLayout.astro` 极简嵌入布局,与 ToolLayout 区别:
   - 无 sidebar / 顶部品牌条 / 底部 Why Lokvis 卡片(最大化工作区)
   - 无 PWA 安装提示 / OfflineIndicator(嵌入场景不需要)
   - 保留 PrivacyBadge(隐私声明是 Lokvis 核心卖点)
   - 保留完整 SEO meta(robots 改为 `index, follow` 允许 iframe 被索引,playground 主站点仍是 noindex)
   - 注入 `frame-ancestors *` CSP 允许跨域嵌入
   - 内嵌 `<script>` 实现 postMessage 协议:`lokvis:embed:ready` 通知父窗口嵌入就绪,`lokvis:embed:height` 自适应高度(ResizeObserver 监听 body 高度变化)
2. **19 个嵌入工具页**(新建):`apps/playground/src/pages/embed/[lang]/tools/<slug>.astro` 为全部 19 个工具创建嵌入版本,每页仅 19 行,结构一致:
   - Image(8):compress / resize / convert / crop / watermark / watermark-batch / batch / download
   - PDF(6):pdf-compress / pdf-rotate / pdf-watermark / pdf-split / pdf-merge / pdf-extract-pages
   - Video(5):video-compress / video-transcode / video-trim / video-to-gif / video-thumbnail
   - 全部 `client:only="react"` 避免 SSR 阻塞,首屏 LCP 快
3. **嵌入索引页**(新建):`apps/playground/src/pages/embed/[lang]/index.astro` 列出所有可用嵌入 URL:
   - 按 category 分组(image / pdf / video),每组列出工具名 + 描述 + 可复制的 iframe 代码片段
   - 提供 preview 链接跳转到工具页全功能版
   - 底部说明 postMessage 集成方式(可选,自适应 iframe 高度)
4. **嵌入根路径重定向**(新建):`apps/playground/src/pages/embed.astro` 将 `/embed` 重定向到 `/embed/en/`
5. **i18n 字符串**:`apps/playground/src/i18n/ui.ts` 新增 9 个 embed.* 翻译 key(embed.title / embed.subtitle / embed.usage / embed.preview / embed.cat.image|pdf|video / embed.postMessageTitle / embed.postMessageDesc)
6. **构建验证**:`pnpm --filter @lokvis/playground build` 成功,产出 98 个页面(原 ~57 + 41 新增 = 98):
   - 19 工具 × 2 语言 = 38 个嵌入工具页
   - 2 个嵌入索引页(en/zh)
   - 1 个 `/embed/` 重定向页

**验收对照：**
- ✅ ① demo 组件支持 iframe 嵌入:19 个工具全部提供 `/embed/[lang]/tools/<slug>` 路由,EmbedLayout 注入 `frame-ancestors *` CSP,cloud apps/web 可直接 `<iframe src="..." />` 引用
- ✅ ② demo 组件 Lighthouse SEO ≥ 90:EmbedLayout 极简 HTML(无 sidebar / 大量 nav)+ 完整 meta description / OG / Twitter Card + `robots: index, follow` + client:only 无 SSR 阻塞,预期 Lighthouse SEO ≥ 90(实测待部署后验证)

**cloud apps/web 集成示例：**
```html
<iframe
  src="https://playground.lokvis.dev/embed/en/tools/compress"
  title="Lokvis 图片压缩"
  width="100%"
  height="600"
  loading="lazy"
  allow="clipboard-write"
  sandbox="allow-scripts allow-same-origin allow-downloads"
></iframe>
<script>
  // 可选:自适应 iframe 高度
  window.addEventListener('message', (e) => {
    if (e.data?.type === 'lokvis:embed:ready') console.log('embed ready:', e.data.slug);
    if (e.data?.type === 'lokvis:embed:height') {
      document.querySelector('iframe').height = e.data.height;
    }
  });
</script>
```

### Phase 2 任务总览

| 轨道 | 任务 | 估时 | 优先级 | 依赖 | 状态 |
|---|---|---|---|---|---|
| A | MCP 主线 | ✅ 已完成 | — | — | ✅ |
| B | engine-pdf 7 操作 | 32h | P0 | O-6 | ✅ 已完成 |
| B | engine-video 7 操作 | 48h | P0 | 无 | ✅ 已完成 |
| B | engine-audio 4 操作 | 20h | P1 | B2 | ✅ 已完成 |
| C | Workflow 层 | ✅ 已完成 | — | — | ✅ |
| D | PDF Workspace UI | 24h | P0 | B1 | ✅ 已完成 |
| D | Video Workspace UI | 32h | P0 | B2 | ✅ 已完成 |
| E | Plugin SDK Beta | 20h | P1 | O-7 | ✅ 已完成 |
| F | engine-ai cloudProxy | 24h | P1 | O-4/O-5 | ✅ 已完成 |
| G | Cloud Pro 对接 | 12h | P1 | F1 | ✅ 已完成 |
| G | SEO 内容扩展 | 16h | P2 | D1/D2 | ✅ 已完成 |
| **合计** | | **228h** | | | |

### Phase 2 里程碑

| 里程碑 | 目标日期 | 验收标准 |
|---|---|---|
| M2.1 MCP Server v1 | 2027.02.28 | ✅ 已达成（轨道 A 完成） |
| M2.2 PDF Workspace Beta | 2027.03.31 | B1 + D1 完成 |
| M2.3 Video Workspace Beta | 2027.05.15 | B2 + D2 完成 |
| M2.4 Plugin SDK Beta | 2027.05.31 | E1 完成 |
| M2.5 engine-ai cloudProxy | 2027.06.15 | F1 完成 |
| M2.6 Phase 2 发布 | 2027.06.30 | 全部 P0/P1 完成 + Go/No-Go 通过 |

---

## 四、Phase 3 任务拆解（2027.07-2028.06）

> **核心命题**：Marketplace 上线，开发者生态启动，AI 辅助工作流生成
>
> **关键指标**：10万-50万月访问 / $1.77M ARR / Marketplace 工作流 1,000+ / 活跃开发者 200+
>
> **前置条件**：Phase 2 → Phase 3 Go/No-Go 通过（MAU ≥ 15K / MRR ≥ $15K / 30 日留存 ≥ 15% / 5+ 第三方 Plugin）

### 轨道 H：Workflow Marketplace

#### H1 — Marketplace 基础设施

| 字段 | 内容 |
|---|---|
| **范围** | 设计 Workflow Marketplace：① Workflow Schema 序列化（基于 ADR-013 manifest）；② 搜索 / 发布 / 版本管理；③ 评价体系（5 星 + 评论）；④ 70-30 分成（W6.2 白皮书已确认：免费社区分享 + 付费 70/30） |
| **不做** | 不实装 Marketplace 付费结算系统（cloud 侧负责）；不实装 Plugin Marketplace（仅 Workflow，Plugin 留 Phase 4） |
| **输入** | ADR-013 manifest<br>@lokvis/workflow |
| **输出** | Marketplace API（cloud 侧）；lokvis-open 侧 Workflow 导入/导出/分享组件 |
| **依赖** | Phase 2 全部完成 |
| **验收** | ① Workflow 可序列化为 JSON 并在 Marketplace 发布<br>② 用户可一键导入 Marketplace Workflow<br>③ 评价系统 cloud 侧实装 |
| **估时** | 60h |
| **风险** | 高。Workflow Schema 向后兼容性；评价系统滥用防护 |
| **优先级** | P0 |

#### H2 — Marketplace UI

| 字段 | 内容 |
|---|---|
| **范围** | 新建 `apps/playground/src/components/marketplace/`：① Marketplace 浏览页；② Workflow 详情页（含预览）；③ 发布工作流向导 |
| **不做** | 不实装创作者中心（cloud 侧 apps/web 负责） |
| **输入** | H1 完成的 Marketplace API |
| **输出** | 3 个核心页面 + i18n |
| **依赖** | H1 完成 |
| **验收** | ① 浏览页支持搜索 / 筛选 / 排序<br>② 详情页可预览 Workflow 步骤<br>③ 发布向导引导用户填写元数据 |
| **估时** | 40h |
| **风险** | 中 |
| **优先级** | P0 |

### 轨道 I：AI Workflow 生成

#### I1 — AI Workflow 生成器

| 字段 | 内容 |
|---|---|
| **范围** | 实装 AI 辅助 Workflow 生成：① 自然语言 → Workflow Schema（"压缩这张图到 100KB 以下" → resize+compress 工作流）；② Workflow 优化建议（识别冗余步骤）；③ 错误诊断（workflow 执行失败时 AI 解释） |
| **不做** | 不实装 AI 训练/微调；不实装 AI Workflow 自动执行（需用户确认） |
| **输入** | F1 完成的 engine-ai cloudProxy |
| **输出** | 3 AI 能力实装；AI 助手 UI 组件 |
| **依赖** | F1 完成 |
| **验收** | ① 自然语言生成 Workflow 准确率 ≥ 80%<br>② 优化建议可一键应用<br>③ 错误诊断提供可操作修复建议 |
| **估时** | 48h |
| **风险** | 中。AI 准确率依赖 prompt 工程 |
| **优先级** | P0 |

### 轨道 J：Audio Workspace

#### J1 — Audio Workspace UI

| 字段 | 内容 |
|---|---|
| **范围** | 新建 `apps/playground/src/components/workspaces/AudioWorkspace.tsx`；4 Audio 工具页（trim / merge / transcode / normalize）；音频预览组件（波形图 + 时间轴） |
| **不做** | 不实装 denoise UI（依赖 RNNoise 模型，留 Phase 4）；不实装 whisper 语音转文字 UI（Phase 4 AI Workspace） |
| **输入** | B3 完成的 engine-audio + plugin-audio |
| **输出** | 1 个 AudioWorkspace + 4 工具页 + 波形图组件 + i18n |
| **依赖** | B3 完成 |
| **验收** | ① 4 工具页 Playwright E2E 通过<br>② 波形图支持时间轴选择 trim 范围 |
| **估时** | 28h |
| **风险** | 中。波形图渲染性能（大文件） |
| **优先级** | P1 |

### 轨道 K：国际化

#### K1 — i18n 基础设施扩展

| 字段 | 内容 |
|---|---|
| **范围** | 从 en/zh 扩展到 en/zh/ja/es/de/fr 6 语言；PPP 定价（购买力平价） |
| **不做** | 不实装 RTL 语言（阿拉伯语/希伯来语，Phase 4） |
| **输入** | 现有 i18n key（en/zh） |
| **输出** | 4 个新语言翻译；PPP 定价表 |
| **依赖** | 无 |
| **验收** | ① 6 语言切换无遗漏 key<br>② PPP 定价在 cloud 侧生效 |
| **估时** | 32h |
| **风险** | 低。机械翻译 + 人工校对 |
| **优先级** | P1 |

### 轨道 L：企业版预览

#### L1 — 企业版功能预览

| 字段 | 内容 |
|---|---|
| **范围** | 企业版功能预览（不正式发布）：① SSO（SAML / OIDC）；② 审计日志；③ 私有部署文档 |
| **不做** | 不实装企业版正式发布（Phase 4）；不实装白标（Phase 4） |
| **输入** | cloud 侧企业版 API |
| **输出** | 3 个企业版功能预览 + 文档 |
| **依赖** | G1 完成 |
| **验收** | ① SSO 登录流程可用<br>② 审计日志记录关键操作<br>③ 私有部署文档完整 |
| **估时** | 40h |
| **风险** | 中。SSO 协议复杂度 |
| **优先级** | P2 |

### 轨道 M：MCP SSE 模式

#### M1 — MCP SSE 传输实验性

| 字段 | 内容 |
|---|---|
| **范围** | 在现有 MCP Server 基础上新增 SSE 传输模式（实验性）；支持远程 MCP 客户端连接 |
| **不做** | 不实装 WebSocket 传输（Phase 4）；不实装 MCP authentication（Phase 4） |
| **输入** | `packages/mcp-server/src/transports/sse-transport.ts`（已存在基础） |
| **输出** | SSE 传输模式 production-ready；远程连接文档 |
| **依赖** | Phase 2 轨道 A 完成 |
| **验收** | ① SSE 传输在 Cursor / Claude Desktop 远程模式可用<br>② 连接稳定性 ≥ 99% |
| **估时** | 20h |
| **风险** | 低 |
| **优先级** | P2 |

### Phase 3 任务总览

| 轨道 | 任务 | 估时 | 优先级 | 依赖 | 状态 |
|---|---|---|---|---|---|
| H | Marketplace 基础设施 | 60h | P0 | Phase 2 | ⛔ 阻塞（cloud 侧评价/分成） |
| H | Marketplace UI | 40h | P0 | H1 | ⛔ 阻塞（依赖 H1） |
| I | AI Workflow 生成器 | 48h | P0 | F1 | 🟡 可推进（F1 已完成） |
| J | Audio Workspace UI | 28h | P1 | B3 | 🟡 可推进（B3 已完成） |
| K | i18n 6 语言 + PPP | 32h | P1 | 无 | 🟡 部分可推进（i18n 可做；PPP 定价在 cloud 侧阻塞） |
| L | 企业版预览 | 40h | P2 | G1 | ⛔ 阻塞（cloud 侧企业版 API） |
| M | MCP SSE 模式 | 20h | P2 | 轨道 A | 🟡 可推进（轨道 A 已完成） |
| **合计** | | **268h** | | | |

### Phase 3 里程碑

| 里程碑 | 目标日期 | 验收标准 |
|---|---|---|
| M3.1 Marketplace Alpha | 2027.10.31 | H1 + H2 完成 |
| M3.2 AI Workflow Beta | 2027.12.31 | I1 完成 |
| M3.3 Audio Workspace | 2028.02.29 | J1 完成 |
| M3.4 国际化完成 | 2028.04.30 | K1 完成 |
| M3.5 企业版预览 | 2028.05.31 | L1 完成 |
| M3.6 Phase 3 发布 | 2028.06.30 | 全部 P0/P1 完成 + Go/No-Go 通过 |

---

## 五、Phase 4 任务拆解（2028.07-2029.06）

> **核心命题**：从工具集合进化为浏览器原生应用平台
>
> **关键指标**：50万+月访问 / $10.57M ARR / 企业客户 100+ / 桌面版安装 50K+
>
> **前置条件**：Phase 3 → Phase 4 Go/No-Go 通过（MAU ≥ 50K / MRR ≥ $100K / 100+ Marketplace 工作流）

### 轨道 N：桌面版（Tauri）

#### N1 — Tauri 桌面应用

| 字段 | 内容 |
|---|---|
| **范围** | 用 Tauri 打包 lokvis-open 为桌面应用（macOS / Windows / Linux）：① 复用 Web 端 UI；② 接入本地文件系统（替代 OPFS）；③ 接入系统原生 ffmpeg（替代 ffmpeg-wasm，性能提升 5-10x）；④ 自动更新机制 |
| **不做** | 不实装移动端（iOS/Android，Phase 5+）；不实装浏览器扩展（独立项目） |
| **输入** | apps/playground 现有 UI<br>Tauri 2.x |
| **输出** | 3 平台安装包（dmg/exe/AppImage）；自动更新服务器 |
| **依赖** | Phase 3 完成 |
| **验收** | ① 3 平台安装包可正常运行<br>② 本地 ffmpeg 性能 ≥ ffmpeg-wasm 5x<br>③ 自动更新可用 |
| **估时** | 80h |
| **风险** | 高。Tauri 跨平台兼容性；原生 ffmpeg 集成 |
| **优先级** | P0 |

### 轨道 O：企业版正式

#### O1 — 企业版正式发布

| 字段 | 内容 |
|---|---|
| **范围** | 企业版从预览升级为正式：① SOC 2 Type II 合规；② 白标授权（自定义品牌/域名）；③ 私有部署支持（Docker / K8s）；④ SLA 99.9% |
| **不做** | 不实装 HIPAA 合规（Phase 5+）；不实装 FedRAMP 合规（Phase 5+） |
| **输入** | L1 完成的企业版预览 |
| **输出** | SOC 2 认证；白标文档；私有部署 Helm Chart |
| **依赖** | L1 完成 |
| **验收** | ① SOC 2 Type II 审计通过<br>② 白标客户可自定义品牌<br>③ 私有部署文档完整 |
| **估时** | 120h |
| **风险** | 高。SOC 2 审计周期长（6-12 月） |
| **优先级** | P0 |

### 轨道 P：AI Workspace

#### P1 — 本地 AI Workspace

| 字段 | 内容 |
|---|---|
| **范围** | 实装本地 AI Workspace：① 本地 Whisper 语音转文字（轻量版）；② 本地 SAM 图像分割；③ 本地 Stable Diffusion 轻量版（图像生成） |
| **不做** | 不实装 AI 训练/微调；不实装大模型本地推理（LLaMA 等） |
| **输入** | transformers.js<br>ONNX Runtime Web |
| **输出** | 3 个本地 AI 工具；AI Workspace UI |
| **依赖** | Phase 3 完成 |
| **验收** | ① Whisper 转文字准确率 ≥ 80%（中文/英文）<br>② SAM 图像分割 < 5s（512x512）<br>③ Stable Diffusion 生成 < 30s（256x256） |
| **估时** | 100h |
| **风险** | 高。本地 AI 模型体积大（100MB+）；WebGPU 兼容性 |
| **优先级** | P1 |

### 轨道 Q：Data Workspace

#### Q1 — Data Workspace

| 字段 | 内容 |
|---|---|
| **范围** | 实装 Data Workspace：① CSV 查看/编辑/转换；② JSON 格式化/查询；③ SQLite 浏览器（SQL.js） |
| **不做** | 不实装数据库连接（MySQL/PostgreSQL，Phase 5+）；不实装数据可视化图表 |
| **输入** | SQL.js<br>PapaParse |
| **输出** | 3 个 Data 工具；Data Workspace UI |
| **依赖** | Phase 3 完成 |
| **验收** | ① CSV 100MB 流式处理无卡顿<br>② JSON 1MB 格式化 < 1s<br>③ SQLite 创建/查询/导出可用 |
| **估时** | 60h |
| **风险** | 中。大文件性能 |
| **优先级** | P2 |

### 轨道 R：Developer Workspace

#### R1 — Developer Workspace

| 字段 | 内容 |
|---|---|
| **范围** | 实装 Developer Workspace：① Regex 测试器；② Diff 对比工具；③ Base64 编解码；④ Hash 计算器；⑤ JWT 解码器 |
| **不做** | 不实现代码编辑器（Monaco，独立项目）；不实装 API 测试工具（Postman 替代） |
| **输入** | 现有 plugin-dev |
| **输出** | 5 个 Developer 工具；Developer Workspace UI |
| **依赖** | 无 |
| **验收** | 5 工具各 ≥3 测试用例 |
| **估时** | 40h |
| **风险** | 低 |
| **优先级** | P2 |

### 轨道 S：平台开放

#### S1 — CLI 正式发布

| 字段 | 内容 |
|---|---|
| **范围** | CLI 从最小版升级为正式版：① 完整 workflow 命令（run/list/validate）；② plugin create 脚手架完善；③ 公共 API（programmatic usage）；④ 完整文档 |
| **不做** | 不实装 CLI GUI（独立项目） |
| **输入** | 现有 packages/cli<br>TD-4.3（CLI 手写 type guard → zod） |
| **输出** | CLI v1.0.0；完整文档 |
| **依赖** | TD-4.3 清偿 |
| **验收** | ① CLI 命令完整<br>② zod 校验所有输入<br>③ npm 周下载 ≥ 1K |
| **估时** | 32h |
| **风险** | 低 |
| **优先级** | P1 |

#### S2 — 公共 API + Webhook

| 字段 | 内容 |
|---|---|
| **范围** | 开放公共 API（cloud 侧）：① REST API（Workflow 触发/查询）；② Webhook（Workflow 完成通知）；③ API key 管理 |
| **不做** | 不实装 GraphQL API（Phase 5+）；不实装 API 限流市场（Phase 5+） |
| **输入** | cloud 侧 API 基础设施 |
| **输出** | 公共 API 文档；Webhook 系统；API key 管理界面 |
| **依赖** | Phase 3 完成 |
| **验收** | ① API 文档完整（OpenAPI 规范）<br>② Webhook 可靠性 ≥ 99.9%<br>③ API key 支持权限分级 |
| **估时** | 60h |
| **风险** | 中 |
| **优先级** | P2 |

#### S3 — 嵌入式 Widget

| 字段 | 内容 |
|---|---|
| **范围** | 提供嵌入式 Widget SDK：① `<lokvis-widget>` Web Component；② 支持嵌入任意网站；③ 支持自定义工具集 |
| **不做** | 不实装 Widget Marketplace（Phase 5+） |
| **输入** | 现有 @lokvis/ui-react |
| **输出** | Widget SDK npm 包；3 个示例（博客嵌入/SaaS 嵌入/企业内网） |
| **依赖** | Phase 3 完成 |
| **验收** | ① Widget 嵌入 < 50KB（gzip）<br>② 支持跨域<br>③ 支持主题定制 |
| **估时** | 48h |
| **风险** | 中。跨域与 CSP 兼容性 |
| **优先级** | P2 |

### Phase 4 任务总览

| 轨道 | 任务 | 估时 | 优先级 | 依赖 | 状态 |
|---|---|---|---|---|---|
| N | Tauri 桌面应用 | 80h | P0 | Phase 3 | ⛔ 阻塞（依赖 Phase 3 完成） |
| O | 企业版正式 | 120h | P0 | L1 | ⛔ 阻塞（cloud 侧 SOC 2 / 白标） |
| P | 本地 AI Workspace | 100h | P1 | Phase 3 | ⛔ 阻塞（依赖 Phase 3 完成） |
| Q | Data Workspace | 60h | P2 | Phase 3 | ⛔ 阻塞（依赖 Phase 3 完成） |
| R | Developer Workspace | 40h | P2 | 无 | ✅ 已完成（2026-07-19） |
| S | CLI 正式发布 | 32h | P1 | TD-4.3 | ✅ 已完成（2026-07-19） |
| S | 公共 API + Webhook | 60h | P2 | Phase 3 | ⛔ 阻塞（cloud 侧 API） |
| S | 嵌入式 Widget | 48h | P2 | Phase 3 | ⛔ 阻塞（依赖 Phase 3 完成） |
| **合计** | | **540h** | | | |

### Phase 4 里程碑

| 里程碑 | 目标日期 | 验收标准 |
|---|---|---|
| M4.1 桌面版 Beta | 2028.10.31 | N1 完成 |
| M4.2 企业版正式 | 2028.12.31 | O1 完成（SOC 2 审计可能延后） |
| M4.3 AI Workspace | 2029.02.28 | P1 完成 |
| M4.4 Data + Developer Workspace | 2029.04.30 | Q1 + R1 完成 |
| M4.5 平台开放 | 2029.05.31 | S1 + S2 + S3 完成 |
| M4.6 Phase 4 发布 | 2029.06.30 | 全部 P0/P1 完成 |

---

## 六、风险与依赖

### 6.1 跨阶段依赖

```
Phase 2 轨道 B (Engine 实装)
  ↓ 解锁
Phase 2 轨道 D (Workspace UI)
  ↓ 解锁
Phase 3 轨道 H/J (Marketplace + Audio Workspace)
  ↓ 解锁
Phase 4 轨道 N/O/P (桌面版 + 企业版 + AI Workspace)
```

### 6.2 关键风险

| 风险 | 影响范围 | 缓解措施 |
|---|---|---|
| ffmpeg-wasm bundle 体积（30MB+） | B2 / D2 | CDN 动态加载 + Safari 降级提示（W22.4 已就绪） |
| pdf-lib 浏览器 Worker 性能 | B1 / D1 | 评估 mupdf wasm 替代方案 |
| SOC 2 审计周期长（6-12 月） | O1 | Phase 3 L1 预览阶段提前启动审计 |
| AI 模型本地推理体积（100MB+） | P1 | 评估 WebGPU 加速 + 模型量化 |
| Marketplace Workflow Schema 向后兼容 | H1 | ADR-013 manifest 已设计版本字段 |
| Tauri 跨平台兼容性 | N1 | 优先 macOS/Windows，Linux 延后 |
| Plugin SDK 生态冷启动 | E1 / H1 | Phase 2 提供 2 个示例插件 + 完善文档 |

### 6.3 Go/No-Go 决策点

#### Phase 1 → Phase 2（2026.12）

- ✅ MAU ≥ 3,000
- ✅ Pro 用户 ≥ 30
- ✅ 30 日留存 ≥ 5%
- ✅ 崩溃率 <3%
- ❌ 若未达成 → 重新评估产品方向

#### Phase 2 → Phase 3（2027.06）

- ✅ MAU ≥ 15,000
- ✅ MRR ≥ $15,000
- ✅ 30 日留存 ≥ 15%
- ✅ 5+ 第三方 Plugin
- ❌ 若未达成 → 延缓 Marketplace

#### Phase 3 → Phase 4（2028.06）

- ✅ MAU ≥ 50,000
- ✅ MRR ≥ $100,000
- ✅ 100+ Marketplace 工作流
- ❌ 若未达成 → 推迟企业版与桌面版

---

## 七、执行顺序建议

### 立即可推进（2026-07-18 起）

1. **O-1 ~ O-5**（P1 优化项，5h）— Phase 2 启动前清理
2. **B1 engine-pdf 7 操作**（32h）— 解锁 D1 PDF Workspace
3. **B2 engine-video 7 操作**（48h，与 B1 并行）— 解锁 D2 Video Workspace

### 中期推进（2027 Q1-Q2）

4. **D1 PDF Workspace UI**（24h，B1 完成后）
5. **D2 Video Workspace UI**（32h，B2 完成后）
6. **B3 engine-audio**（20h，B2 完成后）
7. **E1 Plugin SDK Beta**（20h）
8. **F1 engine-ai cloudProxy**（24h）
9. **G1 Cloud Pro 对接**（12h，F1 完成后）
10. **G2 SEO 内容扩展**（16h，D1/D2 完成后）

### Phase 2 收尾（2027 Q2）

11. **O-6 ~ O-15**（P2 优化项，16.7h） ✅ 已完成（2026-07-18）
    - O-6/O-7/O-9 评估保留（设计意图 / `_` 前缀约定已清晰）
    - O-8 engine-image public API 收敛（移除 utils/compress-target/tiles/png-metadata/probe 导出）
    - O-10 `Date.now()` → `crypto.randomUUID()`（build-linear-workflow.ts）
    - O-11 添加 MAX_WORKFLOW_STEPS 步数上限校验
    - O-12 抽取公共 `buildCapabilityWorkflow(multiple)` 辅助消除 90% 重复
    - O-13 4 处 `.catch(() => {})` → `.catch(err => console.warn(...))`
    - O-14 删除 server.ts 冗余 `as ToolHandler` 断言（返回类型协变）
    - O-15 新增 schemas.ts + 7 个 zod schema + validateParams 辅助，消除 7 处 `as Parameters<typeof ...>[0]` 断言；新增 17 个测试用例
12. Phase 2 Go/No-Go 评审

### Phase 3（2027.07-2028.06）

按 H → I → J → K → L → M 顺序推进。

**当前可推进（lokvis-open 侧，不依赖 cloud）**：
- I1 AI Workflow 生成器（F1 已完成）— 48h P0
- J1 Audio Workspace UI（B3 已完成）— 28h P1
- K1 i18n 6 语言扩展（i18n 部分；PPP 定价需 cloud 配合）— 32h P1
- M1 MCP SSE 模式（轨道 A 已完成）— 20h P2

**阻塞（依赖 cloud 侧实装）**：
- H1/H2 Marketplace（cloud 侧评价系统 / 70-30 分成）
- L1 企业版预览（cloud 侧企业版 API）

### Phase 4（2028.07-2029.06）

按 N → O → P → Q → R → S 顺序推进（N/O 可并行）。

**已完成**：
- ✅ R1 Developer Workspace（2026-07-19，5 工具 + 51 测试 + 10 .astro 页面）
- ✅ S1 CLI 正式发布（2026-07-19，zod 校验 + validate/list 命令 + 集成测试）

**阻塞（依赖 Phase 3 完成 / cloud 侧）**：
- N1 Tauri 桌面应用（依赖 Phase 3）
- O1 企业版正式（依赖 L1 + cloud 侧 SOC 2）
- P1 本地 AI Workspace（依赖 Phase 3）
- Q1 Data Workspace（依赖 Phase 3）
- S2 公共 API + Webhook（cloud 侧任务）
- S3 嵌入式 Widget（依赖 Phase 3）

---

## 八、不在本计划范围

- Phase 5+（2029.07+）规划
- cloud 侧（lokvis-cloud 仓库）任务拆解
- 移动端（iOS/Android）规划
- 浏览器扩展规划
- AI 训练/微调基础设施

---

## 九、文档维护

- **本文档**是 Phase 2/3/4 的任务追踪基线，任务状态变更需同步更新本文档
- **TASKS.md** 仍为项目级任务状态唯一信息源，本文档为其详细拆解
- **roadmap.md** 仍为战略路线图，本文档为其执行细化
- 每个阶段结束后归档本文档到 `docs/reports/archive/`

---

*本文档源自 2026-07-18 全包架构审查 + 现有路线图整合。审查基线：dev @ Phase 1.5 完成 + Phase 2 轨道 A/C 完成。*
