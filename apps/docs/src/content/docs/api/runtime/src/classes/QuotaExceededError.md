---
editUrl: false
next: false
prev: false
title: "QuotaExceededError"
---

Defined in: [runtime/src/runtime.ts:66](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/runtime.ts#L66)

存储配额超限时抛出(W2.9)

## Extends

- `Error`

## Constructors

### Constructor

> **new QuotaExceededError**(`usage`, `delta`, `quota`): `QuotaExceededError`

Defined in: [runtime/src/runtime.ts:70](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/runtime.ts#L70)

#### Parameters

##### usage

`number`

##### delta

`number`

##### quota

`number`

#### Returns

`QuotaExceededError`

#### Overrides

`Error.constructor`

## Properties

### usage

> `readonly` **usage**: `number`

Defined in: [runtime/src/runtime.ts:67](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/runtime.ts#L67)

***

### delta

> `readonly` **delta**: `number`

Defined in: [runtime/src/runtime.ts:68](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/runtime.ts#L68)

***

### quota

> `readonly` **quota**: `number`

Defined in: [runtime/src/runtime.ts:69](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/runtime.ts#L69)
