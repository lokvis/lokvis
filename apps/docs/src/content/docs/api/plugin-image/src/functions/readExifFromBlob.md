---
editUrl: false
next: false
prev: false
title: "readExifFromBlob"
---

> **readExifFromBlob**(`blob`): `Promise`\<[`ExifData`](/docs/api/schema/src/interfaces/exifdata/) \| `null`\>

Defined in: [plugin-image/src/exif-reader.ts:23](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/plugin-image/src/exif-reader.ts#L23)

从图像 Blob 解析 EXIF 元数据。

## Parameters

### blob

`Blob`

图像 Blob(JPEG / TIFF / HEIC 等含 EXIF 的格式)

## Returns

`Promise`\<[`ExifData`](/docs/api/schema/src/interfaces/exifdata/) \| `null`\>

ExifData(无 raw);无 EXIF / 解析失败 / 非图像返回 null
