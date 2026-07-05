---
editUrl: false
next: false
prev: false
title: "splitIntoTiles"
---

> **splitIntoTiles**(`width`, `height`, `tileSize?`): [`ImageTile`](/docs/api/engine-image/src/interfaces/imagetile/)[]

Defined in: [engine-image/src/operations/tiles.ts:36](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/operations/tiles.ts#L36)

把 (width × height) 的图切成 tile 网格。

tile 按行优先排列,边缘 tile 可能小于 tileSize(对齐到图边界)。
返回空数组的边界情况:width/height <= 0 或 tileSize <= 0。

## Parameters

### width

`number`

### height

`number`

### tileSize?

`number` = `DEFAULT_TILE_SIZE`

## Returns

[`ImageTile`](/docs/api/engine-image/src/interfaces/imagetile/)[]
