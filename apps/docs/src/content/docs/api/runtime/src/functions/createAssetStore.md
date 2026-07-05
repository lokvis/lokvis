---
editUrl: false
next: false
prev: false
title: "createAssetStore"
---

> **createAssetStore**(`options?`): `Promise`\<[`AssetStore`](/docs/api/runtime/src/interfaces/assetstore/)\>

Defined in: [runtime/src/asset-store.ts:296](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/asset-store.ts#L296)

AssetStore 工厂:自动探测环境,按降级链创建存储(W2.8)。

顺序:
  1. preferOpfs(默认 true)且 OPFS 可用 → OpfsAssetStore
  2. IndexedDB 可用 → IdbAssetStore(Dexie)
  3. 兜底 → MemoryAssetStore(始终可用,不持久化)

任一阶段抛错均自动降级,最终必定返回一个可用 store。

## Parameters

### options?

[`CreateAssetStoreOptions`](/docs/api/runtime/src/interfaces/createassetstoreoptions/) = `{}`

## Returns

`Promise`\<[`AssetStore`](/docs/api/runtime/src/interfaces/assetstore/)\>
