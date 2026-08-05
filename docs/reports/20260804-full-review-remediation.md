# 2026-08-04 全项目实现审查修复方案

- 日期：2026-08-04
- 来源：全仓实现审查（架构合规 / workaround / 重复代码 / 测试质量 / 文档一致性，5 路并行深查）
- 范围：lokvis-open（30 包 + apps）+ lokvis-cloud（4 apps + 15 packages）
- 总体结论：六层架构零违规、生产代码零 `as any`、fetch ok 检查（open 仓 8/8）等核心纪律合规；问题集中在文档失真、playground 平行宇宙、重复抽象收敛不彻底

> 任务 ID：`FO-*` = lokvis-open 侧；`FC-*` = lokvis-cloud 侧（对应 `lokvis-cloud/docs/tasks/20260804-full-review-remediation.md`）。
> 本文档任务完成后按 `technical-debt.md` 维护规则逐条删除/销项。

---

## 批次总览

| 批次 | 主题 | 任务 | 预估规模 |
|---|---|---|---|
| B1 | 生产正确性（P0，先行） | FO-01/02/03、FC-01~06 | 小，2~3 天 |
| B2 | 架构与 workaround 清理（P1） | FO-04~10、FC-07~11 | 中，3~5 天 |
| B3 | 重复代码收敛（P1/P2） | FO-11~19、FC-12~16 | 大，1~2 周 |
| B4 | 文档对账（P0/P1） | FO-20~24 | 中，2~3 天 |
| B5 | 测试补齐（P1/P2） | FO-25~31、FC-17~18 | 中，3~5 天 |
| B6 | 点状清理（P3，可随手做） | FO-32~40 | 小，见缝插针 |

---

## B1 生产正确性（P0）

### FO-01 useCustomPresets 双实现漂移（存储 key 不一致）

- **位置**：`apps/playground/src/components/toolkit/useCustomPresets.ts:18`（`lokvis.custom-presets`）vs `packages/ui-react/src/hooks/useCustomPresets.ts:33`（`lokvis.customPresets`）
- **问题**：playground 已依赖 `@lokvis/ui-react` 却自带一份 180 行副本，两份 localStorage key 不同、数据互不可见；ui-react 版多出 `custom.` id 前缀、`LokvisStorageError`、`FREE_PLAN_LIMITS` 集成，行为已分叉
- **方案**：
  1. playground 删除本地副本，改 `import { useCustomPresets } from '@lokvis/ui-react'`（若 ui-react 未导出该 hook，先在 index 导出）
  2. 写一次性迁移：读取旧 key `lokvis.custom-presets` 的数据合并进新 key 后删除旧 key（playground 启动时执行一次即可，带 try/catch）
  3. 若保留双份（不推荐），至少统一 key 并加跨端一致性测试
- **验收**：playground 与 Workspace 共享同一份预设数据；`grep -r "lokvis.custom-presets"` 仅剩迁移代码

### FO-02 plugin-permissions 网络沙箱登记

- **位置**：`packages/runtime/src/plugin-permissions.ts:167-225`
- **问题**：runtime 直接 monkey-patch `globalThis.fetch/XHR/WebSocket/EventSource` 实现 network:none 守卫，注释充分但未登记到 `docs/technical-debt.md`（2026-07-15 审计报告曾指出）
- **方案**：二选一——
  - A（推荐）：在 technical-debt.md 登记为"有意设计 + 已知边界"（best-effort、setTimeout 逃逸有意为之），记录豁免理由
  - B：改为经 browser-adapter 注入的 fetch 包装（改动面大，不建议本批次做）
- **验收**：technical-debt.md 新增条目，指向 plugin-permissions.ts 头部设计注释

### FO-03 engine-video / engine-audio 浏览器 stub 缺 supportedCapabilities

- **位置**：`packages/engine-video/src/types.ts:24-29`、`packages/engine-audio/src/types.ts:21-26`（描述符类型无该字段）；`engine-video/src/index.ts:43-46`、`engine-audio/src/index.ts:39-42`（stub 实例）
- **问题**：违反 AGENTS.md「stub 三要素」第 3 条
- **方案**：两个描述符类型加 `supportedCapabilities: string[]` 字段；stub 实例列出计划能力（对照各自 operations.ts 的操作清单）；web/node 真实入口同步填真实能力列表；plugin 侧若有消费可顺带断言
- **验收**：`pnpm typecheck && pnpm test` 通过；两包 plugin.test.ts 可增加 supportedCapabilities 断言

### FC-01 配额/权益单一事实源（高）

