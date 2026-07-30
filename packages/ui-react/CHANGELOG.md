# @lokvis/ui-react

## 0.9.0

### Patch Changes

- Updated dependencies [[`58ecd94`](https://github.com/lokvis/lokvis/commit/58ecd949f5a8685acf19a7faad9cccd8912812e3)]:
  - @lokvis/runtime@0.9.0
  - @lokvis/sdk@0.9.0
  - @lokvis/schema@0.9.0
  - @lokvis/i18n@0.9.0
  - @lokvis/capability@0.9.0
  - @lokvis/workflow@0.9.0
  - @lokvis/ui-core@0.9.0

## 0.8.1

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.8.1
  - @lokvis/i18n@0.8.1
  - @lokvis/capability@0.8.1
  - @lokvis/workflow@0.8.1
  - @lokvis/runtime@0.8.1
  - @lokvis/sdk@0.8.1
  - @lokvis/ui-core@0.8.1

## 0.8.0

### Patch Changes

- [`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858) Thanks [@xiongyy](https://github.com/xiongyy)! - 外移 UI 层硬编码的本地化文案(架构评审 #10)。

  工作流模板数据(`workflow-templates.ts`)不再内嵌中文名称/描述:`WorkflowTemplate` 改为携带 `nameKey` / `descriptionKey` i18n 键,由 `WorkflowTemplates` 组件经 `t()` 解析;新增 5 个模板 × 名称/描述共 10 条 6 语言词条;电商模板水印默认文案由中文 `店铺名` 改为中性 `@shop`。

  `useWorkflows` / `useCustomPresets` 的保存/导入校验不再 `throw new Error('中文文案')`:改为抛出结构化 `LokvisStorageError`(携带稳定 `code` + i18n `messageKey` + 插值 `params` + 英文兜底 message),消费方 `catch` 后可 `t(err.messageKey, err.params)` 本地化展示;新增 9 条对应错误词条,并从包入口导出 `LokvisStorageError` / `LokvisStorageErrorCode`。

- [`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858) Thanks [@xiongyy](https://github.com/xiongyy)! - 新增 @lokvis/i18n 最底层 i18n 核心包，收敛此前分散在 ui-react / embed-image / embed-video / embed-pdf / playground 的 5 份重复实现。

  核心包统一导出语言配置（languages / defaultLang / langList / Language）、URL·路径处理（isLanguage / getLangFromUrl / localizePath / switchLangPath / LANG_PREFIX_RE）与字典翻译原语（interpolate / translate / pluralKey）。各消费包仅保留自身 `ui` 字典、Provider 与类型化 hook 封装（config.ts 改为 re-export，utils.ts 委托核心），字典 key 命名空间仍独立演进。

- [`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858) Thanks [@xiongyy](https://github.com/xiongyy)! - 修复 GlobalDropzone 遮罩非法 Tailwind 类

  - 拖拽遮罩此前使用 `bg-[var(--lokvis-primary)]/10/80`(双重不透明度修饰符,非法且对 `var()` 颜色无效),改用现成的 `--lokvis-primary-soft` 半透明主色 token(第三方可定制)

- [`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858) Thanks [@xiongyy](https://github.com/xiongyy)! - 低优先级清理(架构评审 #12)。

  - **#1 删除死代码**:移除 runtime 中已无引用的 `worker-host.ts` 及其测试(能力执行早已走 executor 路径)。
  - **#2 engine-image 适配器风格统一**:删除 `adapter.ts`,入口改为导出 `IMAGE_ENGINE` 引擎描述符(`{ name, version, supportedCapabilities }`)+ 独立 `decodeImage` / `encodeImage` 原语,与 `PDF_ENGINE` / `VIDEO_ENGINE` 对齐;plugin-image 及文档同步改用新契约,stub 检测统一走 `IMAGE_ENGINE.version.includes('stub')`。
  - **#4 去重 download / formatBytes**:此前 4 套行为各异的 `formatBytes` 统一为一套(runtime 新增 `formatBytes`,带 NaN/Infinity 守卫,四级单位 + 空格),浏览器下载逻辑 `downloadBlob` 收敛至 embed-kit;ui-react / embed-image / embed-pdf / embed-video / playground 改为复用,消除重复实现(部分用户可见输出统一为带空格格式)。
  - **#8 exif 格式化归位**:`formatExifRows` / `formatShutterSpeed` 从 schema 迁至 ui-react(展示逻辑归 UI 层),schema 仅保留 `ExifData` / `RawExifData` / `ExifRow` 类型;对应单测随函数迁移,类型分层测试保留在 schema。

- [`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858) Thanks [@xiongyy](https://github.com/xiongyy)! - 下沉 UI store 执行编排 + 收敛本地门控上限(架构评审 #9)。

  `@lokvis/sdk` 新增引擎中性的 `runWithProgress(runtime, workflow, inputs, { onNodeStatus })`:订阅 `node:started/finished/failed` → `runtime.run` → 逐个加载输出资产 → 卸载订阅,返回 `{ result, outputs, failedOutputIds }`。不感知 zustand / i18n / 缩略图刷新等 UI 关切,节点状态经中性 `NodeStatusUpdate` 回调上抛。

  - `ui-react` workflow-slice 的 `run()` 改为委托 `runWithProgress`,仅保留 zustand 状态与 i18n 文案映射;删除 store 内手写的多事件订阅与输出加载循环,同步移除已无用的 `subscribeAll`。
  - 新增 `@lokvis/ui-react` `gating` 单一来源模块(`FREE_PLAN_LIMITS` / `PRO_PLAN_LIMITS` / `planLimits`),`useCustomPresets` 与 `useWorkflows` 的 `FREE_*_LIMIT` / `PRO_*_LIMIT` 均从此派生,消除分散常量漂移。

- [`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858) Thanks [@xiongyy](https://github.com/xiongyy)! - Workspace 卡片式现代化改版(保持 `--lokvis-*` 变量自定义能力)

  **@lokvis/ui-core**

  - Token:`--lokvis-bg` 改为 `#fafafa`(与 surface 拉开层次);新增 `--lokvis-primary-soft`(选中态底色)与 `--lokvis-font-sans`(系统字体栈),`@theme` 同步注册 `--color-lokvis-primary-soft` / `--font-lokvis-sans`
  - 新增入场动效工具类 `.lokvis-animate-fade-in` / `.lokvis-animate-pop-in`(prefers-reduced-motion 自动禁用),Dialog 遮罩/面板应用
  - Button primary 变体由黑白反色改为品牌色(`--lokvis-primary` + hover),统一 `duration-150 ease-out` 与 `active:scale-[0.98]` 按压反馈

  **@lokvis/ui-react**

  - Workspace 中部三栏改为卡片式布局:面板浮于 `--lokvis-bg` 之上,圆角 + 边框 + `elevation-1` 阴影,`gap-2 p-2` 间距;移动端抽屉加 surface 底色与 overlay 阴影
  - Toolbar 去下边框改用 `elevation-1` 阴影;AssetPanel / Inspector 移除侧边框(卡片自带边框)
  - 选中态统一为 `--lokvis-primary-soft`;hover 统一为 `surface-muted`(卡片化后 surface hover 不可见)
  - 字号底线:`text-[9px]` / `text-[10px]` 全部提升到 `text-[11px]`

- Updated dependencies [[`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858), [`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858), [`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858), [`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858), [`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858), [`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858)]:
  - @lokvis/schema@0.8.0
  - @lokvis/capability@0.8.0
  - @lokvis/runtime@0.8.0
  - @lokvis/i18n@0.8.0
  - @lokvis/sdk@0.8.0
  - @lokvis/ui-core@0.8.0
  - @lokvis/workflow@0.8.0

## 0.7.1

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.7.1
  - @lokvis/capability@0.7.1
  - @lokvis/workflow@0.7.1
  - @lokvis/runtime@0.7.1
  - @lokvis/sdk@0.7.1
  - @lokvis/ui-core@0.7.1

## 0.7.0

### Minor Changes

- [`785288f`](https://github.com/lokvis/lokvis/commit/785288fed09621d2e56eae834db32f69cb409be0) Thanks [@xiongyy](https://github.com/xiongyy)! - Workspace 组件 6 语言 i18n 支持（en/zh/ja/es/de/fr）:

  - 新增 `WorkspaceI18nProvider` / `useWorkspaceLang` / `useWorkspaceTranslations`,语言检测优先级:显式 locale prop > Provider > `document.documentElement.lang`(含 `zh-CN` 等子标签) > URL 路径前缀
  - 全部 Workspace 组件文案接入包内 6 语言字典(`src/i18n/ui.ts`),支持消费方 `translations` prop 部分覆盖
  - 复数形式使用 `Intl.PluralRules` 按 locale 选择 `*One` / `*Other` 键
  - **Breaking(store API)**: `statusMessage` 由 `string` 改为 `I18nMessage`(`{ key, params }`),`setStatus(key, params?)` 签名变更,`error` 类型变为 `string | I18nMessage`。组件在渲染时通过 `formatMessage` 翻译;原始字符串(如引擎错误文本)原样透传

### Patch Changes

- Updated dependencies [[`d594ba8`](https://github.com/lokvis/lokvis/commit/d594ba8f0567b87e3bd03a73908f35a251b612fe)]:
  - @lokvis/capability@0.7.0
  - @lokvis/schema@0.7.0
  - @lokvis/workflow@0.7.0
  - @lokvis/runtime@0.7.0
  - @lokvis/sdk@0.7.0
  - @lokvis/ui-core@0.7.0

## 0.6.0

### Minor Changes

- [`c57bb00`](https://github.com/lokvis/lokvis/commit/c57bb0092c6f2d7a443971e77febb0bb1fe71155) Thanks [@xiongyy](https://github.com/xiongyy)! - 能力机制补强：

  - ui-react store 订阅 `plugin:loaded` 事件，初始化后 loadPlugin() 加载的
    插件其 capability 自动进入 Inspector / CommandPalette / WorkflowEditor，
    无需手动调用 refreshCapabilities()
  - schema：`Capability` 新增可选 presentation 元数据（`label` / `icon` / `group`），
    纯 UI 展示提示，不影响执行、校验与 MCP manifest
  - ui-react：Inspector / CommandPalette / WorkflowEditor 能力列表消费
    presentation 元数据（label 回退 name、group 回退 domain 前缀、icon 原样渲染），
    搜索支持 label 匹配

- [`c57bb00`](https://github.com/lokvis/lokvis/commit/c57bb0092c6f2d7a443971e77febb0bb1fe71155) Thanks [@xiongyy](https://github.com/xiongyy)! - Panel 扩展点兑现（registerPanel）：

  - schema：`PanelDefinition` 类型 + `panel:registered` 事件
  - runtime：`ctx.registerPanel()` 注册 Panel 并发射 `panel:registered` 事件
  - ui-react：panels-slice 同步 Panel 列表；`PluginPanels` 组件按 location 渲染、
    `show({ selectedAssets })` 谓词求值；`registerPanelRenderer` 注册表解析
    component 标识为 React 组件（支持覆盖语义与反注册）
  - Workspace slots：Canvas / Inspector / emptyState 支持 render prop，面板可隐藏

- [`c57bb00`](https://github.com/lokvis/lokvis/commit/c57bb0092c6f2d7a443971e77febb0bb1fe71155) Thanks [@xiongyy](https://github.com/xiongyy)! - ParamForm widget 注册表：

  - schema：`CapabilityParam.widget` hint（'slider' / 'textarea' / 'json' 或自定义标识）
  - ui-react：`registerParamWidget()` 开放注册表，ParamForm 按 widget hint
    选择控件，未注册标识回退默认控件

### Patch Changes

- Updated dependencies [[`c57bb00`](https://github.com/lokvis/lokvis/commit/c57bb0092c6f2d7a443971e77febb0bb1fe71155), [`c57bb00`](https://github.com/lokvis/lokvis/commit/c57bb0092c6f2d7a443971e77febb0bb1fe71155), [`c57bb00`](https://github.com/lokvis/lokvis/commit/c57bb0092c6f2d7a443971e77febb0bb1fe71155)]:
  - @lokvis/schema@0.6.0
  - @lokvis/runtime@0.6.0
  - @lokvis/capability@0.6.0
  - @lokvis/sdk@0.6.0
  - @lokvis/workflow@0.6.0
  - @lokvis/ui-core@0.6.0

## 0.5.5

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.5
  - @lokvis/capability@0.5.5
  - @lokvis/workflow@0.5.5
  - @lokvis/runtime@0.5.5
  - @lokvis/sdk@0.5.5
  - @lokvis/ui-core@0.5.5

## 0.5.4

### Patch Changes

- [`b5ac788`](https://github.com/lokvis/lokvis/commit/b5ac7882083efb8e4a93aaf3b1ad82028f1ec444) Thanks [@xiongyy](https://github.com/xiongyy)! - feat(ui-react): focused 模式自动选中新导入资产并生成缩略图

  - 新增 store 状态 lastImportedIds:importFiles 收集 runtime.importAsset 返回的 AssetId,在 refreshAssets 完成后写入(保证 ID 已在 store.assets 中)
  - importFiles 返回类型由 Promise<void> 改为 Promise<string[]>,返回本批次导入的 AssetId 列表(调用方忽略返回值时向后兼容)
  - 新增 useFocusedAutoSelect hook:focused 模式(无 AssetPanel)下监听 lastImportedIds,自动选中批次最新资产并触发 ensureThumbnails;full 模式不执行任何逻辑
  - 不用 assets 差分检测新资产:工作流输出经 run() 结尾的 refreshAssets 同样进入 store.assets,差分法会把输出误判为新导入并抢占选中状态,破坏 before/after 对比

- Updated dependencies []:
  - @lokvis/schema@0.5.4
  - @lokvis/capability@0.5.4
  - @lokvis/workflow@0.5.4
  - @lokvis/runtime@0.5.4
  - @lokvis/sdk@0.5.4
  - @lokvis/ui-core@0.5.4

## 0.5.3

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.3
  - @lokvis/capability@0.5.3
  - @lokvis/workflow@0.5.3
  - @lokvis/runtime@0.5.3
  - @lokvis/sdk@0.5.3
  - @lokvis/ui-core@0.5.3

## 0.5.2

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.2
  - @lokvis/capability@0.5.2
  - @lokvis/workflow@0.5.2
  - @lokvis/runtime@0.5.2
  - @lokvis/sdk@0.5.2
  - @lokvis/ui-core@0.5.2

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
  - @lokvis/workflow@0.5.1
  - @lokvis/runtime@0.5.1
  - @lokvis/sdk@0.5.1
  - @lokvis/ui-core@0.5.1

## 0.5.0

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.0
  - @lokvis/capability@0.5.0
  - @lokvis/workflow@0.5.0
  - @lokvis/runtime@0.5.0
  - @lokvis/sdk@0.5.0
  - @lokvis/ui-core@0.5.0

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
  - @lokvis/workflow@0.4.2
  - @lokvis/runtime@0.4.2
  - @lokvis/sdk@0.4.2
  - @lokvis/ui-core@0.4.2

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

- 8857a7c: W17.6: examples 接 cloud auth — `useLokvis` / `<Workspace>` 支持 `auth` 透传

  ## 新增

  ### `UseLokvisOptions.auth?: LokvisAuthSession`

  `useLokvis()` hook 新增 `auth` 字段,透传到 `createLokvis({ auth })`,
  使 `<Workspace auth={...} />` 组件可直接接收 cloud session/token。

  `WorkspaceProps extends UseLokvisOptions`,所以 `auth` 作为 `<Workspace />`
  的 prop 自动可用,无需额外改动 Workspace 组件。

  ### 示例升级:`examples/embedding`

  `App.tsx` 从纯本地模式升级为演示 3 种 auth 集成模式:
  - **Free**(本地):`auth: undefined` → 批量 10 / 并发 4 / 槽位 5 / 预设 3
  - **Pro**(cloud session):`auth: { session: jwt }` → 全部上限放宽
  - **Guest**(cloud 游客):`auth: { session: jwt, isPro: false }` → 显式标记游客

  侧边栏新增 Auth Mode 切换器(仅演示用,真实集成中 auth 由宿主应用 auth context 决定)。
  `useLokvis` 通过 `JSON.stringify(auth)` 监听 auth 内容变化,自动重新初始化 Runtime(无需 key remount)。

  README 重写,新增 "Cloud auth integration (W17.6)" 章节:
  - 3 种 auth 模式对比表(isPro / batch / concurrency / slots / presets)
  - 真实集成代码示例(从宿主 auth context 读取 session)
  - 显式游客 override 示例(`isPro: false` 覆盖 presence 推导)
  - API token 场景(CLI / SSR,`auth: { token }`)

  ## 迁移

  **无需修改现有代码**。`auth` 是可选字段,不传时行为不变(保持 free 模式)。

  要启用 cloud Pro 模式,只需:

  ```tsx
  <Workspace
    plugins={[imageToolsPlugin()]}
    auth={session ? { session } : undefined}
  />
  ```

  `@lokvis/sdk` 依赖新增到 example 的 `dependencies`(用于 `LokvisAuthSession` 类型导入,
  type-only,无运行时成本)。

- 06ba25a: W17.4 + W17.5: useCustomPresets hook — 自定义尺寸预设(免费 3 / Pro 无限)

  ## 新增
  - `useCustomPresets(isPro)` hook:用户自定义图像尺寸预设的本地持久化
    - localStorage key: `lokvis.customPresets`
    - 免费上限 3 个 / Pro 无限(`FREE_PRESET_LIMIT = 3` / `PRO_PRESET_LIMIT = Infinity`)
    - JSON 容错:解析失败 / 非数组 / 字段缺失 / 非法 fit/format 值时返回空数组或过滤
    - 跨 tab storage 事件 + 同 tab 自定义事件同步
    - 自定义预设 id 以 `custom.` 前缀,与内置 PLATFORM_PRESETS 命名空间隔离
  - 导出纯函数供测试:`readCustomPresetsFromStorage` / `writeCustomPresetsToStorage` / `genCustomPresetId`
  - 21 单测覆盖:读写往返 / 容错 / 限制门控 / id 生成

  ## Pro 门控完整矩阵

  | 门控           | Free  | Pro      | 实现位置                            |
  | -------------- | ----- | -------- | ----------------------------------- |
  | Batch 文件数   | 10    | 无限     | `batch-processor.ts` ✅             |
  | Batch 并发     | 4     | 16       | `concurrency-controller.ts` ✅      |
  | Workflow 槽位  | 5     | 无限     | `useWorkflows.ts` ✅                |
  | **自定义预设** | **3** | **无限** | **`useCustomPresets.ts` ✅ (本次)** |

  ## 迁移

  消费者从 `@lokvis/ui-react` 导入:

  ```typescript
  import { useCustomPresets } from '@lokvis/ui-react';

  function MyComponent({ isPro }: { isPro: boolean }) {
    const { presets, save, remove, canSaveMore, remaining } =
      useCustomPresets(isPro);
    // save({ name: '我的方形', width: 1080, height: 1080, fit: 'cover' })
  }
  ```

- Updated dependencies [a51d57a]
- Updated dependencies
- Updated dependencies [a51d57a]
- Updated dependencies [a51d57a]
- Updated dependencies [1567a33]
- Updated dependencies [d1179ab]
- Updated dependencies [58e7e7f]
- Updated dependencies [a51d57a]
  - @lokvis/schema@0.4.1
  - @lokvis/capability@0.4.1
  - @lokvis/workflow@0.4.1
  - @lokvis/runtime@0.4.1
  - @lokvis/sdk@0.4.1
  - @lokvis/ui-core@0.4.1

## 0.2.0

### Minor Changes

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

- 1f73400: W11 Workflow 编辑器打磨(11.1-11.6, 11.10)—— 插入节点 + 实时预览 + 错误横幅 + 工作流模板 + 分享链接 + 进度条取消 + MCP 设计草案

  - **ui-react·WorkflowEditor InsertConnector**(11.1):节点链中 Source 后和每个节点后用 `InsertConnector` 替换静态箭头。hover 时箭头变样式 + 显示 "+" 按钮,点击弹出 capability 搜索菜单(支持模糊搜索 + 点击外部关闭)。store 新增 `insertNodeAt(index, capability)` action(5 步上限校验 + clamp index + splice 插入 + 选中新节点)。5 步上限时 InsertConnector `disabled` 只显示箭头
  - **ui-react·useDebouncedRun**(11.2):新增 `packages/ui-react/src/hooks/useDebouncedRun.ts`。修改参数后自动 debounced 重跑当前节点:
    - `delay` 默认 400ms,`initialEnabled` 默认 false(需显式启用避免误触发)
    - 序列化 nodes 为 key(`{c, p}` 精简格式)做变化检测,深比较 params
    - 返回 `{ enabled, setEnabled, runNow, cancelPending, isPending }`
    - 卸载时清除 timer,running 期间不触发新 run(避免覆盖)
  - **ui-react·ErrorBanner**(11.3):新增 `packages/ui-react/src/components/ErrorBanner.tsx`。store.error 非空时显示红色横幅:
    - 重试按钮调用 `run()`
    - 关闭按钮调用 `setError(null)`(仅本地 dismiss,不修改 store)
    - error 变化时重置 dismissed 状态(新 error 重新弹出)
  - **ui-react·工作流模板**(11.4):新增 `packages/ui-react/src/data/workflow-templates.ts` + `components/WorkflowTemplates.tsx`:
    - 5 个内置模板:tpl-web-optimize(resize+compress webp)/ tpl-social-batch(resize+watermark)/ tpl-ecommerce-main(resize+compress+watermark)/ tpl-print-prep(resize+convert png)/ tpl-screenshot-compress(resize+compress png)
    - 覆盖 5 分类:web/social/ecommerce/print/utility
    - 每个模板 ≤ 5 节点(M1 MVP 约束)
    - `findTemplate(id)` 查找函数
    - `WorkflowTemplates.tsx` 卡片 grid 展示,`confirmIfNotEmpty` prop 在当前有节点时弹 confirm
    - store 新增 `loadWorkflowTemplate(templateNodes)` action(用模板节点替换当前 nodes,genNodeId 生成新 id,清空 outputs)
  - **ui-react·useShareLink**(11.5):新增 `packages/ui-react/src/hooks/useShareLink.ts`。把当前工作流节点序列编码为 base64 URL 参数:
    - URL 格式 `<origin><pathname>?workflow=<base64url>`,JSON 结构 `{ v: 1, nodes: [{c, p}] }`(v=版本号向前兼容)
    - base64url 编码(URL 安全:+ → - / → _ / 去除 = 填充)
    - UTF-8 安全:TextEncoder/TextDecoder 处理非 ASCII 字符(中文水印 `@用户名`)
    - 导出纯函数 `encodeWorkflowForShare(nodes)` / `decodeWorkflowFromShare(encoded)` 供测试(避免 mock React hook)
    - `decodeWorkflowFromShare` 返回 null 容错:v≠1 / nodes 非数组 / 无效 base64 / 非 JSON / params 缺失默认为空对象 / capability 强制转字符串
    - hook 方法:`generateShareUrl()` / `parseShareUrl(url)` / `loadFromCurrentUrl()`
    - Workspace 集成:useEffect 在 runtime 就绪后从 URL `?workflow=` 加载分享工作流(shareLoadedRef 防重复加载)
  - **ui-react·ProgressBar**(11.6):新增 `packages/ui-react/src/components/ProgressBar.tsx`:
    - 显示节点完成进度(done / total)+ 横向进度条
    - 进度条颜色:running → indigo / hasFailure → red / done → emerald
    - Cancel 按钮调用 `cancelRun()` store action
    - statusMessage 显示在进度条旁
    - 仅在 running 或有最近结果时渲染
    - store 新增 `cancelRun()` action(调 `runtime.cancel(currentRunId)` + 把 pending/running 节点标 cancelled)
    - store 新增 `currentRunId: string | null` 跟踪当前运行 ID
    - `run()` 改为 `set({ currentRunId: workflow.id })` 记录(catch 块和 finally 块都清除)
  - **docs·MCP 设计草案**(11.10):新增 `docs/mcp-design-draft.md` MCP server 接口设计草案:
    - Phase 1 stdio 传输(唯一支持),`npx @lokvis/cli mcp` 启动
    - Tools 清单:7 个 image 域 public tool(resize/compress/convert/crop/rotate/watermark/filter)+ 1 个 batch-only tool + 5 个 meta tool(run_workflow/get_asset/export_asset/undo/cancel)
    - Resources:capabilities/workflows/asset/{id}/metadata/asset/{id}/thumbnail
    - Prompts:4 个预定义模板(optimize_for_web/batch_social_resize/add_watermark/compress_to_size)
    - 安全性:文件隐私、能力可见性、批量误用、资产引用、路径逃逸 5 章节
    - 11 个开放问题待评审
  - **index.ts 导出**:新增导出 `useDebouncedRun` + types、`useShareLink` + `encodeWorkflowForShare` + `decodeWorkflowFromShare` + types、`ProgressBar` + `ErrorBanner` + `WorkflowTemplates` + types、`WORKFLOW_TEMPLATES` + `WorkflowTemplate` + `WorkflowTemplateNode` + `findTemplate`
  - **测试**:新增 25 测试
    - `ui-react/__tests__/workflow-templates.test.ts` 12 测试:模板数量(5)/ 字段完整性 / id 唯一性 / 节点数 ≤ 5 / capability 格式 / 5 分类覆盖 / 各模板内容验证(Web 优化 resize+compress webp / 社媒批量 watermark / 电商主图 3 节点 / 打印预处理 convert png / findTemplate 不存在返回 undefined / 类型可静态使用)
    - `ui-react/__tests__/use-share-link.test.ts` 13 测试:往返一致性 / base64url 安全(无 +/=)/ UTF-8 中文水印 / 空节点 / 单节点 / 5 步上限 / 无效 base64 字符串 / 非 JSON 内容 / 缺少 v 字段 / v≠1 / nodes 非数组 / params 缺失默认空对象 / capability 强制字符串
    - 修复 noUncheckedIndexedAccess strict mode 错误(`decoded![0].params` 改为 `decoded![0]?.params`,或提取 const 变量后用 `?.` 链式访问)
  - **验证**:typecheck 36/36 ✅、test 751/751(新增 25)✅、build 20/20 ✅

- bb5706c: EXIF 读取与查看面板(W7.3/7.4)——采用 MetadataReader 依赖反转长期方案,不进 Engine 层

  - **schema**:新增 `ExifData`(无 raw,面向 UI/Runtime)+ `RawExifData`(extends ExifData,Plugin 内部)+ `ExifRow` + `formatExifRows()` + `formatShutterSpeed()`。类型分层根治"UI 缓存需手动剔除 raw"的短期 patch。`PluginContext` 新增 `registerMetadataReader<T>(name, reader)` 方法,Plugin 提供查询函数,Runtime 持有引用按名调用
  - **plugin-image**:新增 `exif-reader.ts` 实现 `readExifFromBlob`(exifr ^7.1.3,零 WASM)。`imageToolsPlugin` installer 中通过 `ctx.registerMetadataReader('image.read-exif', ...)` 注册,返回前 RawExifData→ExifData 收窄(丢弃 raw)
  - **runtime**:`LokvisRuntime` 接口新增 `readAssetExif(id)`,`LokvisRuntimeImpl` 持有 `metadataReaders` Map + `_registerMetadataReader()`。Plugin 未安装时优雅降级返回 null
  - **sdk**:`installPlugin` / `createPluginContext` 接收 runtime 实例,`registerMetadataReader` 转发到 `runtime._registerMetadataReader`
  - **ui-react**:新增 `ExifPanel.tsx`(LRU cache 上限 16,effect 依赖 selectedAssetId 非 asset 引用),接入 `Inspector` 顶部。非 image 资产自动隐藏
  - 删除 `engine-image/src/operations/exif.ts` 占位文件(EXIF 不属于 Engine 层 Blob↔Blob 契约)
  - 新增 26 测试:schema 11 + plugin-image 9 + runtime 6。全部 523/523 通过,coverage lines 90.03% / branches 89.24%

- 656b22c: W9 Workspace SPA 主界面(9.1-9.8)——命令面板 + 全屏拖拽 + 对比滑块 + 下载面板 + 暗色切换 + 响应式

  - **ui-react·Workspace**:完整重构为五段编排(Toolbar → [Asset | Canvas | Inspector] → PipelineBar → HistoryPanel(h) → DownloadPanel → StatusBar);新增 5 个 `enable*` props(`enableGlobalDropzone` / `enableCommandPalette` / `enableThemeToggle` / `enableCompare` / `enableDownloadPanel`,默认 true,消费方可按需关闭);移动端 `isMobile` 切换为抽屉模式(Asset / Inspector 抽屉 + Canvas 全屏)
  - **ui-react·CommandPalette**(9.2):基于 ui-core `Dialog`(portal + ESC + focus trap + body overflow lock)+ `useCommandPalette()` hook 注册 ⌘K/Ctrl+K 全局快捷键;列出 capabilities + 工作流操作(undo/redo/clear);键盘 ↑↓ 导航,Enter 选中,ESC 关闭
  - **ui-react·GlobalDropzone**(9.3):全屏 dropzone + `isFileAccepted()` 三种 MIME 校验模式(`image/*` prefix / `image/jpeg` 精确 mime / `.png` 扩展名匹配);dragCounter 计数避免子元素 dragenter/dragleave 抖动;拒绝文件显示红色提示 5 秒后自动清空;默认接受 `image/*,video/*,audio/*,application/pdf`
  - **ui-react·CompareSlider**(9.4):before/after 对比滑块,鼠标拖 + 触摸 + 键盘(← → 5% 步长)三模式;before 用 `selectedAssetId`,after 用 `selectedOutputId ?? lastOutputIds[0]`;Canvas 集成 `compareMode` 状态(outputs 变化时自动切换)+ 右上角 Single/Compare 切换按钮(`canCompare` 条件)
  - **ui-react·DownloadPanel**(9.5):从 `lastOutputIds` 取工作流输出,逐项 `runtime.exportAsset(id)` → `downloadBlob`;批量下载间隔 200ms 避免浏览器拦截;空状态显示 EmptyState
  - **ui-react·HistoryPanel**(9.1):新增 `variant?: 'vertical' | 'horizontal'` prop;horizontal 模式高度 h-12 + 横向滚动条目;vertical 保留原侧栏布局
  - **ui-react·StatusBar**(9.6):新增 `useOnlineStatus()` hook(监听 online/offline 事件);新增显示当前选中工具名(`selectedNode.capability`)+ 执行进度(`doneNodes/totalNodes (progressPct%)`)+ 在线状态指示灯(绿 / 红)
  - **ui-react·ThemeToggle**(9.7):左键 toggle(light ↔ dark),右键弹出菜单(light / dark / system 三态);配合 `useTheme` hook
  - **ui-react·hooks**:
    - `useTheme`:`ThemeMode = 'light' | 'dark' | 'system'`;localStorage 持久化 + 跨 tab storage 事件同步 + matchMedia 系统偏好监听;`applyTheme()` 操作 `document.documentElement.classList` 添加/移除 `dark`/`light` 类(与 ui-core `tokens.css` 双触发一致)
    - `useMediaQuery(query)`:订阅 matchMedia,SSR 安全(初始 false)
    - `useBreakpoints()`:返回 `{ isMobile, isTablet, isDesktop }`,断点 768/1024
    - `useCommandPalette()`:注册 ⌘K/Ctrl+K 全局快捷键 + open/close 状态
  - **ui-react·store**:`WorkflowState` 新增 `lastOutputIds: string[]` / `selectedOutputId: string | null`;`WorkflowActions` 新增 `selectOutput(id)` / `clearOutputs()`;`run()` 在 status === 'completed' 时自动写入 `lastOutputIds`(输出资产 id 列表)和 `selectedOutputId`(取首个)
  - **ui-react·index**:导出全部新组件和 hooks(CommandPalette / GlobalDropzone / CompareSlider / DownloadPanel / ThemeToggle / useTheme / useMediaQuery / useBreakpoints / useCommandPalette)
  - **验证**:typecheck 36/36、test 677/677(新增 7)、build 20/20、覆盖率 lines 91.27% / branches 88.27%

### Patch Changes

- Updated dependencies [1ffd8c1]
- Updated dependencies [2aebedb]
- Updated dependencies [0bef2e0]
- Updated dependencies [2aebedb]
- Updated dependencies [2aebedb]
- Updated dependencies [980eafd]
- Updated dependencies [980eafd]
- Updated dependencies [e95976e]
- Updated dependencies [bb5706c]
- Updated dependencies [191877e]
  - @lokvis/runtime@0.2.0
  - @lokvis/capability@0.2.0
  - @lokvis/ui-core@0.2.0
  - @lokvis/sdk@0.2.0
  - @lokvis/schema@0.2.0

## 0.1.1-beta.0

### Patch Changes

- Updated dependencies []:
  - @lokvis/capability@0.2.0-beta.0
  - @lokvis/runtime@0.2.0-beta.0
  - @lokvis/schema@0.2.0-beta.0
  - @lokvis/sdk@0.1.1-beta.0
  - @lokvis/ui-core@0.1.1-beta.0
