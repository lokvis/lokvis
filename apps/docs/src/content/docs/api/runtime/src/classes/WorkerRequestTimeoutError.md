---
editUrl: false
next: false
prev: false
title: "WorkerRequestTimeoutError"
---

Defined in: [runtime/src/worker-host.ts:92](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/worker-host.ts#L92)

单个请求超时

## Extends

- `Error`

## Constructors

### Constructor

> **new WorkerRequestTimeoutError**(`method`, `timeoutMs`): `WorkerRequestTimeoutError`

Defined in: [runtime/src/worker-host.ts:94](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/worker-host.ts#L94)

#### Parameters

##### method

`string`

##### timeoutMs

`number`

#### Returns

`WorkerRequestTimeoutError`

#### Overrides

`Error.constructor`

## Properties

### method

> `readonly` **method**: `string`

Defined in: [runtime/src/worker-host.ts:93](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/worker-host.ts#L93)
