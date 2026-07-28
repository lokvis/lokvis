# @lokvis/mcp-server

## 0.7.0

### Minor Changes

- [`d594ba8`](https://github.com/lokvis/lokvis/commit/d594ba8f0567b87e3bd03a73908f35a251b612fe) Thanks [@xiongyy](https://github.com/xiongyy)! - 新增 PDF 添加页码能力 `pdf.add-page-numbers`(全链路):

  - capability:manifest 新增 add-page-numbers action(position/format/startFrom/fontSize/color)+ codegen 生成 `PDF_ADD_PAGE_NUMBERS`
  - engine-pdf:新增 `addPageNumbers` operation(pdf-lib,Helvetica,`{n}`/`{total}` 占位符,4 个位置)
  - plugin-pdf:注册 `pdf.add-page-numbers`(web/node 真实实现,默认入口 stub,共 8 个 capability:6 真实 + 2 stub)
  - embed-pdf:新增 `usePdfPageNumbers` hook(`PDF_PAGE_NUMBER_POSITIONS` / `DEFAULT_PAGE_NUMBER_FORMAT`,position/format/startFrom 变更自动重跑)
  - mcp-server:新增 `lokvis_pdf_add_page_numbers` tool(经 runtime.run 走完整 capability 系统)

### Patch Changes

- Updated dependencies [[`d594ba8`](https://github.com/lokvis/lokvis/commit/d594ba8f0567b87e3bd03a73908f35a251b612fe)]:
  - @lokvis/capability@0.7.0
  - @lokvis/plugin-pdf@0.7.0
  - @lokvis/plugin-ai@0.7.0
  - @lokvis/plugin-audio@0.7.0
  - @lokvis/plugin-image@0.7.0
  - @lokvis/plugin-video@0.7.0
  - @lokvis/schema@0.7.0
  - @lokvis/workflow@0.7.0
  - @lokvis/runtime@0.7.0
  - @lokvis/sdk@0.7.0
  - @lokvis/cloud-bridge@0.7.0

## 0.6.0

### Patch Changes

- Updated dependencies [[`c57bb00`](https://github.com/lokvis/lokvis/commit/c57bb0092c6f2d7a443971e77febb0bb1fe71155), [`c57bb00`](https://github.com/lokvis/lokvis/commit/c57bb0092c6f2d7a443971e77febb0bb1fe71155), [`c57bb00`](https://github.com/lokvis/lokvis/commit/c57bb0092c6f2d7a443971e77febb0bb1fe71155)]:
  - @lokvis/schema@0.6.0
  - @lokvis/runtime@0.6.0
  - @lokvis/capability@0.6.0
  - @lokvis/plugin-ai@0.6.0
  - @lokvis/plugin-audio@0.6.0
  - @lokvis/plugin-image@0.6.0
  - @lokvis/plugin-pdf@0.6.0
  - @lokvis/plugin-video@0.6.0
  - @lokvis/sdk@0.6.0
  - @lokvis/workflow@0.6.0
  - @lokvis/cloud-bridge@0.6.0

## 0.5.5

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.5
  - @lokvis/capability@0.5.5
  - @lokvis/workflow@0.5.5
  - @lokvis/runtime@0.5.5
  - @lokvis/sdk@0.5.5
  - @lokvis/cloud-bridge@0.5.5
  - @lokvis/plugin-image@0.5.5
  - @lokvis/plugin-pdf@0.5.5
  - @lokvis/plugin-video@0.5.5
  - @lokvis/plugin-audio@0.5.5
  - @lokvis/plugin-ai@0.5.5

## 0.5.4

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.4
  - @lokvis/capability@0.5.4
  - @lokvis/workflow@0.5.4
  - @lokvis/runtime@0.5.4
  - @lokvis/sdk@0.5.4
  - @lokvis/cloud-bridge@0.5.4
  - @lokvis/plugin-image@0.5.4
  - @lokvis/plugin-pdf@0.5.4
  - @lokvis/plugin-video@0.5.4
  - @lokvis/plugin-audio@0.5.4
  - @lokvis/plugin-ai@0.5.4

## 0.5.3

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.3
  - @lokvis/capability@0.5.3
  - @lokvis/workflow@0.5.3
  - @lokvis/runtime@0.5.3
  - @lokvis/sdk@0.5.3
  - @lokvis/cloud-bridge@0.5.3
  - @lokvis/plugin-image@0.5.3
  - @lokvis/plugin-pdf@0.5.3
  - @lokvis/plugin-video@0.5.3
  - @lokvis/plugin-audio@0.5.3
  - @lokvis/plugin-ai@0.5.3

## 0.5.2

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.2
  - @lokvis/capability@0.5.2
  - @lokvis/workflow@0.5.2
  - @lokvis/runtime@0.5.2
  - @lokvis/sdk@0.5.2
  - @lokvis/cloud-bridge@0.5.2
  - @lokvis/plugin-image@0.5.2
  - @lokvis/plugin-pdf@0.5.2
  - @lokvis/plugin-video@0.5.2
  - @lokvis/plugin-audio@0.5.2
  - @lokvis/plugin-ai@0.5.2

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
  - @lokvis/workflow@0.5.1
  - @lokvis/runtime@0.5.1
  - @lokvis/sdk@0.5.1
  - @lokvis/cloud-bridge@0.5.1
  - @lokvis/plugin-image@0.5.1
  - @lokvis/plugin-pdf@0.5.1
  - @lokvis/plugin-video@0.5.1
  - @lokvis/plugin-audio@0.5.1
  - @lokvis/plugin-ai@0.5.1

## 0.5.0

### Patch Changes

- Updated dependencies []:
  - @lokvis/plugin-pdf@0.5.0
  - @lokvis/plugin-image@0.5.0
  - @lokvis/schema@0.5.0
  - @lokvis/capability@0.5.0
  - @lokvis/workflow@0.5.0
  - @lokvis/runtime@0.5.0
  - @lokvis/sdk@0.5.0
  - @lokvis/cloud-bridge@0.5.0

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
  - @lokvis/workflow@0.4.2
  - @lokvis/runtime@0.4.2
  - @lokvis/sdk@0.4.2
  - @lokvis/cloud-bridge@0.4.2
  - @lokvis/plugin-image@0.4.2
  - @lokvis/plugin-pdf@0.4.2

## 0.4.1

### Patch Changes

- a51d57a: `createLokvisMcpServer` 新增可选 `cloud?: CloudConfig` 参数,真正落地 cloud-bridge 注入。

  修复 Task A 验收缺口:cloud-bridge 包已抽取为独立包,但 `LokvisMcpOptions` 未含 `cloud` 字段,
  `cli.ts` 创建的 `cloudConfig` 未传入 `createLokvisMcpServer`。

  变更:
  - `LokvisMcpOptions` 新增 `cloud?: CloudConfig` 字段
  - `createLokvisMcpServer` 在 cloud 提供时创建 `McpAuthenticator` + `McpBilling` 并返回
  - `cli.ts` 改为 `createLokvisMcpServer({ cloud: cloudConfig })`,使用返回的 `authenticator` 做启动时 API Key 验证
  - 补 env 覆盖文档(`LOKVIS_UPGRADE_URL` / `LOKVIS_PLAN_QUOTAS_JSON` / `LOKVIS_PRICE_PER_CALL_CENTS`)

  不传 `cloud` 时行为不变:仅本地 tool 可用,cloud AI tool 不可用。

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
- Updated dependencies [a51d57a]
- Updated dependencies
- Updated dependencies [a51d57a]
- Updated dependencies [1567a33]
- Updated dependencies [d1179ab]
- Updated dependencies [58e7e7f]
- Updated dependencies [a51d57a]
  - @lokvis/cloud-bridge@0.4.1
  - @lokvis/schema@0.4.1
  - @lokvis/capability@0.4.1
  - @lokvis/workflow@0.4.1
  - @lokvis/runtime@0.4.1
  - @lokvis/sdk@0.4.1
  - @lokvis/plugin-image@0.4.1
  - @lokvis/plugin-pdf@0.4.1

## 0.1.1

### Patch Changes

- Updated dependencies [0bef2e0]
- Updated dependencies [2aebedb]
- Updated dependencies [980eafd]
- Updated dependencies [e95976e]
- Updated dependencies [bb5706c]
  - @lokvis/sdk@0.2.0
  - @lokvis/schema@0.2.0

## 0.1.1-beta.0

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.2.0-beta.0
  - @lokvis/sdk@0.1.1-beta.0
