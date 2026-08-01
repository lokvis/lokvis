# @lokvis/runtime

## 0.10.0

### Patch Changes

- @lokvis/schema@0.10.0
- @lokvis/browser-adapter@0.10.0

## 0.9.0

### Minor Changes

- [`58ecd94`](https://github.com/lokvis/lokvis/commit/58ecd949f5a8685acf19a7faad9cccd8912812e3) Thanks [@xiongyy](https://github.com/xiongyy)! - Browser Adapter Layer(ADR-015):新增 @lokvis/browser-adapter 包,收敛全仓原生浏览器 API 访问点。

  - 新包 `@lokvis/browser-adapter`:EnvProbe(浏览器能力/UA 探测)、FormatSupportProbe(编码格式真实支持探测)、MediaProbe(图像尺寸/媒体时长)、Storage(OPFS 根句柄)、KVStore(Dexie 封装的通用 KV 存储)、CanvasFactory、WorkerFactory,以及 `./test-utils` 子路径的内存 fake。
  - runtime:browser-detect / 媒体探测 / OPFS / IndexedDB 访问全部改经 adapter;Dexie 依赖移入 adapter。测试注入点从 `dbInstance` / `metadataDb`(Dexie 实例)改为 `kvStore` / `metadataKvStore`(KVStore 接口);`browser-detect` 与 `isOpfsSupported` / `isIdbSupported` 保留 deprecated re-export。
  - engine-image:canvas 创建/编解码原语(OffscreenCanvas / document.createElement / toBlob / createImageBitmap)改经 adapter;`detectFormatSupport` 与 embed-image 的 `detectEncodeSupport` 统一为 adapter 单一实现。AVIF worker 的 `new Worker(new URL(...))` 因 bundler 静态识别约束保留字面量形态(ADR-015 豁免)。
  - embed-image:`internal/format-support` 收敛为 adapter re-export。

### Patch Changes

- Updated dependencies [[`58ecd94`](https://github.com/lokvis/lokvis/commit/58ecd949f5a8685acf19a7faad9cccd8912812e3)]:
  - @lokvis/browser-adapter@0.9.0
  - @lokvis/schema@0.9.0

## 0.8.1

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.8.1

## 0.8.0

### Patch Changes

- [`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858) Thanks [@xiongyy](https://github.com/xiongyy)! - 收敛 MetadataReader 名称到单一事实源,并移除 Runtime 层脆弱的 PDF 页数正则解析(架构评审 #6)。

  - `@lokvis/schema` 新增 `METADATA_READER_NAMES` 常量与 `MetadataReaderName` 类型,作为跨层名称单一来源。
  - `runtime` 的 asset-manager 不再硬编码 `'image.read-exif'` / `'image.read-metadata'` / `'pdf.read-info'`,改为引用 schema 常量。
  - 各 plugin 导出的 `EXIF_READER_NAME` / `IMAGE_METADATA_READER_NAME` / `PDF_INFO_READER_NAME` / `VIDEO_INFO_READER_NAME` 改为 re-export schema 常量字段(导出名不变)。
  - 移除 `asset-store` 导入时的 `extractPdfPageCount`(`/Type /Pages /Count N` 正则猜测)。PDF 页数属领域特定元数据,应经 `runtime.readAssetPdfInfo`(plugin-pdf 注册的 `pdf.read-info` MetadataReader)按需读取,而非在 Runtime 层用脆弱结构解析。

- [`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858) Thanks [@xiongyy](https://github.com/xiongyy)! - 低优先级清理(架构评审 #12)。

  - **#1 删除死代码**:移除 runtime 中已无引用的 `worker-host.ts` 及其测试(能力执行早已走 executor 路径)。
  - **#2 engine-image 适配器风格统一**:删除 `adapter.ts`,入口改为导出 `IMAGE_ENGINE` 引擎描述符(`{ name, version, supportedCapabilities }`)+ 独立 `decodeImage` / `encodeImage` 原语,与 `PDF_ENGINE` / `VIDEO_ENGINE` 对齐;plugin-image 及文档同步改用新契约,stub 检测统一走 `IMAGE_ENGINE.version.includes('stub')`。
  - **#4 去重 download / formatBytes**:此前 4 套行为各异的 `formatBytes` 统一为一套(runtime 新增 `formatBytes`,带 NaN/Infinity 守卫,四级单位 + 空格),浏览器下载逻辑 `downloadBlob` 收敛至 embed-kit;ui-react / embed-image / embed-pdf / embed-video / playground 改为复用,消除重复实现(部分用户可见输出统一为带空格格式)。
  - **#8 exif 格式化归位**:`formatExifRows` / `formatShutterSpeed` 从 schema 迁至 ui-react(展示逻辑归 UI 层),schema 仅保留 `ExifData` / `RawExifData` / `ExifRow` 类型;对应单测随函数迁移,类型分层测试保留在 schema。

- Updated dependencies [[`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858), [`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858), [`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858)]:
  - @lokvis/schema@0.8.0

## 0.7.1

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.7.1

## 0.7.0

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.7.0

## 0.6.0

### Minor Changes

- [`c57bb00`](https://github.com/lokvis/lokvis/commit/c57bb0092c6f2d7a443971e77febb0bb1fe71155) Thanks [@xiongyy](https://github.com/xiongyy)! - Panel 扩展点兑现（registerPanel）：

  - schema：`PanelDefinition` 类型 + `panel:registered` 事件
  - runtime：`ctx.registerPanel()` 注册 Panel 并发射 `panel:registered` 事件
  - ui-react：panels-slice 同步 Panel 列表；`PluginPanels` 组件按 location 渲染、
    `show({ selectedAssets })` 谓词求值；`registerPanelRenderer` 注册表解析
    component 标识为 React 组件（支持覆盖语义与反注册）
  - Workspace slots：Canvas / Inspector / emptyState 支持 render prop，面板可隐藏

### Patch Changes

- Updated dependencies [[`c57bb00`](https://github.com/lokvis/lokvis/commit/c57bb0092c6f2d7a443971e77febb0bb1fe71155), [`c57bb00`](https://github.com/lokvis/lokvis/commit/c57bb0092c6f2d7a443971e77febb0bb1fe71155), [`c57bb00`](https://github.com/lokvis/lokvis/commit/c57bb0092c6f2d7a443971e77febb0bb1fe71155)]:
  - @lokvis/schema@0.6.0

## 0.5.5

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.5

## 0.5.4

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.4

## 0.5.3

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.3

## 0.5.2

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.2

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

## 0.5.0

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.0

## 0.4.2

### Patch Changes

- 自 0.4.1 以来的累积发布：

  - feat: Image Workspace Quick Actions 三层架构改造（Headless Hook + 默认 UI + Pipeline 模式）
  - feat: R1 Developer Workspace + S1 CLI 正式发布
  - feat: W21.8 CodeMirror LCP 优化、M1 SSE 生产就绪、W22.6 Playwright E2E
  - fix: 修复 Cloudflare Pages 部署失败（wrangler-action pnpm root 安装报错）

- Updated dependencies []:
  - @lokvis/schema@0.4.2

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

- 58e7e7f: W18.6: Plugin 权限沙箱 — network:none 强制 + filesystem 断言

  ## 新增

  ### `PluginPermissionSandbox`(schema 接口 + runtime 实现)

  Plugin 声明的 `permissions` 现在通过沙箱强制执行,而非纯文档:

  - **schema**: 新增 `PluginPermissionSandbox` 接口(`has` / `assertNetworkAllowed` / `assertFilesystemAllowed`)
  - **schema**: `PluginContext` 新增 `sandbox: PluginPermissionSandbox` 字段
  - **runtime**: `PluginPermissionSandbox` 类实现接口,提供 `applyNetworkGuard()` 方法
  - **runtime**: `installPlugin()` 在 install 期间自动应用 network guard(声明 `network:none`
    时 monkey-patch `fetch` / `XMLHttpRequest.open` / `WebSocket` / `EventSource`,
    调用即抛 `NetworkGuardError`),install 后 restore 原实现

  ### 新增错误类
  - `PluginPermissionError` — 权限断言失败(声明 X 但未声明 Y)
  - `NetworkGuardError` — 声明 network:none 又调网络 API
  - `FilesystemGuardError` — 声明未含 filesystem:* 又调文件系统 API

  ## 迁移指南

  ### Plugin 作者

  `PluginContext` 新增了 `sandbox` 字段。现有插件**无需修改**——`sandbox`
  由 Runtime 自动注入,插件代码无需显式使用。

  如果插件需要调用网络或文件系统 API,建议在调用前主动断言:

  ```typescript
  // 声明 network:none 的插件调 fetch 前自检
  ctx.sandbox.assertNetworkAllowed('loading model manifest');

  // 声明 filesystem:opfs 的插件调 OPFS 前自检
  ctx.sandbox.assertFilesystemAllowed('opfs', 'writing cache');
  ```

  ### 测试 mock 更新

  Plugin 测试中手动构造 `PluginContext` mock 需新增 `sandbox` 字段:

  ```typescript
  const ctx: PluginContext = {
    // ... 其他字段
    sandbox: {
      pluginName: 'mock',
      declared: new Set(['asset:read', 'asset:write']),
      has: () => true,
      assertNetworkAllowed: () => {},
      assertFilesystemAllowed: () => {},
    },
  };
  ```

  ## 行为对比

  | 场景                                                | 旧       | 新                          |
  | --------------------------------------------------- | -------- | --------------------------- |
  | 声明 `network:none` 的插件在 install 时调 `fetch()` | 静默成功 | 抛 `NetworkGuardError`      |
  | 声明 `network:limited`/`network:full`               | 无限制   | 无限制(不 patch)            |
  | 未声明任何权限                                      | 无限制   | 无限制(向后兼容)            |
  | install 后异步调网络(setTimeout 回调)               | 无法拦截 | **仍无法拦截**(best-effort) |

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
- Updated dependencies [58e7e7f]
  - @lokvis/schema@0.4.1

## 0.2.0

### Minor Changes

- 1ffd8c1: 架构清理:消除 plugin-* 重复代码 + 统一 worker-host transport 清理 + 修复 exif-reader 手动剔除字段 patch

  - **plugin-sdk**: 新增 `createBlobCapabilityImpl` 工厂 + `defaultDeriveOutputMetadata` + `BlobCapabilityOptions`。封装"取 blob → 调 operation → 派生 metadata → createAsset → 进度/取消"五步样板,消除 plugin-image / plugin-video / plugin-pdf(single kind)三份近乎逐字相同的 `wrapAsImplementation` + `deriveOutputMetadata`
  - **plugin-image**: 删除 `wrapAsImplementation` + `deriveOutputMetadata`(33 行),改用 `createBlobCapabilityImpl`
  - **plugin-video**: 同上,删除重复代码改用工厂
  - **plugin-pdf**: single kind 改用工厂;merge/split 形态不同保留自定义包装。`derivePdfMetadata` 改为返回 `(source, outBlob) => AssetMetadata` 签名以匹配工厂接口
  - **runtime**: `worker-host.ts` 的 `dispose()` 和 `spawn()` catch 块改为调用 `teardownTransport()`,消除三处重复的 `offMessage/offError/terminate/null` 清理样板
  - **plugin-image/exif-reader**: 删除"先构造 RawExifData 再解构删 raw"的 patch(`const { raw: _raw, ...exifData } = data; void _raw`),改为直接构造 `ExifData`。RawExifData 类型保留在 schema 供未来调试场景使用

  验证:lint 0 errors、typecheck 全绿、test 623/623 通过

- 2aebedb: - 新增 `RunOptions.appendHistory`:默认 reset 历史(向后兼容),`true` 时保留历史栈以支持跨次 `run()` 的 undo/redo 链(如连续滤镜)
  - 新增 `getCurrentOutputs(workflowId)` 公开 API,返回工作流当前输出 AssetId
  - `CapabilityRegistry` 新增 `hasImplementation()` / `isStubOnly()`,`resolve()` 自动过滤 `status: 'stub'` 实现
  - `EventBus.emit()` 对 handler 加 try/catch 隔离,`onAny` 集合使用 copy-on-iterate 支持 handler 在派发中自取消订阅
  - Executor 错误信息区分"仅有 stub 实现"与"完全无实现"
- e95976e: W10 Workflow Layer 实现(10.1-10.8)—— WorkflowBuilder + capability 兼容性校验 + 拖拽编辑器 + 槽位持久化

  - **runtime·WorkflowBuilder**(10.1):新增 `packages/runtime/src/workflow-builder.ts`。链式 API `add/remove/move/swap/updateParams` + `setInput/setOutput` + 5 步上限 `MAX_WORKFLOW_STEPS=5`。`build()` 校验空节点/输入未设置/输出未设置。`workflowToBuilder()` 反向构造(用于编辑已有工作流,跳过 load/export 节点)。导出常量 `MAX_WORKFLOW_STEPS` 供 runtime.run() 使用
  - **schema·validateWorkflow**(10.2):新增 `ValidateWorkflowOptions` 参数(`resolveCapability` 回调 + `maxSteps`)。新增 `validateCapabilityCompatibility()` 内部函数检查 3 层兼容性:
    - 输入节点(入度 0)的 inputTypes 与 workflow.inputs.type
    - 相邻节点 edge.from outputTypes 与 edge.to inputTypes 必须有交集
    - 输出节点(出度 0)的 outputTypes 与 workflow.outputs.type(archive 类型豁免)
    - 未注册的 capability 跳过该校验(向后兼容)
    - resolveCapability 未提供时跳过全部兼容性校验(向后兼容)
  - **schema·枚举类型修正**:新增 `workflowCategorySchema` 与 `workflowOutputTypeSchema` zod enum。`workflowSchema` 的 `category` 从 `z.string()` 改为 `workflowCategorySchema`,`outputs.type` 从内联 enum 改为 `workflowOutputTypeSchema`。消除 zod 推断 `string` 与 TS 类型 `WorkflowCategory`/`WorkflowOutput['type']` 不一致的类型谎言(此前需 `as unknown as Workflow` 双断言,违反 AGENTS.md)
  - **runtime·run()**(10.3):调用 `validateWorkflow()` 时传入 `maxSteps: MAX_WORKFLOW_STEPS(5)` + `resolveCapability` 回调(从 `capabilityRegistry.get(name)` 取 inputTypes/outputTypes)。capability 兼容性问题在入口处暴露,而非执行中途
  - **ui-react·WorkflowEditor**(10.4):新增 `packages/ui-react/src/components/WorkflowEditor.tsx`。基于 HTML5 Drag and Drop API 实现节点拖拽重排(无需额外依赖):
    - 拖拽节点到任意位置重排线性链,拖拽时显示插入指示器
    - 键盘支持:选中节点后 ← → 移动 / Delete / Backspace 删除(无障碍)
    - 步骤序号 1-5 显示
    - 5 步上限提示(达到上限时步数标 orange)
    - Clear 按钮(确认弹窗)
    - 触摸设备降级为按钮交互(HTML5 DnD 在移动端支持不佳)
    - Workspace 新增 `enableWorkflowEditor` prop(默认 false,关闭则用只读 PipelineBar)
  - **ui-react·store**:新增 `moveNode(from, to)` action(线性链重排)。`addNode` 加 5 步上限校验(达到上限时设置 error 而非抛错)
  - **ui-react·useWorkflows**(10.6 + 10.7):新增 `packages/ui-react/src/hooks/useWorkflows.ts`。5 个工作流槽位本地保存(免费 5 / Pro 无限):
    - localStorage 持久化 `lokvis.workflows` key
    - 跨 tab storage 事件 + 同 tab SYNC_EVENT 自定义事件双重同步
    - workflowSchema 容错:加载时 safeParse 过滤损坏条目,保存时校验数据完整性
    - `save(input)` / `remove(id)` / `load(id)` 完整 CRUD
    - `exportToJson(id)` / `exportAllToJson()` 导出 JSON 字符串(可直接下载)
    - `importFromJson(json, options)` 导入:validateWorkflow 完整校验(含 capability 兼容性若提供回调),宽容跳过无效条目,超限抛错
    - 返回 `{ slots, save, remove, load, limit, canSaveMore, remaining, exportToJson, exportAllToJson, importFromJson }`
  - **ui-react·ParamForm**(10.5):已存在,无需修改。支持 boolean/enum/color/number/string 五种控件自动生成,含 min/max/required 标记,紧凑行内布局适配 Inspector
  - **测试**(10.8):新增 49 测试
    - `schema/__tests__/validators.test.ts` +18:capability 兼容性校验 7(兼容通过 / 不兼容失败 / 输入节点 / 输出节点 / archive 豁免 / 未注册跳过 / 无回调跳过)+ maxSteps 3(等于通过 / 超过失败 / 未提供不限制)+ 枚举 schema 8(category 合法值 10 / 非法值 / outputs.type 合法 / 非法)
    - `runtime/__tests__/workflow-builder.test.ts` +31:链式 API 4 + 5 步上限 3 + remove 4(按 capability / 按 id / 不存在静默 / 多个同 capability 只移第一个)+ move/swap 4 + updateParams 2 + build 校验 4 + 构造选项 8 + 节点 id 1 + label 2 + workflowToBuilder 3
  - **验证**:typecheck 36/36、test 726/726(新增 49)、build 20/20

- bb5706c: EXIF 读取与查看面板(W7.3/7.4)——采用 MetadataReader 依赖反转长期方案,不进 Engine 层

  - **schema**:新增 `ExifData`(无 raw,面向 UI/Runtime)+ `RawExifData`(extends ExifData,Plugin 内部)+ `ExifRow` + `formatExifRows()` + `formatShutterSpeed()`。类型分层根治"UI 缓存需手动剔除 raw"的短期 patch。`PluginContext` 新增 `registerMetadataReader<T>(name, reader)` 方法,Plugin 提供查询函数,Runtime 持有引用按名调用
  - **plugin-image**:新增 `exif-reader.ts` 实现 `readExifFromBlob`(exifr ^7.1.3,零 WASM)。`imageToolsPlugin` installer 中通过 `ctx.registerMetadataReader('image.read-exif', ...)` 注册,返回前 RawExifData→ExifData 收窄(丢弃 raw)
  - **runtime**:`LokvisRuntime` 接口新增 `readAssetExif(id)`,`LokvisRuntimeImpl` 持有 `metadataReaders` Map + `_registerMetadataReader()`。Plugin 未安装时优雅降级返回 null
  - **sdk**:`installPlugin` / `createPluginContext` 接收 runtime 实例,`registerMetadataReader` 转发到 `runtime._registerMetadataReader`
  - **ui-react**:新增 `ExifPanel.tsx`(LRU cache 上限 16,effect 依赖 selectedAssetId 非 asset 引用),接入 `Inspector` 顶部。非 image 资产自动隐藏
  - 删除 `engine-image/src/operations/exif.ts` 占位文件(EXIF 不属于 Engine 层 Blob↔Blob 契约)
  - 新增 26 测试:schema 11 + plugin-image 9 + runtime 6。全部 523/523 通过,coverage lines 90.03% / branches 89.24%

### Patch Changes

- Updated dependencies [2aebedb]
- Updated dependencies [e95976e]
- Updated dependencies [bb5706c]
  - @lokvis/schema@0.2.0

## 0.2.0-beta.0

### Minor Changes

- - 新增 `RunOptions.appendHistory`:默认 reset 历史(向后兼容),`true` 时保留历史栈以支持跨次 `run()` 的 undo/redo 链(如连续滤镜)
  - 新增 `getCurrentOutputs(workflowId)` 公开 API,返回工作流当前输出 AssetId
  - `CapabilityRegistry` 新增 `hasImplementation()` / `isStubOnly()`,`resolve()` 自动过滤 `status: 'stub'` 实现
  - `EventBus.emit()` 对 handler 加 try/catch 隔离,`onAny` 集合使用 copy-on-iterate 支持 handler 在派发中自取消订阅
  - Executor 错误信息区分"仅有 stub 实现"与"完全无实现"

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.2.0-beta.0
