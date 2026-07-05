---
editUrl: false
next: false
prev: false
title: "AssetRecord"
---

Defined in: [runtime/src/idb-asset-store.ts:43](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/idb-asset-store.ts#L43)

IndexedDB 中的资产记录(Asset 元数据 + Blob 数据)

## Properties

### id

> **id**: `string`

Defined in: [runtime/src/idb-asset-store.ts:45](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/idb-asset-store.ts#L45)

主键 = Asset.id

***

### asset

> **asset**: [`Asset`](/docs/api/schema/src/interfaces/asset/)

Defined in: [runtime/src/idb-asset-store.ts:47](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/idb-asset-store.ts#L47)

资产元数据

***

### blob

> **blob**: `Blob`

Defined in: [runtime/src/idb-asset-store.ts:49](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/idb-asset-store.ts#L49)

原始 Blob 数据(结构化克隆存储)
