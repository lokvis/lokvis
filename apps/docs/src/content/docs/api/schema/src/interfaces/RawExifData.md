---
editUrl: false
next: false
prev: false
title: "RawExifData"
---

Defined in: [schema/src/exif.ts:41](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/exif.ts#L41)

Plugin 内部使用的完整 EXIF 数据,extends ExifData 并附加 raw 字段。
raw 保留 exifr.parse 返回的原始对象,供调试或未来高级面板使用。
Plugin 在通过 MetadataReader 返回给 Runtime 时,应丢弃 raw(收窄为 ExifData)。

## Extends

- [`ExifData`](/docs/api/schema/src/interfaces/exifdata/)

## Properties

### make?

> `optional` **make?**: `string`

Defined in: [schema/src/exif.ts:19](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/exif.ts#L19)

#### Inherited from

[`ExifData`](/docs/api/schema/src/interfaces/exifdata/).[`make`](/docs/api/schema/src/interfaces/exifdata/#make)

***

### model?

> `optional` **model?**: `string`

Defined in: [schema/src/exif.ts:20](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/exif.ts#L20)

#### Inherited from

[`ExifData`](/docs/api/schema/src/interfaces/exifdata/).[`model`](/docs/api/schema/src/interfaces/exifdata/#model)

***

### lensModel?

> `optional` **lensModel?**: `string`

Defined in: [schema/src/exif.ts:21](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/exif.ts#L21)

#### Inherited from

[`ExifData`](/docs/api/schema/src/interfaces/exifdata/).[`lensModel`](/docs/api/schema/src/interfaces/exifdata/#lensmodel)

***

### dateTimeOriginal?

> `optional` **dateTimeOriginal?**: `string`

Defined in: [schema/src/exif.ts:22](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/exif.ts#L22)

#### Inherited from

[`ExifData`](/docs/api/schema/src/interfaces/exifdata/).[`dateTimeOriginal`](/docs/api/schema/src/interfaces/exifdata/#datetimeoriginal)

***

### iso?

> `optional` **iso?**: `number`

Defined in: [schema/src/exif.ts:23](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/exif.ts#L23)

#### Inherited from

[`ExifData`](/docs/api/schema/src/interfaces/exifdata/).[`iso`](/docs/api/schema/src/interfaces/exifdata/#iso)

***

### fNumber?

> `optional` **fNumber?**: `number`

Defined in: [schema/src/exif.ts:24](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/exif.ts#L24)

#### Inherited from

[`ExifData`](/docs/api/schema/src/interfaces/exifdata/).[`fNumber`](/docs/api/schema/src/interfaces/exifdata/#fnumber)

***

### exposureTime?

> `optional` **exposureTime?**: `number`

Defined in: [schema/src/exif.ts:25](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/exif.ts#L25)

#### Inherited from

[`ExifData`](/docs/api/schema/src/interfaces/exifdata/).[`exposureTime`](/docs/api/schema/src/interfaces/exifdata/#exposuretime)

***

### focalLength?

> `optional` **focalLength?**: `number`

Defined in: [schema/src/exif.ts:26](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/exif.ts#L26)

#### Inherited from

[`ExifData`](/docs/api/schema/src/interfaces/exifdata/).[`focalLength`](/docs/api/schema/src/interfaces/exifdata/#focallength)

***

### exposureCompensation?

> `optional` **exposureCompensation?**: `number`

Defined in: [schema/src/exif.ts:27](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/exif.ts#L27)

#### Inherited from

[`ExifData`](/docs/api/schema/src/interfaces/exifdata/).[`exposureCompensation`](/docs/api/schema/src/interfaces/exifdata/#exposurecompensation)

***

### whiteBalance?

> `optional` **whiteBalance?**: `string`

Defined in: [schema/src/exif.ts:28](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/exif.ts#L28)

#### Inherited from

[`ExifData`](/docs/api/schema/src/interfaces/exifdata/).[`whiteBalance`](/docs/api/schema/src/interfaces/exifdata/#whitebalance)

***

### gpsLatitude?

> `optional` **gpsLatitude?**: `number`

Defined in: [schema/src/exif.ts:29](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/exif.ts#L29)

#### Inherited from

[`ExifData`](/docs/api/schema/src/interfaces/exifdata/).[`gpsLatitude`](/docs/api/schema/src/interfaces/exifdata/#gpslatitude)

***

### gpsLongitude?

> `optional` **gpsLongitude?**: `number`

Defined in: [schema/src/exif.ts:30](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/exif.ts#L30)

#### Inherited from

[`ExifData`](/docs/api/schema/src/interfaces/exifdata/).[`gpsLongitude`](/docs/api/schema/src/interfaces/exifdata/#gpslongitude)

***

### gpsAltitude?

> `optional` **gpsAltitude?**: `number`

Defined in: [schema/src/exif.ts:31](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/exif.ts#L31)

#### Inherited from

[`ExifData`](/docs/api/schema/src/interfaces/exifdata/).[`gpsAltitude`](/docs/api/schema/src/interfaces/exifdata/#gpsaltitude)

***

### orientation?

> `optional` **orientation?**: `number`

Defined in: [schema/src/exif.ts:32](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/exif.ts#L32)

#### Inherited from

[`ExifData`](/docs/api/schema/src/interfaces/exifdata/).[`orientation`](/docs/api/schema/src/interfaces/exifdata/#orientation)

***

### software?

> `optional` **software?**: `string`

Defined in: [schema/src/exif.ts:33](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/exif.ts#L33)

#### Inherited from

[`ExifData`](/docs/api/schema/src/interfaces/exifdata/).[`software`](/docs/api/schema/src/interfaces/exifdata/#software)

***

### raw?

> `optional` **raw?**: `Record`\<`string`, `unknown`\>

Defined in: [schema/src/exif.ts:43](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/exif.ts#L43)

exifr.parse 返回的原始对象(未筛选)
