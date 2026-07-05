---
editUrl: false
next: false
prev: false
title: "CapabilityParam"
---

Defined in: [schema/src/capability.ts:25](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/capability.ts#L25)

能力参数定义

## Properties

### name

> **name**: `string`

Defined in: [schema/src/capability.ts:26](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/capability.ts#L26)

***

### type

> **type**: [`CapabilityParamType`](/docs/api/schema/src/type-aliases/capabilityparamtype/)

Defined in: [schema/src/capability.ts:27](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/capability.ts#L27)

***

### description?

> `optional` **description?**: `string`

Defined in: [schema/src/capability.ts:28](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/capability.ts#L28)

***

### required?

> `optional` **required?**: `boolean`

Defined in: [schema/src/capability.ts:29](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/capability.ts#L29)

***

### default?

> `optional` **default?**: `unknown`

Defined in: [schema/src/capability.ts:30](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/capability.ts#L30)

***

### min?

> `optional` **min?**: `number`

Defined in: [schema/src/capability.ts:31](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/capability.ts#L31)

***

### max?

> `optional` **max?**: `number`

Defined in: [schema/src/capability.ts:32](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/capability.ts#L32)

***

### values?

> `optional` **values?**: `string`[]

Defined in: [schema/src/capability.ts:34](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/capability.ts#L34)

type === 'enum' 时的可选值

***

### items?

> `optional` **items?**: [`CapabilityParamType`](/docs/api/schema/src/type-aliases/capabilityparamtype/)

Defined in: [schema/src/capability.ts:36](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/capability.ts#L36)

type === 'array' 时的元素类型
