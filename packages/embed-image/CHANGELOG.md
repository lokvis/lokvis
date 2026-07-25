# @lokvis/quick-image

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
