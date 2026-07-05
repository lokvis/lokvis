---
editUrl: false
next: false
prev: false
title: "Asset"
---

Defined in: [schema/src/asset.ts:67](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/asset.ts#L67)

统一 Asset 抽象

## Properties

### id

> **id**: `string`

Defined in: [schema/src/asset.ts:68](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/asset.ts#L68)

***

### type

> **type**: [`AssetType`](/docs/api/schema/src/type-aliases/assettype/)

Defined in: [schema/src/asset.ts:69](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/asset.ts#L69)

***

### metadata

> **metadata**: [`AssetMetadata`](/docs/api/schema/src/interfaces/assetmetadata/)

Defined in: [schema/src/asset.ts:70](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/asset.ts#L70)

***

### blob

> **blob**: [`BlobHandle`](/docs/api/schema/src/interfaces/blobhandle/)

Defined in: [schema/src/asset.ts:72](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/asset.ts#L72)

OPFS 中的引用，不直接持有内存

***

### preview?

> `optional` **preview?**: [`PreviewHandle`](/docs/api/schema/src/interfaces/previewhandle/)

Defined in: [schema/src/asset.ts:74](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/asset.ts#L74)

缩略图（可选）

***

### history

> **history**: [`HistoryEntry`](/docs/api/schema/src/interfaces/historyentry/)[]

Defined in: [schema/src/asset.ts:76](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/asset.ts#L76)

处理历史

***

### tags

> **tags**: `string`[]

Defined in: [schema/src/asset.ts:78](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/asset.ts#L78)

用户标签

***

### createdAt

> **createdAt**: `number`

Defined in: [schema/src/asset.ts:79](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/asset.ts#L79)

***

### updatedAt

> **updatedAt**: `number`

Defined in: [schema/src/asset.ts:80](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/asset.ts#L80)