- **位置**：`apps/api/src/routes/users.ts:53-91`（PLAN_ENTITLEMENTS）vs `apps/dashboard/src/lib/constants.ts:33-145`
- **问题**：双源且数值冲突——API 执行侧 pro `workflows: Infinity`，dashboard 展示侧 `workflowSlots: 20`（ADR-009 定义为 20）；cloud_pro 一侧 100 一侧 unlimited；dashboard free `apiCallsPerDay: 100` 在 API 侧无执行项
- **方案**：
  1. 以 ADR-009 为准裁定每个配额的正确数值（需产品确认，先列冲突清单）
  2. 权益常量下沉到 packages 层（可放 `packages/billing/src/entitlements.ts` 或新建 `packages/entitlements`），含类型 + 数值 + 单元测试
  3. API 侧 `/users/me/entitlements` 直接返回该常量；dashboard 删除本地 PLANS 配额副本，改消费 API 返回值（首屏可用类型级常量兜底，但展示以 API 为准）
- **验收**：全仓 grep 配额数字（20/100/Infinity 等）仅出现在单一源；新增 entitlements 单测覆盖每档 plan；e2e 验证 dashboard 展示 = API 返回

### FC-02 ai-service fetch 缺 ok 检查（中）

- **位置**：`packages/ai-service/src/index.ts:283-299, 303-324`
- **问题**：OpenAI/Anthropic 4xx/5xx 时解析错误体后静默返回 `''`，调用方无法区分"空输出"与"调用失败"；Phase 2 启用地雷
- **方案**：加 `resp.ok` 检查，失败抛 `ApiError(502, ...)` 并携带 provider 错误体摘要；补单元测试（mock fetch 返回 429/500/空 body）
- **验收**：失败路径有测试；不再返回空字符串

### FC-03 OAuth GitHub fetch 缺 ok 检查（中）

- **位置**：`packages/auth/src/oauth.ts:81-90, 95-102`
- **问题**：GitHub `/user`、`/user/emails` 无 ok 检查，限流 403/5xx 时登录报 500 而非语义化错误
- **方案**：检查 ok，失败抛 `ApiError(SERVICE_UNAVAILABLE/502)`；补测试
- **验收**：GitHub 侧故障时 API 返回 502 + 明确 message

### FC-04 Turnstile 漏配静默绕过（中）

- **位置**：`apps/api/src/middleware/turnstile.ts:87-90`
- **问题**：`TURNSTILE_SECRET_KEY` 未配置时静默跳过全部人机校验，生产漏配无声失效
- **方案**：production 环境（`env=prod` 或 ENVIRONMENT 判断）未配置 secret 时启动即抛错；dev/preview 保持跳过但 `console.warn` 一次
- **验收**：wrangler prod 部署缺 secret 时 deploy 后首个请求/启动检查失败；补测试

### FC-05 CI preview smoke check 空壳（中）

- **位置**：`.github/workflows/deploy-api.yml:119-126`
- **问题**：smoke check 只 echo + `TODO(W14.1)` + `continue-on-error: true`，本地已有 `test:smoke` 未接
- **方案**：接入 `curl -f https://<preview>.workers.dev/health`（或 `pnpm test:smoke` 指向 preview URL），移除 `continue-on-error`
- **验收**：故意破坏 health 端点后 CI 红

### FC-06 dashboard 价格展示未接 pricing API（中）

- **位置**：`apps/dashboard/src/lib/constants.ts:39,56,75,98`（2900/6900/9900/900 手工复制自 `packages/billing/src/sku-map.ts` PRICING）；`BillingPage.tsx:143,833` 用本地 PLANS；已定义的 `fetchPricing()`（`api/billing.ts:94`）未被使用
- **问题**：PPP 区域折扣与调价不会反映到展示；itemId 裸 string 无类型绑定
- **方案**：BillingPage 改为加载 `GET /billing/pricing`（fetchPricing 已存在），本地 PLANS 仅保留展示文案（名称/特性列表），价格字段全部来自 API；itemId 用 `import type { Sku }` 绑定
- **验收**：后端调价后 dashboard 展示同步；PPP header 命中时显示折扣价

---

## B2 架构与 workaround 清理（P1）

### FO-04 playground 并发池迁移 runtime.batch

- **位置**：`apps/playground/src/components/tools/BatchQueue.tsx:34,232`、`WatermarkBatchTool.tsx:17,51,265`
- **问题**：两份手写并发池（`CONCURRENCY=4` 硬编码）绕过 `runtime.batch`（BatchProcessor 有并发控制/进度/重试/Pro 16 槽位）；Pro 模式并发仍锁死 4；免费上限靠组件自查而非 runtime 强制
- **方案**：
  1. BatchQueue 改调 `runtime.batch.enqueue()`，UI 状态从 batch 事件订阅获取
  2. WatermarkBatchTool 复用迁移后的 BatchQueue（消除第二份副本）
  3. 若 UI 必须保留逐文件状态机，把调度逻辑抽成共享 hook 且并发值取 `FREE_CONCURRENCY` 常量
