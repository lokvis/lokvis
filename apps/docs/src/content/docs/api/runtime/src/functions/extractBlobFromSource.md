---
editUrl: false
next: false
prev: false
title: "extractBlobFromSource"
---

> **extractBlobFromSource**(`source`): `object`

Defined in: [runtime/src/asset-store.ts:58](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/asset-store.ts#L58)

从 AssetSource 提取 Blob 与 MIME(支持 file/blob,其余抛 not supported)

## Parameters

### source

[`AssetSource`](/docs/api/schema/src/type-aliases/assetsource/)

## Returns

`object`

### blob

> **blob**: `Blob`

### mimeType

> **mimeType**: `string`
