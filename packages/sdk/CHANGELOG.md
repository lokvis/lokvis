# @lokvis/sdk

## 0.2.0

### Minor Changes

- 980eafd: 新增 LokvisError 错误类型体系(W4.2)

  - `LokvisError` 基类 + 稳定 `code` 字段(18 个错误码覆盖资产/工作流/能力/存储/Worker/降级/插件域)
  - 18 个具体子类(AssetNotFoundError / WorkflowInvalidError / StorageQuotaExceededError / DegradationRejectedError / PluginLoadError 等)
  - `fromLokvisError(unknown)` 归一函数:基于 `instanceof` 把 runtime 抛出的具体 Error 子类包装为对应 SDK 错误
  - 所有公开 API 添加 `@public` JSDoc 标记(W4.1)
  - `loadPlugin` 失败时抛 `PluginLoadError`(原裸 Error)

- bb5706c: EXIF 读取与查看面板(W7.3/7.4)——采用 MetadataReader 依赖反转长期方案,不进 Engine 层

  - **schema**:新增 `ExifData`(无 raw,面向 UI/Runtime)+ `RawExifData`(extends ExifData,Plugin 内部)+ `ExifRow` + `formatExifRows()` + `formatShutterSpeed()`。类型分层根治"UI 缓存需手动剔除 raw"的短期 patch。`PluginContext` 新增 `registerMetadataReader<T>(name, reader)` 方法,Plugin 提供查询函数,Runtime 持有引用按名调用
  - **plugin-image**:新增 `exif-reader.ts` 实现 `readExifFromBlob`(exifr ^7.1.3,零 WASM)。`imageToolsPlugin` installer 中通过 `ctx.registerMetadataReader('image.read-exif', ...)` 注册,返回前 RawExifData→ExifData 收窄(丢弃 raw)
  - **runtime**:`LokvisRuntime` 接口新增 `readAssetExif(id)`,`LokvisRuntimeImpl` 持有 `metadataReaders` Map + `_registerMetadataReader()`。Plugin 未安装时优雅降级返回 null
  - **sdk**:`installPlugin` / `createPluginContext` 接收 runtime 实例,`registerMetadataReader` 转发到 `runtime._registerMetadataReader`
  - **ui-react**:新增 `ExifPanel.tsx`(LRU cache 上限 16,effect 依赖 selectedAssetId 非 asset 引用),接入 `Inspector` 顶部。非 image 资产自动隐藏
  - 删除 `engine-image/src/operations/exif.ts` 占位文件(EXIF 不属于 Engine 层 Blob↔Blob 契约)
  - 新增 26 测试:schema 11 + plugin-image 9 + runtime 6。全部 523/523 通过,coverage lines 90.03% / branches 89.24%

### Patch Changes

- 0bef2e0: 修复 code review 发现的 7 个问题(跨包第三轮)

  - `ui-core` Slider:非受控模式下 `showValue` 显示值不随拖动更新,改用 internal state 跟踪当前值
  - `ui-core` Tabs:`useCallback` 依赖 `items`(数组字面量,每次渲染新引用)导致 memo 失效,改为普通函数
  - `ui-core` Dialog:模块级 `bodyOverflowLockCount` / `bodyOverflowPrev` 在 Vite HMR 重新执行模块时不重置,可能导致 body 永久锁死;添加 `import.meta.hot?.dispose` 清理回调
  - `sdk` CapabilityNotRegisteredError:构造函数不接受 `cause` 参数,`fromLokvisError` message 匹配分支丢失原始错误链路;补充 `cause?` 参数并传入
  - `sdk` fromLokvisError:`WorkflowNodeError('', '', msg, value)` 用空 nodeId 不利于定位失败节点,改为从 message 提取 nodeId
  - `docs` sdk.md:示例 `fromLokvisError` 总是返回 LokvisError,`instanceof LokvisError` 检查冗余且 else 分支为死代码;`err.guide` 需 `instanceof DegradationRejectedError` 窄化类型才能访问
  - `examples` custom-workspace:删除 `fromLokvisError` 后无法触达的 else 死代码分支

- Updated dependencies [1ffd8c1]
- Updated dependencies [2aebedb]
- Updated dependencies [2aebedb]
- Updated dependencies [e95976e]
- Updated dependencies [bb5706c]
  - @lokvis/plugin-sdk@0.2.0
  - @lokvis/runtime@0.2.0
  - @lokvis/schema@0.2.0

## 0.1.1-beta.0

### Patch Changes

- Updated dependencies []:
  - @lokvis/runtime@0.2.0-beta.0
  - @lokvis/schema@0.2.0-beta.0
  - @lokvis/plugin-sdk@0.1.1-beta.0
