---
editUrl: false
next: false
prev: false
title: "LokvisErrorOptions"
---

Defined in: [sdk/src/errors.ts:70](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/sdk/src/errors.ts#L70)

LokvisError 构造选项

## Properties

### code

> **code**: [`LokvisErrorCode`](/docs/api/sdk/src/type-aliases/lokviserrorcode/)

Defined in: [sdk/src/errors.ts:72](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/sdk/src/errors.ts#L72)

稳定错误代码(程序化分支用)

***

### cause?

> `optional` **cause?**: `unknown`

Defined in: [sdk/src/errors.ts:74](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/sdk/src/errors.ts#L74)

原始错误(如有),保留链路便于调试

***

### context?

> `optional` **context?**: `Record`\<`string`, `unknown`\>

Defined in: [sdk/src/errors.ts:76](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/sdk/src/errors.ts#L76)

附加上下文(随错误一起序列化,便于日志聚合)
