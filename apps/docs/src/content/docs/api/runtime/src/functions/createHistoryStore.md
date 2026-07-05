---
editUrl: false
next: false
prev: false
title: "createHistoryStore"
---

> **createHistoryStore**(`options?`): [`HistoryStore`](/docs/api/runtime/src/interfaces/historystore/) \| `undefined`

Defined in: [runtime/src/history-store.ts:87](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/history-store.ts#L87)

创建 HistoryStore。

IndexedDB 不可用时返回 undefined,调用方(runtime)据此跳过持久化,
退化为仅内存历史模式。

## Parameters

### options?

[`HistoryStoreOptions`](/docs/api/runtime/src/interfaces/historystoreoptions/) = `{}`

## Returns

[`HistoryStore`](/docs/api/runtime/src/interfaces/historystore/) \| `undefined`
