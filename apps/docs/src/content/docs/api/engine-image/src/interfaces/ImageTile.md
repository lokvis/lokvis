---
editUrl: false
next: false
prev: false
title: "ImageTile"
---

Defined in: [engine-image/src/types.ts:146](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/types.ts#L146)

图像分片(tile):大图按网格切分后的子区域。
用于 tile-based 处理,避免一次性把整张图解码到内存。

## Properties

### x

> **x**: `number`

Defined in: [engine-image/src/types.ts:148](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/types.ts#L148)

源图中的 x 偏移(像素)

***

### y

> **y**: `number`

Defined in: [engine-image/src/types.ts:150](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/types.ts#L150)

源图中的 y 偏移(像素)

***

### width

> **width**: `number`

Defined in: [engine-image/src/types.ts:152](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/types.ts#L152)

tile 宽度(像素)

***

### height

> **height**: `number`

Defined in: [engine-image/src/types.ts:154](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/types.ts#L154)

tile 高度(像素)
