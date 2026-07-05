---
editUrl: false
next: false
prev: false
title: "Tooltip"
---

> **Tooltip**(`__namedParameters`): `Element`

Defined in: [ui-core/src/components/tooltip.tsx:31](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-core/src/components/tooltip.tsx#L31)

Tooltip - 悬浮提示。

包裹一个触发器元素,鼠标悬浮或键盘聚焦时显示提示气泡。
纯 CSS 定位(absolute),不依赖 portal,适合简单场景。

无障碍:触发器自动获得 `aria-describedby` 指向提示内容。

## Parameters

### \_\_namedParameters

[`TooltipProps`](/docs/api/ui-core/src/interfaces/tooltipprops/)

## Returns

`Element`
