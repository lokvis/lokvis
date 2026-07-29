# @lokvis/plugin-audio

## 0.8.1

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.8.1
  - @lokvis/capability@0.8.1
  - @lokvis/engine-audio@0.8.1
  - @lokvis/plugin-sdk@0.8.1

## 0.8.0

### Patch Changes

- [`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858) Thanks [@xiongyy](https://github.com/xiongyy)! - 能力名收敛为单一事实源(架构评审 #7)。

  - `@lokvis/schema` 现导出由 codegen 从 manifest 生成的 `BuiltinCapabilityName` 字面量联合类型与 `BUILTIN_CAPABILITY_NAMES` 常量数组(此前生成但从未接入公共导出)。
  - 删除 `@lokvis/capability` names.ts 中长期与 manifest 漂移、且全仓无消费者的手写 `CAPABILITY_NAMES` 常量对象与 `CapabilityNameKey` 类型;保留 `CAPABILITY_DOMAINS` / `domainOf` / `actionOf` / `sameDomain`。
  - plugin-image/pdf/video/audio 的操作绑定项 `capability` 字段类型由 `string` 收紧为 `BuiltinCapabilityName`,使插件裸字符串在编译期即与 manifest 单一来源校验(拼写/漂移会直接报错)。

- [`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858) Thanks [@xiongyy](https://github.com/xiongyy)! - 修复 stub 检测契约漂移(架构评审 #8)。

  engine-video / engine-audio / engine-pdf 各入口现导出带 `version` 的引擎描述符(`VIDEO_ENGINE` / `AUDIO_ENGINE` / `PDF_ENGINE`),遵循 AGENTS.md「version 含 'stub' 即占位实现」约定:默认(浏览器)入口 version 含 `-stub`,`node` / `web` 真实入口不含。

  plugin-video / plugin-audio / plugin-pdf 恢复 `version.includes('stub')` 单点推导:

  - 删除各 plugin 中硬编码的 `isStub = true` / `isStub: false`(此前与引擎实际能力脱钩),改为从对应引擎描述符推导。
  - 引擎名(`BROWSER_ENGINE` / `PLUGIN_ENGINE_NODE` / `PLUGIN_ENGINE_WEB` / `PLUGIN_ENGINE_PDF`)统一取自描述符 `name` 字段,消除字面量重复。
  - plugin-pdf 保留 `REAL_STUB_CAPABILITIES`(ocr/sign 按能力叠加),最终 `isStub = engine 级 stub || 能力级未实装`,与 engine-image 的 `canvasEngine.version` 推导模式对齐。

- [`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858) Thanks [@xiongyy](https://github.com/xiongyy)! - 消除 plugin-pdf/video/audio node/web 实现重复

  **@lokvis/plugin-pdf**
  - 新增 `real-plugin.ts`:抽取 Node/Web 共享的真实实现骨架(8 capability 绑定 + PDF 页数 MetadataReader + info 日志),经 `buildRealPdfPlugin(options)` 一次性构造
  - `node-plugin.ts` / `web-plugin.ts` 收敛为薄封装,仅注入环境相关文案(stub 错误短语 + 日志引擎描述),公开导出保持不变
  - `operations.ts` 的 `derivePdfMetadata` 改为导出,供共享骨架复用

  **@lokvis/plugin-video / @lokvis/plugin-audio**
  - `deriveVideoMetadata` / `deriveAudioMetadata` 改由各自 `operations.ts` 导出,node/web plugin 删除本地副本改为 import(消除三处重复定义)

- Updated dependencies [[`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858), [`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858), [`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858), [`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858)]:
  - @lokvis/schema@0.8.0
  - @lokvis/capability@0.8.0
  - @lokvis/engine-audio@0.8.0
  - @lokvis/plugin-sdk@0.8.0

## 0.7.1

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.7.1
  - @lokvis/capability@0.7.1
  - @lokvis/engine-audio@0.7.1
  - @lokvis/plugin-sdk@0.7.1

## 0.7.0

### Patch Changes

- Updated dependencies [[`d594ba8`](https://github.com/lokvis/lokvis/commit/d594ba8f0567b87e3bd03a73908f35a251b612fe)]:
  - @lokvis/capability@0.7.0
  - @lokvis/schema@0.7.0
  - @lokvis/engine-audio@0.7.0
  - @lokvis/plugin-sdk@0.7.0

## 0.6.0

### Patch Changes

- Updated dependencies [[`c57bb00`](https://github.com/lokvis/lokvis/commit/c57bb0092c6f2d7a443971e77febb0bb1fe71155), [`c57bb00`](https://github.com/lokvis/lokvis/commit/c57bb0092c6f2d7a443971e77febb0bb1fe71155), [`c57bb00`](https://github.com/lokvis/lokvis/commit/c57bb0092c6f2d7a443971e77febb0bb1fe71155)]:
  - @lokvis/schema@0.6.0
  - @lokvis/capability@0.6.0
  - @lokvis/engine-audio@0.6.0
  - @lokvis/plugin-sdk@0.6.0

## 0.5.5

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.5
  - @lokvis/capability@0.5.5
  - @lokvis/engine-audio@0.5.5
  - @lokvis/plugin-sdk@0.5.5

## 0.5.4

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.4
  - @lokvis/capability@0.5.4
  - @lokvis/engine-audio@0.5.4
  - @lokvis/plugin-sdk@0.5.4

## 0.5.3

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.3
  - @lokvis/capability@0.5.3
  - @lokvis/engine-audio@0.5.3
  - @lokvis/plugin-sdk@0.5.3

## 0.5.2

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.2
  - @lokvis/capability@0.5.2
  - @lokvis/engine-audio@0.5.2
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
  - @lokvis/engine-audio@0.5.1
  - @lokvis/plugin-sdk@0.5.1

## 0.5.0

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.0
  - @lokvis/capability@0.5.0
  - @lokvis/engine-audio@0.5.0
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
  - @lokvis/engine-audio@0.4.2
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
  - @lokvis/engine-audio@0.4.1
  - @lokvis/plugin-sdk@0.4.1
