---
editUrl: false
next: false
prev: false
title: "HistoryStack"
---

Defined in: [runtime/src/history.ts:32](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/history.ts#L32)

## Constructors

### Constructor

> **new HistoryStack**(`workflowId`, `config?`): `HistoryStack`

Defined in: [runtime/src/history.ts:39](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/history.ts#L39)

#### Parameters

##### workflowId

`string`

##### config?

`Partial`\<[`HistoryStackConfig`](/docs/api/runtime/src/interfaces/historystackconfig/)\> = `{}`

#### Returns

`HistoryStack`

## Accessors

### length

#### Get Signature

> **get** **length**(): `number`

Defined in: [runtime/src/history.ts:51](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/history.ts#L51)

当前可应用的条目数(cursor 之后已截断)

##### Returns

`number`

***

### currentIndex

#### Get Signature

> **get** **currentIndex**(): `number`

Defined in: [runtime/src/history.ts:56](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/history.ts#L56)

cursor 位置(指向最后已应用条目,-1 表示空)

##### Returns

`number`

***

### canUndo

#### Get Signature

> **get** **canUndo**(): `boolean`

Defined in: [runtime/src/history.ts:61](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/history.ts#L61)

是否可以 undo

##### Returns

`boolean`

***

### canRedo

#### Get Signature

> **get** **canRedo**(): `boolean`

Defined in: [runtime/src/history.ts:66](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/history.ts#L66)

是否可以 redo

##### Returns

`boolean`

## Methods

### list()

> **list**(): [`HistoryEntry`](/docs/api/schema/src/interfaces/historyentry/)[]

Defined in: [runtime/src/history.ts:71](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/history.ts#L71)

所有历史条目(只读视图)

#### Returns

[`HistoryEntry`](/docs/api/schema/src/interfaces/historyentry/)[]

***

### applied()

> **applied**(): [`HistoryEntry`](/docs/api/schema/src/interfaces/historyentry/)[]

Defined in: [runtime/src/history.ts:76](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/history.ts#L76)

仅返回已应用的条目(cursor 及之前)

#### Returns

[`HistoryEntry`](/docs/api/schema/src/interfaces/historyentry/)[]

***

### redoBranch()

> **redoBranch**(): [`HistoryEntry`](/docs/api/schema/src/interfaces/historyentry/)[]

Defined in: [runtime/src/history.ts:81](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/history.ts#L81)

仅返回 redo 分支中尚未应用的条目

#### Returns

[`HistoryEntry`](/docs/api/schema/src/interfaces/historyentry/)[]

***

### append()

> **append**(`entry`): `void`

Defined in: [runtime/src/history.ts:91](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/history.ts#L91)

追加一条历史记录。
若当前存在 redo 分支(cursor 之后的条目),则截断之,
  并对被丢弃的条目触发 onEvict(清理其 outputs 资产,避免 OPFS/IDB 泄漏)。
若超过上限,从最旧端 LRU 淘汰,并触发 onEvict 回调。

#### Parameters

##### entry

[`HistoryEntry`](/docs/api/schema/src/interfaces/historyentry/)

#### Returns

`void`

***

### undo()

> **undo**(): [`HistoryEntry`](/docs/api/schema/src/interfaces/historyentry/) \| `null` \| `undefined`

Defined in: [runtime/src/history.ts:121](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/history.ts#L121)

撤销一步:cursor 前移,返回当前应应用的 entry(即 undo 后的"当前"输出)。
返回值含义:
  - 如果 undo 后 cursor >= 0:返回该 entry(调用方应将其 outputs 作为当前状态)
  - 如果 undo 后 cursor < 0(回到初始):返回 null(调用方应恢复初始 inputs)
如果不能 undo(cursor < 0),返回 undefined 表示无操作。

#### Returns

[`HistoryEntry`](/docs/api/schema/src/interfaces/historyentry/) \| `null` \| `undefined`

***

### redo()

> **redo**(): [`HistoryEntry`](/docs/api/schema/src/interfaces/historyentry/) \| `undefined`

Defined in: [runtime/src/history.ts:132](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/history.ts#L132)

重做一步:cursor 后移,返回重做后应应用的 entry。
如果不能 redo,返回 undefined 表示无操作。

#### Returns

[`HistoryEntry`](/docs/api/schema/src/interfaces/historyentry/) \| `undefined`

***

### jumpTo()

> **jumpTo**(`index`): [`HistoryEntry`](/docs/api/schema/src/interfaces/historyentry/) \| `null` \| `undefined`

Defined in: [runtime/src/history.ts:140](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/history.ts#L140)

跳转到指定条目(按 timestamp 顺序的索引)

#### Parameters

##### index

`number`

#### Returns

[`HistoryEntry`](/docs/api/schema/src/interfaces/historyentry/) \| `null` \| `undefined`

***

### clear()

> **clear**(): `void`

Defined in: [runtime/src/history.ts:148](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/history.ts#L148)

清空所有历史(不触发 onEvict,用于工作流销毁)

#### Returns

`void`

***

### reset()

> **reset**(): `void`

Defined in: [runtime/src/history.ts:159](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/history.ts#L159)

重置历史:清空所有条目并对每条触发 onEvict(清理其 outputs 资产)。
用于工作流重新执行(run)时丢弃上一次(可能失败的)历史,避免资产泄漏。
与 clear() 的区别:clear() 仅重置内存状态,reset() 同时回收资产。

#### Returns

`void`

***

### snapshot()

> **snapshot**(): [`HistoryStackSnapshot`](/docs/api/runtime/src/interfaces/historystacksnapshot/)

Defined in: [runtime/src/history.ts:169](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/history.ts#L169)

导出快照(用于持久化到 IndexedDB)

#### Returns

[`HistoryStackSnapshot`](/docs/api/runtime/src/interfaces/historystacksnapshot/)

***

### restore()

> **restore**(`snapshot`): `void`

Defined in: [runtime/src/history.ts:177](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/history.ts#L177)

从快照恢复

#### Parameters

##### snapshot

[`HistoryStackSnapshot`](/docs/api/runtime/src/interfaces/historystacksnapshot/)

#### Returns

`void`
