# @lokvis/plugin-pdf

## 0.5.5

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.5
  - @lokvis/capability@0.5.5
  - @lokvis/engine-pdf@0.5.5
  - @lokvis/plugin-sdk@0.5.5

## 0.5.4

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.4
  - @lokvis/capability@0.5.4
  - @lokvis/engine-pdf@0.5.4
  - @lokvis/plugin-sdk@0.5.4

## 0.5.3

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.3
  - @lokvis/capability@0.5.3
  - @lokvis/engine-pdf@0.5.3
  - @lokvis/plugin-sdk@0.5.3

## 0.5.2

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.2
  - @lokvis/capability@0.5.2
  - @lokvis/engine-pdf@0.5.2
  - @lokvis/plugin-sdk@0.5.2

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
  - @lokvis/capability@0.5.1
  - @lokvis/engine-pdf@0.5.1
  - @lokvis/plugin-sdk@0.5.1

## 0.5.0

### Minor Changes

- feat: embed-* 三层集成包 + plugin-pdf 浏览器端激活

  - @lokvis/embed-image: 由 quick-image 重命名，hooks 统一为 useImageCompress/useImageResize/useImageConvert/useImageFavicon/useImageWatermark/useImageCrop
  - @lokvis/embed-pdf: 新增，5 个 PDF hooks（usePdfCompress/Merge/Split/Rotate/Watermark），内部经 plugin-pdf/web 在浏览器端运行 pdf-lib
  - @lokvis/embed-video: 新增，7 个 Video hooks（useVideoCompress/Transcode/Trim/Merge/ToGif/Screenshot/ExtractAudio），引擎层 stub，plugins 选项支持注入 remote backend
  - @lokvis/plugin-pdf: 新增 "./web" 子路径导出（pdfToolsPluginWeb），浏览器端注册 5 个真实 PDF 能力

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.0
  - @lokvis/capability@0.5.0
  - @lokvis/engine-pdf@0.5.0
  - @lokvis/plugin-sdk@0.5.0

## 0.4.2

### Patch Changes

- 自 0.4.1 以来的累积发布：

  - feat: Image Workspace Quick Actions 三层架构改造（Headless Hook + 默认 UI + Pipeline 模式）
  - feat: R1 Developer Workspace + S1 CLI 正式发布
  - feat: W21.8 CodeMirror LCP 优化、M1 SSE 生产就绪、W22.6 Playwright E2E
  - fix: 修复 Cloudflare Pages 部署失败（wrangler-action pnpm root 安装报错）

- Updated dependencies []:
  - @lokvis/schema@0.4.2
  - @lokvis/capability@0.4.2
  - @lokvis/engine-pdf@0.4.2
  - @lokvis/plugin-sdk@0.4.2

## 0.4.1

### Patch Changes

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

- Updated dependencies [a51d57a]
- Updated dependencies
- Updated dependencies [58e7e7f]
- Updated dependencies [a96bddb]
  - @lokvis/schema@0.4.1
  - @lokvis/capability@0.4.1
  - @lokvis/engine-pdf@0.4.1
  - @lokvis/plugin-sdk@0.4.1

## 0.2.0

### Minor Changes

- 1ffd8c1: 架构清理:消除 plugin-* 重复代码 + 统一 worker-host transport 清理 + 修复 exif-reader 手动剔除字段 patch

  - **plugin-sdk**: 新增 `createBlobCapabilityImpl` 工厂 + `defaultDeriveOutputMetadata` + `BlobCapabilityOptions`。封装"取 blob → 调 operation → 派生 metadata → createAsset → 进度/取消"五步样板,消除 plugin-image / plugin-video / plugin-pdf(single kind)三份近乎逐字相同的 `wrapAsImplementation` + `deriveOutputMetadata`
  - **plugin-image**: 删除 `wrapAsImplementation` + `deriveOutputMetadata`(33 行),改用 `createBlobCapabilityImpl`
  - **plugin-video**: 同上,删除重复代码改用工厂
  - **plugin-pdf**: single kind 改用工厂;merge/split 形态不同保留自定义包装。`derivePdfMetadata` 改为返回 `(source, outBlob) => AssetMetadata` 签名以匹配工厂接口
  - **runtime**: `worker-host.ts` 的 `dispose()` 和 `spawn()` catch 块改为调用 `teardownTransport()`,消除三处重复的 `offMessage/offError/terminate/null` 清理样板
  - **plugin-image/exif-reader**: 删除"先构造 RawExifData 再解构删 raw"的 patch(`const { raw: _raw, ...exifData } = data; void _raw`),改为直接构造 `ExifData`。RawExifData 类型保留在 schema 供未来调试场景使用

  验证:lint 0 errors、typecheck 全绿、test 623/623 通过

- 2aebedb: ## @lokvis/engine-pdf / @lokvis/engine-video

  - 内部对齐 stub 检测依赖

  ## @lokvis/plugin-pdf / @lokvis/plugin-video
  - 新增 stub 自动检测:若底层 engine 不可用则 `status: 'stub'`,使 `CapabilityRegistry.resolve()` 不再解析到占位实现

### Patch Changes

- Updated dependencies [1ffd8c1]
- Updated dependencies [2aebedb]
- Updated dependencies [2aebedb]
- Updated dependencies [2aebedb]
- Updated dependencies [e95976e]
- Updated dependencies [bb5706c]
- Updated dependencies [191877e]
  - @lokvis/plugin-sdk@0.2.0
  - @lokvis/capability@0.2.0
  - @lokvis/engine-pdf@0.2.0
  - @lokvis/schema@0.2.0

## 0.2.0-beta.0

### Minor Changes

- ## @lokvis/engine-pdf / @lokvis/engine-video
  - 内部对齐 stub 检测依赖

  ## @lokvis/plugin-pdf / @lokvis/plugin-video
  - 新增 stub 自动检测:若底层 engine 不可用则 `status: 'stub'`,使 `CapabilityRegistry.resolve()` 不再解析到占位实现

### Patch Changes

- Updated dependencies []:
  - @lokvis/capability@0.2.0-beta.0
  - @lokvis/engine-pdf@0.2.0-beta.0
  - @lokvis/schema@0.2.0-beta.0
  - @lokvis/plugin-sdk@0.1.1-beta.0
