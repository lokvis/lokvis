---
editUrl: false
next: false
prev: false
title: "Dialog"
---

> **Dialog**(`__namedParameters`): `ReactPortal` \| `null`

Defined in: [ui-core/src/components/dialog.tsx:67](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-core/src/components/dialog.tsx#L67)

Dialog - 模态对话框。

通过 portal 挂载到 document.body,避免父级 transform/overflow 影响。
ESC 关闭、点遮罩关闭、打开时聚焦对话框、锁定 body 滚动、focus trap 限制 Tab。
无障碍:role="dialog" + aria-modal,标题作为 aria-label。

SSR 环境下 document 不存在时安全降级(返回 null)。

实现说明:
- `onClose` 用 ref 缓存,effect 依赖仅 `[open]`,避免父组件传新闭包导致反复 cleanup/setup
  造成 body.overflow 闪烁与 listener 抖动。
- body overflow 用全局计数器管理,支持多 Dialog 嵌套。
- focus trap 在 Tab/Shift+Tab 到边界时把焦点 wrap 回对话框内首个/末个可聚焦元素。

## Parameters

### \_\_namedParameters

[`DialogProps`](/docs/api/ui-core/src/interfaces/dialogprops/)

## Returns

`ReactPortal` \| `null`
