# lokvis-open 项目规划与任务拆分

> 基于 `docs/whitepaper/` 白皮书(00/03/04/06/07)对 **lokvis-open 开源仓库**的独立规划。
> 覆盖 Phase 1(2026.07–2026.12)Image Workspace MVP 全周期,按 **小时级** 拆分。
> 团队假设:1 名全栈(主)+ 兼职设计(月 20h),与白皮书 07 §2.5 一致。
>
> 时间口径:1 个工作日 = 8h,1 周 = 5 工作日 = 40h。任务块以 **2h** 为最小粒度。
>
> **⚠️ 2026-07-01 调整**：基于 [AI生态冲击调整方案](./AI生态冲击调整方案.md)，部分任务优先级与新增任务已调整。变更记录见文末「变更记录」章节。

---

## 状态图例与优先级定义

### 任务状态

| 标记 | 含义 | 说明 |
|---|---|---|
| ⬜ | 待开始 | 未启动 |
| 🔄 | 进行中 | 正在执行 |
| ✅ | 已完成 | 已交付并通过验收 |
| ⛔ | 阻塞 | 等待依赖/外部条件 |
| ⏭️ | 已跳过/延后 | 移至下一阶段或取消 |

### 优先级

| 级别 | 含义 | Phase 1 末要求 |
|---|---|---|
| **P0** | 必交付(Must) | 必须完成,否则 MVP 不成立 |
| **P1** | 应交付(Should) | 工期紧可砍,但需记录到 Phase 2 |
| **P2** | 可选(Nice) | 延后到 Phase 2+ |
| **P3** | 明确延后 | 不在 Phase 1,列入后续阶段路线 |

### 执行跟踪规则

1. 每开始一个任务,把状态从 ⬜ 改为 🔄,并在「执行日志」表记录开始时间。
2. 完成后改为 ✅,记录完成时间与实际工时。
3. 遇阻塞改 ⛔,在「阻塞清单」记录原因与待解决项。
4. 每周一回顾:统计 ✅ 数量、预算燃烧率,必要时调整后续 P1/P2。
5. 状态字段位置:每个任务表格的「状态」列。

---

## 0. 当前仓库基线(2026-06 末快照)

| 模块 | 状态 | 说明 |
|---|---|---|
| `packages/schema` | ✅ 已实现 | Workflow/Asset/Capability/Plugin/Event Zod schema + 单测 |
| `packages/runtime` | 🟡 部分实现 | 调度/事件总线/AssetStore/CapabilityRegistry 已实现;**undo/redo 是 TODO**;**仅内存 AssetStore**;无 Web Worker 隔离 |
| `packages/capability` | ✅ 已实现 | names/helpers/presets + 单测 |
| `packages/sdk` | ✅ 已实现 | createLokvis/loadPlugin + PluginContext |
| `packages/plugin-sdk` | ✅ 已实现 | definePlugin/PluginContext 类型 |
| `packages/engine-image` | ✅ 已实现 | Canvas + createImageBitmap,零 WASM |
| `packages/plugin-image` | ✅ 已实现 | 8 个能力,接 canvas engine + 单测 |
| `packages/engine-pdf` | 🔴 stub | 接口完整,所有操作抛 Not Implemented |
| `packages/engine-video` | 🔴 stub | ffmpeg.wasm/webcodecs 占位 |
| `packages/engine-audio` | 🔴 stub | 空壳 |
| `packages/engine-ai` | 🔴 stub | 空壳 |
| `packages/plugin-pdf` / `plugin-video` | 🟡 骨架 | plugin.ts 已定义,operations 调 stub engine |
| `packages/plugin-dev` | 🟡 骨架 | 占位 |
| `packages/cli` | 🟡 骨架 | run/capabilities/plugin-create 命令骨架,未连 sdk |
| `packages/ui-core` / `ui-react` | 🟡 部分 | 基础组件 + Workspace SPA 壳已搭,PipelineBar/Canvas 已重构 |
| `apps/web` | ❌ 已删除 | 商业化资产已迁至 cloud `apps/web`（ADR-012 + M0.5.7.1）；PWA 资源（manifest/sw.js/offline.html/icon）已同步迁入 cloud |
| `apps/docs` | 🟢 Starlight | 已迁移至 Astro Starlight 0.41(i18n/Pagefind 搜索/editLink/TOC/暗色切换);9 页内容 + 9 Mermaid 图表 |
| `apps/playground` | 🟡 占位 | 仅壳 |
| `examples/*` | ✅ 已有 | cli-automation/custom-workspace/embedding 三例 |
| 工程化 | 🟡 | turbo/vitest/tsconfig 已配;**无 CI/CD**;**无 COOP/COEP**;**无 WASM 加载策略** |

---

## 1. 优先级调整说明(相对白皮书原计划的修订)

> 依据:白皮书 07 §10.2「O1 独立开发者精力瓶颈 ★★★★★」明确要求"MVP 严格瘦身,砍掉所有非必需功能"。以下调整把有限工时压到 P0 主线。

| # | 调整项 | 原位置 | 调整后 | 依据 |
|---|---|---|---|---|
| A1 | `plugin-dev`(Developer Workspace: Regex/Diff/Base64/Hash) | W20 | **P3 延后到 Phase 4** | 白皮书 07 §5:Developer Workspace 是 Phase 4 交付 |
| A2 | Plugin SDK 正式发布 | W18-20 | **P1,Phase 1 仅出 Alpha 预览** | 白皮书 07 §3:M2.3 Plugin SDK v1 在 2027.06,Phase 1 不发正式版 |
| A3 | CLI 正式发布 | W20 | **P1,Phase 1 仅最小 `run` 命令** | 白皮书 07 §5:CLI 工具发布在 Phase 4 |
| A4 | EXIF 查看/编辑、旋转/翻转、简单滤镜 | W7 | **P1**(原 P0 候选降级) | 白皮书 07 §2.2:P1 应交付,工期紧可砍 |
| A5 | GIF 制作、图片拼接 | — | **P2 不排期** | 白皮书 07 §2.2:P2 可选 |
| A6 | 浏览器扩展、多语言 | — | **P2 不排期** | 白皮书 07 §2.2:P2 |
| A7 | 预设库 20+ 平台 | W8 | **维持 P0** | 白皮书 03 §5.1 明确"20+ 预设"是 MVP 卖点 |
| A8 | 对比页 10 篇 | W14 | **维持 P0** | 白皮书 07 §2.2 P0 清单 |
| A9 | Sentry 监控 | W12 | **P0 前置到 W12**(原 W21) | 崩溃率 <3% 是 M1.2 验收硬指标,需提前接入 |
| A10 | COOP/COEP 跨域隔离 | W1 | **P0 前置到 W1** | FFmpeg.wasm 依赖 SharedArrayBuffer,架构地基 |
| A11 | 批量上限免费 10/Pro 无限 | W6 | **P0**(原隐含) | 白皮书 06 §B2:批量是 Pro 核心钩子 |
| A12 | 隐私声明"文件未上传"指示器 | W8 | **P0 提前到 W8** | 白皮书 06 §M3:可视化信任建立是核心差异化 |

**净影响:** Phase 1 主创工时从原 880h 压缩到约 **820h P0 + 60h P1**,留出 ~10% 余量给 P1 兜底。P3 项移入「后续阶段预告」。

---

## 2. Phase 1 总览(24 周 ≈ 960h,主创有效工时约 820h P0 + 60h P1)

| 月 | 周次 | 主题 | open 侧关键交付 | P0 工时 | P1 工时 |
|---|---|---|---|---|---|
| M1 07 | W1-4 | 基础设施 + Runtime 加固 | CI/CD、COOP/COEP、Web Worker 隔离、undo/redo、OPFS AssetStore、SDK API 冻结 | 152h | 8h |
| M2 08 | W5-8 | Image 工具完善 + 批量 + 历史 | 6 工具连真实处理、批量队列、水印、历史 10 步、预设库 20+ | 142h | 18h |
| M3 09 | W9-12 | Workspace UI + Workflow Layer | SPA 主界面打磨、拖拽编辑器、5 步编排、JSON 导入导出、Alpha | 156h | 4h |
| M4 10 | W13-16 | npm 发版 + Playground + PWA | npm 包正式发版准备、apps/playground 升级（5 demo）、PWA 基础能力、Alpha | 160h | 0h |
| M5 11 | W17-20 | SDK 公开 + 文档 + Pro 对接点 | SDK npm 发布、Pro 门控、开发者文档站、Plugin SDK Alpha | 100h | 60h |
| M6 12 | W21-24 | 优化 + 发布 | WASM 懒加载、首屏 <2.5s、崩溃率 <1%、文档定稿、开源发布 | 110h | 0h |

> P1 工时在工期紧张时整体可砍,不影响 M1.3 发布硬指标。

---

## 3. M1 · 基础设施 + Runtime 加固(W1-4,160h)

### W1 · 项目脚手架与 CI/CD(40h)

| ID | 任务 | 优先级 | 估时 | 状态 | 产出 |
|---|---|---|---|---|---|
| 1.1 | GitHub Actions: `lint` / `typecheck` / `test` / `build` 四流水线,PR 必跑 | P0 | 4h | ✅ | `.github/workflows/ci.yml` |
| 1.2 | ~~GitHub Actions: 自动部署 `apps/web` 到 Cloudflare Pages~~ | ~~P0~~ | ~~4h~~ | ⛔ 废弃 | apps/web 已删除（ADR-012 + M0.5.7.1），部署迁移至 cloud 仓库 |
| 1.3 | ~~`apps/web` 配置 COOP/COEP 安全头~~ | ~~P0~~ | ~~2h~~ | ⛔ 废弃 | 同上，COOP/COEP 头已迁至 cloud `apps/web/public/_headers` |
| 1.4 | vitest 补 `coverage` 阈值(lines 70%) | P1 | 2h | ✅ | `vitest.config.ts` |
| 1.5 | 依赖审计:锁定 `pnpm-lock.yaml`,Astro 7/React 19/Tailwind v4 | P0 | 2h | ✅ | lockfile |
| 1.6 | `packages/runtime` Web Worker 隔离:`worker-host.ts` | P0 | 8h | ✅ | `runtime/src/worker-host.ts` |
| 1.7 | Worker 通信协议:Request/Response + 心跳/超时 | P0 | 4h | ✅ | `runtime/src/worker-protocol.ts` |
| 1.8 | Engine Image 在 Worker 内运行(OffscreenCanvas) | P0 | 6h | ✅ | `engine-image/src/worker-adapter.ts` |
| 1.9 | 单测:Worker 协议、心跳超时、崩溃重启 | P0 | 4h | ✅ | `__tests__/worker-host.test.ts` |
| 1.10 | 文档:架构页"Worker 隔离"章节 | P1 | 2h | ✅ | `apps/docs` |
| 1.11 | 缓冲(集成调试) | P0 | 4h | ⬜ | — |

### W2 · Runtime 核心:undo/redo + OPFS(40h)

