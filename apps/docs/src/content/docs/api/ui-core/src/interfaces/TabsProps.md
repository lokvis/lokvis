---
editUrl: false
next: false
prev: false
title: "TabsProps"
---

Defined in: [ui-core/src/components/tabs.tsx:9](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-core/src/components/tabs.tsx#L9)

## Properties

### items

> **items**: [`TabItem`](/docs/api/ui-core/src/interfaces/tabitem/)[]

Defined in: [ui-core/src/components/tabs.tsx:11](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-core/src/components/tabs.tsx#L11)

标签页定义

***

### value?

> `optional` **value?**: `string`

Defined in: [ui-core/src/components/tabs.tsx:13](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-core/src/components/tabs.tsx#L13)

当前激活值(受控)

***

### defaultValue?

> `optional` **defaultValue?**: `string`

Defined in: [ui-core/src/components/tabs.tsx:15](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-core/src/components/tabs.tsx#L15)

默认激活值(非受控)

***

### onChange?

> `optional` **onChange?**: (`value`) => `void`

Defined in: [ui-core/src/components/tabs.tsx:17](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-core/src/components/tabs.tsx#L17)

激活值变更回调

#### Parameters

##### value

`string`

#### Returns

`void`

***

### children?

> `optional` **children?**: (`activeValue`) => `ReactNode`

Defined in: [ui-core/src/components/tabs.tsx:19](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-core/src/components/tabs.tsx#L19)

标签页内容渲染函数,按 value 分发

#### Parameters

##### activeValue

`string`

#### Returns

`ReactNode`

***

### className?

> `optional` **className?**: `string`

Defined in: [ui-core/src/components/tabs.tsx:20](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-core/src/components/tabs.tsx#L20)
