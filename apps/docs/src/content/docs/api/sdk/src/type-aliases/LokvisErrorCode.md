---
editUrl: false
next: false
prev: false
title: "LokvisErrorCode"
---

> **LokvisErrorCode** = `"ASSET_NOT_FOUND"` \| `"ASSET_IMPORT_FAILED"` \| `"ASSET_EXPORT_FAILED"` \| `"WORKFLOW_INVALID"` \| `"WORKFLOW_CYCLE"` \| `"WORKFLOW_NODE_ERROR"` \| `"CAPABILITY_NOT_REGISTERED"` \| `"CAPABILITY_STUB_ONLY"` \| `"STORAGE_QUOTA_EXCEEDED"` \| `"STORAGE_OPFS_UNAVAILABLE"` \| `"STORAGE_IDB_UNAVAILABLE"` \| `"WORKER_CRASHED"` \| `"WORKER_TIMEOUT"` \| `"WORKER_DEAD"` \| `"WORKER_REQUEST_ABORTED"` \| `"WORKER_HANDSHAKE_FAILED"` \| `"DEGRADATION_REJECTED"` \| `"PLUGIN_LOAD_FAILED"` \| `"UNKNOWN"`

Defined in: [sdk/src/errors.ts:40](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/sdk/src/errors.ts#L40)

错误代码枚举(稳定契约,不随实现重构变更)。

命名约定:`<DOMAIN>_<REASON>`,域与 SDK 顶层模块对齐。
