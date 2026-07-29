# @lokvis/plugin-image

## 0.8.0

### Patch Changes

- [`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858) Thanks [@xiongyy](https://github.com/xiongyy)! - 能力名收敛为单一事实源(架构评审 #7)。

  - `@lokvis/schema` 现导出由 codegen 从 manifest 生成的 `BuiltinCapabilityName` 字面量联合类型与 `BUILTIN_CAPABILITY_NAMES` 常量数组(此前生成但从未接入公共导出)。
  - 删除 `@lokvis/capability` names.ts 中长期与 manifest 漂移、且全仓无消费者的手写 `CAPABILITY_NAMES` 常量对象与 `CapabilityNameKey` 类型;保留 `CAPABILITY_DOMAINS` / `domainOf` / `actionOf` / `sameDomain`。
  - plugin-image/pdf/video/audio 的操作绑定项 `capability` 字段类型由 `string` 收紧为 `BuiltinCapabilityName`,使插件裸字符串在编译期即与 manifest 单一来源校验(拼写/漂移会直接报错)。

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
  - @lokvis/capability@0.8.0
  - @lokvis/engine-image@0.8.0
  - @lokvis/plugin-sdk@0.8.0

## 0.7.1

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.7.1
  - @lokvis/capability@0.7.1
  - @lokvis/engine-image@0.7.1
  - @lokvis/plugin-sdk@0.7.1

## 0.7.0

### Patch Changes

- Updated dependencies [[`d594ba8`](https://github.com/lokvis/lokvis/commit/d594ba8f0567b87e3bd03a73908f35a251b612fe)]:
  - @lokvis/capability@0.7.0
  - @lokvis/schema@0.7.0
  - @lokvis/engine-image@0.7.0
  - @lokvis/plugin-sdk@0.7.0

## 0.6.0

### Patch Changes

- Updated dependencies [[`c57bb00`](https://github.com/lokvis/lokvis/commit/c57bb0092c6f2d7a443971e77febb0bb1fe71155), [`c57bb00`](https://github.com/lokvis/lokvis/commit/c57bb0092c6f2d7a443971e77febb0bb1fe71155), [`c57bb00`](https://github.com/lokvis/lokvis/commit/c57bb0092c6f2d7a443971e77febb0bb1fe71155)]:
  - @lokvis/schema@0.6.0
  - @lokvis/capability@0.6.0
  - @lokvis/engine-image@0.6.0
  - @lokvis/plugin-sdk@0.6.0

## 0.5.5

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.5
  - @lokvis/capability@0.5.5
  - @lokvis/engine-image@0.5.5
  - @lokvis/plugin-sdk@0.5.5

## 0.5.4

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.4
  - @lokvis/capability@0.5.4
  - @lokvis/engine-image@0.5.4
  - @lokvis/plugin-sdk@0.5.4

## 0.5.3

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.3
  - @lokvis/capability@0.5.3
  - @lokvis/engine-image@0.5.3
  - @lokvis/plugin-sdk@0.5.3

## 0.5.2

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.2
  - @lokvis/capability@0.5.2
  - @lokvis/engine-image@0.5.2
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
  - @lokvis/capability@0.5.1
  - @lokvis/engine-image@0.5.1
  - @lokvis/plugin-sdk@0.5.1

## 0.5.0

### Patch Changes

- Updated dependencies []:
  - @lokvis/engine-image@0.5.0
  - @lokvis/schema@0.5.0
  - @lokvis/capability@0.5.0
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
  - @lokvis/capability@0.4.2
  - @lokvis/engine-image@0.4.2
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

- Updated dependencies [a51d57a]
- Updated dependencies [a51d57a]
- Updated dependencies
- Updated dependencies [58e7e7f]
- Updated dependencies [a96bddb]
- Updated dependencies [a51d57a]
  - @lokvis/schema@0.4.1
  - @lokvis/capability@0.4.1
  - @lokvis/engine-image@0.4.1
  - @lokvis/plugin-sdk@0.4.1

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

- 2aebedb: - 注册 `image.filter` 能力实现,能力总数 8 → 9
  - 安装日志更新为 `Registered 9 image capabilities`
- bb5706c: EXIF 读取与查看面板(W7.3/7.4)——采用 MetadataReader 依赖反转长期方案,不进 Engine 层

  - **schema**:新增 `ExifData`(无 raw,面向 UI/Runtime)+ `RawExifData`(extends ExifData,Plugin 内部)+ `ExifRow` + `formatExifRows()` + `formatShutterSpeed()`。类型分层根治"UI 缓存需手动剔除 raw"的短期 patch。`PluginContext` 新增 `registerMetadataReader<T>(name, reader)` 方法,Plugin 提供查询函数,Runtime 持有引用按名调用
  - **plugin-image**:新增 `exif-reader.ts` 实现 `readExifFromBlob`(exifr ^7.1.3,零 WASM)。`imageToolsPlugin` installer 中通过 `ctx.registerMetadataReader('image.read-exif', ...)` 注册,返回前 RawExifData→ExifData 收窄(丢弃 raw)
  - **runtime**:`LokvisRuntime` 接口新增 `readAssetExif(id)`,`LokvisRuntimeImpl` 持有 `metadataReaders` Map + `_registerMetadataReader()`。Plugin 未安装时优雅降级返回 null
  - **sdk**:`installPlugin` / `createPluginContext` 接收 runtime 实例,`registerMetadataReader` 转发到 `runtime._registerMetadataReader`
  - **ui-react**:新增 `ExifPanel.tsx`(LRU cache 上限 16,effect 依赖 selectedAssetId 非 asset 引用),接入 `Inspector` 顶部。非 image 资产自动隐藏
  - 删除 `engine-image/src/operations/exif.ts` 占位文件(EXIF 不属于 Engine 层 Blob↔Blob 契约)
  - 新增 26 测试:schema 11 + plugin-image 9 + runtime 6。全部 523/523 通过,coverage lines 90.03% / branches 89.24%

### Patch Changes

- Updated dependencies [1ffd8c1]
- Updated dependencies [2aebedb]
- Updated dependencies [2aebedb]
- Updated dependencies [2aebedb]
- Updated dependencies [e95976e]
- Updated dependencies [bb5706c]
- Updated dependencies [191877e]
  - @lokvis/plugin-sdk@0.2.0
  - @lokvis/capability@0.2.0
  - @lokvis/engine-image@0.2.0
  - @lokvis/schema@0.2.0

## 0.2.0-beta.0

### Minor Changes

- - 注册 `image.filter` 能力实现,能力总数 8 → 9
  - 安装日志更新为 `Registered 9 image capabilities`

### Patch Changes

- Updated dependencies []:
  - @lokvis/capability@0.2.0-beta.0
  - @lokvis/engine-image@0.2.0-beta.0
  - @lokvis/schema@0.2.0-beta.0
  - @lokvis/plugin-sdk@0.1.1-beta.0
