# @lokvis/quick-image

## 0.8.1

### Patch Changes

- [`17079f4`](https://github.com/lokvis/lokvis/commit/17079f49ed468c1d70f30cb3c2750d1970269812) Thanks [@xiongyy](https://github.com/xiongyy)! - `useImageWorkflow` 新增多 target（变体）支持：

  - 新增 `ImageWorkflowTargetConfig`（变体名 + `overrides`：capability → params 浅合并到匹配步骤）与 `ImageWorkflowTargetOutput` 类型，并从 `/hooks` barrel 与包根导出
  - `options.targets?` 非空时进入多变体模式：对每个 target 构造独立线性 workflow（id 为 `${id}--${target.name}`）并顺序执行，复用同一输入，每个变体完成即追加 `targetOutputs`（渐进显示）
  - 返回值新增 `targetOutputs`（已完成变体输出）与 `currentTarget`（执行中变体索引，单 target 模式恒为 -1）
  - target 输出持有独立 object URL，与 steps 的 URL 生命周期解耦；`onComplete` 整批完成后触发一次，`outputSize` 为各变体之和
  - autoRun 键纳入 targets 定义序列化：输入或 steps/targets 定义变化均自动重跑

- Updated dependencies []:
  - @lokvis/schema@0.8.1
  - @lokvis/i18n@0.8.1
  - @lokvis/workflow@0.8.1
  - @lokvis/runtime@0.8.1
  - @lokvis/sdk@0.8.1
  - @lokvis/engine-image@0.8.1
  - @lokvis/plugin-image@0.8.1
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

- Updated dependencies [[`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858), [`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858), [`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858), [`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858), [`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858), [`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858)]:
  - @lokvis/schema@0.8.0
  - @lokvis/plugin-image@0.8.0
  - @lokvis/runtime@0.8.0
  - @lokvis/embed-kit@0.8.0
  - @lokvis/i18n@0.8.0
  - @lokvis/engine-image@0.8.0
  - @lokvis/sdk@0.8.0
  - @lokvis/workflow@0.8.0

## 0.7.1

### Patch Changes

- [`078fd4a`](https://github.com/lokvis/lokvis/commit/078fd4a74009913297f9f54405b96d427a27bfcd) Thanks [@xiongyy](https://github.com/xiongyy)! - 新增 `useImageWorkflow` — 任意线性图片工作流的纯逻辑 hook(Layer 0),是 useImagePipeline 的泛化:

  - 调用方传入任意步骤数组(`ImageWorkflowStepConfig[]`)而非 4 个内置预设,供 cloud 模版页内嵌试用区及三方站点使用
  - 新增 `buildImageWorkflow(id, steps, name?, description?)` 构造器;超过 MAX_WORKFLOW_STEPS 等非法输入由 hook 捕获写入 error,不在渲染期抛出
  - autoRun 键含步骤定义序列化:输入或步骤定义变化都自动重跑
  - 从 `/hooks` barrel 与包根同时导出

- Updated dependencies []:
  - @lokvis/schema@0.7.1
  - @lokvis/workflow@0.7.1
  - @lokvis/runtime@0.7.1
  - @lokvis/sdk@0.7.1
  - @lokvis/engine-image@0.7.1
  - @lokvis/plugin-image@0.7.1

## 0.7.0

### Patch Changes

- Updated dependencies []:
  - @lokvis/plugin-image@0.7.0
  - @lokvis/schema@0.7.0
  - @lokvis/workflow@0.7.0
  - @lokvis/runtime@0.7.0
  - @lokvis/sdk@0.7.0
  - @lokvis/engine-image@0.7.0

## 0.6.0

### Minor Changes

- [`c57bb00`](https://github.com/lokvis/lokvis/commit/c57bb0092c6f2d7a443971e77febb0bb1fe71155) Thanks [@xiongyy](https://github.com/xiongyy)! - embed-image 定制化补强：

  - 新增 `useInputBlobImport` hook：外部 Blob 直接注入工作流（inputBlob 缺口）
  - 包入口导出 `ImageInfo` / `formatBytes` / `BusyOverlayProps` / `FileInfoBarProps`
  - 6 个 Layer-2 组件的 `BusyOverlay` / `FileInfoBar` 升级为 components slot
  - i18n 空洞补齐：上传提示 / 拖拽提示 / 占位符 / 压缩率前后缀 / 预设按钮
    （Compress / Watermark / Crop / Pipeline / Favicon）全部接入 6 语言字典，
    翻译经父级注入（修复 Favicon 内部 useLang 忽略 locale prop 的不一致）
  - 修复 Compress `DownloadButton` 硬编码 extension='webp'：改为按
    outputBlob.type 推断（guessExtension），显式 extension prop 仍优先

### Patch Changes

- Updated dependencies [[`c57bb00`](https://github.com/lokvis/lokvis/commit/c57bb0092c6f2d7a443971e77febb0bb1fe71155), [`c57bb00`](https://github.com/lokvis/lokvis/commit/c57bb0092c6f2d7a443971e77febb0bb1fe71155), [`c57bb00`](https://github.com/lokvis/lokvis/commit/c57bb0092c6f2d7a443971e77febb0bb1fe71155)]:
  - @lokvis/schema@0.6.0
  - @lokvis/runtime@0.6.0
  - @lokvis/engine-image@0.6.0
  - @lokvis/plugin-image@0.6.0
  - @lokvis/sdk@0.6.0
  - @lokvis/workflow@0.6.0

## 0.5.5

### Patch Changes

- [`c6e4e6f`](https://github.com/lokvis/lokvis/commit/c6e4e6f122e669b9a718f43e58b05022603f232a) Thanks [@xiongyy](https://github.com/xiongyy)! - feat(embed-image): 新增 useImageBatch 批量图片处理 hook(Layer 0,纯逻辑无 UI)

  - 面向"多文件 + 同一能力 + 参数整体调整"批处理场景(如批量缩放)
  - 顺序调度:任一时刻最多一个 item 处于 processing,避免并发导入/执行的内存峰值与 OPFS 写入竞争
  - buildParams(info) 按 item 的 inputInfo 计算参数,支持 resize 'half' 等依赖原图尺寸的预设
  - paramsKey 变化时非 processing 的 item 重置 queued 重跑;buildParams 经 ref 读取最新闭包
  - 单 item 失败只落在 item.error,不中断后续;hook 级仅有 initError
  - inputUrl ObjectURL 在 addFiles 创建,removeItem / reset / unmount 统一 revoke
  - 返回 doneCount / totalInputBytes / totalOutputBytes 统计与 onBatchComplete 整批完成回调(埋点用)
  - 从 '@lokvis/embed-image' 与 '@lokvis/embed-image/hooks' 双路径导出

- Updated dependencies []:
  - @lokvis/schema@0.5.5
  - @lokvis/workflow@0.5.5
  - @lokvis/runtime@0.5.5
  - @lokvis/sdk@0.5.5
  - @lokvis/engine-image@0.5.5
  - @lokvis/plugin-image@0.5.5

## 0.5.4

### Patch Changes

- [`bb46ec5`](https://github.com/lokvis/lokvis/commit/bb46ec556adad6e0d094c1a3fd0ab9ad2e1152df) Thanks [@xiongyy](https://github.com/xiongyy)! - fix(embed-image): useImageResize 模式状态改为 reducer 原子提交,消除 setPreset/setCustomSize 连续调用竞态

  - 原实现 setPreset/setCustomSize 各自捕获对方旧闭包,连续调用(如 setPreset 后立即 setCustomSize)产生竞态,workflow 参数与最终状态不一致
  - 改用 useReducer 管理 preset/customSize 互斥模式状态:setPreset 原子清空 customSize,setCustomSize 原子切换自定义模式,单次状态提交只触发一次 workflow
  - 统一触发 effect 以 `inputId|preset|customSize` 复合 key 去重,保留 autoRun 门控与 busy 丢弃语义
  - setter 为纯 dispatch 包装([] deps),引用稳定,可安全放入下游 effect 依赖

- Updated dependencies []:
  - @lokvis/schema@0.5.4
  - @lokvis/workflow@0.5.4
  - @lokvis/runtime@0.5.4
  - @lokvis/sdk@0.5.4
  - @lokvis/engine-image@0.5.4
  - @lokvis/plugin-image@0.5.4

## 0.5.3

### Patch Changes

- [`04c46e1`](https://github.com/lokvis/lokvis/commit/04c46e177959812f1930649cf5e638d0efdc9fd9) Thanks [@xiongyy](https://github.com/xiongyy)! - feat(embed-image): useImageResize 支持 customSize 自定义目标尺寸

  - 新增 ResizeCustomSize / UseImageResizeOptions 类型,hook 签名向后兼容扩展
  - customSize 优先于 preset;width/height 至少填一个,只填一个时按比例推算
  - maintainAspectRatio 默认 true(fit-within),可设 false 强制拉伸
  - 非法值(缺失/0/NaN)静默回落 preset 模式
  - 新增返回值 customSize / setCustomSize(null 切回预设模式并立即重跑)

- Updated dependencies []:
  - @lokvis/schema@0.5.3
  - @lokvis/workflow@0.5.3
  - @lokvis/runtime@0.5.3
  - @lokvis/sdk@0.5.3
  - @lokvis/engine-image@0.5.3
  - @lokvis/plugin-image@0.5.3

## 0.5.2

### Patch Changes

- [`af87815`](https://github.com/lokvis/lokvis/commit/af8781517bd615a62c7ee8ca4bd0dd433eb77ebd) Thanks [@xiongyy](https://github.com/xiongyy)! - feat(embed-image): useImageCompress 支持 targetSizeKB 目标体积压缩

  - 新增 UseImageCompressOptions.targetSizeKB 选项,设置后进入 target 模式
  - 质量二分迭代(5–95,最多 7 轮)+ sqrt 降维回退(最多 2 次),格式固定 webp
  - 新增返回值:targetSizeKB / targetMet / effectiveQuality / setTargetSizeKB
  - useImageTool 新增 commitOutput(blob) 直接写入迭代最优结果,避免二次编码
  - EmbedActionResult 向后兼容扩展 quality? / targetSizeKB? / targetMet?
  - 修复并发 bug:runningRef 生命周期锁替代 tool.busy 守卫
  - 稳定回调身份:toolRef 模式消除 [tool] 依赖导致的每 render 重建

- Updated dependencies []:
  - @lokvis/schema@0.5.2
  - @lokvis/workflow@0.5.2
  - @lokvis/runtime@0.5.2
  - @lokvis/sdk@0.5.2
  - @lokvis/engine-image@0.5.2
  - @lokvis/plugin-image@0.5.2

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
  - @lokvis/engine-image@0.5.1
  - @lokvis/plugin-image@0.5.1

## 0.5.0

### Minor Changes

- feat: embed-* 三层集成包 + plugin-pdf 浏览器端激活

  - @lokvis/embed-image: 由 quick-image 重命名，hooks 统一为 useImageCompress/useImageResize/useImageConvert/useImageFavicon/useImageWatermark/useImageCrop
  - @lokvis/embed-pdf: 新增，5 个 PDF hooks（usePdfCompress/Merge/Split/Rotate/Watermark），内部经 plugin-pdf/web 在浏览器端运行 pdf-lib
  - @lokvis/embed-video: 新增，7 个 Video hooks（useVideoCompress/Transcode/Trim/Merge/ToGif/Screenshot/ExtractAudio），引擎层 stub，plugins 选项支持注入 remote backend
  - @lokvis/plugin-pdf: 新增 "./web" 子路径导出（pdfToolsPluginWeb），浏览器端注册 5 个真实 PDF 能力

- 新增浏览器端 AVIF 编码 WASM 兜底（native-first / wasm-fallback）。无原生 AVIF 编码能力的浏览器（Chrome / Firefox）此前选择 AVIF 会静默回退 PNG，现由 libavif WASM 编码器产出真 AVIF。

  - `engine-image`:
    - 新增 `encodeSmart` 统一编码分发——原生编码器可用走 Canvas 路径；原生不可用且目标为 avif 且 wasm 兜底启用时，分发到 libavif 私有 worker 编码；否则保持既有 throw 语义。compress / convert / setBackground / transform 系列 / filter / watermark / tile / targetSize 二分共 12 处编码调用点统一接入。
    - 新增 `wasm/avif-encoder.ts`（host 桥接，模块级 worker 单例 + pending 多路复用 + transferable 零拷贝）与 `wasm/avif-worker.ts`（worker 入口，单线程 libavif 胶水，speed 分档）。
    - 新增 `configureWasmEncoders({ avifUrl, enabled })` / `resolveAvifWasmUrl()` / `wasmEncodersEnabled()`；默认 wasm URL 版本锁定到 jsdelivr（随包发布 `dist/wasm/avif.wasm`）。
    - 取消语义：abort 时 terminate worker 并以 AbortError 拒绝所有 in-flight 请求（含发起方），下次编码自动重建单例。
  - `quick-image`:
    - `useQuickConvert` 的 `formatSupport` 升级为「native || wasm」——wasm 兜底启用时 avif 预设不再被禁用；新增 `slowEncode` map 标记走 wasm 的格式。
    - Layer 2 默认 UI 新增慢速编码提示条（avif 走 wasm 时提示转换可能需要几秒钟）；新增 i18n 键 6 语言。

- 修复图片格式转换选择浏览器不支持的格式（如 AVIF）时静默产出 PNG 的问题。

  - `engine-image`: `canvasEngine.encode` 现在检测浏览器静默回退——产出 MIME 与请求不符时抛出明确错误，而非返回 PNG；修复 `detectFormatSupport` 中 `|| blob.size > 0` 的误判。
  - `quick-image`: `useQuickConvert` 新增 `formatSupport` 字段（实际编码 1×1 画布探测浏览器真实编码支持）；`setPreset` 在检测完成后拒绝不支持的预设；`QuickConvert.PresetSwitcher` 的 `renderButton` 回调新增 `disabled` 参数，默认 UI 对不支持的预设置灰禁用。

### Patch Changes

- Updated dependencies []:
  - @lokvis/engine-image@0.5.0
  - @lokvis/plugin-image@0.5.0
  - @lokvis/schema@0.5.0
  - @lokvis/workflow@0.5.0
  - @lokvis/runtime@0.5.0
  - @lokvis/sdk@0.5.0

## 0.1.1

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.4.2
  - @lokvis/workflow@0.4.2
  - @lokvis/runtime@0.4.2
  - @lokvis/sdk@0.4.2
  - @lokvis/plugin-image@0.4.2
