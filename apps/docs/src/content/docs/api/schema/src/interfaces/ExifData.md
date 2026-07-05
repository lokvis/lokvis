---
editUrl: false
next: false
prev: false
title: "ExifData"
---

Defined in: [schema/src/exif.ts:18](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/exif.ts#L18)

面向 UI / Runtime 的 EXIF 结构化数据。
不含 raw 字段 —— raw 仅在 Plugin 内部用于调试 / 高级展示,
不会传递到 UI 层(避免大对象在缓存中累积)。

## Extended by

- [`RawExifData`](/docs/api/schema/src/interfaces/rawexifdata/)

## Properties

### make?

> `optional` **make?**: `string`

Defined in: [schema/src/exif.ts:19](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/exif.ts#L19)

***

### model?

> `optional` **model?**: `string`

Defined in: [schema/src/exif.ts:20](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/exif.ts#L20)

***

### lensModel?

> `optional` **lensModel?**: `string`

Defined in: [schema/src/exif.ts:21](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/exif.ts#L21)

***

### dateTimeOriginal?

> `optional` **dateTimeOriginal?**: `string`

Defined in: [schema/src/exif.ts:22](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/exif.ts#L22)

***

### iso?

> `optional` **iso?**: `number`

Defined in: [schema/src/exif.ts:23](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/exif.ts#L23)

***

### fNumber?

> `optional` **fNumber?**: `number`

Defined in: [schema/src/exif.ts:24](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/exif.ts#L24)

***

### exposureTime?

> `optional` **exposureTime?**: `number`

Defined in: [schema/src/exif.ts:25](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/exif.ts#L25)

***

### focalLength?

> `optional` **focalLength?**: `number`

Defined in: [schema/src/exif.ts:26](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/exif.ts#L26)

***

### exposureCompensation?

> `optional` **exposureCompensation?**: `number`

Defined in: [schema/src/exif.ts:27](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/exif.ts#L27)

***

### whiteBalance?

> `optional` **whiteBalance?**: `string`

Defined in: [schema/src/exif.ts:28](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/exif.ts#L28)

***

### gpsLatitude?

> `optional` **gpsLatitude?**: `number`

Defined in: [schema/src/exif.ts:29](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/exif.ts#L29)

***

### gpsLongitude?

> `optional` **gpsLongitude?**: `number`

Defined in: [schema/src/exif.ts:30](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/exif.ts#L30)

***

### gpsAltitude?

> `optional` **gpsAltitude?**: `number`

Defined in: [schema/src/exif.ts:31](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/exif.ts#L31)

***

### orientation?

> `optional` **orientation?**: `number`

Defined in: [schema/src/exif.ts:32](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/exif.ts#L32)

***

### software?

> `optional` **software?**: `string`

Defined in: [schema/src/exif.ts:33](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/exif.ts#L33)
