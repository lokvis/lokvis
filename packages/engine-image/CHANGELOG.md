# @lokvis/engine-image

## 0.8.0

### Minor Changes

- [`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858) Thanks [@xiongyy](https://github.com/xiongyy)! - 低优先级清理(架构评审 #12)。

  - **#1 删除死代码**:移除 runtime 中已无引用的 `worker-host.ts` 及其测试(能力执行早已走 executor 路径)。
  - **#2 engine-image 适配器风格统一**:删除 `adapter.ts`,入口改为导出 `IMAGE_ENGINE` 引擎描述符(`{ name, version, supportedCapabilities }`)+ 独立 `decodeImage` / `encodeImage` 原语,与 `PDF_ENGINE` / `VIDEO_ENGINE` 对齐;plugin-image 及文档同步改用新契约,stub 检测统一走 `IMAGE_ENGINE.version.includes('stub')`。
  - **#4 去重 download / formatBytes**:此前 4 套行为各异的 `formatBytes` 统一为一套(runtime 新增 `formatBytes`,带 NaN/Infinity 守卫,四级单位 + 空格),浏览器下载逻辑 `downloadBlob` 收敛至 embed-kit;ui-react / embed-image / embed-pdf / embed-video / playground 改为复用,消除重复实现(部分用户可见输出统一为带空格格式)。
  - **#8 exif 格式化归位**:`formatExifRows` / `formatShutterSpeed` 从 schema 迁至 ui-react(展示逻辑归 UI 层),schema 仅保留 `ExifData` / `RawExifData` / `ExifRow` 类型;对应单测随函数迁移,类型分层测试保留在 schema。

### Patch Changes

- Updated dependencies [[`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858), [`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858), [`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858)]:
  - @lokvis/schema@0.8.0
  - @lokvis/engine-core@0.8.0

## 0.7.1

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.7.1
  - @lokvis/engine-core@0.7.1

## 0.7.0

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.7.0
  - @lokvis/engine-core@0.7.0

## 0.6.0

### Patch Changes

