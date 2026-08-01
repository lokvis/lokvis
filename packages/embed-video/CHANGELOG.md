# @lokvis/embed-video

## 0.10.0

### Minor Changes

- SDK 组合根：新增 ./image, ./video, ./pdf 子路径导出，embed 包统一经 SDK 导入 plugin/engine（消除跨层直接依赖）

### Patch Changes

- Updated dependencies
  - @lokvis/sdk@0.10.0
  - @lokvis/embed-kit@0.10.0
  - @lokvis/schema@0.10.0
  - @lokvis/i18n@0.10.0
  - @lokvis/workflow@0.10.0
  - @lokvis/runtime@0.10.0

## 0.9.0

### Patch Changes

- Updated dependencies [[`58ecd94`](https://github.com/lokvis/lokvis/commit/58ecd949f5a8685acf19a7faad9cccd8912812e3)]:
  - @lokvis/runtime@0.9.0
  - @lokvis/sdk@0.9.0
  - @lokvis/embed-kit@0.9.0
  - @lokvis/schema@0.9.0
  - @lokvis/i18n@0.9.0
  - @lokvis/workflow@0.9.0
  - @lokvis/engine-video@0.9.0
  - @lokvis/plugin-video@0.9.0

## 0.8.1

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.8.1
  - @lokvis/i18n@0.8.1
  - @lokvis/workflow@0.8.1
  - @lokvis/runtime@0.8.1
  - @lokvis/sdk@0.8.1
  - @lokvis/engine-video@0.8.1
  - @lokvis/plugin-video@0.8.1
  - @lokvis/embed-kit@0.8.1

## 0.8.0

### Patch Changes

- [`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858) Thanks [@xiongyy](https://github.com/xiongyy)! - 抽取 embed-image/pdf/video 共享骨架为 @lokvis/embed-kit(参数化保 API)

  新增内部共享包 `@lokvis/embed-kit`,以工厂参数化三个 embed 包的重复骨架;各包改为薄封装并保留原有全部公开导出名与 CSS 变量命名空间,三方定制 API 不变:

  - `createCaptureException(label)` — sentry 占位实现(--> `[embed-*] captured exception:`)
  - `makeThemeSystem(prefix)` — 主题系统(`themeToCssVars` / `useEmbed*Mode` / `THEME_KEY_TO_VAR`),命名空间 `--lokvis` / `--lokvis-pdf` / `--lokvis-video`
  - `createUseLokvisRuntime(defaultPluginsFactory)` — runtime 初始化 hook
  - `makeSingleStepWorkflowBuilder(config)` — 单步 Workflow 构造器(image 专属 `buildResizeCompressWorkflow` 保留在包内)
  - `createEmbedErrorBoundary(deps)` — 参数化 ErrorBoundary,统一为唯一正确的重试计数实现(实例字段累积,修复 embed-image/video 中 retryCount 每次错误被 `getDerivedStateFromError` 重置导致 MAX_RETRY 永不触发的缺陷)

- [`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858) Thanks [@xiongyy](https://github.com/xiongyy)! - 新增 @lokvis/i18n 最底层 i18n 核心包，收敛此前分散在 ui-react / embed-image / embed-video / embed-pdf / playground 的 5 份重复实现。

  核心包统一导出语言配置（languages / defaultLang / langList / Language）、URL·路径处理（isLanguage / getLangFromUrl / localizePath / switchLangPath / LANG_PREFIX_RE）与字典翻译原语（interpolate / translate / pluralKey）。各消费包仅保留自身 `ui` 字典、Provider 与类型化 hook 封装（config.ts 改为 re-export，utils.ts 委托核心），字典 key 命名空间仍独立演进。

- [`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858) Thanks [@xiongyy](https://github.com/xiongyy)! - 低优先级清理(架构评审 #12)。

  - **#1 删除死代码**:移除 runtime 中已无引用的 `worker-host.ts` 及其测试(能力执行早已走 executor 路径)。
  - **#2 engine-image 适配器风格统一**:删除 `adapter.ts`,入口改为导出 `IMAGE_ENGINE` 引擎描述符(`{ name, version, supportedCapabilities }`)+ 独立 `decodeImage` / `encodeImage` 原语,与 `PDF_ENGINE` / `VIDEO_ENGINE` 对齐;plugin-image 及文档同步改用新契约,stub 检测统一走 `IMAGE_ENGINE.version.includes('stub')`。
  - **#4 去重 download / formatBytes**:此前 4 套行为各异的 `formatBytes` 统一为一套(runtime 新增 `formatBytes`,带 NaN/Infinity 守卫,四级单位 + 空格),浏览器下载逻辑 `downloadBlob` 收敛至 embed-kit;ui-react / embed-image / embed-pdf / embed-video / playground 改为复用,消除重复实现(部分用户可见输出统一为带空格格式)。
  - **#8 exif 格式化归位**:`formatExifRows` / `formatShutterSpeed` 从 schema 迁至 ui-react(展示逻辑归 UI 层),schema 仅保留 `ExifData` / `RawExifData` / `ExifRow` 类型;对应单测随函数迁移,类型分层测试保留在 schema。

- Updated dependencies [[`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858), [`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858), [`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858), [`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858), [`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858), [`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858), [`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858), [`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858)]:
  - @lokvis/schema@0.8.0
  - @lokvis/plugin-video@0.8.0
  - @lokvis/engine-video@0.8.0
  - @lokvis/runtime@0.8.0
  - @lokvis/embed-kit@0.8.0
  - @lokvis/i18n@0.8.0
  - @lokvis/sdk@0.8.0
  - @lokvis/workflow@0.8.0

## 0.7.1

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.7.1
  - @lokvis/workflow@0.7.1
  - @lokvis/runtime@0.7.1
  - @lokvis/sdk@0.7.1
  - @lokvis/engine-video@0.7.1
  - @lokvis/plugin-video@0.7.1

## 0.7.0

### Patch Changes

- Updated dependencies []:
  - @lokvis/plugin-video@0.7.0
  - @lokvis/schema@0.7.0
  - @lokvis/workflow@0.7.0
  - @lokvis/runtime@0.7.0
  - @lokvis/sdk@0.7.0
  - @lokvis/engine-video@0.7.0

## 0.6.0

### Patch Changes

- Updated dependencies [[`c57bb00`](https://github.com/lokvis/lokvis/commit/c57bb0092c6f2d7a443971e77febb0bb1fe71155), [`c57bb00`](https://github.com/lokvis/lokvis/commit/c57bb0092c6f2d7a443971e77febb0bb1fe71155), [`c57bb00`](https://github.com/lokvis/lokvis/commit/c57bb0092c6f2d7a443971e77febb0bb1fe71155)]:
  - @lokvis/schema@0.6.0
  - @lokvis/runtime@0.6.0
  - @lokvis/engine-video@0.6.0
  - @lokvis/plugin-video@0.6.0
  - @lokvis/sdk@0.6.0
  - @lokvis/workflow@0.6.0

## 0.5.5

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.5
  - @lokvis/workflow@0.5.5
  - @lokvis/runtime@0.5.5
  - @lokvis/sdk@0.5.5
  - @lokvis/engine-video@0.5.5
  - @lokvis/plugin-video@0.5.5

## 0.5.4

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.4
  - @lokvis/workflow@0.5.4
  - @lokvis/runtime@0.5.4
  - @lokvis/sdk@0.5.4
  - @lokvis/engine-video@0.5.4
  - @lokvis/plugin-video@0.5.4

## 0.5.3

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.3
  - @lokvis/workflow@0.5.3
  - @lokvis/runtime@0.5.3
  - @lokvis/sdk@0.5.3
  - @lokvis/engine-video@0.5.3
  - @lokvis/plugin-video@0.5.3

## 0.5.2

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.2
  - @lokvis/workflow@0.5.2
  - @lokvis/runtime@0.5.2
  - @lokvis/sdk@0.5.2
  - @lokvis/engine-video@0.5.2
  - @lokvis/plugin-video@0.5.2

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
  - @lokvis/workflow@0.5.1
  - @lokvis/runtime@0.5.1
  - @lokvis/sdk@0.5.1
  - @lokvis/engine-video@0.5.1
  - @lokvis/plugin-video@0.5.1

## 0.5.0

### Minor Changes

- feat: embed-* 三层集成包 + plugin-pdf 浏览器端激活

  - @lokvis/embed-image: 由 quick-image 重命名，hooks 统一为 useImageCompress/useImageResize/useImageConvert/useImageFavicon/useImageWatermark/useImageCrop
  - @lokvis/embed-pdf: 新增，5 个 PDF hooks（usePdfCompress/Merge/Split/Rotate/Watermark），内部经 plugin-pdf/web 在浏览器端运行 pdf-lib
  - @lokvis/embed-video: 新增，7 个 Video hooks（useVideoCompress/Transcode/Trim/Merge/ToGif/Screenshot/ExtractAudio），引擎层 stub，plugins 选项支持注入 remote backend
  - @lokvis/plugin-pdf: 新增 "./web" 子路径导出（pdfToolsPluginWeb），浏览器端注册 5 个真实 PDF 能力

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.0
  - @lokvis/workflow@0.5.0
  - @lokvis/runtime@0.5.0
  - @lokvis/sdk@0.5.0
  - @lokvis/plugin-video@0.5.0
