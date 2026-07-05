---
editUrl: false
next: false
prev: false
title: "HistoryStoreOptions"
---

Defined in: [runtime/src/history-store.ts:74](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/history-store.ts#L74)

HistoryStore 工厂选项

## Properties

### dbInstance?

> `optional` **dbInstance?**: [`HistoryDatabase`](/docs/api/runtime/src/classes/historydatabase/)

Defined in: [runtime/src/history-store.ts:76](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/history-store.ts#L76)

测试注入:自定义数据库实例

***

### dbName?

> `optional` **dbName?**: `string`

Defined in: [runtime/src/history-store.ts:78](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/history-store.ts#L78)

数据库名(默认 'lokvis-history';仅 dbInstance 未注入时生效)
