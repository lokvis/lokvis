# @lokvis/embed-video

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
