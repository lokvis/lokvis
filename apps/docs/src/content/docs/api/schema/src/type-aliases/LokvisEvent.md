---
editUrl: false
next: false
prev: false
title: "LokvisEvent"
---

> **LokvisEvent** = \{ `type`: `"asset:imported"`; `assetId`: [`AssetId`](/docs/api/schema/src/type-aliases/assetid/); `metadata`: [`AssetMetadata`](/docs/api/schema/src/interfaces/assetmetadata/); \} \| \{ `type`: `"asset:removed"`; `assetId`: [`AssetId`](/docs/api/schema/src/type-aliases/assetid/); \} \| \{ `type`: `"workflow:started"`; `workflowId`: `string`; `workflow`: [`Workflow`](/docs/api/schema/src/interfaces/workflow/); \} \| \{ `type`: `"workflow:paused"`; `workflowId`: `string`; \} \| \{ `type`: `"workflow:resumed"`; `workflowId`: `string`; \} \| \{ `type`: `"workflow:cancelled"`; `workflowId`: `string`; \} \| \{ `type`: `"node:started"`; `workflowId`: `string`; `nodeId`: `string`; `inputs`: [`Asset`](/docs/api/schema/src/interfaces/asset/)[]; \} \| \{ `type`: `"node:finished"`; `workflowId`: `string`; `nodeId`: `string`; `capability`: `string`; `params`: `Record`\<`string`, `unknown`\>; `outputs`: [`Asset`](/docs/api/schema/src/interfaces/asset/)[]; `duration`: `number`; \} \| \{ `type`: `"node:failed"`; `workflowId`: `string`; `nodeId`: `string`; `error`: `Error`; \} \| \{ `type`: `"workflow:completed"`; `workflowId`: `string`; `result`: [`WorkflowResult`](/docs/api/schema/src/interfaces/workflowresult/); \} \| \{ `type`: `"export:completed"`; `assetId`: [`AssetId`](/docs/api/schema/src/type-aliases/assetid/); `format`: `string`; `size`: `number`; \} \| \{ `type`: `"history:changed"`; `workflowId`: `string`; `entries`: [`HistoryEntry`](/docs/api/schema/src/interfaces/historyentry/)[]; `currentIndex`: `number`; \} \| \{ `type`: `"capability:registered"`; `capability`: `string`; `engine`: `string`; \} \| \{ `type`: `"plugin:loaded"`; `name`: `string`; `version`: `string`; \} \| \{ `type`: `"batch:started"`; `jobId`: `string`; `total`: `number`; \} \| \{ `type`: `"batch:item:started"`; `jobId`: `string`; `itemId`: `string`; `index`: `number`; `total`: `number`; \} \| \{ `type`: `"batch:item:finished"`; `jobId`: `string`; `itemId`: `string`; `index`: `number`; `total`: `number`; `outputAssetId`: [`AssetId`](/docs/api/schema/src/type-aliases/assetid/); `duration`: `number`; \} \| \{ `type`: `"batch:item:failed"`; `jobId`: `string`; `itemId`: `string`; `index`: `number`; `total`: `number`; `error`: `Error`; `attempts`: `number`; \} \| \{ `type`: `"batch:progress"`; `jobId`: `string`; `completed`: `number`; `failed`: `number`; `total`: `number`; \} \| \{ `type`: `"batch:completed"`; `jobId`: `string`; `total`: `number`; `completed`: `number`; `failed`: `number`; `duration`: `number`; \} \| \{ `type`: `"batch:cancelled"`; `jobId`: `string`; `cancelled`: `number`; \} \| \{ `type`: `"batch:paused"`; `jobId`: `string`; \} \| \{ `type`: `"batch:resumed"`; `jobId`: `string`; \}

