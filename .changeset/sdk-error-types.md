---
'@lokvis/sdk': minor
---

新增 LokvisError 错误类型体系(W4.2)

- `LokvisError` 基类 + 稳定 `code` 字段(18 个错误码覆盖资产/工作流/能力/存储/Worker/降级/插件域)
- 18 个具体子类(AssetNotFoundError / WorkflowInvalidError / StorageQuotaExceededError / DegradationRejectedError / PluginLoadError 等)
- `fromLokvisError(unknown)` 归一函数:基于 `instanceof` 把 runtime 抛出的具体 Error 子类包装为对应 SDK 错误
- 所有公开 API 添加 `@public` JSDoc 标记(W4.1)
- `loadPlugin` 失败时抛 `PluginLoadError`(原裸 Error)
