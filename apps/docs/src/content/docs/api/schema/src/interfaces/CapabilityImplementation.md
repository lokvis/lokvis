---
editUrl: false
next: false
prev: false
title: "CapabilityImplementation"
---

Defined in: [schema/src/capability.ts:81](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/capability.ts#L81)

能力实现（由 Plugin 注册到 Runtime）

## Properties

### capability

> **capability**: `string`

Defined in: [schema/src/capability.ts:83](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/capability.ts#L83)

对应的 Capability 名

***

### engine

> **engine**: `string`

Defined in: [schema/src/capability.ts:85](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/capability.ts#L85)

实现该能力的引擎名

***

### status?

> `optional` **status?**: `"stable"` \| `"stub"`

Defined in: [schema/src/capability.ts:94](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/capability.ts#L94)

实现状态:
- `'stable'`(默认):可正常执行
- `'stub'`:占位实现,调用 execute 会抛出异常

CapabilityRegistry.resolve() 会跳过 stub 实现,
避免运行时出现 "not implemented" 错误。

***

### performance?

> `optional` **performance?**: [`PerformanceLevel`](/docs/api/schema/src/type-aliases/performancelevel/)

Defined in: [schema/src/capability.ts:99](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/capability.ts#L99)

该引擎的性能等级(可选)。缺省时使用能力声明的 performance。
用于 EngineSelectionStrategy('fastest'/'balanced')排序选择。

***

### execute

> **execute**: (`inputs`, `params`, `context`) => `Promise`\<[`Asset`](/docs/api/schema/src/interfaces/asset/)[]\>

Defined in: [schema/src/capability.ts:101](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/capability.ts#L101)

实际执行函数

#### Parameters

##### inputs

[`Asset`](/docs/api/schema/src/interfaces/asset/)[]

##### params

`Record`\<`string`, `unknown`\>

##### context

[`ExecutionContext`](/docs/api/schema/src/interfaces/executioncontext/)

#### Returns

`Promise`\<[`Asset`](/docs/api/schema/src/interfaces/asset/)[]\>