Defined in: [schema/src/event.ts:29](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/event.ts#L29)

Lokvis 标准事件类型联合

## Union Members

### Type Literal

\{ `type`: `"asset:imported"`; `assetId`: [`AssetId`](/docs/api/schema/src/type-aliases/assetid/); `metadata`: [`AssetMetadata`](/docs/api/schema/src/interfaces/assetmetadata/); \}

***

### Type Literal

\{ `type`: `"asset:removed"`; `assetId`: [`AssetId`](/docs/api/schema/src/type-aliases/assetid/); \}

***

### Type Literal

\{ `type`: `"workflow:started"`; `workflowId`: `string`; `workflow`: [`Workflow`](/docs/api/schema/src/interfaces/workflow/); \}

***

### Type Literal

\{ `type`: `"workflow:paused"`; `workflowId`: `string`; \}

***

### Type Literal

\{ `type`: `"workflow:resumed"`; `workflowId`: `string`; \}

***

### Type Literal

\{ `type`: `"workflow:cancelled"`; `workflowId`: `string`; \}

***

### Type Literal

\{ `type`: `"node:started"`; `workflowId`: `string`; `nodeId`: `string`; `inputs`: [`Asset`](/docs/api/schema/src/interfaces/asset/)[]; \}

***

### Type Literal

\{ `type`: `"node:finished"`; `workflowId`: `string`; `nodeId`: `string`; `capability`: `string`; `params`: `Record`\<`string`, `unknown`\>; `outputs`: [`Asset`](/docs/api/schema/src/interfaces/asset/)[]; `duration`: `number`; \}

***

### Type Literal

\{ `type`: `"node:failed"`; `workflowId`: `string`; `nodeId`: `string`; `error`: `Error`; \}

***

### Type Literal

\{ `type`: `"workflow:completed"`; `workflowId`: `string`; `result`: [`WorkflowResult`](/docs/api/schema/src/interfaces/workflowresult/); \}

***

### Type Literal

\{ `type`: `"export:completed"`; `assetId`: [`AssetId`](/docs/api/schema/src/type-aliases/assetid/); `format`: `string`; `size`: `number`; \}

***

### Type Literal

\{ `type`: `"history:changed"`; `workflowId`: `string`; `entries`: [`HistoryEntry`](/docs/api/schema/src/interfaces/historyentry/)[]; `currentIndex`: `number`; \}

#### type

> **type**: `"history:changed"`

#### workflowId

> **workflowId**: `string`

#### entries

> **entries**: [`HistoryEntry`](/docs/api/schema/src/interfaces/historyentry/)[]

#### currentIndex

> **currentIndex**: `number`

当前游标(指向最后一条已应用的 entry;-1 表示无已应用条目)

***

### Type Literal

\{ `type`: `"capability:registered"`; `capability`: `string`; `engine`: `string`; \}

***

### Type Literal

\{ `type`: `"plugin:loaded"`; `name`: `string`; `version`: `string`; \}

***

### Type Literal

\{ `type`: `"batch:started"`; `jobId`: `string`; `total`: `number`; \}

***

### Type Literal

\{ `type`: `"batch:item:started"`; `jobId`: `string`; `itemId`: `string`; `index`: `number`; `total`: `number`; \}

***

### Type Literal

\{ `type`: `"batch:item:finished"`; `jobId`: `string`; `itemId`: `string`; `index`: `number`; `total`: `number`; `outputAssetId`: [`AssetId`](/docs/api/schema/src/type-aliases/assetid/); `duration`: `number`; \}

***

### Type Literal

\{ `type`: `"batch:item:failed"`; `jobId`: `string`; `itemId`: `string`; `index`: `number`; `total`: `number`; `error`: `Error`; `attempts`: `number`; \}

#### type

> **type**: `"batch:item:failed"`

#### jobId

> **jobId**: `string`

#### itemId

> **itemId**: `string`

#### index

> **index**: `number`

#### total

> **total**: `number`

#### error

> **error**: `Error`

#### attempts

> **attempts**: `number`

已重试次数(达到 maxRetries 后才发 failed 事件)

***

### Type Literal

\{ `type`: `"batch:progress"`; `jobId`: `string`; `completed`: `number`; `failed`: `number`; `total`: `number`; \}

***

### Type Literal

\{ `type`: `"batch:completed"`; `jobId`: `string`; `total`: `number`; `completed`: `number`; `failed`: `number`; `duration`: `number`; \}

***

### Type Literal

\{ `type`: `"batch:cancelled"`; `jobId`: `string`; `cancelled`: `number`; \}

***

### Type Literal

\{ `type`: `"batch:paused"`; `jobId`: `string`; \}

***

### Type Literal

\{ `type`: `"batch:resumed"`; `jobId`: `string`; \}
