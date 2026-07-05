---
editUrl: false
next: false
prev: false
title: "BlobCapabilityOptions"
---

Defined in: [plugin-sdk/src/index.ts:124](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/plugin-sdk/src/index.ts#L124)

Blob 能力实现工厂选项

## Properties

### capability

> **capability**: `string`

Defined in: [plugin-sdk/src/index.ts:126](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/plugin-sdk/src/index.ts#L126)

对应 Capability 名

***

### engine

> **engine**: `string`

Defined in: [plugin-sdk/src/index.ts:128](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/plugin-sdk/src/index.ts#L128)

引擎名

***

### outputType

> **outputType**: [`AssetType`](/docs/api/schema/src/type-aliases/assettype/)

Defined in: [plugin-sdk/src/index.ts:130](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/plugin-sdk/src/index.ts#L130)

输出 Asset 类型

***

### operation

> **operation**: (`blob`, `params`, `signal?`) => `Promise`\<`Blob`\>

Defined in: [plugin-sdk/src/index.ts:132](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/plugin-sdk/src/index.ts#L132)

实际执行函数(Blob → Blob),signal 可选

#### Parameters

##### blob

`Blob`

##### params

`Record`\<`string`, `unknown`\>

##### signal?

`AbortSignal`

#### Returns

`Promise`\<`Blob`\>

***

### isStub

> **isStub**: `boolean`

Defined in: [plugin-sdk/src/index.ts:138](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/plugin-sdk/src/index.ts#L138)

是否为 stub 实现(engine.version.includes('stub'))

***

### deriveMetadata?

> `optional` **deriveMetadata?**: (`source`, `outBlob`) => [`AssetMetadata`](/docs/api/schema/src/interfaces/assetmetadata/)

Defined in: [plugin-sdk/src/index.ts:140](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/plugin-sdk/src/index.ts#L140)

自定义元数据派生;默认用 defaultDeriveOutputMetadata

#### Parameters

##### source

[`Asset`](/docs/api/schema/src/interfaces/asset/)

##### outBlob

`Blob`

#### Returns

[`AssetMetadata`](/docs/api/schema/src/interfaces/assetmetadata/)