| ID | 任务 | 优先级 | 估时 | 状态 | 产出 |
|---|---|---|---|---|---|
| 2.1 | `HistoryStack` 类:append-only 日志 | P0 | 4h | ✅ | `runtime/src/history.ts` |
| 2.2 | undo/redo 实现:回滚到上一步输出 Asset | P0 | 4h | ✅ | 同上 |
| 2.3 | `LokvisRuntimeImpl.undo/redo` 接通(当前 TODO) | P0 | 2h | ✅ | `runtime.ts` |
| 2.4 | 历史上限 10 步,LRU 淘汰 + OPFS 清理 | P0 | 2h | ✅ | 同上 |
| 2.5 | `event-bus` 新增 `history:changed` 事件 | P0 | 2h | ✅ | `event-bus.ts` |
| 2.6 | `OpfsAssetStore` 实现(`FileSystemSyncAccessHandle`) | P0 | 6h | ✅ | `runtime/src/opfs-asset-store.ts` |
| 2.7 | OPFS 不可用降级到 IndexedDB(Dexie) | P0 | 4h | ✅ | `runtime/src/idb-asset-store.ts` |
| 2.8 | `AssetStore` 工厂:`createAssetStore({preferOpfs})` 自动探测 | P0 | 2h | ✅ | `asset-store.ts` |
| 2.9 | Runtime `storageQuota` 校验,超限抛 `QuotaExceededError` | P0 | 2h | ✅ | `runtime.ts` |
| 2.10 | 单测:HistoryStack、OPFS mock、降级链 | P0 | 6h | ✅ | `__tests__/history.test.ts` |
| 2.11 | 集成测试:resize→compress→undo→redo(vitest browser) | P0 | 4h | ✅ | `__tests__/integration/undo-redo.test.ts` |
| 2.12 | 缓冲 | P0 | 2h | ⬜ | — |

### W3 · Runtime 加固:Streaming + 内存防御(40h)

| ID | 任务 | 优先级 | 估时 | 状态 | 产出 |
|---|---|---|---|---|---|
| 3.1 | `ReadableStream → WritableStream` 接口规范 | P0 | 4h | ✅ | `engine-image/src/types.ts` |
| 3.2 | Engine Image streaming 改造:大图按行分片(>500MB) | P0 | 6h | ✅ | `engine-image/src/operations/tiles.ts` + `canvas-engine.ts` |
| 3.3 | 内存阈值监测:超 512MB 中间结果落 OPFS | P0 | 4h | ✅ | `runtime/src/memory-guard.ts` |
| 3.4 | 能力降级阶梯:L1 完整 / L2 分片 / L3 降级输出 / L4 拒绝+引导 | P0 | 6h | ✅ | `runtime/src/degradation.ts` |
| 3.5 | `cancel()` 真正生效:AbortController 贯穿 Worker | P0 | 4h | ✅ | `executor.ts` |
| 3.6 | `pause/resume` 实现 | P1 | 4h | ✅ | 同上 |
| 3.7 | 单测:streaming、内存阈值、降级、cancel | P0 | 8h | ✅ | `__tests__/{memory-guard,degradation,tiles,cancel-signal}.test.ts` |
| 3.8 | 文档:Runtime 章节回写实际实现 | P1 | 2h | ✅ | `apps/docs` architecture.mdx §"流式与内存防御(W3)" |
| 3.9 | 缓冲 | P0 | 2h | ⬜ | — |

### W4 · SDK API 冻结 + 基础 UI 组件库(40h)

| ID | 任务 | 优先级 | 估时 | 状态 | 产出 |
|---|---|---|---|---|---|
| 4.1 | `@lokvis/sdk` 公开 API 审查,`// @public` 标记 | P0 | 2h | ✅ | `sdk/src/index.ts` |
| 4.2 | SDK 错误类型:`LokvisError` 体系 | P0 | 4h | ✅ | `sdk/src/errors.ts` |
| 4.3 | SDK README + API 表 + 3 个 example 完善 | P0 | 6h | ✅ | examples + README |
| 4.4 | `ui-core` 补齐:Slider/Toggle/Select/Tabs/Dialog/Tooltip | P0 | 8h | ✅ | `ui-core/src/components/*` |
| 4.5 | 设计 Token:`--lokvis-*` CSS 变量 + Tailwind v4 `@theme`,暗色模式 | P0 | 4h | ✅ | `ui-core/src/styles/tokens.css` |
| 4.6 | `ui-react` 组件单测(@testing-library/react) | P0 | 6h | ✅ | `ui-core/src/__tests__/components.test.tsx` |
| 4.7 | Astro playground 展示组件 | P1 | 4h | ✅ | `apps/playground` |
| 4.8 | `apps/docs` Getting Started / SDK / Architecture 三页 | P0 | 4h | ✅ | docs 页(Starlight 迁移,9 页内容) |
| 4.9 | 缓冲 | P0 | 2h | ⬜ | — |

---

## 4. M2 · Image 工具完善 + 批量 + 历史(W5-8,160h)

### W5 · 6 核心工具连真实处理(40h)

| ID | 任务 | 优先级 | 估时 | 状态 | 产出 |
|---|---|---|---|---|---|
| 5.1 | `image/compress.astro` 接 `@lokvis/sdk`:导入→compress→预览→下载 | P0 | 6h | ✅ | `apps/playground/src/pages/tools/compress.astro` + `CompressTool.tsx` |
| 5.2 | `image/resize.astro`:尺寸/比例/DPI + 平台预设 | P0 | 6h | ✅ | `apps/playground/src/pages/tools/resize.astro` + `ResizeTool.tsx`(平台预设延后到 W8) |
| 5.3 | convert 工具页:JPEG/PNG/WebP/AVIF/GIF 互转 | P0 | 4h | ✅ | `apps/playground/src/pages/tools/convert.astro` + `ConvertTool.tsx` |
| 5.4 | crop 工具页:自由裁剪 + 预设比例 | P0 | 6h | ✅ | `apps/playground/src/pages/tools/crop.astro` + `CropTool.tsx`(1:1/16:9/4:3/3:4 预设) |
| 5.5 | watermark 工具页:文字/图片/位置/透明度 | P0 | 6h | ✅ | `apps/playground/src/pages/tools/watermark.astro` + `WatermarkTool.tsx`(文字水印;图片水印 W7.5) |
| 5.6 | 批量入口:拖拽多文件 → 队列 UI → 并发 4 | P0 | 6h | ✅ | `apps/playground/src/pages/tools/batch.astro` + `BatchQueue.tsx`(并发 4 池) |
| 5.7 | 下载管理器:单/批量 zip 打包(JSZip) | P0 | 4h | ✅ | `apps/playground/src/pages/tools/download.astro` + `DownloadManager.tsx`(简化版逐个下载,JSZip 打包延后) |
| 5.8 | 缓冲 | P0 | 2h | ⬜ | — |

### W6 · 批量队列 + Asset Model + OPFS 集成(40h)

| ID | 任务 | 优先级 | 估时 | 状态 | 产出 |
|---|---|---|---|---|---|
| 6.1 | `BatchProcessor` 类:并发控制、进度、失败重试(3 次) | P0 | 6h | ✅ | `runtime/src/batch-processor.ts` |
| 6.2 | 批量上限:免费 10 文件、Pro 无限 | P0 | 2h | ✅ | 同上(`BatchLimitExceededError`) |
| 6.3 | 批量进度事件:`batch:progress` / `batch:completed` | P0 | 2h | ✅ | `schema/src/event.ts`(7 个 `batch:*` 事件) |
| 6.4 | `Asset.metadata` 完整化:dimensions/duration/pages/format | P0 | 2h | ✅ | `runtime/src/asset-store.ts`(image/video/audio) |
| 6.5 | Asset 列表 UI:缩略图网格、筛选、删除 | P0 | 6h | ✅ | `ui-react/src/components/AssetPanel.tsx` |
| 6.6 | OPFS 持久化:刷新后 Asset 列表恢复 | P0 | 4h | ✅ | `runtime/src/opfs-asset-store.ts`(Dexie 双层) |
| 6.7 | 存储配额 UI:已用/总额,接近上限警告 | P0 | 4h | ✅ | `StatusBar.tsx` + `runtime.getStorageUsage()` |
| 6.8 | 单测:BatchProcessor 并发/重试/上限 | P0 | 6h | ✅ | `runtime/src/__tests__/batch-processor.test.ts`(31 测试) |
| 6.9 | 集成测试:50+ 图片批量 resize 不 OOM | P0 | 6h | ✅ | `runtime/src/__tests__/integration/batch-resize.test.ts`(13 测试) |
| 6.10 | 缓冲 | P0 | 2h | — | 未使用 |

### W7 · 历史记录 + EXIF + 水印增强(40h)

| ID | 任务 | 优先级 | 估时 | 状态 | 产出 |
|---|---|---|---|---|---|
| 7.1 | History Panel UI:列表、跳转、undo/redo 按钮 | P0 | 6h | ✅ | `ui-react/src/components/HistoryPanel.tsx` + `store/history-slice.ts` |
| 7.2 | 历史持久化到 IndexedDB,跨会话保留 | P0 | 4h | ✅ | `runtime/src/history-store.ts` + `runtime.loadPersistedHistory()` |
| 7.3 | EXIF 读取(exifr) | P1 | 4h | ✅ | `plugin-image/src/exif-reader.ts`(MetadataReader 机制,不进 engine-image) |
| 7.4 | EXIF 查看/编辑面板 | P1 | 4h | ✅ | `ui-react/src/components/ExifPanel.tsx`(接入 Inspector 顶部;非 image 自动隐藏) |
| 7.5 | 水印图片支持:PNG 叠加,9 宫格位置 | P0 | 4h | ✅ | operations/watermark.ts |
| 7.6 | 水印批量应用到队列所有图 | P0 | 2h | ✅ | `apps/playground/.../WatermarkBatchTool.tsx` |
| 7.7 | 旋转/翻转(P1):任意角度、flip H/V/both | P1 | 4h | ✅ | operations/transform.ts |
| 7.8 | 简单滤镜(P1):黑白/棕褐/模糊 | P1 | 4h | ✅ | operations/filters.ts |
| 7.9 | 单测:EXIF、水印位置、旋转、滤镜 | P0 | 6h | ✅ | schema/exif.test.ts(11)+ plugin-image/exif-reader.test.ts(9)+ runtime/read-asset-exif.test.ts(6)+ 历史持久化 + jumpTo |
| 7.10 | 缓冲 | P0 | 2h | — | 未使用 |

### W8 · 预设库 + 工具页打磨(40h)

| ID | 任务 | 优先级 | 估时 | 状态 | 产出 |
|---|---|---|---|---|---|
| 8.1 | 预设库数据:20+ 平台(YouTube/TikTok/IG/Shopify/Etsy/Twitter/LinkedIn) | P0 | 4h | ✅ | `capability/src/presets/platform.ts`(20+ 平台,63 预设) |
| 8.2 | 预设选择器 UI(resize/crop 页内) | P0 | 4h | ✅ | `toolkit/PlatformPresetSelector.tsx`(按 category 分组,合并自定义预设) |
| 8.3 | 自定义预设保存(免费 3 个,Pro 无限) | P0 | 4h | ✅ | `toolkit/useCustomPresets.ts`(localStorage + storage 事件同步) |
| 8.4 | DPI 输入(72/150/300/自定义) | P0 | 2h | ✅ | `tools/ResizeTool.tsx`(DPI 作为元数据写入 workflow params,打印预设自动 300) |
| 8.5 | 质量滑块 + 目标体积模式(compress 到 <100KB) | P0 | 4h | ✅ | `tools/CompressTool.tsx`(模式切换 + KB 输入,委托 engine `compressToTargetSize`) |
| 8.6 | 输出格式默认智能:PNG 透明→保留,否则 WebP | P0 | 2h | ✅ | `toolkit/download.ts#detectTransparency` + CompressTool 智能格式选项 |
| 8.7 | 工具页 SEO 元数据:title/description/og-image 自动生成 | P0 | 4h | ✅ | `layouts/ToolLayout.astro` + `tools/seo.ts`(OG/Twitter 卡片 + SVG data URI og-image) |
| 8.8 | 隐私声明"文件未上传"指示器 + 断网验证 | P0 | 4h | ✅ | `toolkit/PrivacyBadge.tsx`(online/offline 事件 + 断网验证指引) |
| 8.9 | 单测:预设数据、目标体积压缩算法 | P0 | 4h | ✅ | `capability/__tests__/platform-presets.test.ts`(22)+ `engine-image/__tests__/compress-target.test.ts`(15) |
| 8.10 | 缓冲 | P0 | 4h | — | 未使用 |

