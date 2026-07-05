---
editUrl: false
next: false
prev: false
title: "ImageEngineAdapter"
---

Defined in: [engine-image/src/types.ts:109](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/types.ts#L109)

引擎适配器接口（与 whitepaper §6.1 EngineAdapter 对齐）

## Extended by

- [`StreamingImageEngineAdapter`](/docs/api/engine-image/src/interfaces/streamingimageengineadapter/)

## Properties

### name

> **name**: [`ImageEngineName`](/docs/api/engine-image/src/type-aliases/imageenginename/)

Defined in: [engine-image/src/types.ts:110](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/types.ts#L110)

***

### version

> **version**: `string`

Defined in: [engine-image/src/types.ts:111](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/types.ts#L111)

***

### supportedCapabilities

> **supportedCapabilities**: `string`[]

Defined in: [engine-image/src/types.ts:112](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/types.ts#L112)

## Methods

### isSupported()

> **isSupported**(): `Promise`\<`boolean`\>

Defined in: [engine-image/src/types.ts:113](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/types.ts#L113)

#### Returns

`Promise`\<`boolean`\>

***

### initialize()?

> `optional` **initialize**(): `Promise`\<`void`\>

Defined in: [engine-image/src/types.ts:114](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/types.ts#L114)

#### Returns

`Promise`\<`void`\>

***

### dispose()?

> `optional` **dispose**(): `Promise`\<`void`\>

Defined in: [engine-image/src/types.ts:115](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/types.ts#L115)

#### Returns

`Promise`\<`void`\>

***

### decode()

> **decode**(`blob`): `Promise`\<[`DecodedImage`](/docs/api/engine-image/src/interfaces/decodedimage/)\>

Defined in: [engine-image/src/types.ts:118](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/types.ts#L118)

#### Parameters

##### blob

`Blob`

#### Returns

`Promise`\<[`DecodedImage`](/docs/api/engine-image/src/interfaces/decodedimage/)\>

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