- **验收**：playground 批量任务在 Pro 模式下并发 > 4；免费模式超限由 runtime 抛错而非组件自查；grep 无 `CONCURRENCY = 4` 硬编码

### FO-05 计划限额常量收敛到 schema

- **位置**：`packages/ui-react/src/gating.ts:21`（FREE_PLAN_LIMITS）、`packages/runtime/src/batch-processor.ts:40`（FREE_BATCH_LIMIT）、`packages/runtime/src/concurrency-controller.ts:15-16`（FREE/PRO_CONCURRENCY）
- **问题**：Free/Pro 门控数字分散 3 处 2 包，属 AGENTS.md "业务约束常量归 @lokvis/schema" 同类
- **方案**：schema 新增 `plan-limits.ts` 统一导出（FREE_BATCH_LIMIT / FREE_CONCURRENCY / PRO_CONCURRENCY / FREE_PLAN_LIMITS）；三处改 re-export；playground snippets.ts 文案（"10 files / 4 concurrency"）改引用常量
- **验收**：grep 限额数字只出现在 schema；现有 gating/batch 测试不回归

### FO-06 cloud-bridge 默认 URL 单一源

- **位置**：`packages/cloud-bridge/src/auth.ts:60`、`billing.ts:76-77` 各自写死 `https://api.lokvis.com` / `https://app.lokvis.com/billing`，绕过 `cloud-config.ts:36,39`
- **方案**：auth/billing 的 options 缺省改引用 cloud-config 常量；删除内联 URL
- **验收**：grep `api.lokvis.com` 仅剩 cloud-config.ts 一处

### FO-07 WatermarkBatchTool 静默 catch 对齐 TD-3.x

- **位置**：`apps/playground/src/components/tools/WatermarkBatchTool.tsx:216-257`（11 处 `.catch(() => {})`）
- **方案**：按 packages 侧 TD-3.x 清偿方案改为 `.catch((err) => console.warn(...))` 并保留 cause；顺带处理 `engine-video/src/web/operations.ts` 10 处 ffmpeg FS 静默清理（至少 console.debug）
- **验收**：grep 无裸 `.catch(() => {})`（cli list.ts 的 exists-check 惯用法除外，加注释说明）

### FO-08 sdk → engine-video 跨层 re-export

- **位置**：`packages/sdk/src/presets/video.ts:8`
- **问题**：sdk re-export `configureFfmpegWasm` from `@lokvis/engine-video/web`，跨过中间层
- **方案**：评估后二选一——A：保留但在 AGENTS.md 明确 sdk 层位与该豁免；B：由 embed/playground 直接 import engine-video/web 配置函数，sdk 去掉该 re-export
- **验收**：决策记录入 ADR 或 AGENTS.md；依赖声明与实际一致

### FO-09 engine-core 孤儿包处置

- **位置**：`packages/engine-core/`（`createEngineRegistry` 零消费方，engine-audio/video 已移除引用）
- **方案**：二选一——A（推荐，联动 FO-11）：改造为 Node ffmpeg 共享层；B：直接删包（含 package.json workspace 引用、tsconfig references、发布配置）
- **验收**：engine-core 要么有真实消费方要么不存在

### FO-10 mcp-server-adapter.test.ts 重构

- **位置**：`packages/mcp-server/src/__tests__/mcp-server-adapter.test.ts`（36× `as any` + 16× `setTimeout(r, 10)`）
- **方案**：
  1. 定义测试用 `JsonRpcResponse` 判别联合 + `findResponse(id)` 辅助，消除全部 `as any`
  2. 定时等待改为对 server 内部完成信号/响应队列的确定性等待
  3. 同文件 `server.test.ts:203` mockTransport 补全 `LokvisMcpTransport` 形状去掉 `as any`
- **验收**：该文件零 `as any`、零 setTimeout 等待，测试稳定跑 10 次不 flaky

### FC-07 web 越界 glob api 源文件

- **位置**：`apps/web/src/data/seed-workflows.ts:65-68`（`import.meta.glob('../../../api/src/data/workflows/*.json')`）
- **方案**：新建 `packages/seed-data`（或放 `packages/db` 的 data 子路径）承载 workflows JSON，经 package exports 暴露；api 与 web 都从包导入；删除 glob
- **验收**：web 的 package.json 无对 api 的隐式依赖；api 侧移动文件不再影响 web 构建

### FC-08 users.ts 路由下沉

- **位置**：`apps/api/src/routes/users.ts`（753 行）：PLAN_ENTITLEMENTS:53-91、magic byte 校验:165-236、GDPR 导出:422-460+、API Key 配额执行:672-712
- **方案**：新建 `packages/users`（或并入现有包）：entitlements（联动 FC-01）、文件签名校验（avatar 上传）、GDPR 导出聚合查询、配额执行；路由只留编排。auth.ts 的 find-or-create/ensureUniqueUsername（`routes/auth.ts:143-183,285-305`，含 race condition 自述）同步下沉 `packages/auth`
- **验收**：users.ts < 200 行；下沉模块有单测；现有 integration 测试全绿