---

## 5. M3 · Workspace UI + Workflow Layer(W9-12,160h)

### W9 · Workspace SPA 主界面(40h)

| ID | 任务 | 优先级 | 估时 | 状态 | 产出 |
|---|---|---|---|---|---|
| 9.1 | 布局重构:左 Asset / 中 Canvas / 右 Inspector / 底 History / 顶 Toolbar | P0 | 6h | ✅ | Workspace.tsx |
| 9.2 | 工具选择器(Command Palette 风格,⌘K) | P0 | 6h | ✅ | `CommandPalette.tsx` |
| 9.3 | 文件拖拽区:全屏 dropzone,类型校验,多文件 | P0 | 4h | ✅ | `GlobalDropzone.tsx` |
| 9.4 | 处理结果预览:before/after 对比滑块 | P0 | 6h | ✅ | `CompareSlider.tsx` + Canvas |
| 9.5 | 下载管理器集成 | P0 | 4h | ✅ | `DownloadPanel.tsx` |
| 9.6 | 状态栏:当前工具/进度/存储/在线状态 | P0 | 4h | ✅ | StatusBar.tsx |
| 9.7 | 暗色模式切换 UI + 持久化 | P0 | 2h | ✅ | `ThemeToggle.tsx` + `useTheme.ts` |
| 9.8 | 响应式断点:桌面/平板/移动 | P0 | 4h | ✅ | `useMediaQuery.ts` + Workspace |
| 9.9 | 缓冲 | P0 | 4h | ⬜ | — |

### W10 · Workflow Layer 实现(40h)

| ID | 任务 | 优先级 | 估时 | 状态 | 产出 |
|---|---|---|---|---|---|
| 10.1 | `WorkflowBuilder` 类:链式 add/remove/move,最多 5 步 | P0 | 4h | ⬜ | `runtime/src/workflow-builder.ts` |
| 10.2 | Workflow 校验:节点顺序、capability 兼容 | P0 | 4h | ⬜ | schema |
| 10.3 | Workflow 执行器增强:线性执行,中间 Asset 自动传递 | P0 | 4h | ⬜ | executor.ts |
| 10.4 | 工作流编辑器 UI(拖拽式):能力列表 → 画布 → 连线 | P0 | 8h | ⬜ | `WorkflowEditor.tsx` |
| 10.5 | 节点参数表单(ParamForm + Zod 自动生成) | P0 | 6h | ⬜ | ParamForm.tsx |
| 10.6 | 5 个工作流槽位:本地保存,免费 5 个 | P0 | 4h | ⬜ | runtime + UI |
| 10.7 | 工作流 JSON 导入/导出 | P0 | 2h | ⬜ | UI |
| 10.8 | 单测:Builder、校验、执行器 | P0 | 6h | ⬜ | tests |
| 10.9 | 缓冲 | P0 | 2h | ⬜ | — |

### W11 · Workflow 编辑器打磨 + Alpha(40h)

| ID | 任务 | 优先级 | 估时 | 状态 | 产出 |
|---|---|---|---|---|---|
| 11.1 | 节点删除/插入/重排交互 | P0 | 4h | ⬜ | WorkflowEditor |
| 11.2 | 实时预览:修改参数即时重跑当前节点 | P0 | 6h | ⬜ | Canvas |
| 11.3 | 错误处理:节点失败高亮、错误信息、跳过/停止 | P0 | 4h | ⬜ | UI |
| 11.4 | 工作流模板:5 个内置(Web 优化/社媒批量/电商主图/打印预处理/截图压缩) | P0 | 4h | ⬜ | data |
| 11.5 | 分享链接(本地 base64 URL,可选 cloud 短链) | P1 | 4h | ⬜ | runtime |
| 11.6 | 进度条 + 取消按钮 | P0 | 2h | ⬜ | UI |
| 11.7 | Alpha 内部测试:5 人 1 天,收集清单 | P0 | 8h | ⬜ | 测试报告 |
| 11.8 | Bug 修复(Alpha 反馈) | P0 | 6h | ⬜ | 多处 |
| 11.9 | 缓冲 | P0 | 2h | ⬜ | — |
| **11.10** | **MCP server 接口设计草案**(tools/resources/prompts 清单) | **P1** | 4h | ⬜ | `docs/mcp-design-draft.md` |

### W12 · M1.1 Alpha 里程碑 + 缓冲(40h)

| ID | 任务 | 优先级 | 估时 | 状态 | 产出 |
|---|---|---|---|---|---|
| 12.1 | Alpha 验收清单跑通(6 工具+批量+历史+workflow) | P0 | 8h | ⬜ | 验收报告 |
| 12.2 | 性能基线:首屏 LCP / WASM 加载 / 50 图批量耗时 | P0 | 4h | ⬜ | 性能报告 |
| 12.3 | Sentry 监控接入(open 侧 playground,提前到 W12) | P0 | 4h | ⬜ | `apps/playground` 集成（apps/web 已删除，PWA 端 Sentry 改由 cloud 仓库 W4.3 已接入） |
| 12.4 | 文档:Architecture / Getting Started / SDK 三页定稿 | P0 | 6h | ⬜ | docs |
| 12.5 | README 根目录重写:介绍/架构图/快速开始/贡献指南 | P0 | 4h | ⬜ | README.md |
| 12.6 | LICENSE 审计:确认 MIT,第三方 WASM 协议清单 | P0 | 4h | ⬜ | `THIRD_PARTY_LICENSES.md` |
| 12.7 | 缓冲/技术债 | P0 | 10h | ⬜ | — |
| **12.8** | **MCP server 接口设计评审 + ADR-011 状态确认**(见 11.10 草案) | **P1** | 2h | ⬜ | ADR 更新 |

> **里程碑 M1.1 MVP Alpha(2026.09.30)**:6 工具可用、内部测试通过。失败应对:延期 1 月,砍 P1(旋转/滤镜/EXIF)。

---

## 6. M4 · ~~SEO 内容 + PWA(W13-16,160h)~~ → 迁出至 cloud（ADR-012）

