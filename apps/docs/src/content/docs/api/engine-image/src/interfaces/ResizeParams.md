---
editUrl: false
next: false
prev: false
title: "ResizeParams"
---

Defined in: [engine-image/src/types.ts:32](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/types.ts#L32)

Resize 参数

## Properties

### width?

> `optional` **width?**: `number`

Defined in: [engine-image/src/types.ts:33](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/types.ts#L33)

***

### height?

> `optional` **height?**: `number`

Defined in: [engine-image/src/types.ts:34](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/types.ts#L34)

***

### fit?

> `optional` **fit?**: [`FitStrategy`](/docs/api/engine-image/src/type-aliases/fitstrategy/)

Defined in: [engine-image/src/types.ts:35](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/types.ts#L35)

***

### maintainAspectRatio?

> `optional` **maintainAspectRatio?**: `boolean`

Defined in: [engine-image/src/types.ts:36](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/types.ts#L36)

***

### dpi?

> `optional` **dpi?**: `number`

Defined in: [engine-image/src/types.ts:41](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/types.ts#L41)

物理分辨率(每英寸像素数)。仅对 PNG 输出生效:嵌入 pHYs chunk,
供打印软件读取(W8.4)。非正数或非 PNG 输出时忽略。