### FC-09 marketplace 搜索下沉 packages/search

- **位置**：`apps/api/src/routes/marketplace.ts:107-236`（130 行 SQL LIKE 双表 + 权重打分）
- **方案**：把 LIKE 搜索移入 `packages/search` 作为 keyword fallback 实现（与 Vectorize 向量搜索同包），路由调 `searchMarketplace(query)`；顺带把 `apps/api/package.json:29` 已声明但零 import 的 `@lokvis-cloud/search` 死依赖接线（本任务即接线）
- **验收**：search 包有 keyword + vector 两实现与测试；路由层无 SQL 搜索引擎

### FC-10 webhook plan 字面量改映射

- **位置**：`packages/billing/src/webhook-processing.ts:171-172,186-188`
- **问题**：SQL 硬编码 `plan='cloud_pro'`/`'free'`，违反 `sku-map.ts:15` 自身规则
- **方案**：改经 `skuToUserPlan(metadata.item_id)` 映射；补"新增订阅 SKU 未映射时报错而非静默"的测试
- **验收**：webhook-processing 无 plan 字面量

### FC-11 credits 包接线或冻结

- **位置**：`packages/credits/`（完整实现含测试但零 app 依赖；`routes/users.ts:32` Phase 2 注释、`users.ts:50,57-58` `credits: { ai: 0 }` 占位）
- **方案**：产品决策二选一——A：接线（entitlements/计费路径接 credits 余额，users.ts credits 字段改查 DB）；B：标记 experimental + 冻结变更，technical-debt 登记
- **验收**：决策落地；若接线则 `/users/me` credits 字段为真实余额

---

## B3 重复代码收敛（P1/P2）

### FO-11 Node ffmpeg 基建合并（全仓最大硬复制）

- **位置**：`packages/engine-video/src/node/operations.ts`（537 行）vs `packages/engine-audio/src/node/operations.ts`（283 行）
- **重复内容**：`getFfmpegPath()` 逐字相同；`runFfmpegStdio()` ~45 行逐字相同；concat demuxer merge ~60 行 95% 相同；trim 参数校验逐字相同；`mimeTypeForFormat` 同构
- **方案**：
  1. 落点：改造 `packages/engine-core`（联动 FO-09）为内部共享层，导出 `getFfmpegPath / runFfmpegStdio / runFfmpegConcatMerge / validateTrimRange / mimeForFormat`
  2. engine-video/audio node 入口改 import；错误文案模板保持原样（stderr 尾部 2000 字符）
  3. 共享模块补测试（mock child_process spawn）
- **验收**：两包 node operations 各减 ~40%；engine-video/audio 现有测试全绿；新增共享层测试

### FO-12 plugin 能力绑定表三入口合一

- **位置**：plugin-video（operations.ts / node-plugin.ts / web-plugin.ts）、plugin-audio（operations.ts / node-plugin.ts）、plugin-image（operations.ts / node-plugin.ts）
- **先例**：plugin-pdf `buildRealPdfPlugin(options)` 已消除 ~95% 重复（real-plugin.ts 头部注释）
- **方案**：plugin-sdk 新增通用工厂 `buildPluginFromEntries(entries, opsByEnv, options)`（或泛化 buildRealPdfPlugin 模式）：每域维护一张 entries 表（capability→outputType→kind），三入口传不同 operation 集合；video/audio/image 依次迁移
- **验收**：预计消除 video ~250 行、audio ~150 行、image ~60 行；各 plugin.test.ts（五要素）全绿

### FO-13 deriveMetadata 族收敛

- **位置**：plugin-video/pdf/audio/archive/ai 的 `deriveXxxMetadata`（6 处）+ 4 处 `deriveMetadata: (_source, outBlob) => ...` 包装
- **方案**：plugin-sdk 增加 `deriveOutputMetadata(outBlob, fallbackMime, fallbackFormat)` + `fallbackForAssetType(type)` 表；各 plugin 删自造函数
- **验收**：各包 metadata 派生行为测试不回归

### FO-14 MIME/格式映射表统一

- **位置**：engine-image `MIME_BY_FORMAT`、browser-adapter format-support `MIME_BY_FORMAT`（自认"与 engine-image 保持一致"）、engine-video web/node `mimeTypeForFormat`（两份）、engine-audio `mimeTypeForFormat/codecForFormat`、mcp-server `extToMime`、embed/playground `formatFromMime`
- **方案**：在 `@lokvis/schema`（纯数据，任何层可依赖）新建 `media-formats.ts`：`mime ↔ format ↔ ext ↔ AssetType` 映射；上述各处改引用；codecForFormat 等引擎特有表保留但引用基础映射
- **验收**：grep `MIME_BY_FORMAT|mimeTypeForFormat|formatFromMime|extToMime` 仅剩 schema 一处定义