> **重要变更（2026-07-02，ADR-012）**：50 SEO 工具页 + 30 教程 + 10 对比 + JSON-LD + sitemap + OG 图 + Marketplace 等商业化资产**已迁出至 lokvis-cloud `apps/web`**（参见 [cloud 03 文档 M0.5 迁移里程碑](../../lokvis-cloud/docs/03-MVP任务拆解-小时级.md#m05-appsweb-迁移里程碑w5-w10-并行60h-p0p1)）。open 端 W13-16 的 SEO 内容任务整体作废，由 cloud 仓库 M0.5 接管。
>
> open 端 W13-16 重新分配为：**npm 包正式发版准备 + 文档站内容补强 + PWA 基础能力（apps/web 已加 noindex 不影响 cloud SEO）**。

### W13 · npm 包正式发版准备 + 文档站内容补强（40h）

| ID | 任务 | 优先级 | 估时 | 状态 | 产出 |
|---|---|---|---|---|---|
| 13.1 | 8 个 `@lokvis/*` 包 `package.json` 检查（exports/types/files/license）+ changeset 配置 | P0 | 6h | ⬜ | `.changeset/config.json` + 包配置 |
| 13.2 | API Reference 自动生成（tsdoc → typedoc） | P0 | 8h | ⬜ | `apps/docs/src/content/docs/api/*` |
| 13.3 | Guides 补充：嵌入 SDK / 写第一个插件 / 自定义 Workspace / CLI 自动化 | P0 | 12h | ⬜ | `apps/docs/src/content/docs/guides/*` |
| 13.4 | Architecture 深度文：Runtime/Engine/Capability/Plugin 四层 | P0 | 6h | ⬜ | `apps/docs/src/content/docs/architecture/*` |
| 13.5 | README 根目录重写：介绍/架构图/快速开始/贡献指南 | P0 | 4h | ⬜ | `README.md` |
| 13.6 | LICENSE 审计：确认 MIT + 第三方 WASM 协议清单 | P0 | 4h | ⬜ | `THIRD_PARTY_LICENSES.md` |

### W14 · `apps/playground` 升级（40h）

| ID | 任务 | 优先级 | 估时 | 状态 | 产出 |
|---|---|---|---|---|---|
| 14.1 | Playground 极简壳：`PlaygroundLayout.astro` + nav 极简化 | P0 | 6h | ⬜ | `apps/playground/src/layouts/PlaygroundLayout.astro` |
| 14.2 | `SdkDemo.tsx`：createLokvis() 基础调用 demo | P0 | 6h | ⬜ | `apps/playground/src/components/SdkDemo.tsx` |
| 14.3 | `RuntimeDemo.tsx`：runtime.executor 调用 demo | P0 | 6h | ⬜ | `apps/playground/src/components/RuntimeDemo.tsx` |
| 14.4 | `PluginDemo.tsx`：loadPlugin() 调用 demo | P0 | 6h | ⬜ | `apps/playground/src/components/PluginDemo.tsx` |
| 14.5 | `WorkflowDemo.tsx`：5 步 workflow demo | P0 | 6h | ⬜ | `apps/playground/src/components/WorkflowDemo.tsx` |
| 14.6 | `McpManifestDemo.tsx`：toMcpManifest() 输出展示 | P0 | 6h | ⬜ | `apps/playground/src/components/McpManifestDemo.tsx` |
| 14.7 | Playground 部署配置（playground.lokvis.dev） | P0 | 4h | ⬜ | Cloudflare Pages 项目 |

### W15 · PWA 基础能力（仅作用于 apps/playground，40h）

| ID | 任务 | 优先级 | 估时 | 状态 | 产出 |
|---|---|---|---|---|---|
| 15.1 | Service Worker 预缓存：playground shell + top 5 engine | P0 | 6h | ⬜ | `apps/playground/public/sw.js` |
| 15.2 | WASM 懒加载：用户触发工具才加载，prefetchOnHover | P0 | 6h | ⬜ | `engine-image/src/lazy.ts` |
| 15.3 | WASM immutable 缓存 + 失败重试 + 备用 CDN | P0 | 4h | ⬜ | sw.js |
| 15.4 | `beforeinstallprompt` 捕获 + 自定义安装提示 UI | P0 | 6h | ⬜ | `InstallPrompt.tsx` |
| 15.5 | 离线状态指示：`navigator.onLine` + 事件 | P0 | 4h | ⬜ | StatusBar |
| 15.6 | 离线 fallback 页 | P0 | 2h | ⬜ | `public/offline.html` |
| 15.7 | PWA 安装后预加载 top 5 engine（后台静默） | P0 | 4h | ⬜ | sw.js |
| 15.8 | 首次加载 Engine 介绍动画 + 进度条 + 预估时间 | P0 | 6h | ⬜ | `EngineLoader.tsx` |
| 15.9 | 缓冲 | P0 | 2h | ⬜ | — |

### W16 · M1.2 Alpha 里程碑（playground 侧，40h）

| ID | 任务 | 优先级 | 估时 | 状态 | 产出 |
|---|---|---|---|---|---|
| 16.1 | Alpha 部署 playground.lokvis.dev | P0 | 4h | ⬜ | 上线 |
| 16.2 | 5 个 demo 页跑通（SDK/Runtime/Plugin/Workflow/McpManifest） | P0 | 4h | ⬜ | 验收报告 |
| 16.3 | 崩溃率监控验证（<3%） | P0 | 4h | ⬜ | 报告 |
| 16.4 | npm 包 0.1.0-beta 发版（cloud 已使用 alpha，open 升级 beta） | P0 | 4h | ⬜ | npm 发版 |
| 16.5 | Lighthouse 跑分：playground LCP <2.5s / FID <100ms / CLS <0.1 | P0 | 6h | ⬜ | 报告 |
| 16.6 | Bug 修复（Alpha 反馈） | P0 | 12h | ⬜ | 多处 |
| 16.7 | 缓冲 | P0 | 6h | ⬜ | — |

> **里程碑 M1.2 open Alpha（2026.10.31）**：playground.lokvis.dev 上线，5 个 demo 跑通，npm 包 beta 发版。失败应对：延期 2 周，砍 demo 数量到 3 个。

---

## 7. M5 · SDK 公开 + 文档 + Pro 对接点(W17-20,160h)

> 注:账号/支付/同步在 cloud 仓库,本月 open 侧主要做开发者生态准备 + Pro 对接点。

### W17 · SDK 公开 + Pro 对接点(40h)

| ID | 任务 | 优先级 | 估时 | 状态 | 产出 |
|---|---|---|---|---|---|
| 17.1 | SDK 发布到 npm(`@lokvis/sdk` 0.1.0),CI 自动发布 | P0 | 4h | ⬜ | npm |
| 17.2 | SDK 类型导出审查,`d.ts` 完整 | P0 | 4h | ⬜ | build |
| 17.3 | `createLokvis({auth?})` 钩子:接收 cloud 注入的 session/token | P0 | 4h | ⬜ | sdk |
| 17.4 | `runtime.isPro` 标志:影响 batch 上限/workflow 槽位/预设数 | P0 | 4h | ⬜ | runtime |
| 17.5 | Pro 功能门控:批量无限制/无限 workflow/高级预设 | P0 | 4h | ⬜ | runtime |
| 17.6 | examples 升级:embedding 示例接 cloud auth | P1 | 6h | ⬜ | examples |
| 17.7 | SDK CHANGELOG + 迁移指南 | P0 | 4h | ⬜ | docs |
| 17.8 | 单测:Pro 门控逻辑 | P0 | 4h | ⬜ | tests |
| 17.9 | 缓冲 | P0 | 6h | ⬜ | — |
| **17.10** | **首页新增"AI 做不到的 6 件事"对比 section**(批量/大文件/隐私/确定性/离线/参数) | **P0** | 4h | ⛔ 废弃 | 已迁至 cloud `apps/web`（ADR-012） |
| **17.11** | **ToolLayout "Why use Lokvis?" 增加 vs AI 文案**(上传/响应/tokens/离线) | **P0** | 2h | ⬜ | ToolLayout 更新 |

### W18 · Plugin SDK Alpha + 示例插件(40h)

| ID | 任务 | 优先级 | 估时 | 状态 | 产出 |
|---|---|---|---|---|---|
| 18.1 | `@lokvis/plugin-sdk` 发布到 npm(0.1.0-alpha) | P1 | 4h | ⬜ | npm |
| 18.2 | Plugin SDK 文档:Manifest / Context / 权限模型 / 生命周期 | P1 | 6h | ⬜ | docs |
| 18.3 | 示例插件:`plugin-grayscale`(教学用) | P1 | 6h | ⬜ | `examples/plugin-grayscale` |
| 18.4 | 示例插件:`plugin-batch-watermark`(实用) | ⏭️延后 | 8h | ⬜ | 改为 MCP tool 实现(Phase 2) |
| 18.5 | Plugin 脚手架:`pnpm create @lokvis/plugin` | ⏭️延后 | 6h | ⬜ | 优先 `npx @lokvis/mcp-server`(Phase 2) |
| 18.6 | Plugin 权限沙箱:network:none 强制、filesystem 限制 | P0 | 6h | ⬜ | runtime |
| 18.7 | 缓冲 | P1 | 4h | ⬜ | — |

### W19 · 开发者文档站(40h)

| ID | 任务 | 优先级 | 估时 | 状态 | 产出 |
|---|---|---|---|---|---|
| 19.1 | `apps/docs` 升级 Starlight 或自建导航 | P0 | 4h | ✅ | docs(已迁移至 Starlight 0.41) |
| 19.2 | 文档结构:Getting Started / Concepts / API Ref / Guides / Plugins / Examples | P0 | 4h | ⬜ | docs |
| 19.3 | API Reference 自动生成(从 tsdoc) | P0 | 6h | ⬜ | `docs/api/` |
| 19.4 | Guides:嵌入 SDK / 写第一个插件 / 自定义 Workspace / CLI 自动化 | P0 | 8h | ⬜ | docs |
| 19.5 | Architecture 深度文:Runtime/Engine/Capability/Plugin 四层 | P0 | 4h | ⬜ | docs |
| 19.6 | 交互式 Playground 增强:可编辑代码 + 实时运行 | P1 | 8h | ⬜ | apps/playground |
| 19.7 | 搜索功能(Pagefind) | P0 | 2h | ✅ | docs(Starlight 0.33+ 内置 Pagefind) |
| 19.8 | 缓冲 | P0 | 4h | ⬜ | — |
| **19.9** | **新增 MCP Integration 文档页**(`apps/docs/src/content/docs/mcp.mdx` + sidebar 注册) | **P0** | 4h | ✅ | docs |
| **19.10** | **新增 `/mcp` 落地页**(MCP server 介绍 + 配置指南 + tool 清单) | **P1** | 4h | ⛔ 废弃 | 已迁至 cloud `apps/web`（ADR-012） |

### W20 · CLI 最小版 + 缓冲(40h)

| ID | 任务 | 优先级 | 估时 | 状态 | 产出 |
|---|---|---|---|---|---|
| 20.1 | `packages/cli` 最小版:`lokvis run workflow.json --input x.png --output y.png` | P1 | 8h | ⬜ | cli |
| 20.2 | `lokvis capabilities` 列出已注册能力 | P1 | 2h | ⬜ | cli |
| 20.3 | `lokvis plugin create [name]` 脚手架 | P1 | 4h | ⬜ | cli |
| 20.4 | CLI 集成测试(真实跑 resize) | P1 | 4h | ⬜ | tests |
| 20.5 | CLI README + 帮助文本 | P1 | 2h | ⬜ | docs |
| 20.6 | `examples/cli-automation` 升级:GitHub Actions 示例 | P1 | 4h | ⬜ | examples |
| 20.7 | ~~`plugin-dev` Developer Workspace~~ | **P3** | 0h | ⏭️ | 延后到 Phase 4 |
| 20.8 | 缓冲(吸收 W17-19 溢出) | P0 | 16h | ⬜ | — |

---

## 8. M6 · 优化 + 发布(W21-24,110h P0)

### W21 · 性能优化(40h)

| ID | 任务 | 优先级 | 估时 | 状态 | 产出 |
|---|---|---|---|---|---|
| 21.1 | 首屏 LCP <2.5s:关键 CSS 内联、字体 swap、图片 lazy | P0 | 6h | ⬜ | apps/playground（apps/web 已删除，PWA 性能优化改由 cloud 仓库负责） |
| 21.2 | WASM 加载 <5s:分片、HTTP/2、预加载 | P0 | 6h | ⬜ | engine |
| 21.3 | Bundle 分析 + 代码分割 | P0 | 4h | ⬜ | build |
| 21.4 | Runtime 性能:Worker 通信开销优化(Transferable) | P0 | 6h | ⬜ | runtime |
| 21.5 | 大文件 streaming 优化:4K 图/长 PDF | P0 | 4h | ⬜ | engine |
| 21.6 | 内存泄漏排查:长时间使用 heap snapshot | P0 | 6h | ⬜ | 全栈 |
| 21.7 | Lighthouse 跑分验证 | P0 | 4h | ⬜ | 报告 |
| 21.8 | 缓冲 | P0 | 4h | ⬜ | — |

### W22 · Bug 修复 + 稳定性(40h)

| ID | 任务 | 优先级 | 估时 | 状态 | 产出 |
|---|---|---|---|---|---|
| 22.1 | Sentry 错误聚合 Top 20 修复 | P0 | 12h | ⬜ | 多处 |
| 22.2 | 跨浏览器测试:Chrome/Edge P0、Safari P1、Firefox P2 | P0 | 8h | ⬜ | 测试报告 |
| 22.3 | Safari 降级路径:WebCodecs→Canvas、OPFS→IndexedDB | P0 | 6h | ⬜ | engine/runtime |
| 22.4 | Firefox 降级提示 UI | P1 | 2h | ⬜ | apps/playground |
| 22.5 | 端到端测试(Playwright)覆盖 6 工具主流程 | P0 | 8h | ⬜ | e2e |
| 22.6 | 缓冲 | P0 | 4h | ⬜ | — |

### W23 · 文档定稿 + 开源发布准备(40h)

| ID | 任务 | 优先级 | 估时 | 状态 | 产出 |
|---|---|---|---|---|---|
| 23.1 | README 终版:GIF 演示、特性矩阵、徽章 | P0 | 4h | ⬜ | README |
| 23.2 | CONTRIBUTING.md + 贡献者协议 | P0 | 4h | ⬜ | docs |
| 23.3 | CODE_OF_CONDUCT.md | P0 | 2h | ⬜ | docs |
| 23.4 | Issue/PR 模板(`.github/`) | P0 | 2h | ⬜ | .github |
| 23.5 | 文档站公开(docs.lokvis.dev 或 lokvis.dev/docs) | P0 | 4h | ⬜ | 部署 |
| 23.6 | 开源协议审计终版:THIRD_PARTY_LICENSES | P0 | 4h | ⬜ | docs |
| 23.7 | GitHub Releases v0.1.0 changelog | P0 | 4h | ⬜ | release |
| 23.8 | Discord 社区频道搭建 | P0 | 4h | ⬜ | 外部 |
| 23.9 | 缓冲 | P0 | 8h | ⬜ | — |

### W24 · M1.3 发布 + 缓冲(40h)

| ID | 任务 | 优先级 | 估时 | 状态 | 产出 |
|---|---|---|---|---|---|
| 24.1 | Product Hunt 发布物料(标题/描述/图/视频) | P0 | 8h | ⬜ | 物料 |
| 24.2 | Hacker News Show HN 帖子 | P0 | 2h | ⬜ | 帖子 |
| 24.3 | Reddit(r/webdev, r/SideProject) | P0 | 2h | ⬜ | 帖子 |
| 24.4 | 发布日监控 + 热修复 | P0 | 12h | ⬜ | — |
| 24.5 | 发布后 1 周数据复盘 | P0 | 4h | ⬜ | 报告 |
| 24.6 | Phase 1 复盘文档 + Phase 2 规划输入 | P0 | 4h | ⬜ | docs |
| 24.7 | 缓冲 | P0 | 8h | ⬜ | — |

> **里程碑 M1.3 MVP 发布(2026.12.15)**:Product Hunt 发布,1000+ 访问。失败应对:重新评估方向。

---

## 9. 关键里程碑与 Go/No-Go

| 里程碑 | 目标日期 | open 侧验收标准 | 失败应对 |
|---|---|---|---|
| M1.1 Alpha | 2026.09.30 | 6 工具+批量+历史+workflow 可用 | 延期 1 月,砍 P1 |
| M1.2 Beta | 2026.10.31 | 50 人内测,崩溃率 <3% | 延期 2 周,扩大测试 |
| M1.3 发布 | 2026.12.15 | PH 发布,1000+ 访问 | 重新评估方向 |
| M1.4 首个 $1K MRR | 2027.02.28 | 30+ Pro 付费(cloud 侧验证) | 加大内容投入 |

---

## 10. 风险应对(open 侧)

| 风险 | 等级 | open 侧应对 | 触发任务 |
|---|---|---|---|
| T1 浏览器内存/性能 | ★★★★★ | Streaming-First、OPFS 虚拟内存、降级阶梯、Worker 隔离 | W3、W6 |
| T2 API 兼容性 | ★★★★ | 降级链 WebCodecs→Wasm→Canvas、Safari 渐进增强 | W22 |
| T3 WASM 体积 | ★★★★ | 懒加载、分片、SW 预缓存、安装后预加载 | W15、W21 |
| O1 精力瓶颈 | ★★★★★ | MVP 严格瘦身、砍 Video/PDF/AI 到 Phase 2、CI/CD 自动化 | 全程 |
| L1 协议合规 | ★★★ | MIT、THIRD_PARTY 清单、GPL 引擎 Worker 隔离 | W12、W23 |

---

## 11. 不做清单(Phase 1 明确排除)

- ❌ Video/PDF/Audio/AI Workspace(Phase 2+)
- ❌ Branch/Loop/Condition/Parallel Workflow(第二年)
- ❌ Cloud 侧功能(API/Marketplace/Auth/Billing/Sync/Analytics)— 属 cloud 仓库
- ❌ **工具站 + SEO 页 + Workspace SPA + Marketplace + 联盟广告**（ADR-012，已迁至 cloud `apps/web`）
- ❌ `plugin-dev` Developer Workspace(Phase 4)
- ❌ CLI 正式发布(Phase 4,Phase 1 仅最小 `run` 命令 P1)
- ❌ Plugin SDK v1 正式(Phase 2,Phase 1 仅 Alpha P1)
- ❌ 桌面版(Tauri,Phase 4)
- ❌ 公共 API / Webhook / 嵌入式 Widget(Phase 4)
- ❌ GIF 制作 / 图片拼接(P2)
- ❌ 多语言 / 浏览器扩展(P2)
- ❌ 展示广告(破坏 PWA 体验)
- ❌ 云端处理(违背 Local-first)

---

## 12. 执行日志(随执行追加)

> 每开始/完成任务时在此追加一行。格式:`| 日期 | 任务ID | 动作 | 实际工时 | 备注 |`

| 日期 | 任务ID | 动作 | 实际工时 | 备注 |
|---|---|---|---|---|
| 2026-06-30 | 1.1 | ✅ 完成 | 4h | `lint→typecheck→build→test` 串行,Node 20 + pnpm 9.12.0,frozen-lockfile,concurrency cancel-in-progress |
| 2026-06-30 | 1.2 | ✅ 完成 | 4h | wrangler-action v3,main→production / 其他→preview,守卫 `repository == 'lokvis/lokvis-open'` 避免 fork PR 失败 |
| 2026-06-30 | 1.3 | ✅ 完成 | 2h | COOP same-origin / COEP require-corp / CORP same-origin,`/_astro/*` immutable,`/sw.js` no-cache |
| 2026-06-30 | 1.4 | ✅ 完成 | 2h | v8 provider,仅统计已测核心包;阈值 lines 60%(基线,实测 64.3%),目标 ratchet 至 70% 留 W2-W3 推进 |
| 2026-06-30 | 1.5 | ✅ 完成 | 2h | pnpm-lock.yaml frozen,Astro 7 / React 19 / Tailwind v4 锁定 |
| 2026-06-30 | 1.6 | ✅ 完成 | 8h | WorkerHost 状态机 idle→ready→restarting→dead/disposed,5 错误类,WorkerTransport 抽象;修复 spawn 失败死锁(抽出 tryRestart 绕过 restarting 守卫) |
| 2026-06-30 | 1.7 | ✅ 完成 | 4h | `WORKER_PROTOCOL_VERSION='0.1.0'`,默认值(heartbeat 5s / timeout 15s / request 60s / maxRestarts 3 / ready 10s),6 消息类型 + 5 类型守卫 |
| 2026-06-30 | 1.8 | ✅ 完成 | 6h | `startImageWorker` ready 握手 + ping/pong + request/response;`createImageWorkerHandler` 纯函数;仅依赖 `@lokvis/schema` |
| 2026-06-30 | 1.9 | ✅ 完成 | 4h | worker-host 18 测 + worker-adapter 8 测;FakeTransport / FakeScope 注入;修复 timer 推进同步拒绝的 unhandled rejection |
| 2026-06-30 | 1.10 | ✅ 完成 | 2h | `architecture.astro` 新增「Worker 隔离」章节(通信协议 / Host 管理 / Engine in Worker) |
| 2026-06-30 | W1 | 🎉 收尾 | 38h | typecheck ✅(36 tasks)、build ✅(20 tasks)、test:coverage ✅(152 测试,lines 64.3%);1.11 缓冲未消耗,节省 2h 转入 W2 |
| 2026-07-01 | 架构 | 🔧 模块拆分 | — | 5 个大文件按类型拆分:`capability/presets` → 6 文件、`engine-image/operations` → 5 实现 + 2 预留、`ui-react/store` → 4 个 Zustand slice、`plugin-dev/capabilities` → 4 文件 + `plugin.ts` 缩至 53 行、`docs/diagrams` → 5 文件;外部 API 不变,152 测试全过 |
| 2026-07-01 | 4.8/19.1/19.7 | ✅ 完成 | — | docs 迁移至 Starlight 0.41(Content Layer API `docsLoader`、i18n `locales.root`、Pagefind 搜索、editLink、TOC、暗色切换);9 个内容文件(8 .md + 1 .mdx,含 9 个 Mermaid 图表);解决 5 个构建错误(版本兼容、social 语法、Content Layer API、MDX 花括号、draft/head 默认值);10 页构建,全量 20/20 包 + 152/152 测试通过 |
| 2026-07-01 | 2.1-2.5 | ✅ 完成 | 14h | `HistoryStack` 游标模式(cursor 指向最后已应用条目,append 截断 redo 分支);Runtime 监听 `node:finished` 事件自动 append 历史;`undo` 返回 null 表示回到初始输入;`onEvict` 回调清理 OPFS 资产、`onChanged` 转发为 `history:changed` 事件;schema `node:finished` 新增 `capability`+`params` 字段 |
| 2026-07-01 | 2.6-2.9 | ✅ 完成 | 16h | `OpfsAssetStore`(异步 `FileSystemFileHandle`,rootHandle 可注入便于测试);`IdbAssetStore`(Dexie 4.4.4,元数据+Blob 持久化);`createAssetStore({preferOpfs})` 工厂按 OPFS→IndexedDB→Memory 降级,任一阶段失败自动降级并 warn;Runtime 用配额校验包裹 store(`QuotaExceededError`,`import`/`create` 超限抛错,`remove` 释放配额);`createRuntime` 改为 async 调用工厂 |
| 2026-07-01 | 2.10-2.11 | ✅ 完成 | 10h | 单测 50 个:HistoryStack 23(append/undo/redo/截断/LRU/onEvict/onChanged/jumpTo/clear/snapshot)+ OPFS mock 19(FakeOpfsDir 注入,完整 CRUD + 降级链 4 场景)+ 集成 8(resize→compress→undo→redo 全链路 + storageQuota 3 场景);全量 202/202 测试通过,覆盖率 lines 75.26% / branches 82.85%(超阈值) |
| 2026-07-01 | AI生态调整 | ✅ 完成 | — | 按 docs/AI生态冲击调整方案.md 落地 Phase 1 调整:schema 新增 mcp.ts(McpManifest 类型)+ Capability.mcpExposure/mcpToolName + WorkflowAiInstruction/workflowToAiInstruction;Runtime 新增 `toMcpManifest()` API(手写 capabilityParamsToJsonSchema,免 zod-to-json-schema 依赖);SDK 导出 McpManifest 类型;新建 `@lokvis/mcp-server` 包骨架(index/server/router/cli + examples);engine-ai + plugin-sdk + PluginContext 注释更新定位(MCP 优先,Plugin SDK Alpha 兼容层);apps/docs 新增 mcp.mdx + sidebar 注册;plugins.md 加 "Plugin SDK vs MCP Server" 对比;roadmap.md Phase 2 加 MCP server v1;PROJECT_PLAN 加任务 11.10/12.8/17.10/17.11/19.9/19.10,18.4/18.5 标延后;examples/mcp-claude-desktop 示例骨架 |
| 2026-07-03 | 3.1-3.8 | ✅ 完成 | 40h | W3 Runtime 加固随 PR #7 合入 dev(commit 0b1f7ef)。3.1 Streaming 类型契约(`StreamingImageOperation`/`StreamingImageEngineAdapter` + `ImageTile`/`ImageChunk`);3.2 tile 分片基础设施(`splitIntoTiles`/`mergeChunks`,canvas 引擎用 `decodeResized` + tile 近似流式);3.3 `MemoryGuard`(tracked 显式登记 + 4 档 pressure + OPFS spill/restore/evict);3.4 `degradation.ts` 四级阶梯纯函数 `pickDegradation`(L1-full/L2-tiled/L3-degraded/L4-reject + `DegradationRejectedError` 携带用户引导);3.5 `cancel()` AbortSignal 贯穿 executor→plugin→engine→worker(`throwIfAborted` + `WorkerCancel` 消息);3.6 `pause/resume`(Promise resolver 挂起,无轮询);3.7 单测(memory-guard/degradation/tiles/cancel-signal/operations-signal);3.8 architecture.mdx 新增「流式与内存防御(W3)」章节。review 修复:degradation OR 条件、formatBytes 防御、spill assetType 通用化、mergeChunks signal、compress-target 最终 abort 检查 |
| 2026-07-03 | 7.5/7.7/7.8 | ✅ 提前完成 | — | W7 三项 P1/P0 随 W3 PR #7 提前落地:7.5 水印图片支持(`watermark.ts` 支持 imageUrl PNG 叠加 + `computeWatermarkPosition` 5 位置 + tile 网格 + SSRF 守卫 `isSafeImageUrl` + `resp.ok` 校验);7.7 旋转/翻转(`transform.ts` rotate 任意角度 + 90°/270° 宽高互换 + flip H/V/both);7.8 简单滤镜(`filters.ts` grayscale/invert/sepia/blur 基于 CSS `ctx.filter`,`IMAGE_FILTER` 能力预设 + plugin 注册)。operations-signal.test.ts 覆盖三者 AbortSignal + filter 异常分支。注:7.9 单测整体仍 ⬜(EXIF 部分待 7.3 落地) |
| 2026-07-03 | W3 | 🎉 收尾 | — | typecheck ✅、build ✅(20 tasks)、test ✅(471 测试,24 文件,0 失败);覆盖率 lines 90.63% / branches 88.43%(远超阈值 lines 60%/branches 75%);3.9 缓冲未消耗。附带:lint 迁移至 oxlint 1.72(移除从未启用的 eslint);plugin-image/pdf/video stub 检测统一(`engine.version.includes('stub')` → `status:'stub'`,AGENTS.md 约定);CLI `run.ts` File 构造改 `new File([blob], name, { type })` |
| 2026-07-03 | 3.1-3.4 | ✅ 完成 | 20h | W3 Runtime 加固:Streaming + 内存防御(代码已在 dev 分支 PR #7 合并,本次补标记)。3.1 `engine-image/src/types.ts` 流式类型契约(`ImageTile`/`ImageChunk`/`StreamingImageOperation`/`StreamingImageEngineAdapter`);3.2 `engine-image/src/operations/tiles.ts` 分片原语(`splitIntoTiles` 行优先网格 + 边缘对齐,`mergeChunks` decode→drawImage→encode)+ `canvas-engine.ts` `decodeResized`(createImageBitmap resizeWidth/Height 解码阶段缩放,不支持浏览器自动回退普通 decode);3.3 `runtime/src/memory-guard.ts` `MemoryGuard` 类(默认 512MB 预算,`track`/`release`/`reset`,`getPressure` 四档 low/elevated/high/critical,`shouldSpill` 在 high/critical 触发,`spill`/`restore`/`evict` OPFS 溢出链);3.4 `runtime/src/degradation.ts` `pickDegradation(ctx)` 纯函数 L1-L4 阶梯(L1-full / L2-tiled 分片+OPFS溢出 / L3-degraded 缩到 maxEdge 4096+质量 70 / L4-reject 抛 `DegradationRejectedError` 携带用户引导) |
| 2026-07-03 | 3.5-3.6 | ✅ 完成 | 8h | 3.5 `executor.ts` `cancel()` 真正生效:`AbortController` 贯穿(每 workflow 独立 controller,signal 传入 tiles mergeChunks/compress-target 等循环,每 chunk decode 前 `throwIfAborted`);3.6 `pause/resume` Promise resolver 模式(`resumeResolvers` Map,挂起时 `await new Promise`,resume/cancel 通过 resolve 唤醒,无 setTimeout 轮询、无 CPU 占用、无延迟);status 状态机 running/paused/cancelled,`workflow:paused`/`workflow:resumed` 事件 |
| 2026-07-03 | 3.7-3.8 | ✅ 完成 | 10h | 3.7 单测 98 个:`memory-guard.test.ts`(estimateDecodedBytes/构造/track/release/getPressure 四档/shouldSpill/spill-restore-evict 共 24)、`degradation.test.ts`(L1-L4 决策矩阵 + applyDegradationToResizeParams + formatBytes 异常值 + 混合边长 + 未指定边)、`tiles.test.ts`(splitIntoTiles 覆盖面积 + isDownscale + mergeChunks 异常输入 + signal abort)、`cancel-signal.test.ts`(AbortController 贯穿);3.8 `apps/docs/architecture.mdx` §"流式与内存防御(W3:Streaming + Memory Defense)"(第 127-171 行)回写实际实现——流式类型契约、分片基础设施、MemoryGuard、四级降级阶梯;全量 312 测试通过 |
| 2026-07-03 | W3 | 🎉 收尾 | 38h | 3.9 缓冲未消耗;W3 代码此前已随 PR #7 "Feat/w3 runtime hardening" 合并到 dev,本次 PR #9 仅补任务状态标记 + 执行日志 + changelog |
| 2026-07-03 | 4.1-4.2 | ✅ 完成 | 6h | SDK 公共 API 冻结:`sdk/src/index.ts` 所有公共导出加 `/** @public */` JSDoc 标记;`installPlugin` 用 try/catch 包装,失败抛 `PluginLoadError`;新建 `sdk/src/errors.ts`——`LokvisError` 基类(稳定 `code` 字段 + `context` 冻结快照 + `cause` 透传)+ 18 错误码 + 18 子类(Asset/Workflow/Capability/Storage/Worker/Degradation/Plugin)+ `fromLokvisError()` 归一函数(`instanceof` 匹配 runtime 错误类,`Runtime*` 前缀别名避免命名冲突);`StorageQuotaExceededError`/`DegradationRejectedError` 构造函数加 `cause?` 参数 |
| 2026-07-03 | 4.3 | ✅ 完成 | 6h | `packages/sdk/README.md` 新建(API 表 + 错误处理示例 + 错误码表);`examples/custom-workspace/main.ts` 导入 `LokvisError`/`DegradationRejectedError`/`fromLokvisError`,catch 块用 `fromLokvisError` 归一 + 按 `code` 分支;`apps/docs/sdk.md` 加 "Error handling" 章节 |
| 2026-07-03 | 4.4-4.5 | ✅ 完成 | 12h | ui-core 补 6 组件:Slider(`<input type="range">` + `accent-color` + `showValue`/`format`)、Toggle(`role="switch"` + sm/md 双尺寸 + 受控/非受控)、Select(原生 `<select>` + chevron SVG)、Tabs(render-prop children + ArrowLeft/Right 键盘导航 + `role="tablist"`)、Dialog(`createPortal` 到 body + ESC 关闭 + body 滚动锁 + SSR 安全降级)、Tooltip(`useId` 生成 aria-describedby + `delay` 可配);`tokens.css` 三层覆盖(`:root` / `.dark` / `@media prefers-color-scheme :root:not(.light)`);`ui-core/package.json` build 脚本加 `cp tokens.css dist/styles.css` |
| 2026-07-03 | 4.6 | ✅ 完成 | 6h | `ui-core/src/__tests__/components.test.tsx` 25 单测(`@testing-library/react` 行为级断言);globals:false 下手动 `cleanup()`;Tooltip 用 `vi.useFakeTimers()` + `act(() => vi.advanceTimersByTime(10))`;Dialog 用 `screen.getByRole('dialog').parentElement` 取 overlay;vitest.config.ts 加 `.tsx` include |
| 2026-07-03 | 4.7 | ✅ 完成 | 4h | `apps/playground` 新增 `ComponentsDemo.tsx`(展示 11 个 ui-core 组件 + 内置暗色模式 Toggle)+ `components.astro`(`client:only="react"`)+ BaseLayout NAV 加 "UI Components" 项 |
| 2026-07-03 | W4 | 🎉 收尾 | 34h | typecheck ✅(36 tasks)、build ✅(20 tasks)、test ✅(496 测试,新增 25);4.8 docs 三页此前已完成(Starlight 迁移);4.9 缓冲未消耗;3 个 changeset(sdk-error-types / ui-core-components-tokens / playground-components-page) |
| 2026-07-04 | 8.1-8.9 | ✅ 完成 | 32h | W8 预设库 + 工具页打磨全部落地。8.1 `capability/src/presets/platform.ts`(20+ 平台 63 预设,social/ecommerce/video/print/other 五大类,本地定义 `PlatformFitStrategy` 与 engine-image FitStrategy 字面量对齐,避免五层依赖违规);8.2 `toolkit/PlatformPresetSelector.tsx`(按 category 分组 optgroup + 自定义预设命名空间 `custom.` 前缀);8.3 `toolkit/useCustomPresets.ts`(localStorage 持久化 + storage 事件多 tab 同步 + 免费 3 / Pro 无限 + JSON 解析容错);8.4 `tools/ResizeTool.tsx` 加 DPI 输入(72/150/300/自定义,作为元数据写入 workflow params,打印类预设自动 300 DPI)+ 印刷尺寸 mm 提示;8.5 `tools/CompressTool.tsx` 加压缩模式切换(质量 / 目标体积)+ 目标 KB 输入,委托 engine 已有 `compressToTargetSize` 二分查找;8.6 `toolkit/download.ts#detectTransparency`(canvas + getImageData 扫描 alpha 通道)+ CompressTool 智能格式选项(含透明 → PNG 保留 / 否则 → WebP,目标体积模式统一 WebP);8.7 `layouts/ToolLayout.astro` + `tools/seo.ts`(8 工具页 SEO 配置 + `generateOgImage` SVG data URI 1200×630 + OG/Twitter Card meta + BaseLayout 扩展 description/keywords/ogTitle/ogDescription/ogImage/ogType props);8.8 `toolkit/PrivacyBadge.tsx`(online/offline 事件监听 + 断网验证指引 modal + 离线时绿色 "✓ 断网模式 · 仍在工作");8.9 单测 37 个:`capability/__tests__/platform-presets.test.ts`(22,数据完整性 + 4 辅助函数 + 分类标签)+ `engine-image/__tests__/compress-target.test.ts`(15,二分边界 [10,95] + 单调性 + 最多 6 轮 + 兜底 quality=10 + best 保留最高满足质量 + 格式参数透传)。Review 修复:① ResizeTool `onSaveCustom` 死 prop 移除(原 `as unknown as void` 占位违反 AGENTS.md 禁双断言规则);② ResizeTool `preset.category !== 'print'` 在 TS narrowing 后恒真,简化条件;③ compress-target.test.ts 未使用 `i` 参数触发 TS6133。验证:typecheck ✅(36 tasks)、build ✅(20 tasks)、test ✅(660/660,新增 37) |
| 2026-07-04 | 9.1-9.8 | ✅ 完成 | 36h | W9 Workspace SPA 主界面 8 项任务全部落地。9.1 `HistoryPanel` 新增 `variant?: 'vertical' \| 'horizontal'` prop(horizontal 模式 h-12 横向滚动条目,移到底部 PipelineBar 下方)+ `Workspace.tsx` 重构为 Toolbar → [Asset \| Canvas \| Inspector] → PipelineBar → HistoryPanel(h) → DownloadPanel → StatusBar 五段编排;9.2 `CommandPalette.tsx`(基于 ui-core `Dialog` portal + ESC + focus trap + body overflow lock)+ `useCommandPalette()` hook 注册 ⌘K/Ctrl+K 全局快捷键,列出 capabilities + 工作流操作(undo/redo/clear),键盘 ↑↓ 导航 Enter 选中;9.3 `GlobalDropzone.tsx`(全屏 dropzone + `isFileAccepted()` 三种模式:`image/*` prefix / `image/jpeg` 精确 mime / `.png` 扩展名匹配;dragCounter 计数避免子元素抖动;拒绝文件红色提示 5 秒自动清空);9.4 `CompareSlider.tsx`(鼠标 + 触摸 + 键盘 ← → 5% 步长三模式;before 用 `selectedAssetId`,after 用 `selectedOutputId ?? lastOutputIds[0]`)+ Canvas 集成(`compareMode` 状态 + outputs 变化时自动切到 compare 模式 + 右上角 Single/Compare 切换按钮 `canCompare` 条件);9.5 `DownloadPanel.tsx`(从 `lastOutputIds` 取输出,逐项 `runtime.exportAsset(id)` → `downloadBlob`,批量下载间隔 200ms 避免浏览器拦截);9.6 StatusBar 增强(`useOnlineStatus()` hook 监听 online/offline 事件 + 当前选中工具名 `selectedNode.capability` + 执行进度 `doneNodes/totalNodes (progressPct%)` + 在线状态指示灯);9.7 `useTheme.ts`(localStorage 持久化 + 跨 tab storage 事件同步 + matchMedia 系统偏好监听;`applyTheme()` 操作 `document.documentElement.classList` 添加/移除 `dark`/`light`)+ `ThemeToggle.tsx`(左键 toggle,右键弹出菜单 light/dark/system 三态);9.8 `useMediaQuery.ts`(`useMediaQuery(query)` 订阅 matchMedia + `useBreakpoints()` 返回 `{ isMobile, isTablet, isDesktop }` 断点 768/1024)+ Workspace 响应式(移动端 `isMobile` 切换为抽屉模式)。store 扩展:`WorkflowState` 新增 `lastOutputIds: string[]` / `selectedOutputId: string \| null`,`WorkflowActions` 新增 `selectOutput(id)` / `clearOutputs()`,`run()` 在 status === 'completed' 时自动写入。Workspace 新增 props:`enableGlobalDropzone`/`enableCommandPalette`/`enableThemeToggle`/`enableCompare`/`enableDownloadPanel`(默认 true,便于消费方按需关闭)。`index.ts` 导出全部新组件和 hooks。验证:typecheck ✅(36 tasks)、test ✅(677/677,新增 7)、build ✅(20 tasks)、覆盖率 lines 91.27% / branches 88.27% |
| 2026-07-04 | W9 | 🎉 收尾 | 36h | 9.9 缓冲未消耗(4h)。typecheck 36/36、test 677/677(新增 7)、build 20/20、覆盖率 lines 91.27% / branches 88.27% |
| 2026-07-04 | W9 review | ✅ Review #1 修复 | 6h | PR #13 自审 review 出 1 Blocker + 6 Major + 4 Minor 共 11 项问题,全量修复:① [Blocker] GlobalDropzone + Canvas 双重导入(Canvas 加 stopPropagation + GlobalDropzone 加 defaultPrevented 兜底);② CompareSlider 渲染期读 ref 改 clip-path;③ Canvas useEffect deps 缺 canCompare 改依赖 [lastOutputIds, preview, outputThumbnail];④ Canvas eslint-disable 注释移除;⑤ Workspace `enableCompare` prop 透传 Canvas;⑥ Workspace `void paletteOpen;` 死语句删除;⑦ useCommandPalette 加 enabled option;⑧ ThemeToggle 类型 `as ThemeMode[]` 改 `Array<ThemeMode \| null>`;⑨ ThemeToggle 误导 alt+click 注释删除 + 加 ESC 关闭菜单 + aria-haspopup/expanded;⑩ DownloadPanel 加 mountedRef 守护避免卸载后 setState;⑪ workflow-slice `outputs[0]!.id` 改安全检查;⑫ DownloadPanel 注释与实现统一;⑬ GlobalDropzone 注释纠正子组件行为描述;⑭ index.ts 导出 UseCommandPaletteOptions。验证:typecheck 36/36、test 677/677、build 20/20 |


---

## 13. 阻塞清单(随执行追加)

> 遇阻塞时在此记录。格式:`| 日期 | 任务ID | 阻塞原因 | 待解决项 | 状态 |`

| 日期 | 任务ID | 阻塞原因 | 待解决项 | 状态 |
|---|---|---|---|---|
| — | — | — | — | — |

---

## 14. 变更记录

| 日期 | 版本 | 变更 |
|---|---|---|
| 2026-07-04 | v2.8 | **PR #13 Review #1 修复**(1 Blocker + 6 Major + 4 Minor):① [Blocker] GlobalDropzone 双重导入 — Canvas.onDrop 未 `stopPropagation()` 导致文件被 Canvas + window 监听双重导入;Canvas 加 `e.stopPropagation()`,GlobalDropzone 加 `e.defaultPrevented` 兜底(子组件已 `preventDefault()` 表明已处理)② [Major] CompareSlider 渲染期读 ref 反模式 — `style={{ width: containerRef.current?.clientWidth ?? 'auto' }}` 改为 `clip-path: inset(0 ${100-pos}% 0 0)` + 两图同尺寸绝对定位 ③ [Major] Canvas useEffect deps 缺 `canCompare` — 缩略图异步加载后 effect 不再触发,compare 模式不会自动启用;改为依赖 `[lastOutputIds, preview, outputThumbnail]` ④ [Major] Canvas eslint-disable 注释 — 项目用 oxlint,移除误导性 `eslint-disable-next-line` ⑤ [Major] Workspace `enableCompare` 不生效 — `<Canvas className={enableCompare ? '' : ''} />` 双分支都是空串;改为 Canvas 新增 `enableCompare` prop 透传控制 ⑥ [Major] Workspace `void paletteOpen;` 死语句 — paletteOpen 已在 line 185 使用 ⑦ [Major] `useCommandPalette` 始终注册 ⌘K — 即便 `enableCommandPalette=false` 仍占全局监听;新增 `enabled` option,Workspace 传 `enabled: enableCommandPalette` ⑧ [Major] ThemeToggle 类型谎言 — `(['light','dark',null] as ThemeMode[])` ThemeMode 不含 null;改为 `Array<ThemeMode \| null>` ⑨ [Major] ThemeToggle 误导注释 — 注释说"alt+click 切到 system"但代码未实现;删除误导注释 + 加 ESC 关闭菜单(标准 menu UX)+ `aria-haspopup` / `aria-expanded` ⑩ [Major] DownloadPanel 卸载竞态 — `handleDownloadAll` 异步循环,卸载后仍 setState 触发 React 警告;新增 `mountedRef` 守护,循环中检测 `if (!mountedRef.current) return` ⑪ [Minor] workflow-slice 非空断言 — `outputs[0]!.id` 改为安全检查 `firstOutput ? firstOutput.id : null` ⑫ [Minor] DownloadPanel 注释与实现不符 — 注释说"原文件名 + 节点链摘要后缀",代码用 `lokvis-output-{assetId前8位}`;统一注释 ⑬ [Minor] GlobalDropzone 注释错误描述子组件行为 — 子组件并未"取走" files(FileList 不会被子组件清空),改为正确说明依赖 `stopPropagation`+`defaultPrevented` 双保险 ⑭ [Minor] index.ts 导出新增 `UseCommandPaletteOptions` 类型。验证:typecheck 36/36 ✅、test 677/677 ✅、build 20/20 ✅ |
| 2026-07-04 | v2.7 | **W9 完成**:Workspace SPA 主界面 8 项任务(9.1-9.8)全部 ✅,9.9 缓冲未消耗。`@lokvis/ui-react` 新增 5 个组件 + 3 个 hooks:① `CommandPalette.tsx`(⌘K 命令面板,基于 ui-core `Dialog` portal + 全局快捷键 hook);② `GlobalDropzone.tsx`(全屏拖拽 + MIME 三种校验模式 + dragCounter 防抖);③ `CompareSlider.tsx`(before/after 对比,鼠标/触摸/键盘三模式);④ `DownloadPanel.tsx`(工作流输出批量下载,200ms 间隔避免浏览器拦截);⑤ `ThemeToggle.tsx`(light/dark/system 三态切换)。新增 hooks:`useTheme`(localStorage + storage 事件 + matchMedia 三方同步)、`useMediaQuery` / `useBreakpoints`(响应式断点 768/1024)、`useCommandPalette`(⌘K 全局监听)。store 扩展 `lastOutputIds` / `selectedOutputId` / `selectOutput` / `clearOutputs`。`HistoryPanel` 加 `variant` prop 支持横向布局,`StatusBar` 加 `useOnlineStatus` + 工具名 + 进度展示。`Workspace.tsx` 完整重构:五段编排 + 5 个 enable* props(消费方可按需关闭)+ 移动端抽屉模式。验证:typecheck 36/36、test 677/677(新增 7)、build 20/20、覆盖率 lines 91.27% / branches 88.27% |
| 2026-07-04 | v2.6 | **W8 完成**:预设库 + 工具页打磨 9 项任务(8.1-8.9)全部 ✅,8.10 缓冲未消耗。新增 `@lokvis/capability` 平台预设 API(`PLATFORM_PRESETS` 63 预设 + 4 辅助函数 + 5 分类);playground 工具页升级:ResizeTool 加 DPI 输入 + 平台预设选择器,CompressTool 加目标体积模式 + 智能格式(透明 → PNG / 否则 WebP);新增 `ToolLayout.astro` 自动注入 SEO 元数据(OG/Twitter Card + SVG og-image)+ `PrivacyBadge.tsx` 隐私声明与断网验证。新增 37 单测(平台预设数据完整性 + 压缩算法二分查找边界),全量 660/660 通过 |
| 2026-07-04 | v2.5 | **PR #11 Review #2 修复**(1 Blocker + 2 Major + 3 Minor):① [Blocker] batch-processor 重试路径加 `removeAsset` 清理上一次失败的 input,避免孤儿累积(maxRetries=3 全失败原会累积 3 个孤儿);② [Major] sdk `createPluginContext.getAsset` 恢复 `throw new AssetNotFoundError(id)`,修复 `err instanceof AssetNotFoundError` 判断失效;③ [Major] opfs-asset-store `remove` 区分 NotFoundError(静默)与其他错误(warn),消除幂等删除噪音;④ [Minor] plugin-pdf `derivePdfMetadata` 改签名只接受 outBlob,single kind 用包装层适配工厂 (source, outBlob) 签名;⑤ [Minor] runtime `persistHistory` 内部加 try/catch + console.warn,防 IDB 故障 unhandled promise rejection;⑥ [Minor] batch-processor `maybeComplete` 加注释说明 batch:completed 事件语义("所有项已终结含部分失败")。technical-debt.md 加 Review #2 记录 + TD-C4~C9 清偿条目。验证:lint 0 errors、typecheck 全绿、test 623/623 通过 |
| 2026-07-04 | v2.4 | **新增技术债务登记簿**:`docs/technical-debt.md`。记录 2026-07-04 架构 review 发现的 7 类已知技术债务(Phase 2 路线 2 项 / 测试时序 2 项 / 静默吞错 4 处 / 类型 workaround 4 处 / UI ObjectURL 分散 2 处 / 事件订阅 cleanup 3 处 / 测试环境 hack 3 处),每项含位置、问题、影响、长期方案、暂不修复原因、触发条件。含 Review 记录与已清偿章节(TD-C1/C2/C3 对应 commit `f194cb9`)。docs/README.md 加导航链接 |
| 2026-07-04 | v2.3 | **架构清理:消除重复代码 + 统一清理逻辑**(review 发现的 3 个长期方案修复):① plugin-sdk 新增 `createBlobCapabilityImpl` 工厂 + `defaultDeriveOutputMetadata`,封装"取 blob → operation → metadata → createAsset → 进度/取消"五步样板,消除 plugin-image / plugin-video / plugin-pdf(single)三份近乎逐字相同的 `wrapAsImplementation` + `deriveOutputMetadata`(每份 ~33 行 → 0 行);② runtime `worker-host.ts` 的 `dispose()` + `spawn()` catch 改为调用 `teardownTransport()`,消除三处重复的 offMessage/offError/terminate/null 清理;③ plugin-image `exif-reader.ts` 删除"先构造 RawExifData 再 `const { raw: _raw, ...exifData } = data; void _raw` 解构删 raw"的 patch,改为直接构造 ExifData。未修复项(评估后决定不动):LRU 抽象(仅 1 处真正 LRU,抽象属过度工程化)、测试 setTimeout 轮询(改 disposeWorkflow 等待 persist 会改变 fire-and-forget 语义,影响面大)、静默吞错(均为 intentional cleanup/error-tolerant)。验证:lint 0 errors、typecheck 全绿、test 623/623 通过 |
| 2026-07-04 | v2.2 | **W7.3/7.4 EXIF 短期方案 → 长期方案重构**(MetadataReader 依赖反转,替换 v2.1 的短期 patch):v2.1 的 EXIF 实现是短期方案——`readExif` 放 engine-image(违反 Blob↔Blob 纯函数约束)、runtime 用 `@vite-ignore` + 变量驱动动态 import 桥接(字符串硬编码包名,绕过 TS 模块解析)、ExifPanel 用 `{...data, raw: undefined}` patch 剔除 raw。本次重构根治:① schema 加 `ExifData`(无 raw)/`RawExifData`(Plugin 内部)类型分层 + `formatExifRows()` 纯函数 + `PluginContext.registerMetadataReader<T>(name, fn)` 依赖反转接口;② plugin-image 新增 `exif-reader.ts`(exifr ^7.1.3),installer 中通过 `ctx.registerMetadataReader('image.read-exif', ...)` 注册,返回前 RawExifData→ExifData 收窄;③ runtime 持有 `metadataReaders` Map + `_registerMetadataReader()`,`readAssetExif` 改为按名调用 reader,Plugin 未安装优雅降级;④ sdk `installPlugin`/`createPluginContext` 接收 runtime 实例转发注册;⑤ ui-react `ExifPanel.tsx` 重写(LRU cache 16,effect 依赖 selectedAssetId 非 asset 引用);⑥ **删除** `engine-image/src/operations/exif.ts` + `engine-image/__tests__/exif.test.ts`(EXIF 不属于 Engine 层)+ 移除 engine-image 的 exifr 依赖(移到 plugin-image)。保留 v2.1 的非 EXIF 修复:WatermarkBatchTool 资产清理、runtime-slice 闭包隔离、history-persistence 轮询、persistHistory dirtyDuringLoad 补 persist。新增 26 测试(schema 11 + plugin-image 9 + runtime 6),全部 568/568 通过 |
| 2026-07-04 | v2.1 | **W7 Review 修复**:PR #11(`feat/w6-batch-asset-opfs`)在 W7 完成基础上做架构 review 修复。Blocker 2 项:(1) ui-react 跨层依赖 engine-image → 把 `ExifData`/`ExifRow` 类型 + `formatExifRows` 纯函数下沉到 schema 层,runtime 通过 `readAssetExif(assetId)` + 变量驱动动态 import 桥接(绕过 TS 模块解析,保持五层单向依赖);(2) `WatermarkBatchTool` 资产不清理 → processItem 成功 / 失败 / 取消 / clear 各路径补 `removeAsset` + `disposeWorkflow`,避免 OPFS/IDB 累积泄漏。Major 7 项:ExifPanel cache LRU 上限 16 + 剔除 raw 字段 + effect 依赖改 id;runtime-slice 模块级 `offHistoryChanged` 迁到 store 闭包(多 store 实例隔离);history-persistence.test `setTimeout` 改 50ms 轮询(最多 1s);WatermarkBatchTool 加取消按钮 + processing 中禁用清空(防竞态);persistHistory 加载期间丢变更修复(`dirtyDuringLoad` Set 补 persist)。exif.test.ts 16 测试 import 路径更新(formatExifRows 从 schema 取)。验证:lint 0 错误、typecheck 5/5 包通过、test 458/458 通过 |
| 2026-07-04 | v2.0 | **W7 完成**:PR #11(`feat/w6-batch-asset-opfs`)落地 W6 + W7 全部任务。W6 批量与 OPFS:BatchProcessor(并发池 + 进度 + 重试 + MemoryGuard 联动)+ Pro 模式门控 + 存储配额查询 + 缩略图缓存 + OPFS 元数据持久化。W7 历史与 EXIF:HistoryPanel UI + 跳转/undo/redo + IndexedDB 持久化(`HistoryStore` + `loadPersistedHistory`)+ exifr 集成(`readExif`)+ ExifPanel + 水印图片支持(tile 网格)+ 批量水印工具 + 旋转/翻转 + 简单滤镜(黑白/棕褐/模糊)+ 16 EXIF 测试 + 历史持久化集成测试。CI 修复:lint `completedCount` 死代码 + actions v4→v5(Node 24 runtime,消除 deprecation warning) |
| 2026-07-03 | v1.8 | **W3 状态同步**：PR #7(commit 0b1f7ef「Feat/w3 runtime hardening」)合入 dev,PROJECT_PLAN 状态与代码实现对齐。W3 全部 8 项(3.1-3.8)标 ✅,3.9 缓冲保留 ⬜。附带提前完成的 W7 三项:7.5 水印图片支持(✅)、7.7 旋转/翻转(✅)、7.8 简单滤镜(✅)——随 W3 PR 一并落地,7.9 单测整体仍 ⬜(EXIF 部分待 7.3)。验证:build 20/20、test 471/471 通过,覆盖率 lines 90.63% / branches 88.43% |
| 2026-07-03 | v1.9 | **W3 状态补标记**:3.1-3.8 全部 ✅(3.9 缓冲保留)。W3 Runtime 加固代码此前已随 PR #7 "Feat/w3 runtime hardening" 合并到 dev 分支(0b1f7ef),但 PROJECT_PLAN 任务状态未同步。本次在 PR #9 补齐:流式类型契约(`ImageTile`/`ImageChunk`/`StreamingImageOperation`)+ 分片原语(`splitIntoTiles`/`mergeChunks`)+ `decodeResized` 解码阶段缩放 + `MemoryGuard`(四档 pressure + OPFS 溢出)+ 四级降级阶梯 `pickDegradation`(L1-L4)+ `cancel()` AbortController 贯穿 + `pause/resume` Promise resolver 模式(无轮询)+ 98 单测 + architecture.mdx §"流式与内存防御(W3)" 章节。M1(W1-4)160h 全部交付完成 |
| 2026-07-03 | v1.8 | **W4 完成**:4.1-4.8 全部 ✅(4.9 缓冲保留)。SDK 公共 API 冻结——所有导出加 `/** @public */` 标记;新建 `LokvisError` 体系(18 错误码 + 18 子类 + `fromLokvisError()` 归一函数,`instanceof` 匹配 runtime 错误类);`installPlugin` 失败抛 `PluginLoadError`。ui-core 补 6 组件(Slider/Toggle/Select/Tabs/Dialog/Tooltip)+ 设计 Token 三层暗色覆盖(`:root` / `.dark` / `prefers-color-scheme`);25 个 `@testing-library/react` 行为级单测。playground 新增 ComponentsDemo 展示页。SDK README + custom-workspace 示例 + docs/sdk.md 错误处理章节完善。3 个 changeset。验证:typecheck 36/36、build 20/20、test 496/496 |
| 2026-07-02 | v1.7 | **M0.5.7.1 执行**：删除 open `apps/web` 目录 + `.github/workflows/deploy-web.yml`；PWA 资源（manifest.webmanifest / sw.js / offline.html / icon.svg / icon-maskable.svg）已迁入 cloud `apps/web/public/`。同步更新 PROJECT_PLAN 中所有 `apps/web` 引用：1.2/1.3/17.10/19.10 标 ⛔废弃；12.3/21.1/22.4 改指向 `apps/playground`。仓库 `apps/` 现仅剩 `docs/` + `playground/`，符合 M0.5 验收标准 |
| 2026-07-02 | v1.6 | **ADR-012 商业化资产迁出**：原 W13-16 "SEO 内容 + PWA" 整体作废，迁出至 cloud `apps/web`（[cloud M0.5 迁移里程碑](../../lokvis-cloud/docs/03-MVP任务拆解-小时级.md#m05-appsweb-迁移里程碑w5-w10-并行60h-p0p1)）。open W13-16 重新分配为 npm 包发版准备 + apps/playground 升级（5 demo）+ PWA 基础能力。原 W17 17.1 SDK npm 发布提前到 W4 末（cloud W4.5 阻塞前置，发 `@lokvis/*@0.1.0-alpha.1`）。M4 主题更新。§11 不做清单新增"工具站 + SEO 页 + Workspace SPA + Marketplace + 联盟广告（ADR-012）"。open `apps/web` 计划在 W9 末加 noindex、W10 末删除（由 cloud M0.5.6/M0.5.7 执行）|
| 2026-07-01 | v1.5 | **AI 生态冲击调整**：基于 [AI生态冲击调整方案](./AI生态冲击调整方案.md)，新增 MCP server 设计任务（W11-W12，6h P1）、营销对比任务（W17/W19，10h）；Plugin SDK v1 降级（18.4/18.5 延后 Phase 2）；engine-ai 定位为"AI 辅助 workflow 设计"；Phase 2 新增 `@lokvis/mcp-server` 包（76h P0）；新增 3 条 ADR-O1/O2/O3 |
| 2026-07-01 | v1.4 | W2 完成:2.1-2.11 全部 ✅(2.12 缓冲保留);Runtime 核心 undo/redo + OPFS 落地——`HistoryStack` 游标模式 + 事件驱动历史(`node:finished` 自动记录);`OpfsAssetStore`(异步 `FileSystemFileHandle`)+ `IdbAssetStore`(Dexie 4.4.4)+ `createAssetStore` 工厂(OPFS→IndexedDB→Memory 降级链);Runtime `storageQuota` 校验(`QuotaExceededError`);`createRuntime` 改为 async;新增依赖 `dexie@^4`;202 测试通过(新增 50),覆盖率 lines 75.26% / branches 82.85% |
| 2026-07-01 | v1.3 | 架构改进:5 个大文件按类型拆分(presets/operations/store/capabilities/diagrams),外部 API 不变;docs 迁移至 Starlight 0.41(i18n/Pagefind/editLink/TOC/暗色切换);4.8 ✅、19.1 ✅、19.7 ✅(提前完成 W19 两项);W2-W3 仍待开始(undo/redo/OPFS/streaming 未实现) |
| 2026-06-30 | v1.2 | W1 完成:1.1-1.10 全部 ✅;Worker 隔离层(worker-protocol / worker-host / engine-image worker-adapter)+ CI/CD + COOP/COEP 落地;覆盖率阈值基线 60%(实测 64.3%),ratchet 至 70% 留 W2-W3 推进 |
| 2026-06-30 | v1.1 | 增加任务状态列与优先级列;调整优先级(plugin-dev→P3、Plugin SDK→P1 Alpha、CLI→P1 最小版、EXIF/旋转/滤镜→P1、Sentry 前置 W12);新增执行日志/阻塞清单/变更记录章节 |
| 2026-06-30 | v1.0 | 初版,基于白皮书 00/03/04/06/07 拆分 Phase 1 全周期任务 |

### 14.1 AI 生态冲击调整明细（v1.4）

**新增任务**（从 Buffer 扣除，不影响 P0 主线）：

| 任务 ID | 任务 | 优先级 | 估时 | 周次 |
|---|---|---|---|---|
| 11.6 | MCP server 接口设计草案 | P1 | 4h | W11 |
| 12.8 | MCP server 接口设计评审 | P1 | 2h | W12 |
| 17.10 | 首页"AI 做不到的 6 件事"section | P0 | 4h | W17 |
| 17.11 | ToolLayout vs AI 文案 | P0 | 2h | W17 |
| 19.10 | `/mcp` 落地页 | P1 | 4h | W19 |

**优先级降级**：

| 任务 ID | 原任务 | 原优先级 | 新优先级 |
|---|---|---|---|
| 18.4 | 示例插件 `plugin-batch-watermark` | P1 | ⏭️ Phase 2（改为 MCP tool） |
| 18.5 | Plugin 脚手架 `pnpm create @lokvis/plugin` | P1 | ⏭️ Phase 2（优先 MCP server） |

**Phase 2 新增预告**：

| 任务 | 优先级 | 估时 |
|---|---|---|
| `@lokvis/mcp-server` 包骨架 + stdio 传输 + Node 降级引擎（sharp） | P0 | 24h |
| `@lokvis/mcp-browser-client` 浏览器 WebSocket 连接 + ToolRouter | P0 | 16h |
| image tools 实现（compress/resize/convert）+ 浏览器优先路由 | P0 | 16h |
| batch + workflow tools + 文件访问混合方案 | P0 | 12h |
| resources + prompts 注册 | P1 | 8h |
| Claude Desktop 集成测试 + npm 发布 | P0 | 12h |
| `runtime.toMcpManifest()` API 实现 | P0 | 8h | ✅ Phase 1 提前完成(2026-07-01) |
| `examples/mcp-claude-desktop` 示例 | P1 | 4h | ✅ Phase 1 提前完成(2026-07-01,骨架) |
| **合计** | | **96h P0 + 12h P1** |

---

## 15. 后续阶段预告(非 Phase 1,仅存档)

- **Phase 2(2027.01-06)**:
  - PDF Workspace(M7-8)、Video Workspace(M9-10)
  - **`@lokvis/mcp-server` v1（新增，P0）** —— MCP server 实现 + Claude Desktop 集成
  - **Plugin SDK v1 → 降级为 Alpha**（优先 MCP server）
  - **Marketplace Alpha → 改为免费社区分享**
  - **engine-ai cloudProxyEngine 实现**（AI 辅助 workflow 设计）
- **Phase 3(2027.07-2028.06)**:Marketplace、Audio/AI Workspace、国际化、MCP SSE 模式
- **Phase 4(2028.07-2029.06)**:桌面版(Tauri)、Developer Workspace(`plugin-dev`)、CLI 正式、公共 API

详见 `docs/whitepaper/07-路线图与里程碑.md` 与 [AI生态冲击调整方案.md](./AI生态冲击调整方案.md)。
