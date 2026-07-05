---
editUrl: false
next: false
prev: false
title: "UseThemeResult"
---

Defined in: [ui-react/src/hooks/useTheme.ts:51](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/hooks/useTheme.ts#L51)

## Properties

### theme

> **theme**: [`ThemeMode`](/docs/api/ui-react/src/type-aliases/thememode/) \| `null`

Defined in: [ui-react/src/hooks/useTheme.ts:53](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/hooks/useTheme.ts#L53)

用户显式选择的主题(未设置时为 null,跟随系统)

***

### resolvedTheme

> **resolvedTheme**: [`ThemeMode`](/docs/api/ui-react/src/type-aliases/thememode/)

Defined in: [ui-react/src/hooks/useTheme.ts:55](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/hooks/useTheme.ts#L55)

实际生效的主题(显式选择或系统偏好)

## Methods

### setTheme()

> **setTheme**(`theme`): `void`

Defined in: [ui-react/src/hooks/useTheme.ts:57](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/hooks/useTheme.ts#L57)

设置指定主题(传 null 表示跟随系统)

#### Parameters

##### theme

[`ThemeMode`](/docs/api/ui-react/src/type-aliases/thememode/) \| `null`

#### Returns

`void`

***

### toggleTheme()

> **toggleTheme**(): `void`

Defined in: [ui-react/src/hooks/useTheme.ts:59](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/hooks/useTheme.ts#L59)

在 light / dark 之间切换(无显式主题时基于 resolvedTheme 决定下一态)

#### Returns

`void`
