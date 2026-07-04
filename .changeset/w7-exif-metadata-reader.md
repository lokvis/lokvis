---
"@lokvis/schema": minor
"@lokvis/plugin-image": minor
"@lokvis/runtime": minor
"@lokvis/sdk": minor
"@lokvis/ui-react": minor
---

EXIF 读取与查看面板(W7.3/7.4)——采用 MetadataReader 依赖反转长期方案,不进 Engine 层

- **schema**:新增 `ExifData`(无 raw,面向 UI/Runtime)+ `RawExifData`(extends ExifData,Plugin 内部)+ `ExifRow` + `formatExifRows()` + `formatShutterSpeed()`。类型分层根治"UI 缓存需手动剔除 raw"的短期 patch。`PluginContext` 新增 `registerMetadataReader<T>(name, reader)` 方法,Plugin 提供查询函数,Runtime 持有引用按名调用
- **plugin-image**:新增 `exif-reader.ts` 实现 `readExifFromBlob`(exifr ^7.1.3,零 WASM)。`imageToolsPlugin` installer 中通过 `ctx.registerMetadataReader('image.read-exif', ...)` 注册,返回前 RawExifData→ExifData 收窄(丢弃 raw)
- **runtime**:`LokvisRuntime` 接口新增 `readAssetExif(id)`,`LokvisRuntimeImpl` 持有 `metadataReaders` Map + `_registerMetadataReader()`。Plugin 未安装时优雅降级返回 null
- **sdk**:`installPlugin` / `createPluginContext` 接收 runtime 实例,`registerMetadataReader` 转发到 `runtime._registerMetadataReader`
- **ui-react**:新增 `ExifPanel.tsx`(LRU cache 上限 16,effect 依赖 selectedAssetId 非 asset 引用),接入 `Inspector` 顶部。非 image 资产自动隐藏
- 删除 `engine-image/src/operations/exif.ts` 占位文件(EXIF 不属于 Engine 层 Blob↔Blob 契约)
- 新增 26 测试:schema 11 + plugin-image 9 + runtime 6。全部 523/523 通过,coverage lines 90.03% / branches 89.24%
