---
editUrl: false
next: false
prev: false
title: "WorkerCrashedError"
---

Defined in: [runtime/src/worker-host.ts:62](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/worker-host.ts#L62)

Worker 崩溃(传输层错误或心跳超时)

## Extends

- `Error`

## Constructors

### Constructor

> **new WorkerCrashedError**(`reason`, `restartCount`): `WorkerCrashedError`

Defined in: [runtime/src/worker-host.ts:65](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/worker-host.ts#L65)

#### Parameters

##### reason

`string`

##### restartCount

`number`

#### Returns

`WorkerCrashedError`

#### Overrides

`Error.constructor`

## Properties

### reason

> `readonly` **reason**: `string`

Defined in: [runtime/src/worker-host.ts:63](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/worker-host.ts#L63)

***

### restartCount

> `readonly` **restartCount**: `number`

Defined in: [runtime/src/worker-host.ts:64](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/worker-host.ts#L64)
