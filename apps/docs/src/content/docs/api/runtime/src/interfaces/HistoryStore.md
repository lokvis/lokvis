---
editUrl: false
next: false
prev: false
title: "HistoryStore"
---

Defined in: [runtime/src/history-store.ts:60](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/history-store.ts#L60)

HistoryStore 抽象接口(便于测试注入 mock)

## Methods

### save()

> **save**(`record`): `Promise`\<`void`\>

Defined in: [runtime/src/history-store.ts:62](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/history-store.ts#L62)

保存(或覆盖)一条历史记录

#### Parameters

##### record

[`HistoryRecord`](/docs/api/runtime/src/interfaces/historyrecord/)

#### Returns

`Promise`\<`void`\>

***

### load()

> **load**(`workflowId`): `Promise`\<[`HistoryRecord`](/docs/api/runtime/src/interfaces/historyrecord/) \| `undefined`\>

Defined in: [runtime/src/history-store.ts:64](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/history-store.ts#L64)

读取指定工作流的历史记录

#### Parameters

##### workflowId

`string`

#### Returns

`Promise`\<[`HistoryRecord`](/docs/api/runtime/src/interfaces/historyrecord/) \| `undefined`\>

***

### loadAll()

> **loadAll**(): `Promise`\<[`HistoryRecord`](/docs/api/runtime/src/interfaces/historyrecord/)[]\>

Defined in: [runtime/src/history-store.ts:66](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/history-store.ts#L66)

读取全部历史记录(用于启动时预加载)

#### Returns

`Promise`\<[`HistoryRecord`](/docs/api/runtime/src/interfaces/historyrecord/)[]\>

***

### delete()

> **delete**(`workflowId`): `Promise`\<`void`\>

Defined in: [runtime/src/history-store.ts:68](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/history-store.ts#L68)

删除指定工作流的历史记录

#### Parameters

##### workflowId

`string`

#### Returns

`Promise`\<`void`\>

***

### clear()

> **clear**(): `Promise`\<`void`\>

Defined in: [runtime/src/history-store.ts:70](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/history-store.ts#L70)

清空所有历史记录

#### Returns

`Promise`\<`void`\>