### FO-15 i18n React 胶水工厂

- **位置**：embed-image / embed-pdf / embed-video / ui-react / playground 共 5 份 `useLang + utils + Provider`（detectLang / useSyncExternalStore+popstate / 优先级链逐字相同）
- **方案**：`@lokvis/i18n` 新增 react 子路径（或经 embed-kit）：`createUseLang(context)` / `createI18nProviderFactory()`；5 处改为工厂实例化
- **验收**：消除 ~5×170 行；各包 i18n 测试全绿；语言检测行为不变

### FO-16 playground 改消费 embed-kit / embed-image

- **位置**：`apps/playground/src/components/toolkit/` 下 useImageTool（188 行，与 embed-image 186 行 ~95% 相同）、usePdfTool、useVideoTool、useLokvisRuntime（与 embed-kit createUseLokvisRuntime 同构）、workflow-builder ×5、download.ts（与 embed-image internal/download.ts 逐行同构且已分叉）
- **方案**：
  1. `useLokvisRuntime` → `createUseLokvisRuntime(() => [imageToolsPlugin()])` 一行替换
  2. 5 个手写 workflow 字面量构造器 → embed-kit `makeSingleStepWorkflowBuilder()`（已声明依赖却未使用）；顺带修正 `version: '1.0'` → `'1.0.0'`（semver）
  3. embed-image（或 embed-kit）公开导出 `formatFromMime/getImageInfo/imageInfoToMeta/detectTransparency/describeError`；playground download.ts 删除改 import
  4. useImageTool/usePdfTool：embed-kit 提供 `useEmbedTool({ multiple, probeInfo })` 泛化 hook（联动 FO-17），playground 改消费
- **验收**：playground toolkit 目录删除 ~6 个副本文件；现有 toolkit 测试迁移到针对消费方的薄测试；`version: '1.0'` 清零

### FO-17 embed useXxxTool 三胞胎泛化

- **位置**：embed-image/pdf/video 的 `internal/useXxxTool.ts`（busy/error/handleFiles/runWorkflow/reset 状态机 ~70% 相同）
- **方案**：embed-kit 提供 `useEmbedTool({ multiple, probeInfo })`；三包 hook 改为参数化调用，差异点（单/多输入、probe 函数）注入
- **验收**：三包各自的 26+4+3 个测试全绿

### FO-18 mcp-server runXxxTransform 收敛

