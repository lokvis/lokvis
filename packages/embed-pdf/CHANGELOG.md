# @lokvis/embed-pdf

## 0.7.0

### Minor Changes

- [`d594ba8`](https://github.com/lokvis/lokvis/commit/d594ba8f0567b87e3bd03a73908f35a251b612fe) Thanks [@xiongyy](https://github.com/xiongyy)! - 新增 PDF 添加页码能力 `pdf.add-page-numbers`(全链路):

  - capability:manifest 新增 add-page-numbers action(position/format/startFrom/fontSize/color)+ codegen 生成 `PDF_ADD_PAGE_NUMBERS`
  - engine-pdf:新增 `addPageNumbers` operation(pdf-lib,Helvetica,`{n}`/`{total}` 占位符,4 个位置)
  - plugin-pdf:注册 `pdf.add-page-numbers`(web/node 真实实现,默认入口 stub,共 8 个 capability:6 真实 + 2 stub)
  - embed-pdf:新增 `usePdfPageNumbers` hook(`PDF_PAGE_NUMBER_POSITIONS` / `DEFAULT_PAGE_NUMBER_FORMAT`,position/format/startFrom 变更自动重跑)
  - mcp-server:新增 `lokvis_pdf_add_page_numbers` tool(经 runtime.run 走完整 capability 系统)

- [`d594ba8`](https://github.com/lokvis/lokvis/commit/d594ba8f0567b87e3bd03a73908f35a251b612fe) Thanks [@xiongyy](https://github.com/xiongyy)! - `usePdfSplit` 支持自定义每份页数:

  - `PdfSplitPreset` 新增 `'custom'` 预设(`PDF_SPLIT_PRESETS.custom` 为占位,实际值来自 state)
  - 新增 `pagesPerFile` / `setPagesPerFile(n)`:设值自动切到 custom 预设并重跑;n<1 或非整数不触发 run
  - options 新增 `initialPagesPerFile?`(传入时初始预设为 custom)
  - `ranges` 按范围拆分暂不进 hook(进阶场景引导 full workspace)

### Patch Changes

- Updated dependencies [[`d594ba8`](https://github.com/lokvis/lokvis/commit/d594ba8f0567b87e3bd03a73908f35a251b612fe)]:
  - @lokvis/engine-pdf@0.7.0
  - @lokvis/plugin-pdf@0.7.0
  - @lokvis/schema@0.7.0
  - @lokvis/workflow@0.7.0
  - @lokvis/runtime@0.7.0
  - @lokvis/sdk@0.7.0

## 0.6.0

### Patch Changes

- Updated dependencies [[`c57bb00`](https://github.com/lokvis/lokvis/commit/c57bb0092c6f2d7a443971e77febb0bb1fe71155), [`c57bb00`](https://github.com/lokvis/lokvis/commit/c57bb0092c6f2d7a443971e77febb0bb1fe71155), [`c57bb00`](https://github.com/lokvis/lokvis/commit/c57bb0092c6f2d7a443971e77febb0bb1fe71155)]:
  - @lokvis/schema@0.6.0
  - @lokvis/runtime@0.6.0
  - @lokvis/engine-pdf@0.6.0
  - @lokvis/plugin-pdf@0.6.0
  - @lokvis/sdk@0.6.0
  - @lokvis/workflow@0.6.0

## 0.5.5

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.5
  - @lokvis/workflow@0.5.5
  - @lokvis/runtime@0.5.5
  - @lokvis/sdk@0.5.5
  - @lokvis/engine-pdf@0.5.5
  - @lokvis/plugin-pdf@0.5.5

## 0.5.4

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.4
  - @lokvis/workflow@0.5.4
  - @lokvis/runtime@0.5.4
  - @lokvis/sdk@0.5.4
  - @lokvis/engine-pdf@0.5.4
  - @lokvis/plugin-pdf@0.5.4

## 0.5.3

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.3
  - @lokvis/workflow@0.5.3
  - @lokvis/runtime@0.5.3
  - @lokvis/sdk@0.5.3
  - @lokvis/engine-pdf@0.5.3
  - @lokvis/plugin-pdf@0.5.3

## 0.5.2

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.2
  - @lokvis/workflow@0.5.2
  - @lokvis/runtime@0.5.2
  - @lokvis/sdk@0.5.2
  - @lokvis/engine-pdf@0.5.2
  - @lokvis/plugin-pdf@0.5.2

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
  - @lokvis/engine-pdf@0.5.1
  - @lokvis/plugin-pdf@0.5.1

## 0.5.0

### Minor Changes

- feat: embed-* 三层集成包 + plugin-pdf 浏览器端激活

  - @lokvis/embed-image: 由 quick-image 重命名，hooks 统一为 useImageCompress/useImageResize/useImageConvert/useImageFavicon/useImageWatermark/useImageCrop
  - @lokvis/embed-pdf: 新增，5 个 PDF hooks（usePdfCompress/Merge/Split/Rotate/Watermark），内部经 plugin-pdf/web 在浏览器端运行 pdf-lib
  - @lokvis/embed-video: 新增，7 个 Video hooks（useVideoCompress/Transcode/Trim/Merge/ToGif/Screenshot/ExtractAudio），引擎层 stub，plugins 选项支持注入 remote backend
  - @lokvis/plugin-pdf: 新增 "./web" 子路径导出（pdfToolsPluginWeb），浏览器端注册 5 个真实 PDF 能力

### Patch Changes

- Updated dependencies []:
  - @lokvis/plugin-pdf@0.5.0
  - @lokvis/schema@0.5.0
  - @lokvis/workflow@0.5.0
  - @lokvis/runtime@0.5.0
  - @lokvis/sdk@0.5.0
  - @lokvis/engine-pdf@0.5.0
