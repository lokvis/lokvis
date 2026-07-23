# @lokvis/cli

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
  - @lokvis/sdk@0.4.2
  - @lokvis/plugin-image@0.4.2

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

- a51d57a: 移除 4 处冗余依赖声明(Task F):

  - engine-core:移除 @lokvis/schema(src 未导入,仅注释提及)
  - ui-core:移除 @lokvis/schema(src 无任何 @lokvis import)
  - cli:移除 @lokvis/runtime(src 经 @lokvis/sdk 传递使用,无直接 import)
  - engine-image-node:随包删除一起消失(问题 B 已处理)

  避免假依赖信号(消费方/审计工具误以为这些包依赖 schema/runtime)。

- Updated dependencies [a51d57a]
- Updated dependencies
- Updated dependencies [a51d57a]
- Updated dependencies [1567a33]
- Updated dependencies [d1179ab]
- Updated dependencies [58e7e7f]
  - @lokvis/schema@0.4.1
  - @lokvis/capability@0.4.1
  - @lokvis/sdk@0.4.1
  - @lokvis/plugin-image@0.4.1

## 0.1.1

### Patch Changes

- 2aebedb: - `run` 命令使用 `new File([blob], name, { type })` 替代不可靠的 `{ ...blob, name } as unknown as File` 强转
- Updated dependencies [1ffd8c1]
- Updated dependencies [2aebedb]
- Updated dependencies [0bef2e0]
- Updated dependencies [2aebedb]
- Updated dependencies [2aebedb]
- Updated dependencies [980eafd]
- Updated dependencies [e95976e]
- Updated dependencies [bb5706c]
- Updated dependencies [191877e]
  - @lokvis/runtime@0.2.0
  - @lokvis/capability@0.2.0
  - @lokvis/sdk@0.2.0
  - @lokvis/schema@0.2.0

## 0.1.1-beta.0

### Patch Changes

- - `run` 命令使用 `new File([blob], name, { type })` 替代不可靠的 `{ ...blob, name } as unknown as File` 强转

- Updated dependencies []:
  - @lokvis/capability@0.2.0-beta.0
  - @lokvis/runtime@0.2.0-beta.0
  - @lokvis/schema@0.2.0-beta.0
  - @lokvis/sdk@0.1.1-beta.0
