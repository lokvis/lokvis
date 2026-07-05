---
editUrl: false
next: false
prev: false
title: "BatchLimitExceededError"
---

Defined in: [runtime/src/batch-processor.ts:121](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L121)

批量上限超限错误(W6.2)

## Extends

- `Error`

## Constructors

### Constructor

> **new BatchLimitExceededError**(`limit`, `requested`): `BatchLimitExceededError`

Defined in: [runtime/src/batch-processor.ts:124](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L124)

#### Parameters

##### limit

`number`

##### requested

`number`

#### Returns

`BatchLimitExceededError`

#### Overrides

`Error.constructor`

## Properties

### limit

> `readonly` **limit**: `number`

Defined in: [runtime/src/batch-processor.ts:122](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L122)

***

### requested

> `readonly` **requested**: `number`

Defined in: [runtime/src/batch-processor.ts:123](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/batch-processor.ts#L123)
