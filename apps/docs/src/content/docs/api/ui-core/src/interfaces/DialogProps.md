---
editUrl: false
next: false
prev: false
title: "DialogProps"
---

Defined in: [ui-core/src/components/dialog.tsx:4](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-core/src/components/dialog.tsx#L4)

## Properties

### open

> **open**: `boolean`

Defined in: [ui-core/src/components/dialog.tsx:6](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-core/src/components/dialog.tsx#L6)

是否打开(受控)

***

### onClose

> **onClose**: () => `void`

Defined in: [ui-core/src/components/dialog.tsx:8](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-core/src/components/dialog.tsx#L8)

关闭回调(点遮罩 / ESC / 关闭按钮触发)

#### Returns

`void`

***

### title?

> `optional` **title?**: `ReactNode`

Defined in: [ui-core/src/components/dialog.tsx:10](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-core/src/components/dialog.tsx#L10)

标题

***

### footer?

> `optional` **footer?**: `ReactNode`

Defined in: [ui-core/src/components/dialog.tsx:12](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-core/src/components/dialog.tsx#L12)

底部操作区(通常放 Button)

***

### size?

> `optional` **size?**: `"sm"` \| `"md"` \| `"lg"`

Defined in: [ui-core/src/components/dialog.tsx:14](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-core/src/components/dialog.tsx#L14)

尺寸

***

### closeOnOverlay?

> `optional` **closeOnOverlay?**: `boolean`

Defined in: [ui-core/src/components/dialog.tsx:16](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-core/src/components/dialog.tsx#L16)

是否允许点遮罩关闭(默认 true)

***

### children?

> `optional` **children?**: `ReactNode`

Defined in: [ui-core/src/components/dialog.tsx:17](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-core/src/components/dialog.tsx#L17)
