# 技术债务登记簿（Technical Debt Register）

> 本文档记录 lokvis-open 项目中**已知但暂不修复**的技术债务,按类别分类,每项含位置、问题、影响、长期方案、暂不修复原因与触发条件。
>
> **维护规则**:新增债务须在此登记;债务清偿后直接删除记录(避免误导)。每次架构 review(见文末「Review 记录」)后更新。
>
> **生成来源**:2026-07-04 架构 review(见文末「Review 记录」第 1 条)。

---

## 债务分类总览

| 类别 | 数量 | 严重度 | 处理策略 |
|---|---|---|---|
| Phase 2 路线 | 2 项 | 中 | 按 Phase 2 路线推进(TD-1.3/TD-1.4/TD-1.5 已清偿) |
| 测试环境 hack | 3 处 | 低 | 合理写法,非债务(记录备查) |

**净评估**:无阻塞性债务。剩余 2 项是已知的功能性取舍(Phase 2 路线),其余技术债已全部清偿(详见 Review #9)。

---

## 1. Phase 2 路线(功能性短期取舍)

### TD-1.1 mcp-server Node 降级模式无法读写本地文件

- **状态**:🟡 部分修复(NodeAssetStore 已实装,但未完全替代默认 store)
- **位置**:`packages/mcp-server/src/server.ts:144`、`packages/mcp-server/src/node-asset-store.ts:74-144`
- **问题**:原描述"使用默认内存/OPFS store,无法读写本地文件"已部分修复 —— `NodeAssetStore` 基于 `fs/promises` + `workdir` 实装,但未完全替代默认 store 路径。
- **影响**:Node 环境已可读写本地文件,但与 runtime capability 系统的集成未完成(image/pdf 已改经 Engine 层直接消费;capability 系统对接仍待 Phase 2)
- **长期方案**:完成 mcp-server 与 runtime capability 系统的对接(image/pdf 侧已走 Engine 层 Blob↔Blob 直接消费)
- **为何暂不修**:已明确记入 Phase 2 路线,NodeAssetStore 已满足当前 5 个 tool 的文件读写需求
- **触发条件**:Phase 2 MCP Server v1 与 runtime capability 系统对接完成时

### TD-1.2 批量队列状态不持久化

- **位置**:`packages/runtime/src/batch-processor.ts:14-17`
- **问题**:批量队列状态不持久化,刷新即丢。代码注释明确"持久化批量进度属 Phase 2"
- **影响**:用户刷新页面后批量任务进度丢失,需重新发起
- **长期方案**:持久化批量进度到 IndexedDB,支持跨会话恢复
- **为何暂不修**:W6 主要保证 Asset 持久化,批量队列是临时调度结构,刷新后由 UI 重新发起即可。Phase 2 再做持久化
- **触发条件**:Phase 2 或用户反馈批量恢复需求

---

## 2. 测试环境 hack(记录备查,非债务)

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

### Review #9 — 2026-07-17 技术债务集中清偿(长期方案落地)

- **范围**:按用户要求"按照 docs/technical-debt.md 文档,进行技术债务清理,要求按照长期方案进行解决,不允许短期方案"——集中清偿 7 类 12 项活动债务
- **方法**:逐项按"长期方案"实装,严禁短期方案;每项清偿后跑 `pnpm typecheck` + `pnpm test:fast` 验证;最终全量 typecheck 48/48 + test 1484/1484 全绿
- **清偿清单**(共 12 项):

  | 债务 | 长期方案 | commit |
  |---|---|---|
  | TD-1.5 | mcp-server cloud URL/plan/credits 抽到 `@lokvis/cloud-bridge` 独立包,`CloudConfig` 接口 + `resolveCloudConfig(env)` 从 env 读取,mcp-server 通过 `cloud?` 参数注入 | `1e7363e`(PR #29) |
  | TD-2.1 | `disposeHistory`/`disposeAll` 改为 `async ... Promise<void>`,末尾 `await persistHistory` 落地;`workflow-coordinator.disposeWorkflow` 与 `runtime.dispose` 同步加 await;测试移除 50ms × 20 次轮询,直接 `await runtime.disposeWorkflow` 后断言 | `b23489b` |
  | TD-2.2 | BatchProcessor 暴露 `waitForItemsStarted(jobId, count, timeoutMs=5000)` 方法,基于"当前 processing 快照 + batch:item:started 事件订阅"双重判定,替代 5 处固定 5-20ms setTimeout | `2a2491d` |
  | TD-3.1/3.2/3.3 | cleanup catch 真实错误用 `console.error` 级别记录(workflow-coordinator / history-manager / batch-scheduler) | `3103c54` |
  | TD-3.4/3.9 | MetadataReader 接收 `ctx` 参数,exif-reader 与 asset-store 的 extractRichMetadata 通过 `ctx.log('warn', ...)` 区分"无 EXIF"与"解析异常" | `0ce0b95` |
  | TD-3.5/3.6/3.7/3.8/3.10/3.11/3.12 | batch-progress / BatchProcessor.cancel / history onEvict / opfs-asset-store / mcp-server cleanup / BatchQueue unmount 全部改为 warn/error + 保留 cause | `bdb0f7d` |
  | TD-4.2 | schema workflow.ts 的 `properties` 类型改为允许任意键的索引签名类型,消除 `as Record<string, unknown>` 强转 | `bbd8235` |
  | TD-5.1 | 缩略图 ObjectURL 生命周期集中到 store:新增 `ensureThumbnails()` 方法(iterate assets → exportAsset → createObjectURL → setThumbnail,内部 inflight 去重 + 资产存在性检查),`setThumbnail` 替换时自动 revoke 旧 URL,AssetPanel 移除跨边界 effect 与 inflightRef | `2ac73ad` |
  | TD-6.1+6.2 | 抽 `subscribeAll(eventBus, handlers)` + `reuseSubscription(off)` 两个工具,workflow-slice 三连订阅与 runtime-slice 重入清理统一复用 | `bd1c415` |

- **验证结果**:
  - 五层架构单向依赖**无违规**:TD-1.5 新增 cloud-bridge 包位于 mcp-server 上游;TD-3.4/3.9 在 plugin-image + runtime 内;TD-5.1 仅在 ui-react 层;TD-6.1/6.2 在 ui-react 内抽工具
  - 全量 typecheck 48/48 通过(0 errors)
  - 全量 `pnpm test:fast` 83 文件 / 1484 测试 / 0 失败
  - 无 `as unknown as` 双断言、无 eslint-disable、无 `.catch(() => {})` 静默吞错、无 `new Array(singleArgument)` 违规
- **新债务登记**:**0 项**——本次清偿严格按长期方案实装,未引入任何短期方案或新债务
- **既有债务状态更新**:
  - 7 类 12 项活动债务全部清偿,只剩 2 项 Phase 2 路线性取舍(TD-1.1/1.2)+ 3 项测试环境 hack(TD-7.1/7.2/7.3,非债务)
  - 历史已清偿记录(TD-C1 ~ TD-C16)按用户要求"对已偿还的部分,可以直接删除记录,避免误导"全部移除,统一并入 Review 历史记录
- **设计说明**:
  - TD-2.1 两次 persistHistory 幂等性:`disposeHistory` 内 `stack.reset()` 触发 `onChanged` → fire-and-forget `void persistHistory(wfId)`(删除空记录),随后显式 `await persistHistory(wfId)` 也删除同一记录。两次 delete 幂等,historyStore.delete 对不存在的 key 无副作用,无竞态
  - TD-2.2 `waitForItemsStarted` 快照即时 resolve:schedule 循环内同步设置 `item.status='processing'` 并发 `batch:item:started`,`enqueue` 返回时首批项通常已进入 processing。因此先快照当前 processing 数,若已 >= count 立即 resolve(0ms),事件订阅仅兜底异步场景
  - TD-5.1 闭包 inflightThumbnails 设计:用闭包捕获 `Set<string>` 而非放入 store state,因为 inflight 是实现细节(非 UI 需要响应的数据),放入 state 会触发额外 re-render
- **文档处理**:按用户要求"对已偿还的部分,可以直接删除记录,避免误导",本次 review 后:
  - TD-1.3 / TD-1.4 / TD-1.5 / TD-2.1 / TD-2.2 / TD-3.1~3.12 / TD-4.2 / TD-4.6 / TD-5.1 / TD-6.1 / TD-6.2 正文条目删除
  - 整个「已清偿」章节(TD-C1 ~ TD-C16)删除,清偿信息保留在各 Review 记录中
  - 顶部「债务分类总览」更新数量(从 7 类 12+ 项活动债务 → 2 类 2 项活动债务 + 1 类 3 项非债务)

### Review #8 — 2026-07-17 PR #31 lint 修复 + merge conflict review

- **范围**:修复 PR #31 CI lint 错误(`no-new-array`)+ 解决 PR #31 与 dev 分支的 4 个 merge conflict + 全量 review PR #31 是否存在 workaround
- **方法**:
  1. 定位 lint 错误 `apps/playground/tests/fixtures/images.ts:13` `new Array(256)`,改为 `Array.from({ length: 256 })`(lint 规则推荐写法,语义等价)
  2. 解决 4 个 merge conflict:
     - `vitest.config.ts`:保留 HEAD 的宽泛 include `packages/engine-image/src/**/*.ts`(已覆盖 src/node),移除 dev 冗余条目
     - `packages/engine-image/package.json`:`./lazy.js` exports 指向 `./src/lazy.ts`(与 main/index 一致)
     - `packages/engine-image/src/__tests__/node-operations.test.ts`:采用 dev 的更完整注释(M2.2 验收标准 + 迁移来源)
     - `packages/mcp-server/src/cli.ts`:采用 HEAD 架构(createLokvisMcpServer 接受 cloud 参数,内部封装 authenticator/billing)
  3. 用 search subagent 扫描 PR #31 范围(origin/dev..HEAD)内 5 类 workaround 模式:`as unknown as` 双断言 / TODO-FIXME-HACK 注释 / eslint-disable-ts-ignore / `.catch(() => {})` 静默吞错 / `new Array(` 单参数
- **验证结果**:
  - lint 修复后 `pnpm lint` 全绿(0 warnings, 0 errors)
  - merge conflict 解决后 `pnpm typecheck` 48 tasks 0 errors;`pnpm test:fast` 83 files / 1480 tests / 0 failed
  - PR #31 范围内 5 类 workaround 模式扫描结论:**0 处需修复**
- **新债务登记**:**1 项**——TD-3.12(BatchQueue.tsx:213 W21.6 unmount cancel 静默吞错)
- **既有债务状态更新**:
  - TD-3 系列:11 处 → 12 处(新增 TD-3.12),9 处全活动(TD-3.1/3.2/3.3 已部分修复为 warn)
- **清偿**:本次 review 未清偿任何既有活动债务代码
- **决定不修**:
  - BatchQueue.tsx:213 `.catch(() => {})`:intentional cleanup 模式,登记为 TD-3.12 待接入 Sentry 后统一处理(注:Review #9 已清偿)
  - 不升级 vitest 3.x:沿用 Review #7 决定

### Review #7 — 2026-07-17 W23.1 README review + pre-existing 测试修复

- **范围**:W23.1 README 终版 review(不允许 workaround)+ 修复 22 个 pre-existing 测试失败(`use-custom-presets.test.ts`)
- **方法**:逐项验证 README 数字/命令/链接真实性 + 修复 jsdom 环境缺失导致的测试失败
- **验证结果**:
  - README 中 8 项 workaround 已修复(详见 commit 9ecd496)
  - 22 个 pre-existing 测试失败根因:`use-custom-presets.test.ts` 用 `// @vitest-environment jsdom` 注解,但 vitest 2.1.9 在 Node 26 下该注解失效,`window` 为 undefined
  - 修复方式:移除 jsdom 环境依赖,改用 `vi.stubGlobal('window', ...)` 注入 minimal window mock(MemoryLocalStorage + dispatchEvent/addEventListener),纯 node 环境运行
  - 修复后:`pnpm test:fast` 全绿,1480 测试 / 83 文件 / 0 失败
- **新债务登记**:**0 项**——本次修复未引入新技术债
- **既有债务状态更新**:
  - TD-5.1 / TD-6.1 / TD-6.2 状态保持活动:本次修复未触及架构层面问题(注:Review #9 已清偿)
  - TD-3.x 系列(静默吞错)状态保持:window mock 的 dispatchEvent 在无监听者时静默返回 true,与浏览器原生行为一致,非静默吞错(注:Review #9 已清偿)
- **识别的新优化机会(非债务)**:
  - **vitest 2.1.9 + Node 26 兼容性**:`// @vitest-environment jsdom` 注解失效,环境仍为 node。长期可考虑升级 vitest 3.x 或迁移到 `happy-dom`。此项非阻塞性债务,因 minimal mock 已覆盖当前测试需求
  - **mcp-server 2 个测试在 coverage 模式下超时**(5000ms):coverage 插桩开销导致,`test:fast` 不受影响。长期可调整 testTimeout 或优化 mcp-server 测试 setup
- **清偿**:本次 review 未清偿任何既有活动债务代码
- **决定不修**:
  - 不升级 vitest 3.x:影响面大(整个 monorepo 测试基础),当前 minimal mock 方案已解决问题
  - 不调整 mcp-server testTimeout:coverage 模式超时是非生产环境问题,`test:fast` 全绿即满足 CI 要求

### Review #6 — 2026-07-17 W21 性能优化批次(W21.1-21.5 / W21.7)

- **范围**:W21 性能优化批次——W21.1(首屏 LCP 优化)+ W21.2(WASM 预加载基础设施)+ W21.3(Bundle 分析 + 代码分割)+ W21.4(Worker Transferable 零拷贝 + isBlobRef null 修复)+ W21.5(大图 tile-based + 4K 阈值切换)+ W21.7(Lighthouse 跑分基线 + 瓶颈诊断)
- **方法**:逐任务实施 + 单元测试(W21.4 新增 8 个测试、W21.5 新增 16 个测试)+ Lighthouse CLI v12 真实跑分(mobile 模拟)+ build 产物体积分析
- **验证结果**:
  - 五层架构单向依赖**无违规**
  - W21.7 Lighthouse 真实跑分:Performance 62/100,LCP 6.9s(瓶颈 CodeMirror 首屏加载),CLS 0.001 完美达标(W21.1 关键 CSS 内联效果验证)
- **新债务登记**:**0 项**——本次批次未引入新技术债
- **识别的新优化机会(非债务)**:
  - **W21.7 LCP 6.9s 瓶颈**:LCP 元素是 CodeMirror `.cm-line`,根因是 Playground 首页直接渲染 CodeEditor。优化方向:延迟到用户交互后再加载 CodeMirror chunk。此项非债务,留待后续 W21.8 缓冲任务评估

### Review #5 — 2026-07-17 M6 阶段启动(W21.6 / W22.3-22.5 / W23.2-23.4)

- **范围**:M6 阶段启动批次——W21.6(内存泄漏修复 5 commit)+ W22.3(浏览器能力检测)+ W22.4(Firefox 降级 UI)+ W22.5(Playwright E2E 6 工具)+ W23.2/23.3/23.4(CONTRIBUTING / COC / Issue-PR 模板)
- **方法**:逐任务实施 + 单元测试 + E2E 验证(6 工具 spec 全绿)+ 文档与代码同步检查
- **验证结果**:
  - 五层架构单向依赖**无违规**(W21.6 仅扩展 runtime 内部 AssetStore 接口,未跨层;W22.3 browser-detect.ts 位于 runtime 层,被 apps/playground 消费,符合 UI→Runtime 单向依赖)
- **新债务登记**:**0 项**——本次批次未引入新技术债
- **既有债务状态更新**:
  - TD-5.1(UI ObjectURL 生命周期分散)状态保持活动,但已有防护加强(注:Review #9 已清偿)
  - TD-6.1 / TD-6.2(事件订阅 cleanup 模式分散)状态保持活动(注:Review #9 已清偿)

### Review #4 — 2026-07-15 全包审计与 TD 状态复核

- **范围**:基于 2026-07-15 全包审计(docs + packages + apps),复核 TD 状态并登记新债务
- **方法**:4 个并行 search subagent + 关键文件人工复核
- **验证结果**:
  - 五层架构单向依赖**无违规**(所有包 package.json + src import 合规)
  - Workflow 层已独立成包(`@lokvis/workflow`),P1-8 修复
  - runtime.ts God Object 已拆解(22 行 Facade + 5 个 manager),P1-5 修复
  - engine-audio/engine-ai 双向对应 plugin 已补齐,P1-6 修复
  - Capability Manifest codegen 已完整落地,ADR-013 应升 Accepted
  - MCP Server P0-1(createServer 返回 `{ server: null }`)已修复,三传输全部实装
- **新债务登记**(本次登记的 TD-1.3 / TD-1.4 / TD-1.5 / TD-3.5~3.11 / TD-4.5 / TD-4.6 已在 Review #9 / 之前 PR 全部清偿)
- **既有债务状态更新**:
  - TD-1.1 部分修复(NodeAssetStore 已实装)
  - TD-3.1 / 3.2 / 3.3 已部分修复(改为 warn,文件位置已迁移)
  - TD-4.2 行号修正(205 → 237)(注:Review #9 已清偿)
- **清偿**(原 TD-C10/C11/C12 已在本次 Review #9 文档处理中移除):
  - TD-4.1(dialog.tsx 双断言)已清偿
  - TD-4.3(CLI 手写 type guard)已清偿
  - TD-4.4(exif-reader 嵌套类型)已清偿(v2.3 重构)

### Review #3 — 2026-07-04 W12 Alpha 里程碑技术债复核

- **范围**:W12 里程碑(W12.1-W12.6 共 6 项任务)完成后的技术债状态复核
- **方法**:全量 typecheck + test + build 验证 + 文档与代码一致性检查
- **验证结果**:
  - typecheck 0 errors(9 包抽样)
  - test 777/777 通过(42 测试文件)
  - build 20/20 任务通过(W12.2 基线)
- **新债务登记**:**0 项**——W12.1-W12.6 期间未引入新技术债
- **既有债务状态**:7 类 16 项技术债**全部维持原状**,无新增 / 无恶化

### Review #2 — 2026-07-04 PR #11 review 修复

- **范围**:PR #11 review 发现的 6 个问题(1 Blocker + 2 Major + 3 Minor)
- **清偿**(原 TD-C4~C9 已在本次 Review #9 文档处理中移除):
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
- **清偿**(原 TD-C1/C2/C3 已在本次 Review #9 文档处理中移除,commit `f194cb9`,PR #11):
  - 抽象 `createBlobCapabilityImpl` 工厂消除 plugin-* 三份重复
  - 统一 worker-host transport 清理逻辑
  - 修复 exif-reader 手动剔除字段 patch
- **决定不修**:7 类债务均评估为"有防护的局部 workaround"或"抽象收益不足"(注:Review #9 已全部清偿)
