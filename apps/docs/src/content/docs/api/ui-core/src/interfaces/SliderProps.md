---
editUrl: false
next: false
prev: false
title: "SliderProps"
---

Defined in: [ui-core/src/components/slider.tsx:3](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-core/src/components/slider.tsx#L3)

## Extends

- `Omit`\<`React.InputHTMLAttributes`\<`HTMLInputElement`\>, `"type"`\>

## Properties

### showValue?

> `optional` **showValue?**: `boolean`

Defined in: [ui-core/src/components/slider.tsx:5](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-core/src/components/slider.tsx#L5)

显示当前值与范围标签(渲染在滑块上方)

***

### format?

> `optional` **format?**: (`value`) => `string`

Defined in: [ui-core/src/components/slider.tsx:7](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-core/src/components/slider.tsx#L7)

自定义值格式化(如百分比 / 单位)

#### Parameters

##### value

`number`

#### Returns

`string`

***

### onValueChange?

> `optional` **onValueChange?**: (`value`) => `void`

Defined in: [ui-core/src/components/slider.tsx:13](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-core/src/components/slider.tsx#L13)

便捷回调:仅传数值,免去从 `e.target.value` 手动解包。
与 `onChange`(原生事件回调)可同时使用,二者都会触发。
推荐用此 prop 处理业务逻辑,`onChange` 仅在需要原生事件对象时使用。

#### Parameters

##### value

`number`

#### Returns

`void`
