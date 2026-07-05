---
editUrl: false
next: false
prev: false
title: "WorkerDeadError"
---

Defined in: [sdk/src/errors.ts:248](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/sdk/src/errors.ts#L248)

Worker 已死亡(超过 maxRestarts,无法再恢复)

## Extends

- [`LokvisError`](/docs/api/sdk/src/classes/lokviserror/)

## Constructors

### Constructor

> **new WorkerDeadError**(`message`, `cause?`): `WorkerDeadError`

Defined in: [sdk/src/errors.ts:249](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/sdk/src/errors.ts#L249)

#### Parameters

##### message

`string`

##### cause?

`unknown`

#### Returns

`WorkerDeadError`

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
