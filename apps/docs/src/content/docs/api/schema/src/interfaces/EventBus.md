---
editUrl: false
next: false
prev: false
title: "EventBus"
---

Defined in: [schema/src/event.ts:122](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/event.ts#L122)

事件总线接口

## Methods

### on()

> **on**\<`T`\>(`type`, `handler`): () => `void`

Defined in: [schema/src/event.ts:127](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/event.ts#L127)

订阅事件

#### Type Parameters

##### T

`T` *extends* `"asset:imported"` \| `"asset:removed"` \| `"workflow:started"` \| `"workflow:paused"` \| `"workflow:resumed"` \| `"workflow:cancelled"` \| `"node:started"` \| `"node:finished"` \| `"node:failed"` \| `"workflow:completed"` \| `"export:completed"` \| `"history:changed"` \| `"capability:registered"` \| `"plugin:loaded"` \| `"batch:started"` \| `"batch:item:started"` \| `"batch:item:finished"` \| `"batch:item:failed"` \| `"batch:progress"` \| `"batch:completed"` \| `"batch:cancelled"` \| `"batch:paused"` \| `"batch:resumed"`

#### Parameters

##### type

`T`

##### handler

(`event`) => `void`

#### Returns

取消订阅函数

() => `void`

***

### onAny()

> **onAny**(`handler`): () => `void`

Defined in: [schema/src/event.ts:133](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/event.ts#L133)

订阅所有事件（用于日志、分析）

#### Parameters

##### handler

(`event`) => `void`

#### Returns

() => `void`

***

### emit()

> **emit**(`event`): `void`

Defined in: [schema/src/event.ts:136](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/event.ts#L136)

发出事件

#### Parameters

##### event

[`LokvisEvent`](/docs/api/schema/src/type-aliases/lokvisevent/)

#### Returns

`void`

***

### clear()

> **clear**(): `void`

Defined in: [schema/src/event.ts:139](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/event.ts#L139)

清除所有订阅

#### Returns

`void`
