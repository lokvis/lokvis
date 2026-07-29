---
"@lokvis/schema": minor
"@lokvis/runtime": patch
"@lokvis/plugin-image": patch
"@lokvis/plugin-pdf": patch
"@lokvis/plugin-video": patch
---

收敛 MetadataReader 名称到单一事实源,并移除 Runtime 层脆弱的 PDF 页数正则解析(架构评审 #6)。

- `@lokvis/schema` 新增 `METADATA_READER_NAMES` 常量与 `MetadataReaderName` 类型,作为跨层名称单一来源。
- `runtime` 的 asset-manager 不再硬编码 `'image.read-exif'` / `'image.read-metadata'` / `'pdf.read-info'`,改为引用 schema 常量。
- 各 plugin 导出的 `EXIF_READER_NAME` / `IMAGE_METADATA_READER_NAME` / `PDF_INFO_READER_NAME` / `VIDEO_INFO_READER_NAME` 改为 re-export schema 常量字段(导出名不变)。
- 移除 `asset-store` 导入时的 `extractPdfPageCount`(`/Type /Pages /Count N` 正则猜测)。PDF 页数属领域特定元数据,应经 `runtime.readAssetPdfInfo`(plugin-pdf 注册的 `pdf.read-info` MetadataReader)按需读取,而非在 Runtime 层用脆弱结构解析。
