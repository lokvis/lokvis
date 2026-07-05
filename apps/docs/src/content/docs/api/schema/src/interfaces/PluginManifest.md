---
editUrl: false
next: false
prev: false
title: "PluginManifest"
---

Defined in: [schema/src/plugin.ts:20](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/plugin.ts#L20)

Plugin Manifest（package.json 中的 lokvis 字段或独立 manifest.json）

## Properties

### name

> **name**: `string`

Defined in: [schema/src/plugin.ts:21](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/plugin.ts#L21)

***

### version

> **version**: `string`

Defined in: [schema/src/plugin.ts:22](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/plugin.ts#L22)

***

### description

> **description**: `string`

Defined in: [schema/src/plugin.ts:23](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/plugin.ts#L23)

***

### author

> **author**: `string`

Defined in: [schema/src/plugin.ts:24](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/plugin.ts#L24)

***

### license

> **license**: `string`

Defined in: [schema/src/plugin.ts:25](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/plugin.ts#L25)

***

### main

> **main**: `string`

Defined in: [schema/src/plugin.ts:26](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/plugin.ts#L26)

***

### icon?

> `optional` **icon?**: `string`

Defined in: [schema/src/plugin.ts:27](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/plugin.ts#L27)

***

### capabilities

> **capabilities**: `string`[]

Defined in: [schema/src/plugin.ts:29](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/plugin.ts#L29)

声明使用的能力

***

### engines

> **engines**: `object`

Defined in: [schema/src/plugin.ts:31](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/plugin.ts#L31)

兼容的 Runtime 版本

#### lokvis-runtime

> **lokvis-runtime**: `string`

***

### permissions

> **permissions**: [`PluginPermission`](/docs/api/schema/src/type-aliases/pluginpermission/)[]

Defined in: [schema/src/plugin.ts:35](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/plugin.ts#L35)

权限声明