- **位置**：`packages/mcp-server/src/tools/{image,video,audio,pdf}.ts` 5 个 runXxxTransform（readFile→File→importAsset→run→exportAsset→finally 清理，~90% 相同）
- **方案**：workflow-helpers.ts 增加 `runFileTransform(runtime, { inputPaths, capability, params, mime, shape: 'single'|'merge'|'split' })`；另抽 `sizeDeltaReport()` 收敛 ~50 处 originalSize/reduction 文案
- **验收**：mcp-server 测试全绿；tools/*.ts 各减 ~60%

### FO-19 cloud-bridge cloudFetch + plugin-ai 三合一（两个小包内收敛）

- **cloud-bridge**：ai-client/auth/billing 四个 fetch 封装（AbortController+setTimeout+x-api-key+ok 检查）收敛为内部 `cloudFetch({ path, body?, timeoutMs })`，超时常量统一命名；billing.ts 内 planQuotas 降级对象（同文件写两遍）抽函数
- **plugin-ai**：`createGenerateWorkflowImpl/createOptimizeWorkflowImpl/createDiagnoseErrorImpl`（113-194 行，除 capability 名与文案外逐字相同）合并为 `createParamsToDataImpl(capability, operation, progressLabel, isStub, ctx)`
- **验收**：两包测试全绿；fetch 行为（超时/错误分类）不变

### FC-12 dashboard 类型镜像改 import type

- **位置**：`apps/dashboard/src/api/types.ts:25-42,120-143,271-285`（UserRow/WorkflowRow/PurchaseRow 手工镜像 @lokvis-cloud/db；注释理由"避免 workers-types 污染 bundle"不成立——`import type` 无运行时产物）
- **方案**：改 `import type { User, WorkflowRecord, Purchase } from '@lokvis-cloud/db'`；删除镜像；transformer 层保留
- **验收**：bundle 产物体积对比无增长；typecheck 通过

### FC-13 AnalyticsEventType 共享

- **位置**：`apps/web/src/lib/analytics.ts:29-59`（26 值联合手工镜像 packages/analytics）
- **方案**：把事件词表抽到 runtime 无关的纯常量文件（packages/analytics 拆出 `events.ts`，不依赖 Workers 类型），web/api 两端共享
- **验收**：词表单点；服务端校验仍生效

### FC-14 capability 分类与正则共享

- **位置**：`apps/dashboard/src/lib/categories.ts:22-37`（7 个分类手工镜像 web 的 capabilities.ts，web 侧以 @lokvis/capability 为 SSOT）+ slugRegex/semver 正则重复
- **方案**：dashboard 依赖 `@lokvis/capability`（纯数据包）取分类与正则；或抽 `packages/shared-constants`
- **验收**：分类清单与 @lokvis/capability codegen 产物一致，有对账测试

### FC-15 Lang 枚举四处收敛

- **位置**：`apps/web/src/i18n/config.ts:10-18`、`apps/dashboard/src/i18n/config.ts:17-19`、`apps/api/src/middleware/i18n.ts`、`packages/db/src/index.ts:39`（PreferredLanguage）
- **方案**：抽共享常量（放 db 包或新建公共小包），四处引用
- **验收**：语言集合单点定义

### FC-16 测试 mock 收敛 test-utils

- **位置**：workflow-service / sync / credits 三包各自维护 D1/R2/KV mock（250/233/183 行近相同）
- **方案**：新建 `packages/test-utils`（workspace devDependency）统一 mockDeps；三包改引用
- **验收**：三包测试全绿；mock 代码减 ~60%

---

## B4 文档对账（P0/P1）

### FO-20 getting-started 非法示例重写（高）

- **位置**：`apps/docs/src/content/docs/getting-started.md:76-93` + zh-cn 同段
- **问题**：缺 version/description/author/tags、`category: 'web'` 非法、inputs type 应为 AssetType 且缺 multiple、outputs 写成数组、节点缺 `type: 'transform'`、edges 引用伪节点 input/output
- **方案**：按 `workflows.md` 合法结构重写，或改展示 `WorkflowBuilder`/`buildLinearWorkflow`；重写后把示例代码接入 `packages/cli` validate 做 CI 对账（与 FO-24 合并做）
- **验收**：示例可被 validateWorkflow 通过（有自动化断言）

### FO-21 sdk.md API 失真修正（高）

- **位置**：`apps/docs/src/content/docs/sdk.md`
- **修正清单**：删 `eventBus.once`（不存在）；删 `memory:pressure` 事件；`workflow:completed` payload 改 `{ workflowId, result }`（时长为 `e.result.duration`）；`history:changed` payload 改 `{ workflowId, entries, currentIndex }`；`toMcpManifest` 选项改为实际 `batchMode`；删配置项 `historyLimit`；Runtime API 表补 `plan / readAssetImageMetadata / readAssetPdfInfo / dispose() / listPanels()`
- **验收**：与 `packages/runtime/src/types.ts:46-386` 逐项对账通过

### FO-22 CLI 文档更新

- **位置**：`apps/docs/.../sdk.md:246`（`lokvis mcp` 命令不存在，MCP 是 `@lokvis/mcp-server` 独立 bin）、`cli.md:18-49`（缺 validate/list 命令）、cli.md:26/sdk.md:251（"浏览器能力不能 Node 跑"已过期——M2.2 起 CLI 注入 sharp Node 引擎）
- **验收**：与 `packages/cli/src/runner.ts` 命令分发一致

### FO-23 能力清单对账 + codegen

- **位置**：`plugins.md:76-81`（image 9→10、pdf 7→8、ai 5→6、dev 4→9）、`embed-sdk.md:28`、`capabilities.md`（缺 image.favicon / pdf.add-page-numbers / ai.diagnose-error / 5 个 developer 能力；`asset.archive` 应为 `archive.zip/unzip/list`）
- **方案**：清单改由 `packages/capability/src/presets/*.generated.ts` codegen 生成 markdown，加 CI 对账步骤（漂移即红）
- **验收**：docs 能力表与 generated presets 完全一致且有自动化保障

### FO-24 文档杂项

- getting-started.md:46-49 "777 tests / 91% 覆盖率" 过期（实测 lines 80.47%）→ 改区间表述或删除具体数字
- `guides/write-first-plugin.md:262` 教 vi.stubGlobal，与 AGENTS.md createFakeAdapter 约定相悖 → 随 FO-30 决策同步修订
- `guides/cli-automation.md:171-172`（中英）`(window as any).lokvis` → playground 全局暴露加类型声明后更新示例
- **验收**：docs 无过期数字；示例风格与 AGENTS.md 一致

### FC-19 api-docs 硬编码收敛（归入 B4 一起做）

- **位置**：`apps/api-docs/src/pages/index.astro:14,32-36,57`（api.lokvis.com fallback、unpkg @stoplight/elements@8.1.0、preview workers.dev URL）
- **方案**：移入环境变量/构建配置
- **验收**：无环境相关的硬编码 URL

---

## B5 测试补齐（P1/P2）

### FO-25 embed-kit 补测试

- **现状**：已发布 0.10.0，6 个源码模块（theme/runtime/workflow/sentry/ErrorBoundary/download）零测试，未纳入覆盖率 include
- **方案**：createUseLokvisRuntime（重建/清理语义）、makeSingleStepWorkflowBuilder（结构断言）、download（浏览器 fake）、ErrorBoundary 各补测试；vitest.config include 加入 embed-kit
- **验收**：embed-kit 覆盖率 ≥ 60% lines

### FO-26 buildLinearWorkflow 补测试

- **位置**：`packages/workflow/src/build-linear-workflow.ts`（103 行，含 MAX_WORKFLOW_STEPS 防御/edge 生成/category 映射，生产路径在用，零测试引用）
- **验收**：覆盖线性链生成、超限抛错、category 映射、version='1.0.0'

### FO-27 plugin-image plugin.test.ts 补 status 断言

- **问题**：AGENTS.md 五要素中 stub status 覆盖缺位（engine 是真实 canvas，但至少应断言 `status === 'stable'`）
- **验收**：plugin.test.ts 含 status 断言，与其他 plugin 包对齐

### FO-28 createFakeAdapter 约定决策与落地

- **现状**：AGENTS.md 要求"优先 createFakeAdapter"但零测试使用；实际用本地 fake + stubGlobal（engine 层 stub 的 fetch/Worker 本就不归 adapter 管辖，约定可能过时）
- **方案**：
  1. 决策：约定收窄为"adapter 管辖范围（canvas/OPFS/IDB/storage/探测）的 fake 走 createFakeAdapter；fetch/Worker 等全局允许 stubGlobal"，修订 AGENTS.md
  2. 迁移优先项：`runtime/__tests__/browser-detect.test.ts`（10 处 stubGlobal，正是 adapter 探测场景）、`asset-store.test.ts`（5 处）
  3. test-utils.ts:6 的"存量不强制迁移"注释同步更新
- **验收**：AGENTS.md 修订；browser-detect/asset-store 迁移完成

### FO-29 batch-processor 测试去睡眠

- **位置**：`packages/runtime/src/__tests__/batch-processor.test.ts`（:154,187,217,429,745,759,778，5-100ms 固定睡眠）
- **方案**：对齐 TD-2.2 方案改 `waitForItemsStarted` 类确定性等待
- **验收**：无固定睡眠；CI 连跑 20 次不 flaky

### FO-30 vitest 覆盖率 include 修正

- **现状**：include 不含 workflow/embed-*/engine-core/cloud-bridge（cloud-bridge 有 4 个测试却不计入）；exclude 注释（"W6.3 后 cli/plugin-sdk 已补齐"）滞后
- **方案**：workflow、cloud-bridge 加入 include（已有测试）；embed-* 随 FO-25/17 迁移后加入；注释更新
- **验收**：覆盖率报告包含上述包；阈值不回归

