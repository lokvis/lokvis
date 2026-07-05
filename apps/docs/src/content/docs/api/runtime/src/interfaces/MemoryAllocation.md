---
editUrl: false
next: false
prev: false
title: "MemoryAllocation"
---

Defined in: [runtime/src/memory-guard.ts:53](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/memory-guard.ts#L53)

track() 返回的分配句柄:丢弃引用时调用 release() 回退计数(幂等)

## Properties

### bytes

> `readonly` **bytes**: `number`

Defined in: [runtime/src/memory-guard.ts:55](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/memory-guard.ts#L55)

该笔登记的字节数

## Methods

### release()

> **release**(): `void`

Defined in: [runtime/src/memory-guard.ts:57](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/memory-guard.ts#L57)

回退登记;重复调用幂等(仅首次生效)

#### Returns

`void`
