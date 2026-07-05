---
editUrl: false
next: false
prev: false
title: "groupPlatformPresetsByCategory"
---

> **groupPlatformPresetsByCategory**(`presets?`): `Map`\<[`PlatformPresetCategory`](/docs/api/capability/src/type-aliases/platformpresetcategory/), [`PlatformSizePreset`](/docs/api/capability/src/interfaces/platformsizepreset/)[]\>

Defined in: [capability/src/presets/platform.ts:765](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/capability/src/presets/platform.ts#L765)

按 category 分组返回预设(供选择器 optgroup 使用)。

同 category 内保持原始顺序(同平台相邻),便于用户按平台查找。

## Parameters

### presets?

[`PlatformSizePreset`](/docs/api/capability/src/interfaces/platformsizepreset/)[] = `PLATFORM_PRESETS`

## Returns

`Map`\<[`PlatformPresetCategory`](/docs/api/capability/src/type-aliases/platformpresetcategory/), [`PlatformSizePreset`](/docs/api/capability/src/interfaces/platformsizepreset/)[]\>
