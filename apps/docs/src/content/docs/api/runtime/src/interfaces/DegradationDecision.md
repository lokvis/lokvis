---
editUrl: false
next: false
prev: false
title: "DegradationDecision"
---

Defined in: [runtime/src/degradation.ts:59](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/degradation.ts#L59)

降级决策结果

## Properties

### level

> **level**: [`DegradationLevel`](/docs/api/runtime/src/type-aliases/degradationlevel/)

Defined in: [runtime/src/degradation.ts:60](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/degradation.ts#L60)

***

### maxEdge?

> `optional` **maxEdge?**: `number`

Defined in: [runtime/src/degradation.ts:62](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/degradation.ts#L62)

L3 时建议缩放到的最大边长(像素);其余等级 undefined

***

### quality?

> `optional` **quality?**: `number`

Defined in: [runtime/src/degradation.ts:64](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/degradation.ts#L64)

L3 时建议质量(0-100);其余等级 undefined

***

### spill

> **spill**: `boolean`

Defined in: [runtime/src/degradation.ts:66](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/degradation.ts#L66)

L2/L3 时是否把中间结果溢出到 OPFS

***

### reason

> **reason**: `string`

Defined in: [runtime/src/degradation.ts:68](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/degradation.ts#L68)

决策依据(便于日志 / 事件 / 调试)
