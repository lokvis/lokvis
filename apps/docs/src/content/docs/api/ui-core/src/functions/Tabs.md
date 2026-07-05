---
editUrl: false
next: false
prev: false
title: "Tabs"
---

> **Tabs**(`__namedParameters`): `Element`

Defined in: [ui-core/src/components/tabs.tsx:38](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-core/src/components/tabs.tsx#L38)

Tabs - 标签页。

受控 / 非受控双模式。键盘 ←/→ 切换,内容通过 render-prop children 渲染。

## Parameters

### \_\_namedParameters

[`TabsProps`](/docs/api/ui-core/src/interfaces/tabsprops/)

## Returns

`Element`

## Example

```tsx
<Tabs
  items={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]}
  defaultValue="a"
>
  {(active) => active === 'a' ? <PanelA /> : <PanelB />}
</Tabs>
```
