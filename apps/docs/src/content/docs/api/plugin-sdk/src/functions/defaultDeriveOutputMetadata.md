---
editUrl: false
next: false
prev: false
title: "defaultDeriveOutputMetadata"
---

> **defaultDeriveOutputMetadata**(`source`, `outBlob`): [`AssetMetadata`](/docs/api/schema/src/interfaces/assetmetadata/)

Defined in: [plugin-sdk/src/index.ts:109](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/plugin-sdk/src/index.ts#L109)

默认元数据派生:从 source Asset 传播 dimensions,从 outBlob 取 mimeType/size/format。
适用于 image/video 等"变换不改变 dimensions 语义"的 Blob↔Blob 操作。

## Parameters

### source

[`Asset`](/docs/api/schema/src/interfaces/asset/)

### outBlob

`Blob`

## Returns

[`AssetMetadata`](/docs/api/schema/src/interfaces/assetmetadata/)
