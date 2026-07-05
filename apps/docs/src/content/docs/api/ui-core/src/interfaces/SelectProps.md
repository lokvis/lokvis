---
editUrl: false
next: false
prev: false
title: "SelectProps"
---

Defined in: [ui-core/src/components/select.tsx:9](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-core/src/components/select.tsx#L9)

## Extends

- `Omit`\<`React.SelectHTMLAttributes`\<`HTMLSelectElement`\>, `"onChange"`\>

## Properties

### options?

> `optional` **options?**: [`SelectOption`](/docs/api/ui-core/src/interfaces/selectoption/)[]

Defined in: [ui-core/src/components/select.tsx:11](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-core/src/components/select.tsx#L11)

选项列表(也可用 children <option>)

***

### placeholder?

> `optional` **placeholder?**: `string`

Defined in: [ui-core/src/components/select.tsx:13](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-core/src/components/select.tsx#L13)

占位符(渲染为 disabled 的首个 option)

***

### onChange?

> `optional` **onChange?**: (`value`) => `void`

Defined in: [ui-core/src/components/select.tsx:15](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-core/src/components/select.tsx#L15)

值变更回调

#### Parameters

##### value

`string`

#### Returns

`void`
