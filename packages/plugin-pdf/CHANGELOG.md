# @lokvis/plugin-pdf

## 0.2.0

### Minor Changes

- 1ffd8c1: 架构清理:消除 plugin-* 重复代码 + 统一 worker-host transport 清理 + 修复 exif-reader 手动剔除字段 patch

  - **plugin-sdk**: 新增 `createBlobCapabilityImpl` 工厂 + `defaultDeriveOutputMetadata` + `BlobCapabilityOptions`。封装"取 blob → 调 operation → 派生 metadata → createAsset → 进度/取消"五步样板,消除 plugin-image / plugin-video / plugin-pdf(single kind)三份近乎逐字相同的 `wrapAsImplementation` + `deriveOutputMetadata`
  - **plugin-image**: 删除 `wrapAsImplementation` + `deriveOutputMetadata`(33 行),改用 `createBlobCapabilityImpl`
  - **plugin-video**: 同上,删除重复代码改用工厂
  - **plugin-pdf**: single kind 改用工厂;merge/split 形态不同保留自定义包装。`derivePdfMetadata` 改为返回 `(source, outBlob) => AssetMetadata` 签名以匹配工厂接口
  - **runtime**: `worker-host.ts` 的 `dispose()` 和 `spawn()` catch 块改为调用 `teardownTransport()`,消除三处重复的 `offMessage/offError/terminate/null` 清理样板
  - **plugin-image/exif-reader**: 删除"先构造 RawExifData 再解构删 raw"的 patch(`const { raw: _raw, ...exifData } = data; void _raw`),改为直接构造 `ExifData`。RawExifData 类型保留在 schema 供未来调试场景使用

  验证:lint 0 errors、typecheck 全绿、test 623/623 通过

- 2aebedb: ## @lokvis/engine-pdf / @lokvis/engine-video

  - 内部对齐 stub 检测依赖

  ## @lokvis/plugin-pdf / @lokvis/plugin-video
  - 新增 stub 自动检测:若底层 engine 不可用则 `status: 'stub'`,使 `CapabilityRegistry.resolve()` 不再解析到占位实现

### Patch Changes

- Updated dependencies [1ffd8c1]
- Updated dependencies [2aebedb]
- Updated dependencies [2aebedb]
- Updated dependencies [2aebedb]
- Updated dependencies [e95976e]
- Updated dependencies [bb5706c]
- Updated dependencies [191877e]
  - @lokvis/plugin-sdk@0.2.0
  - @lokvis/capability@0.2.0
  - @lokvis/engine-pdf@0.2.0
  - @lokvis/schema@0.2.0

## 0.2.0-beta.0

### Minor Changes

- ## @lokvis/engine-pdf / @lokvis/engine-video
  - 内部对齐 stub 检测依赖

  ## @lokvis/plugin-pdf / @lokvis/plugin-video
  - 新增 stub 自动检测:若底层 engine 不可用则 `status: 'stub'`,使 `CapabilityRegistry.resolve()` 不再解析到占位实现

### Patch Changes

- Updated dependencies []:
  - @lokvis/capability@0.2.0-beta.0
  - @lokvis/engine-pdf@0.2.0-beta.0
  - @lokvis/schema@0.2.0-beta.0
  - @lokvis/plugin-sdk@0.1.1-beta.0
