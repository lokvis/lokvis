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
| Phase 2 路线 | 2 项 | 中 | 按 Phase 2 路线推进 |
| 测试时序依赖 | 2 项 | 中 | 需改生产 API 语义,专项评估 |
| 静默吞错 | 4 处 | 低 | intentional,需 assetStore 错误类型分层才能根治 |
| 类型层面 workaround | 4 处 | 低 | 局部小问题,收益低 |
| UI ObjectURL 生命周期分散 | 2 处 | 中 | 有防护,重构影响面大 |
| 事件订阅 cleanup 模式分散 | 3 处 | 低 | 各有特殊点,抽象灵活性下降 |
| 测试环境 hack | 3 处 | 低 | 合理写法,非债务(记录备查) |

**净评估**:无阻塞性债务。Phase 2 路线的 2 项是已知的功能性取舍,其余均为"有防护的局部 workaround"或"抽象收益不足"的项目。

---

## 1. Phase 2 路线(功能性短期取舍)

### TD-1.1 mcp-server Node 降级模式无法读写本地文件

- **位置**:`packages/mcp-server/src/server.ts:144`
- **问题**:Node 降级模式使用默认内存/OPFS store,无法读写本地文件。代码注释 `// TODO Phase 2: 用 options.workdir 创建 NodeAssetStore 注入 runtime`
- **影响**:MCP server 在 Node 环境下只能处理内存中的 Asset,无法持久化到磁盘
- **长期方案**:用 `options.workdir` 创建 `NodeAssetStore` 注入 runtime,使 Node 降级模式可读写本地文件
- **为何暂不修**:已明确记入 Phase 2 路线,当前 MVP 阶段 MCP server 仅做接口验证,无本地文件读写需求
- **触发条件**:Phase 2 启动 MCP Server v1 开发时

### TD-1.2 批量队列状态不持久化

- **位置**:`packages/runtime/src/batch-processor.ts:14-17`
- **问题**:批量队列状态不持久化,刷新即丢。代码注释明确"持久化批量进度属 Phase 2"
- **影响**:用户刷新页面后批量任务进度丢失,需重新发起
- **长期方案**:持久化批量进度到 IndexedDB,支持跨会话恢复
- **为何暂不修**:W6 主要保证 Asset 持久化,批量队列是临时调度结构,刷新后由 UI 重新发起即可。Phase 2 再做持久化
- **触发条件**:Phase 2 或用户反馈批量恢复需求

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

- **位置**:`packages/runtime/src/runtime.ts:429-431`
- **代码**:`await this.cancel(workflowId).catch(() => { /* 工作流可能未在运行 */ });`
- **问题**:cancel 失败被完全吞掉,只注释说"可能未在运行",但 Worker 崩溃 / executor 异常等真实错误也会被一并忽略
- **影响**:生产环境难调试 cancel 失败的真实原因
- **长期方案**:区分 "not found / 未运行" 与真实错误,后者 log/上报
- **为何暂不修**:intentional cleanup 模式,改需给 cancel 加错误类型分层
- **触发条件**:出现 cancel 失败相关的生产问题

### TD-3.2 removeAsset cleanup 静默吞错

- **位置**:`packages/runtime/src/runtime.ts:716-718`
- **代码**:`this.assetStore.remove(assetId).catch(() => {});`
- **问题**:注释说"忽略不存在",但 catch 实际吞掉所有错误(OPFS 写失败、IDB 事务失败等)
- **影响**:存储层故障完全静默
- **长期方案**:判断错误类型后再决定是否忽略,真实错误应 log/上报
- **为何暂不修**:intentional cleanup,改需 assetStore 错误类型分层
- **触发条件**:出现存储层故障相关的生产问题

### TD-3.3 batch-processor 清理孤儿资产静默吞错

