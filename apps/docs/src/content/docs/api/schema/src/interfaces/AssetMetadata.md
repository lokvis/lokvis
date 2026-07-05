---
editUrl: false
next: false
prev: false
title: "AssetMetadata"
---

Defined in: [schema/src/asset.ts:22](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/asset.ts#L22)

Asset 元数据

## Properties

### mimeType

> **mimeType**: `string`

Defined in: [schema/src/asset.ts:23](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/asset.ts#L23)

***

### size

> **size**: `number`

Defined in: [schema/src/asset.ts:25](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/asset.ts#L25)

字节数

***

### dimensions?

> `optional` **dimensions?**: `object`

Defined in: [schema/src/asset.ts:27](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/asset.ts#L27)

图像/视频尺寸

#### width

> **width**: `number`

#### height

> **height**: `number`

***

### duration?

> `optional` **duration?**: `number`

Defined in: [schema/src/asset.ts:29](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/asset.ts#L29)

视频/音频时长（秒）

***

### pages?

> `optional` **pages?**: `number`

Defined in: [schema/src/asset.ts:31](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/asset.ts#L31)

PDF 页数

***

### format

> **format**: `string`

Defined in: [schema/src/asset.ts:33](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/asset.ts#L33)

文件格式：png, mp4, pdf, mp3...
