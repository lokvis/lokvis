# @lokvis/ui-core

## 0.6.0

## 0.5.5

## 0.5.4

## 0.5.3

## 0.5.2

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

## 0.5.0

## 0.4.2

### Patch Changes

- 自 0.4.1 以来的累积发布：

  - feat: Image Workspace Quick Actions 三层架构改造（Headless Hook + 默认 UI + Pipeline 模式）
  - feat: R1 Developer Workspace + S1 CLI 正式发布
  - feat: W21.8 CodeMirror LCP 优化、M1 SSE 生产就绪、W22.6 Playwright E2E
  - fix: 修复 Cloudflare Pages 部署失败（wrangler-action pnpm root 安装报错）

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

- a51d57a: 移除 4 处冗余依赖声明(Task F):

  - engine-core:移除 @lokvis/schema(src 未导入,仅注释提及)
  - ui-core:移除 @lokvis/schema(src 无任何 @lokvis import)
  - cli:移除 @lokvis/runtime(src 经 @lokvis/sdk 传递使用,无直接 import)
  - engine-image-node:随包删除一起消失(问题 B 已处理)

  避免假依赖信号(消费方/审计工具误以为这些包依赖 schema/runtime)。

## 0.2.0

### Minor Changes

- 980eafd: 新增 6 个基础组件 + 设计 Token 体系(W4.4 + W4.5)

  - 新组件:Slider / Toggle / Select / Tabs / Dialog / Tooltip
  - `styles/tokens.css`:`--lokvis-*` CSS 变量语义层(表面/前景/边框/主色/语义色/圆角/阴影/动效/字体)
  - 暗色模式:`.dark` 类 + `@media (prefers-color-scheme: dark)` 双触发
  - Tailwind v4 `@theme` 映射说明(消费方可在 CSS 中把变量映射为 Tailwind 颜色)
  - 构建产物 `dist/styles.css`(package.json 已导出 `./styles.css`)
  - 25 个组件单测(@testing-library/react + jsdom,覆盖受控/非受控/键盘/无障碍)

### Patch Changes

- 0bef2e0: 修复 code review 发现的 7 个问题(跨包第三轮)

  - `ui-core` Slider:非受控模式下 `showValue` 显示值不随拖动更新,改用 internal state 跟踪当前值
  - `ui-core` Tabs:`useCallback` 依赖 `items`(数组字面量,每次渲染新引用)导致 memo 失效,改为普通函数
  - `ui-core` Dialog:模块级 `bodyOverflowLockCount` / `bodyOverflowPrev` 在 Vite HMR 重新执行模块时不重置,可能导致 body 永久锁死;添加 `import.meta.hot?.dispose` 清理回调
  - `sdk` CapabilityNotRegisteredError:构造函数不接受 `cause` 参数,`fromLokvisError` message 匹配分支丢失原始错误链路;补充 `cause?` 参数并传入
  - `sdk` fromLokvisError:`WorkflowNodeError('', '', msg, value)` 用空 nodeId 不利于定位失败节点,改为从 message 提取 nodeId
  - `docs` sdk.md:示例 `fromLokvisError` 总是返回 LokvisError,`instanceof LokvisError` 检查冗余且 else 分支为死代码;`err.guide` 需 `instanceof DegradationRejectedError` 窄化类型才能访问
  - `examples` custom-workspace:删除 `fromLokvisError` 后无法触达的 else 死代码分支

- Updated dependencies [2aebedb]
- Updated dependencies [e95976e]
- Updated dependencies [bb5706c]
  - @lokvis/schema@0.2.0

## 0.1.1-beta.0

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.2.0-beta.0
