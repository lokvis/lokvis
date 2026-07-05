---
editUrl: false
next: false
prev: false
title: "PluginConfig"
---

Defined in: [schema/src/plugin.ts:39](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/plugin.ts#L39)

Plugin 配置（definePlugin 的参数）

## Properties

### name

> **name**: `string`

Defined in: [schema/src/plugin.ts:40](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/plugin.ts#L40)

***

### version

> **version**: `string`

Defined in: [schema/src/plugin.ts:41](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/plugin.ts#L41)

***

### description?

> `optional` **description?**: `string`

Defined in: [schema/src/plugin.ts:42](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/plugin.ts#L42)

***

### capabilities

> **capabilities**: [`Capability`](/docs/api/schema/src/interfaces/capability/)[]

Defined in: [schema/src/plugin.ts:44](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/plugin.ts#L44)

声明能力（Capability 定义）

***

### engine?

> `optional` **engine?**: `string`

Defined in: [schema/src/plugin.ts:46](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/plugin.ts#L46)

使用的引擎名

***

### permissions?

> `optional` **permissions?**: [`PluginPermission`](/docs/api/schema/src/type-aliases/pluginpermission/)[]

Defined in: [schema/src/plugin.ts:48](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/plugin.ts#L48)

权限声明
