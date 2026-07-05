---
editUrl: false
next: false
prev: false
title: "AssetStore"
---

Defined in: [runtime/src/asset-store.ts:16](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/asset-store.ts#L16)

Asset 存储接口

## Methods

### import()

> **import**(`source`): `Promise`\<[`Asset`](/docs/api/schema/src/interfaces/asset/)\>

Defined in: [runtime/src/asset-store.ts:18](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/asset-store.ts#L18)

导入资产（从 File / Blob / URL）

#### Parameters

##### source

[`AssetSource`](/docs/api/schema/src/type-aliases/assetsource/)

#### Returns

`Promise`\<[`Asset`](/docs/api/schema/src/interfaces/asset/)\>

***

### get()

> **get**(`id`): `Promise`\<[`Asset`](/docs/api/schema/src/interfaces/asset/) \| `undefined`\>

Defined in: [runtime/src/asset-store.ts:20](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/asset-store.ts#L20)

获取资产元数据

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`Asset`](/docs/api/schema/src/interfaces/asset/) \| `undefined`\>

***

### getBlob()

> **getBlob**(`handle`): `Promise`\<`Blob`\>

Defined in: [runtime/src/asset-store.ts:22](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/asset-store.ts#L22)

获取资产的 Blob 数据

#### Parameters

##### handle

[`BlobHandle`](/docs/api/schema/src/interfaces/blobhandle/)

#### Returns

`Promise`\<`Blob`\>

***

### remove()

> **remove**(`id`): `Promise`\<`void`\>

Defined in: [runtime/src/asset-store.ts:24](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/asset-store.ts#L24)

删除资产

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`void`\>

***

### list()

> **list**(): `Promise`\<[`Asset`](/docs/api/schema/src/interfaces/asset/)[]\>

Defined in: [runtime/src/asset-store.ts:26](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/asset-store.ts#L26)

列出所有资产

#### Returns

`Promise`\<[`Asset`](/docs/api/schema/src/interfaces/asset/)[]\>

***

### create()

> **create**(`blob`, `metadata`, `type`): `Promise`\<[`Asset`](/docs/api/schema/src/interfaces/asset/)\>

Defined in: [runtime/src/asset-store.ts:28](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/asset-store.ts#L28)

创建新 Asset（内部用，由 Capability 产出）

#### Parameters

##### blob

`Blob`

##### metadata

[`AssetMetadata`](/docs/api/schema/src/interfaces/assetmetadata/)

##### type

[`AssetType`](/docs/api/schema/src/type-aliases/assettype/)

#### Returns

`Promise`\<[`Asset`](/docs/api/schema/src/interfaces/asset/)\>
