---
editUrl: false
next: false
prev: false
title: "PlatformSizePreset"
---

Defined in: [capability/src/presets/platform.ts:53](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/capability/src/presets/platform.ts#L53)

平台尺寸预设。

字段语义:
- `width`/`height`:目标像素尺寸。resize 按此尺寸缩放,crop 按此尺寸居中裁剪
- `recommendedFormat`:多数平台 JPEG/WebP 兼容性最好;含透明背景用 PNG
- `recommendedFit`:resize 时建议的 fit 策略(`cover` 裁掉溢出 / `contain` 留黑边)

## Properties

### id

> **id**: `string`

Defined in: [capability/src/presets/platform.ts:55](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/capability/src/presets/platform.ts#L55)

全局唯一 ID,如 `youtube.thumbnail`

***

### platform

> **platform**: `string`

Defined in: [capability/src/presets/platform.ts:57](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/capability/src/presets/platform.ts#L57)

平台名,如 `YouTube`

***

### name

> **name**: `string`

Defined in: [capability/src/presets/platform.ts:59](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/capability/src/presets/platform.ts#L59)

该尺寸的具体用途名,如 `Thumbnail (1280×720)`

***

### width

> **width**: `number`

Defined in: [capability/src/presets/platform.ts:61](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/capability/src/presets/platform.ts#L61)

目标宽度(像素)

***

### height

> **height**: `number`

Defined in: [capability/src/presets/platform.ts:63](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/capability/src/presets/platform.ts#L63)

目标高度(像素)

***

### category

> **category**: [`PlatformPresetCategory`](/docs/api/capability/src/type-aliases/platformpresetcategory/)

Defined in: [capability/src/presets/platform.ts:65](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/capability/src/presets/platform.ts#L65)

用途分类

***

### description?

> `optional` **description?**: `string`

Defined in: [capability/src/presets/platform.ts:67](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/capability/src/presets/platform.ts#L67)

用途描述(可选)

***

### recommendedFormat?

> `optional` **recommendedFormat?**: [`PlatformRecommendedFormat`](/docs/api/capability/src/type-aliases/platformrecommendedformat/)

Defined in: [capability/src/presets/platform.ts:69](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/capability/src/presets/platform.ts#L69)

推荐输出格式(可选)

***

### recommendedFit?

> `optional` **recommendedFit?**: [`PlatformFitStrategy`](/docs/api/capability/src/type-aliases/platformfitstrategy/)

Defined in: [capability/src/presets/platform.ts:71](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/capability/src/presets/platform.ts#L71)

推荐 fit 策略(可选,默认 cover)
