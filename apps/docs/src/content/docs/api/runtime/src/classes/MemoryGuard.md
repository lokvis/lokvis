---
editUrl: false
next: false
prev: false
title: "MemoryGuard"
---

Defined in: [runtime/src/memory-guard.ts:77](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/memory-guard.ts#L77)

内存守卫:追踪中间结果占用 + 触发 OPFS 溢出

## Constructors

### Constructor

> **new MemoryGuard**(`opts?`): `MemoryGuard`

Defined in: [runtime/src/memory-guard.ts:85](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/memory-guard.ts#L85)

#### Parameters

##### opts?

[`MemoryGuardOptions`](/docs/api/runtime/src/interfaces/memoryguardoptions/) = `{}`

#### Returns

`MemoryGuard`

## Accessors

### currentUsage

#### Get Signature

> **get** **currentUsage**(): `number`

Defined in: [runtime/src/memory-guard.ts:102](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/memory-guard.ts#L102)

当前已登记的字节数

##### Returns

`number`

***

### budgetBytes

#### Get Signature

> **get** **budgetBytes**(): `number`

Defined in: [runtime/src/memory-guard.ts:107](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/memory-guard.ts#L107)

总预算(字节)

##### Returns

`number`

***

### canSpill

#### Get Signature

> **get** **canSpill**(): `boolean`

Defined in: [runtime/src/memory-guard.ts:112](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/memory-guard.ts#L112)

当前是否已配置可溢出的 AssetStore

##### Returns

`boolean`

## Methods

### track()

> **track**(`bytes`): [`MemoryAllocation`](/docs/api/runtime/src/interfaces/memoryallocation/)

Defined in: [runtime/src/memory-guard.ts:120](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/memory-guard.ts#L120)

登记一笔内存占用。返回 release 句柄,丢弃引用时调用以回退计数。
用于追踪 decode 结果 / canvas 输出等大对象的生命周期。

#### Parameters

##### bytes

`number`

#### Returns

[`MemoryAllocation`](/docs/api/runtime/src/interfaces/memoryallocation/)

***

### getPressure()

> **getPressure**(): [`MemoryPressure`](/docs/api/runtime/src/type-aliases/memorypressure/)

Defined in: [runtime/src/memory-guard.ts:137](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/memory-guard.ts#L137)

当前压力等级(基于 tracked / budget)

#### Returns

[`MemoryPressure`](/docs/api/runtime/src/type-aliases/memorypressure/)

***

### getUsageRatio()

> **getUsageRatio**(): `number`

Defined in: [runtime/src/memory-guard.ts:146](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/memory-guard.ts#L146)

已用比例(0-1+)

#### Returns

`number`

***

### shouldSpill()

> **shouldSpill**(): `boolean`

Defined in: [runtime/src/memory-guard.ts:154](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/memory-guard.ts#L154)

是否应溢出(pressure >= high)。无 assetStore 时永远 false(无法溢出,
交由降级阶梯 L3/L4 处理)。

#### Returns

`boolean`

***

### spill()

> **spill**(`blob`, `mimeType?`, `assetType?`): `Promise`\<[`Asset`](/docs/api/schema/src/interfaces/asset/)\>

Defined in: [runtime/src/memory-guard.ts:168](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/memory-guard.ts#L168)

把一个中间 Blob 溢出到 OPFS(assetStore.create),返回 Asset 句柄。
调用方应在 spill 后丢弃内存中的 Blob 引用,以真正释放内存。

#### Parameters

##### blob

`Blob`

要溢出的中间结果

##### mimeType?

`string`

Blob 的 MIME(用于元数据);默认取 blob.type

##### assetType?

[`AssetType`](/docs/api/schema/src/type-aliases/assettype/) = `'image'`

资产类型(默认 'image');video/pdf 管线可传对应类型

#### Returns

`Promise`\<[`Asset`](/docs/api/schema/src/interfaces/asset/)\>

***

### restore()

> **restore**(`asset`): `Promise`\<`Blob`\>

Defined in: [runtime/src/memory-guard.ts:185](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/memory-guard.ts#L185)

从 OPFS 读回之前 spill 的中间结果

#### Parameters

##### asset

[`Asset`](/docs/api/schema/src/interfaces/asset/)

#### Returns

`Promise`\<`Blob`\>

***

### evict()

> **evict**(`asset`): `Promise`\<`void`\>

Defined in: [runtime/src/memory-guard.ts:193](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/memory-guard.ts#L193)

丢弃已 spill 的中间结果(处理完成后回收 OPFS 空间)

#### Parameters

##### asset

[`Asset`](/docs/api/schema/src/interfaces/asset/)

#### Returns

`Promise`\<`void`\>

***

### reset()

> **reset**(): `void`

Defined in: [runtime/src/memory-guard.ts:199](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/memory-guard.ts#L199)

重置所有登记(用于工作流结束 / 取消后的清理,tracked 归零)

#### Returns

`void`
