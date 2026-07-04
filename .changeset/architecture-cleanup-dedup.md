---
"@lokvis/plugin-sdk": minor
"@lokvis/plugin-image": minor
"@lokvis/plugin-video": minor
"@lokvis/plugin-pdf": minor
"@lokvis/runtime": minor
---

架构清理:消除 plugin-* 重复代码 + 统一 worker-host transport 清理 + 修复 exif-reader 手动剔除字段 patch

- **plugin-sdk**: 新增 `createBlobCapabilityImpl` 工厂 + `defaultDeriveOutputMetadata` + `BlobCapabilityOptions`。封装"取 blob → 调 operation → 派生 metadata → createAsset → 进度/取消"五步样板,消除 plugin-image / plugin-video / plugin-pdf(single kind)三份近乎逐字相同的 `wrapAsImplementation` + `deriveOutputMetadata`
- **plugin-image**: 删除 `wrapAsImplementation` + `deriveOutputMetadata`(33 行),改用 `createBlobCapabilityImpl`
- **plugin-video**: 同上,删除重复代码改用工厂
- **plugin-pdf**: single kind 改用工厂;merge/split 形态不同保留自定义包装。`derivePdfMetadata` 改为返回 `(source, outBlob) => AssetMetadata` 签名以匹配工厂接口
- **runtime**: `worker-host.ts` 的 `dispose()` 和 `spawn()` catch 块改为调用 `teardownTransport()`,消除三处重复的 `offMessage/offError/terminate/null` 清理样板
- **plugin-image/exif-reader**: 删除"先构造 RawExifData 再解构删 raw"的 patch(`const { raw: _raw, ...exifData } = data; void _raw`),改为直接构造 `ExifData`。RawExifData 类型保留在 schema 供未来调试场景使用

验证:lint 0 errors、typecheck 全绿、test 623/623 通过
