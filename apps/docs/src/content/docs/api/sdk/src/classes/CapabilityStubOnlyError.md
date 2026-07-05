---
editUrl: false
next: false
prev: false
title: "CapabilityStubOnlyError"
---

Defined in: [sdk/src/errors.ts:184](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/sdk/src/errors.ts#L184)

能力仅有 stub 实现(需安装真实 engine 插件)

## Extends

- [`LokvisError`](/docs/api/sdk/src/classes/lokviserror/)

## Constructors

### Constructor

> **new CapabilityStubOnlyError**(`capability`): `CapabilityStubOnlyError`

Defined in: [sdk/src/errors.ts:186](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/sdk/src/errors.ts#L186)

#### Parameters

##### capability

`string`

#### Returns

`CapabilityStubOnlyError`

#### Overrides

[`LokvisError`](/docs/api/sdk/src/classes/lokviserror/).[`constructor`](/docs/api/sdk/src/classes/lokviserror/#constructor)

## Properties

### code

> `readonly` **code**: [`LokvisErrorCode`](/docs/api/sdk/src/type-aliases/lokviserrorcode/)

Defined in: [sdk/src/errors.ts:100](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/sdk/src/errors.ts#L100)

#### Inherited from

[`LokvisError`](/docs/api/sdk/src/classes/lokviserror/).[`code`](/docs/api/sdk/src/classes/lokviserror/#code)

***

### context?

> `readonly` `optional` **context?**: `Readonly`\<`Record`\<`string`, `unknown`\>\>

Defined in: [sdk/src/errors.ts:101](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/sdk/src/errors.ts#L101)

#### Inherited from

[`LokvisError`](/docs/api/sdk/src/classes/lokviserror/).[`context`](/docs/api/sdk/src/classes/lokviserror/#context)

***

### capability

> `readonly` **capability**: `string`

Defined in: [sdk/src/errors.ts:185](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/sdk/src/errors.ts#L185)
