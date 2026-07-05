---
editUrl: false
next: false
prev: false
title: "PlatformFitStrategy"
---

> **PlatformFitStrategy** = `"cover"` \| `"contain"` \| `"fill"` \| `"inside"` \| `"outside"`

Defined in: [capability/src/presets/platform.ts:43](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/capability/src/presets/platform.ts#L43)

resize fit 策略(与 engine-image FitStrategy 取值对齐)。

- `cover`:缩放并裁剪溢出部分(填满目标尺寸)
- `contain`:缩放并在不足处留白(完整可见)
- `fill`:拉伸到目标尺寸(可能变形)
- `inside`:等比缩放到目标尺寸内(可能小于目标)
- `outside`:等比缩放到目标尺寸外(可能大于目标)
