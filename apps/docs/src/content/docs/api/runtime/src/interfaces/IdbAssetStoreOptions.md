---
editUrl: false
next: false
prev: false
title: "IdbAssetStoreOptions"
---

Defined in: [runtime/src/idb-asset-store.ts:32](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/idb-asset-store.ts#L32)

IDB AssetStore 配置

## Properties

### dbName?

> `optional` **dbName?**: `string`

Defined in: [runtime/src/idb-asset-store.ts:34](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/idb-asset-store.ts#L34)

数据库名(默认 'lokvis-assets')

***

### dbInstance?

> `optional` **dbInstance?**: [`AssetDatabase`](/docs/api/runtime/src/classes/assetdatabase/)

Defined in: [runtime/src/idb-asset-store.ts:39](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/idb-asset-store.ts#L39)

测试注入:自定义 Dexie 实例。
默认创建新实例。
