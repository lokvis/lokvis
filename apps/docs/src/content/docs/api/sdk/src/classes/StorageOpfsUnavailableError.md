---
editUrl: false
next: false
prev: false
title: "StorageOpfsUnavailableError"
---

Defined in: [sdk/src/errors.ts:216](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/sdk/src/errors.ts#L216)

OPFS 不可用(浏览器不支持或权限拒绝)

## Extends

- [`LokvisError`](/docs/api/sdk/src/classes/lokviserror/)

## Constructors

### Constructor

> **new StorageOpfsUnavailableError**(`message`, `cause?`): `StorageOpfsUnavailableError`

Defined in: [sdk/src/errors.ts:217](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/sdk/src/errors.ts#L217)

#### Parameters

##### message

`string`

##### cause?

`unknown`

#### Returns

`StorageOpfsUnavailableError`

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
