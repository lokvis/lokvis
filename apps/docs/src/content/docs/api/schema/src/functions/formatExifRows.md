---
editUrl: false
next: false
prev: false
title: "formatExifRows"
---

> **formatExifRows**(`exif`): [`ExifRow`](/docs/api/schema/src/interfaces/exifrow/)[]

Defined in: [schema/src/exif.ts:56](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/exif.ts#L56)

把 ExifData 格式化为 UI 展示用的行列表。
纯函数,放 schema 层供 UI 直接调用,避免 UI 跨层依赖 plugin / engine。

## Parameters

### exif

[`ExifData`](/docs/api/schema/src/interfaces/exifdata/)

## Returns

[`ExifRow`](/docs/api/schema/src/interfaces/exifrow/)[]
