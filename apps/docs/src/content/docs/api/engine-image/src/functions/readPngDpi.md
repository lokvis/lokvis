---
editUrl: false
next: false
prev: false
title: "readPngDpi"
---

> **readPngDpi**(`png`): `Promise`\<`number` \| `null`\>

Defined in: [engine-image/src/operations/png-metadata.ts:142](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/operations/png-metadata.ts#L142)

读取 PNG pHYs chunk 中的 DPI;无 pHYs 或非 PNG 返回 null

## Parameters

### png

`Blob`

## Returns

`Promise`\<`number` \| `null`\>
