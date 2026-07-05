---
editUrl: false
next: false
prev: false
title: "resize"
---

> **resize**(`blob`, `params`, `signal?`): `Promise`\<`Blob`\>

Defined in: [engine-image/src/operations/transform.ts:31](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/operations/transform.ts#L31)

Resize：调整尺寸

W3.2 备注:canvas 引擎的 createImageBitmap 一次性全量解码,无法在解码
阶段就按目标尺寸缩放(需先 decode 拿到源图比例才能算目标,陷入循环)。
因此 resize 走标准的 decode → computeTargetSize → drawImage 缩放路径。
大图缩小的单点内存优化(createImageBitmap resize 选项)留给未来"显式
maxEdge"型 API 或 WASM 引擎使用(见 canvas-engine.decodeResized)。
W3.2 真正落地的是分片基础设施(tiles.ts:splitIntoTiles / mergeChunks),
供流式流水线按 tile 处理 + 中间结果溢出 OPFS。

## Parameters

### blob

`Blob`

### params

`Record`\<`string`, `any`\>

### signal?

`AbortSignal`

## Returns

`Promise`\<`Blob`\>
