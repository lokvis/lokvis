---
editUrl: false
next: false
prev: false
title: "WorkerDeadError"
---

Defined in: [runtime/src/worker-host.ts:82](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/worker-host.ts#L82)

Worker 已死亡(超过最大重启次数)

## Extends

- `Error`

## Constructors

### Constructor

> **new WorkerDeadError**(`restartCount`): `WorkerDeadError`

Defined in: [runtime/src/worker-host.ts:84](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/worker-host.ts#L84)

#### Parameters

##### restartCount

`number`

#### Returns

`WorkerDeadError`

#### Overrides

`Error.constructor`

## Properties

### restartCount

> `readonly` **restartCount**: `number`

Defined in: [runtime/src/worker-host.ts:83](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/worker-host.ts#L83)
