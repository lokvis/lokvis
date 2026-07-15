---
'@lokvis/sdk': minor
---

W17.2: SDK 类型导出审查 — 补全 19 个公共类型 re-export

## 新增

SDK 作为 lokvis 的清洁 façade(README line 5),消费者不应直接依赖
`@lokvis/runtime` / `@lokvis/schema` / `@lokvis/plugin-sdk`。本次补全所有
在公共 API 签名中出现但此前未导出的类型:

### Runtime 类型(11 个)
- `RuntimeStatus` / `RunOptions` / `ToMcpManifestOptions`
- `BatchProcessor` / `BatchJob` / `BatchItem` / `BatchItemInput`
- `EnqueueOptions` / `BatchProgress`

### Schema 类型(13 个)
- `AssetSource`(构造 importAsset 参数)
- `AssetType` / `AssetMetadata` / `HistoryEntry`(history() 返回)
- `ExifData`(readAssetExif() 返回)
- `EngineSelectionStrategy`(RuntimeConfig.engineStrategy)
- `EventBus` / `LokvisEvent` / `LokvisEventType` / `EventHandler`
- `BatchItemStatus` / `BatchJobStatus`

### Plugin 类型(1 个)
- `PluginInstaller`(PluginLoadEntry.install 字段类型)

## 迁移

无需修改现有代码 —— 新增的全是 type-only re-export,不影响运行时。
消费者可直接从 `@lokvis/sdk` 导入上述类型,无需再 peer-dependency
`@lokvis/runtime` / `@lokvis/schema`。
