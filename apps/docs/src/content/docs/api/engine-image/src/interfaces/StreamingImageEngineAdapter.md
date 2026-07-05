---
editUrl: false
next: false
prev: false
title: "StreamingImageEngineAdapter"
---

Defined in: [engine-image/src/types.ts:189](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/types.ts#L189)

流式引擎适配器:在 ImageEngineAdapter 基础上,
额外支持按 tile 解码/编码(供 W3.2 tile-based 处理使用)。

## Extends

- [`ImageEngineAdapter`](/docs/api/engine-image/src/interfaces/imageengineadapter/)

## Properties

### name

> **name**: [`ImageEngineName`](/docs/api/engine-image/src/type-aliases/imageenginename/)

Defined in: [engine-image/src/types.ts:110](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/types.ts#L110)

#### Inherited from

[`ImageEngineAdapter`](/docs/api/engine-image/src/interfaces/imageengineadapter/).[`name`](/docs/api/engine-image/src/interfaces/imageengineadapter/#name)

***

### version

> **version**: `string`

Defined in: [engine-image/src/types.ts:111](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/types.ts#L111)

#### Inherited from

[`ImageEngineAdapter`](/docs/api/engine-image/src/interfaces/imageengineadapter/).[`version`](/docs/api/engine-image/src/interfaces/imageengineadapter/#version)

***

### supportedCapabilities

> **supportedCapabilities**: `string`[]

Defined in: [engine-image/src/types.ts:112](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/types.ts#L112)

#### Inherited from

[`ImageEngineAdapter`](/docs/api/engine-image/src/interfaces/imageengineadapter/).[`supportedCapabilities`](/docs/api/engine-image/src/interfaces/imageengineadapter/#supportedcapabilities)

## Methods

### isSupported()

> **isSupported**(): `Promise`\<`boolean`\>

Defined in: [engine-image/src/types.ts:113](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/types.ts#L113)

#### Returns

`Promise`\<`boolean`\>

#### Inherited from

[`ImageEngineAdapter`](/docs/api/engine-image/src/interfaces/imageengineadapter/).[`isSupported`](/docs/api/engine-image/src/interfaces/imageengineadapter/#issupported)

***

### initialize()?

> `optional` **initialize**(): `Promise`\<`void`\>

Defined in: [engine-image/src/types.ts:114](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/types.ts#L114)

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`ImageEngineAdapter`](/docs/api/engine-image/src/interfaces/imageengineadapter/).[`initialize`](/docs/api/engine-image/src/interfaces/imageengineadapter/#initialize)

***

### dispose()?

> `optional` **dispose**(): `Promise`\<`void`\>

Defined in: [engine-image/src/types.ts:115](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/types.ts#L115)

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`ImageEngineAdapter`](/docs/api/engine-image/src/interfaces/imageengineadapter/).[`dispose`](/docs/api/engine-image/src/interfaces/imageengineadapter/#dispose)

***

### decode()

> **decode**(`blob`): `Promise`\<[`DecodedImage`](/docs/api/engine-image/src/interfaces/decodedimage/)\>

Defined in: [engine-image/src/types.ts:118](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/types.ts#L118)

#### Parameters

##### blob

`Blob`

#### Returns

`Promise`\<[`DecodedImage`](/docs/api/engine-image/src/interfaces/decodedimage/)\>

#### Inherited from

[`ImageEngineAdapter`](/docs/api/engine-image/src/interfaces/imageengineadapter/).[`decode`](/docs/api/engine-image/src/interfaces/imageengineadapter/#decode)

***

### encode()

> **encode**(`canvas`, `format`, `quality?`): `Promise`\<`Blob`\>

Defined in: [engine-image/src/types.ts:119](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/types.ts#L119)

#### Parameters

##### canvas

`HTMLCanvasElement` \| `OffscreenCanvas`

##### format

[`ImageOutputFormat`](/docs/api/engine-image/src/type-aliases/imageoutputformat/)

##### quality?

`number`

#### Returns

`Promise`\<`Blob`\>

#### Inherited from

[`ImageEngineAdapter`](/docs/api/engine-image/src/interfaces/imageengineadapter/).[`encode`](/docs/api/engine-image/src/interfaces/imageengineadapter/#encode)

***

### decodeRegion()?

> `optional` **decodeRegion**(`blob`, `tile`): `Promise`\<[`DecodedImage`](/docs/api/engine-image/src/interfaces/decodedimage/)\>

Defined in: [engine-image/src/types.ts:191](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/types.ts#L191)

按区域解码(仅解码指定 tile,而非整张图)

#### Parameters

##### blob

`Blob`

##### tile

[`ImageTile`](/docs/api/engine-image/src/interfaces/imagetile/)

#### Returns

`Promise`\<[`DecodedImage`](/docs/api/engine-image/src/interfaces/decodedimage/)\>

***

### mergeChunks()?

> `optional` **mergeChunks**(`chunks`, `totalWidth`, `totalHeight`, `format`, `quality?`): `Promise`\<`Blob`\>

Defined in: [engine-image/src/types.ts:193](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/types.ts#L193)

将多个 chunk 合并为单个 Blob(编码拼合)

#### Parameters

##### chunks

[`ImageChunk`](/docs/api/engine-image/src/interfaces/imagechunk/)[]

##### totalWidth

`number`

##### totalHeight

`number`

##### format

[`ImageOutputFormat`](/docs/api/engine-image/src/type-aliases/imageoutputformat/)

##### quality?

`number`

#### Returns

`Promise`\<`Blob`\>
