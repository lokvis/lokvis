---
editUrl: false
next: false
prev: false
title: "decodeResized"
---

> **decodeResized**(`blob`, `targetWidth`, `targetHeight`): `Promise`\<[`DecodedImage`](/docs/api/engine-image/src/interfaces/decodedimage/)\>

Defined in: [engine-image/src/canvas-engine.ts:146](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/canvas-engine.ts#L146)

解码并直接缩放到目标尺寸(W3.2 大图内存优化)。

使用 createImageBitmap 的 resizeWidth/resizeHeight 选项,在解码阶段
就缩放,避免先 decode 全分辨率 bitmap 再缩放——后者会短暂持有全分辨率
位图(对超大图是 OOM 风险点)。这是 canvas 引擎最大的单点内存优化。

仅对"缩小"有意义(target < source);放大时行为等同普通 decode 后再缩放。
兼容性:createImageBitmap resize 选项在 Chrome/Edge/Firefox 现代版本可用,
Safari 16.4+ 支持;不支持(抛错)时回退到普通 decode + drawImage 缩放。

## Parameters

### blob

`Blob`

输入图

### targetWidth

`number`

目标宽(像素)

### targetHeight

`number`

目标高(像素)

## Returns

`Promise`\<[`DecodedImage`](/docs/api/engine-image/src/interfaces/decodedimage/)\>
