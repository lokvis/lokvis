# @lokvis/sdk

## 0.6.0

### Patch Changes

- Updated dependencies [[`c57bb00`](https://github.com/lokvis/lokvis/commit/c57bb0092c6f2d7a443971e77febb0bb1fe71155), [`c57bb00`](https://github.com/lokvis/lokvis/commit/c57bb0092c6f2d7a443971e77febb0bb1fe71155), [`c57bb00`](https://github.com/lokvis/lokvis/commit/c57bb0092c6f2d7a443971e77febb0bb1fe71155)]:
  - @lokvis/schema@0.6.0
  - @lokvis/runtime@0.6.0
  - @lokvis/plugin-sdk@0.6.0

## 0.5.5

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.5
  - @lokvis/runtime@0.5.5
  - @lokvis/plugin-sdk@0.5.5

## 0.5.4

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.4
  - @lokvis/runtime@0.5.4
  - @lokvis/plugin-sdk@0.5.4

## 0.5.3

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.3
  - @lokvis/runtime@0.5.3
  - @lokvis/plugin-sdk@0.5.3

## 0.5.2

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.2
  - @lokvis/runtime@0.5.2
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
  - @lokvis/runtime@0.5.1
  - @lokvis/plugin-sdk@0.5.1

## 0.5.0

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.0
  - @lokvis/runtime@0.5.0
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
  - @lokvis/runtime@0.4.2
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

- a51d57a: 同步 apps/docs 中英两版 sdk.md 与 docs/sdk-reference.md(T1.1 + Task D 验收缺口)。

  PR #28 修正了 docs/sdk-reference.md 的 Runtime API 表与错误码表,
  但 apps/docs/src/content/docs/sdk.md 与 zh-cn/sdk.md 未同步:

  Runtime API 表:
  - 移除 `getAssetBlob(id)`(公共 Runtime 不暴露,仅在 PluginContext 内可用)
  - 修正 `cancel(workflowId)` 返回 `Promise<void>`(原标 `void`)
  - 修正 `undo()` / `redo()` 签名为 `(workflowId): Promise<void>`(原无参,返回 `Promise<AssetId|null>`)
  - 重命名 `readAssetMetadata` → `readAssetExif`(返回 `Promise<ExifData | null>`)
  - 移除不存在的 `listCapabilities()` alias
  - 补列 15 个缺失方法:version / status / isPro / batch / pause / resume /
    getCurrentOutputs / disposeWorkflow / history / getHistoryState / jumpTo /
    hasCapability / isStubOnly / getStorageUsage / installPlugin

  错误码表:
  - 移除 `BATCH_LIMIT_EXCEEDED`(代码中不存在此错误码)
  - 补列 9 个缺失错误码:ASSET_BLOB_NOT_FOUND / ASSET_IMPORT_FAILED /
    ASSET_EXPORT_FAILED / WORKFLOW_NODE_ERROR / STORAGE_OPFS_UNAVAILABLE /
    STORAGE_IDB_UNAVAILABLE / WORKER_DEAD / WORKER_REQUEST_ABORTED /
    WORKER_HANDSHAKE_FAILED

- 1567a33: 新增 `createLokvis({ auth })` 钩子,对接 cloud 侧 session/token 注入(W17.3)。

  `CreateLokvisOptions` 新增可选 `auth: LokvisAuthSession` 字段:

  ```ts
  export interface LokvisAuthSession {
    session?: string; // cloud 会话令牌(如 JWT)
    token?: string; // 直接 API token(CLI / 后端场景)
    isPro?: boolean; // 显式覆盖,优先级高于 session/token presence
  }
  ```

  SDK 据 presence 推导 `isPro` 并传给 RuntimeConfig,使 Runtime 的批量上限
  (`FREE_BATCH_LIMIT=10`)/并发槽位(4 → 16)/workflow 槽位(5 → ∞)自动放宽。
  SDK 不做 token 形态/签名校验 —— 校验由 cloud 网关完成,本地无 secret。

  ### 迁移指南(0.2.2 → 0.3.0)

  **纯本地场景(无 cloud 对接)**:无需改动。不传 `auth` 时行为不变,
  保持 free 模式(`isPro = false`)。

  **接 cloud session**:

  ```ts
  // 之前:仅本地模式
  const lokvis = await createLokvis({ plugins: [imageToolsPlugin()] });

  // 之后:cloud 注入 session,自动开启 Pro 门控
  const cloudJwt = await fetchCloudSession(userOAuthCode);
  const lokvis = await createLokvis({
    plugins: [imageToolsPlugin()],
    auth: { session: cloudJwt },
  });

  console.log(lokvis.isPro); // true — 批量无上限
  ```

  **显式标记游客 session**:cloud 已识别为游客(发 session 但不应享受 Pro):

  ```ts
  const lokvis = await createLokvis({
    auth: { session: guestJwt, isPro: false },
  });
  console.log(lokvis.isPro); // false — 仍受 FREE_BATCH_LIMIT 约束
  ```

  **测试 / dev 模式无凭证**:绕过 cloud,本地直接开 Pro:

  ```ts
  const lokvis = await createLokvis({ auth: { isPro: true } });
  // 或直接走 RuntimeConfig(向后兼容)
  const lokvis2 = await createLokvis({ isPro: true });
  ```

  ### 受影响的下游行为

  | 项                          | free(`isPro=false`)                 | Pro(`isPro=true`) |
  | --------------------------- | ----------------------------------- | ----------------- |
  | BatchProcessor.enqueue 上限 | 10 项(抛 `BatchLimitExceededError`) | 无上限            |
  | BatchProcessor 默认并发     | 4                                   | 16                |
  | UI workflow 槽位            | 5                                   | ∞                 |
  | Playground 自定义预设       | 3                                   | ∞                 |

  错误类型 `BatchLimitExceededError` 在 Pro 模式下永远不会抛出 ——
  批量上限仅在 free 模式下生效。

  ### 不变项
  - `createLokvis()` 不传任何参数:行为完全不变,`isPro === false`
  - 直接传 `RuntimeConfig.isPro` 仍有效(向后兼容路径)
  - 已有的 `loadPlugin(runtime, plugin)` API 未变

- d1179ab: W17.2: SDK 类型导出审查 — 补全 19 个公共类型 re-export

  ## 新增

  SDK 作为 lokvis 的清洁 façade(README line 5),消费者不应直接依赖
  `@lokvis/runtime` / `@lokvis/schema` / `@lokvis/plugin-sdk`。本次补全所有
  在公共 API 签名中出现但此前未导出的类型:

  ### Runtime 类型(11 个)
  - `RuntimeStatus` / `RunOptions` / `ToMcpManifestOptions`
  - `BatchProcessor` / `BatchJob` / `BatchItem` / `BatchItemInput`
  - `EnqueueOptions` / `BatchProgress`

  ### Schema 类型(13 个)
  - `AssetSource`(构造 importAsset 参数)
  - `AssetType` / `AssetMetadata` / `HistoryEntry`(history() 返回)
  - `ExifData`(readAssetExif() 返回)
  - `EngineSelectionStrategy`(RuntimeConfig.engineStrategy)
  - `EventBus` / `LokvisEvent` / `LokvisEventType` / `EventHandler`
  - `BatchItemStatus` / `BatchJobStatus`

  ### Plugin 类型(1 个)
  - `PluginInstaller`(PluginLoadEntry.install 字段类型)

  ## 迁移

  无需修改现有代码 —— 新增的全是 type-only re-export,不影响运行时。
  消费者可直接从 `@lokvis/sdk` 导入上述类型,无需再 peer-dependency
  `@lokvis/runtime` / `@lokvis/schema`。

- Updated dependencies [a51d57a]
- Updated dependencies
- Updated dependencies [58e7e7f]
- Updated dependencies [a96bddb]
- Updated dependencies [a51d57a]
  - @lokvis/schema@0.4.1
  - @lokvis/runtime@0.4.1
  - @lokvis/plugin-sdk@0.4.1

## 0.2.0

### Minor Changes

- 980eafd: 新增 LokvisError 错误类型体系(W4.2)

  - `LokvisError` 基类 + 稳定 `code` 字段(18 个错误码覆盖资产/工作流/能力/存储/Worker/降级/插件域)
  - 18 个具体子类(AssetNotFoundError / WorkflowInvalidError / StorageQuotaExceededError / DegradationRejectedError / PluginLoadError 等)
  - `fromLokvisError(unknown)` 归一函数:基于 `instanceof` 把 runtime 抛出的具体 Error 子类包装为对应 SDK 错误
  - 所有公开 API 添加 `@public` JSDoc 标记(W4.1)
  - `loadPlugin` 失败时抛 `PluginLoadError`(原裸 Error)

- bb5706c: EXIF 读取与查看面板(W7.3/7.4)——采用 MetadataReader 依赖反转长期方案,不进 Engine 层

  - **schema**:新增 `ExifData`(无 raw,面向 UI/Runtime)+ `RawExifData`(extends ExifData,Plugin 内部)+ `ExifRow` + `formatExifRows()` + `formatShutterSpeed()`。类型分层根治"UI 缓存需手动剔除 raw"的短期 patch。`PluginContext` 新增 `registerMetadataReader<T>(name, reader)` 方法,Plugin 提供查询函数,Runtime 持有引用按名调用
  - **plugin-image**:新增 `exif-reader.ts` 实现 `readExifFromBlob`(exifr ^7.1.3,零 WASM)。`imageToolsPlugin` installer 中通过 `ctx.registerMetadataReader('image.read-exif', ...)` 注册,返回前 RawExifData→ExifData 收窄(丢弃 raw)
  - **runtime**:`LokvisRuntime` 接口新增 `readAssetExif(id)`,`LokvisRuntimeImpl` 持有 `metadataReaders` Map + `_registerMetadataReader()`。Plugin 未安装时优雅降级返回 null
  - **sdk**:`installPlugin` / `createPluginContext` 接收 runtime 实例,`registerMetadataReader` 转发到 `runtime._registerMetadataReader`
  - **ui-react**:新增 `ExifPanel.tsx`(LRU cache 上限 16,effect 依赖 selectedAssetId 非 asset 引用),接入 `Inspector` 顶部。非 image 资产自动隐藏
  - 删除 `engine-image/src/operations/exif.ts` 占位文件(EXIF 不属于 Engine 层 Blob↔Blob 契约)
  - 新增 26 测试:schema 11 + plugin-image 9 + runtime 6。全部 523/523 通过,coverage lines 90.03% / branches 89.24%

### Patch Changes

- 0bef2e0: 修复 code review 发现的 7 个问题(跨包第三轮)

  - `ui-core` Slider:非受控模式下 `showValue` 显示值不随拖动更新,改用 internal state 跟踪当前值
  - `ui-core` Tabs:`useCallback` 依赖 `items`(数组字面量,每次渲染新引用)导致 memo 失效,改为普通函数
  - `ui-core` Dialog:模块级 `bodyOverflowLockCount` / `bodyOverflowPrev` 在 Vite HMR 重新执行模块时不重置,可能导致 body 永久锁死;添加 `import.meta.hot?.dispose` 清理回调
  - `sdk` CapabilityNotRegisteredError:构造函数不接受 `cause` 参数,`fromLokvisError` message 匹配分支丢失原始错误链路;补充 `cause?` 参数并传入
  - `sdk` fromLokvisError:`WorkflowNodeError('', '', msg, value)` 用空 nodeId 不利于定位失败节点,改为从 message 提取 nodeId
  - `docs` sdk.md:示例 `fromLokvisError` 总是返回 LokvisError,`instanceof LokvisError` 检查冗余且 else 分支为死代码;`err.guide` 需 `instanceof DegradationRejectedError` 窄化类型才能访问
  - `examples` custom-workspace:删除 `fromLokvisError` 后无法触达的 else 死代码分支

- Updated dependencies [1ffd8c1]
- Updated dependencies [2aebedb]
- Updated dependencies [2aebedb]
- Updated dependencies [e95976e]
- Updated dependencies [bb5706c]
  - @lokvis/plugin-sdk@0.2.0
  - @lokvis/runtime@0.2.0
  - @lokvis/schema@0.2.0

## 0.1.1-beta.0

### Patch Changes

- Updated dependencies []:
  - @lokvis/runtime@0.2.0-beta.0
  - @lokvis/schema@0.2.0-beta.0
  - @lokvis/plugin-sdk@0.1.1-beta.0
