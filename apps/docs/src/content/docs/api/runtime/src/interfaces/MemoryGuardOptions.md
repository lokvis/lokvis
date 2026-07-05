---
editUrl: false
next: false
prev: false
title: "MemoryGuardOptions"
---

Defined in: [runtime/src/memory-guard.ts:39](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/memory-guard.ts#L39)

## Properties

### budget?

> `optional` **budget?**: `number`

Defined in: [runtime/src/memory-guard.ts:41](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/memory-guard.ts#L41)

总内存预算(字节),超出 high 阈值则建议溢出

***

### elevatedRatio?

> `optional` **elevatedRatio?**: `number`

Defined in: [runtime/src/memory-guard.ts:43](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/memory-guard.ts#L43)

elevated 阈值占 budget 比例(默认 0.6)

***

### highRatio?

> `optional` **highRatio?**: `number`

Defined in: [runtime/src/memory-guard.ts:45](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/memory-guard.ts#L45)

high 阈值(默认 0.8):达到则 shouldSpill=true

***

### criticalRatio?

> `optional` **criticalRatio?**: `number`

Defined in: [runtime/src/memory-guard.ts:47](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/memory-guard.ts#L47)

critical 阈值(默认 0.95):达到则降级阶梯走 L4 拒绝

***

### assetStore?

> `optional` **assetStore?**: [`AssetStore`](/docs/api/runtime/src/interfaces/assetstore/)

Defined in: [runtime/src/memory-guard.ts:49](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/memory-guard.ts#L49)

溢出目标(通常为 OPFS-backed AssetStore);不提供则 shouldSpill 永远 false
