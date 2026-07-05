---
editUrl: false
next: false
prev: false
title: "isDownscale"
---

> **isDownscale**(`srcW`, `srcH`, `targetW`, `targetH`): `boolean`

Defined in: [engine-image/src/operations/tiles.ts:104](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/operations/tiles.ts#L104)

判断给定的源/目标尺寸是否为"缩小"(target < source)。
用于决定 resize 是否走 createImageBitmap resize 选项路径(避免全分辨率 decode)。

## Parameters

### srcW

`number`

### srcH

`number`

### targetW

`number`

### targetH

`number`

## Returns

`boolean`