### FC-17 retention / plugin-service / ai-service 单测

- **现状**：7 个包级无单测；retention（GDPR 删除不可逆）与 plugin-service、ai-service 基本裸奔（auth/billing 经 apps/api integration 间接覆盖）
- **优先级**：retention > ai-service（联动 FC-02）> plugin-service > search
- **验收**：retention 删除路径（含 Stripe 删除失败降级）有单测；ai-service 错误路径有单测

### FC-18 dashboard 单测 + k6 接入

- dashboard：transformer（api/types.ts）与 sync 重试逻辑补 vitest
- `tests/perf/` 3 个 k6 脚本接夜间 CI 或 release 前置门禁
- **验收**：dashboard 有 vitest 配置与首批测试；k6 有运行记录

---

## B6 点状清理（P3）

| ID | 位置 | 动作 |
|---|---|---|
| FO-32 | playground `Playground.tsx:92,122` | 两处 eslint-disable(react-hooks/exhaustive-deps) 补解释注释 |
| FO-33 | ui-react `DownloadPanel.tsx:43` / browser-adapter `file-picker.ts:250` | ObjectURL revoke 延迟 1000ms 提常量或抽共享 helper；DownloadPanel 自写 `downloadBlob/extFromMime`（35-44 行）改引 browser-adapter/embed-kit |
| FO-34 | mcp-server `browser-bridge.ts:107` | `callTimeoutMs = 30000` 提具名常量（对齐同包 DEFAULT_CLOSE_TIMEOUT_MS 风格） |
| FO-35 | engine-image 内部原语 | compress-target/wasm-encode/png-metadata/reencode 四处签名非 `Record<string, any>`——确认为内部原语后在 AGENTS.md 注明豁免（不改签名，避免无意义 churn） |
| FO-36 | runtime `event-bus.ts` | mitt 具名 handler 无 try/catch：emit 处对 mitt handler 包一层捕获（console.warn 后继续），与 anyHandlers 隔离保证对齐 |
| FO-37 | plugin-image `operations.ts` | 10 个零增益透传包装（`const resizeOp = (b,p,s) => opResize(b,p,s)`）直接引用 engine 导出 |
| FO-38 | plugin 注册样板 | plugin-sdk 出 `registerImplementations(ctx, impls)`（7 个 plugin.ts 样板）、`isStubEngine(descriptor)`（10 处 `.version.includes('stub')`）、`createBlobMetadataReader(name, parse)`（5 处）；stubMessage 模板统一 |
| FO-39 | plugin-sdk 类型导出 | `SingleXxxOperation/MergeXxxOperation/SplitXxxOperation` 12 处重定义改从 plugin-sdk 导出 |
| FO-40 | 杂项 | playground 三处 `sleep` 提共享 util；embed-pdf/video `DefaultPresetButton` 逐字重复提到 embed-kit；`FilesystemGuardError` 死代码在 technical-debt 登记 W18.x 触发条件；engine-pdf ocr/sign Phase 3 登记；sdk/runtime 错误类双轨在 CONTRIBUTING 加同步检查项；ErrorBoundary 三分局写 ADR 记录；benchmark 结果快照更新并标注引擎版本 |
| FC-20 | billing.ts 发票组装 | `routes/billing.ts:594-607` vs `662-675` 复制粘贴 → 抽 `buildInvoiceResponse(purchase, receiptUrl)` |
| FC-21 | 空 catch 两处 | webhook-processing.ts:131 `track().catch(() => {})`、workflow-service:118 `r2.delete().catch(() => {})` → console.warn |
| FC-22 | rate-limit env 覆盖 | `middleware/rate-limit.ts:75-99` 支持 `RATE_LIMIT_OVERRIDES`（env/KV），事故时无需重新部署 |
| FC-23 | ai-service 模型名 | `index.ts:276,290,311` 三个模型名移入 AiServiceDeps/env |
| FC-24 | 配置化小项 | JWT 7d/session 30d（middleware/auth.ts:30-31）可移入 env；affiliate 链接三源（AdSlot.astro 硬编码 / affiliates.ts / yaml）收敛为 affiliates.ts 注册表单点 |
| FC-25 | compliance_audit_logs | 只读端点无写入方（users.ts:619-668）：Phase 2 接线计划登记，或 UI 注明"即将上线" |
| FC-26 | web compress metric 收敛 | `QuickCompressTool/PdfCompressTool/VideoCompressTool` 三处 ~30 行 ratio-based metric 计算重复 → 抽 `<CompressMetric>` 组件或 `useCompressMetric()` hook 到 QuickToolUI |
| FC-27 | dashboard 文件工具库 | 预防性任务：dashboard 当前无文件工具库（SettingsPage/WorkflowUploadDialog 内联）；新增第二个文件操作场景时建立 `lib/file-utils.ts`（formatBytes/downloadBlob/validateFile*） |

