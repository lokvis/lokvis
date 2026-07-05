---
editUrl: false
next: false
prev: false
title: "DegradationContext"
---

Defined in: [runtime/src/degradation.ts:36](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/degradation.ts#L36)

决策上下文(由调用方据 MemoryGuard + 操作能力构造)

## Properties

### pressure

> **pressure**: [`MemoryPressure`](/docs/api/runtime/src/type-aliases/memorypressure/)

Defined in: [runtime/src/degradation.ts:38](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/degradation.ts#L38)

当前内存压力等级(来自 MemoryGuard.getPressure)

***

### canSpill

> **canSpill**: `boolean`

Defined in: [runtime/src/degradation.ts:40](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/degradation.ts#L40)

是否可溢出中间结果到 OPFS(MemoryGuard.canSpill)

***

### canTile

> **canTile**: `boolean`

Defined in: [runtime/src/degradation.ts:42](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/degradation.ts#L42)

操作是否支持 tiling / streaming(几何变换通常 true,模糊/水印 false)

***

### inputBytes

> **inputBytes**: `number`

Defined in: [runtime/src/degradation.ts:44](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/degradation.ts#L44)

输入字节数(用于 L4 判定:输入本身过大时即使降级也无救)

***

### budget

> **budget**: `number`

Defined in: [runtime/src/degradation.ts:46](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/degradation.ts#L46)

内存预算(字节,用于 L4 引导信息)

***

### decodedBytes?

> `optional` **decodedBytes?**: `number`

Defined in: [runtime/src/degradation.ts:55](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/degradation.ts#L55)

解码后位图估算字节(用于 L4 判定:decode 后超 critical 且
已是 maxEdge 缩放后仍超 → reject)。可选,缺省时仅按 pressure 判。

**强烈建议提供**:可通过 estimateDecodedBytes(width, height) 计算。
缺省时 pressure=critical + canSpill=true 场景会跳过 L4 判定,
直接返回 L3-degraded,可能导致超大图缩放后仍 OOM。
