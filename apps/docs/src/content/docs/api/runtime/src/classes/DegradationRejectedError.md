---
editUrl: false
next: false
prev: false
title: "DegradationRejectedError"
---

Defined in: [runtime/src/degradation.ts:173](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/degradation.ts#L173)

L4 拒绝时抛出的错误,携带用户可读的引导建议。

引导文案面向终端用户(经 UI 展示),而非开发者堆栈。

## Extends

- `Error`

## Constructors

### Constructor

> **new DegradationRejectedError**(`inputBytes`, `budget`, `reason`): `DegradationRejectedError`

Defined in: [runtime/src/degradation.ts:180](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/degradation.ts#L180)

#### Parameters

##### inputBytes

`number`

##### budget

`number`

##### reason

`string`

#### Returns

`DegradationRejectedError`

#### Overrides

`Error.constructor`

## Properties

### level

> `readonly` **level**: `"L4-reject"`

Defined in: [runtime/src/degradation.ts:174](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/degradation.ts#L174)

***

### inputBytes

> `readonly` **inputBytes**: `number`

Defined in: [runtime/src/degradation.ts:175](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/degradation.ts#L175)

***

### budget

> `readonly` **budget**: `number`

Defined in: [runtime/src/degradation.ts:176](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/degradation.ts#L176)

***

### guide

> `readonly` **guide**: `string`[]

Defined in: [runtime/src/degradation.ts:178](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/degradation.ts#L178)

用户可读的引导建议(UI 可直接渲染)
