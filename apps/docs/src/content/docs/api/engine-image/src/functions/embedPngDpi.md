---
editUrl: false
next: false
prev: false
title: "embedPngDpi"
---

> **embedPngDpi**(`png`, `dpi`): `Promise`\<`Blob`\>

Defined in: [engine-image/src/operations/png-metadata.ts:103](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/operations/png-metadata.ts#L103)

把 DPI 嵌入 PNG Blob 的 pHYs chunk。

行为:
- 若 Blob 不是 PNG,原样返回(不抛错;调用方负责按格式调用)。
- 若已存在 pHYs chunk,替换其数据;否则在 IHDR 之后插入新的 pHYs chunk。
- dpi 必须为正数,否则原样返回。

## Parameters

### png

`Blob`

PNG 格式的 Blob

### dpi

`number`

物理分辨率(每英寸像素数),正数

## Returns

`Promise`\<`Blob`\>

新的 PNG Blob(携带 pHYs chunk)
