---
editUrl: false
next: false
prev: false
title: "CapabilityRegistry"
---

Defined in: [runtime/src/capability-registry.ts:32](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/capability-registry.ts#L32)

能力注册中心

## Constructors

### Constructor

> **new CapabilityRegistry**(`defaultStrategy?`): `CapabilityRegistry`

Defined in: [runtime/src/capability-registry.ts:36](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/capability-registry.ts#L36)

#### Parameters

##### defaultStrategy?

[`EngineSelectionStrategy`](/docs/api/schema/src/type-aliases/engineselectionstrategy/) = `'first'`

#### Returns

`CapabilityRegistry`

## Methods

### registerCapability()

> **registerCapability**(`capability`): `void`

Defined in: [runtime/src/capability-registry.ts:41](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/capability-registry.ts#L41)

注册一个能力声明

#### Parameters

##### capability

[`Capability`](/docs/api/schema/src/interfaces/capability/)

#### Returns

`void`

***

### registerImplementation()

> **registerImplementation**(`impl`): `void`

Defined in: [runtime/src/capability-registry.ts:50](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/capability-registry.ts#L50)

注册能力实现

#### Parameters

##### impl

[`CapabilityImplementation`](/docs/api/schema/src/interfaces/capabilityimplementation/)

#### Returns

`void`

***

### list()

> **list**(): [`Capability`](/docs/api/schema/src/interfaces/capability/)[]

Defined in: [runtime/src/capability-registry.ts:61](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/capability-registry.ts#L61)

列出所有能力声明

#### Returns

[`Capability`](/docs/api/schema/src/interfaces/capability/)[]

***

### has()

> **has**(`name`): `boolean`

Defined in: [runtime/src/capability-registry.ts:66](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/capability-registry.ts#L66)

检查能力是否存在

#### Parameters

##### name

`string`

#### Returns

`boolean`

***

### hasImplementation()

> **hasImplementation**(`name`): `boolean`

Defined in: [runtime/src/capability-registry.ts:71](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/capability-registry.ts#L71)

检查能力是否有非 stub 实现

#### Parameters

##### name

`string`

#### Returns

`boolean`

***

### isStubOnly()

> **isStubOnly**(`name`): `boolean`

Defined in: [runtime/src/capability-registry.ts:78](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/capability-registry.ts#L78)

检查能力是否仅有 stub 实现

#### Parameters

##### name

`string`

#### Returns

`boolean`

***

### get()

> **get**(`name`): [`Capability`](/docs/api/schema/src/interfaces/capability/) \| `undefined`

Defined in: [runtime/src/capability-registry.ts:85](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/capability-registry.ts#L85)

获取能力声明

#### Parameters

##### name

`string`

#### Returns

[`Capability`](/docs/api/schema/src/interfaces/capability/) \| `undefined`

***

### resolve()

> **resolve**(`name`, `preferredEngine?`): [`CapabilityImplementation`](/docs/api/schema/src/interfaces/capabilityimplementation/) \| `undefined`

Defined in: [runtime/src/capability-registry.ts:94](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/capability-registry.ts#L94)

解析能力实现。
- 若指定 preferredEngine 且存在匹配实现,直接返回;
- 否则按构造时设定的 defaultStrategy 选择('first'/'fastest'/'balanced')。

#### Parameters

##### name

`string`

##### preferredEngine?

`string`

#### Returns

[`CapabilityImplementation`](/docs/api/schema/src/interfaces/capabilityimplementation/) \| `undefined`

***

### clear()

> **clear**(): `void`

Defined in: [runtime/src/capability-registry.ts:149](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/capability-registry.ts#L149)

清除所有注册

#### Returns

`void`
