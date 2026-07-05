---
editUrl: false
next: false
prev: false
title: "ImageChunk"
---

Defined in: [engine-image/src/types.ts:161](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/types.ts#L161)

流式操作结果:产出一系列 Blob 分片(chunk),最后合并。
每个 chunk 携带其在输出图中的位置信息。

## Properties

### tile

> **tile**: [`ImageTile`](/docs/api/engine-image/src/interfaces/imagetile/)

Defined in: [engine-image/src/types.ts:163](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/types.ts#L163)

该 chunk 在输出图中的 tile 区域

***

### blob

> **blob**: `Blob`

Defined in: [engine-image/src/types.ts:165](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/types.ts#L165)

该区域的编码 Blob
