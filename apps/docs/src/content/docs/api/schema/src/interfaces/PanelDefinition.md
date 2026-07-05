---
editUrl: false
next: false
prev: false
title: "PanelDefinition"
---

Defined in: [schema/src/plugin.ts:52](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/plugin.ts#L52)

Panel 定义（UI 扩展点）

## Properties

### id

> **id**: `string`

Defined in: [schema/src/plugin.ts:53](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/plugin.ts#L53)

***

### name

> **name**: `string`

Defined in: [schema/src/plugin.ts:54](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/plugin.ts#L54)

***

### location

> **location**: `"sidebar"` \| `"inspector"` \| `"toolbar"` \| `"modal"`

Defined in: [schema/src/plugin.ts:56](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/plugin.ts#L56)

Panel 位置

***

### component

> **component**: `string`

Defined in: [schema/src/plugin.ts:58](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/plugin.ts#L58)

渲染组件标识（由 UI 层解析）

***

### show?

> `optional` **show?**: (`context`) => `boolean`

Defined in: [schema/src/plugin.ts:60](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/plugin.ts#L60)

显示条件

#### Parameters

##### context

###### selectedAssets

`string`[]

#### Returns

`boolean`