---

## 执行顺序与依赖

```
B1（P0，1 周内）
  FO-01 ─→ FO-16（playground 迁移前必须先统一 presets）
  FC-01 ─→ FC-11（entitlements 单源决策先行）
  FC-02/03/04/05/06 相互独立，可并行

B2（P1，第 2 周）
  FO-04 依赖 B1 FO-01；FO-09 决策先行（决定 FO-11 落点）
  FC-08 依赖 FC-01；FC-09/10 独立

B3（P1/P2，第 2~3 周）
  FO-11 依赖 FO-09 决策；FO-12 先迁 plugin-video 验证工厂再铺开
  FO-16 依赖 FO-17（useEmbedTool 先就绪）；FO-14 先于 FO-13（fallback 表复用）
  FC-12~16 独立并行

B4（P0/P1，可与 B2 并行，纯文档风险低）
  FO-20/21 最高优先；FO-23 codegen 对账做完后 FO-24 顺手

B5（P1/P2，第 3~4 周）
  FO-28 决策先行（影响新测试写法）；FC-17 retention 最先

B6：随手清理，不排专门迭代，PR 顺带做
```

## 风险与注意事项

1. **FO-12/16/17 是重构密度最高的一批**：务必先补/确认现有测试全绿再动手，逐包迁移逐包验证，不合一个大 PR
2. **FC-01 需要产品裁决配额数值**（∞ vs 20 vs 100），技术侧先列冲突清单，勿擅自选边
3. **FO-09 engine-core 处置**决定 FO-11 落点，两个任务同一个人做
4. **FO-14 schema 新增 media-formats** 属 schema 层变更，注意 schema 是发布包，走 changeset
5. 文档类任务（B4）修完后建议把示例代码纳入 CI（validateWorkflow 断言），防止再次漂移
