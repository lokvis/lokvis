# @lokvis/engine-image

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
