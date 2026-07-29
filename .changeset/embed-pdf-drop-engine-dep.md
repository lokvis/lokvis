---
'@lokvis/embed-pdf': patch
---

修复 embed-pdf 越层依赖 engine-pdf(五层架构单向依赖)

- 移除 `@lokvis/engine-pdf` 依赖,`internal/download.ts` 不再直接 import engine
- `getPdfFileInfo(blob, pageCount?)` 改为纯同步构造器:页数由调用方经 `runtime.readAssetPdfInfo(id)`(MetadataReader 依赖反转)传入,解析失败时为 null
- 破坏性:公开导出的 `getPdfFileInfo` 由 `async (blob) => Promise<PdfFileInfo>` 改为 `(blob, pageCount?) => PdfFileInfo`,不再自动解析页数