- Updated dependencies [[`c57bb00`](https://github.com/lokvis/lokvis/commit/c57bb0092c6f2d7a443971e77febb0bb1fe71155), [`c57bb00`](https://github.com/lokvis/lokvis/commit/c57bb0092c6f2d7a443971e77febb0bb1fe71155), [`c57bb00`](https://github.com/lokvis/lokvis/commit/c57bb0092c6f2d7a443971e77febb0bb1fe71155)]:
  - @lokvis/schema@0.6.0
  - @lokvis/engine-core@0.6.0

## 0.5.5

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.5
  - @lokvis/engine-core@0.5.5

## 0.5.4

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.4
  - @lokvis/engine-core@0.5.4

## 0.5.3

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.3
  - @lokvis/engine-core@0.5.3

## 0.5.2

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.2
  - @lokvis/engine-core@0.5.2

## 0.5.1

### Patch Changes

- 0.5.1: video ffmpeg.wasm 浏览器引擎实装 + 补全缺失实现

  - engine-video/web: 基于 @ffmpeg/ffmpeg 的浏览器端 7 操作(compress/transcode/trim/merge/extract-audio/to-gif/screenshot)
  - plugin-video/web: 浏览器 plugin 变体(7 capability 全部真实)
  - embed-video: 默认切换到 videoToolsPluginWeb(ffmpeg.wasm 懒加载)
  - mcp-server: 装载 video/audio/ai node plugins + AI tool handlers
  - runtime: OPFS import 实装 + PDF 页数元数据提取
  - cloud-bridge: billing 降级 credits=planQuota
  - ui-react: DownloadPanel 批量下载改用 JSZip

- Updated dependencies []:
  - @lokvis/schema@0.5.1
  - @lokvis/engine-core@0.5.1

## 0.5.0

### Minor Changes

- 新增浏览器端 AVIF 编码 WASM 兜底（native-first / wasm-fallback）。无原生 AVIF 编码能力的浏览器（Chrome / Firefox）此前选择 AVIF 会静默回退 PNG，现由 libavif WASM 编码器产出真 AVIF。

  - `engine-image`:
    - 新增 `encodeSmart` 统一编码分发——原生编码器可用走 Canvas 路径；原生不可用且目标为 avif 且 wasm 兜底启用时，分发到 libavif 私有 worker 编码；否则保持既有 throw 语义。compress / convert / setBackground / transform 系列 / filter / watermark / tile / targetSize 二分共 12 处编码调用点统一接入。
    - 新增 `wasm/avif-encoder.ts`（host 桥接，模块级 worker 单例 + pending 多路复用 + transferable 零拷贝）与 `wasm/avif-worker.ts`（worker 入口，单线程 libavif 胶水，speed 分档）。
    - 新增 `configureWasmEncoders({ avifUrl, enabled })` / `resolveAvifWasmUrl()` / `wasmEncodersEnabled()`；默认 wasm URL 版本锁定到 jsdelivr（随包发布 `dist/wasm/avif.wasm`）。
    - 取消语义：abort 时 terminate worker 并以 AbortError 拒绝所有 in-flight 请求（含发起方），下次编码自动重建单例。
  - `quick-image`:
    - `useQuickConvert` 的 `formatSupport` 升级为「native || wasm」——wasm 兜底启用时 avif 预设不再被禁用；新增 `slowEncode` map 标记走 wasm 的格式。
    - Layer 2 默认 UI 新增慢速编码提示条（avif 走 wasm 时提示转换可能需要几秒钟）；新增 i18n 键 6 语言。

### Patch Changes

- 修复图片格式转换选择浏览器不支持的格式（如 AVIF）时静默产出 PNG 的问题。

  - `engine-image`: `canvasEngine.encode` 现在检测浏览器静默回退——产出 MIME 与请求不符时抛出明确错误，而非返回 PNG；修复 `detectFormatSupport` 中 `|| blob.size > 0` 的误判。
  - `quick-image`: `useQuickConvert` 新增 `formatSupport` 字段（实际编码 1×1 画布探测浏览器真实编码支持）；`setPreset` 在检测完成后拒绝不支持的预设；`QuickConvert.PresetSwitcher` 的 `renderButton` 回调新增 `disabled` 参数，默认 UI 对不支持的预设置灰禁用。

- 修复 `resize` 在 cover 模式下不裁剪的问题。

  此前横图按竖版预设（如 TikTok 9:16 的 1080×1920）缩放时，`computeTargetSize` 返回"覆盖缩放"尺寸（保持源比例，如 3413×1920），但未居中裁剪到目标框，导致输出比例与预设不符（得到 16:9 而非 9:16）。现在 cover 模式按 sharp / CSS `object-fit: cover` 语义居中裁剪到精确目标尺寸。

- Updated dependencies []:
  - @lokvis/schema@0.5.0
  - @lokvis/engine-core@0.5.0

## 0.4.2

### Patch Changes

- 自 0.4.1 以来的累积发布：

  - feat: Image Workspace Quick Actions 三层架构改造（Headless Hook + 默认 UI + Pipeline 模式）
  - feat: R1 Developer Workspace + S1 CLI 正式发布
  - feat: W21.8 CodeMirror LCP 优化、M1 SSE 生产就绪、W22.6 Playwright E2E
  - fix: 修复 Cloudflare Pages 部署失败（wrangler-action pnpm root 安装报错）

- Updated dependencies []:
  - @lokvis/schema@0.4.2
  - @lokvis/engine-core@0.4.2

## 0.4.1

### Patch Changes

- a51d57a: Task B 合并后的清理与一致性修复:

  - vitest.config.ts:移除冗余的 `packages/engine-image/src/node/**/*.ts` include
    (已被 `packages/engine-image/src/**/*.ts` 完全覆盖)
  - cli/package.json:sharp 版本从 ^0.34.5 对齐到 ^0.33.0
    (与 engine-image peerDependency ^0.33.0 一致,避免安装两个版本)
  - engine-image node-operations.test.ts:清理迁移期注释
    (废弃 milestone M2.2 引用 + "从原 engine-image-node 迁移"说明,git history 已有记录)

- Phase 2 架构治理收尾 + F1 AI 能力重构 + 统一版本到 0.4.1

  ## P2 优化项（O-8~O-15）
  - engine-image public API 收敛，仅暴露 Blob↔Blob 操作
  - workflow ID 改用 crypto.randomUUID()，添加 MAX_WORKFLOW_STEPS 校验
  - 抽取 buildCapabilityWorkflow 公共辅助消除 90% 重复
  - mcp-server 消除 4 处 .catch(() => {}) 静默吞错
  - mcp-server 删除冗余 as ToolHandler 断言
  - mcp-server 新增 zod schema 运行时校验，消除 7 处 as Parameters<typeof> 断言

  ## P3 深度重构（O-16~O-18）
  - 拆 engine-ai/structured 子路径隔离 Blob→结构化操作（ocr/caption）
  - engine-pdf getPdfInfo 边界张力注释
  - ADR-014 登记 plugin-dev 跨 Engine 层访问 ctx.runtime 例外

  ## F1 AI 能力重构
  - engine-ai 从 Adapter 接口迁移到独立纯函数模式
  - 新增 AiCloudCaller 接口注入模式（不依赖 cloud-bridge）
  - 新增 ai.diagnose-error 能力
  - cloud-bridge 新增 CloudAiClient + ai-client 模块

  ## engine-audio/engine-video 重构
  - 从 Adapter 接口迁移到独立纯函数模式
  - 新增 Node 端 ffmpeg 实装

  ## SDK
  - 新增 plan 维度（free/pro/cloud_pro/enterprise），isPro 为派生字段

  ## 版本统一
  - 配置 changeset fixed 模式，所有 @lokvis/* 包统一版本号
  - 本次释放统一到 0.4.1

- a51d57a: W21.4: Worker 通信 Transferable 优化,实现 Blob 零拷贝传递。

  Worker → 主线程的 Blob 数据此前走结构化克隆(完整拷贝字节),
  大图(>1MB)每张拷贝一次,批量场景峰值内存翻倍。

  变更:
  - 新增 BlobRef 协议类型(runtime/worker-protocol.ts + engine-image/worker-adapter.ts
    同步声明,遵循 WorkerCancel 先例):Blob 拆为 { kind, meta, buffer }
  - createImageWorkerHandler 返回 { response, transfer },Blob 结果
    抽 ArrayBuffer 放入 transfer list
  - startImageWorker 的 postMessage 补 transfer list 参数
  - WorkerHost.handleMessage 收到 response 后用 unwrapBlobRef() 重组 Blob
  - FakeScope 测试桩扩展:记录 transfer list
  - 新增 1 个测试:非 Blob 结果 transfer 为空数组

  注:Worker 管线尚未在生产路径启用(当前 plugin-image 直接调主线程 canvasEngine),
  此优化为 Worker-isolated runtime 上线做好准备。Host 侧已支持 transfer
  (WorkerHost.request 的 options.transfer),调用方在 Worker 上线时补请求路径即可。

- Updated dependencies [a51d57a]
- Updated dependencies
- Updated dependencies [a51d57a]
- Updated dependencies [58e7e7f]
  - @lokvis/schema@0.4.1
  - @lokvis/engine-core@0.4.1

## 0.2.0

### Minor Changes

- 2aebedb: - 实现 `image.filter` 能力:基于 Canvas 2D `ctx.filter` CSS 语法,使用 `Record<FilterPreset, ...>` 保证穷尽性,`preset` 缺失/未知分别抛出区分性错误
  - 新增 `FilterPreset` / `FilterParams` 类型
  - `canvasEngine.supportedCapabilities` 同步追加 `image.filter`
  - Watermark:实现 tile 模式网格渲染(文本与图像),fetch 校验 `resp.ok`

### Patch Changes

- Updated dependencies [2aebedb]
- Updated dependencies [e95976e]
- Updated dependencies [bb5706c]
  - @lokvis/schema@0.2.0

## 0.2.0-beta.0

### Minor Changes

- - 实现 `image.filter` 能力:基于 Canvas 2D `ctx.filter` CSS 语法,使用 `Record<FilterPreset, ...>` 保证穷尽性,`preset` 缺失/未知分别抛出区分性错误
  - 新增 `FilterPreset` / `FilterParams` 类型
  - `canvasEngine.supportedCapabilities` 同步追加 `image.filter`
  - Watermark:实现 tile 模式网格渲染(文本与图像),fetch 校验 `resp.ok`

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.2.0-beta.0
