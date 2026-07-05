---
editUrl: false
next: false
prev: false
title: "CreateLokvisOptions"
---

Defined in: [sdk/src/index.ts:33](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/sdk/src/index.ts#L33)

createLokvis 配置

## Extends

- [`RuntimeConfig`](/docs/api/runtime/src/interfaces/runtimeconfig/)

## Properties

### enableOpfs?

> `optional` **enableOpfs?**: `boolean`

Defined in: [runtime/src/types.ts:27](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L27)

是否启用 OPFS（默认 true，降级时关闭）

#### Inherited from

[`RuntimeConfig`](/docs/api/runtime/src/interfaces/runtimeconfig/).[`enableOpfs`](/docs/api/runtime/src/interfaces/runtimeconfig/#enableopfs)

***

### enableIndexedDB?

> `optional` **enableIndexedDB?**: `boolean`

Defined in: [runtime/src/types.ts:29](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L29)

是否启用 IndexedDB 元数据存储

#### Inherited from

[`RuntimeConfig`](/docs/api/runtime/src/interfaces/runtimeconfig/).[`enableIndexedDB`](/docs/api/runtime/src/interfaces/runtimeconfig/#enableindexeddb)

***

### storageQuota?

> `optional` **storageQuota?**: `number`

Defined in: [runtime/src/types.ts:31](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L31)

存储配额（字节）

#### Inherited from

[`RuntimeConfig`](/docs/api/runtime/src/interfaces/runtimeconfig/).[`storageQuota`](/docs/api/runtime/src/interfaces/runtimeconfig/#storagequota)

***

### enableLog?

> `optional` **enableLog?**: `boolean`

Defined in: [runtime/src/types.ts:33](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L33)

是否启用日志

#### Inherited from

[`RuntimeConfig`](/docs/api/runtime/src/interfaces/runtimeconfig/).[`enableLog`](/docs/api/runtime/src/interfaces/runtimeconfig/#enablelog)

***

### engineStrategy?

> `optional` **engineStrategy?**: [`EngineSelectionStrategy`](/docs/api/schema/src/type-aliases/engineselectionstrategy/)

Defined in: [runtime/src/types.ts:39](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L39)

引擎选择策略(默认 'first')。
当多个引擎实现同一能力且未显式指定 preferredEngine 时,据此选择:
'first'(注册顺序)/'fastest'(性能最优)/'balanced'(匹配能力声明性能,无则最快)。

#### Inherited from

[`RuntimeConfig`](/docs/api/runtime/src/interfaces/runtimeconfig/).[`engineStrategy`](/docs/api/runtime/src/interfaces/runtimeconfig/#enginestrategy)

***

### assetStore?

> `optional` **assetStore?**: [`AssetStore`](/docs/api/runtime/src/interfaces/assetstore/)

Defined in: [runtime/src/types.ts:45](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L45)

注入自定义 AssetStore(测试或精细控制用)。
默认由 createRuntime 通过 createAssetStore 工厂自动创建,
按 OPFS → IndexedDB → Memory 降级。

#### Inherited from

[`RuntimeConfig`](/docs/api/runtime/src/interfaces/runtimeconfig/).[`assetStore`](/docs/api/runtime/src/interfaces/runtimeconfig/#assetstore)

***

### historyStore?

> `optional` **historyStore?**: [`HistoryStore`](/docs/api/runtime/src/interfaces/historystore/)

Defined in: [runtime/src/types.ts:51](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L51)

注入自定义 HistoryStore(W7.2 历史持久化)。
默认由 createRuntime 在 enableIndexedDB 时通过 createHistoryStore 自动创建;
IndexedDB 不可用时为 undefined,历史退化为仅内存模式。

#### Inherited from

[`RuntimeConfig`](/docs/api/runtime/src/interfaces/runtimeconfig/).[`historyStore`](/docs/api/runtime/src/interfaces/runtimeconfig/#historystore)

***

### historyStoreOptions?

> `optional` **historyStoreOptions?**: [`HistoryStoreOptions`](/docs/api/runtime/src/interfaces/historystoreoptions/)

Defined in: [runtime/src/types.ts:56](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L56)

HistoryStore 工厂选项(W7.2,仅 historyStore 未注入时生效)。
测试可注入 dbInstance 或自定义 dbName。

#### Inherited from

[`RuntimeConfig`](/docs/api/runtime/src/interfaces/runtimeconfig/).[`historyStoreOptions`](/docs/api/runtime/src/interfaces/runtimeconfig/#historystoreoptions)

***

### isPro?

> `optional` **isPro?**: `boolean`

Defined in: [runtime/src/types.ts:63](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L63)

是否启用 Pro 模式(W6.2 / PROJECT_PLAN 17.4)。
- false(默认):批量上限 10 文件、并发 4、workflow 槽位 5
- true:批量无上限、并发 16、workflow 槽位无限
由 cloud 侧 createLokvis({ auth }) 注入 session 后置为 true。

#### Inherited from

[`RuntimeConfig`](/docs/api/runtime/src/interfaces/runtimeconfig/).[`isPro`](/docs/api/runtime/src/interfaces/runtimeconfig/#ispro)

***

### memoryBudget?

> `optional` **memoryBudget?**: `number`

Defined in: [runtime/src/types.ts:68](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L68)

内存预算(字节,W3.3 MemoryGuard)。
默认 512MB。BatchProcessor 据此在内存压力高时收缩并发槽位。

#### Inherited from

[`RuntimeConfig`](/docs/api/runtime/src/interfaces/runtimeconfig/).[`memoryBudget`](/docs/api/runtime/src/interfaces/runtimeconfig/#memorybudget)

***

### plugins?

> `optional` **plugins?**: [`PluginLoadEntry`](/docs/api/sdk/src/interfaces/pluginloadentry/)[]

Defined in: [sdk/src/index.ts:35](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/sdk/src/index.ts#L35)

预加载的插件列表
