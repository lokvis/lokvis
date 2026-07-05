---
editUrl: false
next: false
prev: false
title: "HistoryStackConfig"
---

Defined in: [runtime/src/history.ts:17](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/history.ts#L17)

HistoryStack 配置

## Properties

### maxEntries

> **maxEntries**: `number`

Defined in: [runtime/src/history.ts:19](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/history.ts#L19)

历史记录上限(默认 10 步)

***

### onEvict?

> `optional` **onEvict?**: (`entry`) => `void`

Defined in: [runtime/src/history.ts:21](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/history.ts#L21)

淘汰条目时的回调,用于清理 OPFS 资产

#### Parameters

##### entry

[`HistoryEntry`](/docs/api/schema/src/interfaces/historyentry/)

#### Returns

`void`

***

### onChanged?

> `optional` **onChanged?**: (`workflowId`, `entries`, `currentIndex`) => `void`

Defined in: [runtime/src/history.ts:23](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/history.ts#L23)

历史变更时的回调,用于转发为 eventBus 事件

#### Parameters

##### workflowId

`string`

##### entries

[`HistoryEntry`](/docs/api/schema/src/interfaces/historyentry/)[]

##### currentIndex

`number`

#### Returns

`void`
