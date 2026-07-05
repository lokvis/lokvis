---
editUrl: false
next: false
prev: false
title: "loadPlugin"
---

> **loadPlugin**(`runtime`, `plugin`): `Promise`\<`void`\>

Defined in: [sdk/src/index.ts:114](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/sdk/src/index.ts#L114)

加载单个插件到已有 Runtime。

用于运行时动态扩展能力(如用户在 UI 中启用某插件)。与 `createLokvis`
的 `plugins` 选项复用同一安装路径,区别仅在时机。

## Parameters

### runtime

[`LokvisRuntime`](/docs/api/runtime/src/interfaces/lokvisruntime/)

### plugin

[`PluginLoadEntry`](/docs/api/sdk/src/interfaces/pluginloadentry/)

## Returns

`Promise`\<`void`\>
