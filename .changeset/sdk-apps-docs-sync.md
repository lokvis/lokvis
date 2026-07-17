---
"@lokvis/sdk": minor
---

同步 apps/docs 中英两版 sdk.md 与 docs/sdk-reference.md(T1.1 + Task D 验收缺口)。

PR #28 修正了 docs/sdk-reference.md 的 Runtime API 表与错误码表,
但 apps/docs/src/content/docs/sdk.md 与 zh-cn/sdk.md 未同步:

Runtime API 表:
- 移除 `getAssetBlob(id)`(公共 Runtime 不暴露,仅在 PluginContext 内可用)
- 修正 `cancel(workflowId)` 返回 `Promise<void>`(原标 `void`)
- 修正 `undo()` / `redo()` 签名为 `(workflowId): Promise<void>`(原无参,返回 `Promise<AssetId|null>`)
- 重命名 `readAssetMetadata` → `readAssetExif`(返回 `Promise<ExifData | null>`)
- 移除不存在的 `listCapabilities()` alias
- 补列 15 个缺失方法:version / status / isPro / batch / pause / resume /
  getCurrentOutputs / disposeWorkflow / history / getHistoryState / jumpTo /
  hasCapability / isStubOnly / getStorageUsage / installPlugin

错误码表:
- 移除 `BATCH_LIMIT_EXCEEDED`(代码中不存在此错误码)
- 补列 9 个缺失错误码:ASSET_BLOB_NOT_FOUND / ASSET_IMPORT_FAILED /
  ASSET_EXPORT_FAILED / WORKFLOW_NODE_ERROR / STORAGE_OPFS_UNAVAILABLE /
  STORAGE_IDB_UNAVAILABLE / WORKER_DEAD / WORKER_REQUEST_ABORTED /
  WORKER_HANDSHAKE_FAILED
