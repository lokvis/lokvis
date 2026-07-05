---
editUrl: false
next: false
prev: false
title: "compressToTargetSize"
---

> **compressToTargetSize**(`blob`, `format`, `targetSize`, `signal?`): `Promise`\<`Blob`\>

Defined in: [engine-image/src/operations/compress-target.ts:16](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/operations/compress-target.ts#L16)

目标体积压缩：二分查找质量

## Parameters

### blob

`Blob`

### format

[`ImageOutputFormat`](/docs/api/engine-image/src/type-aliases/imageoutputformat/)

### targetSize

`number`

### signal?

`AbortSignal`

## Returns

`Promise`\<`Blob`\>
