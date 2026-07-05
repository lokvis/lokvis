---
editUrl: false
next: false
prev: false
title: "HistoryRecord"
---

Defined in: [runtime/src/history-store.ts:26](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/history-store.ts#L26)

持久化的历史记录(每个工作流一条)

## Properties

### workflowId

> **workflowId**: `string`

Defined in: [runtime/src/history-store.ts:28](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/history-store.ts#L28)

主键 = 工作流 ID

***

### entries

> **entries**: [`HistoryEntry`](/docs/api/schema/src/interfaces/historyentry/)[]

Defined in: [runtime/src/history-store.ts:30](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/history-store.ts#L30)

历史条目(按时间顺序)

***

### cursor

> **cursor**: `number`

Defined in: [runtime/src/history-store.ts:32](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/history-store.ts#L32)

游标:-1 表示无已应用条目;i 表示第 i 条已应用

***

### initialInputs

> **initialInputs**: `string`[]

Defined in: [runtime/src/history-store.ts:34](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/history-store.ts#L34)

工作流初始输入 AssetId(undo 回到初始时使用)

***

### currentOutputs

> **currentOutputs**: `string`[]

Defined in: [runtime/src/history-store.ts:36](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/history-store.ts#L36)

工作流当前输出 AssetId(undo/redo 后的"当前"状态)

***

### updatedAt

> **updatedAt**: `number`

Defined in: [runtime/src/history-store.ts:38](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/history-store.ts#L38)

最后更新时间戳(用于排查与潜在 TTL 清理)