- **位置**:`packages/runtime/src/batch-processor.ts:500, 557`
- **代码**:`void this.runtime.removeAsset(inputAssetId).catch(() => {});`
- **问题**:cancel 期间清理刚导入的 input,吞所有错误
- **影响**:同 TD-3.2
- **长期方案**:同 TD-3.2
- **为何暂不修**:同 TD-3.2
- **触发条件**:同 TD-3.2

### TD-3.4 exif-reader 解析失败静默返回 null

- **位置**:`packages/plugin-image/src/exif-reader.ts:81-84`
- **代码**:`} catch { return null; }`
- **问题**:catch 吞掉所有 exifr 异常(包括 exifr 库自身 bug、文件 I/O 错误),生产环境难调试
- **影响**:无法区分"无 EXIF"与"解析抛错"
- **长期方案**:至少通过 `ctx.log('warn', ...)` 或上报可观测信号,区分"无 EXIF"与"解析异常"
- **为何暂不修**:exif-reader 是纯函数(无 ctx),改需调整 MetadataReader 签名传 ctx;且"无 EXIF"是常见场景,静默返回 null 不影响 UX
- **触发条件**:出现 EXIF 解析相关的生产问题,或接入可观测系统时

---

## 4. 类型层面 workaround

### TD-4.1 ui-core dialog.tsx Vite HMR 双断言

- **位置**:`packages/ui-core/src/components/dialog.tsx:41`
- **代码**:`(import.meta as unknown as { hot?: ViteHotContext }).hot`
- **问题**:为访问 `import.meta.hot`(仅 Vite dev 提供),因本包是纯 TS 库未引入 `vite/client` 类型声明,只能双断言
- **影响**:类型安全减弱,但注释已说明这是有意的 cast 守卫
- **长期方案**:引入 `vite/client` 类型声明或抽 hot 模块
- **为何暂不修**:收益低,ui-core 是纯库不应依赖 vite 类型
- **触发条件**:ui-core 引入 vite 类型时

### TD-4.2 schema workflow.ts 强转加字段

- **位置**:`packages/schema/src/workflow.ts:205`
- **代码**:`(schema.properties as Record<string, unknown>).input_path = { type: 'array', ... };`
- **问题**:`schema.properties` 本是具体 JSON Schema 类型,此处强转 `Record<string, unknown>` 以便动态加字段
- **影响**:类型安全减弱
- **长期方案**:把 `properties` 类型设计为允许任意键的索引签名类型
- **为何暂不修**:JSON Schema 动态加字段是合理用法,改动 schema 类型影响面大
- **触发条件**:重构 workflow schema 类型时

### TD-4.3 cli run.ts 手写 type guard

- **位置**:`packages/cli/src/commands/run.ts:74`
- **代码**:`const w = wf as Record<string, unknown>; if (typeof w.id !== 'string') throw ...`
- **问题**:手写 type guard 逐字段 typeof 校验
- **影响**:校验逻辑散落,易遗漏字段
- **长期方案**:引入 zod 校验
- **为何暂不修**:CLI 是 Phase 4 才正式发布,当前仅最小 `run` 命令
- **触发条件**:CLI 正式发布前

### TD-4.4 exif-reader 丢失 exifr 嵌套类型

- **位置**:`packages/plugin-image/src/exif-reader.ts:74`
- **代码**:`data.raw = parsed as Record<string, unknown>;`(注:此行已在 v2.3 重构中删除,但若未来重新引入 RawExifData 调试场景会再次出现)
- **问题**:把 exifr 返回的 `parsed` 强转为 `Record<string, unknown>`,丢失 exifr 实际嵌套类型信息
- **影响**:后续若做 schema 校验或字段访问会失去类型保护
- **长期方案**:exifr 实际返回结构复杂(嵌套对象 / Date / 数组),类型化成本高,可考虑引入 exifr 的类型定义或自定义 zod schema
- **为何暂不修**:v2.3 重构后 RawExifData 不再在主路径使用,仅保留类型供未来调试场景
- **触发条件**:重新引入 RawExifData 调试面板时

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
