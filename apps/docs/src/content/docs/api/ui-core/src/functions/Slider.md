---
editUrl: false
next: false
prev: false
title: "Slider"
---

> **Slider**(`__namedParameters`): `Element`

Defined in: [ui-core/src/components/slider.tsx:25](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-core/src/components/slider.tsx#L25)

Slider - 数值滑块。

基于 `<input type="range">`,样式经 `accent-color` 对齐设计主色。
受控用法:传 `value` + `onChange`(或 `onValueChange`);非受控用法:传 `defaultValue`。

API 一致性说明:为与 Toggle/Select 的"值回调"风格对齐,提供 `onValueChange(value)`。
原 `onChange` 仍透传原生 `ChangeEvent`,方便需要 `e.target` 的场景。两者不冲突。

## Parameters

### \_\_namedParameters

[`SliderProps`](/docs/api/ui-core/src/interfaces/sliderprops/)

## Returns

`Element`
