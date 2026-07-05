---
editUrl: false
next: false
prev: false
title: "UseDebouncedRunResult"
---

Defined in: [ui-react/src/hooks/useDebouncedRun.ts:41](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/hooks/useDebouncedRun.ts#L41)

## Properties

### enabled

> **enabled**: `boolean`

Defined in: [ui-react/src/hooks/useDebouncedRun.ts:43](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/hooks/useDebouncedRun.ts#L43)

当前是否启用自动运行

***

### setEnabled

> **setEnabled**: (`v`) => `void`

Defined in: [ui-react/src/hooks/useDebouncedRun.ts:45](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/hooks/useDebouncedRun.ts#L45)

切换启用状态

#### Parameters

##### v

`boolean`

#### Returns

`void`

***

### runNow

> **runNow**: () => `void`

Defined in: [ui-react/src/hooks/useDebouncedRun.ts:47](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/hooks/useDebouncedRun.ts#L47)

立即触发运行(取消 pending debounce)

#### Returns

`void`

***

### cancelPending

> **cancelPending**: () => `void`

Defined in: [ui-react/src/hooks/useDebouncedRun.ts:49](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/hooks/useDebouncedRun.ts#L49)

取消 pending debounce(不取消正在运行的)

#### Returns

`void`

***

### isPending

> **isPending**: `boolean`

Defined in: [ui-react/src/hooks/useDebouncedRun.ts:51](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/hooks/useDebouncedRun.ts#L51)

是否有 pending 的执行(等待 debounce 触发)
