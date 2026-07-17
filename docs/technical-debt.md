# 技术债务登记簿（Technical Debt Register）

> 本文档记录 lokvis-open 项目中**已知但暂不修复**的技术债务,按类别分类,每项含位置、问题、影响、长期方案、暂不修复原因与触发条件。
>
> **维护规则**:新增债务须在此登记;债务清偿后移至「已清偿」章节并标注清偿 commit。每次架构 review(见文末「Review 记录」)后更新。
>
> **生成来源**:2026-07-04 架构 review(见文末「Review 记录」第 1 条)。

---

## 债务分类总览

| 类别 | 数量 | 严重度 | 处理策略 |
|---|---|---|---|
| Phase 2 路线 | 2 项 | 中 | 按 Phase 2 路线推进(TD-1.3/TD-1.4 已清偿,见 TD-C14/TD-C15) |
| 测试时序依赖 | 2 项 | 中 | 需改生产 API 语义,专项评估 |
| 静默吞错 | 11 处 | 低 | intentional,需 assetStore 错误类型分层才能根治（TD-3.1/3.2/3.3 已部分修复为 warn,8 处全活动） |
| 类型层面 workaround | 1 处 | 低 | TD-4.2 活动（schema workflow.ts 强转加字段）;TD-4.1/4.3/4.4/4.5/4.6 已清偿 |
| UI ObjectURL 生命周期分散 | 2 处 | 中 | 有防护(W21.6 已修复具体泄漏点:ObjectURL revoke + 监听器/timer cleanup + ToolRunner/BatchQueue unmount abort,但架构层面"创建/释放跨边界"未重构,见 Review #5),重构影响面大 |
| 事件订阅 cleanup 模式分散 | 2 处 | 低 | 各有特殊点,抽象灵活性下降（TD-6.1 + TD-6.2） |
| 测试环境 hack | 3 处 | 低 | 合理写法,非债务(记录备查) |
| Cloud 耦合泄漏 | 1 项 | 中 | mcp-server 硬编码 cloud URL/plan 名（TD-1.5,问题 A 抽 @lokvis/cloud-bridge 处理中） |

**净评估**:无阻塞性债务。Phase 2 路线的 3 项是已知的功能性取舍,Cloud 耦合有 graceful degradation 防护,其余均为"有防护的局部 workaround"或"抽象收益不足"的项目。

---

## 1. Phase 2 路线(功能性短期取舍)

### TD-1.1 mcp-server Node 降级模式无法读写本地文件

- **状态**:🟡 部分修复(NodeAssetStore 已实装,但未完全替代默认 store)
- **位置**:`packages/mcp-server/src/server.ts:144`、`packages/mcp-server/src/node-asset-store.ts:74-144`
- **问题**:原描述"使用默认内存/OPFS store,无法读写本地文件"已部分修复 —— `NodeAssetStore` 基于 `fs/promises` + `workdir` 实装,但未完全替代默认 store 路径。
- **影响**:Node 环境已可读写本地文件,但与 runtime capability 系统的集成未完成(image/pdf 已改经 Engine 层直接消费,见 TD-C14/TD-C15;capability 系统对接仍待 Phase 2)
- **长期方案**:完成 mcp-server 与 runtime capability 系统的对接(image/pdf 侧已走 Engine 层 Blob↔Blob 直接消费,见 TD-C14/TD-C15)
- **为何暂不修**:已明确记入 Phase 2 路线,NodeAssetStore 已满足当前 5 个 tool 的文件读写需求
- **触发条件**:Phase 2 MCP Server v1 与 runtime capability 系统对接完成时

### TD-1.2 批量队列状态不持久化

- **位置**:`packages/runtime/src/batch-processor.ts:14-17`
- **问题**:批量队列状态不持久化,刷新即丢。代码注释明确"持久化批量进度属 Phase 2"
- **影响**:用户刷新页面后批量任务进度丢失,需重新发起
- **长期方案**:持久化批量进度到 IndexedDB,支持跨会话恢复
- **为何暂不修**:W6 主要保证 Asset 持久化,批量队列是临时调度结构,刷新后由 UI 重新发起即可。Phase 2 再做持久化
- **触发条件**:Phase 2 或用户反馈批量恢复需求

### TD-1.3 ~~mcp-server image tools 直接用 sharp 绕过 Engine 层~~(已清偿,见 TD-C14)

> 2026-07-15 清偿:image tool handlers 改为经 `@lokvis/engine-image-node` Blob↔Blob 操作调用,mcp-server 不再直接 import sharp。详见 TD-C14。

### TD-1.4 ~~mcp-server pdf tools 直接用 pdf-lib 绕过 Engine 层~~(已清偿,见 TD-C15)

> 2026-07-15 清偿:实装 `engine-pdf` 的 `mergePdfs`/`compressPdf`/`getPdfInfo` Blob↔Blob 操作,pdf tool handlers 改为经 `@lokvis/engine-pdf` 调用,mcp-server 不再直接 import pdf-lib。详见 TD-C15。

### TD-1.5 mcp-server 硬编码 cloud URL / plan 名(耦合泄漏)

- **位置**:
  - `packages/mcp-server/src/auth.ts:26` `DEFAULT_API_BASE_URL = 'https://api.lokvis.com'`
  - `packages/mcp-server/src/billing.ts:24` `UPGRADE_URL = 'https://app.lokvis.com/billing'`
  - `packages/mcp-server/src/billing.ts:30-35` `PLAN_AI_QUOTAS` 含 `cloud_pro`/`enterprise` plan 名
  - `packages/mcp-server/src/billing.ts:136-140` 调用 `/v1/credits/deduct`
- **问题**:architecture.md §1.5 声明 "lokvis-open 永远不导入 lokvis-cloud",ADR-012 "商业化资产迁出至 lokvis-cloud"。但 mcp-server 把 cloud URL / plan 名 / credits 概念硬编码到开源包,违反 open/cloud 隔离精神。
- **缓解**:有 graceful degradation(无 API key 时降级到本地模式,credits 设为 Infinity "避免误拒"),本地 tool 不需要 auth/billing
- **长期方案**:把 cloud 配置(URL/plan 名/credits 概念)抽到可注入的 `CloudConfig` 接口,默认值在 mcp-server 但允许消费方覆盖;`PLAN_AI_QUOTAS` 与 `UPGRADE_URL` 移到独立配置
- **为何暂不修**:当前 mcp-server 是 open 仓库的独立交付物,graceful degradation 已保证本地模式可用;完全去 cloud 化需较大重构
- **触发条件**:开源包要完全去 cloud 化时,或 cloud URL/plan 结构变更时

---

## 2. 测试时序依赖

### TD-2.1 history-persistence 测试轮询

- **位置**:`packages/runtime/src/__tests__/integration/history-persistence.test.ts:250-255`
- **问题**:用 50ms × 20 次轮询等待 `persistHistory`(fire-and-forget)完成,替代固定 setTimeout 避免 flaky
- **影响**:测试在慢 CI 上可能 flaky(虽然 1s 上限通常足够)
- **长期方案**:让 `disposeWorkflow` 返回 Promise 等待 persist 完成后,测试直接 `await`
- **为何暂不修**:改 `disposeWorkflow` 等待 persist 会改变 fire-and-forget 语义,影响生产代码多个调用点,需整体评估调用方是否都能接受 await
- **触发条件**:测试出现 flaky,或重构 history 持久化模块时

### TD-2.2 batch-processor 测试固定延时

- **位置**:`packages/runtime/src/__tests__/batch-processor.test.ts` L446 / L480 / L563 / L610 / L736
- **问题**:用固定 5-20ms setTimeout 赌调度器已启动若干项,本质是时序竞态
- **影响**:慢 CI 上可能 flaky
- **长期方案**:`await` batch processor 暴露的"已调度 N 项"事件信号 / state 变更回调,而非时间赌注
- **为何暂不修**:需给 BatchProcessor 加"已调度 N 项"的可观察信号,改动生产 API;当前测试在 CI 上未出现 flaky
- **触发条件**:测试出现 flaky,或 BatchProcessor 重构时

---

## 3. 静默吞错(`.catch(() => {})`)

### TD-3.1 disposeWorkflow cancel 静默吞错

- **状态**:🟡 已部分修复(改为 warn,但仍不区分错误类型)
- **位置**:`packages/runtime/src/managers/workflow-coordinator.ts:135-142`
- **代码**:`await this.cancel(workflowId).catch((err) => console.warn('[lokvis] disposeWorkflow: cancel(...) failed:', err));`
- **问题**:原描述"完全静默"已不准确,代码已升级为 warn + 不区分错误类型。但 cancel 失败仍只 warn,未区分 "not found / 未运行" 与真实错误(Worker 崩溃 / executor 异常)
- **影响**:生产环境有 warn 日志但无法区分错误类型
- **长期方案**:区分 "not found / 未运行" 与真实错误,后者上报到 Sentry
- **为何暂不修**:intentional cleanup 模式,改需给 cancel 加错误类型分层;当前 warn 已满足调试需求
- **触发条件**:接入 Sentry 后,或出现 cancel 失败相关的生产问题

### TD-3.2 removeAsset cleanup 静默吞错

- **状态**:🟡 已部分修复(改为 warn,但仍不区分错误类型)
- **位置**:`packages/runtime/src/managers/history-manager.ts:194-196`
- **代码**:`this.assetStore.remove(assetId).catch((err) => console.warn('[lokvis] onEvict: remove(...) failed:', err));`
- **问题**:同 TD-3.1,原"完全静默"已不准确,改为 warn + 不区分错误类型
- **影响**:同 TD-3.1
- **长期方案**:同 TD-3.1
- **为何暂不修**:同 TD-3.1
- **触发条件**:同 TD-3.1

### TD-3.3 batch-processor 清理孤儿资产静默吞错

- **状态**:🟡 已部分修复(改为 warn,文件位置已迁移)
- **位置**:`packages/runtime/src/batch-scheduler.ts:124, 162, 172`(原 `batch-processor.ts:500, 557` 已过时)
- **代码**:`void this.runtime.removeAsset(inputAssetId).catch((err) => console.warn('[lokvis] BatchProcessor: cleanup input(...) failed:', err));`
- **问题**:cancel 期间清理刚导入的 input,已改为 warn + 不区分错误类型;文件位置因 batch 模块拆分迁移到 `batch-scheduler.ts`
- **影响**:同 TD-3.1
- **长期方案**:同 TD-3.1
- **为何暂不修**:同 TD-3.1
- **触发条件**:同 TD-3.1

### TD-3.4 exif-reader 解析失败静默返回 null

- **位置**:`packages/plugin-image/src/exif-reader.ts:81-84`
- **代码**:`} catch { return null; }`
- **问题**:catch 吞掉所有 exifr 异常(包括 exifr 库自身 bug、文件 I/O 错误),生产环境难调试
- **影响**:无法区分"无 EXIF"与"解析抛错"
- **长期方案**:至少通过 `ctx.log('warn', ...)` 或上报可观测信号,区分"无 EXIF"与"解析异常"
- **为何暂不修**:exif-reader 是纯函数(无 ctx),改需调整 MetadataReader 签名传 ctx;且"无 EXIF"是常见场景,静默返回 null 不影响 UX
- **触发条件**:出现 EXIF 解析相关的生产问题,或接入可观测系统时

### TD-3.5 batch-progress 进度订阅者回调静默吞错

- **位置**:`packages/runtime/src/batch-progress.ts:100-105`
- **代码**:`try { fn(payload); } catch { /* 单个订阅者异常不阻断其他订阅者 */ }`
- **问题**:进度订阅者回调 try/catch + 空 catch,完全静默。与 `event-bus.ts:31-37` 的 `console.error('[event-bus] onAll handler threw ...')` 行为不一致
- **影响**:订阅者异常被完全吞掉,无日志
- **长期方案**:与 event-bus 一致,catch 内 `console.error` 或上报
- **为何暂不修**:与 TD-3.x 系列同根,需统一错误处理策略
- **触发条件**:接入 Sentry 后统一处理 TD-3.x 系列

### TD-3.6 batch-progress EventBus.emit 静默吞错

- **位置**:`packages/runtime/src/batch-progress.ts:219-225`
- **代码**:`try { this.eventBus.emit(event); } catch { /* EventBus 异常不阻断批量逻辑 */ }`
- **问题**:双层 try/catch —— event-bus.ts:29-38 的 `emit()` 自身已对 onAny handler try/catch 隔离,此处进一步吞掉 `emitter.emit` 自身(mitt 内部)的同步异常,完全静默
- **影响**:EventBus 内部异常被完全吞掉
- **长期方案**:至少 `console.warn`,或评估双层 try/catch 是否必要
- **为何暂不修**:同 TD-3.5
- **触发条件**:同 TD-3.5

### TD-3.7 BatchProcessor.cancel 单项 cancel 静默吞错

- **位置**:`packages/runtime/src/batch-processor.ts:156-160`
- **代码**:`try { await this.runtime.cancel(wfId); } catch { /* 取消失败不阻断 */ }`
- **问题**:BatchProcessor.cancel 内对每个 cancelled item 的 workflow cancel 调用 try/catch + 空 catch,形态与 TD-3.1 完全一致但代码路径不同
- **影响**:同 TD-3.1
- **长期方案**:同 TD-3.1
- **为何暂不修**:同 TD-3.1
- **触发条件**:同 TD-3.1

### TD-3.8 history onEvict 同步异常静默吞错

- **位置**:`packages/runtime/src/history.ts:189-195`
- **代码**:`try { onEvict(entry); } catch { /* onEvict 失败不应阻断历史操作,由调用方日志记录 */ }`
- **问题**:onEvict 同步异常 try/catch + 空 catch,注释说"由调用方日志记录",但调用方 `history-manager.ts:191-197` 的 onEvict 实现的 `.catch` 只 catch 异步 promise rejection,不 catch 同步异常。两层防护语义重叠
- **影响**:onEvict 同步异常被完全吞掉
- **长期方案**:统一 onEvict 异常处理策略,移除重叠防护
- **为何暂不修**:同 TD-3.5
- **触发条件**:同 TD-3.5

### TD-3.9 asset-store 富元数据失败静默降级

- **位置**:`packages/runtime/src/asset-store.ts:104-117`
- **代码**:`try { ... extractImageDimensions(blob) ... } catch { return {}; }`
- **问题**:extractRichMetadata try/catch + `return {}`,对照 TD-3.4 exif-reader 同模式。注释(`asset-store.ts:97-99`)说明"所有提取均 try/catch:失败时返回空对象,不阻断 import"
- **影响**:富元数据提取失败时返回空对象,无法区分"无元数据"与"提取异常"
- **长期方案**:同 TD-3.4,通过 `ctx.log('warn', ...)` 或上报可观测信号
- **为何暂不修**:同 TD-3.4,asset-store 是纯函数(无 ctx)
- **触发条件**:同 TD-3.4

### TD-3.10 opfs-asset-store catch+rethrow 丢上下文

- **位置**:`packages/runtime/src/opfs-asset-store.ts:231-237`
- **代码**:`try { ... } catch { throw new Error('Blob not found in OPFS for path: ...'); }`
- **问题**:catch 后 rethrow 新 Error,丢失原始 `DOMException` 的 `name`(`NotFoundError` 等)与 stack。调用方无法据 `err instanceof DOMException` 区分"文件不存在"与"权限/IO 错误"
- **影响**:OPFS 错误类型信息丢失,调用方无法区分错误类型
- **长期方案**:保留原始 error 作为 `cause`,或区分 NotFoundError 与其他错误后分别 rethrow
- **为何暂不修**:intentional simplification,当前调用方不依赖错误类型区分
- **触发条件**:assetStore 错误类型分层时(与 TD-3.x 系列同根)

### TD-3.11 mcp-server 多处 cleanup 静默吞错

- **位置**:
  - `packages/mcp-server/src/sse-transport.ts:62, 108` `await this.transport.close().catch(() => {})`
  - `packages/mcp-server/src/cli.ts:70, 71, 81` `await bridge.close().catch(() => {})` / `await server.close().catch(() => {})`
  - `packages/mcp-server/src/node-asset-store.ts:112` `await unlink(asset.blob.path).catch(() => {})`
- **问题**:6 处 cleanup 路径 `.catch(() => {})`,完全静默
- **影响**:cleanup 失败无日志,生产环境难调试
- **长期方案**:同 TD-3.1,改为 warn + 不区分错误类型
- **为何暂不修**:cleanup 路径,intentional
- **触发条件**:接入 Sentry 后统一处理

---

## 4. 类型层面 workaround

> **TD-4.1 / TD-4.3 / TD-4.4 / TD-4.5 / TD-4.6 已清偿**,见「已清偿」章节。本节保留活动债务 TD-4.2(schema workflow.ts 类型强转)。

### TD-4.2 schema workflow.ts 强转加字段

- **位置**:`packages/schema/src/workflow.ts:237`(原 `:205` 行号已过时)
- **代码**:`(schema.properties as Record<string, unknown>).input_path = { type: 'array', ... };`
- **问题**:`schema.properties` 本是具体 JSON Schema 类型,此处强转 `Record<string, unknown>` 以便动态加字段
- **影响**:类型安全减弱
- **长期方案**:把 `properties` 类型设计为允许任意键的索引签名类型
- **为何暂不修**:JSON Schema 动态加字段是合理用法,改动 schema 类型影响面大
- **触发条件**:重构 workflow schema 类型时

### TD-4.6 ~~sdk errors.ts best-effort message 模式匹配过渡方案~~(已清偿,见 TD-C16)

> 2026-07-15 清偿:runtime 新增 `errors.ts` 定义 7 个类型化错误类(AssetNotFoundError / AssetBlobNotFoundError / WorkflowInvalidError / WorkflowCycleError / WorkflowNodeError / CapabilityNotRegisteredError / CapabilityStubOnlyError),11 处 `throw new Error(...)` 改用类型化错误类。SDK `fromLokvisError()` 删除 message 模式匹配分支,改用 `instanceof` 检测。详见 TD-C16。

---

## 5. UI ObjectURL 生命周期分散

### TD-5.1 缩略图 ObjectURL 创建与释放跨边界

- **位置**:
  - 创建:`packages/ui-react/src/components/AssetPanel.tsx:57-89`(组件 effect)
  - 释放:`packages/ui-react/src/store/assets-slice.ts:62-75`(store action)
- **问题**:创建在组件 effect、释放在 store action,二者跨边界,易出错(代码注释里已出现"B2 修复""review 报告修复"等反复修补痕迹)。AssetPanel 有"双重 cancel 检查"以避免孤儿 URL
- **影响**:有 cancel 检查防护,无已知泄漏,但跨边界协调脆弱
- **长期方案**:抽象 `useObjectUrl(blob)` hook,或在 store 内集中管理 `Map<id, url>`(创建+替换+释放统一),让 AssetPanel 只调用 `getThumbnail(id)`
- **为何暂不修**:当前有防护无泄漏,重构需改 assets-slice + AssetPanel + 多个消费组件,影响面大
- **触发条件**:出现 ObjectURL 泄漏相关的生产问题,或重构 assets-slice 时

---

## 6. 事件订阅 cleanup 模式分散

### TD-6.1 workflow-slice 三连订阅 + finally

- **位置**:`packages/ui-react/src/store/workflow-slice.ts:99-108, 166-170`
- **代码**:`const offStarted = runtime.eventBus.on('node:started', ...); ... finally { offStarted(); offFinished(); offNodeFailed(); }`
- **问题**:多事件一次性订阅 + 统一卸载样板
- **影响**:可读性略差,易漏 off
- **长期方案**:抽 `subscribeAll(eventBus, { type: handler })` 工具
- **为何暂不修**:仅此一处用三连订阅,抽象收益仅省 4 行
- **触发条件**:出现第 2 处多事件订阅时

### TD-6.2 runtime-slice 重入清理

- **位置**:`packages/ui-react/src/store/runtime-slice.ts:41, 52-57, 64-71`
- **代码**:`let offHistoryChanged: (() => void) | null = null; if (offHistoryChanged) { offHistoryChanged(); offHistoryChanged = null; } offHistoryChanged = runtime.eventBus.on(...);`
- **问题**:重入清理样板
- **影响**:可读性略差
- **长期方案**:可抽象,但与 TD-6.1 模式不同
- **为何暂不修**:仅此一处,抽象灵活性下降
- **触发条件**:同 TD-6.1

---

## 7. 测试环境 hack(记录备查,非债务)

> 这类是测试环境模拟的常见合理写法,均有恢复逻辑,非生产债务。

### TD-7.1 cancel-signal.test.ts 临时移除 self

- **位置**:`packages/engine-image/src/__tests__/cancel-signal.test.ts:215-217`
- **做法**:临时移除 `globalThis.self` 模拟 Node 环境无 self

### TD-7.2 history-store.test.ts 临时移除 indexedDB

- **位置**:`packages/runtime/src/__tests__/history-store.test.ts:159-161`
- **做法**:临时移除 `indexedDB` 全局模拟不可用环境

### TD-7.3 worker-host.test.ts 临时移除 randomUUID

- **位置**:`packages/runtime/src/__tests__/worker-host.test.ts:174-176`
- **做法**:临时移除 `crypto.randomUUID` 模拟降级

---

## Review 记录

### Review #5 — 2026-07-17 M6 阶段启动(W21.6 / W22.3-22.5 / W23.2-23.4)

- **范围**:M6 阶段启动批次——W21.6(内存泄漏修复 5 commit)+ W22.3(浏览器能力检测)+ W22.4(Firefox 降级 UI)+ W22.5(Playwright E2E 6 工具)+ W23.2/23.3/23.4(CONTRIBUTING / COC / Issue-PR 模板)
- **方法**:逐任务实施 + 单元测试 + E2E 验证(6 工具 spec 全绿)+ 文档与代码同步检查
- **验证结果**:
  - 五层架构单向依赖**无违规**(W21.6 仅扩展 runtime 内部 AssetStore 接口,未跨层;W22.3 browser-detect.ts 位于 runtime 层,被 apps/playground 消费,符合 UI→Runtime 单向依赖)
  - W22.3 `browser-detect.ts` 用 feature detection 优先 + UA 嗅探辅助,符合 AGENTS.md 不直接依赖具体浏览器的精神
  - W22.5 Playwright 配置 webServer.reuseExistingServer=!CI,CI 与本地复用策略分离合理
  - W23.4 Issue 模板含隐私优先提示(不粘贴真实用户文件/token),与项目 local-first 隐私定位一致
- **新债务登记**:**0 项**——本次批次未引入新技术债
  - W21.6 各 commit 均遵循 AGENTS.md 约定:engine-image bitmap 用 try/finally 释放、AssetStore dispose 幂等设计、wrapAssetStoreWithQuota 透传 dispose、File 用 `new File([blob], name, { type })`、EventBus emit 遍历副本 + try/catch
  - W22.3/W22.4 新增文件均为纯函数或 React 组件,无架构违规
  - W22.5 PNG fixture 用 Node zlib + 手工编码,不引入 sharp/canvas 测试依赖
  - W23.2-23.4 文档/模板/规范类工作,不涉及代码层
- **既有债务状态更新**:
  - **TD-5.1(UI ObjectURL 生命周期分散)状态保持活动,但已有防护加强**:W21.6 修复了 ObjectURL revoke 与监听器/timer cleanup 的具体泄漏点(be64b4a),ToolRunner/BatchQueue unmount abort 修复(23d41b9 / 759f858),但 TD-5.1 描述的"创建在组件 effect、释放在 store action,跨边界协调脆弱"的**架构层面**问题未重构,债务仍活动。长期方案(抽象 `useObjectUrl(blob)` hook 或 store 内集中管理 `Map<id, url>`)未落地,触发条件("出现 ObjectURL 泄漏相关的生产问题,或重构 assets-slice 时")未达
  - **TD-6.1 / TD-6.2(事件订阅 cleanup 模式分散)状态保持活动**:W21.6 未触及 workflow-slice / runtime-slice 的事件订阅 cleanup 模式,债务维持原状
  - **TD-3.x 系列(静默吞错)状态保持**:W21.6 新增的 `LokvisRuntime.dispose()` 内 cancel 调用复用 TD-3.1 的 `await this.cancel(workflowId).catch((err) => console.warn(...))` 模式,与既有 warn 模式一致,未引入新的静默吞错点
- **清偿**(见「已清偿」章节):本次 review 未清偿任何既有活动债务代码
- **决定不修**:本次 review 未重构 TD-5.1 / TD-6.1 / TD-6.2 的架构层面问题。理由:W21.6 的目标是修复**具体泄漏点**(异常路径 bitmap 未释放、unmount 时 workflow 未 abort、ObjectURL 未 revoke),而非重构架构;架构重构影响面大(需改 assets-slice + AssetPanel + 多个消费组件),应作为独立任务评估,不在 M6 启动批次范围内
- **下一步建议**:
  - TD-5.1 架构重构可考虑在 W21.6 全部子任务完成后作为单独 PR 评估
  - TD-3.x 系列建议接入 Sentry 后统一处理(W22.1 Sentry Top20 修复任务触发)

### Review #4 — 2026-07-15 全包审计与 TD 状态复核

- **范围**:基于 2026-07-15 全包审计(docs + packages + apps),复核 TD 状态并登记新债务
- **方法**:4 个并行 search subagent(runtime / plugin-engine-capability / schema-sdk-workflow-cli-mcp-ui / 文档一致性)+ 关键文件人工复核
- **验证结果**:
  - 五层架构单向依赖**无违规**(所有包 package.json + src import 合规)
  - Workflow 层已独立成包(`@lokvis/workflow`),P1-8 修复
  - runtime.ts God Object 已拆解(22 行 Facade + 5 个 manager),P1-5 修复
  - engine-audio/engine-ai 双向对应 plugin 已补齐,P1-6 修复
  - Capability Manifest codegen 已完整落地,ADR-013 应升 Accepted
  - MCP Server P0-1(createServer 返回 `{ server: null }`)已修复,三传输全部实装
- **新债务登记**:
  - TD-1.3 mcp-server image tools 直接用 sharp 绕过 Engine 层
  - TD-1.4 mcp-server pdf tools 直接用 pdf-lib 绕过 Engine 层
  - TD-1.5 mcp-server 硬编码 cloud URL / plan 名(耦合泄漏)
  - TD-3.5 ~ TD-3.11 共 7 处静默吞错(batch-progress / batch-processor / history / asset-store / opfs-asset-store / mcp-server)
  - TD-4.5 plugin-permissions.ts 三处 `as unknown as` 全局构造器/原型方法 monkey-patch 双断言
  - TD-4.6 sdk errors.ts best-effort message 模式匹配过渡方案
- **既有债务状态更新**:
  - TD-1.1 部分修复(NodeAssetStore 已实装)
  - TD-3.1 / 3.2 / 3.3 已部分修复(改为 warn,文件位置已迁移)
  - TD-4.2 行号修正(205 → 237)
- **清偿**(见「已清偿」章节 TD-C10 / TD-C11 / TD-C12):
  - TD-4.1(dialog.tsx 双断言)已清偿
  - TD-4.3(CLI 手写 type guard)已清偿
  - TD-4.4(exif-reader 嵌套类型)已清偿(v2.3 重构)
- **决定不修**:本次 review 未清偿任何既有活动债务代码,仅同步文档状态。理由:所有活动债务均评估为"有防护的局部 workaround"或"Phase 2 路线性取舍",无阻塞性问题
- **Phase 2 候选**:
  - TD-3.x 系列(静默吞错):接入 Sentry 后统一处理

### Review #3 — 2026-07-04 W12 Alpha 里程碑技术债复核

- **范围**:W12 里程碑(W12.1-W12.6 共 6 项任务)完成后的技术债状态复核
- **方法**:全量 typecheck + test + build 验证 + 文档与代码一致性检查
- **验证结果**:
  - typecheck 0 errors(9 包抽样:`@lokvis/playground` / `runtime` / `schema` / `sdk` / `ui-react` / `engine-image` / `plugin-image` / `cli` / `mcp-server`;非全量 36 包,详见 PR #14 Review #4 补充说明)
  - test 777/777 通过(42 测试文件,19.16s;PR #14 Review #4 修复后 sentry 测试从 12 重写为 26,总量 763→777)
  - build 20/20 任务通过(W12.2 基线)
- **新债务登记**:**0 项**——W12.1-W12.6 期间未引入新技术债
  - W12.1 Alpha 验收(报告):非代码任务,无债务引入
  - W12.2 性能基线(报告):非代码任务,识别 CodeMirror 444KB chunk 为 W21.3 优化候选(已记入 W12.2 报告,非新债务)
  - W12.3 Sentry 接入:新增 `sentry.ts` + `ErrorBoundary.tsx`,DSN 未配置时 no-op。**PR #14 Review #4 补充**:初版 `sentry.ts` 含 `as unknown as` 双断言(访问 `window.doNotTrack`),已在 PR #14 review 修复中改为 `navigator.doNotTrack` + `navigator.globalPrivacyControl` 直接访问,无需登记为 TD-4.5(已清偿)
  - W12.4 文档三页定稿:非代码任务,无债务引入
  - W12.5 README 重写:非代码任务,无债务引入
  - W12.6 LICENSE 审计:非代码任务,无债务引入
- **既有债务状态**:7 类 16 项技术债**全部维持原状**,无新增 / 无恶化
  - Phase 2 路线 2 项(TD-1.1 / TD-1.2):按 Phase 2 路线推进,不阻塞 Alpha
  - 测试时序 2 项(TD-2.1 / TD-2.2):CI 上未出现 flaky,触发条件未达
  - 静默吞错 4 处(TD-3.1 ~ TD-3.4):intentional cleanup,需 assetStore 错误类型分层才能根治
  - 类型 workaround 4 处(TD-4.1 ~ TD-4.4):局部小问题,收益低;TD-4.3 CLI 触发条件为 Phase 4 正式发布前
  - UI ObjectURL 2 处(TD-5.1):有防护无泄漏,重构影响面大
  - 事件订阅 cleanup 3 处(TD-6.1 / TD-6.2):仅一处用三连订阅,抽象收益不足
  - 测试环境 hack 3 处(TD-7.1 ~ TD-7.3):合理写法,非债务
- **决定不修**:本次 review 未清偿任何既有债务。理由:所有债务均评估为"有防护的局部 workaround"或"抽象收益不足"或"Phase 2 路线性取舍",无阻塞性问题。W12.7 缓冲期主要用于吸收 W12.1-W12.6 的进度偏差与文档同步,非激进重构窗口
- **Phase 2 候选**:以下债务建议在 Phase 2 启动时优先评估清偿:
  - TD-3.x(静默吞错):接入 Sentry 后,真实错误应上报而非静默吞掉
  - TD-5.1(ObjectURL):若重构 assets-slice,顺势抽象 `useObjectUrl` hook
  - TD-1.1(MCP Node 文件):Phase 2 MCP server v1 开发时落地

### Review #2 — 2026-07-04 PR #11 review 修复

- **范围**:PR #11 review 发现的 6 个问题(1 Blocker + 2 Major + 3 Minor)
- **清偿**(见「已清偿」章节 TD-C4/TD-C5/TD-C6/TD-C7/TD-C8/TD-C9):
  - TD-C4:[Blocker] 批量重试期间 input asset 孤儿累积 — 重试路径加 `removeAsset`
  - TD-C5:[Major] createPluginContext 降级错误类型 — 恢复 `AssetNotFoundError`
  - TD-C6:[Major] OPFS removeEntry 对所有错误都 warn — 区分 NotFoundError
  - TD-C7:[Minor] PDF merge derivePdfMetadata 语义不准确 — 改签名只接受 outBlob
  - TD-C8:[Minor] persistHistory fire-and-forget 无错误处理 — 内部加 try/catch
  - TD-C9:[Minor] batch:completed 事件语义模糊 — 加注释说明语义

### Review #1 — 2026-07-04 架构 review

- **范围**:全项目 18 个包,聚焦五层架构依赖方向、短期方案、重复代码
- **方法**:3 个并行 search subagent(跨层引用 / 短期方案 / 重复代码)
- **发现**:
  - 五层架构单向依赖**无违规**(所有包 package.json + src import 合规)
  - 无 `@vite-ignore`、无变量驱动动态 import、无字符串硬编码包名
  - 识别 7 类已知技术债务(本文档)
- **清偿**(commit `f194cb9`,见「已清偿」章节 TD-C1/TD-C2/TD-C3):
  - 抽象 `createBlobCapabilityImpl` 工厂消除 plugin-* 三份重复
  - 统一 worker-host transport 清理逻辑
  - 修复 exif-reader 手动剔除字段 patch
- **决定不修**:7 类债务(见上文),均评估为"有防护的局部 workaround"或"抽象收益不足"

---

## 已清偿

### TD-C1 plugin-* wrapAsImplementation 三份重复(2026-07-04 清偿)

- **原债务**:plugin-image / plugin-video / plugin-pdf 各有一份近乎逐字相同的 `wrapAsImplementation` + `deriveOutputMetadata`(每份 ~33 行)
- **清偿方案**:plugin-sdk 新增 `createBlobCapabilityImpl` 工厂,封装"取 blob → operation → metadata → createAsset → 进度/取消"五步样板
- **清偿 commit**:`f194cb9`(PR #11)

### TD-C2 worker-host transport 清理三处重复(2026-07-04 清偿)

- **原债务**:`worker-host.ts` 的 `dispose()` / `spawn()` catch / `teardownTransport()` 三处重复的 `offMessage/offError/terminate/null` 清理
- **清偿方案**:`dispose()` 和 `spawn()` catch 改为调用 `teardownTransport()`
- **清偿 commit**:`f194cb9`(PR #11)

### TD-C3 exif-reader 手动剔除字段 patch(2026-07-04 清偿)

- **原债务**:`exif-reader.ts` 先构造 `RawExifData` 再 `const { raw: _raw, ...exifData } = data; void _raw` 解构删 raw 的 patch
- **清偿方案**:直接构造 `ExifData`,不构造 RawExifData。RawExifData 类型保留在 schema 供未来调试场景
- **清偿 commit**:`f194cb9`(PR #11)

### TD-C4 批量重试期间 input asset 孤儿累积(2026-07-04 清偿,Review #2)

- **原债务**:`batch-processor.ts` processItem 重试路径(attempts <= maxRetries)只回退 status 为 pending,不清理 inputAssetId。下次重试重新 import 产生新 input,前一次 input 成为孤儿。maxRetries=3 全失败会累积 3 个孤儿 input
- **清偿方案**:重试路径加 `removeAsset(inputAssetId).catch(() => {})` 清理上一次失败的 input
- **清偿 commit**:`(PR #11,Review #2)`

### TD-C5 createPluginContext 降级错误类型(2026-07-04 清偿,Review #2)

- **原债务**:`sdk/src/index.ts` getAsset 用 `throw new Error('Asset not found: ...')` 替代 `throw new AssetNotFoundError(id)`,导致 `err instanceof AssetNotFoundError` 判断失效
- **清偿方案**:恢复 `throw new AssetNotFoundError(id)`,import AssetNotFoundError
- **清偿 commit**:`(PR #11,Review #2)`

### TD-C6 OPFS removeEntry 对所有错误都 warn(2026-07-04 清偿,Review #2)

- **原债务**:`opfs-asset-store.ts` remove 对所有错误(包括无害的 NotFoundError)都 console.warn,产生噪音
- **清偿方案**:区分 NotFoundError(静默忽略)和其他错误(warn),继续清理 IDB metadata
- **清偿 commit**:`(PR #11,Review #2)`

### TD-C7 PDF merge derivePdfMetadata 语义不准确(2026-07-04 清偿,Review #2)

- **原债务**:`plugin-pdf/src/operations.ts` derivePdfMetadata 返回 `(source, outBlob) => AssetMetadata`,但内部只用 outBlob(不读 source)。merge 传 `inputs[0]` 作为 source 语义暗示输出与第一个输入有关系,造成歧义
- **清偿方案**:derivePdfMetadata 改签名只接受 `(outBlob) => AssetMetadata`。single kind 传给工厂时用包装层 `(_source, outBlob) => derive(outBlob)` 适配工厂签名
- **清偿 commit**:`(PR #11,Review #2)`

### TD-C8 persistHistory fire-and-forget 无错误处理(2026-07-04 清偿,Review #2)

- **原债务**:`runtime.ts` persistHistory 内部无 try/catch,调用方用 `void this.persistHistory(...)`,IDB 故障(数据库关闭/quota exceeded)会变成 unhandled promise rejection
- **清偿方案**:persistHistory 内部加 try/catch + console.warn,失败只 warn 不抛(非关键路径)。不改 fire-and-forget 语义,不加上报机制
- **清偿 commit**:`(PR #11,Review #2)`

### TD-C9 batch:completed 事件语义模糊(2026-07-04 清偿,Review #2)

- **原债务**:`batch-processor.ts` maybeComplete 对 failed>0 的 job 也发 batch:completed 事件,对新消费方造成困惑(事件名暗示"全部成功")
- **清偿方案**:在 emit 处加注释说明"事件名表示所有项已终结(含部分失败),消费方应通过 payload.failed 区分"
- **清偿 commit**:`(PR #11,Review #2)`

### TD-C10 ui-core dialog.tsx Vite HMR 双断言(2026-07-15 清偿,Review #4)

- **原债务**(原 TD-4.1):`packages/ui-core/src/components/dialog.tsx:41` `(import.meta as unknown as { hot?: ViteHotContext }).hot`。为访问 `import.meta.hot`(仅 Vite dev 提供),因本包是纯 TS 库未引入 `vite/client` 类型声明,只能双断言
- **清偿方案**:在 `dialog.tsx:1` 加 `/// <reference types="vite/client" />`,tsconfig.json 已引入 vite 类型,行 41 改为直接 `if (import.meta.hot) {`,无双断言
- **清偿验证**:`packages/ui-core/src/components/dialog.tsx:1` 有 reference 指令,`:41` 无 `as unknown as`
- **清偿来源**:本 PR T5 任务(同步 TD 状态)

### TD-C11 cli run.ts 手写 type guard(2026-07-15 清偿,Review #4)

- **原债务**(原 TD-4.3):`packages/cli/src/commands/run.ts:74` `const w = wf as Record<string, unknown>; if (typeof w.id !== 'string') throw ...` 手写 type guard 逐字段 typeof 校验
- **清偿方案**:`run.ts:52-65` 改为直接调用 `validateWorkflow(raw)` 自 `@lokvis/schema`(zod 校验器,含形状 + 保留字 + 唯一性 + DAG 检查)。注释明确"不再在 CLI 侧手写 typeof 系列校验 —— 那会与 schema 校验规则漂移"
- **清偿验证**:`grep 'typeof .* ===' cli/src/` 无 type guard 命中(仅 `__tests__/runner.test.ts:31` 的 stdout 写入判断)
- **清偿来源**:本 PR T5 任务(同步 TD 状态)

### TD-C12 exif-reader 丢失 exifr 嵌套类型(2026-07-15 清偿,Review #4)

- **原债务**(原 TD-4.4):`packages/plugin-image/src/exif-reader.ts:74` `data.raw = parsed as Record<string, unknown>;` 把 exifr 返回的 `parsed` 强转为 `Record<string, unknown>`,丢失 exifr 实际嵌套类型信息
- **清偿方案**:v2.3 重构后 RawExifData 不再在主路径使用,`data.raw` 赋值行已删除。RawExifData 类型保留在 schema 供未来调试场景,但不再有类型强转
- **清偿验证**:`grep 'as Record<string, unknown>' plugin-image/src/exif-reader.ts` 无命中
- **清偿来源**:本 PR T5 任务(同步 TD 状态,确认 v2.3 重构已清偿)

### TD-C13 plugin-permissions.ts 全局构造器/原型方法 monkey-patch 双断言(2026-07-15 清偿)

- **原债务**(原 TD-4.5):`packages/runtime/src/plugin-permissions.ts:186, 196, 209` 三处 `as unknown as typeof XMLHttpRequest.prototype.open` / `typeof WebSocket` / `typeof EventSource` 双断言。网络守卫沙箱用返回 `never` 的拦截函数替换原生重载签名方法,TS 不允许 `() => never` 直接赋值给带重载/带 prototype 的原生函数类型,故用双断言绕过
- **违反**:AGENTS.md "禁止 `as unknown as` 双断言……唯一的例外是 Worker scope 等跨边界场景"。此 3 处属全局构造器/原型方法 monkey-patch 跨边界,未在明文例外内
- **清偿方案**:改用 `Object.defineProperty(target, key, { value, writable: true, configurable: true })` 替代直接赋值。`PropertyDescriptor.value` 类型为 `any`,无需为 `() => never` 与原生重载签名的不兼容做双断言;`writable`/`configurable` 显式为 true,与原生原型方法/全局构造器描述符一致。restore 函数仍用类型安全的直接赋值(`origXHRopen` 等已具原生类型)
- **清偿验证**:`grep 'as unknown as' packages/runtime/src/plugin-permissions.ts` 仅命中注释(无生产代码双断言);`plugin-permissions.test.ts` 25 个用例全绿(fetch/XHR.open/WebSocket/EventSource 拦截 + restore + 嵌套守卫)
- **清偿来源**:本 PR T8 任务

### TD-C14 mcp-server image tools 直接用 sharp 绕过 Engine 层(2026-07-15 清偿)

- **原债务**(原 TD-1.3):`packages/mcp-server/src/tools/image.ts` 直接 `import sharp from 'sharp'`,resize/compress/convert 三个 tool handler 各自构建 sharp pipeline 处理本地文件,绕过 `@lokvis/engine-image-node`(Engine 层)。文件头注释自认"M2.1 阶段直接使用 sharp;M2.2 后将封装到 engine-image-node 包"
- **违反**:ADR-011 设计意图"MCP server 通过 Engine 层暴露能力";AGENTS.md 五层架构 Engine 层职责(Blob↔Blob 纯函数)。mcp-server 与 `plugin-image/node-plugin.ts` 形成两套平行的 Node sharp 路径
- **清偿方案**:image tool handlers 改为经 `@lokvis/engine-image-node` 暴露的 Blob↔Blob 操作(`resize`/`compress`/`convert`)调用。mcp-server 作为 Node 应用直接消费 Engine 层(tool handler 自行做 file-path ↔ Blob 翻译),与浏览器侧 Runtime→Capability→Engine 链路对齐。新增 `getMetadata(blob)` 到 engine-image-node(与 engine-image 的 `decode` 返回 dimensions 语义一致),供 tool 报告尺寸/格式。sharp 从 mcp-server dependencies 移到 devDependencies(测试用 sharp 生成 fixture 与验证输出)
- **清偿验证**:`grep "from 'sharp'" packages/mcp-server/src/tools/image.ts` 无命中;`image.test.ts` 17 个用例全绿;`engine-image-node` operations 测试 30 个用例全绿;`mcp-server` 全量 146 个用例全绿
- **清偿来源**:本 PR T9a 任务
- **未清偿关联**:TD-1.4(pdf 侧)仍活动 —— engine-pdf 为 stub,需 T9b 实装 engine-pdf 的 merge/compress Blob↔Blob 操作后清偿

### TD-C15 mcp-server pdf tools 直接用 pdf-lib 绕过 Engine 层(2026-07-15 清偿)

- **原债务**(原 TD-1.4):`packages/mcp-server/src/tools/pdf.ts` 直接 `import { PDFDocument } from 'pdf-lib'`,merge/compress 两个 tool handler 各自调用 pdf-lib 处理本地文件,绕过 `@lokvis/engine-pdf`(Engine 层)。文件头注释自认"M2.1 阶段直接使用 pdf-lib;M2.2 后将封装到 engine-pdf 包"。额外复杂度:engine-pdf 当前的 `PdfEngineAdapter`(pdfLibEngine/pdfjsEngine)是 stub(version 含 'stub'),能力系统绑定的 adapter 方法全部抛 not implemented
- **违反**:ADR-011 设计意图"MCP server 通过 Engine 层暴露能力";AGENTS.md 五层架构 Engine 层职责(Blob↔Blob 纯函数)。与 T9a 清偿的 image 侧形成对称问题
- **清偿方案**:
  1. 新增 `packages/engine-pdf/src/operations.ts`,实装三个 Blob↔Blob 纯函数:`mergePdfs(blobs, params)` / `compressPdf(blob, params)` / `getPdfInfo(blob)`。pdf-lib 经动态 `import('pdf-lib')` 加载(浏览器侧 plugin-pdf 只导入 PdfEngineAdapter stub,不会拉入 pdf-lib)。为跨端类型安全(AGENTS.md:engine-pdf tsconfig 不含 `types: ['node']`),仅用标准 `Blob`/`ArrayBuffer`/`Uint8Array`,通过 `uint8ToBlobPart(bytes)`(`bytes.buffer.slice(...) as ArrayBuffer`)做 Uint8Array→BlobPart 转换,不用 Node 专属 Buffer
  2. `engine-pdf/src/index.ts` 导出独立 operations(`PdfEngineAdapter` 仍为 stub,供能力系统绑定;独立 operations 供不经能力系统的 Node 消费方直接调用,与 engine-image-node 的 operations/ 模式对齐)
  3. `engine-pdf/package.json` 加 `pdf-lib` 到 dependencies
  4. pdf tool handlers 改为经 `@lokvis/engine-pdf` 的 Blob↔Blob 操作调用,tool handler 自行做 file-path ↔ Blob 翻译(与 T9a image.ts 一致)。页数报告改用 `getPdfInfo(outBlob)`
  5. `pdf-lib` 从 mcp-server dependencies 移到 devDependencies(测试用 pdf-lib 生成 fixture 与验证输出)
- **清偿验证**:`grep "from 'pdf-lib'" packages/mcp-server/src/tools/pdf.ts` 无命中;`pdf.test.ts` 17 个用例全绿;mcp-server 全量 146 个用例全绿;engine-pdf typecheck/build 通过
- **清偿来源**:本 PR T9b 任务
- **架构说明**:与 T9a 一致,mcp-server 作为 Node 应用直接消费 Engine 层 Blob↔Blob 操作,不经 Runtime/Capability 系统(Runtime 无公开 `capabilities.execute()`,execute 签名是 `Asset[]→Asset[]` 非 `Blob→Blob`;强行经 Runtime 属过度工程)。PdfEngineAdapter 仍为 stub,未来 plugin-pdf/node 实装时 adapter 方法可委托到 operations.ts,version 升为非-stub。capability 系统对接仍属 Phase 2(见 TD-1.1)

### TD-C16 sdk errors.ts message 模式匹配过渡方案(2026-07-15 清偿)

- **原债务**(原 TD-4.6):`packages/sdk/src/errors.ts:361-389` 用 `msg.startsWith('Asset not found')` 等 6 个 message 前缀模式匹配恢复类型,注释自认过渡方案。runtime 层抛的是 `new Error(message)` 而非类型化错误类,SDK 被迫用字符串匹配。runtime message 文案变更会让 SDK 静默退化为 `LokvisError({ code: 'UNKNOWN' })`,消费方的 `instanceof AssetNotFoundError` 失效
- **违反**:SDK 错误类型恢复依赖 runtime message 文案稳定性,脆弱。原 TD-4.6 注释明确"后续 runtime 层应抛类型化错误,届时可移除此层"
- **清偿方案**:
  1. runtime 新增 `packages/runtime/src/errors.ts`,定义 7 个类型化错误类(继承 `Error`,与 runtime 现有错误类风格一致:super message + `this.name` + readonly 属性):
     - `AssetNotFoundError(assetId)` — 替代 3 处 `throw new Error('Asset not found: ...')`(asset-manager / plugin-context / executor)
     - `AssetBlobNotFoundError(message)` — 替代 3 处 `throw new Error('Blob not found ...')`(memory/opfs/idb asset-store)
     - `WorkflowInvalidError(message)` — 替代 `throw new Error('Workflow contains duplicate node id: ...')`
     - `WorkflowCycleError(message)` — 替代 `throw new Error('Workflow contains a cycle, cannot execute')`
     - `WorkflowNodeError(nodeId, message)` — 替代 `throw new Error('Transform node "..." has no capability')`,带 nodeId 属性(SDK 不再需从 message 正则提取)
     - `CapabilityNotRegisteredError(capability)` — 替代 `throw new Error('No implementation registered for capability "..."')`,带 capability 属性
     - `CapabilityStubOnlyError(capability)` — 替代 `throw new Error('Capability "..." is not yet available (only stub engine registered)...')`。**额外修复**:原 SDK 有 `CAPABILITY_STUB_ONLY` code 定义但无对应 message/instanceof 分支,stub-only 错误落入 `UNKNOWN`;本次新增 instanceof 分支修复此缺陷
  2. runtime `index.ts` 加 `export * from './errors.js'`(与现有错误类通过 `export *` 透出模式一致)
  3. SDK `errors.ts` 从 `@lokvis/runtime` import 7 个类(加 `Runtime` 前缀别名,与 QuotaExceededError 等现有模式一致),`fromLokvisError()` 新增 7 个 instanceof 分支,删除 message 模式匹配分支(L361-389)。归一优先级从 5 层精简为 4 层(移除"message 匹配"层)
  4. super message 与原 `throw new Error(...)` 完全一致,保证日志/堆栈输出不变、依赖 message 文案的测试不破
- **清偿验证**:`grep "startsWith" packages/sdk/src/errors.ts` 无命中;runtime 497 测试全绿;SDK 测试全绿;mcp-server 146 测试全绿;runtime/sdk typecheck 通过
- **清偿来源**:本 PR T10 任务
- **设计说明**:错误类定义在 runtime(非 schema),因为 schema 是纯类型定义层(不含运行时 Error 类);runtime 已有 13 个错误类(QuotaExceededError / Worker*Error 等)分散在各模块,新增的 7 个跨模块共用类集中放在 `errors.ts` 更合理。SDK 自身仍定义同名 LokvisError 子类作为公共契约,runtime 侧继承 Error(不依赖 SDK,符合五层架构)
